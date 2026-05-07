"""Receipts storage layer.

ADR-0002 §5: backend uses the Supabase service-key client to write **after**
JWT verification. Idempotency is enforced by the
``receipts_mark_per_user_unique unique (user_id, mark)`` constraint from
``db/migrations/0001_init.sql``. On conflict, the existing row is returned
untouched (user-set fields like ``is_business_expense``, ``business_category``,
``notes``, ``raw_html`` are NEVER overwritten).

The :class:`ReceiptStorage` Protocol is the public contract used by the
router. Production wires :class:`SupabaseReceiptStorage`. Tests inject a
fake.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Protocol
from uuid import UUID, uuid4

from app.parsers.base import ParsedReceipt


@dataclass(frozen=True)
class StoredReceipt:
    """Receipt as it appears in the DB after insert / select."""

    id: UUID
    created_at: datetime
    parsed: ParsedReceipt
    is_business_expense: bool = False
    business_category: str | None = None
    notes: str | None = None


@dataclass(frozen=True)
class StoreResult:
    """Result of :meth:`ReceiptStorage.upsert_receipt`."""

    receipt: StoredReceipt
    is_duplicate: bool


class ReceiptStorage(Protocol):
    """Contract every concrete storage implementation must satisfy."""

    def upsert_receipt(self, user_id: str, parsed: ParsedReceipt) -> StoreResult:
        """Insert a new receipt, or return the existing one on `(user_id, mark)`.

        The returned :class:`StoreResult.is_duplicate` is ``True`` iff a row
        with the same ``(user_id, mark)`` already existed; in that case the
        returned :class:`StoredReceipt` is the EXISTING row, untouched.
        """
        ...

    def find_by_id(
        self, user_id: str, receipt_id: UUID
    ) -> StoredReceipt | None:
        """Return the receipt iff it exists AND is owned by ``user_id``.

        Defense-in-depth `WHERE user_id = sub AND id = receipt_id` on top of
        Supabase RLS. Returning ``None`` for a receipt that exists but
        belongs to another user prevents enumeration of other users' UUIDs
        (ADR-0008 §3).
        """
        ...

    def tag_receipt(
        self,
        user_id: str,
        receipt_id: UUID,
        *,
        is_business: bool,
        category: str | None,
        notes: str | None,
    ) -> StoredReceipt | None:
        """Apply (or remove) the business-expense tag on ``receipt_id``.

        Per ADR-0008 §2:

        - When ``is_business=True`` → write ``business_category`` (already
          trimmed + lowercased by the caller) and ``notes`` (already trimmed
          by the caller).
        - When ``is_business=False`` → set ``is_business_expense=False``,
          and clear ``business_category`` + ``notes`` to ``NULL``.
        - Idempotent: re-calling with the same args is a no-op (the returned
          row reflects the post-write state either way).

        Returns the updated :class:`StoredReceipt`, or ``None`` if the row
        does not exist or is not owned by ``user_id`` (404 path — no
        enumeration). The defense-in-depth `WHERE user_id = sub AND id =
        receipt_id` filter is enforced inside the implementation.
        """
        ...


# ---------------------------------------------------------------------------
# In-memory fake (tests, smoke checks, local dev without Supabase)
# ---------------------------------------------------------------------------


@dataclass
class InMemoryReceiptStorage:
    """Storage backed by an in-process dict.

    Used by contract tests to verify the full router behaviour without ever
    touching Supabase. The behaviour mirrors the production constraint:
    ``(user_id, mark)`` is unique per user, and idempotent re-scans never
    overwrite user-set fields.
    """

    _by_id: dict[UUID, StoredReceipt] = field(default_factory=dict)
    _by_user_mark: dict[tuple[str, str], UUID] = field(default_factory=dict)

    _owner: dict[UUID, str] = field(default_factory=dict)

    def upsert_receipt(self, user_id: str, parsed: ParsedReceipt) -> StoreResult:
        mark = parsed.mark
        if mark:
            existing_id = self._by_user_mark.get((user_id, mark))
            if existing_id is not None:
                return StoreResult(
                    receipt=self._by_id[existing_id],
                    is_duplicate=True,
                )

        new_id = uuid4()
        stored = StoredReceipt(
            id=new_id,
            created_at=datetime.now(tz=_utc()),
            parsed=parsed,
        )
        self._by_id[new_id] = stored
        self._owner[new_id] = user_id
        if mark:
            self._by_user_mark[(user_id, mark)] = new_id
        return StoreResult(receipt=stored, is_duplicate=False)

    def find_by_id(
        self, user_id: str, receipt_id: UUID
    ) -> StoredReceipt | None:
        if self._owner.get(receipt_id) != user_id:
            return None
        return self._by_id.get(receipt_id)

    def tag_receipt(
        self,
        user_id: str,
        receipt_id: UUID,
        *,
        is_business: bool,
        category: str | None,
        notes: str | None,
    ) -> StoredReceipt | None:
        if self._owner.get(receipt_id) != user_id:
            return None
        existing = self._by_id.get(receipt_id)
        if existing is None:
            return None

        if is_business:
            new_state = StoredReceipt(
                id=existing.id,
                created_at=existing.created_at,
                parsed=existing.parsed,
                is_business_expense=True,
                business_category=category,
                notes=notes if notes else None,
            )
        else:
            new_state = StoredReceipt(
                id=existing.id,
                created_at=existing.created_at,
                parsed=existing.parsed,
                is_business_expense=False,
                business_category=None,
                notes=None,
            )
        self._by_id[receipt_id] = new_state
        return new_state


# ---------------------------------------------------------------------------
# Supabase-backed implementation (production wiring; not exercised by tests)
# ---------------------------------------------------------------------------


@dataclass
class SupabaseReceiptStorage:
    """Production storage backed by the Supabase service-key client.

    Kept thin: the router is the single source of truth for behaviour; this
    class only translates Pydantic models to / from Supabase rows. The unit
    tests exercise :class:`InMemoryReceiptStorage`; integration tests with
    real Supabase are out of scope for this sprint.
    """

    client: Any  # supabase.Client at runtime; typed as Any to keep imports lazy.

    def upsert_receipt(self, user_id: str, parsed: ParsedReceipt) -> StoreResult:
        # 1) Idempotency probe — check (user_id, mark) first so we don't
        #    create a wasted insert attempt on every re-scan.
        if parsed.mark:
            select_resp = (
                self.client.table("receipts")
                .select("*")
                .eq("user_id", user_id)
                .eq("mark", parsed.mark)
                .limit(1)
                .execute()
            )
            existing_rows = getattr(select_resp, "data", None) or []
            if existing_rows:
                return StoreResult(
                    receipt=_row_to_stored_receipt(existing_rows[0], parsed),
                    is_duplicate=True,
                )

        # 2) Insert the new receipt + its line items.
        receipt_row = _receipt_to_row(user_id=user_id, parsed=parsed)
        insert_resp = (
            self.client.table("receipts").insert(receipt_row).execute()
        )
        inserted = (getattr(insert_resp, "data", None) or [{}])[0]
        new_id = UUID(str(inserted.get("id")))

        if parsed.items:
            items_rows = [
                _item_to_row(receipt_id=new_id, item=item) for item in parsed.items
            ]
            self.client.table("receipt_items").insert(items_rows).execute()

        return StoreResult(
            receipt=StoredReceipt(
                id=new_id,
                created_at=_parse_timestamp(inserted.get("created_at")),
                parsed=parsed,
                is_business_expense=bool(inserted.get("is_business_expense", False)),
                business_category=inserted.get("business_category"),
                notes=inserted.get("notes"),
            ),
            is_duplicate=False,
        )

    def find_by_id(
        self, user_id: str, receipt_id: UUID
    ) -> StoredReceipt | None:
        # Defense-in-depth `WHERE user_id = sub AND id = receipt_id` on top
        # of Supabase RLS — both filters apply (ADR-0008 §3 / ADR-0002 §5).
        select_resp = (
            self.client.table("receipts")
            .select("*")
            .eq("user_id", user_id)
            .eq("id", str(receipt_id))
            .limit(1)
            .execute()
        )
        rows = getattr(select_resp, "data", None) or []
        if not rows:
            return None
        return _row_to_stored_receipt_with_items(self.client, rows[0])

    def tag_receipt(
        self,
        user_id: str,
        receipt_id: UUID,
        *,
        is_business: bool,
        category: str | None,
        notes: str | None,
    ) -> StoredReceipt | None:
        existing = self.find_by_id(user_id, receipt_id)
        if existing is None:
            return None

        if is_business:
            patch = {
                "is_business_expense": True,
                "business_category": category,
                "notes": notes if notes else None,
            }
        else:
            patch = {
                "is_business_expense": False,
                "business_category": None,
                "notes": None,
            }
        update_resp = (
            self.client.table("receipts")
            .update(patch)
            .eq("user_id", user_id)
            .eq("id", str(receipt_id))
            .execute()
        )
        rows = getattr(update_resp, "data", None) or []
        if not rows:
            return None
        return _row_to_stored_receipt_with_items(self.client, rows[0])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _utc() -> Any:
    """Lazy UTC tz so tests stay deterministic without importing tzdata."""
    from datetime import UTC

    return UTC


def _receipt_to_row(*, user_id: str, parsed: ParsedReceipt) -> dict[str, Any]:
    return {
        "user_id": user_id,
        "country_code": parsed.country_code,
        "merchant_name": parsed.merchant_name or None,
        "merchant_afm": parsed.merchant_afm or None,
        "merchant_address": parsed.merchant_address or None,
        "document_number": parsed.document_number or None,
        "mark": parsed.mark or None,
        "uid": parsed.uid or None,
        "authentication_code": parsed.authentication_code or None,
        "issue_date": parsed.issue_date.isoformat() if parsed.issue_date else None,
        "transmission_timestamp": (
            parsed.transmission_timestamp.isoformat()
            if parsed.transmission_timestamp
            else None
        ),
        "payment_method": parsed.payment_method or None,
        "subtotal": _money_to_str(parsed.subtotal),
        "discount": _money_to_str(parsed.discount),
        "surcharge": _money_to_str(parsed.surcharge),
        "total": _money_to_str(parsed.total),
        "net_value": _money_to_str(parsed.net_value),
        "vat_total": _money_to_str(parsed.vat_total),
        "provider": parsed.provider or None,
        "raw_html": parsed.raw_html or None,
    }


def _item_to_row(*, receipt_id: UUID, item: Any) -> dict[str, Any]:
    return {
        "receipt_id": str(receipt_id),
        "ean": item.ean or None,
        "description": item.description,
        "unit": item.unit or None,
        "quantity": _money_to_str(item.quantity),
        "unit_price": _money_to_str(item.unit_price),
        "pre_discount_value": _money_to_str(item.pre_discount_value),
        "discount": _money_to_str(item.discount),
        "vat_rate": _money_to_str(item.vat_rate),
        "total_value": _money_to_str(item.total_value),
    }


def _money_to_str(value: Decimal) -> str:
    """Postgres `numeric` round-trips cleanly through string form."""
    return format(value, "f")


def _row_to_stored_receipt(row: dict[str, Any], parsed: ParsedReceipt) -> StoredReceipt:
    return StoredReceipt(
        id=UUID(str(row["id"])),
        created_at=_parse_timestamp(row.get("created_at")),
        parsed=parsed,
        is_business_expense=bool(row.get("is_business_expense", False)),
        business_category=row.get("business_category"),
        notes=row.get("notes"),
    )


def _row_to_stored_receipt_with_items(
    client: Any, row: dict[str, Any]
) -> StoredReceipt:
    """Re-hydrate a :class:`StoredReceipt` from a Supabase ``receipts`` row.

    Used by ``find_by_id`` / ``tag_receipt`` where we already have a row but
    need a full :class:`ParsedReceipt` shape (so the response can include
    line items). Fetches the matching ``receipt_items`` rows in a separate
    query — kept simple; if this becomes hot, switch to a single
    ``select(*, receipt_items(*))`` join via PostgREST embedding.
    """
    from app.parsers.base import ParsedReceipt, ParsedReceiptItem

    receipt_id = UUID(str(row["id"]))
    items_resp = (
        client.table("receipt_items")
        .select("*")
        .eq("receipt_id", str(receipt_id))
        .execute()
    )
    item_rows = list(getattr(items_resp, "data", None) or [])
    parsed = ParsedReceipt(
        country_code=str(row.get("country_code") or "GR"),
        merchant_name=str(row.get("merchant_name") or ""),
        merchant_afm=str(row.get("merchant_afm") or ""),
        merchant_address=str(row.get("merchant_address") or ""),
        document_number=str(row.get("document_number") or ""),
        mark=str(row.get("mark") or ""),
        uid=str(row.get("uid") or ""),
        authentication_code=str(row.get("authentication_code") or ""),
        issue_date=_parse_date(row.get("issue_date")),
        transmission_timestamp=_parse_optional_timestamp(
            row.get("transmission_timestamp")
        ),
        payment_method=str(row.get("payment_method") or ""),
        subtotal=Decimal(str(row.get("subtotal") or "0")),
        discount=Decimal(str(row.get("discount") or "0")),
        surcharge=Decimal(str(row.get("surcharge") or "0")),
        total=Decimal(str(row.get("total") or "0")),
        net_value=Decimal(str(row.get("net_value") or "0")),
        vat_total=Decimal(str(row.get("vat_total") or "0")),
        provider=str(row.get("provider") or ""),
        items=[
            ParsedReceiptItem(
                ean=str(it.get("ean") or ""),
                description=str(it.get("description") or ""),
                unit=str(it.get("unit") or ""),
                quantity=Decimal(str(it.get("quantity") or "0")),
                unit_price=Decimal(str(it.get("unit_price") or "0")),
                pre_discount_value=Decimal(str(it.get("pre_discount_value") or "0")),
                discount=Decimal(str(it.get("discount") or "0")),
                vat_rate=Decimal(str(it.get("vat_rate") or "0")),
                total_value=Decimal(str(it.get("total_value") or "0")),
            )
            for it in item_rows
        ],
    )
    return StoredReceipt(
        id=receipt_id,
        created_at=_parse_timestamp(row.get("created_at")),
        parsed=parsed,
        is_business_expense=bool(row.get("is_business_expense", False)),
        business_category=row.get("business_category"),
        notes=row.get("notes"),
    )


def _parse_date(value: Any) -> date | None:
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return date.fromisoformat(value)
        except ValueError:
            return None
    return None


def _parse_optional_timestamp(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    return None


def _parse_timestamp(value: Any) -> datetime:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        # Supabase returns ISO-8601 timestamps with timezone.
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            pass
    return datetime.now(tz=_utc())
