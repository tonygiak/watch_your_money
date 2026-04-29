"""Abstract receipt-parser interface.

Every country adapter implements :class:`BaseReceiptParser`. The schema and
call sites must remain country-agnostic per ``.agents/rules/country-agnostic-schema.md``.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class ParsedReceiptItem(BaseModel):
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
    """Country-agnostic structured receipt produced by every adapter."""

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


class ParserError(Exception):
    """Raised when a parser cannot produce a valid :class:`ParsedReceipt`.

    Surfaces upstream HTML drift loudly. Per ``.agents/rules/no-ocr.md`` and
    ``.agents/rules/quality-gate.md``, parsers never silently invent fields
    or fall back to OCR.
    """


class BaseReceiptParser(ABC):
    """Interface every country adapter implements."""

    @property
    @abstractmethod
    def country_code(self) -> str:
        """ISO-3166 alpha-2 (uppercase). E.g. ``'GR'``."""

    @abstractmethod
    def can_parse(self, qr_url: str) -> bool:
        """Return True if this adapter recognises the QR URL's domain shape."""

    @abstractmethod
    def parse(self, qr_url: str) -> ParsedReceipt:
        """Fetch + parse the receipt referenced by the QR URL.

        Raises :class:`ParserError` on any failure. Never returns a partial
        receipt and never falls back to OCR.
        """
