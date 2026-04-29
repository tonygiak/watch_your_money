"""Contract tests for ``POST /receipts/parse`` (BLG-0002 acceptance / ADR-0002).

Asserts every bullet in BLG-0002 acceptance:

- (a) missing Bearer = 401.
- (b) invalid Bearer = 401.
- (c) valid Bearer + valid Greek QR = 201 + body shape + Location header.
- (d) re-scan = 200 + ``is_duplicate=true`` + same ``id``.
- (e) non-Greek QR = 422 with ``type: "unsupported_url"``.
- (f) parser drift = 503 with ``type: "parser_drift"``.
- (g) ``qr_url`` and ``raw_html`` are NEVER returned in error responses.

Network-free: the parser is monkeypatched to return a known
:class:`ParsedReceipt` (or raise) so the test never hits ``e-invoicing.gr``.
The storage layer is the in-memory fake from
:mod:`app.storage.receipts`.
"""

from __future__ import annotations

import json
from collections.abc import Generator
from decimal import Decimal
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.auth import make_supabase_jwt_for_test
from app.main import app
from app.parsers.base import (
    EmptyReceiptError,
    ParsedReceipt,
    ParserDriftError,
    ParserUpstreamError,
)
from app.parsers.gr.parser import GrEinvoicingParser
from app.routes.receipts import get_jwt_secret, get_storage
from app.storage.receipts import InMemoryReceiptStorage

JWT_SECRET = "test-secret-not-real"
USER_ID = "00000000-0000-0000-0000-000000000001"
GR_QR = (
    "https://e-invoicing.gr/edocuments/ViewInvoice/-1/"
    "11111111-2222-3333-4444-555555555555_TOKENABC"
)


@pytest.fixture
def storage() -> InMemoryReceiptStorage:
    return InMemoryReceiptStorage()


@pytest.fixture
def fixture_receipt() -> ParsedReceipt:
    """Load the gr-001 fixture once and shape it as a ParsedReceipt."""
    raw_html = (
        Path(__file__).resolve().parents[1]
        / "fixtures"
        / "receipts"
        / "gr"
        / "gr-001-supermarket"
        / "raw.html"
    ).read_text(encoding="utf-8")
    return GrEinvoicingParser().parse_html(raw_html)


@pytest.fixture
def client(
    storage: InMemoryReceiptStorage, monkeypatch: pytest.MonkeyPatch
) -> Generator[TestClient, None, None]:
    app.dependency_overrides[get_storage] = lambda: storage
    app.dependency_overrides[get_jwt_secret] = lambda: JWT_SECRET
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def auth_header() -> dict[str, str]:
    token = make_supabase_jwt_for_test(USER_ID, JWT_SECRET)
    return {"Authorization": f"Bearer {token}"}


def _patch_parser(monkeypatch: pytest.MonkeyPatch, behaviour: Any) -> None:
    """Replace ``GrEinvoicingParser.parse`` with ``behaviour`` (a callable
    or a value to return)."""

    if callable(behaviour):
        monkeypatch.setattr(
            "app.parsers.gr.parser.GrEinvoicingParser.parse",
            lambda self, qr_url: behaviour(qr_url),
        )
    else:
        monkeypatch.setattr(
            "app.parsers.gr.parser.GrEinvoicingParser.parse",
            lambda self, qr_url: behaviour,
        )


# ---------------------------------------------------------------------------
# (a) + (b) — auth gate
# ---------------------------------------------------------------------------


def test_missing_bearer_returns_401(client: TestClient) -> None:
    resp = client.post("/receipts/parse", json={"qr_url": GR_QR})
    assert resp.status_code == 401
    body = resp.json()
    assert body["type"] == "unauthenticated"
    assert body["status"] == 401
    assert "trace_id" in body


def test_invalid_bearer_returns_401(client: TestClient) -> None:
    resp = client.post(
        "/receipts/parse",
        json={"qr_url": GR_QR},
        headers={"Authorization": "Bearer not-a-real-jwt"},
    )
    assert resp.status_code == 401
    body = resp.json()
    assert body["type"] == "unauthenticated"


def test_wrong_secret_returns_401(client: TestClient) -> None:
    bad_token = make_supabase_jwt_for_test(USER_ID, "different-secret")
    resp = client.post(
        "/receipts/parse",
        json={"qr_url": GR_QR},
        headers={"Authorization": f"Bearer {bad_token}"},
    )
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# (c) + (d) — happy path + idempotency
# ---------------------------------------------------------------------------


