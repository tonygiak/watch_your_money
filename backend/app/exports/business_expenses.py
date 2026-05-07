"""Business-expenses PDF export (ADR-0009 / BLG-0019).

Three responsibilities, kept separate so each can be unit-tested without
touching the others:

1. **Query helper** — :class:`BusinessExpensesRepository` Protocol +
   :class:`InMemoryBusinessExpensesRepository` test fake. Filters
   ``WHERE user_id = sub AND is_business_expense = true AND issue_date
   BETWEEN from_date AND to_date`` (defense-in-depth on top of RLS, ADR-0009
   §3). The production wiring lives next to the existing storage layer.

2. **Sanitization** — :func:`sanitize_text` strips control characters
   (NULL, RTL marks, formatting bidi marks) before the value reaches
   ``reportlab``. PDF-injection / spoofing defense per ADR-0009 §4.

3. **PDF builder** — :func:`build_business_expenses_pdf` takes the rows,
   the ΑΦΜ, and the date range and returns the PDF bytes via an in-memory
   buffer. Pure-Python via ``reportlab`` (the only new runtime dep,
   reviewed in ADR-0009 §Round 2). Greek glyphs are rendered via the
   bundled Bitstream-Vera font that ships with ``reportlab`` — Vera covers
   modern Greek (α-ω, Α-Ω, accented forms) which is what Greek receipts
   use. The font registration is cached the first time the function is
   called.

The PDF is **never persisted** server-side and **never logged** — it
streams from memory through the FastAPI :class:`StreamingResponse` and is
then released (ADR-0009 §1 + §3).
"""

from __future__ import annotations

import io
import re
import unicodedata
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from typing import Protocol

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

# ---------------------------------------------------------------------------
# Query helper
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class BusinessExpenseRow:
    """A single row in the export PDF.

    Decimals carry through verbatim from the receipts table — currency
    formatting is the PDF builder's job, not the repository's.
    """

    receipt_id: str
    issue_date: date | None
    merchant_name: str
    merchant_afm: str
    total: Decimal
    vat_total: Decimal
    business_category: str | None
    notes: str | None


class BusinessExpensesRepository(Protocol):
    """Contract for querying tagged business expenses for a user / range."""

    def list_business_expenses(
        self,
        user_id: str,
        *,
        from_date: date,
        to_date: date,
    ) -> list[BusinessExpenseRow]:
        """Return tagged rows ordered by ``issue_date`` ascending.

        The implementation MUST filter by ``user_id`` server-side
        (defense-in-depth on top of Supabase RLS — ADR-0009 §3).
        """
        ...


@dataclass
class InMemoryBusinessExpensesRepository:
    """In-process fake used by contract tests."""

    rows: list[tuple[str, BusinessExpenseRow]]
    """Tuples of ``(user_id, row)`` so the fake can enforce the same
    user-filter the production query enforces in SQL."""

    def list_business_expenses(
        self,
        user_id: str,
        *,
        from_date: date,
        to_date: date,
    ) -> list[BusinessExpenseRow]:
        out: list[BusinessExpenseRow] = []
        for owner, row in self.rows:
            if owner != user_id:
                continue
            if row.issue_date is None:
                continue
            if not (from_date <= row.issue_date <= to_date):
                continue
            out.append(row)
        out.sort(key=lambda r: (r.issue_date or date.min, r.receipt_id))
        return out


# ---------------------------------------------------------------------------
# Sanitization (ADR-0009 §4)
# ---------------------------------------------------------------------------


_CONTROL_CHAR_RE = re.compile(
    # NULL through 0x1F (except TAB / LF / CR which are common in notes),
    # plus 0x7F DEL, plus the bidi formatting marks 0x202A..0x202E and
    # 0x2066..0x2069 which can flip text direction in a PDF text stream.
    "["
    "\x00-\x08"
    "\x0b\x0c"
    "\x0e-\x1f"
    "\x7f"
    "\u200b-\u200f"
    "\u2028\u2029"
    "\u202a-\u202e"
    "\u2066-\u2069"
    "]"
)


def sanitize_text(value: str | None, *, max_length: int | None = None) -> str:
    """Strip control / bidi characters and Unicode-normalize to NFC.

    PDF-injection defense per ADR-0009 §4. Truncates to ``max_length``
    (post-strip) when provided.
    """
    if value is None:
        return ""
    cleaned = _CONTROL_CHAR_RE.sub("", value)
    cleaned = unicodedata.normalize("NFC", cleaned)
    if max_length is not None and len(cleaned) > max_length:
        cleaned = cleaned[: max_length - 1] + "…"
    return cleaned


