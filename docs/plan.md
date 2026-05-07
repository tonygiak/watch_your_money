# Plan

The current direction of the project and the focus of the next sprint.

## Where we are right now

Sprint **S-006 (implementation, `freelancer-mode-and-sdk-upgrade`)** has just closed. Three of the four Ready items shipped against ADR-0008 + ADR-0009 + DES-0004 + DES-0005:

- **BLG-0017 — Profile screen + freelancer toggle + ΑΦΜ field + sign-out (mobile + thin backend `PATCH /users/me`).** Backend `PATCH /users/me` (Bearer JWT, body `{ is_freelancer?: bool, afm?: string | null }` with `extra="forbid"`, server-side ΑΦΜ MOD-11 validation, idempotent partial update via an `UNSET` sentinel that distinguishes "don't touch" from "set to null", response excludes `phone`, RFC-7807 errors). Mobile `ProfileScreen.tsx` with masked phone (`+30 6XX *** ****` per DES-0004 §3.1), freelancer toggle, ΑΦΜ TextInput, export block (per BLG-0019), sign-out CTA. Sign-out rotates `wym.cache.aes-256-gcm.v1` from `expo-secure-store` and clears every `wym.cache.receipt.*` + `wym.cache.index` from `AsyncStorage` per DES-0004 §3.5 / ADR-0006 §2. Greek `profile.*` strings shipped. ΑΦΜ MOD-11 validator in `backend/app/afm.py` + `mobile/src/lib/afm.ts` (mirrored, lockstep accept / reject).
- **BLG-0018 — Tag-as-business — `POST /receipts/{id}/tag` endpoint + Receipt-detail UX.** Backend endpoint per ADR-0008 §2 (Bearer JWT, server-side trim + lowercase on `category` 1..64, server-side trim on `notes` 0..500, idempotent 200, full updated receipt body, 404 no-enumeration for not-owned, 422 for malformed, 401 for missing JWT). `ReceiptStorage` Protocol gains `find_by_id` + `tag_receipt` with defense-in-depth `WHERE user_id = sub AND id = receipt_id` on every read + update. Mobile `tag.state.ts` reducer covering DES-0005 §2 states (`untagged_idle`, `tagged_idle`, `editing`, `saving`, `untagging`, `auth_error`); `TagPanel.tsx` rendering DES-0005 §3 layouts with `accessibilityRole="switch"` and 44-dp touch targets; `ReceiptDetailScreen.tsx` minimal scaffold. Greek `tag.*` + `receipt.*` strings shipped. Telemetry counts only — `category` / `notes` text never attached.
- **BLG-0019 — PDF export — `GET /export/business-expenses` endpoint + Profile export action.** Backend endpoint per ADR-0009 §2 (Bearer JWT, `to_date >= from_date` validation, 366-day cap, `Content-Type: application/pdf`, `Content-Disposition: attachment`, `Cache-Control: private, no-store`, `StreamingResponse` from in-memory bytes — never persisted, log line includes only `user_id` + `rows`). `reportlab==4.2.5` exact pin in `backend/requirements.txt` (transitive `pillow==12.2.0` + `chardet==7.4.3` install cleanly into `.venv`; PyPI on the allowlist). `backend/app/exports/business_expenses.py` ships the repository fake, the `sanitize_text()` PDF-injection defense (control chars + Unicode bidi marks stripped, NFC-normalized), and the `build_business_expenses_pdf(...)` reportlab generator (cover + totals + per-receipt rows + footer with page numbers; **bundled Bitstream-Vera fonts** for monotonic Greek glyph coverage; A4 + 2 cm margins; 120-char `notes` truncation; valid 200 PDF for empty period). Mobile export sub-flow on `ProfileScreen.tsx` per DES-0004 §3.4 (default range = first day of current local-month → today, client-side validation mirroring server rules, `Δημιουργία PDF` CTA, `exporting` spinner). The export action is wired against an injectable `shareImpl` prop today; the host App will fold `expo-sharing@14.0.7` + `expo-file-system@19.0.7` into the prop wiring once BLG-0016 lands the SDK 54 tree (BLG-0020 + BLG-0021).

The fourth Ready item was **deferred**:

- **BLG-0016 — Expo SDK 51 → 54 upgrade — deferred to S-007 per `AGENTS.md` §4.10.** The npm registry hung when probing the SDK 54 compat matrix (`npm view expo dist-tags`); the deferral keeps the in-tree SDK 51 pin set and the encryption stack from ADR-0006 §2 byte-identical, the outbound allowlist unchanged, and `make check` green. BLG-0016 stays Ready in `docs/backlog.md` and is the **first** item pulled in S-007. The on-device verification of the §2.8 freelancer-mode acceptance script (`S-006-UREV-0001` §A) is gated by BLG-0016; until S-007 ships it, BLG-0017 / 0018 / 0019 are exercised at the contract level via `make check`.

