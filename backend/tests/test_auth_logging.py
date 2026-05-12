"""JWT-rejection diagnostic log line — BLG-0025 / ADR-0016 §3 test contract.

The diagnostic line in ``jwt_exception_handler`` is the operational tool
that surfaced the 2026-05-12 Supabase ES256 rotation incident in under two
minutes. ADR-0016 §1 classifies JWT header fields (``alg``, ``typ``,
``kid``-truncated) as PII-safe public metadata. Payloads, signatures, the
full token, and the raw ``Authorization`` header value MUST NOT appear in
any log record.

This file pins both:

1. The **positive** contract — the log line is emitted exactly once per
   rejection with the right fields and a static ``reason`` per JwtError
   subclass.
2. The **negative** contract — a redaction regex scan over every captured
   log record in this test session finds zero JWT-shaped strings, zero
   literal payload base64, zero literal signature base64, zero literal
   ``Authorization`` values.
"""

from __future__ import annotations

import logging
import re

import pytest
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient

from app.auth import (
    JwtError,
    JwtMalformedError,
    make_supabase_jwt_for_test,
)
from app.routes.receipts import jwt_exception_handler

SECRET = "log-test-secret"
USER_ID = "00000000-0000-0000-0000-000000000099"


# ---------------------------------------------------------------------------
# Test app: a tiny FastAPI that exposes a route which always raises a
# specified JwtError. The exception handler we registered is the real one
# under test.
# ---------------------------------------------------------------------------


def _build_app(exc_to_raise: JwtError) -> FastAPI:
    app = FastAPI()

    @app.exception_handler(JwtError)
    async def _on_jwt(request: Request, exc: JwtError) -> JSONResponse:
        return jwt_exception_handler(request, exc)

    @app.get("/protected")
    def _protected() -> dict[str, str]:  # pragma: no cover - never reached
        raise exc_to_raise

    return app


# ---------------------------------------------------------------------------
# Positive contract — log line shape per ADR-0016 §2
# ---------------------------------------------------------------------------


