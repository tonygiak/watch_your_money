"""Hand-rolled HS256 JWT verifier tests.

Exercises every error subclass + the happy path. Keeps the audit surface
small per ``agent-runtime-security.md`` §4 (no PyJWT-style external dep).
"""

from __future__ import annotations

import time

import pytest

from app.auth import (
    JwtClaimError,
    JwtExpiredError,
    JwtMalformedError,
    JwtSignatureError,
    make_supabase_jwt_for_test,
    verify_supabase_jwt,
)

SECRET = "super-secret-test-only"


def test_happy_path_returns_sub() -> None:
    token = make_supabase_jwt_for_test("user-123", SECRET)
    result = verify_supabase_jwt(token, SECRET)
    assert result.sub == "user-123"
    assert result.payload["aud"] == "authenticated"


def test_signature_mismatch_with_wrong_secret() -> None:
    token = make_supabase_jwt_for_test("user-123", SECRET)
    with pytest.raises(JwtSignatureError):
        verify_supabase_jwt(token, "different-secret")


def test_malformed_when_not_three_parts() -> None:
    with pytest.raises(JwtMalformedError):
        verify_supabase_jwt("not.a.valid.jwt", SECRET)
    with pytest.raises(JwtMalformedError):
        verify_supabase_jwt("only-one-part", SECRET)


def test_expired_token_rejected() -> None:
    token = make_supabase_jwt_for_test("user-123", SECRET, expires_in=-1)
    # Anchor `now` past the leeway window so the test is deterministic.
    with pytest.raises(JwtExpiredError):
        verify_supabase_jwt(token, SECRET, now=time.time() + 120)


def test_wrong_audience_rejected() -> None:
    token = make_supabase_jwt_for_test("user-123", SECRET, audience="anon")
    with pytest.raises(JwtClaimError):
        verify_supabase_jwt(token, SECRET, expected_audience="authenticated")


def test_missing_sub_rejected() -> None:
    token = make_supabase_jwt_for_test("", SECRET)
    with pytest.raises(JwtClaimError):
        verify_supabase_jwt(token, SECRET)


def test_empty_secret_rejected_loudly() -> None:
    """A misconfigured server must NEVER accept a token with empty key."""
    token = make_supabase_jwt_for_test("user-123", SECRET)
    with pytest.raises(JwtSignatureError):
        verify_supabase_jwt(token, "")


def test_missing_exp_claim_rejected() -> None:
    """Supabase always sets exp; a token without it is malformed."""
    token = make_supabase_jwt_for_test(
        "user-123", SECRET, extra_claims={"exp": None}
    )
    with pytest.raises(JwtMalformedError):
        verify_supabase_jwt(token, SECRET)


def test_audience_list_accepts_match() -> None:
    token = make_supabase_jwt_for_test(
        "user-123", SECRET, extra_claims={"aud": ["authenticated", "user"]}
    )
    result = verify_supabase_jwt(token, SECRET, expected_audience="authenticated")
    assert result.sub == "user-123"
