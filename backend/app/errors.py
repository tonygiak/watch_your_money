"""RFC-7807-style problem-detail error envelope (ADR-0002 §4).

Used for every non-2xx response from the API. Never carries the QR URL,
the raw HTML, the user id, or any other PII (`AGENTS.md` §5.7, ADR-0002 §6).
The ``trace_id`` is the only correlation handle exposed to clients.
"""

from __future__ import annotations

import uuid
from typing import Final

from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

PROBLEM_CONTENT_TYPE: Final[str] = "application/problem+json"


class ProblemDetail(BaseModel):
    """RFC-7807-shaped error body."""

    type: str = Field(..., description="Stable error code, e.g. 'unsupported_url'.")
    title: str = Field(..., description="Short, human-readable title.")
    status: int = Field(..., description="HTTP status code.")
    detail: str = Field(
        ...,
        description="Long, human-readable detail. NEVER includes URLs, HTML, or PII.",
    )
    trace_id: str = Field(..., description="Opaque trace id for log correlation.")


def problem_response(
    *,
    code: str,
    title: str,
    status: int,
    detail: str,
    trace_id: str | None = None,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    """Build a JSONResponse carrying a :class:`ProblemDetail`."""
    body = ProblemDetail(
        type=code,
        title=title,
        status=status,
        detail=detail,
        trace_id=trace_id or _new_trace_id(),
    )
    return JSONResponse(
        status_code=status,
        content=body.model_dump(),
        media_type=PROBLEM_CONTENT_TYPE,
        headers=headers,
    )


def _new_trace_id() -> str:
    return uuid.uuid4().hex
