"""Contract tests for ``POST /receipts/{id}/tag`` (BLG-0018 / ADR-0008).

Asserts every BLG-0018 / ADR-0008 §2 acceptance bullet:

- Tag with valid body → 200 + ``is_business_expense=true`` + lowercased category.
- Untag (``is_business=false``) → 200 + cleared category + cleared notes.
- Re-POST same body → 200 no-op.
- Different user → 404 (no enumeration).
- Missing Bearer → 401.
- Invalid Bearer → 401.
- Malformed body (extra ``user_id``) → 422.
- ``is_business=true`` + missing category → 422.
- Too-long category (post-trim) → 422.
- Too-long notes (post-trim) → 422.
- Non-existent receipt → 404.

Network-free: the in-memory storage fake is wired via ``dependency_overrides``.
The category text and notes text are NEVER asserted in any log line — the
storage assertion is the source of truth (ADR-0008 §4 / DES-0005 §6).
"""

from __future__ import annotations

from collections.abc import Generator
from decimal import Decimal
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

from app.auth import make_supabase_jwt_for_test
from app.main import app
from app.parsers.base import ParsedReceipt, ParsedReceiptItem
from app.routes.receipt_tag import get_jwt_secret as tag_get_jwt_secret
from app.routes.receipts import get_jwt_secret as parse_get_jwt_secret
from app.routes.receipts import get_storage
from app.storage.receipts import InMemoryReceiptStorage

JWT_SECRET = "test-secret-not-real"
USER_ID = "00000000-0000-0000-0000-000000000001"
OTHER_USER_ID = "00000000-0000-0000-0000-000000000002"


def _seed_receipt(storage: InMemoryReceiptStorage, user_id: str) -> UUID:
    parsed = ParsedReceipt(
        country_code="GR",
        merchant_name="ALPHA SUPER MARKET",
        merchant_afm="094543987",
        document_number="A-001",
        mark="9999000000000001",
        total=Decimal("42.50"),
        vat_total=Decimal("8.20"),
        items=[
            ParsedReceiptItem(
                ean="5201360123456",
                description="ΓΑΛΑ ΦΡΕΣΚΟ 1L",
                unit="τεμ.",
                quantity=Decimal("1"),
                unit_price=Decimal("1.45"),
                total_value=Decimal("1.45"),
            )
        ],
    )
    result = storage.upsert_receipt(user_id, parsed)
    return result.receipt.id


@pytest.fixture
def storage() -> InMemoryReceiptStorage:
    return InMemoryReceiptStorage()


@pytest.fixture
def client(
    storage: InMemoryReceiptStorage,
) -> Generator[TestClient, None, None]:
    app.dependency_overrides[get_storage] = lambda: storage
    # Both routes resolve their own JWT secret; the dependency-override key
    # is the function object — we override BOTH so a single test run
    # exercises both endpoints with the same secret.
    app.dependency_overrides[parse_get_jwt_secret] = lambda: JWT_SECRET
    app.dependency_overrides[tag_get_jwt_secret] = lambda: JWT_SECRET
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def auth_header() -> dict[str, str]:
    token = make_supabase_jwt_for_test(USER_ID, JWT_SECRET)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def other_auth_header() -> dict[str, str]:
    token = make_supabase_jwt_for_test(OTHER_USER_ID, JWT_SECRET)
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Happy paths
# ---------------------------------------------------------------------------