def test_log_line_emitted_once_per_rejection(caplog: pytest.LogCaptureFixture) -> None:
    app = _build_app(JwtMalformedError("unsupported alg"))
    client = TestClient(app)
    token = make_supabase_jwt_for_test(USER_ID, SECRET, header_overrides={"kid": "abcdef-1234"})
    with caplog.at_level(logging.WARNING, logger="app.routes.receipts"):
        resp = client.get("/protected", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 401
    jwt_records = [r for r in caplog.records if "jwt_rejected" in r.getMessage()]
    assert len(jwt_records) == 1, (
        f"expected exactly one jwt_rejected log, got {len(jwt_records)}: "
        f"{[r.getMessage() for r in jwt_records]}"
    )


def test_log_line_includes_code_alg_typ_kid_and_static_reason(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """The five fields named in ADR-0016 §2 are surfaced in the log message."""
    app = _build_app(JwtMalformedError("unsupported alg: 'ES256'"))
    client = TestClient(app)
    token = make_supabase_jwt_for_test(
        USER_ID, SECRET, header_overrides={"alg": "ES256", "typ": "JWT", "kid": "kidvalue123456"}
    )
    with caplog.at_level(logging.WARNING, logger="app.routes.receipts"):
        client.get("/protected", headers={"Authorization": f"Bearer {token}"})
    msg = next(r.getMessage() for r in caplog.records if "jwt_rejected" in r.getMessage())
    assert "code=jwt_malformed" in msg
    assert "alg=ES256" in msg
    assert "typ=JWT" in msg
    # kid truncated to first 6 chars + ellipsis per ADR-0016 §2
    assert "kid=kidval…" in msg
    assert "reason=unsupported alg: 'ES256'" in msg


def test_log_line_truncates_long_kid_but_keeps_short_kid_intact(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """kid > 6 chars → first-6 + "…"; kid ≤ 6 chars → as-is."""
    app = _build_app(JwtMalformedError("any reason"))
    client = TestClient(app)
    # Long kid
    long_token = make_supabase_jwt_for_test(
        USER_ID, SECRET, header_overrides={"kid": "1234567890ABCDEF"}
    )
    # Short kid (exactly 6 chars)
    short_token = make_supabase_jwt_for_test(
        USER_ID, SECRET, header_overrides={"kid": "abc123"}
    )
    with caplog.at_level(logging.WARNING, logger="app.routes.receipts"):
        client.get("/protected", headers={"Authorization": f"Bearer {long_token}"})
        client.get("/protected", headers={"Authorization": f"Bearer {short_token}"})
    msgs = [r.getMessage() for r in caplog.records if "jwt_rejected" in r.getMessage()]
    assert any("kid=123456…" in m for m in msgs)
    assert any("kid=abc123" in m and "kid=abc123…" not in m for m in msgs)


def test_log_line_handles_malformed_token_without_crashing(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """A malformed token (non-JWT shape) still produces a clean log line
    with alg=None typ=None kid=None — the auth gate must never crash on a
    logging concern."""
    app = _build_app(JwtMalformedError("not three parts"))
    client = TestClient(app)
    with caplog.at_level(logging.WARNING, logger="app.routes.receipts"):
        client.get("/protected", headers={"Authorization": "Bearer not-a-real-jwt"})
    msg = next(r.getMessage() for r in caplog.records if "jwt_rejected" in r.getMessage())
    assert "alg=None" in msg
    assert "typ=None" in msg
    assert "kid=None" in msg


def test_log_line_without_authorization_header_logs_none_fields(
    caplog: pytest.LogCaptureFixture,
) -> None:
    app = _build_app(JwtMalformedError("missing Bearer token"))
    client = TestClient(app)
    with caplog.at_level(logging.WARNING, logger="app.routes.receipts"):
        client.get("/protected")  # no Authorization header at all
    msg = next(r.getMessage() for r in caplog.records if "jwt_rejected" in r.getMessage())
    assert "alg=None" in msg
    assert "typ=None" in msg
    assert "kid=None" in msg


def test_each_jwt_error_subclass_logs_its_static_code(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Each JwtError subclass surfaces its stable `code=...` field per
    ADR-0002 §4 / ADR-0015 §6."""
    from app.auth import (
        JwtClaimError,
        JwtExpiredError,
        JwtSignatureError,
    )

    cases: list[tuple[type[JwtError], str]] = [
        (JwtMalformedError, "code=jwt_malformed"),
        (JwtSignatureError, "code=jwt_signature"),
        (JwtExpiredError, "code=jwt_expired"),
        (JwtClaimError, "code=jwt_claim"),
    ]
    for exc_cls, expected_code_substring in cases:
        caplog.clear()
        app = _build_app(exc_cls("static reason"))
        client = TestClient(app)
        with caplog.at_level(logging.WARNING, logger="app.routes.receipts"):
            client.get("/protected")
        msg = next(r.getMessage() for r in caplog.records if "jwt_rejected" in r.getMessage())
        assert expected_code_substring in msg, (
            f"{exc_cls.__name__} did not surface {expected_code_substring}; got: {msg}"
        )


# ---------------------------------------------------------------------------
# Negative contract — redaction regex scan
# ---------------------------------------------------------------------------


# Token-ish: three base64url segments each ≥ 20 chars.
_JWT_SHAPE = re.compile(r"[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}")
# A `Bearer ` prefix anywhere is forbidden (never echo the raw Authorization value).
_BEARER_LITERAL = re.compile(r"[Bb]earer\s+[A-Za-z0-9_.-]{20,}")


def test_redaction_regex_scan_finds_no_token_shaped_strings(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """The most important test in this file. Drive several rejections then
    scan EVERY captured log record (across all loggers) for forbidden
    shapes."""
    app = _build_app(JwtMalformedError("a reason"))
    client = TestClient(app)
    tokens = [
        make_supabase_jwt_for_test(USER_ID, SECRET),
        make_supabase_jwt_for_test(
            USER_ID, SECRET, header_overrides={"alg": "ES256", "kid": "supersecretkid"}
        ),
        make_supabase_jwt_for_test(
            USER_ID, SECRET, extra_claims={"email": "leak@example.test", "phone": "+306900000000"}
        ),
    ]
    with caplog.at_level(logging.DEBUG):  # widest possible level
        for token in tokens:
            client.get("/protected", headers={"Authorization": f"Bearer {token}"})
        client.get("/protected")  # no header

    # Build the full body of every captured record (message + args).
    haystacks: list[str] = []
    for record in caplog.records:
        haystacks.append(record.getMessage())
        haystacks.append(str(record.msg))
        haystacks.append(repr(record.args))
    combined = "\n".join(haystacks)

    # Negative-contract assertions (each one is the failure case for a
    # whole class of leakage).
    matches = _JWT_SHAPE.findall(combined)
    assert matches == [], (
        f"Found {len(matches)} JWT-shaped string(s) in captured log records; "
        f"first match: {matches[0]!r}"
    )
    bearer_matches = _BEARER_LITERAL.findall(combined)
    assert bearer_matches == [], (
        f"Found Bearer-token-shaped substring in log records: {bearer_matches[0]!r}"
    )
    # Payload claims must not be in logs either.
    assert "leak@example.test" not in combined
    assert "+306900000000" not in combined
    # The full Authorization header value (verbatim) must never appear.
    for token in tokens:
        assert token not in combined, "raw token leaked into a log record"


def test_redaction_regex_recognizes_a_real_jwt_shape() -> None:
    """Sanity check on the regex itself: a real JWT MUST match (so the
    redaction-scan assertion above is meaningful, not a false negative)."""
    token = make_supabase_jwt_for_test(USER_ID, SECRET)
    assert _JWT_SHAPE.search(token), (
        "redaction regex would never catch a real JWT — fix the regex"
    )


def test_log_reason_never_contains_user_claim_values(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """ADR-0016 §1 / Round-1 security-privacy-officer: the `reason` field
    must be a static literal, never an f-string interpolating claim values.
    This test asserts the verifier-side static messages never include
    claim content even when the user is the one supplying the offending
    value."""
    # JwtClaimError("unexpected aud") — the message is static. Force the
    # error by sending a token with a wrong audience.
    from app.auth import verify_supabase_jwt

    token = make_supabase_jwt_for_test(
        USER_ID, SECRET, audience="some-secret-internal-aud"
    )
    try:
        verify_supabase_jwt(
            token,
            legacy_hs256_secret=SECRET,
            expected_audience="authenticated",
        )
    except Exception as exc:  # noqa: BLE001 - we just need the message
        assert "some-secret-internal-aud" not in str(exc), (
            "JwtError messages must NOT interpolate claim values"
        )
