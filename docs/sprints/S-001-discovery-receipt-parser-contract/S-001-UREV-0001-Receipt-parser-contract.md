# Sprint S-001 — User review

## Where we are right now

Sprint **S-001 (discovery)** closed today. We agreed exactly how the parser will work, exactly how the mobile app will call the backend, and exactly how the scanner screen will behave — all locked into three ADRs and one design artifact. **No production code changed** in this sprint (that's the point of discovery sprints — we *plan*, then S-002 implements). The next sprint is **S-002 implementation (`scan-and-store`)**, which ships the first user-visible behavior: scan a Greek receipt → see it in the app in ≤ 5 seconds.

## What changed

- **3 ADRs accepted** under `docs/adr/`:
  - **ADR-0001** — the parser contract (what every receipt looks like in code, what errors we raise, how VAT is stored as a percent number).
  - **ADR-0002** — the `POST /receipts/parse` API (Bearer JWT auth, no client-supplied identity, idempotency via `(user_id, mark)`, RFC-7807 errors).
  - **ADR-0003** — the scanner UX (Greek-first, every state mapped, on-device domain check before any network call).
- **1 design artifact** under the sprint folder: **DES-0001** — the full scanner screen flow with every Greek string and every error state.
- **5 backlog items refined to Ready** — BLG-0001 (parser), BLG-0002 (endpoint), BLG-0003 (scanner), BLG-0004 (5 real-receipt fixtures), BLG-0008 (CI). These are what S-002 pulls from.
- **3 backlog items kept on hold** for the next discovery sprint S-003 — BLG-0005 (phone OTP), BLG-0006 (insights), BLG-0007 (offline cache). They each need their own ADR debate.
- **3 follow-ups added** — BLG-0009 (drift detection CI), BLG-0010 (reconcile AGENTS.md §5.3.2 wording with ADR-0002), BLG-0011 (Profile screen language switch).

## How to verify (delivery sprints)

N/A — this was a discovery sprint, no shipped behavior.

## How to review (discovery sprint)

If you have 10 minutes, read in this order:

1. `docs/sprints/S-001-discovery-receipt-parser-contract/S-001-DES-0001-Scanner-ux.md` — gives you the most concrete picture (what the user actually sees).
2. `docs/adr/S-001-ADR-0003-Scanner-ux-flow.md` — the rounds and trade-offs behind that screen.
3. `docs/adr/S-001-ADR-0002-Receipts-parse-endpoint.md` — the API the scanner will call. Note the security tightening: we **don't** trust a client-supplied `user_id`, even though `AGENTS.md` §5.3.2 mentions one. The ADR explains why and records BLG-0010 to reconcile the wording.
4. `docs/adr/S-001-ADR-0001-Parser-interface.md` — the underlying parser contract that ADR-0002 relies on. Note the VAT-rate decision: stored as `24.00`, not `0.24` — matches what users see on receipts.
5. `docs/backlog.md` — confirm BLG-0001, BLG-0002, BLG-0003, BLG-0004, BLG-0008 are marked **Ready: yes**. The ones still **Ready: no** (BLG-0005, BLG-0006, BLG-0007) are intentionally queued for S-003.
6. `docs/plan.md` — what S-002 will actually do and why.

If anything in these decisions feels wrong, surface it before S-002 starts. After S-002 lands implementation against these contracts, changing them costs more.

## Where to look next

- `AGENTS.md` §2.6 — shipped features (still empty until S-002 ships).
- `AGENTS.md` §2.7 — current sprint snapshot (now reflects S-001 closing).
- `docs/plan.md` — S-002 plan.
- `docs/backlog.md` — what's planned and what's Ready.
- `docs/done.md` — completed work (still S-000 only; S-001 is a discovery sprint and produces no `done.md` entries).
