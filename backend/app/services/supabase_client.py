"""Supabase client factory.

Constructed lazily so tests don't need real credentials. Production code reads
``SUPABASE_URL`` and ``SUPABASE_SERVICE_KEY`` from the environment via
:mod:`app.config`. The mobile client never receives the service key
(:doc:`rls-required`).
"""

from __future__ import annotations

from functools import lru_cache
from typing import TYPE_CHECKING

from app.config import settings

if TYPE_CHECKING:
    from supabase import Client


@lru_cache(maxsize=1)
def get_client() -> Client:
    if not settings.supabase_url or not settings.supabase_service_key:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_SERVICE_KEY must be set to use Supabase."
        )
    from supabase import create_client

    return create_client(settings.supabase_url, settings.supabase_service_key)
