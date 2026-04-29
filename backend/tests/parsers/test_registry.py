"""Registry resolves QR URLs to the right country adapter."""

from __future__ import annotations

import pytest

from app.parsers.base import ParserError
from app.parsers.registry import all_parsers, find_parser


def test_registry_includes_gr() -> None:
    parsers = all_parsers()
    countries = {p.country_code for p in parsers}
    assert "GR" in countries


def test_registry_resolves_einvoicing_gr() -> None:
    parser = find_parser(
        "https://e-invoicing.gr/edocuments/ViewInvoice/-1/abc-uuid_token"
    )
    assert parser.country_code == "GR"


def test_registry_rejects_unknown_origin() -> None:
    with pytest.raises(ParserError):
        find_parser("https://some-other-portal.example/whatever")
