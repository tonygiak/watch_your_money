"""JWT verifier tests for the asymmetric + transitional posture (ADR-0015).

Coverage target ≥ 95 % on ``app/auth.py`` per ADR-0015 §7. Exercises the
full algorithm allowlist (ES256 / RS256 / HS256-transitional) + the
negative cases that pin the classic JWT vulnerability surface (``alg=none``,
unknown ``alg``, ``kid`` miss, JWKS unreachable, algorithm / key-type
mismatch).

No network. Every JWKS interaction goes through
:class:`InMemoryJwksProvider` (or :class:`CachedJwksProvider` with an
injected fake fetcher) per ADR-0015 Round-1 engineering-manager #1.
"""

from __future__ import annotations

import time
from typing import Any

import pytest
from cryptography.hazmat.primitives.asymmetric import ec, rsa

from app.auth import (
    CachedJwksProvider,
    InMemoryJwksProvider,
    JWKKey,
    JWKSUnreachableError,
    JwtClaimError,
    JwtError,
    JwtExpiredError,
    JwtMalformedError,
    JwtSignatureError,
    _b64url_encode,
    extract_header_metadata,
    make_es256_jwt_for_test,
    make_rs256_jwt_for_test,
    make_supabase_jwt_for_test,
    verify_supabase_jwt,
)

SECRET = "super-secret-test-only"
KID_EC = "ec-kid-1234567890"
KID_RSA = "rsa-kid-abcdefgh"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module")
def ec_keypair() -> tuple[ec.EllipticCurvePrivateKey, JWKKey]:
    private = ec.generate_private_key(ec.SECP256R1())
    public = private.public_key()
    jwk = JWKKey(kid=KID_EC, kty="EC", alg="ES256", public_key=public)
    return private, jwk


@pytest.fixture(scope="module")
def rsa_keypair() -> tuple[rsa.RSAPrivateKey, JWKKey]:
    private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public = private.public_key()
    jwk = JWKKey(kid=KID_RSA, kty="RSA", alg="RS256", public_key=public)
    return private, jwk


@pytest.fixture
def jwks(
    ec_keypair: tuple[ec.EllipticCurvePrivateKey, JWKKey],
    rsa_keypair: tuple[rsa.RSAPrivateKey, JWKKey],
) -> InMemoryJwksProvider:
    _, ec_jwk = ec_keypair
    _, rsa_jwk = rsa_keypair
    return InMemoryJwksProvider(keys={KID_EC: ec_jwk, KID_RSA: rsa_jwk})


# ---------------------------------------------------------------------------
# HS256 (transitional)
# ---------------------------------------------------------------------------


def test_hs256_happy_path_returns_sub() -> None:
    token = make_supabase_jwt_for_test("user-123", SECRET)
    result = verify_supabase_jwt(token, legacy_hs256_secret=SECRET)
    assert result.sub == "user-123"
    assert result.payload["aud"] == "authenticated"


def test_hs256_signature_mismatch_with_wrong_secret() -> None:
    token = make_supabase_jwt_for_test("user-123", SECRET)
    with pytest.raises(JwtSignatureError):
        verify_supabase_jwt(token, legacy_hs256_secret="different-secret")


def test_hs256_rejected_when_no_legacy_secret_configured() -> None:
    token = make_supabase_jwt_for_test("user-123", SECRET)
    with pytest.raises(JwtMalformedError, match="HS256 deprecated"):
        verify_supabase_jwt(token)


def test_hs256_with_asymmetric_kid_is_rejected(
    jwks: InMemoryJwksProvider,
) -> None:
    """ADR-0015 §4 cross-check: HS256 + a kid declared as asymmetric in JWKS
    is ambiguous (the same kid points to two key materials)."""
    token = make_supabase_jwt_for_test(
        "user-123", SECRET, header_overrides={"kid": KID_EC}
    )
    with pytest.raises(JwtMalformedError, match="asymmetric kid"):
        verify_supabase_jwt(
            token,
            jwks_provider=jwks,
            legacy_hs256_secret=SECRET,
        )


