"""URL conversion tests for the GR adapter (no network calls)."""

from __future__ import annotations

import pytest

from app.parsers.base import UnsupportedQrUrl
from app.parsers.gr.url import is_einvoicing_gr, viewer_to_api


def test_origin_check_accepts_einvoicing_gr() -> None:
    assert is_einvoicing_gr(
        "https://e-invoicing.gr/edocuments/ViewInvoice/-1/abc_token"
    )


def test_origin_check_rejects_other_domains() -> None:
    assert not is_einvoicing_gr("https://attacker.example/edocuments/ViewInvoice/-1/x_y")
    assert not is_einvoicing_gr("http://e-invoicing.gr/edocuments/ViewInvoice/-1/x_y")


def test_viewer_to_api_extracts_uuid_and_token() -> None:
    qr = (
        "https://e-invoicing.gr/edocuments/ViewInvoice/-1/"
        "11111111-2222-3333-4444-555555555555_TOKENABC"
    )
    api = viewer_to_api(qr)
    assert "intRefDocID=11111111-2222-3333-4444-555555555555" in api
    assert "hashToken=TOKENABC" in api
    assert api.startswith("https://e-invoicing.gr/api/GetInvoice")


def test_viewer_to_api_rejects_non_einvoicing_gr() -> None:
    with pytest.raises(UnsupportedQrUrl):
        viewer_to_api("https://other.example/edocuments/ViewInvoice/-1/x_y")


def test_viewer_to_api_rejects_unknown_path_shape() -> None:
    with pytest.raises(UnsupportedQrUrl):
        viewer_to_api("https://e-invoicing.gr/some/other/path")
