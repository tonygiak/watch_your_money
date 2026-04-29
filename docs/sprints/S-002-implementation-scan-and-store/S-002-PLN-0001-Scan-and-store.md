# Sprint S-002 — Scan-and-store (implementation)

- Type: implementation
- Theme: scan-and-store
- Start: 2026-04-29
- Chair: orchestrator
- Participants: orchestrator, backend-builder, mobile-builder, parser-specialist, qa, engineering-manager, devops-engineer, security-privacy-officer, agent-safety-officer, localization-specialist, product-designer (visual QA), go

## Why this sprint

S-001 (discovery) closed accepting ADR-0001 (parser contract), ADR-0002 (`POST /receipts/parse`), ADR-0003 + DES-0001 (scanner UX). Five backlog items moved to **Ready**. Per `AGENTS.md` §4.1.2 the next sprint must be implementation. This sprint pulls those Ready items and ships the first user-visible behavior toward the §2.5 quality bar (a Greek QR appears in the app within 5 seconds).

## Goals

1. **BLG-0001** — wire the GR adapter to ADR-0001: full §5.3.3 extraction (merchant + metadata + line items + totals + payment) and the `ParserError` taxonomy.
2. **BLG-0004** — ship at least one fixture triplet so BLG-0001 can prove green at 100% accuracy via the network-free `parse_html` path. Real-receipt acquisition (4 more triplets with explicit consent) stays open in `BLG-0004` until consenting users are available; this sprint commits one synthetic triplet that exercises every §5.3.3 field.
3. **BLG-0002** — ship `POST /receipts/parse` end-to-end: Bearer JWT verification, RFC-7807 errors, idempotency on `(user_id, mark)`, structured drift logging.
4. **BLG-0003** — ship the Scanner reducer + i18n + shared regex per ADR-0003 / DES-0001. The pure, testable parts (state machine, validator, strings) land in this sprint with full unit coverage; the Expo runtime wiring (`expo-camera`, `react-native`) is split off as **BLG-0012** because installing the full Expo dependency tree is a new external surface that needs its own ADR co-sign by `agent-safety-officer` and `engineering-manager` (`AGENTS.md` §3.2.1, §4.11).
5. **BLG-0008** — wire `make check` into GitHub Actions on `push` and `pull_request`.

## Scope

**In:**
- Backend: extended `ParsedReceipt` extraction, `ParserError` subclasses, `POST /receipts/parse`, in-process JWT verifier (stdlib only — no new runtime dependency), problem-detail error envelope, idempotent storage layer, contract tests.
- Backend tests: parser tests against the new fixture, route contract tests, JWT verifier tests.
- Fixtures: one synthetic GR triplet (`gr-001-supermarket`) covering every §5.3.3 field with an honest `provenance.md` marking it synthetic.
- Mobile: scanner reducer (`src/screens/scanner/state.ts`), shared GR validator (`src/parsers/gr.ts`), full i18n string table for `scanner.*` and Greek-first locale detection, plus tests.
- Mobile: `ScannerScreen.tsx` written against the reducer + `expo-camera`, kept out of typecheck/tests until BLG-0012 lands the Expo runtime deps.
- CI: `.github/workflows/ci.yml` running `make check` on push + PR.
- Docs: `docs/done.md` updated, `docs/plan.md` updated to point at S-003 discovery, `AGENTS.md` §2.6 + §2.7 refreshed.

**Out (explicitly):**
- Installing the full Expo + react-native runtime tree (BLG-0012). Captured as drift; queued for the next sprint with `agent-safety-officer` + `engineering-manager` co-sign per §4.11.
- Acquiring 4 more **real** GR receipt fixtures with consent (rest of BLG-0004). Stays open until real users opt in.
- ADR-0005 (phone OTP), ADR-0006 (insights), ADR-0007 (offline cache). Already queued for S-003 discovery.
- Any change to the outbound allowlist beyond what S-001 already covers (Supabase + e-invoicing.gr + GitHub Actions + package registries are all already implicit / on the allowlist).

## Ready items pulled

- **BLG-0001** — full GR adapter + `ParserError` taxonomy.
- **BLG-0002** — `POST /receipts/parse` end-to-end.
- **BLG-0003** — Scanner reducer + i18n + shared regex (testable parts; runtime wiring split to BLG-0012).
- **BLG-0004** — first fixture triplet (synthetic). The 4 real-receipt fixtures stay in BLG-0004 until acquisition is possible.
- **BLG-0008** — GitHub Actions CI for `make check`.

## Risks & known unknowns

- **Risk: in-process JWT verification needs a library**. *Mitigation*: hand-roll HS256 verification using only `hmac`, `hashlib`, `base64`, `json`, `time` (stdlib). Avoids a new runtime dep and keeps the auditable surface tiny.
- **Risk: synthetic fixture diverges from real `e-invoicing.gr` HTML**. *Mitigation*: adapter uses a label-driven extractor (matches text labels like `ΑΦΜ`, `MARK`, `ΤΕΛΙΚΗ ΑΞΙΑ`) instead of brittle CSS class selectors; the same label set works against a real receipt. When a real fixture lands (BLG-0004 follow-up), any divergence surfaces as `ParserDriftError` and is fixed in a discovery sprint per `AGENTS.md` §4.10.
- **Risk: full Expo install pulls hundreds of MB and many transitive packages mid-sprint, breaks the gate**. *Mitigation*: split out as BLG-0012 (drift). The reducer + validator + i18n parts of BLG-0003 are pure TS and need no Expo deps; they ship green this sprint.
- **Risk: ΔΟΥ field not in DB schema**. *Mitigation*: parser captures ΔΟΥ and concatenates it onto `merchant_address` (e.g. `"Λεωφ. Κηφισίας 100, Αθήνα — ΔΟΥ ΦΑΕ Αθηνών"`). Documented in the parser code. A schema field for ΔΟΥ would be a discovery-sprint decision (no schema change in a delivery sprint per §4.1.1).

## User direction (if `go` was used)

- Direction: empty (`go` with no further instructions).
- Honored in scope: yes — `go` deferred sprint-type selection to `orchestrator`, which picked implementation per §4.1.2 (Ready items present).

## Definition of done

- BLG-0001, BLG-0002, BLG-0003 (testable parts), BLG-0008 closed and moved to `docs/done.md`.
- BLG-0004 partially advanced (1 synthetic fixture shipped to unblock BLG-0001); BLG-0004 stays open for the 4 real-receipt triplets.
- New backlog item BLG-0012 created for "install Expo + react-native runtime deps and wire `ScannerScreen.tsx` into typecheck/tests" — `Ready: no` until ADR co-signs land.
- `make check` green at sprint close.
- GitHub Actions workflow running `make check` on push + PR.
- `docs/plan.md` updated to point at S-003 discovery (the next type per §4.1.2).
- `AGENTS.md` §2.6 (shipped features — first entries) and §2.7 (sprint snapshot) updated.
- Sprint REV + UREV written.