def test_hs256_with_unknown_kid_still_verifies_with_legacy_secret(
    jwks: InMemoryJwksProvider,
) -> None:
    """A kid that's NOT in the JWKS is the rollback-window posture: the
    token is HS256-signed and we have a legacy secret — verify and accept."""
    token = make_supabase_jwt_for_test(
        "user-123", SECRET, header_overrides={"kid": "totally-unknown-kid"}
    )
    result = verify_supabase_jwt(
        token, jwks_provider=jwks, legacy_hs256_secret=SECRET
    )
    assert result.sub == "user-123"


# ---------------------------------------------------------------------------
# ES256
# ---------------------------------------------------------------------------


def test_es256_happy_path(
    ec_keypair: tuple[ec.EllipticCurvePrivateKey, JWKKey],
    jwks: InMemoryJwksProvider,
) -> None:
    private, _ = ec_keypair
    token = make_es256_jwt_for_test(sub="user-abc", private_key=private, kid=KID_EC)
    result = verify_supabase_jwt(token, jwks_provider=jwks)
    assert result.sub == "user-abc"


def test_es256_bad_signature_rejected(
    ec_keypair: tuple[ec.EllipticCurvePrivateKey, JWKKey],
    jwks: InMemoryJwksProvider,
) -> None:
    private, _ = ec_keypair
    token = make_es256_jwt_for_test(sub="user-abc", private_key=private, kid=KID_EC)
    # Flip a byte in the signature — must reject.
    h, p, s = token.split(".")
    tampered = f"{h}.{p}.{_flip_one_b64url_char(s)}"
    with pytest.raises(JwtSignatureError):
        verify_supabase_jwt(tampered, jwks_provider=jwks)


def test_es256_unknown_kid_triggers_one_refresh_then_rejects(
    ec_keypair: tuple[ec.EllipticCurvePrivateKey, JWKKey],
    jwks: InMemoryJwksProvider,
) -> None:
    private, _ = ec_keypair
    token = make_es256_jwt_for_test(
        sub="user-abc", private_key=private, kid="rotated-out"
    )
    with pytest.raises(JwtMalformedError, match="unknown kid"):
        verify_supabase_jwt(token, jwks_provider=jwks)
    assert jwks.refresh_calls == 1, (
        "kid-miss must trigger exactly one refresh attempt"
    )


def test_es256_against_rsa_kid_rejected(
    ec_keypair: tuple[ec.EllipticCurvePrivateKey, JWKKey],
    jwks: InMemoryJwksProvider,
) -> None:
    """alg=ES256 with a kid whose kty=RSA → alg/key-type mismatch."""
    private, _ = ec_keypair
    # Use the RSA kid but sign with the EC key — the verifier rejects on the
    # alg/key-type cross-check before even trying ECDSA.
    token = make_es256_jwt_for_test(sub="user-abc", private_key=private, kid=KID_RSA)
    with pytest.raises(JwtMalformedError, match="alg/key-type mismatch"):
        verify_supabase_jwt(token, jwks_provider=jwks)


def test_es256_missing_kid_rejected(
    ec_keypair: tuple[ec.EllipticCurvePrivateKey, JWKKey],
    jwks: InMemoryJwksProvider,
) -> None:
    private, _ = ec_keypair
    token = make_es256_jwt_for_test(
        sub="user-abc",
        private_key=private,
        kid=KID_EC,
        header_overrides={"kid": None},
    )
    with pytest.raises(JwtMalformedError, match="missing kid"):
        verify_supabase_jwt(token, jwks_provider=jwks)


