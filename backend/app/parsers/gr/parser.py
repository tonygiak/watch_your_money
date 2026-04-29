"""Greek e-invoicing.gr receipt parser.

Validated reference logic in ``AGENTS.md`` §5.3.4 expanded to all fields in §5.3.3.
The full extraction (totals, MARK, dates, payment method) is wired in a follow-up
delivery sprint; this bootstrap implementation parses the merchant header and
the line-item table so end-to-end plumbing works against fixtures without
inventing fields we have not yet validated.
"""

from __future__ import annotations

from decimal import Decimal, InvalidOperation

import requests
from bs4 import BeautifulSoup

from app.parsers.base import (
    BaseReceiptParser,
    ParsedReceipt,
    ParsedReceiptItem,
    ParserError,
)
from app.parsers.gr.url import is_einvoicing_gr, viewer_to_api


class GrEinvoicingParser(BaseReceiptParser):
    @property
    def country_code(self) -> str:
        return "GR"

    def can_parse(self, qr_url: str) -> bool:
        return is_einvoicing_gr(qr_url)

    def parse(self, qr_url: str) -> ParsedReceipt:
        api_url = viewer_to_api(qr_url)
        try:
            response = requests.get(api_url, timeout=10)
        except requests.RequestException as exc:
            raise ParserError(f"fetch failed: {exc}") from exc

        if response.status_code != 200:
            raise ParserError(f"upstream status {response.status_code}")

        # Critical: explicit UTF-8 before reading .text — see localization-conventions.md.
        response.encoding = "utf-8"
        return self.parse_html(response.text)

    def parse_html(self, html: str) -> ParsedReceipt:
        """Parse already-fetched HTML. Used by tests against local fixtures."""
        soup = BeautifulSoup(html, "html.parser")
        merchant_el = soup.find(class_="BoldBlueHeader fontSize12pt")
        if merchant_el is None:
            raise ParserError("merchant header not found — possible upstream drift")
        merchant_name = merchant_el.get_text(strip=True)

        items: list[ParsedReceiptItem] = []
        for row in soup.select("tbody tr"):
            cells = row.find_all("td")
            if len(cells) < 9:
                continue
            items.append(
                ParsedReceiptItem(
                    ean=cells[0].get_text(strip=True),
                    description=cells[1].get_text(strip=True),
                    unit=cells[2].get_text(strip=True),
                    quantity=_to_decimal(cells[3].get_text(strip=True)),
                    unit_price=_to_decimal(cells[4].get_text(strip=True)),
                    pre_discount_value=_to_decimal(cells[5].get_text(strip=True)),
                    discount=_to_decimal(cells[6].get_text(strip=True)),
                    vat_rate=_to_decimal(cells[7].get_text(strip=True)),
                    total_value=_to_decimal(cells[8].get_text(strip=True)),
                )
            )

        if not items:
            raise ParserError("no line items parsed — possible upstream drift")

        return ParsedReceipt(
            country_code="GR",
            merchant_name=merchant_name,
            items=items,
            raw_html=html,
        )


def _to_decimal(text: str) -> Decimal:
    """Greek receipts use comma as decimal separator and may include a `%` for VAT."""
    if not text:
        return Decimal("0")
    cleaned = text.replace("\xa0", " ").strip().rstrip("%").replace(".", "").replace(",", ".")
    if not cleaned:
        return Decimal("0")
    try:
        return Decimal(cleaned)
    except InvalidOperation:
        return Decimal("0")
