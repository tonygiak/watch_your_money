"""GR parser unit tests: error taxonomy + drift + line-item shape.

Network-free. Each test pins the bootstrap behaviour against an in-memory
HTML snippet. Fixture-driven full-field tests live in `test_gr_fixtures.py`.
"""

from __future__ import annotations

from decimal import Decimal

import pytest

from app.parsers.base import (
    EmptyReceiptError,
    ParserDriftError,
    UnsupportedQrUrl,
)
from app.parsers.gr.parser import GrEinvoicingParser

_MIN_HTML = """\
<html>
  <body>
    <div class="BoldBlueHeader fontSize12pt">ΣΟΥΠΕΡ ΜΑΡΚΕΤ ΑΕ</div>
    <table>
      <tbody>
        <tr>
          <td>5201234567890</td>
          <td>Γάλα φρέσκο 1L</td>
          <td>τεμ.</td>
          <td>2</td>
          <td>1,50</td>
          <td>3,00</td>
          <td>0,00</td>
          <td>13%</td>
          <td>3,00</td>
        </tr>
      </tbody>
    </table>
  </body>
</html>
"""


def test_parses_minimal_receipt() -> None:
    parser = GrEinvoicingParser()
    receipt = parser.parse_html(_MIN_HTML)

    assert receipt.country_code == "GR"
    assert receipt.merchant_name == "ΣΟΥΠΕΡ ΜΑΡΚΕΤ ΑΕ"
    assert len(receipt.items) == 1
    item = receipt.items[0]
    assert item.ean == "5201234567890"
    assert item.description == "Γάλα φρέσκο 1L"
    assert item.unit == "τεμ."
    assert item.quantity == Decimal("2")
    assert item.unit_price == Decimal("1.50")
    assert item.vat_rate == Decimal("13")
    assert item.total_value == Decimal("3.00")


def test_can_parse_only_einvoicing_gr() -> None:
    parser = GrEinvoicingParser()
    assert parser.can_parse("https://e-invoicing.gr/edocuments/ViewInvoice/-1/x_y")
    assert not parser.can_parse("https://other.example/edocuments/ViewInvoice/-1/x_y")


def test_drift_when_merchant_header_missing() -> None:
    parser = GrEinvoicingParser()
    with pytest.raises(ParserDriftError):
        parser.parse_html("<html><body>nothing useful</body></html>")


def test_empty_receipt_when_no_line_items() -> None:
    parser = GrEinvoicingParser()
    html = (
        '<html><body><div class="BoldBlueHeader fontSize12pt">ΑΕ</div>'
        "<table><tbody></tbody></table></body></html>"
    )
    with pytest.raises(EmptyReceiptError):
        parser.parse_html(html)


def test_unsupported_url_subclass_visible() -> None:
    """`UnsupportedQrUrl` is the public subclass for the API → 422 mapping."""
    parser = GrEinvoicingParser()
    with pytest.raises(UnsupportedQrUrl):
        parser.parse("https://attacker.example/edocuments/ViewInvoice/-1/x_y")


def test_drift_on_unparseable_decimal_in_line_item() -> None:
    parser = GrEinvoicingParser()
    html = (
        '<html><body><div class="BoldBlueHeader fontSize12pt">ΑΕ</div>'
        "<table><tbody><tr>"
        "<td>EAN</td><td>desc</td><td>τεμ.</td><td>NaN</td>"
        "<td>1</td><td>1</td><td>0</td><td>0%</td><td>1</td>"
        "</tr></tbody></table></body></html>"
    )
    with pytest.raises(ParserDriftError):
        parser.parse_html(html)
