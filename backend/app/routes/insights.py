"""Insights endpoints — ADR-0005 §4.

Two endpoints:

- ``GET /insights/summary?period={week|month|year}&anchor=YYYY-MM-DD``
- ``GET /insights/products?period=…&anchor=…&limit=N``

Both:

1. Verify the Supabase Bearer JWT in-process (ADR-0002 §1) — same path as
   ``/receipts/parse``. The verified ``sub`` is the canonical user id; no
   ``user_id`` query / body field is accepted (ADR-0005 §7).
2. Compute the period boundaries in Athens TZ (ADR-0005 §3) and call the
   :class:`InsightsRepository`.
3. Render the response with money fields as ``"XX.XX"`` strings (ADR-0005
   §5) so the mobile client doesn't have to choose a Number / BigInt path.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, Header, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

from app.auth import (
    JWKSProvider,
    JwtMalformedError,
    VerifiedJwt,
    verify_supabase_jwt,
)
from app.config import settings
from app.errors import problem_response
from app.insights.period import Period, boundaries_for
from app.insights.repository import (
    InsightsRepository,
    SummaryResult,
    TopProductsResult,
)

router = APIRouter(tags=["insights"])


# ---------------------------------------------------------------------------
# Response models — exact shapes promised by ADR-0005 §4
# ---------------------------------------------------------------------------


class WindowResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    from_date: date
    to_date: date
    total: str = Field(..., description="Decimal-as-string, two decimal places.")
    vat_total: str
    receipt_count: int


class CategoryResponse(BaseModel):
    category: str
    total: str
    receipt_count: int


class MerchantResponse(BaseModel):
    merchant_name: str
    total: str
    receipt_count: int


class SummaryResponse(BaseModel):
    period: Period
    anchor: date
    current: WindowResponse
    previous: WindowResponse
    by_category: list[CategoryResponse]
    by_merchant: list[MerchantResponse]


class ProductResponse(BaseModel):
    ean: str
    description: str
    frequency: int
    total_spend: str
    average_unit_price: str


class TopProductsResponse(BaseModel):
    period: Period
    anchor: date
    from_date: date
    to_date: date
    products: list[ProductResponse]


# ---------------------------------------------------------------------------
# Dependencies (overrideable in tests)
# ---------------------------------------------------------------------------


def get_insights_repository() -> InsightsRepository:  # pragma: no cover
    from app.insights.repository import SupabaseInsightsRepository
    from app.services.supabase_client import get_client

    return SupabaseInsightsRepository(client=get_client())


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
RepositoryDep = Annotated[
    InsightsRepository, Depends(get_insights_repository)
]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


PeriodQuery = Annotated[Period, Query(description="week | month | year")]
AnchorQuery = Annotated[
    date | None,
    Query(description="ISO date (defaults to today in Athens TZ)."),
]
LimitQuery = Annotated[
    int,
    Query(ge=1, le=50, description="Top-N limit, default 10."),
]


@router.get("/insights/summary", response_model=SummaryResponse)
def insights_summary(
    period: PeriodQuery,
    user: VerifiedJwtDep,
    repo: RepositoryDep,
    anchor: AnchorQuery = None,
) -> JSONResponse:
    if period not in ("week", "month", "year"):
        return problem_response(
            code="invalid_request",
            title="Invalid period",
            status=400,
            detail="period must be one of: week, month, year.",
        )

    boundaries = boundaries_for(period, anchor=anchor)
    result: SummaryResult = repo.summary_for_user(
        user.sub,
        from_date=boundaries.current.from_date,
        to_date=boundaries.current.to_date,
        prev_from_date=boundaries.previous.from_date,
        prev_to_date=boundaries.previous.to_date,
    )

    body = SummaryResponse(
        period=period,
        anchor=boundaries.anchor,
        current=WindowResponse(
            from_date=result.current.from_date,
            to_date=result.current.to_date,
            total=_money(result.current.total),
            vat_total=_money(result.current.vat_total),
            receipt_count=result.current.receipt_count,
        ),
        previous=WindowResponse(
            from_date=result.previous.from_date,
            to_date=result.previous.to_date,
            total=_money(result.previous.total),
            vat_total=_money(result.previous.vat_total),
            receipt_count=result.previous.receipt_count,
        ),
        by_category=[
            CategoryResponse(
                category=row.category,
                total=_money(row.total),
                receipt_count=row.receipt_count,
            )
            for row in result.by_category
        ],
        by_merchant=[
            MerchantResponse(
                merchant_name=row.merchant_name,
                total=_money(row.total),
                receipt_count=row.receipt_count,
            )
            for row in result.by_merchant
        ],
    )
    return JSONResponse(status_code=200, content=body.model_dump(mode="json"))


@router.get("/insights/products", response_model=TopProductsResponse)
def insights_products(
    period: PeriodQuery,
    user: VerifiedJwtDep,
    repo: RepositoryDep,
    anchor: AnchorQuery = None,
    limit: LimitQuery = 10,
) -> JSONResponse:
    boundaries = boundaries_for(period, anchor=anchor)
    result: TopProductsResult = repo.top_products_for_user(
        user.sub,
        from_date=boundaries.current.from_date,
        to_date=boundaries.current.to_date,
        limit=limit,
    )
    body = TopProductsResponse(
        period=period,
        anchor=boundaries.anchor,
        from_date=result.from_date,
        to_date=result.to_date,
        products=[
            ProductResponse(
                ean=p.ean,
                description=p.description,
                frequency=p.frequency,
                total_spend=_money(p.total_spend),
                average_unit_price=_money(p.average_unit_price),
            )
            for p in result.products
        ],
    )
    return JSONResponse(status_code=200, content=body.model_dump(mode="json"))


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _money(value: Decimal) -> str:
    """Render a money Decimal as a two-decimal string (ADR-0005 §5).

    ``Decimal("0")`` → ``"0.00"``; ``Decimal("12.345")`` → ``"12.35"``
    (banker's-rounding via ``quantize`` keeps the SQL boundary stable).
    """
    return f"{value.quantize(Decimal('0.01'))}"
