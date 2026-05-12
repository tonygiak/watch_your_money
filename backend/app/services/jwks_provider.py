"""Production JWKS provider factory (ADR-0015 §3).

The verifier in ``app.auth`` depends only on the :class:`JWKSProvider`
Protocol. This module is the place where the production HTTP-backed
provider is constructed once and reused across requests, so the JWKS cache
amortizes correctly.

Tests never call this module — they inject :class:`InMemoryJwksProvider`
via FastAPI dependency overrides.
"""

from __future__ import annotations

from app.auth import CachedJwksProvider, JWKSProvider
from app.config import settings

_provider: JWKSProvider | None = None


def get_jwks_provider() -> JWKSProvider | None:
    """Return the process-wide cached JWKS provider.

    Returns ``None`` when no JWKS URL is configured (e.g. during the Option
    A rollback window where the Supabase project is on Legacy HS256 only —
    every asymmetric token will then be rejected by the verifier per
    ADR-0015 §4 algorithm allowlist).
    """
    global _provider
    if _provider is not None:
        return _provider
    if not settings.supabase_jwks_url:
        return None
    _provider = CachedJwksProvider(
        jwks_url=settings.supabase_jwks_url,
        ttl_seconds=settings.supabase_jwks_cache_ttl_seconds,
    )
    return _provider


def reset_jwks_provider_for_testing() -> None:
    """Reset the module-level singleton (test utility)."""
    global _provider
    _provider = None
