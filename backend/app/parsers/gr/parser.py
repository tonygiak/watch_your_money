"""Greek ``e-invoicing.gr`` receipt parser.

Implements the full ``AGENTS.md`` §5.3.3 extraction behind the ADR-0001
contract. The merchant header is found via the
``BoldBlueHeader fontSize12pt`` class (validated reference in §5.3.4).
Every other field is extracted via a **label-driven** scan of two-cell
``<tr>`` rows so that variations in table classes / nesting on real
``e-invoicing.gr`` HTML do not break parsing.

Money fields are parsed locale-aware (Greek convention: comma decimal,
period thousands). VAT-rate is stored as the **percent number** per
ADR-0001 §3 (``'24%'`` → ``Decimal('24')``).
"""

from __future__ import annotations

import re
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any

import requests
from bs4 import BeautifulSoup, Tag

from app.parsers.base import (
    BaseReceiptParser,
    EmptyReceiptError,
    ParsedReceipt,
    ParsedReceiptItem,
    ParserDriftError,
    ParserFetchError,
    ParserUpstreamError,
)
from app.parsers.gr.url import is_einvoicing_gr, viewer_to_api

_HTTP_TIMEOUT_SECONDS = 10
_USER_AGENT = "idi8-backend/0.1 (+https://github.com/)"

# ---------------------------------------------------------------------------
# Label catalogue (Greek e-invoicing.gr receipts).
#
# Labels are matched after stripping NBSPs, trailing colons, and surrounding
# whitespace (see ``_normalize_label``). The catalogue is intentionally
# conservative: each entry maps a printed label to a single field on
# ``ParsedReceipt``. Unknown labels are ignored — we never invent fields
# (`.agents/rules/no-ocr.md`).
# ---------------------------------------------------------------------------

_MERCHANT_LABELS: dict[str, str] = {
    "ΑΦΜ": "merchant_afm",
    "ΑΦΜ Εκδότη": "merchant_afm",
    "Διεύθυνση": "merchant_address",
    "Έδρα": "merchant_address",
}

_DOU_LABELS: set[str] = {"ΔΟΥ", "Δ.Ο.Υ.", "ΔΟΥ Εκδότη"}

_METADATA_LABELS: dict[str, str] = {
    "Αρ. Παραστατικού": "document_number",
    "Αριθμός Παραστατικού": "document_number",
    "Ημ/νία έκδοσης": "issue_date",
    "Ημερομηνία έκδοσης": "issue_date",
    "MARK": "mark",
    "UID": "uid",
    "Authentication code": "authentication_code",
    "Κωδικός Αυθεντικοποίησης": "authentication_code",
    "Πάροχος": "provider",
    "Ημ/νία διαβίβασης": "transmission_timestamp",
    "Ημερομηνία διαβίβασης": "transmission_timestamp",
}

_TOTAL_LABELS: dict[str, str] = {
    "Προ έκπτωσης": "subtotal",
    "Αξία προ έκπτωσης": "subtotal",
    "Έκπτωση": "discount",
    "Επιβάρυνση": "surcharge",
    "ΤΕΛΙΚΗ ΑΞΙΑ": "total",
    "Σύνολο": "total",
    "Καθαρή αξία": "net_value",
    "ΦΠΑ": "vat_total",
    "Σύνολο ΦΠΑ": "vat_total",
    "Τρόπος Πληρωμής": "payment_method",
}


class GrEinvoicingParser(BaseReceiptParser):
    @property
    def country_code(self) -> str:
        return "GR"

    def can_parse(self, qr_url: str) -> bool:
        return is_einvoicing_gr(qr_url)

    def parse(self, qr_url: str) -> ParsedReceipt:
        # Origin check before any network call (ADR-0001 §1, agent-runtime-security.md §1).
        api_url = viewer_to_api(qr_url)

        try:
            response = requests.get(
                api_url,
                timeout=_HTTP_TIMEOUT_SECONDS,
                headers={"User-Agent": _USER_AGENT},
            )
        except requests.RequestException as exc:
            raise ParserFetchError(f"fetch failed: {exc.__class__.__name__}") from exc

        if response.status_code != 200:
            raise ParserUpstreamError(response.status_code)

        # Critical: explicit UTF-8 before reading .text — see localization-conventions.md.
        response.encoding = "utf-8"
        return self.parse_html(response.text)

    def parse_html(self, html: str) -> ParsedReceipt:
        """Parse already-fetched HTML. Used by tests against local fixtures."""
        soup = BeautifulSoup(html, "html.parser")

        merchant_name = _extract_merchant_name(soup)
        labelled = _scan_labelled_rows(soup)
        items = _extract_line_items(soup)

        if not items:
            raise EmptyReceiptError("no line items parsed — possible upstream drift")

        merchant_address = _join_address_and_dou(labelled)
        receipt_kwargs: dict[str, Any] = {
            "country_code": "GR",
            "merchant_name": merchant_name,
            "merchant_afm": labelled.get("merchant_afm", ""),
            "merchant_address": merchant_address,
            "document_number": labelled.get("document_number", ""),
            "mark": labelled.get("mark", ""),
            "uid": labelled.get("uid", ""),
            "authentication_code": labelled.get("authentication_code", ""),
            "provider": labelled.get("provider", ""),
            "payment_method": labelled.get("payment_method", ""),
            "issue_date": _parse_gr_date(labelled.get("issue_date")),
            "transmission_timestamp": _parse_gr_datetime(
                labelled.get("transmission_timestamp")
            ),
            "subtotal": _to_decimal(labelled.get("subtotal")),
            "discount": _to_decimal(labelled.get("discount")),
            "surcharge": _to_decimal(labelled.get("surcharge")),
            "total": _to_decimal(labelled.get("total")),
            "net_value": _to_decimal(labelled.get("net_value")),
            "vat_total": _to_decimal(labelled.get("vat_total")),
            "items": items,
            "raw_html": html,
        }
        return ParsedReceipt(**receipt_kwargs)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _extract_merchant_name(soup: BeautifulSoup) -> str:
    """Locate the merchant header by class. Drift if missing."""
    header = soup.find(class_="BoldBlueHeader fontSize12pt")
    if header is None:
        raise ParserDriftError(
            "merchant header (BoldBlueHeader fontSize12pt) not found"
        )
    return header.get_text(strip=True)


