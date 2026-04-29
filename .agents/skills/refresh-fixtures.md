# Skill: refresh-fixtures

Refresh the real-receipt fixture set to detect upstream HTML drift early. Used by `parser-specialist`. Co-signed by `security-privacy-officer` for new captures.

## Inputs

- A list of receipts to capture (or refresh).
- Explicit consent from each receipt holder (or confirmation that the receipt is public).

## Outputs

- New / updated triplets under `backend/tests/fixtures/receipts/<cc>/<receipt-id>/`:
  - `raw.html` — the full HTML returned by the API endpoint, UTF-8 encoded.
  - `expected.json` — the structured ground truth the parser must produce.
  - `provenance.md` — source merchant, capture date, consent statement, redactions applied.

## Procedure

1. **Capture** the QR URL from the user's receipt (with consent) and convert to the API URL per `AGENTS.md` §5.3.5.
2. **Fetch** the HTML over HTTPS with `response.encoding = 'utf-8'`.
3. **Save** `raw.html` byte-exact to disk.
4. **Hand-craft** `expected.json` from the rendered receipt (merchant, totals, line items, EAN, VAT, payment method).
5. **Redact** any PII that is not strictly needed (mask card last-4, redact phone numbers). Document redactions in `provenance.md`.
6. **Add `provenance.md`** with: source merchant, capture date, "explicit consent recorded on YYYY-MM-DD" or "publicly available test receipt", list of redactions.
7. **Get sign-off** from `security-privacy-officer` before committing.
8. **Run `make check`**; the new fixture must pass at 100% accuracy.

## Forbidden

- Sharing fixtures with any LLM, MCP server, or external service (`agent-runtime-security.md` §8).
- Auto-uploading user receipts into fixtures.
- Committing fixtures without `provenance.md`.

## On drift

If a refresh shows the upstream HTML changed (different selectors, new fields), open a `drift` backlog item and keep the failing test red. The fix lands in a delivery sprint after a discovery sprint refines the parser interface (`AGENTS.md` §4.10).
