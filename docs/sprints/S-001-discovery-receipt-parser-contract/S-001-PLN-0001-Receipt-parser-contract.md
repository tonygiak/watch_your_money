# Sprint S-001 — Receipt parser contract (discovery)

- Type: discovery
- Theme: receipt-parser-contract
- Start: 2026-04-29
- Chair: orchestrator
- Participants: orchestrator, product-owner, product-manager, product-designer, architect, data-architect, parser-specialist, security-privacy-officer, agent-safety-officer, localization-specialist, qa, mobile-builder, backend-builder, engineering-manager, devops-engineer, go

## Why this sprint

Sprint S-000 (bootstrap) closed green but produced no Ready items. Per `AGENTS.md` §4.1.2, the next sprint must be discovery. The bootstrap left an interface stub (`BaseReceiptParser`, `ParsedReceipt`), a working GR adapter for merchant + line items, an RLS-protected schema, and 8 backlog items (BLG-0001 … BLG-0008) that all need to clear the **Definition of Ready** (§4.1.3) before a delivery sprint can pull them.

This sprint settles the three contracts that gate everything else:

1. The **parser interface** (so future EU adapters drop in without disturbing call sites or schema — `AGENTS.md` §2.4 country-agnostic constraint).
2. The **`POST /receipts/parse` endpoint** (so the mobile client has one clear thing to call, and so RLS + `MARK` idempotency are honored end-to-end).
3. The **scanner UX flow** (so users hit success on the first scan and refusal cases are graceful).

## Goals

1. Decide and record **ADR-0001 — Parser interface + `ParsedReceipt` model + VAT-rate normalization** (covers BLG-0001).
2. Decide and record **ADR-0002 — `POST /receipts/parse` contract + Supabase RLS interaction + `MARK` idempotency** (covers BLG-0002).
3. Decide and record **ADR-0003 — Scanner UX flow (permission, domain validation, retry)** with **DES-0001 — Scanner UX** (covers BLG-0003).
4. Refine 4–6 backlog items to **Ready** for the next implementation sprint (BLG-0001, BLG-0002, BLG-0003, BLG-0004, BLG-0008).
5. Index the new ADRs in `.agents/context/decisions.md`.
6. Pick the next sprint type (implementation S-002) and reflect it in `docs/plan.md` and `AGENTS.md` §2.7.

## Scope

**In:**
- ADR-0001, ADR-0002, ADR-0003.
- DES-0001 (scanner UX flow).
- Backlog refinement: BLG-0001..0004, BLG-0008 to **Ready**; BLG-0005..0007 stay `planned` with sharper acceptance.
- Documentation updates in `docs/plan.md`, `docs/done.md`, `.agents/context/decisions.md`, `AGENTS.md` §2.7.

**Out (explicitly):**
- Production code changes. Per `AGENTS.md` §4.1.1, discovery sprints ship no production code; the existing parser stub remains as-is and is *codified* by ADR-0001, not rewritten.
- ADR-0005 (OTP), ADR-0006 (insights), ADR-0007 (offline cache). Those still need their own debates and are queued for the next discovery sprint S-003. Their backlog items (BLG-0005, BLG-0006, BLG-0007) get sharper acceptance now but stay `planned` (not Ready).
- Capturing real user receipts. The runbook `refresh-fixtures.md` is already written; actual capture requires explicit consent and lands inside S-002 once a real-receipt holder approves (BLG-0004).
- Any change to the outbound allowlist.

## Ready items pulled (delivery only)

N/A — discovery sprint.

## Risks & known unknowns

- **Risk: parser contract drift.** If S-002 implementation reveals a missing field (e.g. a labelled total we forgot), the contract has to be amended via a follow-up ADR. *Mitigation*: ADR-0001 explicitly enumerates every §5.3.3 field and marks the `raw_html` carry-over as the safety net so S-002 never has to "invent" data.
- **Risk: `auth.uid()` vs backend service key confusion.** RLS policies allow `auth.uid()` writes; the backend uses a service-key client that bypasses RLS. *Mitigation*: ADR-0002 codifies the rule that the backend always sets `user_id` from the verified Supabase JWT and never trusts a client-supplied `user_id`.
- **Risk: scanner UX cuts permissions or fallback corners.** *Mitigation*: DES-0001 enumerates every state (granted, denied, blocked, network error, parse error, unsupported domain) with Greek-first copy.
- **Risk: discovery scope creep into ADR-0005..0007.** *Mitigation*: explicitly out of scope here (see above) and listed in `docs/plan.md` for S-003.

## User direction (if `go` was used)

- Direction: empty (`go` with no further instructions).
- Honored in scope: yes — `go` deferred sprint-type selection to `orchestrator`, which picked discovery per §4.1.2.

## Definition of done

- ADR-0001, ADR-0002, ADR-0003 written, accepted, and indexed in `.agents/context/decisions.md`.
- DES-0001 written.
- BLG-0001, BLG-0002, BLG-0003, BLG-0004, BLG-0008 satisfy the Definition of Ready (§4.1.3) — Acceptance turnable into tests, Design linked where user-facing, Approach links to ADR, Size set, Impact-notes filled.
- `docs/plan.md` updated with S-002 implementation plan.
- `AGENTS.md` §2.7 updated.
- Sprint REV + UREV written.
- `make check` re-run as smoke-check (no code changes, but a discovery sprint must not silently break the gate).
