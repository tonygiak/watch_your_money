"""Fixture-driven GR parser tests (network-free, ADR-0001 §1, §5.8.1).

Walks every triplet under ``tests/fixtures/receipts/gr/<id>/``, parses
``raw.html`` through ``parse_html`` and asserts every ``AGENTS.md`` §5.3.3
field against ``expected.json`` at 100% accuracy.

A red test here is a `drift` backlog item per `.agents/rules/quality-gate.md`
— never weakened to make it green.
"""

from __future__ import annotations

import json
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

import pytest

from app.parsers.gr.parser import GrEinvoicingParser

FIXTURES_ROOT = Path(__file__).resolve().parents[1] / "fixtures" / "receipts" / "gr"


def _discover_fixtures() -> list[Path]:
    if not FIXTURES_ROOT.is_dir():
        return []
    return sorted(p for p in FIXTURES_ROOT.iterdir() if p.is_dir())


_FIXTURE_DIRS = _discover_fixtures()


@pytest.mark.parametrize(
    "fixture_dir",
    _FIXTURE_DIRS,
    ids=[p.name for p in _FIXTURE_DIRS] or ["no-fixtures-yet"],
)
def test_fixture_parses_to_expected_json(fixture_dir: Path) -> None:
    if not _FIXTURE_DIRS:
        pytest.skip("No fixtures committed yet — see BLG-0004.")

    raw_html = (fixture_dir / "raw.html").read_text(encoding="utf-8")
    expected = json.loads((fixture_dir / "expected.json").read_text(encoding="utf-8"))

    parser = GrEinvoicingParser()
    receipt = parser.parse_html(raw_html)

    # Every §5.3.3 field is asserted explicitly so a regression is loud.
    assert receipt.country_code == expected["country_code"]
    assert receipt.merchant_name == expected["merchant_name"]
    assert receipt.merchant_afm == expected["merchant_afm"]
    assert receipt.merchant_address == expected["merchant_address"]
    assert receipt.document_number == expected["document_number"]
    assert receipt.mark == expected["mark"]
    assert receipt.uid == expected["uid"]
    assert receipt.authentication_code == expected["authentication_code"]
    assert receipt.provider == expected["provider"]
    assert receipt.payment_method == expected["payment_method"]
    assert receipt.issue_date == _parse_iso_date(expected["issue_date"])
    assert receipt.transmission_timestamp == _parse_iso_datetime(
        expected["transmission_timestamp"]
    )

    for field in ("subtotal", "discount", "surcharge", "total", "net_value", "vat_total"):
        assert getattr(receipt, field) == Decimal(expected[field]), (
            f"{fixture_dir.name}: {field} differs"
        )

    expected_items = expected["items"]
    assert len(receipt.items) == len(expected_items), (
        f"{fixture_dir.name}: line item count differs"
    )
    for got, want in zip(receipt.items, expected_items, strict=True):
        assert got.ean == want["ean"]
        assert got.description == want["description"]
        assert got.unit == want["unit"]
        for f in (
            "quantity",
            "unit_price",
            "pre_discount_value",
            "discount",
            "vat_rate",
            "total_value",
        ):
            assert getattr(got, f) == Decimal(want[f]), (
                f"{fixture_dir.name} item EAN={want['ean']}: {f} differs"
            )

    # Drift safety net: parser must carry the raw HTML through verbatim.
    assert receipt.raw_html == raw_html


def _parse_iso_date(text: str | None) -> date | None:
    if text is None:
        return None
    return date.fromisoformat(text)


def _parse_iso_datetime(text: str | None) -> datetime | None:
    if text is None:
        return None
    return datetime.fromisoformat(text)
