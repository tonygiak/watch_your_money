"""Runtime configuration. Secrets only via environment variables."""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

# Load `backend/.env` if present. `override=False` means real environment
# variables (e.g. those set by Railway / Render in production) always win
# over the file. Per `agent-runtime-security.md`, secrets only live in env.
_BACKEND_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(_BACKEND_ROOT / ".env", override=False)

log = logging.getLogger(__name__)


_DEFAULT_JWKS_CACHE_TTL_SECONDS = 600
"""Cache TTL for the Supabase JWKS document (ADR-0015 §3 Round-2)."""


@dataclass(frozen=True)
class Settings:
    """Read once at import time. Never log values.

    Auth posture per ADR-0015 (supersedes ADR-0002 §1): asymmetric JWT
    verification (ES256 / RS256) against the Supabase JWKS endpoint, with
    HS256 retained as a transitional path for the rollback window.
    """

    supabase_url: str
    supabase_service_key: str
    supabase_jwks_url: str
    supabase_jwks_cache_ttl_seconds: int
    supabase_jwt_legacy_hs256_secret: str
    einvoicing_base_url: str

    @classmethod
    def from_env(cls) -> Settings:
        supabase_url = os.getenv("SUPABASE_URL", "")
        supabase_service_key = os.getenv("SUPABASE_SERVICE_KEY", "")

        jwks_url = os.getenv("SUPABASE_JWKS_URL", "").strip()
        if not jwks_url and supabase_url:
            jwks_url = f"{supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"

        ttl_raw = os.getenv("SUPABASE_JWKS_CACHE_TTL_SECONDS", "").strip()
        try:
            ttl = int(ttl_raw) if ttl_raw else _DEFAULT_JWKS_CACHE_TTL_SECONDS
        except ValueError:
            ttl = _DEFAULT_JWKS_CACHE_TTL_SECONDS

        legacy_secret = _resolve_legacy_hs256_secret()

        return cls(
            supabase_url=supabase_url,
            supabase_service_key=supabase_service_key,
            supabase_jwks_url=jwks_url,
            supabase_jwks_cache_ttl_seconds=ttl,
            supabase_jwt_legacy_hs256_secret=legacy_secret,
            einvoicing_base_url=os.getenv(
                "EINVOICING_BASE_URL", "https://e-invoicing.gr"
            ),
        )


def _resolve_legacy_hs256_secret() -> str:
    """Pick the legacy HS256 secret with the ADR-0015 §5 transition contract.

    The new variable is ``SUPABASE_JWT_LEGACY_HS256_SECRET``. The deprecated
    ``SUPABASE_JWT_SECRET`` alias is honored for one release cycle:

    - If only the new var is set, use it.
    - If only the old alias is set, use it and log a deprecation warning.
    - If both are set to the **same** value, that is allowed (transition
      convenience) and we use it.
    - If both are set to **different** values, fail-loud per ADR-0015 §5.
    - If neither is set, return ``""`` and the verifier rejects HS256 tokens.
    """
    new_value = os.getenv("SUPABASE_JWT_LEGACY_HS256_SECRET", "").strip()
    alias_value = os.getenv("SUPABASE_JWT_SECRET", "").strip()

    if new_value and alias_value:
        if new_value != alias_value:
            raise RuntimeError(
                "Config conflict: SUPABASE_JWT_SECRET and "
                "SUPABASE_JWT_LEGACY_HS256_SECRET are set to different "
                "values. Set only the new variable, or set both to the "
                "same value during the transition window."
            )
        return new_value

    if new_value:
        return new_value

    if alias_value:
        log.warning(
            "SUPABASE_JWT_SECRET is deprecated; rename to "
            "SUPABASE_JWT_LEGACY_HS256_SECRET (ADR-0015 §5)."
        )
        return alias_value

    return ""


settings = Settings.from_env()