def test_es256_without_jwks_provider_rejected(
    ec_keypair: tuple[ec.EllipticCurvePrivateKey, JWKKey],
) -> None:
    private, _ = ec_keypair
    token = make_es256_jwt_for_test(sub="user-abc", private_key=private, kid=KID_EC)
    with pytest.raises(JwtMalformedError, match="asymmetric verification not configured"):
        verify_supabase_jwt(token)


# ---------------------------------------------------------------------------
# RS256
# ---------------------------------------------------------------------------


def test_rs256_happy_path(
    rsa_keypair: tuple[rsa.RSAPrivateKey, JWKKey],
    jwks: InMemoryJwksProvider,
) -> None:
    private, _ = rsa_keypair
    token = make_rs256_jwt_for_test(sub="user-rsa", private_key=private, kid=KID_RSA)
    result = verify_supabase_jwt(token, jwks_provider=jwks)
    assert result.sub == "user-rsa"


def test_rs256_bad_signature_rejected(
    rsa_keypair: tuple[rsa.RSAPrivateKey, JWKKey],
    jwks: InMemoryJwksProvider,
) -> None:
    private, _ = rsa_keypair
    token = make_rs256_jwt_for_test(sub="user-rsa", private_key=private, kid=KID_RSA)
    h, p, s = token.split(".")
    tampered = f"{h}.{p}.{_flip_one_b64url_char(s)}"
    with pytest.raises(JwtSignatureError):
        verify_supabase_jwt(tampered, jwks_provider=jwks)


def test_rs256_against_ec_kid_rejected(
    rsa_keypair: tuple[rsa.RSAPrivateKey, JWKKey],
    jwks: InMemoryJwksProvider,
) -> None:
    private, _ = rsa_keypair
    token = make_rs256_jwt_for_test(sub="user-rsa", private_key=private, kid=KID_EC)
    with pytest.raises(JwtMalformedError, match="alg/key-type mismatch"):
        verify_supabase_jwt(token, jwks_provider=jwks)


# ---------------------------------------------------------------------------
# Algorithm allowlist — the classic JWT vulnerability surface
# ---------------------------------------------------------------------------


def test_alg_none_refused(jwks: InMemoryJwksProvider) -> None:
    """The classic JWT vulnerability: ``alg=none`` MUST be rejected even
    when the signature is empty."""
    import json

    header = _b64url_encode(json.dumps({"alg": "none", "typ": "JWT"}).encode())
    payload = _b64url_encode(
        json.dumps({"sub": "x", "aud": "authenticated", "exp": int(time.time()) + 3600}).encode()
    )
    token = f"{header}.{payload}."
    with pytest.raises(JwtMalformedError, match="alg=none refused"):
        verify_supabase_jwt(token, jwks_provider=jwks)


def test_unknown_alg_rejected(jwks: InMemoryJwksProvider) -> None:
    import json

    header = _b64url_encode(json.dumps({"alg": "PS256", "typ": "JWT"}).encode())
    payload = _b64url_encode(
        json.dumps({"sub": "x", "aud": "authenticated", "exp": int(time.time()) + 3600}).encode()
    )
    token = f"{header}.{payload}.AAAA"
    with pytest.raises(JwtMalformedError, match="unsupported alg"):
        verify_supabase_jwt(token, jwks_provider=jwks)


def test_malformed_token_shape_rejected() -> None:
    with pytest.raises(JwtMalformedError, match="three dot"):
        verify_supabase_jwt("not.a.valid.jwt", legacy_hs256_secret=SECRET)
    with pytest.raises(JwtMalformedError, match="three dot"):
        verify_supabase_jwt("only-one-part", legacy_hs256_secret=SECRET)


def test_missing_token_rejected() -> None:
    with pytest.raises(JwtMalformedError, match="missing token"):
        verify_supabase_jwt("", legacy_hs256_secret=SECRET)


def test_unsupported_typ_rejected() -> None:
    token = make_supabase_jwt_for_test(
        "user-123", SECRET, header_overrides={"typ": "JWE"}
    )
    with pytest.raises(JwtMalformedError, match="unsupported typ"):
        verify_supabase_jwt(token, legacy_hs256_secret=SECRET)


