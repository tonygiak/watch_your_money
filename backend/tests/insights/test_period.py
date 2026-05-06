"""Period-boundary helper tests (ADR-0005 §3 / §8)."""

from __future__ import annotations

from datetime import date

import pytest

from app.insights.period import boundaries_for

# ---------------------------------------------------------------------------
# Week
# ---------------------------------------------------------------------------


def test_week_within_week() -> None:
    # Wed 15 April 2026
    b = boundaries_for("week", anchor=date(2026, 4, 15))
    # Mon 13 → Sun 19 April
    assert b.current.from_date == date(2026, 4, 13)
    assert b.current.to_date == date(2026, 4, 19)
    # Mon 6 → Sun 12 April
    assert b.previous.from_date == date(2026, 4, 6)
    assert b.previous.to_date == date(2026, 4, 12)


def test_week_anchor_on_monday() -> None:
    b = boundaries_for("week", anchor=date(2026, 4, 13))
    assert b.current.from_date == date(2026, 4, 13)
    assert b.current.to_date == date(2026, 4, 19)


def test_week_anchor_on_sunday() -> None:
    b = boundaries_for("week", anchor=date(2026, 4, 19))
    assert b.current.from_date == date(2026, 4, 13)
    assert b.current.to_date == date(2026, 4, 19)


def test_week_crossing_year_boundary() -> None:
    # Mon 30 Dec 2024 → Sun 5 Jan 2025
    b = boundaries_for("week", anchor=date(2025, 1, 1))
    assert b.current.from_date == date(2024, 12, 30)
    assert b.current.to_date == date(2025, 1, 5)
    assert b.previous.from_date == date(2024, 12, 23)
    assert b.previous.to_date == date(2024, 12, 29)


# ---------------------------------------------------------------------------
# Month
# ---------------------------------------------------------------------------


def test_month_april_2026() -> None:
    b = boundaries_for("month", anchor=date(2026, 4, 30))
    assert b.current.from_date == date(2026, 4, 1)
    assert b.current.to_date == date(2026, 4, 30)
    assert b.previous.from_date == date(2026, 3, 1)
    assert b.previous.to_date == date(2026, 3, 31)


def test_month_january_rolls_back_to_previous_december() -> None:
    b = boundaries_for("month", anchor=date(2026, 1, 14))
    assert b.current.from_date == date(2026, 1, 1)
    assert b.current.to_date == date(2026, 1, 31)
    assert b.previous.from_date == date(2025, 12, 1)
    assert b.previous.to_date == date(2025, 12, 31)


def test_month_february_in_leap_year_has_29_days() -> None:
    b = boundaries_for("month", anchor=date(2024, 2, 10))
    assert b.current.to_date == date(2024, 2, 29)
    # The previous month is January 2024 which has 31 days.
    assert b.previous.to_date == date(2024, 1, 31)


def test_month_february_in_common_year_has_28_days() -> None:
    b = boundaries_for("month", anchor=date(2026, 2, 10))
    assert b.current.to_date == date(2026, 2, 28)


def test_month_march_after_leap_february() -> None:
    # Previous month should still be Feb 29 in 2024.
    b = boundaries_for("month", anchor=date(2024, 3, 1))
    assert b.previous.from_date == date(2024, 2, 1)
    assert b.previous.to_date == date(2024, 2, 29)


# ---------------------------------------------------------------------------
# Year
# ---------------------------------------------------------------------------


def test_year_2026() -> None:
    b = boundaries_for("year", anchor=date(2026, 7, 4))
    assert b.current.from_date == date(2026, 1, 1)
    assert b.current.to_date == date(2026, 12, 31)
    assert b.previous.from_date == date(2025, 1, 1)
    assert b.previous.to_date == date(2025, 12, 31)


# ---------------------------------------------------------------------------
# Errors
# ---------------------------------------------------------------------------


def test_unknown_period_raises() -> None:
    with pytest.raises(ValueError):
        boundaries_for("decade", anchor=date(2026, 1, 1))  # type: ignore[arg-type]


def test_default_anchor_is_today_in_athens(monkeypatch: pytest.MonkeyPatch) -> None:
    # `boundaries_for(period)` with no anchor calls `athens_today()`.
    # Pin it to a fixed value to make the test deterministic.
    from app.insights import period as period_mod

    monkeypatch.setattr(period_mod, "athens_today", lambda: date(2026, 4, 30))
    b = period_mod.boundaries_for("month")
    assert b.anchor == date(2026, 4, 30)
    assert b.current.from_date == date(2026, 4, 1)
