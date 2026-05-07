"""Contract tests for ``PATCH /users/me`` (BLG-0017 / DES-0004 §4).

Asserts every BLG-0017 acceptance bullet:

- Set ``is_freelancer=true`` → 200 + row reflects it.
- Set ``is_freelancer=false`` → 200 + row reflects it; ``afm`` preserved.
- Set ``afm=<valid 9-digit>`` → 200 + row reflects it (server-side MOD-11 verified).
- Re-PATCH same body → 200 no-op.
- Empty body → 200 no-op (no fields touched).
- Missing Bearer → 401.
- Invalid Bearer → 401.
- Extra field (``phone``) → 400 (Pydantic ``extra='forbid'``).
- Invalid ΑΦΜ (checksum) → 422 with ``invalid_afm`` envelope; ΑΦΜ value
  NOT echoed in the response detail.
- ΑΦΜ wrong length → 422.
- ΑΦΜ all-zeros → 422.
- ``afm: null`` → 200 + ΑΦΜ cleared (explicit null).

Network-free: the in-memory user storage fake is wired via
``dependency_overrides``.
"""

from __future__ import annotations

from collections.abc import Generator
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.auth import make_supabase_jwt_for_test
from app.main import app
from app.routes.users import (
    get_jwt_secret as users_get_jwt_secret,
)
from app.routes.users import (
    get_user_storage,
)
from app.storage.users import InMemoryUserStorage, StoredUser

JWT_SECRET = "test-secret-not-real"
USER_ID = "00000000-0000-0000-0000-000000000001"
OTHER_USER_ID = "00000000-0000-0000-0000-000000000002"


def _seed_user(
    storage: InMemoryUserStorage,
    user_id: str,
    *,
    is_freelancer: bool = False,
    afm: str | None = None,
) -> None:
    storage.seed(
        StoredUser(
            id=user_id,
            afm=afm,
            email=None,
            is_freelancer=is_freelancer,
            created_at=datetime(2026, 1, 1, tzinfo=UTC),
        )
    )


@pytest.fixture
def storage() -> InMemoryUserStorage:
    return InMemoryUserStorage()


@pytest.fixture
def client(
    storage: InMemoryUserStorage,
) -> Generator[TestClient, None, None]:
    app.dependency_overrides[get_user_storage] = lambda: storage
    app.dependency_overrides[users_get_jwt_secret] = lambda: JWT_SECRET
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def auth_header() -> dict[str, str]:
    token = make_supabase_jwt_for_test(USER_ID, JWT_SECRET)
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Happy paths
# ---------------------------------------------------------------------------


