"""Abstract receipt-parser interface and the country-agnostic ``ParsedReceipt`` schema.

Every country adapter implements :class:`BaseReceiptParser`. The schema and call
sites must remain country-agnostic per ``.agents/rules/country-agnostic-schema.md``
and the parent contract in ``docs/adr/S-001-ADR-0001-Parser-interface.md``.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class ParsedReceiptItem(BaseModel):
    """One line item on a receipt. Money fields default to ``Decimal('0')`` —
    never ``None`` — so totals math has no null-checks downstream
    (ADR-0001 §2)."""

    model_config = ConfigDict(frozen=True)

    ean: str = ""
    description: str
    unit: str = ""
    quantity: Decimal = Decimal("0")
    unit_price: Decimal = Decimal("0")
    pre_discount_value: Decimal = Decimal("0")
    discount: Decimal = Decimal("0")
    vat_rate: Decimal = Decimal("0")
    total_value: Decimal = Decimal("0")


class ParsedReceipt(BaseModel):
    """Country-agnostic structured receipt produced by every adapter.

    Schema is the source of truth for ``AGENTS.md`` §5.3.3 fields.
    ``vat_rate`` on items and ``vat_total`` on the receipt are independent:
    items carry a **percent number** (``Decimal('24')`` for 24%, per
    ADR-0001 §3); ``vat_total`` is money in EUR.
    """

    model_config = ConfigDict(frozen=True)

    country_code: str = Field(min_length=2, max_length=2)
    merchant_name: str
    merchant_afm: str = ""
    merchant_address: str = ""
    document_number: str = ""
    mark: str = ""
    uid: str = ""
    authentication_code: str = ""
    issue_date: date | None = None
    transmission_timestamp: datetime | None = None
    payment_method: str = ""
    subtotal: Decimal = Decimal("0")
    discount: Decimal = Decimal("0")
    surcharge: Decimal = Decimal("0")
    total: Decimal = Decimal("0")
    net_value: Decimal = Decimal("0")
    vat_total: Decimal = Decimal("0")
    provider: str = ""
    items: list[ParsedReceiptItem] = []
    raw_html: str = ""


# ---------------------------------------------------------------------------
# Error taxonomy (ADR-0001 §4)
#
# All parser errors derive from :class:`ParserError`. Adapters MUST raise the
# specific subclass — generic ``ParserError`` is reserved for "I don't have a
# more specific code yet" and is avoided in adapter code.
# ---------------------------------------------------------------------------


class ParserError(Exception):
    """Base class for every parser failure.

    The ``code`` attribute is the stable identifier used by the API error
    envelope (ADR-0002 §4) and by mobile telemetry (DES-0001).
    """

    code: str = "parser_error"


class UnsupportedQrUrl(ParserError):
    """No adapter recognises the QR URL, or the URL fails an adapter's
    domain check."""

    code = "unsupported_url"


class ParserFetchError(ParserError):
    """The HTTP request itself failed (DNS, TLS, timeout, connection reset)."""

    code = "fetch_failed"


class ParserUpstreamError(ParserError):
    """The upstream HTTP response had a non-2xx status."""

    code = "upstream_status"

    def __init__(self, status_code: int, message: str | None = None) -> None:
        super().__init__(message or f"upstream status {status_code}")
        self.status_code = status_code


class ParserDriftError(ParserError):
    """The HTML structure no longer matches expected selectors / labels.

    Surfaces upstream HTML drift loudly. Per ``.agents/rules/no-ocr.md`` and
    ``.agents/rules/quality-gate.md``, parsers never silently invent fields
    or fall back to OCR.
    """

    code = "drift"


class EmptyReceiptError(ParserError):
    """Parsing succeeded but produced zero line items."""

    code = "empty_receipt"


class BaseReceiptParser(ABC):
    """Interface every country adapter implements (ADR-0001 §1)."""

    @property
    @abstractmethod
    def country_code(self) -> str:
        """ISO-3166 alpha-2 (uppercase). E.g. ``'GR'``."""

    @abstractmethod
    def can_parse(self, qr_url: str) -> bool:
        """Return True if this adapter recognises the QR URL's domain shape.

        MUST be a pure check — no network access.
        """

    @abstractmethod
    def parse(self, qr_url: str) -> ParsedReceipt:
        """Fetch + parse the receipt referenced by the QR URL.

        - MUST validate the origin **before** the HTTP call.
        - MUST set ``response.encoding = 'utf-8'`` before reading ``.text``.
        - MUST raise the most specific :class:`ParserError` subclass on failure.
        - MUST NOT fall back to OCR (`.agents/rules/no-ocr.md`).
        """

    @abstractmethod
    def parse_html(self, html: str) -> ParsedReceipt:
        """Parse already-fetched HTML.

        Pure-bytes path — no network access. Used by fixture-driven tests so
        the test suite never touches the network (ADR-0001 §1, §5.8.1).
        """
