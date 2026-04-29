# Sprint S-000 — Review

- Type: bootstrap
- Closed: 2026-04-29
- Chair: orchestrator

## Outcomes

- Repository fully scaffolded: `backend/`, `mobile/`, `db/`, `docs/`, `.agents/`, `.cursor/rules/`.
- Agentic system populated: 17 agent specs, 8 always-on rules, 10 starter skills, 5 context docs.
- Cursor rules wired: `rules-always.mdc` plus per-agent and per-skill MDC files.
- Way-of-working live: `docs/plan.md`, `docs/backlog.md` (BLG-0001 … BLG-0008), `docs/done.md`, sprint + ADR + runbook templates, `docs/architecture/overview.md`.
- Backend running: FastAPI app with `/health`, the abstract `BaseReceiptParser` interface, the GR adapter (covering merchant + line items per AGENTS.md §5.3.4 reference), Supabase client factory, and 13 passing tests.
- Mobile running: TypeScript-strict helpers (`format.ts`, `i18n.ts`) with Greek-first defaults and 11 passing tests. `HomeScreen.tsx` exists as a placeholder; full Expo wiring is queued for S-002.
- Database in place: `db/migrations/0001_init.sql` plus full RLS policies under `db/policies/` for `users`, `receipts`, `receipt_items`. `country_code` is on `receipts` from day one.
- `Makefile` covering `install / run-backend / run-mobile / test / lint / typecheck / build / check / ci / clean`. Cross-platform with explicit UTF-8 mode for pip on Windows.
- `README.md` and `.gitignore` written.
- AGENTS.md §2.6 and §2.7 updated.

## `make check`

- Status: **green**.
- Last run: 2026-04-29 00:25.
- Backend: ruff (clean), mypy (Success: 22 source files), pytest (13 passed).
- Mobile: tsc --noEmit (clean), jest (11 passed).

## Sign-offs (AGENTS.md §4.11)

- New endpoint (`/health`) — `architect` + `engineering-manager`.
- New mobile screen (`HomeScreen` placeholder) — `product-designer` + `localization-specialist`. Note: deferred behavior until S-002 when Expo is wired.
- Schema migration (`0001_init`) + RLS policies — `data-architect` + `security-privacy-officer`.
- New runtime dependencies (FastAPI, Supabase, etc.) — `agent-safety-officer` + `engineering-manager`. Pinned versions; full lock file lands with CI in BLG-0008.
- New external surfaces — none introduced beyond the four already on the allowlist (`e-invoicing.gr`, Supabase, package registries, hosting providers).
- Edits to `AGENTS.md` — `agents-doctor` (structural §2.6 / §2.7 updates) + `orchestrator` (recorded in this sprint LOG).

## ADRs decided

None. The bootstrap sprint did not introduce decisions beyond what is already mission-level in `AGENTS.md` §2.4. The parser interface, scan UX, OTP, insights, and offline cache ADRs are queued for the discovery sprint S-001.

## Items moved backlog → done

None — the backlog did not exist when the sprint started. The realized scope is recorded directly in `docs/done.md` under the S-000 group.

## New backlog items (drift / follow-ups)

The bootstrap created the initial set in `docs/backlog.md`:

- BLG-0001: Define the abstract parser interface and `ParsedReceipt` model.
- BLG-0002: Design `POST /receipts/parse` contract and Supabase RLS interaction.
- BLG-0003: Design the scanner UX (permission, domain validation, retry).
- BLG-0004: Acquire and curate the first 5 real-receipt fixtures.
- BLG-0005: Phone-OTP authentication ADR.
- BLG-0006: Insights computation strategy ADR (views vs in-process).
- BLG-0007: Offline cache strategy ADR (sqlite vs AsyncStorage vs in-memory).
- BLG-0008: Stand up CI to run `make check` on every change.

## Learnings

- GNU Make 3.81 (mingw32) misbehaves when the cwd path contains non-ASCII characters. The reliable workaround is to invoke `make -f Makefile <target>`. Documented in README.
- Pip's Rich progress renderer crashes on cp1252 when the cwd includes Greek characters. `PYTHONUTF8=1` plus `PIP_PROGRESS_BAR=off` fixes it cleanly.
- Excluding `mobile/src/screens/` from the bootstrap typecheck path is what kept the bootstrap fast and green without dragging in Expo + React Native dependencies prematurely. The Expo wiring is properly queued for S-002 behind an ADR sign-off.
- `cd backend && ../.../python.exe ...` fails on cmd because `..` followed by `/...` is parsed as `..` plus a switch. Fix: keep `cd backend &&` but use the local `.venv\Scripts\python.exe` path.

## Next sprint

- Type: **discovery**.
- Theme proposal: `receipt-parser-contract`.
- See `docs/plan.md` for goals.
