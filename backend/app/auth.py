"""Supabase JWT verification — asymmetric (ES256 / RS256) with HS256 transitional.

Owned by ADR-0015 (S-010). Supersedes ADR-0002 §1 (HS256-only verifier).

Design contract (ADR-0015):

- Asymmetric verification is the long-term posture. Key material comes from
  the project's JWKS endpoint (``{SUPABASE_URL}/auth/v1/.well-known/jwks.json``)
  and is cached in-process with a TTL of 600 s (ADR-0015 §3). On a ``kid``
  miss the cache refetches, rate-limited to one refetch per 60 s (DoS
  resistance — unknown-``kid`` floods cannot stampede the JWKS endpoint).
- HS256 is retained as a transitional path for the rollback window: a
  Supabase project can be rolled back to its Legacy HS256 signing secret
  (Option A / DES-0006) while a fix is being deployed. BLG-0034 retires
  HS256 once the production project runs on JWT Signing Keys for one
  release cycle.
- Algorithm allowlist is hard-pinned to ``{ES256, RS256, HS256}``. Every
  other ``alg`` — including ``none`` — is rejected with
  :class:`JwtMalformedError`. The token's declared ``alg`` must match the
  key type of its referenced ``kid`` (ADR-0015 §4 cross-checks).
- The ``cryptography`` library is the only new runtime dependency (one dep,
  not two; ``PyJWT`` was rejected in ADR-0015 Round 1).
- The :class:`JwtError` taxonomy is preserved verbatim from ADR-0002 §4 so
  the route's RFC-7807 mapping is unchanged.
- Header extraction is exposed as :func:`extract_header_metadata` for the
  diagnostic log line owned by ADR-0016 / BLG-0025. The static-``reason``
  discipline (no claim interpolation, no header interpolation beyond
  ``alg``/``typ``/``kid``-truncated) is enforced by tests in
  ``backend/tests/test_auth_logging.py``.

The verifier hard-fails 401 on JWKS unreachability or malformed JWKS — never
silently allows a request. The client cannot distinguish "your token is
bad" from "JWKS endpoint is down" (ADR-0015 §6); operators see the
distinction in the server log line (ADR-0016 §2).
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import threading
import time
from dataclasses import dataclass, field
from typing import Any, Protocol

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec, padding, rsa
from cryptography.hazmat.primitives.asymmetric.utils import (
    encode_dss_signature,
)

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Error taxonomy (preserved from ADR-0002 §4)
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------


_LEEWAY_SECONDS = 60
"""Clock skew tolerance for ``exp`` and ``iat`` (seconds)."""

_ALLOWED_ALGS: frozenset[str] = frozenset({"ES256", "RS256", "HS256"})
"""ADR-0015 §4 algorithm allowlist. Pinned by the negative tests."""

_JWKS_REFETCH_FLOOR_SECONDS = 60
"""ADR-0015 §3: ≥ 60 s between cache refetches (DoS resistance)."""

_KID_LOG_PREFIX_LEN = 6
"""ADR-0016 §2: ``kid`` truncated to first-6-chars + ``"…"`` when > 6 chars."""


# ---------------------------------------------------------------------------
# Verified-JWT payload
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class VerifiedJwt:
    """Result of a successful verification."""

    sub: str
    payload: dict[str, Any]


@dataclass(frozen=True)
class HeaderMetadata:
    """Header fields safe to log on a rejection (ADR-0016 §1).

    Only fields explicitly classified as PII-safe public metadata by RFC 7519
    §5 + ADR-0016 are exposed here. The full token, the payload, the
    signature, and the raw ``Authorization`` header value MUST NOT appear
    anywhere a logger can reach.
    """

    alg: str | None
    typ: str | None
    kid: str | None  # already truncated for log emission


def extract_header_metadata(token: str | None) -> HeaderMetadata:
    """Return the loggable header fields for ``token``, or all-``None``.

    Never raises. This is a *logging* helper — a malformed token must still
    return cleanly so the diagnostic line in ``jwt_exception_handler``
    surfaces ``alg=None typ=None kid=None`` without crashing the auth gate.
    ``kid`` is pre-truncated to ``first-6-chars + "…"`` when longer than 6.
    """
    if not isinstance(token, str) or not token:
        return HeaderMetadata(alg=None, typ=None, kid=None)
    parts = token.split(".")
    if len(parts) != 3:
        return HeaderMetadata(alg=None, typ=None, kid=None)
    try:
        header_bytes = _b64url_decode(parts[0])
        header = json.loads(header_bytes)
    except (ValueError, TypeError, json.JSONDecodeError):
        return HeaderMetadata(alg=None, typ=None, kid=None)
    if not isinstance(header, dict):
        return HeaderMetadata(alg=None, typ=None, kid=None)
    alg = header.get("alg")
    typ = header.get("typ")
    kid = header.get("kid")
    alg_str = str(alg) if alg is not None else None
    typ_str = str(typ) if typ is not None else None
    kid_str: str | None
    if isinstance(kid, str):
        kid_str = (kid[:_KID_LOG_PREFIX_LEN] + "…") if len(kid) > _KID_LOG_PREFIX_LEN else kid
    else:
        kid_str = None
    return HeaderMetadata(alg=alg_str, typ=typ_str, kid=kid_str)


# ---------------------------------------------------------------------------
# JWKS provider + verification key abstraction
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class JWKKey:
    """A single verification key resolved from the JWKS document.

    Concrete keys are stored as their :mod:`cryptography` public-key object
    so verification is a thin shim. ``kid`` and ``alg`` (when declared on
    the JWK) are preserved for the cross-check matrix.
    """

    kid: str
    kty: str  # "EC" or "RSA"
    alg: str | None  # JWK-declared alg, if present
    public_key: Any  # ec.EllipticCurvePublicKey or rsa.RSAPublicKey


class JWKSProvider(Protocol):
    """Injectable JWKS source (ADR-0015 Round 1, engineering-manager #1).

    Production wraps the Supabase JWKS endpoint behind an in-process cache.
    Tests inject a fake. The protocol is the boundary the verifier
    depends on; the verifier never imports ``requests`` directly.
    """

    def get_keys(self, *, force_refresh: bool = False) -> dict[str, JWKKey]:
        """Return ``{kid: JWKKey}``. Raise on hard-unreachable."""
        ...


class JWKSUnreachableError(JwtMalformedError):
    """Internal-only: JWKS endpoint down / malformed. Maps to 401 outward."""

    def __init__(self, reason: str = "jwks_unreachable") -> None:
        super().__init__(reason)


# ---------------------------------------------------------------------------
# Cached-JWKS production provider
# ---------------------------------------------------------------------------


class CachedJwksProvider:
    """In-process TTL cache around the Supabase JWKS endpoint.

    Contract per ADR-0015 §3:

    - TTL = 600 s (overridable for tests).
    - On ``get_keys(force_refresh=True)``: refetch unless the last refetch
      attempt was less than 60 s ago (rate-limiter; DoS resistance).
    - Hard-fails with :class:`JWKSUnreachableError` when the HTTP fetch
      raises, returns non-200, or parses to an invalid JWKS document.
    - Never silently accepts unverified tokens.
    """

    def __init__(
        self,
        *,
        jwks_url: str,
        ttl_seconds: int,
        fetcher: JwksFetcher | None = None,
        time_source: _TimeSource | None = None,
    ) -> None:
        self._jwks_url = jwks_url
        self._ttl = max(int(ttl_seconds), 0)
        self._fetcher = fetcher or _RequestsJwksFetcher()
        self._now = time_source or time.monotonic
        self._lock = threading.Lock()
        self._keys: dict[str, JWKKey] | None = None
        self._fetched_at: float = -1e18
        self._last_refetch_attempt_at: float = -1e18

    def get_keys(self, *, force_refresh: bool = False) -> dict[str, JWKKey]:
        with self._lock:
            now = self._now()
            cache_fresh = (
                self._keys is not None and (now - self._fetched_at) < self._ttl
            )
            if cache_fresh and not force_refresh:
                return self._keys  # type: ignore[return-value]
            # Refetch unless we just failed to refetch.
            since_attempt = now - self._last_refetch_attempt_at
            if force_refresh and since_attempt < _JWKS_REFETCH_FLOOR_SECONDS:
                # Inside the rate-limiter window. If we have stale keys, fall
                # back to them (still better than rejecting every request).
                # If we have nothing, hard-fail.
                if self._keys is not None:
                    return self._keys
                raise JWKSUnreachableError("jwks_unreachable")
            self._last_refetch_attempt_at = now
            try:
                document = self._fetcher.fetch(self._jwks_url)
                keys = _parse_jwks_document(document)
            except (JWKSUnreachableError, _JwksParseError) as exc:
                # Don't poison a previously-good cache; surface the failure.
                if self._keys is None:
                    raise JWKSUnreachableError(str(exc)) from exc
                # Stale-fall-back: serve the previous cache rather than fail.
                return self._keys
            self._keys = keys
            self._fetched_at = now
            return keys


class JwksFetcher(Protocol):
    """HTTP fetcher boundary (so tests don't need a network)."""

    def fetch(self, url: str) -> dict[str, Any]:  # pragma: no cover
        ...


class _RequestsJwksFetcher:
    """Production fetcher: 5 s timeout, no retries (ADR-0015 Round 2)."""

    def fetch(self, url: str) -> dict[str, Any]:
        # Lazy import keeps the test path free of ``requests`` when a fake
        # fetcher is injected.
        import requests

        try:
            response = requests.get(url, timeout=5)
        except requests.RequestException as exc:
            raise JWKSUnreachableError(f"jwks_fetch_failed: {exc.__class__.__name__}") from exc
        if response.status_code != 200:
            raise JWKSUnreachableError(
                f"jwks_status_{response.status_code}"
            )
        try:
            doc = response.json()
        except ValueError as exc:
            raise JWKSUnreachableError("jwks_invalid_json") from exc
        if not isinstance(doc, dict):
            raise JWKSUnreachableError("jwks_not_object")
        return doc


class _TimeSource(Protocol):
    def __call__(self) -> float:  # pragma: no cover - tiny
        ...


# ---------------------------------------------------------------------------
# JWKS document parsing
# ---------------------------------------------------------------------------


class _JwksParseError(Exception):
    """Internal: a JWKS document does not match the expected shape."""


def _parse_jwks_document(document: dict[str, Any]) -> dict[str, JWKKey]:
    """Build ``{kid: JWKKey}`` from a JWKS document.

    Unknown / unsupported entries are skipped (forward-compat). An empty
    result is a parse error — JWKS with zero usable keys is operationally
    equivalent to "unreachable" for our purposes.
    """
    raw_keys = document.get("keys")
    if not isinstance(raw_keys, list):
        raise _JwksParseError("missing or non-list 'keys' field")
    out: dict[str, JWKKey] = {}
    for entry in raw_keys:
        if not isinstance(entry, dict):
            continue
        kid = entry.get("kid")
        kty = entry.get("kty")
        if not isinstance(kid, str) or not isinstance(kty, str):
            continue
        alg = entry.get("alg") if isinstance(entry.get("alg"), str) else None
        pk: Any
        try:
            if kty == "EC":
                pk = _build_ec_public_key(entry)
            elif kty == "RSA":
                pk = _build_rsa_public_key(entry)
            else:
                continue
        except (ValueError, KeyError, TypeError):
            # Skip malformed entries; do not poison the whole JWKS.
            continue
        out[kid] = JWKKey(kid=kid, kty=kty, alg=alg, public_key=pk)
    if not out:
        raise _JwksParseError("no usable keys")
    return out


def _build_ec_public_key(jwk: dict[str, Any]) -> ec.EllipticCurvePublicKey:
    if jwk.get("crv") != "P-256":
        raise ValueError("only P-256 EC keys are supported")
    x_b = _b64url_decode(jwk["x"])
    y_b = _b64url_decode(jwk["y"])
    if len(x_b) != 32 or len(y_b) != 32:
        raise ValueError("P-256 coordinates must be 32 bytes")
    x_int = int.from_bytes(x_b, "big")
    y_int = int.from_bytes(y_b, "big")
    numbers = ec.EllipticCurvePublicNumbers(x_int, y_int, ec.SECP256R1())
    return numbers.public_key()


def _build_rsa_public_key(jwk: dict[str, Any]) -> rsa.RSAPublicKey:
    n_b = _b64url_decode(jwk["n"])
    e_b = _b64url_decode(jwk["e"])
    n = int.from_bytes(n_b, "big")
    e = int.from_bytes(e_b, "big")
    return rsa.RSAPublicNumbers(e, n).public_key()


# ---------------------------------------------------------------------------
# Verifier — the public API
# ---------------------------------------------------------------------------


def verify_supabase_jwt(
    token: str,
    *,
    jwks_provider: JWKSProvider | None = None,
    legacy_hs256_secret: str | None = None,
    expected_audience: str | None = "authenticated",
    now: float | None = None,
) -> VerifiedJwt:
    """Verify a Supabase JWT against the asymmetric posture from ADR-0015.

    Either ``jwks_provider`` (for ES256 / RS256) or ``legacy_hs256_secret``
    (transitional HS256) must be configured. Tokens whose declared ``alg``
    has no key material configured are rejected with
    :class:`JwtMalformedError` — never silently accepted.
    """
    if not token or not isinstance(token, str):
        raise JwtMalformedError("missing token")

    parts = token.split(".")
    if len(parts) != 3:
        raise JwtMalformedError("expected three dot-separated parts")
    header_b64, payload_b64, sig_b64 = parts

    try:
        header = json.loads(_b64url_decode(header_b64))
        payload = json.loads(_b64url_decode(payload_b64))
    except (ValueError, json.JSONDecodeError) as exc:
        raise JwtMalformedError("invalid base64 or json in header / payload") from exc

    if not isinstance(header, dict) or not isinstance(payload, dict):
        raise JwtMalformedError("header / payload must be JSON objects")

    alg = header.get("alg")
    if alg == "none" or alg is None:
        # `alg=none` is the classic JWT vulnerability surface. Pinned in
        # `ADR-0015 §4` and by a negative test in `tests/auth/test_jwt.py`.
        raise JwtMalformedError("alg=none refused")
    if not isinstance(alg, str) or alg not in _ALLOWED_ALGS:
        raise JwtMalformedError(f"unsupported alg: {alg!r}")
    if header.get("typ") not in (None, "JWT"):
        raise JwtMalformedError("unsupported typ")

    signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
    try:
        signature = _b64url_decode(sig_b64)
    except ValueError as exc:
        raise JwtMalformedError("signature is not valid base64url") from exc

    kid = header.get("kid")
    kid_str = kid if isinstance(kid, str) else None

    if alg == "HS256":
        _verify_hs256(
            signing_input=signing_input,
            signature=signature,
            legacy_secret=legacy_hs256_secret,
            kid=kid_str,
            jwks_provider=jwks_provider,
        )
    elif alg in ("ES256", "RS256"):
        if jwks_provider is None:
            raise JwtMalformedError("asymmetric verification not configured")
        _verify_asymmetric(
            alg=alg,
            kid=kid_str,
            signing_input=signing_input,
            signature=signature,
            jwks_provider=jwks_provider,
        )
    else:  # pragma: no cover - allowlist already gates this
        raise JwtMalformedError(f"unsupported alg: {alg!r}")

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
                raise JwtClaimError("unexpected aud")
        elif isinstance(aud, list):
            if expected_audience not in aud:
                raise JwtClaimError("unexpected aud list")
        else:
            raise JwtClaimError("missing aud claim")

    sub = payload.get("sub")
    if not isinstance(sub, str) or not sub:
        raise JwtClaimError("missing or empty sub claim")

    return VerifiedJwt(sub=sub, payload=payload)


# ---------------------------------------------------------------------------
# Per-algorithm verifiers
# ---------------------------------------------------------------------------


def _verify_hs256(
    *,
    signing_input: bytes,
    signature: bytes,
    legacy_secret: str | None,
    kid: str | None,
    jwks_provider: JWKSProvider | None,
) -> None:
    if not legacy_secret:
        # ADR-0015 §4 cross-check: HS256 without a configured legacy secret
        # is unreachable; reject rather than silently accept.
        raise JwtMalformedError("HS256 deprecated; LEGACY_SECRET not set")
    # ADR-0015 §4 cross-check: a token with alg=HS256 but a kid declared by
    # JWKS as an asymmetric key is ambiguous and a vulnerability surface.
    if kid and jwks_provider is not None:
        try:
            keys = jwks_provider.get_keys()
        except JWKSUnreachableError:
            keys = {}
        if kid in keys:
            raise JwtMalformedError("HS256 token with asymmetric kid")
    expected_sig = hmac.new(
        legacy_secret.encode("utf-8"),
        signing_input,
        hashlib.sha256,
    ).digest()
    if not hmac.compare_digest(expected_sig, signature):
        raise JwtSignatureError("signature mismatch")


def _verify_asymmetric(
    *,
    alg: str,
    kid: str | None,
    signing_input: bytes,
    signature: bytes,
    jwks_provider: JWKSProvider,
) -> None:
    if not kid:
        raise JwtMalformedError("missing kid for asymmetric alg")
    try:
        keys = jwks_provider.get_keys()
    except JWKSUnreachableError as exc:
        raise JwtMalformedError("jwks_unreachable") from exc
    key = keys.get(kid)
    if key is None:
        # `kid` miss → trigger a single refetch attempt (rate-limited).
        try:
            keys = jwks_provider.get_keys(force_refresh=True)
        except JWKSUnreachableError as exc:
            raise JwtMalformedError("jwks_unreachable") from exc
        key = keys.get(kid)
        if key is None:
            raise JwtMalformedError("unknown kid")

    _enforce_alg_key_type(alg=alg, key=key)

    if alg == "ES256":
        _verify_es256(signing_input=signing_input, signature=signature, key=key)
    elif alg == "RS256":
        _verify_rs256(signing_input=signing_input, signature=signature, key=key)
    else:  # pragma: no cover
        raise JwtMalformedError(f"unsupported alg: {alg!r}")


def _enforce_alg_key_type(*, alg: str, key: JWKKey) -> None:
    """Reject `alg=ES256` against an RSA key (and vice versa) — ADR-0015 §4."""
    if alg == "ES256" and key.kty != "EC":
        raise JwtMalformedError("alg/key-type mismatch")
    if alg == "RS256" and key.kty != "RSA":
        raise JwtMalformedError("alg/key-type mismatch")
    # If the JWK itself declares an `alg`, it must match.
    if key.alg is not None and key.alg != alg:
        raise JwtMalformedError("alg/key-type mismatch")


def _verify_es256(
    *, signing_input: bytes, signature: bytes, key: JWKKey
) -> None:
    if len(signature) != 64:
        raise JwtSignatureError("invalid ES256 signature length")
    r = int.from_bytes(signature[:32], "big")
    s = int.from_bytes(signature[32:], "big")
    der = encode_dss_signature(r, s)
    pk: ec.EllipticCurvePublicKey = key.public_key
    try:
        pk.verify(der, signing_input, ec.ECDSA(hashes.SHA256()))
    except InvalidSignature as exc:
        raise JwtSignatureError("signature mismatch") from exc


def _verify_rs256(
    *, signing_input: bytes, signature: bytes, key: JWKKey
) -> None:
    pk: rsa.RSAPublicKey = key.public_key
    try:
        pk.verify(signature, signing_input, padding.PKCS1v15(), hashes.SHA256())
    except InvalidSignature as exc:
        raise JwtSignatureError("signature mismatch") from exc


# ---------------------------------------------------------------------------
# Base64url helpers
# ---------------------------------------------------------------------------


def _b64url_decode(segment: str) -> bytes:
    """URL-safe base64 decode with padding fixup."""
    padded = segment + "=" * (-len(segment) % 4)
    return base64.urlsafe_b64decode(padded.encode("ascii"))


def _b64url_encode(data: bytes) -> str:
    """URL-safe base64 encode without padding (helper for tests)."""
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


# ---------------------------------------------------------------------------
# Test helpers — mint signed tokens without dragging a JWT library in
# ---------------------------------------------------------------------------


def make_supabase_jwt_for_test(
    sub: str,
    secret: str,
    *,
    expires_in: int = 3600,
    audience: str = "authenticated",
    extra_claims: dict[str, Any] | None = None,
    header_overrides: dict[str, Any] | None = None,
) -> str:
    """Mint an HS256 JWT for tests (transitional path).

    Production never calls this. Tests rely on it for HS256-path cases and
    for negative cases that only need a header / payload shape.
    """
    header = {"alg": "HS256", "typ": "JWT"}
    if header_overrides:
        header.update(header_overrides)
    now = int(time.time())
    payload: dict[str, Any] = {
        "sub": sub,
        "aud": audience,
        "iat": now,
        "exp": now + expires_in,
    }
    if extra_claims:
        payload.update(extra_claims)
    payload = {k: v for k, v in payload.items() if v is not None}

    header_b64 = _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_b64 = _b64url_encode(
        json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    )
    signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
    sig = hmac.new(secret.encode("utf-8"), signing_input, hashlib.sha256).digest()
    return f"{header_b64}.{payload_b64}.{_b64url_encode(sig)}"


def make_es256_jwt_for_test(
    *,
    sub: str,
    private_key: ec.EllipticCurvePrivateKey,
    kid: str,
    expires_in: int = 3600,
    audience: str = "authenticated",
    extra_claims: dict[str, Any] | None = None,
    header_overrides: dict[str, Any] | None = None,
) -> str:
    """Mint an ES256 (P-256 ECDSA) JWT for tests."""
    from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature

    header = {"alg": "ES256", "typ": "JWT", "kid": kid}
    if header_overrides:
        header.update(header_overrides)
    now = int(time.time())
    payload: dict[str, Any] = {
        "sub": sub,
        "aud": audience,
        "iat": now,
        "exp": now + expires_in,
    }
    if extra_claims:
        payload.update(extra_claims)
    payload = {k: v for k, v in payload.items() if v is not None}
    header_b64 = _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_b64 = _b64url_encode(
        json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    )
    signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
    der = private_key.sign(signing_input, ec.ECDSA(hashes.SHA256()))
    r, s = decode_dss_signature(der)
    sig = r.to_bytes(32, "big") + s.to_bytes(32, "big")
    return f"{header_b64}.{payload_b64}.{_b64url_encode(sig)}"


def make_rs256_jwt_for_test(
    *,
    sub: str,
    private_key: rsa.RSAPrivateKey,
    kid: str,
    expires_in: int = 3600,
    audience: str = "authenticated",
    extra_claims: dict[str, Any] | None = None,
    header_overrides: dict[str, Any] | None = None,
) -> str:
    """Mint an RS256 JWT for tests."""
    header = {"alg": "RS256", "typ": "JWT", "kid": kid}
    if header_overrides:
        header.update(header_overrides)
    now = int(time.time())
    payload: dict[str, Any] = {
        "sub": sub,
        "aud": audience,
        "iat": now,
        "exp": now + expires_in,
    }
    if extra_claims:
        payload.update(extra_claims)
    payload = {k: v for k, v in payload.items() if v is not None}
    header_b64 = _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_b64 = _b64url_encode(
        json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    )
    signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
    sig = private_key.sign(signing_input, padding.PKCS1v15(), hashes.SHA256())
    return f"{header_b64}.{payload_b64}.{_b64url_encode(sig)}"


# ---------------------------------------------------------------------------
# In-memory JWKS provider for tests (and easy fakes)
# ---------------------------------------------------------------------------


@dataclass
class InMemoryJwksProvider:
    """Test double for :class:`JWKSProvider`.

    ``calls`` and ``refresh_calls`` count invocations so tests can pin the
    cache-miss-then-refetch behavior. Set ``raise_on_next`` to simulate
    JWKS unreachability.
    """

    keys: dict[str, JWKKey] = field(default_factory=dict)
    calls: int = 0
    refresh_calls: int = 0
    raise_on_next: bool = False
    raise_on_refresh: bool = False

    def get_keys(self, *, force_refresh: bool = False) -> dict[str, JWKKey]:
        if force_refresh:
            self.refresh_calls += 1
            if self.raise_on_refresh:
                raise JWKSUnreachableError("jwks_unreachable")
        else:
            self.calls += 1
        if self.raise_on_next:
            raise JWKSUnreachableError("jwks_unreachable")
        return dict(self.keys)