# ---------------------------------------------------------------------------
# PDF builder
# ---------------------------------------------------------------------------


_FONT_NAME = "WymBody"
_FONT_NAME_BOLD = "WymBodyBold"
_FONT_REGISTERED = False


def _register_fonts() -> None:
    """Register the bundled Bitstream-Vera fonts. Safe to call repeatedly."""
    global _FONT_REGISTERED
    if _FONT_REGISTERED:
        return
    # The Vera fonts ship with reportlab itself — no system font search.
    # Vera Sans covers monotonic Greek, which is what Greek e-invoices use.
    pdfmetrics.registerFont(TTFont(_FONT_NAME, "Vera.ttf"))
    pdfmetrics.registerFont(TTFont(_FONT_NAME_BOLD, "VeraBd.ttf"))
    _FONT_REGISTERED = True


def _format_eur(value: Decimal) -> str:
    """Format as ``X,XX €`` per Greek convention (mirrors mobile/lib/format)."""
    quantized = value.quantize(Decimal("0.01"))
    integer_part, _, fraction = str(quantized).partition(".")
    sign = ""
    if integer_part.startswith("-"):
        sign = "-"
        integer_part = integer_part[1:]
    fraction = (fraction or "00").ljust(2, "0")[:2]
    # Thousands separator = '.' (Greek convention).
    rev = integer_part[::-1]
    grouped = ".".join(rev[i : i + 3] for i in range(0, len(rev), 3))[::-1]
    return f"{sign}{grouped},{fraction} €"


def _format_date(value: date | None) -> str:
    if value is None:
        return ""
    return value.strftime("%d-%m-%Y")


@dataclass(frozen=True)
class PdfStrings:
    """Localized PDF strings — Greek is the source of truth (DES-0004 §5)."""

    title: str = "Επαγγελματικά Έξοδα"
    afm_label: str = "ΑΦΜ"
    range_label: str = "Περίοδος"
    generated_label: str = "Δημιουργήθηκε"
    totals_header: str = "Σύνολα"
    total_amount_label: str = "Συνολικό ποσό"
    total_vat_label: str = "Συνολικός ΦΠΑ"
    receipt_count_label: str = "Αριθμός αποδείξεων"
    rows_header: str = "Αποδείξεις"
    col_date: str = "Ημερομηνία"
    col_merchant: str = "Έμπορος"
    col_afm: str = "ΑΦΜ"
    col_category: str = "Κατηγορία"
    col_total: str = "Σύνολο"
    col_vat: str = "ΦΠΑ"
    empty_period: str = "Δεν υπάρχουν επαγγελματικά έξοδα στην περίοδο."


