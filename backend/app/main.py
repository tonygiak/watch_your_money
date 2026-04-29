"""FastAPI application entry point."""

from __future__ import annotations

from fastapi import FastAPI

from app import __version__
from app.routes.health import router as health_router

app = FastAPI(
    title="Greek e-receipt finance app — backend",
    version=__version__,
    description=(
        "Captures SKU-level data from Greek e-invoice QR codes via "
        "the e-invoicing.gr structured infrastructure. Country-agnostic by design."
    ),
)

app.include_router(health_router)
