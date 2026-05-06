"""Insights repository — interface, in-memory fake, Supabase RPC client.

Mirrors the storage pattern from :mod:`app.storage.receipts`. The route
layer never touches Supabase directly: it constructs the period boundaries
(via :mod:`app.insights.period`), then asks the repository for the two
shapes documented in ADR-0005 §4. The in-memory fake re-implements the
same aggregation in pure Python so contract tests can exercise the route
end-to-end without a database.

Decimals are returned as :class:`decimal.Decimal`; the route layer converts
them to ``"42.00"`` strings before writing the JSON response (ADR-0005 §5).
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from typing import Any, Protocol

UNTAGGED = "untagged"
"""Literal bucket for receipts without a ``business_category`` (ADR-0005 §6).
The mobile client renders this as ``Χωρίς κατηγορία`` / ``Untagged``."""


# ---------------------------------------------------------------------------
# Result types — exactly the shapes the route returns
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class WindowAgg:
    """Totals for a single ``[from_date, to_date]`` window."""

    from_date: date
    to_date: date
    total: Decimal
    vat_total: Decimal
    receipt_count: int


@dataclass(frozen=True)
class CategoryAgg:
    category: str
    total: Decimal
    receipt_count: int


@dataclass(frozen=True)
class MerchantAgg:
    merchant_name: str
    total: Decimal
    receipt_count: int


@dataclass(frozen=True)
class SummaryResult:
    """Composite shape returned by ``GET /insights/summary``."""

    current: WindowAgg
    previous: WindowAgg
    by_category: list[CategoryAgg]
    by_merchant: list[MerchantAgg]


@dataclass(frozen=True)
class TopProduct:
    ean: str
    description: str
    frequency: int
    total_spend: Decimal
    average_unit_price: Decimal


@dataclass(frozen=True)
class TopProductsResult:
    from_date: date
    to_date: date
    products: list[TopProduct]


# ---------------------------------------------------------------------------
# Interface (Protocol — same shape as :class:`ReceiptStorage`)
# ---------------------------------------------------------------------------


class InsightsRepository(Protocol):
    """Contract every concrete insights repository must satisfy."""

    def summary_for_user(
        self,
        user_id: str,
        *,
        from_date: date,
        to_date: date,
        prev_from_date: date,
        prev_to_date: date,
    ) -> SummaryResult: ...

    def top_products_for_user(
        self,
        user_id: str,
        *,
        from_date: date,
        to_date: date,
        limit: int,
    ) -> TopProductsResult: ...


# ---------------------------------------------------------------------------
# In-memory fake — production-faithful semantics, no Supabase
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class InMemoryReceiptRow:
    """One synthetic receipt for the in-memory aggregator. Mirrors the
    production schema columns the RPC functions read."""

    user_id: str
    issue_date: date
    total: Decimal
    vat_total: Decimal
    merchant_name: str
    business_category: str | None


@dataclass(frozen=True)
class InMemoryItemRow:
    """One synthetic receipt-item row. Same column names as the SQL RPC."""

    user_id: str
    issue_date: date
    ean: str
    description: str
    quantity: Decimal
    unit_price: Decimal
    total_value: Decimal


@dataclass
class InMemoryInsightsRepository:
    """Backed by two in-process lists. Used by contract tests + local dev."""

    receipts: list[InMemoryReceiptRow] = field(default_factory=list)
    items: list[InMemoryItemRow] = field(default_factory=list)

    # ---- API ------------------------------------------------------------
    def summary_for_user(
        self,
        user_id: str,
        *,
        from_date: date,
        to_date: date,
        prev_from_date: date,
        prev_to_date: date,
    ) -> SummaryResult:
        current_rows = self._select_receipts(user_id, from_date, to_date)
        previous_rows = self._select_receipts(user_id, prev_from_date, prev_to_date)
        return SummaryResult(
            current=_aggregate_window(current_rows, from_date, to_date),
            previous=_aggregate_window(previous_rows, prev_from_date, prev_to_date),
            by_category=_aggregate_by_category(current_rows),
            by_merchant=_aggregate_by_merchant(current_rows),
        )

    def top_products_for_user(
        self,
        user_id: str,
        *,
        from_date: date,
        to_date: date,
        limit: int,
    ) -> TopProductsResult:
        item_rows = [
            row
            for row in self.items
            if row.user_id == user_id and from_date <= row.issue_date <= to_date
        ]
        return TopProductsResult(
            from_date=from_date,
            to_date=to_date,
            products=_aggregate_top_products(item_rows, limit=limit),
        )

    # ---- Helpers (test setup) -------------------------------------------
    def _select_receipts(
        self, user_id: str, from_date: date, to_date: date
    ) -> list[InMemoryReceiptRow]:
        return [
            r
            for r in self.receipts
            if r.user_id == user_id and from_date <= r.issue_date <= to_date
        ]


# ---------------------------------------------------------------------------
# Aggregation helpers (shared between in-memory and any future test variant)
# ---------------------------------------------------------------------------


def _aggregate_window(
    rows: list[InMemoryReceiptRow], from_date: date, to_date: date
) -> WindowAgg:
    total = sum((r.total for r in rows), Decimal("0"))
    vat = sum((r.vat_total for r in rows), Decimal("0"))
    return WindowAgg(
        from_date=from_date,
        to_date=to_date,
        total=total,
        vat_total=vat,
        receipt_count=len(rows),
    )


def _aggregate_by_category(rows: list[InMemoryReceiptRow]) -> list[CategoryAgg]:
    bucket: dict[str, list[InMemoryReceiptRow]] = defaultdict(list)
    for r in rows:
        bucket[r.business_category or UNTAGGED].append(r)
    aggregated = [
        CategoryAgg(
            category=category,
            total=sum((r.total for r in items), Decimal("0")),
            receipt_count=len(items),
        )
        for category, items in bucket.items()
    ]
    aggregated.sort(key=lambda a: (-a.total, a.category))
    return aggregated


def _aggregate_by_merchant(rows: list[InMemoryReceiptRow]) -> list[MerchantAgg]:
    bucket: dict[str, list[InMemoryReceiptRow]] = defaultdict(list)
    for r in rows:
        bucket[r.merchant_name].append(r)
    aggregated = [
        MerchantAgg(
            merchant_name=merchant,
            total=sum((r.total for r in items), Decimal("0")),
            receipt_count=len(items),
        )
        for merchant, items in bucket.items()
    ]
    aggregated.sort(key=lambda a: (-a.total, a.merchant_name))
    return aggregated


def _aggregate_top_products(
    rows: list[InMemoryItemRow], *, limit: int
) -> list[TopProduct]:
    bucket: dict[str, list[InMemoryItemRow]] = defaultdict(list)
    for row in rows:
        # Group by EAN when present; fall back to description so items
        # without a barcode still cluster in a stable way.
        key = row.ean if row.ean else f"desc:{row.description}"
        bucket[key].append(row)

    products: list[TopProduct] = []
    for items in bucket.values():
        first = items[0]
        total_spend = sum((it.total_value for it in items), Decimal("0"))
        total_qty = sum((it.quantity for it in items), Decimal("0"))
        avg_price = total_spend / total_qty if total_qty > 0 else Decimal("0")
        products.append(
            TopProduct(
                ean=first.ean,
                description=first.description,
                frequency=len(items),
                total_spend=total_spend,
                average_unit_price=avg_price,
            )
        )
    products.sort(key=lambda p: (-p.frequency, -p.total_spend, p.description))
    return products[:limit]


# ---------------------------------------------------------------------------
# Supabase-backed implementation (production wiring; not exercised by tests)
# ---------------------------------------------------------------------------


@dataclass
class SupabaseInsightsRepository:
    """Calls the two RPC functions defined in ``db/migrations/0003_insights_rpc.sql``.

    Aggregation runs in Postgres (per ADR-0005 §1); this class only translates
    the JSON returned by PostgREST into the result dataclasses. The route
    layer is the single source of truth for response shape; this class avoids
    Pydantic models so the in-memory + Supabase paths produce structurally
    identical objects.
    """

    client: Any  # supabase.Client at runtime; typed lazily.

    def summary_for_user(
        self,
        user_id: str,
        *,
        from_date: date,
        to_date: date,
        prev_from_date: date,
        prev_to_date: date,
    ) -> SummaryResult:
        payload = {
            "user_uuid": user_id,
            "from_date": from_date.isoformat(),
            "to_date": to_date.isoformat(),
            "prev_from_date": prev_from_date.isoformat(),
            "prev_to_date": prev_to_date.isoformat(),
        }
        resp = self.client.rpc("insights_summary_for_user", payload).execute()
        body = _first_or_empty(getattr(resp, "data", None))
        return SummaryResult(
            current=_window_from_row(
                body.get("current") or {}, from_date, to_date
            ),
            previous=_window_from_row(
                body.get("previous") or {}, prev_from_date, prev_to_date
            ),
            by_category=[
                CategoryAgg(
                    category=row.get("category", UNTAGGED) or UNTAGGED,
                    total=_to_decimal(row.get("total")),
                    receipt_count=int(row.get("receipt_count", 0)),
                )
                for row in body.get("by_category") or []
            ],
            by_merchant=[
                MerchantAgg(
                    merchant_name=row.get("merchant_name", "") or "",
                    total=_to_decimal(row.get("total")),
                    receipt_count=int(row.get("receipt_count", 0)),
                )
                for row in body.get("by_merchant") or []
            ],
        )

    def top_products_for_user(
        self,
        user_id: str,
        *,
        from_date: date,
        to_date: date,
        limit: int,
    ) -> TopProductsResult:
        payload = {
            "user_uuid": user_id,
            "from_date": from_date.isoformat(),
            "to_date": to_date.isoformat(),
            "limit_n": limit,
        }
        resp = self.client.rpc(
            "insights_top_products_for_user", payload
        ).execute()
        rows = list(getattr(resp, "data", None) or [])
        return TopProductsResult(
            from_date=from_date,
            to_date=to_date,
            products=[
                TopProduct(
                    ean=str(row.get("ean", "") or ""),
                    description=str(row.get("description", "") or ""),
                    frequency=int(row.get("frequency", 0)),
                    total_spend=_to_decimal(row.get("total_spend")),
                    average_unit_price=_to_decimal(row.get("average_unit_price")),
                )
                for row in rows
            ],
        )


def _first_or_empty(value: Any) -> dict[str, Any]:
    """Return the first row of an RPC response or ``{}``."""
    if isinstance(value, list):
        if not value:
            return {}
        first = value[0]
        return first if isinstance(first, dict) else {}
    if isinstance(value, dict):
        return value
    return {}


def _to_decimal(value: Any) -> Decimal:
    if value is None:
        return Decimal("0")
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def _window_from_row(
    row: dict[str, Any], default_from: date, default_to: date
) -> WindowAgg:
    return WindowAgg(
        from_date=_parse_date(row.get("from_date"), default_from),
        to_date=_parse_date(row.get("to_date"), default_to),
        total=_to_decimal(row.get("total")),
        vat_total=_to_decimal(row.get("vat_total")),
        receipt_count=int(row.get("receipt_count", 0)),
    )


def _parse_date(value: Any, default: date) -> date:
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        try:
            return date.fromisoformat(value)
        except ValueError:
            return default
    return default
