# Context: Decisions

Index of recorded ADRs. Each entry links to the canonical file under `docs/adr/`.

The init run did not produce ADRs — the structural choices in `AGENTS.md` (no OCR, RLS-required, country-agnostic schema, pluggable parser, secrets via env) are mission-level constraints recorded directly in the entry file. New decisions taken in subsequent sprints land here as they are written.

## Index

- **ADR-0001** — *Parser interface, `ParsedReceipt` model, and VAT-rate normalization* — accepted 2026-04-29 — `docs/adr/S-001-ADR-0001-Parser-interface.md`. Locks the country-agnostic parser contract: `BaseReceiptParser` shape, `ParsedReceipt` schema for every `AGENTS.md` §5.3.3 field, the `ParserError` taxonomy (`UnsupportedQrUrl`, `ParserFetchError`, `ParserUpstreamError`, `ParserDriftError`, `EmptyReceiptError`), country resolution rules, and VAT-rate stored as **percent number** (`24.00`).
- **ADR-0002** — *`POST /receipts/parse` contract + Supabase RLS interaction + `MARK` idempotency* — accepted 2026-04-29 — `docs/adr/S-001-ADR-0002-Receipts-parse-endpoint.md`. Bearer JWT auth, body shape `{ qr_url }` (the ADR explicitly supersedes the literal `AGENTS.md` §5.3.2 wording per §4.4 tie-breaker), 201/200+`is_duplicate` happy path, RFC-7807-style errors, idempotency via `(user_id, mark)`. Generated follow-up BLG-0010.
- **ADR-0003** — *Scanner UX flow (permission, domain validation, retry)* — accepted 2026-04-29 — `docs/adr/S-001-ADR-0003-Scanner-ux-flow.md`. Reducer-based state machine, `expo-camera` (single dependency), on-device domain validation **before** any network call, duplicate-as-success, Greek-first default. Companion: `docs/sprints/S-001-discovery-receipt-parser-contract/S-001-DES-0001-Scanner-ux.md`. Generated follow-up BLG-0011.
- **ADR-0004** — *Phone-OTP provider, flow, rate limits, and GDPR posture* — accepted 2026-04-30 — `docs/adr/S-003-ADR-0004-Phone-otp-provider.md`. Supabase native phone OTP via `@supabase/supabase-js`; no widening of the outbound surface; 14-day refresh tokens; on-device E.164 normalizer; enumeration / brute-force defenses; explicit rejection of direct Twilio. Companion: `docs/sprints/S-003-discovery-auth-and-cache/S-003-DES-0002-Login-ux.md`. Resolves BLG-0005.
- **ADR-0005** — *Insights computation strategy (PostgREST RPCs + FastAPI orchestration)* — accepted 2026-04-30 — `docs/adr/S-003-ADR-0005-Insights-computation.md`. Two RPC functions for week / month / year + previous-period math; period boundaries computed in Europe/Athens; decimal-as-string in responses; categories = `business_category` ∪ `"untagged"`; inferred-category deferred. Extends ADR-0002's "no client-supplied identity" rule to insights endpoints. Companion: `docs/sprints/S-003-discovery-auth-and-cache/S-003-DES-0003-Insights-ux.md`. Resolves BLG-0006.
- **ADR-0006** — *Offline cache strategy + at-rest encryption* — accepted 2026-04-30 — `docs/adr/S-003-ADR-0006-Offline-cache-strategy.md`. AsyncStorage + AES-256-GCM (`@noble/ciphers`) with the symmetric key in `expo-secure-store`; LRU cap at 200 receipts; cacheable-subset sanitizer (default-deny); offline UX states (banner, disabled actions). Resolves BLG-0007.
- **ADR-0007** — *Expo runtime tree (pinned package set + gate re-inclusion)* — accepted 2026-04-30 — `docs/adr/S-003-ADR-0007-Expo-runtime-tree.md`. Expo SDK 51 with 17 runtime + 6 dev packages, exact-pinned; `package-lock.json` committed; `npm ci` discipline; `EXPO_NO_TELEMETRY=1` default; gate re-inclusion of `ScannerScreen.tsx` + `mobile/src/api/receipts.ts`. `agent-safety-officer` supply-chain review captured in the ADR. Resolves BLG-0012.

## Conventions

- ADR files: `docs/adr/S-<NNN>-ADR-<CCCC>-<title>.md`.
- One ADR per decision. No batching.
- Status flow: `proposed → accepted → (superseded-by ADR-<id>)`.
- Co-signs required:
  - new external surface (host / MCP server / dependency) → `agent-safety-officer` + `architect`,
  - schema migration / new RLS policy → `data-architect` + `security-privacy-officer`,
  - new EU adapter → `parser-specialist` + `architect` + `data-architect`,
  - API contract change → `architect` + `engineering-manager`,
  - new mobile screen / UX flow → `product-designer` + `localization-specialist`.
