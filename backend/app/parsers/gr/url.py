"""QR viewer URL → API endpoint conversion for the Greek e-invoicing.gr portal.

Spec: ``AGENTS.md`` §5.3.5 and ``.agents/context/parser-internals.md``.
The viewer-URL regex is the **shared contract** with mobile (mirrored in
``mobile/src/parsers/gr.ts``) per ADR-0003 §3.
"""

from __future__ import annotations

import re
from urllib.parse import urlparse

from app.parsers.base import UnsupportedQrUrl

GR_VIEWER_PATH_REGEX = (
    r"/edocuments/ViewInvoice/-1/[0-9a-fA-F-]+_[A-Za-z0-9]+$"
)
"""Path-only regex; mirrored verbatim in ``mobile/src/parsers/gr.ts``."""

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
    """Convert the QR-encoded viewer URL to the structured API endpoint.

    Raises :class:`UnsupportedQrUrl` for any URL that fails the domain check
    or the path pattern (ADR-0001 §4).
    """
    if not is_einvoicing_gr(qr_url):
        raise UnsupportedQrUrl("qr url is not on the e-invoicing.gr domain")

    match = _VIEWER_PATTERN.search(urlparse(qr_url).path)
    if not match:
        raise UnsupportedQrUrl("qr url does not match the viewer pattern")

    return _API_TEMPLATE.format(
        base=base.rstrip("/"),
        uuid=match.group("uuid"),
        token=match.group("token"),
    )