def _scan_labelled_rows(soup: BeautifulSoup) -> dict[str, str]:
    """Walk every two-cell ``<tr>`` and bind known labels to values.

    Two-cell rows are how Greek receipts express label/value pairs (header,
    metadata, totals, payment method). Nine-cell rows are line items and are
    skipped here (handled by :func:`_extract_line_items`).
    """
    bound: dict[str, str] = {}
    dou_value: str = ""
    for row in soup.find_all("tr"):
        if not isinstance(row, Tag):
            continue
        cells = row.find_all("td")
        if len(cells) != 2:
            continue
        label = _normalize_label(cells[0].get_text())
        value = cells[1].get_text(strip=True)
        if not label:
            continue
        if label in _DOU_LABELS:
            dou_value = value
            continue
        field = (
            _MERCHANT_LABELS.get(label)
            or _METADATA_LABELS.get(label)
            or _TOTAL_LABELS.get(label)
        )
        if field is not None and field not in bound:
            # First match wins — receipts sometimes echo a label in a footer.
            bound[field] = value
    if dou_value:
        bound["_dou"] = dou_value
    return bound


def _join_address_and_dou(labelled: dict[str, str]) -> str:
    """The schema lacks a dedicated ``merchant_dou`` field, so we attach the
    ΔΟΥ to ``merchant_address`` for losslessness. Documented in PLN risks.
    """
    address = labelled.get("merchant_address", "")
    dou = labelled.pop("_dou", "")
    if not dou:
        return address
    if not address:
        return f"ΔΟΥ {dou}"
    return f"{address} — ΔΟΥ {dou}"


def _extract_line_items(soup: BeautifulSoup) -> list[ParsedReceiptItem]:
    """Walk ``tbody tr`` rows. A row is real only if it has 9 cells."""
    items: list[ParsedReceiptItem] = []
    for row in soup.select("tbody tr"):
        if not isinstance(row, Tag):
            continue
        cells = row.find_all("td")
        if len(cells) != 9:
            continue
        description = cells[1].get_text(strip=True)
        if not description:
            # Line items must have at least a description; skip empty rows.
            continue
        items.append(
            ParsedReceiptItem(
                ean=cells[0].get_text(strip=True),
                description=description,
                unit=cells[2].get_text(strip=True),
                quantity=_to_decimal(cells[3].get_text()),
                unit_price=_to_decimal(cells[4].get_text()),
                pre_discount_value=_to_decimal(cells[5].get_text()),
                discount=_to_decimal(cells[6].get_text()),
                vat_rate=_to_decimal(cells[7].get_text()),
                total_value=_to_decimal(cells[8].get_text()),
            )
        )
    return items


_LABEL_TRIM = re.compile(r"[\s:：]+$")


def _normalize_label(text: str) -> str:
    """Strip NBSPs and trailing colons / whitespace from a label cell."""
    cleaned = (text or "").replace("\xa0", " ").strip()
    return _LABEL_TRIM.sub("", cleaned)


def _to_decimal(text: str | None) -> Decimal:
    """Greek locale → ``Decimal``.

    Strips ``%`` (VAT rates), NBSPs, spaces, currency symbols, and converts
    the Greek decimal/thousand separators to canonical form (comma → period
    decimal, period → removed thousands).
    """
    if text is None:
        return Decimal("0")
    cleaned = (
        text.replace("\xa0", "")
        .replace("€", "")
        .replace(" ", "")
        .strip()
        .rstrip("%")
    )
    if not cleaned:
        return Decimal("0")
    cleaned = cleaned.replace(".", "").replace(",", ".")
    try:
        value = Decimal(cleaned)
    except InvalidOperation:
        # Locale parse failure on a money / number cell — surface as drift.
        raise ParserDriftError(f"could not parse decimal from {text!r}") from None
    if not value.is_finite():
        # Decimal accepts 'NaN', 'Infinity', etc. Receipts never carry these.
        raise ParserDriftError(f"non-finite decimal from {text!r}")
    return value


def _parse_gr_date(text: str | None) -> date | None:
    """Greek receipts print dates as ``DD/MM/YYYY`` (sometimes ``DD-MM-YYYY``)."""
    if not text:
        return None
    candidates = (text.strip(), text.strip().replace("-", "/"))
    for candidate in candidates:
        for fmt in ("%d/%m/%Y", "%d/%m/%y"):
            try:
                return datetime.strptime(candidate, fmt).date()
            except ValueError:
                continue
    raise ParserDriftError(f"could not parse Greek date from {text!r}")


def _parse_gr_datetime(text: str | None) -> datetime | None:
    """Greek receipts print transmission timestamps as ``DD/MM/YYYY HH:MM:SS``."""
    if not text:
        return None
    candidate = text.strip().replace("-", "/")
    for fmt in (
        "%d/%m/%Y %H:%M:%S",
        "%d/%m/%Y %H:%M",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d %H:%M:%S",
    ):
        try:
            return datetime.strptime(candidate, fmt)
        except ValueError:
            continue
    raise ParserDriftError(f"could not parse Greek datetime from {text!r}")
