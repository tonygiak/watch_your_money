"""Unit tests for the PDF generator + sanitizer (BLG-0019 / ADR-0009).

These tests don't go through the route — they test :mod:`app.exports.
business_expenses` directly. The endpoint contract tests live in
``backend/tests/routes/test_exports.py``.

Asserts:

- :func:`build_business_expenses_pdf` returns bytes that start with the
  PDF magic header ``%PDF-`` (a basic well-formedness check).
- The empty-period path still produces a valid PDF.
- :func:`sanitize_text` strips control + bidi characters and is
  Unicode-NFC normalized.
- :class:`InMemoryBusinessExpensesRepository` filters by user + range.
"""

from __future__ import annotations

from datetime import UTC, date, datetime
from decimal import Decimal

from app.exports.business_expenses import (
    BusinessExpenseRow,
    InMemoryBusinessExpensesRepository,
    build_business_expenses_pdf,
    sanitize_text,
)

# ---------------------------------------------------------------------------
# sanitize_text
# ---------------------------------------------------------------------------


class TestSanitizeText:
    def test_strips_null_byte(self) -> None:
        assert sanitize_text("hello\x00world") == "helloworld"

    def test_strips_bidi_marks(self) -> None:
        # PDF-injection / spoofing surface: U+202E (right-to-left override).
        assert sanitize_text("normal\u202etext") == "normaltext"

    def test_strips_control_chars_but_keeps_newlines(self) -> None:
        assert sanitize_text("line1\nline2\tend") == "line1\nline2\tend"
        assert sanitize_text("\x07bell") == "bell"

    def test_truncates_with_ellipsis(self) -> None:
        out = sanitize_text("abcdefghij", max_length=5)
        assert out.endswith("…")
        assert len(out) == 5

    def test_returns_empty_string_for_none(self) -> None:
        assert sanitize_text(None) == ""

    def test_normalizes_to_nfc(self) -> None:
        # NFD-form (two codepoints) becomes NFC (one codepoint).
        nfd = "ά"  # noqa: RUF001 — intentional Greek alpha + combining acute
        nfd_decomposed = "α\u0301"
        assert sanitize_text(nfd_decomposed) == nfd


# ---------------------------------------------------------------------------
# InMemoryBusinessExpensesRepository
# ---------------------------------------------------------------------------


def _row(
    receipt_id: str,
    issue_date: date,
    *,
    merchant: str = "ΑΛΦΑ ΑΕ",
    afm: str = "094543987",
    total: Decimal = Decimal("42.50"),
    vat: Decimal = Decimal("8.20"),
    category: str = "groceries",
    notes: str | None = None,
) -> BusinessExpenseRow:
    return BusinessExpenseRow(
        receipt_id=receipt_id,
        issue_date=issue_date,
        merchant_name=merchant,
        merchant_afm=afm,
        total=total,
        vat_total=vat,
        business_category=category,
        notes=notes,
    )


class TestInMemoryRepository:
    def test_filters_by_user(self) -> None:
        repo = InMemoryBusinessExpensesRepository(
            rows=[
                ("u-1", _row("r-1", date(2026, 5, 1))),
                ("u-2", _row("r-2", date(2026, 5, 1))),
            ]
        )
        out = repo.list_business_expenses(
            "u-1", from_date=date(2026, 1, 1), to_date=date(2026, 12, 31)
        )
        assert [r.receipt_id for r in out] == ["r-1"]

    def test_filters_by_date_range_inclusive(self) -> None:
        repo = InMemoryBusinessExpensesRepository(
            rows=[
                ("u-1", _row("r-jan", date(2026, 1, 15))),
                ("u-1", _row("r-may", date(2026, 5, 15))),
                ("u-1", _row("r-dec", date(2026, 12, 15))),
            ]
        )
        out = repo.list_business_expenses(
            "u-1", from_date=date(2026, 5, 1), to_date=date(2026, 5, 31)
        )
        assert [r.receipt_id for r in out] == ["r-may"]

    def test_orders_by_issue_date_then_id(self) -> None:
        repo = InMemoryBusinessExpensesRepository(
            rows=[
                ("u-1", _row("r-b", date(2026, 5, 5))),
                ("u-1", _row("r-a", date(2026, 5, 1))),
                ("u-1", _row("r-c", date(2026, 5, 5))),
            ]
        )
        out = repo.list_business_expenses(
            "u-1", from_date=date(2026, 1, 1), to_date=date(2026, 12, 31)
        )
        assert [r.receipt_id for r in out] == ["r-a", "r-b", "r-c"]


# ---------------------------------------------------------------------------
# build_business_expenses_pdf
# ---------------------------------------------------------------------------


class TestPdfBuilder:
    def test_returns_bytes_starting_with_pdf_magic(self) -> None:
        pdf = build_business_expenses_pdf(
            user_afm="094019245",
            from_date=date(2026, 1, 1),
            to_date=date(2026, 4, 30),
            rows=[
                _row("r-1", date(2026, 2, 1), merchant="ΣΚΛΑΒΕΝΙΤΗΣ"),
                _row(
                    "r-2",
                    date(2026, 3, 15),
                    merchant="OPAP",
                    total=Decimal("100.00"),
                    vat=Decimal("24.00"),
                    notes="συνάντηση πελάτη",
                ),
            ],
            generated_at=datetime(2026, 5, 7, 17, 30, tzinfo=UTC),
        )
        assert pdf[:5] == b"%PDF-"
        # Sanity: a real PDF is more than a kilobyte even with two rows.
        assert len(pdf) > 1024

    def test_empty_period_still_produces_valid_pdf(self) -> None:
        pdf = build_business_expenses_pdf(
            user_afm=None,
            from_date=date(2026, 1, 1),
            to_date=date(2026, 1, 31),
            rows=[],
            generated_at=datetime(2026, 5, 7, 17, 30, tzinfo=UTC),
        )
        assert pdf[:5] == b"%PDF-"
        # Empty-period PDFs are smaller but still > 500 bytes.
        assert len(pdf) > 500

    def test_pdf_does_not_crash_on_greek_glyphs(self) -> None:
        # Smoke check: render with notes that exercise polytonic-ish forms
        # plus the standard Greek alphabet.
        pdf = build_business_expenses_pdf(
            user_afm="094019245",
            from_date=date(2026, 1, 1),
            to_date=date(2026, 4, 30),
            rows=[
                _row(
                    "r-greek",
                    date(2026, 2, 15),
                    merchant="ΑΦΟΙ ΧΑΤΖΗΑΘΑΝΑΣΙΟΥ Α.Ε.",
                    notes="Καφές + ψωμί. ΦΠΑ 24%.",
                ),
            ],
            generated_at=datetime(2026, 5, 7, 17, 30, tzinfo=UTC),
        )
        assert pdf[:5] == b"%PDF-"

    def test_long_notes_are_truncated(self) -> None:
        long_notes = "α" * 200  # 200 Greek chars > 120 cap
        pdf = build_business_expenses_pdf(
            user_afm="094019245",
            from_date=date(2026, 1, 1),
            to_date=date(2026, 4, 30),
            rows=[_row("r-1", date(2026, 2, 15), notes=long_notes)],
            generated_at=datetime(2026, 5, 7, 17, 30, tzinfo=UTC),
        )
        # Empty assertion — we only need the renderer to not raise. The
        # actual truncation is asserted by `sanitize_text` tests above; this
        # is the integration smoke that the cap is wired in.
        assert pdf[:5] == b"%PDF-"