def build_business_expenses_pdf(
    *,
    user_afm: str | None,
    from_date: date,
    to_date: date,
    rows: list[BusinessExpenseRow],
    generated_at: datetime,
    strings: PdfStrings | None = None,
) -> bytes:
    """Render the export PDF and return its bytes.

    Empty-period: still returns a valid 200-page PDF with the
    ``empty_period`` message — handled at the layout level so the
    endpoint stays simple (BLG-0019 acceptance).
    """
    _register_fonts()
    s = strings or PdfStrings()

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
        title="Business Expenses",  # PDF metadata; never includes user data.
        author="Watch Your Money",
        subject="business-expenses-export",
    )

    styles = _build_styles()
    story: list[object] = []

    # --- Cover block ------------------------------------------------------
    story.append(Paragraph(s.title, styles["title"]))
    story.append(Spacer(1, 0.4 * cm))
    if user_afm:
        story.append(
            Paragraph(
                f"<b>{s.afm_label}:</b> {sanitize_text(user_afm)}",
                styles["body"],
            )
        )
    story.append(
        Paragraph(
            f"<b>{s.range_label}:</b> {_format_date(from_date)} — "
            f"{_format_date(to_date)}",
            styles["body"],
        )
    )
    story.append(
        Paragraph(
            f"<b>{s.generated_label}:</b> "
            f"{generated_at.strftime('%d-%m-%Y %H:%M')}",
            styles["body"],
        )
    )
    story.append(Spacer(1, 0.6 * cm))

    if not rows:
        # Empty-period — still a valid PDF (BLG-0019 acceptance).
        story.append(Paragraph(s.empty_period, styles["body"]))
        doc.build(story)
        return buffer.getvalue()

    # --- Totals block -----------------------------------------------------
    total_amount = sum((r.total for r in rows), Decimal("0"))
    total_vat = sum((r.vat_total for r in rows), Decimal("0"))

    story.append(Paragraph(s.totals_header, styles["section"]))
    totals_table = Table(
        [
            [s.receipt_count_label, str(len(rows))],
            [s.total_amount_label, _format_eur(total_amount)],
            [s.total_vat_label, _format_eur(total_vat)],
        ],
        colWidths=[6 * cm, 4 * cm],
        hAlign="LEFT",
    )
    totals_table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, -1), _FONT_NAME),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("ALIGN", (1, 0), (1, -1), "RIGHT"),
            ]
        )
    )
    story.append(totals_table)
    story.append(Spacer(1, 0.6 * cm))

    # --- Per-receipt rows -------------------------------------------------
    story.append(Paragraph(s.rows_header, styles["section"]))

    header_row = [
        s.col_date,
        s.col_merchant,
        s.col_afm,
        s.col_category,
        s.col_total,
        s.col_vat,
    ]
    body_rows = [
        [
            _format_date(row.issue_date),
            Paragraph(
                sanitize_text(row.merchant_name, max_length=80) or "-",
                styles["cell"],
            ),
            sanitize_text(row.merchant_afm or "", max_length=15),
            Paragraph(
                sanitize_text(row.business_category or "-", max_length=40),
                styles["cell"],
            ),
            _format_eur(row.total),
            _format_eur(row.vat_total),
        ]
        for row in rows
    ]
    table = Table(
        [header_row, *body_rows],
        colWidths=[2.2 * cm, 5.5 * cm, 2.5 * cm, 3 * cm, 2.4 * cm, 1.6 * cm],
        repeatRows=1,
    )
    table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, 0), _FONT_NAME_BOLD),
                ("FONTNAME", (0, 1), (-1, -1), _FONT_NAME),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eeeeee")),
                ("LINEBELOW", (0, 0), (-1, 0), 0.6, colors.black),
                ("LINEBELOW", (0, -1), (-1, -1), 0.4, colors.HexColor("#cccccc")),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("ALIGN", (4, 0), (5, -1), "RIGHT"),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    story.append(table)

    # Notes appear as a sub-row beneath each receipt, only when present.
    notes_rows = [
        (idx, sanitize_text(row.notes or "", max_length=120))
        for idx, row in enumerate(rows)
        if row.notes
    ]
    if notes_rows:
        story.append(Spacer(1, 0.4 * cm))
        story.append(Paragraph("Σημειώσεις", styles["section"]))
        for idx, text in notes_rows:
            row = rows[idx]
            label = (
                f"<b>{_format_date(row.issue_date)} · "
                f"{sanitize_text(row.merchant_name, max_length=40)}:</b> {text}"
            )
            story.append(Paragraph(label, styles["body"]))

    doc.build(story, onLaterPages=_footer, onFirstPage=_footer)
    return buffer.getvalue()


def _build_styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()["BodyText"]
    return {
        "title": ParagraphStyle(
            "Title",
            parent=base,
            fontName=_FONT_NAME_BOLD,
            fontSize=18,
            leading=22,
            spaceAfter=8,
        ),
        "section": ParagraphStyle(
            "Section",
            parent=base,
            fontName=_FONT_NAME_BOLD,
            fontSize=12,
            leading=16,
            spaceBefore=12,
            spaceAfter=4,
        ),
        "body": ParagraphStyle(
            "Body",
            parent=base,
            fontName=_FONT_NAME,
            fontSize=10,
            leading=14,
        ),
        "cell": ParagraphStyle(
            "Cell",
            parent=base,
            fontName=_FONT_NAME,
            fontSize=9,
            leading=12,
        ),
    }


def _footer(canvas, doc) -> None:  # pragma: no cover - rendered, not asserted
    """Page-number footer (ADR-0009 §5)."""
    canvas.saveState()
    canvas.setFont(_FONT_NAME, 9)
    canvas.setFillColor(colors.HexColor("#666666"))
    canvas.drawRightString(
        doc.pagesize[0] - 2 * cm, 1.2 * cm, f"{doc.page}"
    )
    canvas.restoreState()
