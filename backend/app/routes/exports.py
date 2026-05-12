"""``GET /export/business-expenses`` — PDF export endpoint (ADR-0009 / BLG-0019).

Per ADR-0009 §2 / DES-0004 §3.4:

- Bearer JWT (verified ``sub`` is the canonical user — never trust client).
- Query: ``from_date`` and ``to_date`` (inclusive) as ``YYYY-MM-DD``.
- Validation: ``to_date >= from_date`` and the range is at most 366 days.
- Response: ``application/pdf`` via :class:`StreamingResponse`. The PDF is
  generated on the fly from an in-memory buffer and **never persisted
  server-side, never logged** (ADR-0009 §1 + §3).
- ``Content-Disposition: attachment; filename="business-expenses-<from>-<to>.pdf"``.
- Errors per RFC-7807 envelope (``app.errors``).

Logging is metadata-only: ``user_id`` + outcome + ``rows`` count. The
date range, the merchant names, the categories, the notes, the ΑΦΜ, and
the PDF bytes **never** appear in any log line.
"""

from __future__ import annotations

import logging
from datetime import UTC, date, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Header, Query
from fastapi.responses import JSONResponse, StreamingResponse

from app.auth import (
    JWKSProvider,
    JwtMalformedError,
    VerifiedJwt,
    verify_supabase_jwt,
)
from app.config import settings
from app.errors import problem_response
from app.exports.business_expenses import (
    BusinessExpensesRepository,
    PdfStrings,
    build_business_expenses_pdf,
)
from app.storage.users import UserStorage

log = logging.getLogger(__name__)

router = APIRouter(tags=["exports"])


MAX_RANGE_DAYS = 366


# ---------------------------------------------------------------------------
# Dependencies (injected — overridable in tests)
# ---------------------------------------------------------------------------


def get_jwt_secret() -> str:  # pragma: no cover - overridden in tests
    """Legacy HS256 secret per ADR-0015 §5 (DI handle name kept for tests)."""
    return settings.supabase_jwt_legacy_hs256_secret


def get_jwks_provider():  # pragma: no cover - overridden in tests
    from app.services.jwks_provider import get_jwks_provider as _factory

    return _factory()


def get_business_expenses_repository() -> BusinessExpensesRepository:
    """Production wiring — Supabase service-key client.

    Kept as a placeholder until the Supabase production wiring is plumbed
    in S-007 alongside the rest of the storage layer. Tests inject the
    in-memory fake.
    """
    raise NotImplementedError(  # pragma: no cover - overridden in tests
        "Production BusinessExpensesRepository wiring is plumbed in S-007."
    )


def get_user_storage() -> UserStorage:
    """Production wiring — Supabase service-key client."""
    from app.routes.users import get_user_storage as _impl  # avoid cycle

    return _impl()


AuthorizationHeader = Annotated[
    str | None, Header(alias="Authorization", description="Bearer <jwt>")
]
JwtSecret = Annotated[str, Depends(get_jwt_secret)]


JwksProviderDep = Annotated[JWKSProvider | None, Depends(get_jwks_provider)]


def require_authenticated_user(
    authorization: AuthorizationHeader = None,
    secret: JwtSecret = "",
    jwks_provider: JwksProviderDep = None,
) -> VerifiedJwt:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise JwtMalformedError("missing Bearer token")
    token = authorization[len("Bearer ") :].strip()
    return verify_supabase_jwt(
        token,
        jwks_provider=jwks_provider,
        legacy_hs256_secret=secret or None,
    )


VerifiedJwtDep = Annotated[VerifiedJwt, Depends(require_authenticated_user)]
RepoDep = Annotated[
    BusinessExpensesRepository, Depends(get_business_expenses_repository)
]
UserStorageDep = Annotated[UserStorage, Depends(get_user_storage)]


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------


@router.get(
    "/export/business-expenses",
    response_model=None,
    responses={
        200: {
            "description": "Streaming PDF.",
            "content": {"application/pdf": {}},
        },
        401: {"description": "Missing / invalid Bearer JWT."},
        422: {"description": "Invalid date range."},
    },
)
def export_business_expenses(
    user: VerifiedJwtDep,
    repo: RepoDep,
    user_storage: UserStorageDep,
    from_date: Annotated[date, Query(alias="from_date")],
    to_date: Annotated[date, Query(alias="to_date")],
) -> StreamingResponse | JSONResponse:
    # ---- Validate the range per ADR-0009 §2 ------------------------------
    if to_date < from_date:
        return problem_response(
            code="invalid_range",
            title="Invalid date range",
            status=422,
            detail="`to_date` must be on or after `from_date`.",
        )
    if (to_date - from_date) > timedelta(days=MAX_RANGE_DAYS):
        return problem_response(
            code="invalid_range",
            title="Range too long",
            status=422,
            detail=f"Date range cannot exceed {MAX_RANGE_DAYS} days.",
        )

    # ---- Fetch the data + the requesting user's ΑΦΜ ----------------------
    rows = repo.list_business_expenses(
        user.sub, from_date=from_date, to_date=to_date
    )
    user_row = user_storage.get_by_id(user.sub)

    pdf_bytes = build_business_expenses_pdf(
        user_afm=user_row.afm if user_row else None,
        from_date=from_date,
        to_date=to_date,
        rows=rows,
        generated_at=datetime.now(tz=UTC),
        strings=PdfStrings(),
    )

    log.info(
        "export_business_expenses",
        extra={
            "user_id": user.sub,
            "rows": len(rows),
            # NEVER log: from_date, to_date, ΑΦΜ, merchant names, categories,
            # notes, or pdf bytes (ADR-0009 §3 + DES-0004 §7).
        },
    )

    filename = f"business-expenses-{from_date.isoformat()}-{to_date.isoformat()}.pdf"

    return StreamingResponse(
        _stream_bytes(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "private, no-store",
        },
    )


def _stream_bytes(blob: bytes):
    """Yield the PDF bytes once — keeps the in-memory buffer scoped to the
    request and lets ``StreamingResponse`` handle backpressure correctly."""
    yield blob