# ---------------------------------------------------------------------------
# Claims
# ---------------------------------------------------------------------------


def test_expired_token_rejected() -> None:
    token = make_supabase_jwt_for_test("user-123", SECRET, expires_in=-1)
    with pytest.raises(JwtExpiredError):
        verify_supabase_jwt(
            token, legacy_hs256_secret=SECRET, now=time.time() + 120
        )


def test_wrong_audience_rejected() -> None:
    token = make_supabase_jwt_for_test("user-123", SECRET, audience="anon")
    with pytest.raises(JwtClaimError):
        verify_supabase_jwt(
            token, legacy_hs256_secret=SECRET, expected_audience="authenticated"
        )


def test_audience_list_accepts_match() -> None:
    token = make_supabase_jwt_for_test(
        "user-123", SECRET, extra_claims={"aud": ["authenticated", "user"]}
    )
    result = verify_supabase_jwt(
        token, legacy_hs256_secret=SECRET, expected_audience="authenticated"
    )
    assert result.sub == "user-123"


def test_audience_list_rejects_mismatch() -> None:
    token = make_supabase_jwt_for_test(
        "user-123", SECRET, extra_claims={"aud": ["service", "internal"]}
    )
    with pytest.raises(JwtClaimError):
        verify_supabase_jwt(
            token, legacy_hs256_secret=SECRET, expected_audience="authenticated"
        )


def test_missing_sub_rejected() -> None:
    token = make_supabase_jwt_for_test("", SECRET)
    with pytest.raises(JwtClaimError):
        verify_supabase_jwt(token, legacy_hs256_secret=SECRET)


def test_missing_exp_claim_rejected() -> None:
    token = make_supabase_jwt_for_test(
        "user-123", SECRET, extra_claims={"exp": None}
    )
    with pytest.raises(JwtMalformedError, match="missing exp"):
        verify_supabase_jwt(token, legacy_hs256_secret=SECRET)


def test_iat_in_future_rejected() -> None:
    token = make_supabase_jwt_for_test(
        "user-123", SECRET, extra_claims={"iat": int(time.time()) + 600}
    )
    with pytest.raises(JwtClaimError, match="iat"):
        verify_supabase_jwt(token, legacy_hs256_secret=SECRET)


# ---------------------------------------------------------------------------
# JWKS cache (CachedJwksProvider)
# ---------------------------------------------------------------------------


class _FakeFetcher:
    """Test double for :class:`JwksFetcher`."""

    def __init__(self, document: dict[str, Any] | None, fail_next: bool = False) -> None:
        self.document = document
        self.fail_next = fail_next
        self.calls = 0

    def fetch(self, url: str) -> dict[str, Any]:
        self.calls += 1
        if self.fail_next:
            raise JWKSUnreachableError("simulated network failure")
        assert self.document is not None
        return self.document


def _ec_jwks_document(jwk: JWKKey) -> dict[str, Any]:
    """Render a JWKS document for an EC key (for the fetcher)."""
    pn = jwk.public_key.public_numbers()
    x = pn.x.to_bytes(32, "big")
    y = pn.y.to_bytes(32, "big")
    return {
        "keys": [
            {
                "kid": jwk.kid,
                "kty": "EC",
                "crv": "P-256",
                "alg": "ES256",
                "x": _b64url_encode(x),
                "y": _b64url_encode(y),
            }
        ]
    }


