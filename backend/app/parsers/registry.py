"""Adapter registry. Resolves a QR URL to the right country adapter."""

from __future__ import annotations

from app.parsers.base import BaseReceiptParser, ParserError
from app.parsers.gr.parser import GrEinvoicingParser

_REGISTERED: list[BaseReceiptParser] = [
    GrEinvoicingParser(),
]


def find_parser(qr_url: str) -> BaseReceiptParser:
    """Return the first adapter that recognises ``qr_url``.

    Raises :class:`ParserError` if no adapter claims the URL — which is the
    correct behaviour: we never invent a fallback.
    """
    for parser in _REGISTERED:
        if parser.can_parse(qr_url):
            return parser
    raise ParserError(f"no parser registered for url: {qr_url[:80]}")


def all_parsers() -> list[BaseReceiptParser]:
    return list(_REGISTERED)
