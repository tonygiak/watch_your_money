# Context: Parser internals

Domain knowledge for the Greek `e-invoicing.gr` adapter and the abstract interface every adapter implements.

## URL conversion

QR codes carry the viewer URL:

```
https://e-invoicing.gr/edocuments/ViewInvoice/-1/{uuid}_{hashToken}
```

Convert to the API endpoint:

```
https://e-invoicing.gr/api/GetInvoice?contentType=PEPPOL&intRefDocID={uuid}&hashToken={hashToken}&ofenm=-1&isPreview=True
```

The conversion lives in `backend/app/parsers/gr/url.py` and is exercised by `backend/tests/parsers/test_gr_url.py`.

## HTTP fetch

- Method: `GET`.
- Headers: minimal — no impersonation, but a polite `User-Agent`.
- **Critical**: `response.encoding = 'utf-8'` before reading `response.text`. Greek characters fail otherwise.
- Treat the response as **untrusted input** (`agent-runtime-security.md` §1).

## HTML structure (Greek receipts)

Per `AGENTS.md` §5.3.3 — the only fields we extract are these. Everything else is discarded.

| Group | Field | Source |
|------|------|--------|
| Merchant | name | `class="BoldBlueHeader fontSize12pt"` |
| Merchant | ΑΦΜ (tax id), address, ΔΟΥ | labeled rows |
| Receipt | document number, issue date, MARK, UID, auth code, transmission timestamp, provider | labeled rows |
| Line items | EAN, description, unit, quantity, unit price, pre-discount, discount, VAT rate, total | `tbody tr` rows; cells 0..8 |
| Totals | pre-discount, discount, surcharge, final value, net value, VAT total, payment method | labeled rows |

A line row is "real" only if it has **9 cells**.

## Reference parser

A small validated reference is in `AGENTS.md` §5.3.4. The production parser at `backend/app/parsers/gr/parser.py` extends it to all fields above and lives behind the `BaseReceiptParser` interface.

## Drift detection

If a refresh of the fixture set fails (`refresh-fixtures.md`), `parser-specialist` opens a `drift` backlog item. The failing test stays red — never weakened (`quality-gate.md`).

## Forbidden

- OCR (`no-ocr.md`).
- Silent fallbacks that invent fields.
- Re-encoding the response body to "fix" Greek characters — set encoding before `.text`.
- Sharing fixtures with external services (`agent-runtime-security.md` §8).
