"""``POST /receipts/{receipt_id}/tag`` — tag-as-business endpoint (ADR-0008).

Per ADR-0008 §2 / DES-0005:

- Bearer JWT (verified ``sub`` is the canonical user — never trust client).
- Body: ``{ "is_business": bool, "category"?: str, "notes"?: str }`` with
  ``extra="forbid"``.
- ``category`` is **trimmed + lowercased server-side**, length-capped 1..64
  after trim. When ``is_business=true``, missing or empty-after-trim →
  422.
- ``notes`` is trimmed; length-capped 0..500 after trim. Optional.
- Idempotent — re-POSTing the same body is a 200 no-op.
- Defense-in-depth: the storage layer filters by ``user_id = sub`` on top
  of Supabase RLS. 404 is returned both for "no such receipt" and "belongs
  to another user" (no enumeration of UUIDs across users).
- Response: HTTP 200, body = the full updated receipt (same shape as
  ``GET /receipts/{id}`` and the response of ``POST /receipts/parse``).
- Errors follow the RFC-7807 envelope (``app.errors``).

Logging is metadata-only (`receipt_id`, outcome). The category text and the
notes text **never** appear in any log line per ADR-0008 §4 / DES-0005 §6.
"""

from __future__ import annotations

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.auth import (
    JWKSProvider,
    JwtMalformedError,
    VerifiedJwt,
    verify_supabase_jwt,
)
from app.config import settings
from app.errors import problem_response
from app.routes.receipts import (
    ReceiptResponse,
    _to_response,  # exported helper from the parse endpoint
    get_storage,
)
from app.storage.receipts import ReceiptStorage, StoredReceipt

log = logging.getLogger(__name__)

router = APIRouter(tags=["receipts"])


# ---------------------------------------------------------------------------
# Request model
# ---------------------------------------------------------------------------


CATEGORY_MAX_LEN = 64
NOTES_MAX_LEN = 500


class TagRequest(BaseModel):
    """ADR-0008 §2 body shape."""

    model_config = ConfigDict(extra="forbid")

    is_business: bool
    category: str | None = Field(default=None, max_length=200)
    """Free-text category (ADR-0008 §2). Trimmed + lowercased server-side
    and length-capped at 64 chars **after trim**. The pre-trim ``max_length``
    on the input is generous (200) so a user with trailing whitespace gets a
    helpful 422 with the trimmed-too-long message rather than an early
    Pydantic length-mismatch error."""

    notes: str | None = Field(default=None, max_length=2000)
    """Free-text notes. Trimmed server-side and length-capped at 500 chars
    **after trim**. Pre-trim ``max_length`` is 2000 for the same reason as
    above."""

    @model_validator(mode="after")
    def _normalize(self) -> TagRequest:
        # Trim + lowercase category; trim notes. The validators run after
        # ``extra="forbid"`` so an unexpected field is already rejected.
        # We still need to enforce the post-trim length caps and the
        # required-when-tagging rule for ``category``.
        if self.category is not None:
            object.__setattr__(self, "category", self.category.strip().lower())
        if self.notes is not None:
            object.__setattr__(self, "notes", self.notes.strip())
        # Empty-string after trim is normalized to None for "untagged" /
        # "no notes" semantics.
        if self.category == "":
            object.__setattr__(self, "category", None)
        if self.notes == "":
            object.__setattr__(self, "notes", None)
        return self


# ---------------------------------------------------------------------------
# Dependencies (injected — overridable in tests)
# ---------------------------------------------------------------------------


def get_jwt_secret() -> str:  # pragma: no cover - overridden in tests
    """Legacy HS256 secret per ADR-0015 §5 (DI handle name kept for tests)."""
    return settings.supabase_jwt_legacy_hs256_secret


def get_jwks_provider():  # pragma: no cover - overridden in tests
    from app.services.jwks_provider import get_jwks_provider as _factory

    return _factory()


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
StorageDep = Annotated[ReceiptStorage, Depends(get_storage)]


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------


@router.post(
    "/receipts/{receipt_id}/tag",
    responses={
        200: {"model": ReceiptResponse, "description": "Tag applied / removed."},
        401: {"description": "Missing / invalid Bearer JWT."},
        404: {"description": "No such receipt for this user."},
        422: {"description": "Body validation error."},
    },
)
def tag_receipt(
    receipt_id: UUID,
    body: TagRequest,
    user: VerifiedJwtDep,
    storage: StorageDep,
) -> JSONResponse:
    # ---- Validate the post-trim shape per ADR-0008 §2 ----------------------
    if body.is_business:
        if body.category is None:
            return problem_response(
                code="invalid_request",
                title="Category required",
                status=422,
                detail="`category` is required when `is_business` is true.",
            )
        if len(body.category) > CATEGORY_MAX_LEN:
            return problem_response(
                code="invalid_request",
                title="Category too long",
                status=422,
                detail=f"`category` must be {CATEGORY_MAX_LEN} chars or fewer.",
            )
    if body.notes is not None and len(body.notes) > NOTES_MAX_LEN:
        return problem_response(
            code="invalid_request",
            title="Notes too long",
            status=422,
            detail=f"`notes` must be {NOTES_MAX_LEN} chars or fewer.",
        )

    # ---- Apply the tag (storage layer enforces the user filter) ------------
    updated: StoredReceipt | None = storage.tag_receipt(
        user.sub,
        receipt_id,
        is_business=body.is_business,
        category=body.category if body.is_business else None,
        notes=body.notes if body.is_business else None,
    )
    if updated is None:
        # ADR-0008 §3: a receipt that exists but belongs to another user
        # returns the same 404 as a missing one (no enumeration).
        return problem_response(
            code="not_found",
            title="Receipt not found",
            status=404,
            detail="No such receipt for this user.",
        )

    log.info(
        "tag_applied" if body.is_business else "tag_removed",
        extra={
            "user_id": user.sub,
            "receipt_id": str(receipt_id),
            "outcome": "tagged" if body.is_business else "untagged",
            # NEVER log the category or notes per ADR-0008 §4 / DES-0005 §6.
        },
    )

    response = _to_response(
        updated.id,
        updated.created_at,
        updated.parsed,
        is_business_expense=updated.is_business_expense,
        business_category=updated.business_category,
        notes=updated.notes,
    )
    return JSONResponse(status_code=200, content=response.model_dump(mode="json"))