def test_tag_valid_body_returns_200_with_lowercased_category(
    client: TestClient,
    storage: InMemoryReceiptStorage,
    auth_header: dict[str, str],
) -> None:
    receipt_id = _seed_receipt(storage, USER_ID)
    resp = client.post(
        f"/receipts/{receipt_id}/tag",
        json={
            "is_business": True,
            "category": "  Groceries  ",  # mixed case + whitespace
            "notes": "  client lunch  ",
        },
        headers=auth_header,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["is_business_expense"] is True
    assert body["business_category"] == "groceries"  # trimmed + lowercased
    assert body["notes"] == "client lunch"  # trimmed
    assert body["id"] == str(receipt_id)
    # Full receipt shape is returned — line items survive the round-trip.
    assert len(body["items"]) == 1
    assert body["items"][0]["description"] == "ΓΑΛΑ ΦΡΕΣΚΟ 1L"


def test_untag_clears_category_and_notes(
    client: TestClient,
    storage: InMemoryReceiptStorage,
    auth_header: dict[str, str],
) -> None:
    receipt_id = _seed_receipt(storage, USER_ID)
    # First, tag it.
    client.post(
        f"/receipts/{receipt_id}/tag",
        json={"is_business": True, "category": "fuel", "notes": "trip to Athens"},
        headers=auth_header,
    )
    # Then untag.
    resp = client.post(
        f"/receipts/{receipt_id}/tag",
        json={"is_business": False},
        headers=auth_header,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["is_business_expense"] is False
    assert body["business_category"] is None
    assert body["notes"] is None


def test_repost_same_body_is_idempotent_200_noop(
    client: TestClient,
    storage: InMemoryReceiptStorage,
    auth_header: dict[str, str],
) -> None:
    receipt_id = _seed_receipt(storage, USER_ID)
    payload = {"is_business": True, "category": "groceries"}
    first = client.post(
        f"/receipts/{receipt_id}/tag",
        json=payload,
        headers=auth_header,
    )
    second = client.post(
        f"/receipts/{receipt_id}/tag",
        json=payload,
        headers=auth_header,
    )
    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json() == second.json()


def test_untag_when_already_untagged_is_idempotent_200(
    client: TestClient,
    storage: InMemoryReceiptStorage,
    auth_header: dict[str, str],
) -> None:
    receipt_id = _seed_receipt(storage, USER_ID)
    resp = client.post(
        f"/receipts/{receipt_id}/tag",
        json={"is_business": False},
        headers=auth_header,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["is_business_expense"] is False
    assert body["business_category"] is None


def test_notes_are_optional_when_tagging(
    client: TestClient,
    storage: InMemoryReceiptStorage,
    auth_header: dict[str, str],
) -> None:
    receipt_id = _seed_receipt(storage, USER_ID)
    resp = client.post(
        f"/receipts/{receipt_id}/tag",
        json={"is_business": True, "category": "transport"},
        headers=auth_header,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["notes"] is None
    assert body["business_category"] == "transport"


# ---------------------------------------------------------------------------
# Authorization
# ---------------------------------------------------------------------------


def test_missing_bearer_returns_401(
    client: TestClient, storage: InMemoryReceiptStorage
) -> None:
    receipt_id = _seed_receipt(storage, USER_ID)
    resp = client.post(
        f"/receipts/{receipt_id}/tag",
        json={"is_business": True, "category": "groceries"},
    )
    assert resp.status_code == 401
    assert resp.json()["type"] == "unauthenticated"


def test_invalid_bearer_returns_401(
    client: TestClient, storage: InMemoryReceiptStorage
) -> None:
    receipt_id = _seed_receipt(storage, USER_ID)
    resp = client.post(
        f"/receipts/{receipt_id}/tag",
        json={"is_business": True, "category": "groceries"},
        headers={"Authorization": "Bearer not-a-real-jwt"},
    )
    assert resp.status_code == 401


def test_other_user_cannot_tag_my_receipt_returns_404(
    client: TestClient,
    storage: InMemoryReceiptStorage,
    other_auth_header: dict[str, str],
) -> None:
    receipt_id = _seed_receipt(storage, USER_ID)
    resp = client.post(
        f"/receipts/{receipt_id}/tag",
        json={"is_business": True, "category": "groceries"},
        headers=other_auth_header,
    )
    # ADR-0008 §3: 404, not 403 — never reveal that the row exists.
    assert resp.status_code == 404
    assert resp.json()["type"] == "not_found"


def test_nonexistent_receipt_returns_404(
    client: TestClient, auth_header: dict[str, str]
) -> None:
    resp = client.post(
        f"/receipts/{uuid4()}/tag",
        json={"is_business": True, "category": "groceries"},
        headers=auth_header,
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Body validation
# ---------------------------------------------------------------------------


def test_extra_user_id_field_rejected_by_extra_forbid(
    client: TestClient,
    storage: InMemoryReceiptStorage,
    auth_header: dict[str, str],
) -> None:
    receipt_id = _seed_receipt(storage, USER_ID)
    resp = client.post(
        f"/receipts/{receipt_id}/tag",
        json={
            "is_business": True,
            "category": "groceries",
            "user_id": "spoof-attempt",
        },
        headers=auth_header,
    )
    # 400 (FastAPI's RequestValidationError handler) or 422 — either is
    # acceptable for ADR-0008 §2 / ADR-0002 §4 envelopes.
    assert resp.status_code in (400, 422)


def test_missing_is_business_field_returns_400_or_422(
    client: TestClient,
    storage: InMemoryReceiptStorage,
    auth_header: dict[str, str],
) -> None:
    receipt_id = _seed_receipt(storage, USER_ID)
    resp = client.post(
        f"/receipts/{receipt_id}/tag",
        json={"category": "groceries"},
        headers=auth_header,
    )
    assert resp.status_code in (400, 422)


def test_tagging_without_category_returns_422(
    client: TestClient,
    storage: InMemoryReceiptStorage,
    auth_header: dict[str, str],
) -> None:
    receipt_id = _seed_receipt(storage, USER_ID)
    resp = client.post(
        f"/receipts/{receipt_id}/tag",
        json={"is_business": True},
        headers=auth_header,
    )
    assert resp.status_code == 422


def test_tagging_with_blank_category_returns_422(
    client: TestClient,
    storage: InMemoryReceiptStorage,
    auth_header: dict[str, str],
) -> None:
    receipt_id = _seed_receipt(storage, USER_ID)
    resp = client.post(
        f"/receipts/{receipt_id}/tag",
        json={"is_business": True, "category": "    "},
        headers=auth_header,
    )
    assert resp.status_code == 422


def test_too_long_category_post_trim_returns_422(
    client: TestClient,
    storage: InMemoryReceiptStorage,
    auth_header: dict[str, str],
) -> None:
    receipt_id = _seed_receipt(storage, USER_ID)
    resp = client.post(
        f"/receipts/{receipt_id}/tag",
        json={"is_business": True, "category": "g" * 65},
        headers=auth_header,
    )
    assert resp.status_code == 422


def test_too_long_notes_post_trim_returns_422(
    client: TestClient,
    storage: InMemoryReceiptStorage,
    auth_header: dict[str, str],
) -> None:
    receipt_id = _seed_receipt(storage, USER_ID)
    resp = client.post(
        f"/receipts/{receipt_id}/tag",
        json={
            "is_business": True,
            "category": "groceries",
            "notes": "x" * 501,
        },
        headers=auth_header,
    )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Privacy
# ---------------------------------------------------------------------------


def test_error_envelope_does_not_leak_category_or_notes(
    client: TestClient,
    storage: InMemoryReceiptStorage,
    auth_header: dict[str, str],
) -> None:
    receipt_id = _seed_receipt(storage, USER_ID)
    resp = client.post(
        f"/receipts/{receipt_id}/tag",
        json={
            "is_business": True,
            "category": "g" * 65,
            "notes": "secret-business-detail-do-not-leak",
        },
        headers=auth_header,
    )
    assert resp.status_code == 422
    body_str = resp.text
    assert "secret-business-detail-do-not-leak" not in body_str
    assert "g" * 65 not in body_str