`make check` is **green at S-006 close: 143 backend + 197 mobile = 340 tests across 21 suites** (+142 vs. S-005 close baseline of 198 tests across 13 suites). Backend: `ruff check` + `mypy app tests` (52 source files clean) + `pytest` (143 passed). Mobile: `tsc --noEmit` clean + `jest` (197 passed across 18 suites — 13 pure-TS + 5 jest-expo render). No flaky tests, no skipped tests beyond the baseline.

Two new backlog items were opened at S-006 close (queued for S-007 to fold in once BLG-0016 lands):

- **BLG-0020** — Wire `expo-sharing` + `expo-file-system` into the Profile export `shareImpl` (replaces the injectable prop with the on-device share-sheet wiring).
- **BLG-0021** — Replace the plain `TextInput` date entry on Profile export with `@react-native-community/datetimepicker` (the SDK 54 expected matrix names this dep).

Five backlog items still planned across BLG-0004 / BLG-0009 / BLG-0011 / BLG-0014 / BLG-0015 (real-receipt fixtures, drift-detection CI, Profile language switch, chart-kit re-eval, live insights-RPC integration test); none were activated in S-006.

For the latest user-facing snapshot, read `AGENTS.md` §2.6 (shipped features now include freelancer mode + tag-as-business + PDF export — gated for on-device by BLG-0016) and §2.7 (sprint snapshot now reflects S-006 closing).

## Next sprint

- **Type**: `implementation`.
- **Theme proposal**: `sdk-upgrade-and-on-device-acceptance`.
- **Number**: **S-007**.
- **Why implementation, not discovery**: BLG-0016 is still Ready (deferred from S-006), and BLG-0020 + BLG-0021 are Ready as soon as BLG-0016 lands. The Ready queue is non-empty per `AGENTS.md` §4.1.2.

### Goals for the implementation sprint S-007

The driving outcome is to **finally run the freelancer-mode acceptance script on a real Greek consumer's stock Expo Go device** — closing the BLG-0016 deferral and unblocking the on-device half of `AGENTS.md` §2.8. After S-007 the §2.8 MVP is reachable end-to-end on a real phone, and the previously-deferred S-004 UREV addendum (`Login + Insights + offline cache + Scanner` on stock Expo Go) finally runs in the same pass.

1. **BLG-0016 — Expo SDK 51 → 54 upgrade. Land first.** Per ADR-0012 + the deferral note in `S-006-LOG-0001` 18:35 entry: `npx expo install --fix` against a clean clone, `expo-doctor` until clean, regenerate `mobile/package-lock.json`, atomic single-PR commit including `eas.json` profile bumps. Run the encryption-stack round-trip test (BLG-0016 acceptance bullet — the **forward-only** variant from S-005 plan "Open questions" §5 is the agreed path: encrypt + decrypt under SDK 54 with a known plaintext, asserting the AES-256-GCM round-trip is unbroken). If `react-native-chart-kit` doesn't survive, BLG-0014 collapses into the same PR with a swap.
2. **BLG-0020 — Wire `expo-sharing` + `expo-file-system` into the Profile export `shareImpl`.** Replace the test-time prop with the on-device share-sheet path; no business logic moves; only the host App composes the prop differently for production.
3. **BLG-0021 — Replace plain `TextInput` date entry on Profile export with `@react-native-community/datetimepicker`.** Reducer stays unchanged; only the way `EXPORT_FROM_CHANGED` and `EXPORT_TO_CHANGED` are emitted changes.
4. **`S-007-UREV-0001` runs the full §2.8 freelancer-mode acceptance script** (`S-006-UREV-0001` §A) **and** the previously-deferred S-004 UREV addendum (sign in → scan → Insights → offline → restore) on stock Expo Go (iOS or Android, latest store version) end-to-end.
5. **`make check` green at sprint close.** New tests added (BLG-0016 round-trip + small UI-swap render smoke for BLG-0020 / BLG-0021); existing 340 tests unchanged in shape. Aim: ~345 tests at S-007 close.
6. **Update `AGENTS.md` §2.6** (shipped features now include the SDK 54 tree + on-device share sheet) and §2.7 (S-007 close snapshot).

### Sequencing rule

S-007 sequences as **BLG-0016 first, then BLG-0020 + BLG-0021 in parallel** (they touch independent surfaces — share-sheet wiring vs. date-picker swap). Once those land, run `S-007-UREV-0001` on a real Expo Go device.

### Acceptance test at S-007 review (implementation)

By the end of S-007:

- A real Greek freelancer with **stock Expo Go** (iOS or Android, latest store version) runs the full eight-step script in `S-006-UREV-0001` §A end-to-end: sign in → scan → tag as business → Insights picks up the new bucket → Profile → ΑΦΜ MOD-11 validated → date range → `Δημιουργία PDF` → native share sheet → open the streamed PDF → sign out → cache key rotated.
- The same user also runs the previously-deferred S-004 UREV addendum (sign in → scan → Insights → offline → restore) in the same Expo Go session, end-to-end.
- The encryption-stack round-trip test (BLG-0016 acceptance bullet — forward-only variant) passes.
- `expo-doctor` reports zero compat-matrix warnings.
- `expo start` no longer prints the "packages should be updated for best compatibility" block.
- `make check` green.
- The §4.11 sign-offs are recorded in `S-007-REV-0001`:
  - New runtime dependency: `agent-safety-officer` + `engineering-manager` (the BLG-0016 transitive re-pin + the two SDK-54-matrix deps from BLG-0020 / BLG-0021).
  - New mobile screen / UX flow: `product-designer` + `localization-specialist` (the date-picker swap on Profile is a small UX delta from BLG-0021).
  - User-data flow: `security-privacy-officer` (encryption-stack survival; share-sheet hand-off does not expose new PII surface — the user picks the share target).
  - Schema migration: none.
  - Auth flow change: none.
  - Sprint scope change mid-sprint: none expected.
  - Adding / retiring an agent: none.

### Cadence after that

- **S-008 — discovery (likely)** — opens the door to one of: (a) country expansion (RO / IT / PT / ES adapters per `AGENTS.md` §5.9 — first non-GR adapter ADR), (b) BLG-0004 + BLG-0009 (real-receipt fixtures + drift-detection CI) if consenting users have come forward during S-006 / S-007 user testing, (c) post-MVP UX gaps surfaced by user feedback. Choice driven by `product-owner` / `product-manager` reading actual S-006 / S-007 user response.
- **S-009 — implementation** — whichever S-008 ADRs settle into Ready items.

## Open questions queued for S-007 implementation

- **`react-native-chart-kit` survival under SDK 54.** Covered by ADR-0012 §6: if it doesn't survive, BLG-0014 collapses into BLG-0016 with the swap. Nothing more to decide pre-S-007.
- **Toast UI library.** DES-0005 §9 leaves the toast / non-blocking-notification choice to the implementer. The S-006 mobile path uses a tiny custom toast surface owned by `ReceiptDetailScreen.tsx` — no new dep added; if a richer toast is wanted later, `agent-safety-officer` reviews. Nothing to decide pre-S-007.
- **On-device QR scanning under SDK 54.** Same Expo Camera API surface from ADR-0012 §2; expected to work without code changes. If the camera permission flow regressed (unlikely), it lands as drift in S-007.

## Notes for whoever picks this up

- **The S-005 ADRs + DES are still the contracts.** ADR-0008 (Tag-as-business UX), ADR-0009 (PDF export pipeline), ADR-0010 (inferred-category posture — deferred), ADR-0011 (`tzdata` codification), ADR-0012 (SDK upgrade) + DES-0004 (Profile screen) + DES-0005 (Tag-as-business inline flow) all locked. S-006 implemented against them; S-007 picks up the SDK upgrade and the two thin wiring follow-ups.
- **The contract-level acceptance for BLG-0017 / 0018 / 0019 is already complete.** S-007 doesn't re-test them; it adds the on-device verification on stock Expo Go and fills in the share-sheet + date-picker wiring.
- **The encryption-stack contract** — `@noble/ciphers` AES-256-GCM, key in `expo-secure-store` under `wym.cache.aes-256-gcm.v1`, IV via `expo-crypto.randomBytes(12)` — must survive the SDK 54 upgrade byte-identically. If any of those changes behavior, the upgrade blocks until ADR-0006 amends. This is BLG-0016 acceptance bullet 5 and ADR-0012 §5.
- **The PDF must never be persisted server-side.** ADR-0009 §3 stays hard. The S-006 implementation honors this (the `StreamingResponse` is from `BytesIO`, no temp file, no logging of bytes); S-007 doesn't change this contract — only the mobile share-sheet path (which is the user's chosen target, not ours).
- **`category` is lowercased server-side, not client-side.** Mobile preserves user input as typed; the server normalizes. This is what makes the by-category Insights rollup collapse `"Groceries"` and `"groceries"` correctly. The S-006 implementation honors this.
- **PowerShell `make check` quirk persists**: bare `make check` may misresolve the target on PowerShell sessions where the workspace path contains the Greek folder name `Υπολογιστής`. Workaround in `S-006-UREV-0001` §1: run `ruff check`, `mypy`, `pytest`, `tsc`, `jest` directly with the venv / npm binaries the Makefile would otherwise invoke. Logged in `S-003-LOG-0001`, `S-004-LOG-0001`, `S-005-LOG-0001`, and `S-006-LOG-0001`.