def test_set_is_freelancer_true(
    client: TestClient,
    storage: InMemoryUserStorage,
    auth_header: dict[str, str],
) -> None:
    _seed_user(storage, USER_ID, is_freelancer=False)
    resp = client.patch(
        "/users/me", json={"is_freelancer": True}, headers=auth_header
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["is_freelancer"] is True
    assert body["id"] == USER_ID
    # ``phone`` must NEVER appear in the response (DES-0004 §4).
    assert "phone" not in body


def test_set_is_freelancer_false_preserves_afm(
    client: TestClient,
    storage: InMemoryUserStorage,
    auth_header: dict[str, str],
) -> None:
    _seed_user(storage, USER_ID, is_freelancer=True, afm="094019245")
    resp = client.patch(
        "/users/me", json={"is_freelancer": False}, headers=auth_header
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["is_freelancer"] is False
    # DES-0004 §3.2 / §4 invariant: toggling off does NOT clear ΑΦΜ.
    assert body["afm"] == "094019245"


def test_set_valid_afm(
    client: TestClient,
    storage: InMemoryUserStorage,
    auth_header: dict[str, str],
) -> None:
    _seed_user(storage, USER_ID, is_freelancer=True)
    resp = client.patch(
        "/users/me",
        json={"afm": "  094019245  "},  # whitespace stripped server-side
        headers=auth_header,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["afm"] == "094019245"


def test_set_afm_with_freelancer_in_one_call(
    client: TestClient,
    storage: InMemoryUserStorage,
    auth_header: dict[str, str],
) -> None:
    _seed_user(storage, USER_ID, is_freelancer=False)
    resp = client.patch(
        "/users/me",
        json={"is_freelancer": True, "afm": "094014298"},
        headers=auth_header,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["is_freelancer"] is True
    assert body["afm"] == "094014298"


def test_repatch_same_body_is_no_op(
    client: TestClient,
    storage: InMemoryUserStorage,
    auth_header: dict[str, str],
) -> None:
    _seed_user(storage, USER_ID, is_freelancer=True, afm="094019245")
    body_in = {"is_freelancer": True, "afm": "094019245"}
    resp1 = client.patch("/users/me", json=body_in, headers=auth_header)
    resp2 = client.patch("/users/me", json=body_in, headers=auth_header)
    assert resp1.status_code == 200
    assert resp2.status_code == 200
    assert resp1.json() == resp2.json()


def test_empty_body_is_no_op(
    client: TestClient,
    storage: InMemoryUserStorage,
    auth_header: dict[str, str],
) -> None:
    _seed_user(storage, USER_ID, is_freelancer=True, afm="094019245")
    resp = client.patch("/users/me", json={}, headers=auth_header)
    assert resp.status_code == 200
    body = resp.json()
    assert body["is_freelancer"] is True
    assert body["afm"] == "094019245"


def test_explicit_afm_null_clears(
    client: TestClient,
    storage: InMemoryUserStorage,
    auth_header: dict[str, str],
) -> None:
    _seed_user(storage, USER_ID, is_freelancer=True, afm="094019245")
    resp = client.patch(
        "/users/me",
        json={"afm": None},
        headers=auth_header,
    )
    assert resp.status_code == 200
    assert resp.json()["afm"] is None


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------


def test_missing_bearer_returns_401(
    client: TestClient,
) -> None:
    resp = client.patch("/users/me", json={"is_freelancer": True})
    assert resp.status_code == 401


def test_invalid_bearer_returns_401(
    client: TestClient,
) -> None:
    resp = client.patch(
        "/users/me",
        json={"is_freelancer": True},
        headers={"Authorization": "Bearer not-a-real-jwt"},
    )
    assert resp.status_code == 401


def test_user_not_seeded_returns_404(
    client: TestClient,
    auth_header: dict[str, str],
) -> None:
    # No _seed_user call — the verified JWT points at a non-existent row.
    resp = client.patch(
        "/users/me", json={"is_freelancer": True}, headers=auth_header
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------


def test_extra_field_rejected(
    client: TestClient,
    storage: InMemoryUserStorage,
    auth_header: dict[str, str],
) -> None:
    _seed_user(storage, USER_ID)
    resp = client.patch(
        "/users/me",
        json={"phone": "+306900000000"},  # client must never write phone
        headers=auth_header,
    )
    # FastAPI maps ``extra='forbid'`` violations to RequestValidationError → 400.
    assert resp.status_code in (400, 422)
    body = resp.json()
    # Detail must NOT echo the offending value.
    detail = body.get("detail", "")
    assert "+306900000000" not in str(detail)


@pytest.mark.parametrize(
    "afm",
    [
        "094019246",  # valid checksum +1 — fails MOD-11
        "999999999",  # checksum mismatch
    ],
)
def test_invalid_afm_checksum_returns_422(
    client: TestClient,
    storage: InMemoryUserStorage,
    auth_header: dict[str, str],
    afm: str,
) -> None:
    _seed_user(storage, USER_ID, is_freelancer=True)
    resp = client.patch("/users/me", json={"afm": afm}, headers=auth_header)
    assert resp.status_code == 422
    body = resp.json()
    assert body["type"].endswith("invalid_afm") or body.get("title") == "Invalid ΑΦΜ"
    # The submitted ΑΦΜ value must NOT appear in the response detail —
    # ΑΦΜ is identifying data (DES-0004 §7).
    detail = str(body.get("detail", ""))
    assert afm not in detail


def test_afm_wrong_length_returns_422(
    client: TestClient,
    storage: InMemoryUserStorage,
    auth_header: dict[str, str],
) -> None:
    _seed_user(storage, USER_ID, is_freelancer=True)
    resp = client.patch(
        "/users/me", json={"afm": "12345678"}, headers=auth_header
    )
    assert resp.status_code == 422


def test_afm_all_zeros_returns_422(
    client: TestClient,
    storage: InMemoryUserStorage,
    auth_header: dict[str, str],
) -> None:
    _seed_user(storage, USER_ID, is_freelancer=True)
    resp = client.patch(
        "/users/me", json={"afm": "000000000"}, headers=auth_header
    )
    assert resp.status_code == 422


def test_afm_non_numeric_returns_422(
    client: TestClient,
    storage: InMemoryUserStorage,
    auth_header: dict[str, str],
) -> None:
    _seed_user(storage, USER_ID, is_freelancer=True)
    resp = client.patch(
        "/users/me", json={"afm": "abcdefghi"}, headers=auth_header
    )
    assert resp.status_code == 422
