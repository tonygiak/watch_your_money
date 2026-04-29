# Sprint S-001 — Review

- Type: discovery
- Closed: 2026-04-29
- Chair: orchestrator

## Outcomes

- **ADR-0001** accepted: parser interface, `ParsedReceipt` schema for every `AGENTS.md` §5.3.3 field, `ParserError` taxonomy (`UnsupportedQrUrl`, `ParserFetchError`, `ParserUpstreamError`, `ParserDriftError`, `EmptyReceiptError`), country-resolution rules, and **VAT-rate as percent number** (`24.00`).
- **ADR-0002** accepted: Bearer JWT auth, body shape `{ "qr_url": string }` (explicitly supersedes the literal `AGENTS.md` §5.3.2 wording per §4.4 tie-breaker), 201/200+`is_duplicate` happy path, RFC-7807-style errors, idempotency via `(user_id, mark)`, structured drift logging.
- **ADR-0003** accepted: reducer-based state machine, `expo-camera` as the single dependency, on-device domain validation **before** any network call, duplicate-as-success, Greek-first language default.
- **DES-0001** drafted: complete scanner state machine + every Greek string + accessibility + telemetry rules.
- **5 backlog items moved to Ready**: BLG-0001, BLG-0002, BLG-0003, BLG-0004, BLG-0008.
- **3 backlog items kept `planned`** with sharper acceptance pending S-003 ADRs: BLG-0005 (OTP), BLG-0006 (insights), BLG-0007 (offline cache).
- **3 follow-up items added**: BLG-0009 (drift CI hook), BLG-0010 (AGENTS.md §5.3.2 reconciliation), BLG-0011 (Profile language switch).
- **`docs/plan.md`** updated: next sprint = **S-002 implementation (`scan-and-store`)**.
- **`.agents/context/decisions.md`** indexed.
- **`AGENTS.md` §2.7** updated.

## `make check`

- Status: **green**.
- Last run: 2026-04-29 23:45.
- Backend: ruff (clean), mypy (Success: 22 source files), pytest (13 passed).
- Mobile: tsc --noEmit (clean), jest (11 passed).
- Note: this was a smoke check — no production code changed in this discovery sprint, but `AGENTS.md` §4.10 calls for re-verifying the gate at every sprint close so a hidden regression cannot ride along on a doc-only sprint.

## Sign-offs (AGENTS.md §4.11)

- ADR-0001 (parent contract for all future EU adapters): `parser-specialist` + `architect` + `data-architect`. `qa` reviewed for testability. `localization-specialist` reviewed for Greek decimal handling. `agent-safety-officer` confirmed no new external surface.
- ADR-0002 (new endpoint + RLS interaction): `architect` + `engineering-manager` (API contract). `data-architect` + `security-privacy-officer` (RLS / auth flow).
- ADR-0003 + DES-0001 (new mobile screen / UX flow): `product-designer` + `localization-specialist`. `security-privacy-officer` reviewed (camera permission is sensitive; no user-data leaves device until the explicit `POST`). `qa` reviewed reducer testability.
- Edits to `AGENTS.md` §2.7: `agents-doctor` (structural) + `orchestrator` (sprint LOG records the change).
- No new external surface introduced. `agent-safety-officer` confirms allowlist unchanged.

## ADRs decided

- **ADR-0001** — Parser interface, `ParsedReceipt` model, and VAT-rate normalization.
- **ADR-0002** — `POST /receipts/parse` contract + Supabase RLS interaction + `MARK` idempotency.
- **ADR-0003** — Scanner UX flow (permission, domain validation, retry).

## Items moved backlog → done

None — discovery sprints don't move items to `docs/done.md`. The Ready items (BLG-0001..0004, BLG-0008) stay in `docs/backlog.md` until S-002 implementation closes them.

## New backlog items (drift / follow-ups)

- **BLG-0009** — CI hook for upstream HTML drift detection (follow-up of ADR-0001).
- **BLG-0010** — Reconcile `AGENTS.md` §5.3.2 wording with ADR-0002 (follow-up of ADR-0002).
- **BLG-0011** — Profile screen language switch Greek/English (follow-up of ADR-0003, deferred per §2.9 unless user-test reveals it's blocking).

## Learnings

- The §4.4 tie-breaker priority ("hard constraints win over literal §5.3.2 wording") was needed in real life on ADR-0002. Recording it in this REV so future sprints know the precedent: when an ADR collides with literal AGENTS.md text on a security/privacy issue, the ADR wins and a follow-up doc-reconciliation backlog item is opened (BLG-0010 here).
- Discovery sprints still benefit from running `make check` at close. Doc-only changes can't break the gate — but the *act* of running it caught zero issues and took 22 seconds, confirming the gate is fast enough for every-sprint use.
- Splitting DES-0001 (design artifact) from ADR-0003 (decision artifact) made both shorter and more focused. The DES enumerates *what* the screen does state-by-state; the ADR locks the *behavioral* decisions. Future UI sprints should follow this pattern.

## Next sprint

- Type: **implementation**.
- Theme proposal: **`scan-and-store`**.
- Pulls: BLG-0001, BLG-0002, BLG-0003, BLG-0004 (≥ 1 fixture, ideally 5), BLG-0008.
- Acceptance test at sprint review: a real Greek QR scanned in the Expo app appears in ReceiptDetail within ≤ 5 seconds (§2.5 quality bar), and re-scanning the same QR shows the duplicate copy without creating a second row.
- See `docs/plan.md` for the full plan.
