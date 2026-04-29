# Skill: add-parser-adapter

Onboard a new EU country adapter behind the existing parser interface. Used by `parser-specialist`.

## Inputs

- An ADR deciding to support the new country (with `parser-specialist` + `architect` + `data-architect` co-sign per `AGENTS.md` §4.11).
- At least 5 real receipts from the new country (with `provenance.md` consent).

## Outputs

- Adapter under `backend/app/parsers/<cc>/` (e.g. `backend/app/parsers/ro/`).
- Fixtures under `backend/tests/fixtures/receipts/<cc>/` (triplet per receipt).
- Tests under `backend/tests/parsers/test_<cc>.py`.
- Update `backend/app/parsers/registry.py` to include the new adapter under its `country_code`.

## Procedure

1. **Confirm the schema is country-agnostic enough** — no migration should be needed (`country-agnostic-schema.md`). If a migration is needed, it is an ADR + a separate sprint.
2. **Implement** `<Cc>ReceiptParser(BaseReceiptParser)` in `backend/app/parsers/<cc>/parser.py`:
   - `country_code` property returns `'<CC>'`.
   - `can_parse(qr_url)` returns True for that country's URLs.
   - `parse(qr_url)` returns a `ParsedReceipt` (typed Pydantic model).
3. **Add fixtures** as triplets under `backend/tests/fixtures/receipts/<cc>/<receipt-id>/`. Confirm consent in `provenance.md` with `security-privacy-officer`.
4. **Register** the adapter in `backend/app/parsers/registry.py`.
5. **Write tests** that walk every fixture and assert `expected.json` matches the parser output exactly.
6. **Run `make check`** until all fixtures pass at 100% accuracy for the new country, and the GR adapter still passes.

## Forbidden

- OCR fallback (`no-ocr.md`).
- Country-specific changes outside `backend/app/parsers/<cc>/`.

## Gotchas

- Set the correct response encoding for the country's portal (UTF-8, ISO-8859-x, etc.).
- Treat fetched HTML as untrusted (`agent-runtime-security.md` §1).
