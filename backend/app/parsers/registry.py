"""Adapter registry. Resolves a QR URL to the right country adapter.

Per ADR-0001 §5: deterministic — first match wins, no fallback adapter.
"""

from __future__ import annotations

from app.parsers.base import BaseReceiptParser, UnsupportedQrUrl
from app.parsers.gr.parser import GrEinvoicingParser

_REGISTERED: list[BaseReceiptParser] = [
    GrEinvoicingParser(),
]


def find_parser(qr_url: str) -> BaseReceiptParser:
    """Return the first adapter that recognises ``qr_url``.

    Raises :class:`UnsupportedQrUrl` if no adapter claims the URL — which is
    the correct behaviour: we never invent a fallback (ADR-0001 §5).
    """
    for parser in _REGISTERED:
        if parser.can_parse(qr_url):
            return parser
    raise UnsupportedQrUrl(f"no parser registered for url host: {_safe_host(qr_url)}")


def all_parsers() -> list[BaseReceiptParser]:
    return list(_REGISTERED)


def _safe_host(qr_url: str) -> str:
    """Return the URL host for diagnostics — never the full URL (no PII / tokens)."""
    from urllib.parse import urlparse

    try:
        return urlparse(qr_url).netloc or "<unparseable>"
    except (ValueError, TypeError):
        return "<unparseable>"
