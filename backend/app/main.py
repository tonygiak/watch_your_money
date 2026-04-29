"""FastAPI application entry point."""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app import __version__
from app.auth import JwtError
from app.errors import problem_response
from app.routes.health import router as health_router
from app.routes.receipts import jwt_exception_handler
from app.routes.receipts import router as receipts_router

app = FastAPI(
    title="Greek e-receipt finance app — backend",
    version=__version__,
    description=(
        "Captures SKU-level data from Greek e-invoice QR codes via "
        "the e-invoicing.gr structured infrastructure. Country-agnostic by design."
    ),
)


@app.exception_handler(JwtError)
async def _on_jwt_error(request: Request, exc: JwtError) -> JSONResponse:
    return jwt_exception_handler(request, exc)


@app.exception_handler(RequestValidationError)
async def _on_validation_error(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """Pydantic / FastAPI validation errors → RFC-7807 envelope."""
    # Strip out anything that could carry user input (the ``input`` field on
    # each error includes the offending value — we don't want to echo it).
    safe_errors = [
        {"loc": err.get("loc"), "msg": err.get("msg"), "type": err.get("type")}
        for err in exc.errors()
    ]
    return problem_response(
        code="invalid_request",
        title="Invalid request",
        status=400,
        detail=f"{len(safe_errors)} validation error(s).",
    )


app.include_router(health_router)
app.include_router(receipts_router)
