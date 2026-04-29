# Backlog

Everything **planned** or **in progress**. Schema in `AGENTS.md` §4.9.1 and `docs/templates/backlog-item.md`. When an item completes, **move** (don't duplicate) it into `docs/done.md`.

> All items below originated in the bootstrap sprint S-000 and are now queued for the next discovery sprint (S-001) per `docs/plan.md`. None are Ready yet — the discovery sprint will refine them.

---

- ID: BLG-0001
  Title: Define the abstract parser interface and `ParsedReceipt` model
  Status: planned
  Owner: parser-specialist
  Type: parser
  Outcome: A typed, country-agnostic interface so adding RO/IT/PT/ES adapters never disturbs call sites or schema.
  Acceptance:
  - `BaseReceiptParser` lives in `backend/app/parsers/base.py` with `country_code`, `can_parse(qr_url)`, `parse(qr_url)`.
  - `ParsedReceipt` Pydantic v2 model covers every field in `AGENTS.md` §5.3.3.
  - At least one concrete adapter (GR) implements it.
  Approach: ADR in S-001 finalizes the interface; bootstrap stub in S-000 is replaced once accepted.
  Size: M
  Impact-notes: { country-code: yes }
  Links: []

- ID: BLG-0002
  Title: Design `POST /receipts/parse` contract and Supabase RLS interaction
  Status: planned
  Owner: architect
  Type: engineering
  Outcome: Clear, RLS-compatible flow from QR URL → parsed receipt → stored under the calling user's `auth.uid()`.
  Acceptance:
  - ADR records the request/response shape, error model, idempotency story, and how `MARK` uniqueness per user is enforced.
  - Contract aligns with `AGENTS.md` §5.3.2.
  Approach: Discovery debate per `chair-adr-debate.md`.
  Size: M
  Impact-notes: { rls: yes, country-code: yes }
  Links: []

- ID: BLG-0003
  Title: Design the scanner UX (permission, domain validation, retry)
  Status: planned
  Owner: product-designer
  Type: product
  Outcome: A first-time-correct scanning experience for Greek consumers.
  Acceptance:
  - DES artifact covers permission denial, non-supported QR, network failure, success → detail.
  - Greek-first strings + English fallback specified.
  Approach: Co-author with `mobile-builder` and `localization-specialist`.
  Size: M
  Impact-notes: { localization: yes }
  Links: []

- ID: BLG-0004
  Title: Acquire and curate the first 5 real-receipt fixtures
  Status: planned
  Owner: parser-specialist
  Type: parser
  Outcome: A baseline fixture set so the GR parser can be verified end-to-end at 100% accuracy.
  Acceptance:
  - 5 triplets under `backend/tests/fixtures/receipts/gr/<id>/` per `refresh-fixtures.md`.
  - Each has `provenance.md` with consent.
  - `backend/tests/parsers/test_gr.py` exists and walks them.
  Approach: Recruit 5 receipt holders OR collect public test receipts, with `security-privacy-officer` co-sign.
  Size: M
  Impact-notes: { external-surface: e-invoicing.gr }
  Links: []

- ID: BLG-0005
  Title: Phone-OTP authentication ADR
  Status: planned
  Owner: security-privacy-officer
  Type: security
  Outcome: A specific provider, flow, and rate-limit story for phone OTP login.
  Acceptance:
  - ADR records: provider choice, fallbacks, rate limits, GDPR posture, attack model (SIM swap, brute force), session handling.
  - Co-signed by `data-architect`.
  Approach: Default is Supabase native phone OTP; ADR confirms or selects an alternative.
  Size: S
  Impact-notes: { rls: yes, external-surface: maybe }
  Links: []

- ID: BLG-0006
  Title: Insights computation strategy ADR (views vs in-process)
  Status: planned
  Owner: architect
  Type: engineering
  Outcome: Decide where week/month/year aggregations live so we hit the 5-second receipt-display target without coupling logic.
  Acceptance:
  - ADR with rounds, decision, dissent.
  - Includes a sketch of the SQL or Python path.
  Approach: Discovery debate.
  Size: S
  Impact-notes: {}
  Links: []

- ID: BLG-0007
  Title: Offline cache strategy ADR (sqlite vs AsyncStorage vs in-memory)
  Status: planned
  Owner: mobile-builder
  Type: engineering
  Outcome: Receipts viewable offline once they have been seen at least once; aligns with the "fast" quality-bar.
  Acceptance:
  - ADR with rounds, decision, dissent.
  - Storage size, eviction, and sync semantics specified.
  Approach: Discovery debate.
  Size: S
  Impact-notes: {}
  Links: []

- ID: BLG-0008
  Title: Stand up CI to run `make check` on every change
  Status: planned
  Owner: devops-engineer
  Type: engineering
  Outcome: `make check` is enforced automatically, not only locally.
  Acceptance:
  - `.github/workflows/ci.yml` (or equivalent) runs on push + PR.
  - Caches `pip` and `npm` dependencies.
  - Fails the job on any red gate.
  Approach: Standard GitHub Actions; co-signed by `engineering-manager`.
  Size: S
  Impact-notes: { external-surface: github.com (already implicit) }
  Links: []
