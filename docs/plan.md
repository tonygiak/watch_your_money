# Plan

The current direction of the project and the focus of the next sprint.

## Where we are right now

Sprint **S-005 (discovery, `freelancer-mode`)** has just closed. It settled the five contracts that gate every S-006 user-visible item plus the SDK-upgrade unblocker:

- **ADR-0008 — Tag-as-business UX.** Inline tag-on-detail is the MVP critical path; Profile-level period import deferred. `POST /receipts/{id}/tag` Bearer-JWT-protected, body `{ is_business, category?, notes? }`, server-side trim + lowercase + length caps, idempotent 200, optimistic UI on the mobile client. No schema migration.
- **ADR-0009 — PDF export pipeline.** `reportlab==4.2.5` — pure-Python, no system deps, no new outbound surface, full Greek glyph coverage via bundled `DejaVuSans`. PDF on-the-fly + `StreamingResponse`, never persisted server-side, never logged. `weasyprint` rejected (Cairo / Pango / GTK Dockerfile cost); server-side `puppeteer` rejected (would have added `storage.googleapis.com` to the allowlist).
- **ADR-0010 — Inferred-category heuristic.** Stay deferred with three concrete re-evaluation triggers: ≥ 100 tagged receipts, OR explicit user demand, OR supply-chain shift. LLM-API call directly forbidden by `AGENTS.md` §2.4 — recorded as rejected so a future agent doesn't re-debate without amending §2.4.
- **ADR-0011 — `tzdata` codification.** Standalone ADR; pin `tzdata==2024.2` in `backend/requirements.txt`. PSF-maintained data-only shim; PyPI already on the allowlist. Closes the BLG-0013 audit-trail gap from S-004.
- **ADR-0012 — Expo SDK 51 → 54 upgrade.** Target SDK 54 (matches Expo Go on iOS / Android stores). `npx expo install --fix` + `expo-doctor` clean + atomic single-PR commit in S-006. **Supersedes ADR-0007 §2** (the version table) only; the discipline (exact pins, lockfile, telemetry-off, single-PR install) carries forward. Both existing in-tree compat-matrix warnings (`netinfo`, `typescript`) re-aligned to the SDK 54 matrix. Encryption stack from ADR-0006 must survive byte-identically — round-trip test is BLG-0016 acceptance bullet 5. `react-native-chart-kit` (BLG-0014) expected to survive; if not, BLG-0014 collapses into the same S-006 PR.

Two design artifacts landed:

- **DES-0004** — Profile screen UX (layout, freelancer toggle, ΑΦΜ field with Greek MOD-11 validator, business-expenses PDF export with date-range picker, sign-out, accessibility, telemetry, full Greek copy).
- **DES-0005** — Tag-as-business inline flow on Receipt detail (state machine, optimistic UI, length caps, accessibility, telemetry, full Greek copy).

`make check` is green: backend 70 + mobile 128 = 198 tests across 13 suites — same as S-004 close (the only production-code touch was a comment-only update in `backend/requirements.txt`). Sprint smoke check confirmed.

One backlog item closed in-sprint:

- **BLG-0013** (`tzdata` codification) — moved to `docs/done.md` via the comment-only update anchored to ADR-0011.

Four backlog items refined to **Ready** for S-006:

- **BLG-0016** — Expo SDK 51 → 54 upgrade.
- **BLG-0017** — Profile screen + freelancer toggle + ΑΦΜ field + sign-out (mobile + thin backend `PATCH /users/me`).
- **BLG-0018** — Tag-as-business endpoint + Receipt-detail UX.
- **BLG-0019** — PDF export endpoint + Profile export action.

Five backlog items stay planned: BLG-0004 (real-receipt fixtures), BLG-0009 (drift-detection CI), BLG-0011 (Profile language switch — out of MVP), BLG-0014 (`react-native-chart-kit` re-eval — cross-referenced to ADR-0012 §6), BLG-0015 (live insights-RPC integration test).

For the latest user-facing snapshot, read `AGENTS.md` §2.6 (shipped features unchanged from S-004 — Login, Insights, encrypted cache, runnable Scanner) and §2.7 (sprint snapshot now reflects S-005 closing).

## Next sprint

- **Type**: `implementation`.
- **Theme proposal**: `freelancer-mode-and-sdk-upgrade`.
- **Number**: **S-006**.
- **Why implementation, not discovery**: four items (BLG-0016, BLG-0017, BLG-0018, BLG-0019) are now Ready per `AGENTS.md` §4.1.3. Per `AGENTS.md` §4.1.2, an implementation sprint must follow when the Ready queue is non-empty.

### Goals for the implementation sprint S-006

The driving outcome is to **close `AGENTS.md` §2.8 bullets 8 + 9** (tag a receipt as a business expense; export tagged business expenses as a PDF) **and** restore on-device verification on stock Expo Go. After S-006, every bullet in §2.8 is reachable end-to-end on a real Greek consumer's phone.

