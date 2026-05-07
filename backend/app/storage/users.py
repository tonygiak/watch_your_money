"""Users storage layer.

Per DES-0004 §4 / BLG-0017: thin partial-update layer for the
``public.users`` table. Mirrors the design of ``app.storage.receipts``:
:class:`UserStorage` is the public Protocol used by the router, an
:class:`InMemoryUserStorage` powers contract tests, and
:class:`SupabaseUserStorage` is the production wiring.

Only two columns are mutable from the API: ``is_freelancer`` (boolean) and
``afm`` (Greek tax ID, 9 digits, MOD-11 verified — see :mod:`app.afm`).
``phone`` is owned by Supabase Auth and is never round-tripped through
this surface (DES-0004 §4 — "returns the updated `users` row minus
`phone`").

The storage NEVER logs the ``afm`` value — ΑΦΜ is identifying data
(DES-0004 §7).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Protocol


@dataclass(frozen=True)
class StoredUser:
    """User as returned to the API. ``phone`` is intentionally absent — the
    mobile client already has it from the session blob; we never re-emit
    it to avoid an unnecessary leakage path (DES-0004 §4)."""

    id: str
    afm: str | None
    email: str | None
    is_freelancer: bool
    created_at: datetime


class UserStorage(Protocol):
    """Contract every concrete user-storage implementation must satisfy."""

    def get_by_id(self, user_id: str) -> StoredUser | None:
        """Return the user row, or ``None`` if missing."""
        ...

    def patch(
        self,
        user_id: str,
        *,
        is_freelancer: bool | None,
        afm: str | None | _Unset,
    ) -> StoredUser | None:
        """Apply a partial update to ``user_id``.

        - ``is_freelancer`` — ``None`` means "don't touch"; ``True`` /
          ``False`` writes that boolean.
        - ``afm`` — ``UNSET`` means "don't touch"; any other value (string
          or ``None``) writes it. ``None`` clears the column.

        DES-0004 §4 invariant: when the post-patch row has
        ``is_freelancer=False`` we **do not** clear ``afm`` — the value is
        preserved across mode flips. Caller-supplied ``afm`` is the
        *only* thing that ever overwrites the stored ΑΦΜ.

        Idempotent: re-patching the same body is a no-op.

        Returns the updated :class:`StoredUser`, or ``None`` if the row
        does not exist (the auth.users → public.users sync trigger from
        ``0002_handle_new_user.sql`` should have already created it on
        sign-in, but tests cover the absent case).
        """
        ...


class _Unset:
    """Sentinel used as the default for partial-update fields."""

    _instance: _Unset | None = None

    def __new__(cls) -> _Unset:
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __repr__(self) -> str:  # pragma: no cover - cosmetic
        return "<UNSET>"


UNSET = _Unset()


# ---------------------------------------------------------------------------
# In-memory fake (tests, smoke checks, local dev without Supabase)
# ---------------------------------------------------------------------------


@dataclass
class InMemoryUserStorage:
    """In-process fake. Behaviour mirrors the production constraints."""

    _by_id: dict[str, StoredUser] = field(default_factory=dict)

    def seed(self, user: StoredUser) -> None:
        """Test helper — pre-populate the storage with a user row."""
        self._by_id[user.id] = user

    def get_by_id(self, user_id: str) -> StoredUser | None:
        return self._by_id.get(user_id)

    def patch(
        self,
        user_id: str,
        *,
        is_freelancer: bool | None,
        afm: str | None | _Unset,
    ) -> StoredUser | None:
        existing = self._by_id.get(user_id)
        if existing is None:
            return None

        new_is_freelancer = (
            existing.is_freelancer if is_freelancer is None else is_freelancer
        )
        new_afm = existing.afm if isinstance(afm, _Unset) else afm

        updated = StoredUser(
            id=existing.id,
            afm=new_afm,
            email=existing.email,
            is_freelancer=new_is_freelancer,
            created_at=existing.created_at,
        )
        self._by_id[user_id] = updated
        return updated


# ---------------------------------------------------------------------------
# Supabase-backed implementation (production wiring; not exercised by tests)
# ---------------------------------------------------------------------------


@dataclass
class SupabaseUserStorage:
    """Production wiring. Lazy-typed against the Supabase client."""

    client: Any  # supabase.Client at runtime; typed as Any to keep imports lazy.

    def get_by_id(self, user_id: str) -> StoredUser | None:
        resp = (
            self.client.table("users")
            .select("id,afm,email,is_freelancer,created_at")
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
        rows = list(getattr(resp, "data", None) or [])
        if not rows:
            return None
        return _row_to_user(rows[0])

    def patch(
        self,
        user_id: str,
        *,
        is_freelancer: bool | None,
        afm: str | None | _Unset,
    ) -> StoredUser | None:
        patch_body: dict[str, Any] = {}
        if is_freelancer is not None:
            patch_body["is_freelancer"] = is_freelancer
        if not isinstance(afm, _Unset):
            patch_body["afm"] = afm

        if not patch_body:
            # No-op patch — just return the current row.
            return self.get_by_id(user_id)

        resp = (
            self.client.table("users")
            .update(patch_body)
            .eq("id", user_id)
            .execute()
        )
        rows = list(getattr(resp, "data", None) or [])
        if not rows:
            return None
        return _row_to_user(rows[0])


def _row_to_user(row: dict[str, Any]) -> StoredUser:
    return StoredUser(
        id=str(row["id"]),
        afm=row.get("afm"),
        email=row.get("email"),
        is_freelancer=bool(row.get("is_freelancer", False)),
        created_at=_parse_timestamp(row.get("created_at")),
    )


def _parse_timestamp(value: Any) -> datetime:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            pass
    from datetime import UTC

    return datetime.now(tz=UTC)
