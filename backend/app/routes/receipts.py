"""``POST /receipts/parse`` — the main capture endpoint (ADR-0002).

Flow per ADR-0002:

1. Verify Supabase Bearer JWT in-process. Missing / invalid → 401.
2. Resolve the country adapter from the QR URL. Unknown / non-Greek → 422.
3. Adapter fetches + parses the receipt. Errors map per ADR-0002 §4.
4. Storage upserts on ``(user_id, mark)``; idempotent re-scans return
   ``200 + is_duplicate=true`` without overwriting user-set fields.

Logging follows ADR-0002 §6: never log the QR URL, never log the raw HTML.
Only the URL host (``e-invoicing.gr``) and an opaque ``trace_id``.
"""

from __future__ import annotations

import logging
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Any
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, Header, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

from app.auth import (
    JwtError,
    JwtExpiredError,
    JwtMalformedError,
    VerifiedJwt,
    verify_supabase_jwt,
)
from app.config import settings
from app.errors import problem_response
from app.parsers.base import (
    EmptyReceiptError,
    ParsedReceipt,
    ParserDriftError,
    ParserError,
    ParserFetchError,
    ParserUpstreamError,
    UnsupportedQrUrl,
)
from app.parsers.registry import find_parser
from app.storage.receipts import ReceiptStorage, StoreResult

log = logging.getLogger(__name__)

router = APIRouter(tags=["receipts"])


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------


class ParseRequest(BaseModel):
    """Body shape per ADR-0002 §2. ``user_id`` is taken from the JWT, not
    the body."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    qr_url: str = Field(..., min_length=1, max_length=2048)


class ReceiptItemResponse(BaseModel):
    ean: str
    description: str
    unit: str
    quantity: Decimal
    unit_price: Decimal
    pre_discount_value: Decimal
    discount: Decimal
    vat_rate: Decimal
    total_value: Decimal


class ReceiptResponse(BaseModel):
    id: str
    created_at: datetime
    country_code: str
    merchant_name: str
    merchant_afm: str
    merchant_address: str
    document_number: str
    mark: str
    uid: str
    authentication_code: str
    issue_date: date | None
    transmission_timestamp: datetime | None
    payment_method: str
    subtotal: Decimal
    discount: Decimal
    surcharge: Decimal
    total: Decimal
    net_value: Decimal
    vat_total: Decimal
    provider: str
    items: list[ReceiptItemResponse]
    is_business_expense: bool
    business_category: str | None
    notes: str | None


class ParseResponse(BaseModel):
    receipt: ReceiptResponse
    is_duplicate: bool


# ---------------------------------------------------------------------------
# Dependencies (injected — overridable in tests)
# ---------------------------------------------------------------------------


def get_storage() -> ReceiptStorage:  # pragma: no cover - overridden in tests
    """Return the production Supabase-backed storage.

    Tests override this dependency via ``app.dependency_overrides`` and inject
    :class:`InMemoryReceiptStorage`. Production wiring imports the Supabase
    client lazily so a missing service key only fails at runtime in env where
    we actually need it.
    """
    from app.services.supabase_client import get_client
    from app.storage.receipts import SupabaseReceiptStorage

    return SupabaseReceiptStorage(client=get_client())


def get_jwt_secret() -> str:  # pragma: no cover - overridden in tests
    return settings.supabase_jwt_secret


AuthorizationHeader = Annotated[
    str | None, Header(alias="Authorization", description="Bearer <jwt>")
]
JwtSecret = Annotated[str, Depends(get_jwt_secret)]


def require_authenticated_user(
    authorization: AuthorizationHeader = None,
    secret: JwtSecret = "",
) -> VerifiedJwt:
    """FastAPI dependency: extract + verify the Bearer JWT.

    Raises :class:`JwtError` on any failure. The exception handler in
    :mod:`app.main` maps it to a 401 problem detail.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise JwtMalformedError("missing Bearer token")
    token = authorization[len("Bearer ") :].strip()
    return verify_supabase_jwt(token, secret)


VerifiedJwtDep = Annotated[VerifiedJwt, Depends(require_authenticated_user)]
StorageDep = Annotated["ReceiptStorage", Depends(get_storage)]


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------


