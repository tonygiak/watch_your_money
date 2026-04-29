# Skill: write-tests

Translate acceptance criteria into automated tests. Used by `qa`, `backend-builder`, `mobile-builder`, `parser-specialist`.

## Inputs

- A backlog item with explicit acceptance criteria (`AGENTS.md` §4.9.1).

## Outputs

- One or more test files under the appropriate folder:
  - `backend/tests/routes/`, `backend/tests/services/`, `backend/tests/parsers/`, `backend/tests/db/`.
  - `mobile/__tests__/screens/`, `mobile/__tests__/lib/`.

## Procedure

1. **Restate each acceptance criterion as a test name**: `it_returns_error_when_qr_is_not_einvoicing_domain`, `it_renders_total_in_eur_format_with_comma`.
2. **Write the test red first** — confirm it fails before implementation.
3. **Implement** the production code until the test goes green.
4. **Add edge cases**: empty input, validation failure, RLS denial, UTF-8 round-trip, locale fallback (`el` → `en`).
5. **For parsers**: add fixture-based tests that load `raw.html` and compare to `expected.json`. The fixture stays — never weaken (`quality-gate.md`).

## Conventions

- Backend: `pytest`, no third-party DB unless an ADR allows it; use Supabase test scaffolding or in-memory fakes for unit tests.
- Mobile: `jest` + `@testing-library/react-native` (or stub renderers if not yet installed); strict TS in tests too.
- Test names describe behavior in user terms, not implementation terms.

## Forbidden

- Weakening a failing test to ship (`quality-gate.md`).
- `try / except: pass` in production code added to "make tests green."
- Sharing real receipts or PII through any external service during testing (`agent-runtime-security.md` §8).
