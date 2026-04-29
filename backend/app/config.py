"""Runtime configuration. Secrets only via environment variables."""

from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    """Read once at import time. Never log values."""

    supabase_url: str
    supabase_service_key: str
    einvoicing_base_url: str

    @classmethod
    def from_env(cls) -> Settings:
        return cls(
            supabase_url=os.getenv("SUPABASE_URL", ""),
            supabase_service_key=os.getenv("SUPABASE_SERVICE_KEY", ""),
            einvoicing_base_url=os.getenv(
                "EINVOICING_BASE_URL", "https://e-invoicing.gr"
            ),
        )


settings = Settings.from_env()
