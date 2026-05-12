# S-012 — Implementation: Mobile QR-validator discriminated-union shape

Sprint type: **implementation** (per `AGENTS.md` §4.1.1).

Theme: **`mobile-qr-validator-shape`** — ship the on-device QR-validator shape from ADR-0014 §1 ahead of the gated backend adapters. The plan from S-011 close (`docs/plan.md` "Sizing risk") explicitly permits this: *"BLG-0032 can ship the shape (discriminated union + tests for E-invoicing + AADE patterns) ahead of either adapter landing — the mobile validator should be allowed to discriminate even if the backend adapter returns 'limited info pending.'"*

Chair: `orchestrator` (process). Driver: `mobile-builder`. Sign-offs at review per `AGENTS.md` §4.11: `mobile-builder`, `parser-specialist`, `qa`, `localization-specialist` (no new strings, but mirrors the family discrimination DES-0001 references).

Start: 2026-05-12.

## Why this sprint

- The S-011 review queued **four Ready items** for S-012: BLG-0030 (AADE HTML-shape spike), BLG-0027 (AADE adapter), BLG-0028 (Epsilon Net adapter), BLG-0032 (mobile QR-validator mirror).
- BLG-0030 is gated on a **consented AADE receipt** under `AGENTS.md` §5.8.1 — no fixture acquired yet.
- BLG-0027 is gated on BLG-0030's outcome.
- BLG-0028 is gated on a **consented Epsilon Net fixture** under §5.8.1 — no fixture acquired yet.
- BLG-0032 is the *only* Ready item with no fixture gate: it ships pure on-device validation logic mirroring the backend `can_parse` shapes documented in ADR-0014 §3.

User typed plain `go` with no direction. Per `.agents/agents/go.md` operating rule #3 ("No mid-sprint questions … choose the smallest plausible path consistent with the rules") this sprint is scoped tightly to BLG-0032. The three fixture-gated items carry to S-013.

## Goals

Ship **BLG-0032** (S) — Mobile `validateGrQrCode` discriminated-union mirror.

