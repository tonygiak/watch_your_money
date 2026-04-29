# Plan

The current direction of the project and the focus of the next sprint.

## Where we are right now

Sprint **S-001 (discovery, `receipt-parser-contract`)** has just closed. It produced:

- **ADR-0001** — parser interface + `ParsedReceipt` schema + VAT-rate normalization (`docs/adr/S-001-ADR-0001-Parser-interface.md`).
- **ADR-0002** — `POST /receipts/parse` contract + Supabase RLS interaction + `MARK` idempotency (`docs/adr/S-001-ADR-0002-Receipts-parse-endpoint.md`).
- **ADR-0003** — scanner UX flow (`docs/adr/S-001-ADR-0003-Scanner-ux-flow.md`) plus **DES-0001** (`docs/sprints/S-001-discovery-receipt-parser-contract/S-001-DES-0001-Scanner-ux.md`).
- **5 backlog items Ready** — BLG-0001 (parser), BLG-0002 (endpoint), BLG-0003 (scanner), BLG-0004 (fixtures), BLG-0008 (CI).
- Three open questions stay in the backlog for the next discovery sprint S-003: BLG-0005 (OTP), BLG-0006 (insights), BLG-0007 (offline cache).

For the latest user-facing snapshot, read `AGENTS.md` §2.6 (shipped features — still empty, S-002 ships the first user-visible behavior) and §2.7 (sprint snapshot).

## Next sprint

- **Type**: `implementation` (a.k.a. delivery).
- **Theme proposal**: `scan-and-store`.
- **Why implementation, not discovery**: 5 items are now Ready (`AGENTS.md` §4.1.2 — "ready items present → implementation").

### Goals for the implementation sprint S-002

The sprint pulls these Ready items in this order:

1. **BLG-0001** — finalize the GR adapter against ADR-0001 (full §5.3.3 extraction + `ParserError` taxonomy + `parse_html` network-free path).
2. **BLG-0004** — ship at least 1 fixture triplet (`gr-001-…`) so BLG-0001 can prove green; add the remaining 4 if time permits, otherwise defer to S-004 (a future implementation sprint after S-003).
3. **BLG-0002** — ship `POST /receipts/parse` with Bearer JWT verification, idempotency, RFC-7807 errors, contract tests. Updates `backend/.env.sample` to declare `SUPABASE_JWT_SECRET`.
4. **BLG-0003** — ship the Scanner screen against DES-0001 + ADR-0003 (Expo `expo-camera`, reducer state machine, on-device domain validation, Greek-first strings).
5. **BLG-0008** — wire `make check` into GitHub Actions on push + PR.

The §2.5 quality bar (receipt visible within 5 seconds) is the acceptance test. The 5-second target is verified end-to-end at sprint review against the BLG-0004 fixture(s).

### Cadence after that

- **S-003 — discovery** — settles BLG-0005 (OTP), BLG-0006 (insights), BLG-0007 (offline cache) and any drift surfaced from S-002. Also handles the small admin items BLG-0009, BLG-0010, BLG-0011 if they're not picked up earlier.
- **S-004 — implementation** — ships authenticated phone-OTP login, the Insights screen, and the offline cache against the S-003 ADRs.
- After that, alternation continues per `AGENTS.md` §4.1.2.

## Open questions queued for S-003 discovery

These are unchanged from S-001 since they are intentionally out of S-002's scope:

- **Phone OTP provider** (BLG-0005): Supabase native phone OTP vs Twilio integration vs deferred for MVP.
- **Insights computation** (BLG-0006): Postgres views vs in-process aggregation in FastAPI.
- **Offline cache strategy** (BLG-0007): sqlite vs AsyncStorage vs in-memory, with at-rest encryption decision.

## Notes for whoever picks this up

- ADR-0002 explicitly supersedes the literal `AGENTS.md` §5.3.2 body shape (drops `user_id` from the body). Reconciliation of the §5.3.2 wording is tracked as BLG-0010.
- The bootstrap GR adapter currently raises generic `ParserError("…")`; BLG-0001 maps those to `ParserDriftError` / `EmptyReceiptError` per ADR-0001 — do this before BLG-0002 wires the HTTP status mapping.
- Mobile and backend share a regex for the GR viewer URL. Keep them in sync: `mobile/src/parsers/gr.ts` mirrors `backend/app/parsers/gr/url.py`.