1. **BLG-0016 — Expo SDK 51 → 54 upgrade. Land first.** Per ADR-0012, `npx expo install --fix` against a clean clone, `expo-doctor` until clean, regenerate `mobile/package-lock.json`, atomic single-PR commit including `eas.json` profile bumps. Run the encryption-stack round-trip test (BLG-0016 acceptance bullet 5) before merge — pre-upgrade encrypted state must decrypt byte-identically under SDK 54. If `react-native-chart-kit` doesn't survive, BLG-0014 collapses into the same PR with a swap. **This must merge first** so the freelancer-mode UREV (BLG-0017 / 0018 / 0019) can be exercised on a real Expo Go device end-to-end.
2. **BLG-0017 — Profile screen.** Implement DES-0004: `mobile/src/screens/profile/ProfileScreen.tsx` + `mobile/src/screens/profile/state.ts` reducer + `mobile/src/lib/afm.ts` Greek MOD-11 validator + `mobile/src/api/profile.ts` Bearer-JWT client. Backend: `PATCH /users/me` per DES-0004 §4 with `extra="forbid"`, server-side ΑΦΜ MOD-11 validation, idempotent partial update. Sign-out rotates `wym.cache.aes-256-gcm.v1` per DES-0004 §3.5.
3. **BLG-0018 — Tag-as-business endpoint + Receipt-detail UX.** Implement ADR-0008 + DES-0005: `mobile/src/screens/receipt/tag.state.ts` + `mobile/src/screens/receipt/TagPanel.tsx` (or inline in `ReceiptDetailScreen.tsx`). Backend: `POST /receipts/{id}/tag` per ADR-0008 §2, RLS + WHERE-guard, idempotent 200, response = full updated receipt. Greek `tag.*` strings.
4. **BLG-0019 — PDF export endpoint + Profile export action.** Implement ADR-0009 + DES-0004 §3.4: `backend/app/exports/business_expenses.py` query helper + `reportlab` PDF generator + `GET /export/business-expenses` route with `StreamingResponse`. Mobile: date-range picker on Profile screen + native share sheet via `expo-sharing` (or replacement if SDK 54 changes the dep). Greek `profile.export.*` strings.
5. **`make check` green at sprint close.** New tests added (per BLG acceptance bullets); existing 198 tests unchanged in shape. Aim: ~250 tests at S-006 close.
6. **Update `AGENTS.md` §2.6** (shipped features now include freelancer mode + PDF export) and §2.7 (S-006 close snapshot).

### Sequencing rule

S-006 sequences as **BLG-0016 first** (the SDK upgrade), then BLG-0017 / BLG-0018 / BLG-0019 in any order (or in parallel — they touch different surfaces: BLG-0017 = Profile screen + `users` write path; BLG-0018 = Receipt detail + `receipts` write path; BLG-0019 = Profile screen *and* a backend route + `reportlab`). Three reasonable strategies:

- **Strategy A (sequential)**: BLG-0016 → BLG-0017 → BLG-0018 → BLG-0019. Lowest cognitive load, easiest reviews. Slowest.
- **Strategy B (parallel)**: BLG-0016 lands first, then 0017 / 0018 / 0019 ride three feature branches in parallel. Fastest. Highest merge-conflict risk on `mobile/src/screens/profile/ProfileScreen.tsx` between BLG-0017 and BLG-0019 (both touch the Profile screen).
- **Strategy C (recommended)**: BLG-0016 first; then BLG-0018 (entirely separate surface — Receipt detail + new endpoint) and BLG-0017 in parallel; then BLG-0019 last (depends on BLG-0017 having landed the Profile screen scaffold). Balances speed and merge sanity.

S-006's `S-006-PLN-0001` should pick a strategy explicitly and record the choice.

### Acceptance test at S-006 review (implementation)

By the end of S-006:

- A real Greek freelancer with **stock Expo Go** (iOS or Android, latest store version) can:
  1. Sign in with their `+30` phone via Supabase native OTP.
  2. Scan a Greek `e-invoicing.gr` QR.
  3. Open the receipt and **tag it as a business expense** with a Greek category (e.g. `groceries`) and optional notes.
  4. Open Insights and confirm the tagged receipt's category appears in the by-category rollup.
  5. Open Profile, toggle freelancer mode on, type their ΑΦΜ (validated against the Greek MOD-11 checksum), save it.
  6. Choose a date range that includes the tagged receipt and tap "Δημιουργία PDF".
  7. Receive the streamed PDF via the native share sheet, open it (in Mail / Drive / Files / etc.), and see the cover (title + ΑΦΜ + range), the totals block, and the tagged receipt with its category and notes — all in Greek-rendered text.
  8. Sign out — the cache key namespace is rotated; the next sign-in by a different user starts with a clean cache.
