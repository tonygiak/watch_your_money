"""GR parser tests against an in-memory HTML fixture (no network calls).

A real fixture set is queued as ``BLG-0004`` for the next discovery sprint;
this test pins the bootstrap behaviour against a synthetic but
shape-accurate HTML snippet.
"""

from __future__ import annotations

from decimal import Decimal

import pytest

from app.parsers.base import ParserError
from app.parsers.gr.parser import GrEinvoicingParser

_HTML_SAMPLE = """\
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
        <tr>
          <td>5209876543210</td>
          <td>Ψωμί ολικής 500g</td>
          <td>τεμ.</td>
          <td>1</td>
          <td>2,40</td>
          <td>2,40</td>
          <td>0,00</td>
          <td>13%</td>
          <td>2,40</td>
        </tr>
      </tbody>
    </table>
  </body>
</html>
"""


def test_parses_merchant_and_items() -> None:
    parser = GrEinvoicingParser()
    receipt = parser.parse_html(_HTML_SAMPLE)

    assert receipt.country_code == "GR"
    assert receipt.merchant_name == "ΣΟΥΠΕΡ ΜΑΡΚΕΤ ΑΕ"
    assert len(receipt.items) == 2

    first = receipt.items[0]
    assert first.ean == "5201234567890"
    assert first.description == "Γάλα φρέσκο 1L"
    assert first.unit == "τεμ."
    assert first.quantity == Decimal("2")
    assert first.unit_price == Decimal("1.50")
    assert first.vat_rate == Decimal("13")
    assert first.total_value == Decimal("3.00")


def test_can_parse_only_einvoicing_gr() -> None:
    parser = GrEinvoicingParser()
    assert parser.can_parse("https://e-invoicing.gr/edocuments/ViewInvoice/-1/x_y")
    assert not parser.can_parse("https://other.example/edocuments/ViewInvoice/-1/x_y")


def test_raises_when_merchant_header_missing() -> None:
    parser = GrEinvoicingParser()
    with pytest.raises(ParserError):
        parser.parse_html("<html><body>nothing useful</body></html>")


def test_raises_when_no_line_items() -> None:
    parser = GrEinvoicingParser()
    html = (
        '<html><body><div class="BoldBlueHeader fontSize12pt">ΑΕ</div>'
        "<table><tbody></tbody></table></body></html>"
    )
    with pytest.raises(ParserError):
        parser.parse_html(html)
