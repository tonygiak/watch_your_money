"""Contract tests for the insights endpoints (BLG-0006 / ADR-0005 §4 + §8).

Asserts the wire-shape of every response field documented in ADR-0005 §4,
including:

- decimal-as-string totals (`"42.00"`, never `42.0`),
- explicit `from_date` / `to_date` rendering as `YYYY-MM-DD`,
- the `untagged` literal bucket for receipts without `business_category`,
- 401 on missing / invalid Bearer JWT,
- `limit` query clamping (≤ 50, ≥ 1).

Network-free: the in-memory repository serves the fixtures directly. The
SQL RPC functions in `db/migrations/0003_insights_rpc.sql` carry the same
contract; live integration tests against Supabase are S-005+ work
(ADR-0005 §8 "live: one slow-marked integration test").
"""

from __future__ import annotations

from collections.abc import Generator
from datetime import date
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from app.auth import make_supabase_jwt_for_test
from app.insights.repository import (
    InMemoryInsightsRepository,
    InMemoryItemRow,
    InMemoryReceiptRow,
)
from app.main import app
from app.routes.insights import get_insights_repository, get_jwt_secret

JWT_SECRET = "test-secret-not-real"
USER_ID = "00000000-0000-0000-0000-000000000001"


@pytest.fixture
def repository() -> InMemoryInsightsRepository:
    return InMemoryInsightsRepository()


@pytest.fixture
def client(
    repository: InMemoryInsightsRepository,
) -> Generator[TestClient, None, None]:
    app.dependency_overrides[get_insights_repository] = lambda: repository
    app.dependency_overrides[get_jwt_secret] = lambda: JWT_SECRET
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def auth_header() -> dict[str, str]:
    token = make_supabase_jwt_for_test(USER_ID, JWT_SECRET)
    return {"Authorization": f"Bearer {token}"}


def _seed_april(repository: InMemoryInsightsRepository) -> None:
    repository.receipts.extend(
        [
            InMemoryReceiptRow(
                user_id=USER_ID,
                issue_date=date(2026, 4, 3),
                total=Decimal("210.30"),
                vat_total=Decimal("40.40"),
                merchant_name="ALPHA SUPER MARKET",
                business_category="groceries",
            ),
            InMemoryReceiptRow(
                user_id=USER_ID,
                issue_date=date(2026, 4, 19),
                total=Decimal("202.20"),
                vat_total=Decimal("38.80"),
                merchant_name="FARMACY KENTRO",
                business_category=None,
            ),
            # March 2026 — previous window
            InMemoryReceiptRow(
                user_id=USER_ID,
                issue_date=date(2026, 3, 14),
                total=Decimal("503.10"),
                vat_total=Decimal("96.60"),
                merchant_name="ALPHA SUPER MARKET",
                business_category="groceries",
            ),
        ]
    )
    repository.items.extend(
        [
            InMemoryItemRow(
                user_id=USER_ID,
                issue_date=date(2026, 4, 3),
                ean="5201360123456",
                description="ΓΑΛΑ ΦΡΕΣΚΟ 1L",
                quantity=Decimal("1"),
                unit_price=Decimal("1.45"),
                total_value=Decimal("1.45"),
            ),
            InMemoryItemRow(
                user_id=USER_ID,
                issue_date=date(2026, 4, 7),
                ean="5201360123456",
                description="ΓΑΛΑ ΦΡΕΣΚΟ 1L",
                quantity=Decimal("1"),
                unit_price=Decimal("1.45"),
                total_value=Decimal("1.45"),
            ),
        ]
    )


# ---------------------------------------------------------------------------
# Auth (a + b mirror /receipts/parse)
# ---------------------------------------------------------------------------


def test_summary_requires_bearer(client: TestClient) -> None:
    response = client.get("/insights/summary?period=month&anchor=2026-04-30")
    assert response.status_code == 401


def test_summary_rejects_invalid_bearer(client: TestClient) -> None:
    response = client.get(
        "/insights/summary?period=month&anchor=2026-04-30",
        headers={"Authorization": "Bearer not-a-real-token"},
    )
    assert response.status_code == 401


def test_products_requires_bearer(client: TestClient) -> None:
    response = client.get("/insights/products?period=month&anchor=2026-04-30")
    assert response.status_code == 401


# ---------------------------------------------------------------------------
# Summary shape (ADR-0005 §4)
# ---------------------------------------------------------------------------


def test_summary_returns_documented_shape(
    client: TestClient,
    repository: InMemoryInsightsRepository,
    auth_header: dict[str, str],
) -> None:
    _seed_april(repository)
    response = client.get(
        "/insights/summary?period=month&anchor=2026-04-30",
        headers=auth_header,
    )
    assert response.status_code == 200
    body = response.json()

    assert body["period"] == "month"
    assert body["anchor"] == "2026-04-30"
    assert body["current"] == {
        "from_date": "2026-04-01",
        "to_date": "2026-04-30",
        "total": "412.50",
        "vat_total": "79.20",
        "receipt_count": 2,
    }
    assert body["previous"] == {
        "from_date": "2026-03-01",
        "to_date": "2026-03-31",
        "total": "503.10",
        "vat_total": "96.60",
        "receipt_count": 1,
    }
    # Both buckets present, untagged first because its total is bigger.
    categories = body["by_category"]
    assert {c["category"] for c in categories} == {"groceries", "untagged"}
    # Money fields must be strings (decimal-as-string per ADR-0005 §5).
    for c in categories:
        assert isinstance(c["total"], str)
        assert "." in c["total"]
    merchants = body["by_merchant"]
    assert merchants[0]["merchant_name"] == "ALPHA SUPER MARKET"


