# Plan

The current direction of the project and the focus of the next sprint.

## Where we are right now

Sprint **S-000 (bootstrap)** has completed: repository scaffold, agentic system (`.agents/` + `.cursor/rules/`), Sprint 0 documentation, working backend healthcheck, working Expo placeholder app, initial Supabase migration with RLS, country-agnostic schema, abstract parser interface plus Greek adapter stub, and a green `make check`.

For the latest user-facing snapshot, read `AGENTS.md` §2.6 (shipped features) and §2.7 (sprint snapshot).

## Next sprint

- **Type**: `discovery`.
- **Theme proposal**: `receipt-parser-contract` — finalize the parser interface, the `ParsedReceipt` Pydantic model, and the first set of Ready backlog items needed to move from "QR URL" → "structured receipt stored under RLS".
- **Why discovery, not delivery**: there are no Ready items yet (`AGENTS.md` §4.1.2 — a delivery sprint must not start with an empty Ready queue).

### Goals for the discovery sprint

1. ADR for the parser interface (inputs, outputs, error model, country resolution).
2. ADR for the `POST /receipts/parse` request/response contract and how it interacts with Supabase Auth + RLS.
3. ADR for how the mobile client triggers the scan (camera permissions, domain validation, retry UX).
4. Refine 4–6 backlog items to **Ready** for the next implementation sprint.
5. Capture the first 3–5 fixture candidates with consent (no fixtures committed yet — the discovery sprint can spec the *acquisition* runbook without obtaining real receipts).

### Cadence after that

Per `AGENTS.md` §4.1.2 — alternate discovery and implementation. The next implementation sprint targets shipping `POST /receipts/parse` end-to-end against the local fixture set.

## Open questions logged for the next discovery sprint

- Phone OTP provider: Supabase native vs Twilio integration vs deferred for MVP.
- VAT-rate normalization: keep as text (`'24%'`) or normalize to `0.24` numeric.
- Insights computation: server-side aggregation in Postgres views vs in-process aggregation in FastAPI.
- Offline cache strategy on mobile: sqlite vs AsyncStorage vs in-memory.
