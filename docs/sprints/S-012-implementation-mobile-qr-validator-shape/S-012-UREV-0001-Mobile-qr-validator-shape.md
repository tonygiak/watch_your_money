# Sprint S-012 — User review

## Where we are right now

S-012 (`mobile-qr-validator-shape`) closed 2026-05-12. **BLG-0032 shipped solo** — the smallest plausible Ready item not gated on consented fixtures, per `.agents/agents/go.md` rule #3 ("no mid-sprint questions"). The on-device QR validator at `mobile/src/parsers/gr.ts` now recognises **all three Greek receipt QR families** documented in ADR-0014 §3, plus the `unknown_code` placeholder branch for the Family C non-URL hex codes awaiting BLG-0029 identification. Backend adapters for AADE (BLG-0027) and Epsilon Net (BLG-0028) remain Ready in the backlog, still gated on consented fixtures under §5.8.1. `make check`: **411 tests across 21+ suites — green** (389 → 411, +22 from the new validator suite).

For the latest snapshot, read `AGENTS.md` §2.6 and §2.7 first.

## What changed

- `mobile/src/parsers/gr.ts` exports a new `validateGrQrCode(input: string)` returning a discriminated union: `{ ok: true; family: "einvoicing" | "aade" | "epsilon" | "unknown_code"; ... family fields } | { ok: false; reason: ... }`.
- The existing `validateGrQrUrl` stays as a delegate narrowed to the e-invoicing-only happy path. No existing caller breaks; `mobile/src/api/receipts.ts` defense-in-depth keeps surfacing non-einvoicing URLs as `host` so today's e-invoicing-only backend cannot be hit with an AADE or Epsilon URL.
- `mobile/src/screens/ScannerScreen.tsx` consumes `validateGrQrCode` and gates submission on a module-level `IMPLEMENTED_FAMILIES = new Set(["einvoicing"])`. AADE / Epsilon / `unknown_code` matches still surface as the existing "unsupported QR" toast today; **when BLG-0027 + BLG-0028 land in S-013, widening this set is a one-line change**.
- 22 new tests in `mobile/__tests__/parsers/gr.test.ts` cover every family + every rejection path + family disambiguation.
- No new i18n strings. No new outbound hosts. No new runtime dependencies. No backend changes. No schema migration.

## How to verify (delivery sprint)

The validator is pure TypeScript with no Expo runtime dependencies, so the entire delivery can be verified from the command line:

1. **Reproduce the green test run.**

   ```pwsh
   cd mobile
   npx tsc --noEmit
   npx jest __tests__/parsers/gr.test.ts --no-coverage
   ```

   Expected: tsc reports 0 errors; jest reports **29 passed, 0 failed**.

2. **Sanity-check the family disambiguation manually.** Open a Node REPL inside `mobile/`:

   ```pwsh
   cd mobile
   node --input-type=module -e "import('./src/parsers/gr.ts').then(m => { console.log(m.validateGrQrCode('https://e-invoicing.gr/edocuments/ViewInvoice/-1/abc-123_TOK')); console.log(m.validateGrQrCode('https://www1.aade.gr/tameiakes/myweb/q1.php?SIG=DEADBEEF')); console.log(m.validateGrQrCode('https://epsilondigital-3rdpartc.epsilonnet.gr/fd/abc:1')); console.log(m.validateGrQrCode('45C07BD642067E5')); })"
   ```

   Expected: four lines, each with `ok: true` and the right `family` discriminator (`einvoicing`, `aade`, `epsilon`, `unknown_code`).

   *(If running raw `.ts` via node is awkward on Windows, the same disambiguation is asserted by the `families are mutually exclusive at the host level` test in step 1.)*

3. **Confirm the existing-caller contract is preserved.** Re-run the full mobile + backend gates:

   ```pwsh
   cd mobile && npx jest --no-coverage
   cd ../backend && python -m pytest && ruff check . && mypy app
   ```

   Expected: mobile 19 suites / 229 passed; backend 182 passed; ruff clean; mypy 31 source files no issues.

4. **On-device sanity check (optional).** With Expo Go open and Metro running (`npx expo start` from `mobile/`), scan the existing e-invoicing.gr QR shape — receipt should still parse and store as before (no regression). Scanning an AADE `q1.php?SIG=...` URL or an Epsilon `epsilondigital-3rdpartc.epsilonnet.gr/fd/...:n` URL today surfaces the "this provider is not supported yet" toast and a dev-only `console.warn` showing the recognised family (e.g. `[scanner] QR family not yet implemented: aade`). This is the expected gating behaviour until BLG-0027 + BLG-0028 ship in S-013.

## Where to look next

- `AGENTS.md` §2.6 — shipped features (BLG-0032 entry just added).
- `AGENTS.md` §2.7 — current sprint snapshot.
- `docs/plan.md` — S-013 plan (`first-gr-adapter-expansions`; still fixture-gated).
- `docs/backlog.md` — BLG-0030, BLG-0027, BLG-0028 stay Ready; BLG-0029 stays planned; BLG-0033 + BLG-0034 stay post-MVP.
- `docs/done.md` — Sprint S-012 entry at the top with BLG-0032.

## How to act on this

- **If you have access to a Greek consumer receipt** (supermarket / pharmacy / fuel / restaurant) with an AADE `q1.php?SIG=...` QR or an Epsilon Net `epsilondigital-3rdpartc.epsilonnet.gr/fd/...` QR, please attach the photo + an explicit consent statement to your next message. That unblocks BLG-0030 (AADE spike) and BLG-0028 (Epsilon adapter), which is the gating step for S-013.
- **If you have a photo of the printed receipt that produced the 15-hex code `45C07BD642067E5`** (or any similar non-URL hex QR), please attach it. The system / cash-register manufacturer printed on the slip is what BLG-0029 needs to identify Family C.
