"""Insights computation (ADR-0005).

The aggregation math runs in Postgres via PostgREST RPC functions; this
package owns the FastAPI-side orchestration:

- :mod:`app.insights.period` — Athens-TZ period boundaries (week / month /
  year, current + previous window).
- :mod:`app.insights.repository` — :class:`InsightsRepository` interface +
  :class:`InMemoryInsightsRepository` (tests + local dev) +
  :class:`SupabaseInsightsRepository` (production).
- :mod:`app.routes.insights` — the two endpoints (``/insights/summary`` and
  ``/insights/products``), each verifying the Bearer JWT before calling the
  repository.
"""
