"""``PATCH /users/me`` — Profile partial update (DES-0004 §4 / BLG-0017).

Per DES-0004 §4:

- Bearer JWT (verified ``sub`` is the canonical user — never trust client).
- Body: ``{ "is_freelancer"?: bool, "afm"?: str | null }`` with
  ``extra="forbid"``.
- ``afm`` is validated server-side against the Greek MOD-11 checksum
  (defense in depth on top of the mobile validator).
- Idempotent partial update — re-PATCHing the same body is a 200 no-op.
- Response: HTTP 200, body = the full updated row **minus** ``phone``
  (DES-0004 §4 — ΑΦΜ + freelancer flag round-trip; phone never does).
- Errors per RFC-7807 envelope (``app.errors``).

Logging is metadata-only (``user_id`` + outcome). The ΑΦΜ value
**never** appears in any log line — DES-0004 §7 / §3.3 (ΑΦΜ is
identifying data).
"""

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, Header
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

from app.afm import InvalidAfmError, validate_afm
from app.auth import (
    JWKSProvider,
    JwtMalformedError,
    VerifiedJwt,
    verify_supabase_jwt,
)
from app.config import settings
from app.errors import problem_response
from app.storage.users import (
    UNSET,
    StoredUser,
    UserStorage,
)

log = logging.getLogger(__name__)

router = APIRouter(tags=["users"])


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------


class UpdateMeRequest(BaseModel):
    """DES-0004 §4 body shape. Both fields optional; ``extra='forbid'``."""

    model_config = ConfigDict(extra="forbid")

    is_freelancer: bool | None = Field(default=None)
    """``None`` means "don't change"; ``True`` / ``False`` writes the value."""

    afm: str | None = Field(default=None, max_length=64)
    """``None`` means "don't change" (Pydantic distinguishes
    field-not-provided from field-set-to-null via ``model_fields_set``).
    A 9-digit string (post-trim) writes the value. The pre-trim
    ``max_length`` is generous so a user with extra whitespace gets a
    helpful 422 with ``invalid_afm`` rather than a Pydantic length error."""


class MeResponse(BaseModel):
    """Per DES-0004 §4: full updated row minus ``phone``."""

    id: str
    afm: str | None
    email: str | None
    is_freelancer: bool


# ---------------------------------------------------------------------------
# Dependencies (injected — overridable in tests)
# ---------------------------------------------------------------------------


def get_user_storage() -> UserStorage:  # pragma: no cover - overridden in tests
    """Production wiring — Supabase service-key client."""
    from app.services.supabase_client import get_client
    from app.storage.users import SupabaseUserStorage

    return SupabaseUserStorage(client=get_client())


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
UserStorageDep = Annotated[UserStorage, Depends(get_user_storage)]


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------


@router.patch(
    "/users/me",
    responses={
        200: {"model": MeResponse, "description": "Profile updated."},
        401: {"description": "Missing / invalid Bearer JWT."},
        404: {"description": "User row not found."},
        422: {"description": "Body validation error."},
    },
)
def patch_me(
    body: UpdateMeRequest,
    user: VerifiedJwtDep,
    storage: UserStorageDep,
) -> JSONResponse:
    # ---- Validate ΑΦΜ post-trim per DES-0004 §3.3 / §4 ---------------------
    afm_provided = "afm" in body.model_fields_set
    validated_afm: str | None
    if afm_provided:
        # Distinguish "afm: null" (clear) from "afm: <string>" (validate).
        if body.afm is None:
            validated_afm = None
        else:
            try:
                validated_afm = validate_afm(body.afm)
            except InvalidAfmError as exc:
                # Map to RFC-7807 — never echo the ΑΦΜ value back.
                return problem_response(
                    code="invalid_afm",
                    title="Invalid ΑΦΜ",
                    status=422,
                    detail=f"ΑΦΜ validation failed: {exc.reason}.",
                )
    else:
        validated_afm = None  # unused — we'll pass UNSET below.

    afm_arg: object = validated_afm if afm_provided else UNSET

    updated: StoredUser | None = storage.patch(
        user.sub,
        is_freelancer=body.is_freelancer,
        afm=afm_arg,  # type: ignore[arg-type]
    )
    if updated is None:
        # The auth.users → public.users sync trigger should have already
        # created the row. Returning 404 here is the safe path: a missing
        # row means we cannot apply a write, and we never lazily create
        # rows from a PATCH (idempotency would no longer hold across
        # retries; signup creates the row).
        return problem_response(
            code="not_found",
            title="User not found",
            status=404,
            detail="No profile for this user.",
        )

    log.info(
        "user_patched",
        extra={
            "user_id": user.sub,
            "is_freelancer_updated": body.is_freelancer is not None,
            "afm_updated": afm_provided,
            # NEVER log the ΑΦΜ value — DES-0004 §7.
        },
    )

    response = MeResponse(
        id=updated.id,
        afm=updated.afm,
        email=updated.email,
        is_freelancer=updated.is_freelancer,
    )
    return JSONResponse(status_code=200, content=response.model_dump(mode="json"))