def test_summary_with_no_receipts_returns_zeroed_window(
    client: TestClient,
    auth_header: dict[str, str],
) -> None:
    response = client.get(
        "/insights/summary?period=month&anchor=2026-04-30",
        headers=auth_header,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["current"]["total"] == "0.00"
    assert body["current"]["receipt_count"] == 0
    assert body["by_category"] == []
    assert body["by_merchant"] == []


def test_summary_anchor_defaults_to_today_in_athens(
    client: TestClient,
    repository: InMemoryInsightsRepository,
    auth_header: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.insights import period as period_mod

    monkeypatch.setattr(period_mod, "athens_today", lambda: date(2026, 4, 30))
    _seed_april(repository)
    response = client.get(
        "/insights/summary?period=month",
        headers=auth_header,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["anchor"] == "2026-04-30"
    assert body["current"]["from_date"] == "2026-04-01"


# ---------------------------------------------------------------------------
# Products shape
# ---------------------------------------------------------------------------


def test_products_returns_documented_shape(
    client: TestClient,
    repository: InMemoryInsightsRepository,
    auth_header: dict[str, str],
) -> None:
    _seed_april(repository)
    response = client.get(
        "/insights/products?period=month&anchor=2026-04-30",
        headers=auth_header,
    )
    assert response.status_code == 200
    body = response.json()

    assert body["period"] == "month"
    assert body["from_date"] == "2026-04-01"
    assert body["to_date"] == "2026-04-30"
    assert len(body["products"]) == 1
    assert body["products"][0]["ean"] == "5201360123456"
    assert body["products"][0]["frequency"] == 2
    assert body["products"][0]["total_spend"] == "2.90"
    assert body["products"][0]["average_unit_price"] == "1.45"
    assert isinstance(body["products"][0]["total_spend"], str)


def test_products_default_limit_is_ten(
    client: TestClient,
    repository: InMemoryInsightsRepository,
    auth_header: dict[str, str],
) -> None:
    # Seed 12 distinct products; expect only 10 returned.
    for n in range(12):
        repository.items.append(
            InMemoryItemRow(
                user_id=USER_ID,
                issue_date=date(2026, 4, 5),
                ean=f"P{n:06d}",
                description=f"PRODUCT {n}",
                quantity=Decimal("1"),
                unit_price=Decimal("1"),
                total_value=Decimal(str(n + 1)),
            )
        )
    response = client.get(
        "/insights/products?period=month&anchor=2026-04-30",
        headers=auth_header,
    )
    assert response.status_code == 200
    assert len(response.json()["products"]) == 10


def test_products_rejects_limit_above_fifty(
    client: TestClient,
    auth_header: dict[str, str],
) -> None:
    response = client.get(
        "/insights/products?period=month&anchor=2026-04-30&limit=51",
        headers=auth_header,
    )
    assert response.status_code == 400


def test_products_rejects_limit_below_one(
    client: TestClient,
    auth_header: dict[str, str],
) -> None:
    response = client.get(
        "/insights/products?period=month&anchor=2026-04-30&limit=0",
        headers=auth_header,
    )
    assert response.status_code == 400


# ---------------------------------------------------------------------------
# Period validation
# ---------------------------------------------------------------------------


def test_summary_rejects_invalid_period(
    client: TestClient,
    auth_header: dict[str, str],
) -> None:
    response = client.get(
        "/insights/summary?period=decade&anchor=2026-04-30",
        headers=auth_header,
    )
    assert response.status_code == 400


def test_summary_accepts_week_period(
    client: TestClient,
    repository: InMemoryInsightsRepository,
    auth_header: dict[str, str],
) -> None:
    _seed_april(repository)
    response = client.get(
        "/insights/summary?period=week&anchor=2026-04-15",
        headers=auth_header,
    )
    assert response.status_code == 200
    body = response.json()
    # Wed 15 April 2026 → Mon 13 → Sun 19.
    assert body["current"]["from_date"] == "2026-04-13"
    assert body["current"]["to_date"] == "2026-04-19"


# ---------------------------------------------------------------------------
# Privacy guarantees: error responses never leak parser/RLS shape
# ---------------------------------------------------------------------------


def test_error_payload_never_carries_user_id(
    client: TestClient,
) -> None:
    response = client.get("/insights/summary?period=month&anchor=2026-04-30")
    body = response.json()
    serialized = str(body)
    assert "user_id" not in serialized
    assert USER_ID not in serialized