- The encryption-stack round-trip test (BLG-0016 acceptance bullet 5) passes.
- `expo-doctor` reports zero compat-matrix warnings.
- `expo start` no longer prints the "packages should be updated for best compatibility" block.
- `make check`: ~250 tests, **green**.
- The eight `AGENTS.md` §4.11 sign-offs are recorded in `S-006-REV-0001`:
  - New endpoint / API contract: `architect` + `engineering-manager` (BLG-0017 / 0018 / 0019).
  - New mobile screen / UX flow: `product-designer` + `localization-specialist` (BLG-0017 / 0018 / 0019).
  - User-data flow: `security-privacy-officer` (BLG-0017 / 0018 / 0019 — ΑΦΜ as identifying data; `notes` never logged; PDF never persisted).
  - New runtime dependency: `agent-safety-officer` + `engineering-manager` (BLG-0016 supply-chain delta; BLG-0019 `reportlab`).
  - Schema migration: none (verified by `data-architect`).
  - Auth flow change: none.
  - Sprint scope change mid-sprint: none expected.
  - Adding / retiring an agent: none.

### Cadence after that

- **S-007 — discovery (likely)** — opens the door to one of: (a) country expansion (RO / IT / PT / ES adapters per `AGENTS.md` §5.9 — first non-GR adapter ADR), (b) BLG-0004 + BLG-0009 (real-receipt fixtures + drift-detection CI) if consenting users have come forward, (c) post-MVP UX gaps surfaced by user feedback during S-006. Choice driven by `product-owner` / `product-manager` reading actual S-006 user response.
- **S-008 — implementation** — whichever S-007 ADRs settle into Ready items.

## Open questions queued for S-006 implementation

- **`expo-sharing` survival under SDK 54** — if it doesn't survive, BLG-0019 picks a replacement (`react-native-share` is the most common alternative); `agent-safety-officer` review folded into BLG-0019.
- **`DateTimePicker` choice** — DES-0004 §9 leaves `@react-native-community/datetimepicker` as the default contingent on SDK 54 compatibility. If the SDK 54 expected matrix doesn't include it, `mobile-builder` picks a small alternative; `agent-safety-officer` review folded into BLG-0019 or BLG-0017.
- **Toast UI library** — DES-0005 §9 leaves the toast / non-blocking-notification choice to the implementer. If a new dep is needed, `agent-safety-officer` reviews; if not (a tiny custom toast is fine), no allowlist or ADR change.
- **`react-native-chart-kit` survival under SDK 54** — covered by ADR-0012 §6: if it doesn't survive, BLG-0014 collapses into BLG-0016. Nothing more to decide pre-S-006.
- **Encryption-stack round-trip test wiring** — BLG-0016 acceptance bullet 5. If pre-upgrade encrypted state can't be reproduced cleanly (e.g. the test infrastructure can't set up a "before" state), the alternative is a forward-only test: encrypt + decrypt both under SDK 54 with a known plaintext, asserting the AES-256-GCM round-trip is unbroken. ADR-0006 §2 says nothing about the test wiring; `mobile-builder` + `qa` pick the cleanest path.

## Notes for whoever picks this up

- **The five S-005 ADRs are done.** Tag UX, PDF pipeline, inferred-category posture, `tzdata` codification, and the SDK 54 upgrade plan all locked. `AGENTS.md` §2.6 lists what's *shipped* (still S-004's set); §2.7 carries the S-005 close snapshot; S-006 ships the rest of MVP.
- **Implementation sprints don't take new architectural decisions.** S-006 implements against ADR-0008..0012 and DES-0004..0005. If S-006 hits an unexpected decision, it's logged as `drift` in the backlog and queued for the next discovery sprint; the simplest temporary path is taken to keep `make check` green.
- **BLG-0016 lands first.** Without it, the on-device acceptance test in S-006-UREV-0001 cannot run on stock Expo Go — same blocker that surfaced in S-004 UREV addendum. Sequence is non-negotiable for the §2.8 mobile-first acceptance bar.
- **The PDF must never be persisted server-side.** ADR-0009 §3 is hard. Any S-006 implementation that buffers the PDF to disk (caching, "draft" preview, etc.) is drift and needs an ADR-0009 amendment first.
- **`category` is lowercased server-side, not client-side.** The mobile client preserves the user's input as typed; the server normalizes. This is what makes the by-category rollup collapse `"Groceries"` and `"groceries"` correctly.
- **The encryption stack contract** — `@noble/ciphers` AES-256-GCM, key in `expo-secure-store` under `wym.cache.aes-256-gcm.v1`, IV via `expo-crypto.randomBytes(12)` — must survive the SDK 54 upgrade byte-identically. If any of those changes behavior, the upgrade blocks until ADR-0006 amends. This is BLG-0016 acceptance bullet 5 and ADR-0012 §5.
- **PowerShell `make check` quirk persists**: bare `make check` may misresolve the target on some PowerShell sessions; use `& "C:\Program Files (x86)\GnuWin32\bin\make.exe" -f Makefile check`. Logged in `S-003-LOG-0001`, `S-004-LOG-0001`, and `S-005-LOG-0001`. PowerShell's stderr stream tags Jest "PASS rn..." lines as `NativeCommandError` — cosmetic, exit code 0 is the source of truth.
