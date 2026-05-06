"""InMemoryInsightsRepository — aggregation correctness (ADR-0005 §8)."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from app.insights.repository import (
    InMemoryInsightsRepository,
    InMemoryItemRow,
    InMemoryReceiptRow,
)

USER = "00000000-0000-0000-0000-000000000001"


def _receipt(
    issue: date,
    *,
    user: str = USER,
    total: str = "10.00",
    vat: str = "1.92",
    merchant: str = "ALPHA",
    category: str | None = None,
) -> InMemoryReceiptRow:
    return InMemoryReceiptRow(
        user_id=user,
        issue_date=issue,
        total=Decimal(total),
        vat_total=Decimal(vat),
        merchant_name=merchant,
        business_category=category,
    )


def _item(
    issue: date,
    *,
    user: str = USER,
    ean: str = "",
    description: str = "ITEM",
    qty: str = "1.0",
    total_value: str = "10.00",
    unit_price: str = "10.00",
) -> InMemoryItemRow:
    return InMemoryItemRow(
        user_id=user,
        issue_date=issue,
        ean=ean,
        description=description,
        quantity=Decimal(qty),
        unit_price=Decimal(unit_price),
        total_value=Decimal(total_value),
    )


def test_summary_aggregates_current_and_previous_windows() -> None:
    repo = InMemoryInsightsRepository()
    # April 2026 — current window
    repo.receipts.append(_receipt(date(2026, 4, 5), total="10.00", vat="2.40"))
    repo.receipts.append(_receipt(date(2026, 4, 28), total="20.00", vat="4.80"))
    # March 2026 — previous window
    repo.receipts.append(_receipt(date(2026, 3, 12), total="50.00", vat="12.00"))
    # May 2026 — outside both windows; must be excluded
    repo.receipts.append(_receipt(date(2026, 5, 1), total="999.99", vat="240.00"))

    result = repo.summary_for_user(
        USER,
        from_date=date(2026, 4, 1),
        to_date=date(2026, 4, 30),
        prev_from_date=date(2026, 3, 1),
        prev_to_date=date(2026, 3, 31),
    )
    assert result.current.total == Decimal("30.00")
    assert result.current.vat_total == Decimal("7.20")
    assert result.current.receipt_count == 2
    assert result.previous.total == Decimal("50.00")
    assert result.previous.receipt_count == 1


def test_summary_scopes_by_user() -> None:
    repo = InMemoryInsightsRepository()
    repo.receipts.append(_receipt(date(2026, 4, 5), total="10.00", user=USER))
    repo.receipts.append(
        _receipt(date(2026, 4, 5), total="999.99", user="someone-else")
    )
    result = repo.summary_for_user(
        USER,
        from_date=date(2026, 4, 1),
        to_date=date(2026, 4, 30),
        prev_from_date=date(2026, 3, 1),
        prev_to_date=date(2026, 3, 31),
    )
    assert result.current.total == Decimal("10.00")
    assert result.current.receipt_count == 1


def test_by_category_groups_with_untagged_bucket() -> None:
    repo = InMemoryInsightsRepository()
    repo.receipts.append(_receipt(date(2026, 4, 5), total="10.00", category="groceries"))
    repo.receipts.append(_receipt(date(2026, 4, 6), total="5.00", category="groceries"))
    repo.receipts.append(_receipt(date(2026, 4, 7), total="20.00", category=None))

    result = repo.summary_for_user(
        USER,
        from_date=date(2026, 4, 1),
        to_date=date(2026, 4, 30),
        prev_from_date=date(2026, 3, 1),
        prev_to_date=date(2026, 3, 31),
    )
    assert [c.category for c in result.by_category] == ["untagged", "groceries"]
    assert result.by_category[0].total == Decimal("20.00")
    assert result.by_category[1].total == Decimal("15.00")
    assert result.by_category[1].receipt_count == 2


def test_by_merchant_orders_by_total_desc() -> None:
    repo = InMemoryInsightsRepository()
    repo.receipts.append(_receipt(date(2026, 4, 1), total="10.00", merchant="ALPHA"))
    repo.receipts.append(_receipt(date(2026, 4, 2), total="80.00", merchant="BETA"))
    repo.receipts.append(_receipt(date(2026, 4, 3), total="40.00", merchant="ALPHA"))

    result = repo.summary_for_user(
        USER,
        from_date=date(2026, 4, 1),
        to_date=date(2026, 4, 30),
        prev_from_date=date(2026, 3, 1),
        prev_to_date=date(2026, 3, 31),
    )
    names = [m.merchant_name for m in result.by_merchant]
    assert names == ["BETA", "ALPHA"]
    assert result.by_merchant[1].receipt_count == 2


def test_top_products_groups_by_ean_and_orders_by_frequency() -> None:
    repo = InMemoryInsightsRepository()
    # ΓΑΛΑ — 3 purchases
    for _ in range(3):
        repo.items.append(
            _item(
                date(2026, 4, 5),
                ean="5201360123456",
                description="ΓΑΛΑ ΦΡΕΣΚΟ 1L",
                qty="1.0",
                total_value="1.45",
                unit_price="1.45",
            )
        )
    # ΨΩΜΙ — 2 purchases
    for _ in range(2):
        repo.items.append(
            _item(
                date(2026, 4, 5),
                ean="5201360999999",
                description="ΨΩΜΙ",
                qty="1.0",
                total_value="2.00",
                unit_price="2.00",
            )
        )
    # Out-of-window purchase ignored
    repo.items.append(
        _item(
            date(2026, 5, 1),
            ean="5201360123456",
            description="ΓΑΛΑ",
            qty="1",
            total_value="9.99",
        )
    )

    result = repo.top_products_for_user(
        USER, from_date=date(2026, 4, 1), to_date=date(2026, 4, 30), limit=10
    )
    assert [p.description for p in result.products] == ["ΓΑΛΑ ΦΡΕΣΚΟ 1L", "ΨΩΜΙ"]
    assert result.products[0].frequency == 3
    assert result.products[0].total_spend == Decimal("4.35")
    assert result.products[0].average_unit_price == Decimal("1.45")


def test_top_products_falls_back_to_description_when_ean_missing() -> None:
    repo = InMemoryInsightsRepository()
    # Same description, no EAN — should cluster as one product.
    repo.items.append(
        _item(date(2026, 4, 5), ean="", description="ΧΩΡΙΣ ΚΩΔΙΚΟ", total_value="3.00")
    )
    repo.items.append(
        _item(date(2026, 4, 6), ean="", description="ΧΩΡΙΣ ΚΩΔΙΚΟ", total_value="2.00")
    )
    result = repo.top_products_for_user(
        USER, from_date=date(2026, 4, 1), to_date=date(2026, 4, 30), limit=10
    )
    assert len(result.products) == 1
    assert result.products[0].frequency == 2
    assert result.products[0].total_spend == Decimal("5.00")


def test_top_products_respects_limit() -> None:
    repo = InMemoryInsightsRepository()
    for n in range(5):
        for _ in range(n + 1):
            repo.items.append(
                _item(
                    date(2026, 4, 5),
                    ean=f"P{n}",
                    description=f"PROD{n}",
                    total_value="1.00",
                )
            )
    result = repo.top_products_for_user(
        USER, from_date=date(2026, 4, 1), to_date=date(2026, 4, 30), limit=2
    )
    assert len(result.products) == 2
    assert result.products[0].frequency == 5
    assert result.products[1].frequency == 4