def test_cached_jwks_caches_until_ttl_expires(
    ec_keypair: tuple[ec.EllipticCurvePrivateKey, JWKKey],
) -> None:
    _, jwk = ec_keypair
    doc = _ec_jwks_document(jwk)
    fetcher = _FakeFetcher(doc)
    fake_time = [1000.0]

    cache = CachedJwksProvider(
        jwks_url="https://example.test/jwks",
        ttl_seconds=600,
        fetcher=fetcher,
        time_source=lambda: fake_time[0],
    )

    cache.get_keys()
    cache.get_keys()
    cache.get_keys()
    assert fetcher.calls == 1, "subsequent reads within TTL must NOT refetch"

    fake_time[0] += 1000.0  # past TTL
    cache.get_keys()
    assert fetcher.calls == 2, "expired TTL must refetch"


def test_cached_jwks_rate_limits_refetch_after_kid_miss(
    ec_keypair: tuple[ec.EllipticCurvePrivateKey, JWKKey],
) -> None:
    """ADR-0015 §3: forced refetches are rate-limited to 1 per 60 s, even
    across distinct token requests (engineering-manager Round 2)."""
    _, jwk = ec_keypair
    doc = _ec_jwks_document(jwk)
    fetcher = _FakeFetcher(doc)
    fake_time = [1000.0]

    cache = CachedJwksProvider(
        jwks_url="https://example.test/jwks",
        ttl_seconds=600,
        fetcher=fetcher,
        time_source=lambda: fake_time[0],
    )
    cache.get_keys()  # warm — counts=1, last_attempt=1000
    assert fetcher.calls == 1
    # A force_refresh inside the 60s floor must serve the stale keys
    # without bumping the fetcher (DoS resistance).
    cache.get_keys(force_refresh=True)
    assert fetcher.calls == 1, (
        "force_refresh inside the rate-limit window must NOT refetch"
    )
    fake_time[0] += 5
    cache.get_keys(force_refresh=True)
    assert fetcher.calls == 1, "still inside the 60s floor"
    fake_time[0] += 120  # past the 60s floor
    cache.get_keys(force_refresh=True)
    assert fetcher.calls == 2, "past the 60s floor — refetch happens"


def test_cached_jwks_unreachable_on_first_call_hard_fails(
    ec_keypair: tuple[ec.EllipticCurvePrivateKey, JWKKey],
) -> None:
    fetcher = _FakeFetcher(None, fail_next=True)
    cache = CachedJwksProvider(
        jwks_url="https://example.test/jwks",
        ttl_seconds=600,
        fetcher=fetcher,
    )
    with pytest.raises(JWKSUnreachableError):
        cache.get_keys()


def test_cached_jwks_unreachable_with_stale_cache_serves_stale(
    ec_keypair: tuple[ec.EllipticCurvePrivateKey, JWKKey],
) -> None:
    """If a forced refetch fails but we have keys cached already, serve
    the stale keys — better than rejecting every request."""
    _, jwk = ec_keypair
    doc = _ec_jwks_document(jwk)
    fetcher = _FakeFetcher(doc)
    fake_time = [1000.0]
    cache = CachedJwksProvider(
        jwks_url="https://example.test/jwks",
        ttl_seconds=600,
        fetcher=fetcher,
        time_source=lambda: fake_time[0],
    )
    cache.get_keys()  # warm
    fake_time[0] += 700  # past TTL
    fetcher.fail_next = True
    # The refetch fails — but we have stale keys; serve them rather than fail.
    keys = cache.get_keys()
    assert jwk.kid in keys


def test_jwks_unreachable_during_verify_maps_to_jwt_malformed(
    ec_keypair: tuple[ec.EllipticCurvePrivateKey, JWKKey],
) -> None:
    """End-to-end: a verifier given a JWKSProvider that hard-fails must
    return a JwtMalformedError so the route maps it to 401."""
    private, _ = ec_keypair
    token = make_es256_jwt_for_test(sub="user-abc", private_key=private, kid=KID_EC)
    failing = InMemoryJwksProvider(keys={}, raise_on_next=True)
    with pytest.raises(JwtMalformedError, match="jwks_unreachable"):
        verify_supabase_jwt(token, jwks_provider=failing)