def test_valid_request_returns_201_with_body_and_location(
    client: TestClient,
    auth_header: dict[str, str],
    fixture_receipt: ParsedReceipt,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _patch_parser(monkeypatch, fixture_receipt)

    resp = client.post(
        "/receipts/parse", json={"qr_url": GR_QR}, headers=auth_header
    )
    assert resp.status_code == 201, resp.text
    assert resp.headers["Location"].startswith("/receipts/")
    body = resp.json()

    assert body["is_duplicate"] is False
    receipt = body["receipt"]
    assert receipt["country_code"] == "GR"
    assert receipt["merchant_name"] == "ΠΑΡΑΔΕΙΓΜΑ ΣΟΥΠΕΡ ΜΑΡΚΕΤ ΑΕ"
    assert receipt["mark"] == "400000123456789"
    assert len(receipt["items"]) == 3
    # Money fields round-trip as strings (Decimal → JSON).
    assert Decimal(receipt["total"]) == Decimal("10.40")


def test_rescan_returns_200_with_is_duplicate_and_same_id(
    client: TestClient,
    auth_header: dict[str, str],
    fixture_receipt: ParsedReceipt,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _patch_parser(monkeypatch, fixture_receipt)

    first = client.post(
        "/receipts/parse", json={"qr_url": GR_QR}, headers=auth_header
    )
    assert first.status_code == 201
    first_id = first.json()["receipt"]["id"]

    second = client.post(
        "/receipts/parse", json={"qr_url": GR_QR}, headers=auth_header
    )
    assert second.status_code == 200
    body = second.json()
    assert body["is_duplicate"] is True
    assert body["receipt"]["id"] == first_id
    assert second.headers["Location"] == f"/receipts/{first_id}"


# ---------------------------------------------------------------------------
# (e) — unsupported URL
# ---------------------------------------------------------------------------


def test_non_greek_url_returns_422_unsupported_url(
    client: TestClient, auth_header: dict[str, str]
) -> None:
    resp = client.post(
        "/receipts/parse",
        json={"qr_url": "https://attacker.example/something"},
        headers=auth_header,
    )
    assert resp.status_code == 422
    body = resp.json()
    assert body["type"] == "unsupported_url"
    assert body["status"] == 422


def test_empty_receipt_returns_422_unsupported_url(
    client: TestClient,
    auth_header: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def boom(qr_url: str) -> ParsedReceipt:
        raise EmptyReceiptError("no items")

    _patch_parser(monkeypatch, boom)

    resp = client.post(
        "/receipts/parse", json={"qr_url": GR_QR}, headers=auth_header
    )
    assert resp.status_code == 422
    assert resp.json()["type"] == "unsupported_url"


# ---------------------------------------------------------------------------
# (f) — parser drift
# ---------------------------------------------------------------------------


def test_parser_drift_returns_503(
    client: TestClient,
    auth_header: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def drift(qr_url: str) -> ParsedReceipt:
        raise ParserDriftError("merchant header missing")

    _patch_parser(monkeypatch, drift)
    resp = client.post(
        "/receipts/parse", json={"qr_url": GR_QR}, headers=auth_header
    )
    assert resp.status_code == 503
    body = resp.json()
    assert body["type"] == "parser_drift"
    assert body["status"] == 503


def test_upstream_error_returns_502(
    client: TestClient,
    auth_header: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def upstream(qr_url: str) -> ParsedReceipt:
        raise ParserUpstreamError(503, "upstream down")

    _patch_parser(monkeypatch, upstream)
    resp = client.post(
        "/receipts/parse", json={"qr_url": GR_QR}, headers=auth_header
    )
    assert resp.status_code == 502
    assert resp.json()["type"] == "upstream_error"


# ---------------------------------------------------------------------------
# (g) — error responses never carry sensitive input
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "qr_url",
    [
        "https://attacker.example/secret-token-XYZ",
        GR_QR,
    ],
)
def test_error_responses_never_echo_full_url_or_raw_html(
    client: TestClient,
    auth_header: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
    qr_url: str,
) -> None:
    """ADR-0002 §6: response must NEVER carry the full QR URL (path + token)
    or raw HTML. The URL **host** alone is acceptable in the detail message
    so users can see "e-invoicing.gr only".
    """

    def drift(_: str) -> ParsedReceipt:
        raise ParserDriftError(
            "merchant header missing — DO_NOT_LEAK_TOKEN_VALUE_XYZ"
        )

    _patch_parser(monkeypatch, drift)

    resp = client.post(
        "/receipts/parse", json={"qr_url": qr_url}, headers=auth_header
    )
    assert resp.status_code in (422, 503)
    body_text = json.dumps(resp.json())
    assert "DO_NOT_LEAK_TOKEN_VALUE_XYZ" not in body_text
    assert "raw_html" not in body_text
    # Full-URL leakage check: the path / token segment must not be echoed.
    assert "secret-token-XYZ" not in body_text
    assert "TOKENABC" not in body_text


# ---------------------------------------------------------------------------
# Body validation
# ---------------------------------------------------------------------------


def test_missing_qr_url_returns_400(
    client: TestClient, auth_header: dict[str, str]
) -> None:
    resp = client.post("/receipts/parse", json={}, headers=auth_header)
    assert resp.status_code == 400
    assert resp.json()["type"] == "invalid_request"


def test_extra_field_user_id_in_body_is_rejected(
    client: TestClient, auth_header: dict[str, str]
) -> None:
    """ADR-0002 §2: client must NOT supply ``user_id`` in the body."""
    resp = client.post(
        "/receipts/parse",
        json={"qr_url": GR_QR, "user_id": "not-allowed"},
        headers=auth_header,
    )
    assert resp.status_code == 400
    assert resp.json()["type"] == "invalid_request"
