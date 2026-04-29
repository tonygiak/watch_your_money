"""Runtime configuration. Secrets only via environment variables."""

from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    """Read once at import time. Never log values.

    ADR-0002 §1 / §5 requires both ``SUPABASE_JWT_SECRET`` (for in-process
    JWT verification) and ``SUPABASE_SERVICE_KEY`` (for writes after
    verification). The mobile client uses the anon key directly and never
    sees either of these.
    """

    supabase_url: str
    supabase_service_key: str
    supabase_jwt_secret: str
    einvoicing_base_url: str

    @classmethod
    def from_env(cls) -> Settings:
        return cls(
            supabase_url=os.getenv("SUPABASE_URL", ""),
            supabase_service_key=os.getenv("SUPABASE_SERVICE_KEY", ""),
            supabase_jwt_secret=os.getenv("SUPABASE_JWT_SECRET", ""),
            einvoicing_base_url=os.getenv(
                "EINVOICING_BASE_URL", "https://e-invoicing.gr"
            ),
        )


settings = Settings.from_env()