@router.post(
    "/receipts/parse",
    responses={
        201: {"model": ParseResponse, "description": "Receipt stored."},
        200: {"model": ParseResponse, "description": "Idempotent re-scan."},
        401: {"description": "Missing / invalid Bearer JWT."},
        422: {"description": "Unsupported URL or empty receipt."},
        502: {"description": "Upstream fetch / status error."},
        503: {"description": "Parser drift detected."},
    },
)
def parse_receipt(
    body: ParseRequest,
    request: Request,
    user: VerifiedJwtDep,
    storage: StorageDep,
) -> JSONResponse:
    trace_id = _extract_trace_id(request) or uuid.uuid4().hex
    qr_url = body.qr_url

    parser = None
    try:
        parser = find_parser(qr_url)
        parsed = parser.parse(qr_url)
    except UnsupportedQrUrl:
        return problem_response(
            code="unsupported_url",
            title="Unsupported QR URL",
            status=422,
            detail=(
                "Only Greek e-invoicing.gr receipts are supported in this "
                "release."
            ),
            trace_id=trace_id,
        )
    except EmptyReceiptError:
        return problem_response(
            code="unsupported_url",
            title="Empty receipt",
            status=422,
            detail="The receipt was parsed but contained no line items.",
            trace_id=trace_id,
        )
    except ParserDriftError as exc:
        # Structured WARN log per ADR-0002 §6 — host + trace_id + adapter
        # detail server-side. The detail is NEVER echoed to the response
        # because parser messages may include verbatim receipt content.
        log.warning(
            "drift_detected",
            extra={
                "trace_id": trace_id,
                "host": _safe_host(qr_url),
                "country_code": getattr(parser, "country_code", "??"),
                "user_id": user.sub,
                "drift_reason": str(exc),
            },
        )
        return problem_response(
            code="parser_drift",
            title="Parser drift detected",
            status=503,
            detail="We could not parse this receipt. Please try again later.",
            trace_id=trace_id,
        )
    except (ParserFetchError, ParserUpstreamError) as exc:
        log.warning(
            "upstream_error",
            extra={
                "trace_id": trace_id,
                "host": _safe_host(qr_url),
                "user_id": user.sub,
                "reason": exc.__class__.__name__,
            },
        )
        return problem_response(
            code="upstream_error",
            title="Upstream fetch / status error",
            status=502,
            detail="Could not reach the receipt provider. Please try again.",
            trace_id=trace_id,
        )
    except ParserError as exc:
        # Defensive: an adapter raised a generic ParserError. Treat as drift.
        log.warning(
            "drift_unspecified",
            extra={
                "trace_id": trace_id,
                "host": _safe_host(qr_url),
                "user_id": user.sub,
                "reason": str(exc),
            },
        )
        return problem_response(
            code="parser_drift",
            title="Parser drift detected",
            status=503,
            detail="We could not parse this receipt. Please try again later.",
            trace_id=trace_id,
        )

    result: StoreResult = storage.upsert_receipt(user.sub, parsed)
    body_out = ParseResponse(
        receipt=_to_response(result.receipt.id, result.receipt.created_at, parsed,
                             is_business_expense=result.receipt.is_business_expense,
                             business_category=result.receipt.business_category,
                             notes=result.receipt.notes),
        is_duplicate=result.is_duplicate,
    )
    status = 200 if result.is_duplicate else 201
    headers = {"Location": f"/receipts/{result.receipt.id}"}
    return JSONResponse(
        status_code=status,
        content=body_out.model_dump(mode="json"),
        headers=headers,
    )


# ---------------------------------------------------------------------------
# Exception handlers (registered in app.main)
# ---------------------------------------------------------------------------


def jwt_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Map every :class:`JwtError` subclass to a 401 problem detail.

    Per ADR-0002 §4: always 401 + ``unauthenticated`` envelope; no leaking
    of the specific reason in ``type`` (the malformed/expired/signature
    distinction is for server logs only).
    """
    if not isinstance(exc, JwtError):
        # Fallback path — should never trigger via the registered handler,
        # but keeps the type checker happy.
        raise exc

    detail = "Bearer token missing or invalid."
    if isinstance(exc, JwtExpiredError):
        detail = "Bearer token expired."
    return problem_response(
        code="unauthenticated",
        title="Authentication required",
        status=401,
        detail=detail,
        headers={"WWW-Authenticate": 'Bearer realm="receipts"'},
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _to_response(
    receipt_id: Any,
    created_at: datetime,
    parsed: ParsedReceipt,
    *,
    is_business_expense: bool,
    business_category: str | None,
    notes: str | None,
) -> ReceiptResponse:
    return ReceiptResponse(
        id=str(receipt_id),
        created_at=created_at,
        country_code=parsed.country_code,
        merchant_name=parsed.merchant_name,
        merchant_afm=parsed.merchant_afm,
        merchant_address=parsed.merchant_address,
        document_number=parsed.document_number,
        mark=parsed.mark,
        uid=parsed.uid,
        authentication_code=parsed.authentication_code,
        issue_date=parsed.issue_date,
        transmission_timestamp=parsed.transmission_timestamp,
        payment_method=parsed.payment_method,
        subtotal=parsed.subtotal,
        discount=parsed.discount,
        surcharge=parsed.surcharge,
        total=parsed.total,
        net_value=parsed.net_value,
        vat_total=parsed.vat_total,
        provider=parsed.provider,
        items=[
            ReceiptItemResponse(
                ean=item.ean,
                description=item.description,
                unit=item.unit,
                quantity=item.quantity,
                unit_price=item.unit_price,
                pre_discount_value=item.pre_discount_value,
                discount=item.discount,
                vat_rate=item.vat_rate,
                total_value=item.total_value,
            )
            for item in parsed.items
        ],
        is_business_expense=is_business_expense,
        business_category=business_category,
        notes=notes,
    )


def _safe_host(url: str) -> str:
    """Return the URL host for logging — never the full URL (no PII / tokens)."""
    try:
        return urlparse(url).netloc or "<unparseable>"
    except (ValueError, TypeError):
        return "<unparseable>"


def _extract_trace_id(request: Request) -> str | None:
    """Use ``X-Trace-Id`` from the client if present (and well-formed)."""
    trace = request.headers.get("X-Trace-Id")
    if trace and len(trace) <= 64 and trace.replace("-", "").isalnum():
        return trace
    return None
