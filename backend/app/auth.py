"""Hand-rolled HS256 JWT verification for Supabase tokens.

ADR-0002 §1: the backend verifies the Supabase Auth Bearer JWT in-process
using ``SUPABASE_JWT_SECRET`` — no Supabase round-trip and no new runtime
dependency (per ``agent-runtime-security.md`` §4: "supply-chain discipline —
new runtime dependencies require an ADR"). HS256 is the algorithm Supabase
issues by default for project JWTs.

We deliberately avoid PyJWT / python-jose / etc. because:

- The auditable surface is ~100 lines of stdlib code.
- We never need to handle alg=none, alg=RS256, JWKS rotation, or refresh
  tokens here — the mobile client already speaks Supabase Auth directly
  for refresh, and the backend only validates short-lived access tokens
  on each request.

Anything more is a discovery-sprint decision (`AGENTS.md` §4.1.1).
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from dataclasses import dataclass
from typing import Any


class JwtError(Exception):
    """Base class for every JWT verification failure."""

    code: str = "jwt_invalid"


class JwtMalformedError(JwtError):
    code = "jwt_malformed"


class JwtSignatureError(JwtError):
    code = "jwt_signature"


class JwtExpiredError(JwtError):
    code = "jwt_expired"


class JwtClaimError(JwtError):
    code = "jwt_claim"


_LEEWAY_SECONDS = 60
"""Clock skew tolerance for ``exp`` and ``iat`` (seconds)."""


@dataclass(frozen=True)
class VerifiedJwt:
    """Result of a successful HS256 verification."""

    sub: str
    payload: dict[str, Any]


def verify_supabase_jwt(
    token: str,
    secret: str,
    *,
    expected_audience: str | None = "authenticated",
    now: float | None = None,
) -> VerifiedJwt:
    """Verify a Supabase HS256 JWT and return the verified ``sub`` + payload.

    Raises a :class:`JwtError` subclass on any failure — never returns a
    partial result. The error subclass carries the stable ``code`` mapped to
    HTTP 401 by the API error envelope (ADR-0002 §4).
    """
    if not token or not isinstance(token, str):
        raise JwtMalformedError("missing token")

    if not secret:
        # A misconfigured server must NEVER accept a token with an empty key.
        raise JwtSignatureError("server misconfigured: no JWT secret")

    parts = token.split(".")
    if len(parts) != 3:
        raise JwtMalformedError("expected three dot-separated parts")
    header_b64, payload_b64, sig_b64 = parts

    try:
        header = json.loads(_b64url_decode(header_b64))
        payload = json.loads(_b64url_decode(payload_b64))
    except (ValueError, json.JSONDecodeError) as exc:
        raise JwtMalformedError(f"invalid base64 or json: {exc}") from exc

    if not isinstance(header, dict) or not isinstance(payload, dict):
        raise JwtMalformedError("header / payload must be JSON objects")

    alg = header.get("alg")
    if alg != "HS256":
        raise JwtMalformedError(f"unsupported alg: {alg!r}")
    if header.get("typ") not in (None, "JWT"):
        raise JwtMalformedError(f"unsupported typ: {header.get('typ')!r}")

    expected_sig = hmac.new(
        secret.encode("utf-8"),
        f"{header_b64}.{payload_b64}".encode("ascii"),
        hashlib.sha256,
    ).digest()
    try:
        actual_sig = _b64url_decode(sig_b64)
    except ValueError as exc:
        raise JwtMalformedError(f"signature is not valid base64url: {exc}") from exc
    if not hmac.compare_digest(expected_sig, actual_sig):
        raise JwtSignatureError("signature mismatch")

    current_time = now if now is not None else time.time()

    exp = payload.get("exp")
    if isinstance(exp, int | float):
        if current_time > float(exp) + _LEEWAY_SECONDS:
            raise JwtExpiredError("token expired")
    else:
        # Supabase always sets exp; missing exp is a malformed token.
        raise JwtMalformedError("missing exp claim")

    iat = payload.get("iat")
    if isinstance(iat, int | float) and float(iat) > current_time + _LEEWAY_SECONDS:
        raise JwtClaimError("iat is in the future")

    if expected_audience is not None:
        aud = payload.get("aud")
        if isinstance(aud, str):
            if aud != expected_audience:
                raise JwtClaimError(f"unexpected aud: {aud!r}")
        elif isinstance(aud, list):
            if expected_audience not in aud:
                raise JwtClaimError(f"unexpected aud list: {aud!r}")
        else:
            raise JwtClaimError("missing aud claim")

    sub = payload.get("sub")
    if not isinstance(sub, str) or not sub:
        raise JwtClaimError("missing or empty sub claim")

    return VerifiedJwt(sub=sub, payload=payload)


def _b64url_decode(segment: str) -> bytes:
    """URL-safe base64 decode with padding fixup."""
    padded = segment + "=" * (-len(segment) % 4)
    return base64.urlsafe_b64decode(padded.encode("ascii"))


def _b64url_encode(data: bytes) -> str:
    """URL-safe base64 encode without padding (helper for tests)."""
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def make_supabase_jwt_for_test(
    sub: str,
    secret: str,
    *,
    expires_in: int = 3600,
    audience: str = "authenticated",
    extra_claims: dict[str, Any] | None = None,
) -> str:
    """Mint an HS256 JWT for tests.

    Lives here so tests don't drag in a JWT library. Production code never
    calls this — the mobile client gets its token from Supabase Auth directly.
    """
    header = {"alg": "HS256", "typ": "JWT"}
    now = int(time.time())
    payload = {
        "sub": sub,
        "aud": audience,
        "iat": now,
        "exp": now + expires_in,
    }
    if extra_claims:
        payload.update(extra_claims)

    header_b64 = _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_b64 = _b64url_encode(
        json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    )
    signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
    sig = hmac.new(secret.encode("utf-8"), signing_input, hashlib.sha256).digest()
    return f"{header_b64}.{payload_b64}.{_b64url_encode(sig)}"
