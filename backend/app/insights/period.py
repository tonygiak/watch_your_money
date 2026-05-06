"""Athens-timezone period boundaries (ADR-0005 §3).

A Greek user's "April spend" is the spend across the Greek calendar month;
DST in Europe/Athens means a UTC-only computation skews boundaries on the
last Sunday of March / October. Period helpers always compute in
``Europe/Athens`` and then expose plain ``date`` objects suitable for
SQL ``BETWEEN`` queries against ``receipts.issue_date``.

The helpers are pure functions — no environment reads, no clock side-effects
beyond an optional ``today=`` argument that callers (and tests) can pin.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Literal
from zoneinfo import ZoneInfo

ATHENS_TZ = ZoneInfo("Europe/Athens")
"""Single source of truth for the period timezone."""

Period = Literal["week", "month", "year"]


@dataclass(frozen=True)
class PeriodWindow:
    """Inclusive ``[from_date, to_date]`` window in Athens local calendar.

    Both ``from_date`` and ``to_date`` are :class:`datetime.date` (Greek
    calendar dates), suitable to interpolate into SQL queries that match
    ``receipts.issue_date BETWEEN :from_date AND :to_date``.
    """

    from_date: date
    to_date: date


@dataclass(frozen=True)
class PeriodBoundaries:
    """Current + previous window for a given period anchor."""

    period: Period
    anchor: date
    current: PeriodWindow
    previous: PeriodWindow


def athens_today() -> date:
    """Return the current date in Athens local time.

    Wrapped here so tests can monkeypatch a single function instead of
    threading a ``today`` argument through every call.
    """
    return datetime.now(ATHENS_TZ).date()


def boundaries_for(period: Period, anchor: date | None = None) -> PeriodBoundaries:
    """Compute the current + previous window for ``period`` around ``anchor``.

    - ``period="week"``: Monday → Sunday containing ``anchor`` (and the
      Monday → Sunday of the prior calendar week).
    - ``period="month"``: 1st → last day of ``anchor``'s month (and the
      previous calendar month).
    - ``period="year"``: 1 Jan → 31 Dec of ``anchor``'s year (and the
      previous calendar year).

    Leap years are handled correctly — month boundaries always use the
    actual last day of the month, not a fixed ``28``.
    """
    today = anchor or athens_today()

    if period == "week":
        return _week_boundaries(today)
    if period == "month":
        return _month_boundaries(today)
    if period == "year":
        return _year_boundaries(today)
    raise ValueError(f"unknown period: {period!r}")


def _week_boundaries(anchor: date) -> PeriodBoundaries:
    monday = anchor - timedelta(days=anchor.weekday())
    sunday = monday + timedelta(days=6)
    prev_monday = monday - timedelta(days=7)
    prev_sunday = prev_monday + timedelta(days=6)
    return PeriodBoundaries(
        period="week",
        anchor=anchor,
        current=PeriodWindow(from_date=monday, to_date=sunday),
        previous=PeriodWindow(from_date=prev_monday, to_date=prev_sunday),
    )


def _month_boundaries(anchor: date) -> PeriodBoundaries:
    first = anchor.replace(day=1)
    last = _last_day_of_month(first)

    if first.month == 1:
        prev_first = first.replace(year=first.year - 1, month=12)
    else:
        prev_first = first.replace(month=first.month - 1)
    prev_last = _last_day_of_month(prev_first)

    return PeriodBoundaries(
        period="month",
        anchor=anchor,
        current=PeriodWindow(from_date=first, to_date=last),
        previous=PeriodWindow(from_date=prev_first, to_date=prev_last),
    )


def _year_boundaries(anchor: date) -> PeriodBoundaries:
    first = date(anchor.year, 1, 1)
    last = date(anchor.year, 12, 31)
    prev_first = date(anchor.year - 1, 1, 1)
    prev_last = date(anchor.year - 1, 12, 31)
    return PeriodBoundaries(
        period="year",
        anchor=anchor,
        current=PeriodWindow(from_date=first, to_date=last),
        previous=PeriodWindow(from_date=prev_first, to_date=prev_last),
    )


def _last_day_of_month(any_day: date) -> date:
    """Return the last calendar day of ``any_day``'s month.

    Greg calendar via ``date`` math: jump to the first of next month and
    subtract one day. Handles December → January year roll and Feb leap
    years without a hand-coded month-length table.
    """
    if any_day.month == 12:
        next_first = date(any_day.year + 1, 1, 1)
    else:
        next_first = date(any_day.year, any_day.month + 1, 1)
    return next_first - timedelta(days=1)