- `mobile/src/parsers/gr.ts` exposes `validateGrQrCode(input: string)` returning a discriminated union covering all three Greek QR families documented in ADR-0014 §3:
  - `einvoicing` — `https://e-invoicing.gr/edocuments/ViewInvoice/-1/<uuid>_<token>` (existing path regex, unchanged for backwards-compat with `mobile/__tests__/parsers/gr.test.ts`'s pinned-source assertion).
  - `aade` — `https://www1.aade.gr/tameiakes/myweb/q1.php?SIG=<hex>$` (Family A per ADR-0014 §3).
  - `epsilon` — `https://epsilondigital-3rdpartc.epsilonnet.gr/fd/<hash>:<n>$` (Family B per ADR-0014 §3).
  - `unknown_code` — non-URL hex strings of plausible fiscal-code length (Family C placeholder per ADR-0014 §3, awaiting BLG-0029 identification).
- Existing `validateGrQrUrl(qrUrl)` stays as a **delegate** to `validateGrQrCode` narrowed to the e-invoicing-only happy path, preserving the existing return shape (`{ ok: true; uuid; token }` | `{ ok: false; reason }`). This keeps every existing caller (`mobile/src/api/receipts.ts`, `mobile/src/screens/ScannerScreen.tsx`) green at the type level; behavior on every existing test input is byte-identical.
- `mobile/src/screens/ScannerScreen.tsx` consumes `validateGrQrCode` so the camera handler can tell **which family** matched. A new module-level constant `IMPLEMENTED_FAMILIES = new Set(["einvoicing"])` documents *why* AADE / Epsilon / `unknown_code` are still routed to the existing `unsupported_qr` state today: their backend adapters (BLG-0027 + BLG-0028) have not landed yet. When BLG-0027 + BLG-0028 ship in S-013, widening `IMPLEMENTED_FAMILIES` is a one-line change that flips both adapters on simultaneously.
- `mobile/src/api/receipts.ts` keeps using `validateGrQrUrl` as its defense-in-depth pre-flight check — the backend `POST /receipts/parse` route only knows the e-invoicing.gr family today, so submitting AADE / Epsilon URLs there would just round-trip a 422 with `UnsupportedQrUrl`. We catch that on-device for a cleaner UX message.
- New unit tests in `mobile/__tests__/parsers/gr.test.ts`: at least one accept + one reject case per family plus the `unknown_code` branch plus the existing `validateGrQrUrl` regression suite.

## Out of scope

Carried to S-013:

- **BLG-0030** — AADE HTML-shape spike. Gated on a consented AADE receipt under `AGENTS.md` §5.8.1. No receipt acquired in this sprint.
- **BLG-0027** — AADE tameiakí adapter. Gated on BLG-0030 outcome.
- **BLG-0028** — Epsilon Net adapter. Gated on a consented Epsilon Net fixture under §5.8.1.
- **BLG-0029** — Family C identification spike. Gated on project-owner photo + system name; not yet provided.

Explicitly out of scope for this sprint:

- No backend changes. The parser registry stays as it is today (`einvoicing` only).
- No new outbound hosts contacted. The `www1.aade.gr` and `epsilondigital-3rdpartc.epsilonnet.gr` allowlist entries from S-010 stay scoped to BLG-0030 / BLG-0027 / BLG-0028 — none of which run in S-012.
- No schema migration. The `is_limited_info` column on `receipts` is part of BLG-0027 acceptance; it does not land until S-013.
- No new i18n strings. `scanner.error.unsupported.toast` is sufficient for the AADE / Epsilon / unknown-code path today (the family detail is local-only telemetry / future-proofing, not user-visible).

## Ready items pulled

- **BLG-0032** — Mobile `validateGrQrCode` — discriminated-union mirror for the three GR QR families. Owner: `mobile-builder`. Size: S.

## Risks & known unknowns

- **`unknown_code` regex over-trigger.** The Family C example (`45C07BD642067E5`) is a 15-hex-char string. A naive `^[0-9A-Fa-f]{8,64}$` could match legitimate URLs after a malformed scan or false-positive on short hex blobs. Mitigation: the validator only checks the `unknown_code` pattern *after* URL parsing fails (so any string `new URL()` accepts cannot fall into this branch), and the length bound starts at 12 hex chars to filter out tiny accidents.
- **Family ordering matters.** First-match-wins on the families. e-invoicing.gr's path regex is so specific it cannot accidentally match an AADE or Epsilon URL (different hostnames), and AADE / Epsilon shapes are mutually exclusive at the hostname level. Tested explicitly.
- **`validateGrQrUrl` is exported and used by other modules.** The delegate must preserve `{ ok: true; uuid; token }` and the exact set of failure reasons (`"scheme" | "host" | "path" | "malformed"`). Pinned by the existing tests in `mobile/__tests__/parsers/gr.test.ts`.

## User direction (`go` invocation)

- Direction: **`go`** with no further text.
- Honored in scope: **yes** — defaulted to the smallest Ready item not gated on consented fixtures, per `.agents/agents/go.md` rules 1 + 3.

## Definition of Done

Per `AGENTS.md` §4.7:

- `mobile/src/parsers/gr.ts` exports `validateGrQrCode` returning the discriminated union; `validateGrQrUrl` stays as a delegate.
- `mobile/src/screens/ScannerScreen.tsx` consumes `validateGrQrCode` and gates submission on `IMPLEMENTED_FAMILIES`.
- `mobile/__tests__/parsers/gr.test.ts` covers every family branch + the existing `validateGrQrUrl` suite.
- Mobile typecheck + Jest green.
- Backend untouched, so the 143-test backend suite stays green.
- `make check` green (target: 389 → ~400 tests).
- LOG entries for the run, REV at close, UREV with the manual verification script (just `cd mobile && npx jest __tests__/parsers/gr.test.ts` since the validator is pure-logic and has no expo runtime dependencies).
- `AGENTS.md` §2.6 amended with BLG-0032's user-visible behavior (still "no AADE / Epsilon support yet" because backend adapters are still gated — but the on-device validator now classifies them as a recognized-but-not-yet-implemented family); §2.7 snapshot at sprint close.
- `docs/plan.md` rewritten for S-013; `docs/backlog.md` moves BLG-0032 to `docs/done.md`; BLG-0027 + BLG-0028 + BLG-0030 + BLG-0029 stay Ready / planned.

## Notes

- The PowerShell `make check` quirk on the Greek folder name persists. The S-012 LOG records the direct binary invocations (`npx jest`, `npx tsc --noEmit`) used.
- No new runtime dependencies. No new outbound hosts. No new MCP integrations. The `agent-safety-officer` audit trail in the LOG is `none` across the board.
- ADR-0014 §1 is the contract for `validateGrQrCode`'s shape. Implementation follows it verbatim.
