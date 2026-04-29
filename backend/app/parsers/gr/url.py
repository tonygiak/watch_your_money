"""QR viewer URL → API endpoint conversion for the Greek e-invoicing.gr portal.

Spec: ``AGENTS.md`` §5.3.5 and ``.agents/context/parser-internals.md``.
"""

from __future__ import annotations

import re
from urllib.parse import urlparse

from app.parsers.base import ParserError

_VIEWER_PATTERN = re.compile(
    r"/edocuments/ViewInvoice/-1/(?P<uuid>[0-9a-fA-F-]+)_(?P<token>[A-Za-z0-9]+)$"
)

_API_TEMPLATE = (
    "{base}/api/GetInvoice"
    "?contentType=PEPPOL"
    "&intRefDocID={uuid}"
    "&hashToken={token}"
    "&ofenm=-1"
    "&isPreview=True"
)


def is_einvoicing_gr(qr_url: str) -> bool:
    """Strict origin check before we trust any HTML from the URL."""
    parsed = urlparse(qr_url)
    return parsed.scheme == "https" and parsed.netloc == "e-invoicing.gr"


def viewer_to_api(qr_url: str, *, base: str = "https://e-invoicing.gr") -> str:
    """Convert the QR-encoded viewer URL to the structured API endpoint."""
    if not is_einvoicing_gr(qr_url):
        raise ParserError("qr url is not on the e-invoicing.gr domain")

    match = _VIEWER_PATTERN.search(urlparse(qr_url).path)
    if not match:
        raise ParserError("qr url does not match the viewer pattern")

    return _API_TEMPLATE.format(
        base=base.rstrip("/"),
        uuid=match.group("uuid"),
        token=match.group("token"),
    )