def test_jwks_malformed_document_rejected() -> None:
    fetcher = _FakeFetcher({"not": "a jwks document"})
    cache = CachedJwksProvider(
        jwks_url="https://example.test/jwks",
        ttl_seconds=600,
        fetcher=fetcher,
    )
    with pytest.raises(JWKSUnreachableError):
        cache.get_keys()


def test_jwks_empty_keys_list_rejected() -> None:
    fetcher = _FakeFetcher({"keys": []})
    cache = CachedJwksProvider(
        jwks_url="https://example.test/jwks",
        ttl_seconds=600,
        fetcher=fetcher,
    )
    with pytest.raises(JWKSUnreachableError):
        cache.get_keys()


def test_jwks_skips_unsupported_key_entries(
    ec_keypair: tuple[ec.EllipticCurvePrivateKey, JWKKey],
) -> None:
    """A real JWKS may grow new key types over time. Unknown entries should
    be skipped (forward compatibility) without poisoning the whole document."""
    _, jwk = ec_keypair
    doc = _ec_jwks_document(jwk)
    doc["keys"].append({"kid": "octet-x", "kty": "oct"})
    doc["keys"].append({"not": "a key"})
    fetcher = _FakeFetcher(doc)
    cache = CachedJwksProvider(
        jwks_url="https://example.test/jwks",
        ttl_seconds=600,
        fetcher=fetcher,
    )
    keys = cache.get_keys()
    assert KID_EC in keys
    assert "octet-x" not in keys


# ---------------------------------------------------------------------------
# extract_header_metadata — used by ADR-0016 / BLG-0025 log line
# ---------------------------------------------------------------------------


def test_extract_header_metadata_truncates_long_kid() -> None:
    token = make_supabase_jwt_for_test(
        "u", SECRET, header_overrides={"kid": "abcdef1234567890"}
    )
    md = extract_header_metadata(token)
    assert md.kid == "abcdef…"


def test_extract_header_metadata_keeps_short_kid_intact() -> None:
    token = make_supabase_jwt_for_test(
        "u", SECRET, header_overrides={"kid": "ab12"}
    )
    md = extract_header_metadata(token)
    assert md.kid == "ab12"


def test_extract_header_metadata_handles_malformed_token() -> None:
    md = extract_header_metadata("not.a.valid.jwt")  # four segments
    assert (md.alg, md.typ, md.kid) == (None, None, None)
    md = extract_header_metadata("not-three-segments")
    assert (md.alg, md.typ, md.kid) == (None, None, None)
    md = extract_header_metadata("")
    assert (md.alg, md.typ, md.kid) == (None, None, None)
    md = extract_header_metadata(None)
    assert (md.alg, md.typ, md.kid) == (None, None, None)


def test_extract_header_metadata_handles_non_json_header() -> None:
    """A token whose header decodes to bytes that aren't valid JSON still
    returns cleanly so the auth log line never crashes."""
    junk_header = _b64url_encode(b"not json bytes")
    token = f"{junk_header}.{_b64url_encode(b'{}')}.AAAA"
    md = extract_header_metadata(token)
    assert (md.alg, md.typ, md.kid) == (None, None, None)


# ---------------------------------------------------------------------------
# JwtError taxonomy preservation (ADR-0015 §6 / ADR-0002 §4)
# ---------------------------------------------------------------------------


def test_error_codes_preserved_for_route_mapping() -> None:
    assert JwtMalformedError.code == "jwt_malformed"
    assert JwtExpiredError.code == "jwt_expired"
    assert JwtSignatureError.code == "jwt_signature"
    assert JwtClaimError.code == "jwt_claim"
    assert issubclass(JwtMalformedError, JwtError)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _flip_one_b64url_char(s: str) -> str:
    """Replace the first base64url char with a different one — guaranteed to
    change the decoded bytes for a tamper test."""
    if not s:
        return s
    first = s[0]
    swap = "B" if first != "B" else "C"
    return swap + s[1:]
