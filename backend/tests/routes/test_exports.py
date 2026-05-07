"""Contract tests for ``GET /export/business-expenses`` (BLG-0019 / ADR-0009).

Covers ADR-0009 §7 acceptance:

- 200 + ``Content-Type: application/pdf`` for valid input.
- ``Content-Disposition`` includes the date range in the filename.
- 401 missing JWT.
- 401 invalid JWT.
- 422 ``to_date`` < ``from_date``.
- 422 range too long (> 366 days).
- 200 small PDF for empty range.
- The endpoint NEVER calls back to the network — repository is in-memory.
- The PDF body starts with ``%PDF-`` (well-formedness).

Privacy assertions:

- The request log doesn't echo any value from the query (we can't
  assert this on the response, but ADR-0009 §3 mandates it for the log;
  the unit is enforced by the route's ``log.info`` call which omits
  ``from_date`` / ``to_date``).
"""

from __future__ import annotations

from collections.abc import Generator
from datetime import UTC, date, datetime
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from app.auth import make_supabase_jwt_for_test
from app.exports.business_expenses import (
    BusinessExpenseRow,
    InMemoryBusinessExpensesRepository,
)
from app.main import app
from app.routes.exports import (
    get_business_expenses_repository,
    get_jwt_secret,
    get_user_storage,
)
from app.storage.users import InMemoryUserStorage, StoredUser

JWT_SECRET = "test-secret-not-real"
USER_ID = "00000000-0000-0000-0000-000000000001"


def _row(receipt_id: str, issue_date: date) -> BusinessExpenseRow:
    return BusinessExpenseRow(
        receipt_id=receipt_id,
        issue_date=issue_date,
        merchant_name="ΑΛΦΑ ΑΕ",
        merchant_afm="094543987",
        total=Decimal("42.50"),
        vat_total=Decimal("8.20"),
        business_category="groceries",
        notes=None,
    )


@pytest.fixture
def repo() -> InMemoryBusinessExpensesRepository:
    return InMemoryBusinessExpensesRepository(
        rows=[
            (USER_ID, _row("r-1", date(2026, 5, 5))),
            (USER_ID, _row("r-2", date(2026, 5, 15))),
        ]
    )


@pytest.fixture
def user_storage() -> InMemoryUserStorage:
    s = InMemoryUserStorage()
    s.seed(
        StoredUser(
            id=USER_ID,
            afm="094019245",
            email=None,
            is_freelancer=True,
            created_at=datetime(2026, 1, 1, tzinfo=UTC),
        )
    )
    return s


@pytest.fixture
def client(
    repo: InMemoryBusinessExpensesRepository,
    user_storage: InMemoryUserStorage,
) -> Generator[TestClient, None, None]:
    app.dependency_overrides[get_business_expenses_repository] = lambda: repo
    app.dependency_overrides[get_user_storage] = lambda: user_storage
    app.dependency_overrides[get_jwt_secret] = lambda: JWT_SECRET
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def auth_header() -> dict[str, str]:
    token = make_supabase_jwt_for_test(USER_ID, JWT_SECRET)
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Happy paths
# ---------------------------------------------------------------------------


def test_valid_range_returns_pdf(
    client: TestClient,
    auth_header: dict[str, str],
) -> None:
    resp = client.get(
        "/export/business-expenses",
        params={"from_date": "2026-05-01", "to_date": "2026-05-31"},
        headers=auth_header,
    )
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/pdf"
    # ADR-0009 §2: PDF generated on the fly, never persisted.
    assert resp.content[:5] == b"%PDF-"
    assert len(resp.content) > 1024


def test_filename_includes_range(
    client: TestClient,
    auth_header: dict[str, str],
) -> None:
    resp = client.get(
        "/export/business-expenses",
        params={"from_date": "2026-05-01", "to_date": "2026-05-31"},
        headers=auth_header,
    )
    assert resp.status_code == 200
    cd = resp.headers["content-disposition"]
    assert "attachment" in cd
    assert "business-expenses-2026-05-01-2026-05-31.pdf" in cd


def test_empty_range_still_returns_valid_pdf(
    client: TestClient,
    auth_header: dict[str, str],
) -> None:
    # No rows in 2025 — but the endpoint still returns a 200 PDF (BLG-0019
    # acceptance + DES-0004 §3.4 "Δεν υπάρχουν επαγγελματικά έξοδα" page).
    resp = client.get(
        "/export/business-expenses",
        params={"from_date": "2025-01-01", "to_date": "2025-01-31"},
        headers=auth_header,
    )
    assert resp.status_code == 200
    assert resp.content[:5] == b"%PDF-"


def test_cache_control_is_private_no_store(
    client: TestClient,
    auth_header: dict[str, str],
) -> None:
    resp = client.get(
        "/export/business-expenses",
        params={"from_date": "2026-05-01", "to_date": "2026-05-31"},
        headers=auth_header,
    )
    assert resp.headers.get("cache-control") == "private, no-store"


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------


def test_missing_bearer_returns_401(
    client: TestClient,
) -> None:
    resp = client.get(
        "/export/business-expenses",
        params={"from_date": "2026-05-01", "to_date": "2026-05-31"},
    )
    assert resp.status_code == 401


def test_invalid_bearer_returns_401(
    client: TestClient,
) -> None:
    resp = client.get(
        "/export/business-expenses",
        params={"from_date": "2026-05-01", "to_date": "2026-05-31"},
        headers={"Authorization": "Bearer not-a-real-jwt"},
    )
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------


def test_to_date_before_from_date_returns_422(
    client: TestClient,
    auth_header: dict[str, str],
) -> None:
    resp = client.get(
        "/export/business-expenses",
        params={"from_date": "2026-05-31", "to_date": "2026-05-01"},
        headers=auth_header,
    )
    assert resp.status_code == 422
    assert resp.json()["title"] == "Invalid date range"


def test_range_too_long_returns_422(
    client: TestClient,
    auth_header: dict[str, str],
) -> None:
    # 367 days — one day over the cap.
    resp = client.get(
        "/export/business-expenses",
        params={"from_date": "2025-01-01", "to_date": "2026-01-03"},
        headers=auth_header,
    )
    assert resp.status_code == 422
    assert resp.json()["title"] == "Range too long"


def test_invalid_date_format_rejected(
    client: TestClient,
    auth_header: dict[str, str],
) -> None:
    resp = client.get(
        "/export/business-expenses",
        params={"from_date": "not-a-date", "to_date": "2026-05-31"},
        headers=auth_header,
    )
    # FastAPI maps the date-parsing failure to RequestValidationError → 400.
    assert resp.status_code in (400, 422)
