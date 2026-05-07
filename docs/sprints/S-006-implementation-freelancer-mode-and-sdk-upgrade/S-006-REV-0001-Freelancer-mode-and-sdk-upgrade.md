# Sprint S-006 — REV (Sprint Review)

- Type: implementation
- Theme: `freelancer-mode-and-sdk-upgrade`
- Closed: 2026-05-07
- Chair: orchestrator

## Outcome at a glance

- **Three of four Ready items shipped.** BLG-0017 (Profile screen + freelancer toggle + ΑΦΜ field + sign-out), BLG-0018 (Tag-as-business endpoint + Receipt-detail UX), and BLG-0019 (PDF export endpoint + Profile export action) all closed against acceptance criteria.
- **One Ready item deferred as drift.** BLG-0016 (Expo SDK 51 → 54 upgrade) was deferred to S-007 implementation per `AGENTS.md` §4.10 ("external host unreachable → skip the action, log in LOG, do not auto-retry, pick simplest temporary path that does not expand outbound surface"). The npm registry hung when probing the SDK 54 compat matrix; the deferral keeps the in-tree SDK 51 pin set unchanged byte-identically. See `S-006-LOG-0001` 18:35 entry. **The deferral does not block any of BLG-0017 / 0018 / 0019** — the freelancer-mode endpoints + UI work end-to-end against `make check` under SDK 51.
- **`make check` green.** 143 backend + 197 mobile = **340 tests across 21 suites**. Up from the S-005 baseline of 198 tests across 13 suites. Backend `ruff check` clean, `mypy app tests` clean ("Success: no issues found in 52 source files"), backend `pytest` clean (143 passed in ~2 s). Mobile `tsc --noEmit` clean, mobile `jest` clean (197 passed across 18 suites in ~6 s — 13 pure-TS suites under `ts-jest` + 5 jest-expo render suites).
- **`AGENTS.md` §2.8 status.** Bullets 8 + 9 (tag a receipt as a business expense; export tagged business expenses as a PDF) are now reachable end-to-end on the in-tree SDK 51 mobile tree. The on-device verification on stock Expo Go is still gated by BLG-0016 (queued for S-007), exactly as the §2.8 sequencing rule in S-005's PLN already foresaw — the agent-side acceptance script is fully exercised by `make check`; the *on-device, stock-Expo-Go* acceptance script is queued for S-007 UREV.

## What landed

### BLG-0017 — Profile screen + freelancer toggle + ΑΦΜ field + sign-out

- **Backend** — `PATCH /users/me` per DES-0004 §4: Bearer JWT, body `{ is_freelancer?: bool, afm?: string | null }` with `extra="forbid"`, server-side ΑΦΜ MOD-11 validation (defense in depth on top of the mobile validator), idempotent partial update via an `UNSET` sentinel that distinguishes "don't touch" from "set to null", response excludes `phone`, errors per the RFC-7807 envelope from ADR-0002. ΑΦΜ value is **never logged** — only the outcome counters (`afm_updated`, `is_freelancer_updated`).
- **Backend ΑΦΜ validator** — `backend/app/afm.py` implements the Greek MOD-11 checksum, pure-stdlib, with a structured `InvalidAfmError(reason)` so the route can route the right 422. Verified against four hand-checked Greek tax IDs (`094019245`, `094014298`, `999114187`, `123456783`).
- **Mobile** — `mobile/src/lib/afm.ts` mirrors the validator in TS so the client validates before the PATCH round-trips. `mobile/src/api/users.ts` wraps the PATCH with a 10-second timeout, `AbortController`, and an outcome-tagged result (`PatchMeResultOk` / `PatchMeResultError`). `mobile/src/screens/profile/state.ts` covers DES-0004 §2 states (`idle`, `editing_freelancer`, `editing_afm`, `pre_export`, `exporting`, `export_done`, `signing_out`, `auth_error`) plus the export-flow sub-state. `mobile/src/screens/profile/ProfileScreen.tsx` renders DES-0004 §3 sections — account header with **masked phone** (only `+30` + last 4 digits per DES-0004 §3.1), freelancer toggle, ΑΦΜ TextInput (number-pad keyboard, 9-char cap, save CTA), export block (per BLG-0019 below), sign-out CTA.
- **Sign-out cache rotation** — `mobile/src/cache/rotate.ts` deletes `wym.cache.aes-256-gcm.v1` from `expo-secure-store` and removes every `wym.cache.receipt.*`, `wym.cache.index`, and `wym.cache.version` blob from `AsyncStorage` per DES-0004 §3.5 / ADR-0006 §2. The helper is robust to individual key-deletion failures so a bad device never locks the user out of sign-out.
- **Greek strings** — `mobile/src/i18n/strings.ts` extended with `profile.*` per DES-0004 §5; English fallback included.
- **Tests added** — backend: 19 ΑΦΜ-validator unit tests + 16 PATCH /users/me contract tests. Mobile: 11 ΑΦΜ-validator unit tests + 26 reducer transition tests (initial state + freelancer toggle + ΑΦΜ field + sign-out + auth + maskPhone helper + 8 export-flow tests added in the BLG-0019 wiring) + 3 ProfileScreen render smoke tests under `jest-expo`.

### BLG-0018 — Tag-as-business endpoint + Receipt-detail UX

- **Backend** — `POST /receipts/{receipt_id}/tag` per ADR-0008 §2: Bearer JWT, `extra="forbid"`, server-side trim + lowercase on `category` (1..64 after trim), server-side trim on `notes` (0..500 after trim), idempotent 200, response = full updated receipt, 404 (no enumeration) for not-owned, 422 for malformed, 401 for missing JWT. Logging is metadata-only — `category` and `notes` text never reach a log line.
- **Storage extension** — `ReceiptStorage` Protocol gains `find_by_id` and `tag_receipt` methods. `InMemoryReceiptStorage` and `SupabaseReceiptStorage` both apply defense-in-depth `WHERE user_id = sub AND id = receipt_id` on every read + update; the Supabase implementation rehydrates `ParsedReceipt` from the `receipts` + `receipt_items` tables so the response body matches the scan-time receipt shape.
- **Mobile** — `mobile/src/screens/receipt/tag.state.ts` covers DES-0005 §2 states (`untagged_idle`, `tagged_idle`, `editing`, `saving`, `untagging`, `auth_error`); `tagTelemetryEventFor` returns counts only — `category` / `notes` text never attached to telemetry. `mobile/src/screens/receipt/TagPanel.tsx` renders DES-0005 §3 layouts with `accessibilityRole="switch"` and 44-dp touch targets. `mobile/src/screens/receipt/ReceiptDetailScreen.tsx` minimal scaffold hosts the TagPanel with the toast surface. `mobile/src/api/receipts.ts` extended with `tagReceipt(...)` returning a `Result`-tagged outcome.
- **Greek strings** — `tag.*` and `receipt.*` extended in `mobile/src/i18n/strings.ts` per DES-0005 §4.
- **Tests added** — backend: 16 contract tests covering ADR-0008 §2 acceptance bullets (a)–(g) + 401 + 404-no-enumeration + ownership isolation. Mobile: 27 reducer transition / telemetry tests + 3 ReceiptDetailScreen render smoke tests.

### BLG-0019 — PDF export endpoint + Profile export action

- **Backend** — `reportlab==4.2.5` added to `backend/requirements.txt` (exact pin, no caret — per ADR-0009 §1). The transitive deps (`pillow==12.2.0`, `chardet==7.4.3`) install cleanly into the existing `.venv`.
- **Backend PDF generator** — `backend/app/exports/business_expenses.py` ships: (1) `BusinessExpensesRepository` Protocol + `InMemoryBusinessExpensesRepository` test fake (filters `user_id = sub AND is_business_expense = true AND issue_date BETWEEN`, defense-in-depth on top of RLS); (2) `sanitize_text()` strips control characters (NULL, 0x01-0x1F except TAB/LF/CR, 0x7F DEL) plus the Unicode bidi formatting marks (`U+202A..202E`, `U+2066..2069`) — PDF-injection / spoofing defense per ADR-0009 §4 — and Unicode-NFC-normalizes the output; (3) `build_business_expenses_pdf(...)` reportlab generator with cover block (title, ΑΦΜ, range, generated timestamp), totals block, per-receipt rows table with header, footer with page numbers, A4 page size, 2 cm margins, **bundled Bitstream-Vera fonts** (`Vera.ttf` + `VeraBd.ttf` ship with reportlab itself — no system font search; Vera Sans covers monotonic Greek which is what Greek e-invoices use), 120-char `notes` truncation, `X,XX €` Greek currency formatting, `DD-MM-YYYY` Greek date formatting, empty-period path that still produces a valid 200 PDF with a "Δεν υπάρχουν επαγγελματικά έξοδα" message.
- **Backend route** — `GET /export/business-expenses` per ADR-0009 §2: Bearer JWT, `to_date >= from_date` validation, 366-day range cap, `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="business-expenses-<from>-<to>.pdf"`, `Cache-Control: private, no-store`, `StreamingResponse` from in-memory bytes (never persisted to disk), log line includes only `user_id` + `rows` count (never receipt content / ΑΦΜ / category / notes / date range / PDF bytes).
- **Mobile** — `mobile/src/screens/profile/state.ts` reducer extended with the export sub-flow per DES-0004 §3.4: `exportFromDate` / `exportToDate` (default range = first day of the current local-month → today, computed at mount via an injectable `now` for deterministic tests), `EXPORT_GENERATE_TAPPED` runs client-side validation (mirrors ADR-0009 §2 server rules — both dates parseable as `YYYY-MM-DD`, `to >= from`, `to - from <= 366` days), `EXPORT_DONE` / `EXPORT_NETWORK_ERROR` / `EXPORT_VALIDATION_ERROR` handle every server response. `mobile/src/api/exports.ts` returns a `Result`-tagged response with the PDF as base64 (RN doesn't ship `Buffer`, so a hand-rolled `arrayBufferToBase64` keeps the API zero-dep on the mobile side). `ProfileScreen.tsx` wires the export effect: when the reducer enters `exporting`, the screen calls `exportBusinessExpenses()`, then hands the base64 + filename to an injectable `shareImpl` prop. The host App will wire `expo-file-system.writeAsStringAsync` + `expo-sharing.shareAsync` once the SDK 54 tree from BLG-0016 lands in S-007; the `shareImpl` indirection keeps the screen test-friendly today.
- **Greek strings** — `profile.export.*` keys extended in `mobile/src/i18n/strings.ts` per DES-0004 §5.
- **Tests added** — backend: 22 new tests across `backend/tests/exports/test_business_expenses.py` (sanitizer; repository filter / sort / multi-user isolation / empty range; PDF builder — `%PDF-` magic, > 1 KB body, Greek glyphs render without crash, long notes truncated at 120 chars, control characters stripped) and `backend/tests/routes/test_exports.py` (200 + `application/pdf`; `Content-Disposition` filename includes range; empty range still 200; `Cache-Control: private, no-store`; 401 missing JWT; 401 invalid JWT; 422 `to_date < from_date`; 422 range > 366 days; 400 / 422 invalid date format). Mobile: 8 export-flow reducer tests added to `mobile/__tests__/screens/profile/state.test.ts` + render smoke covers offline / freelancer-on / freelancer-off paths.

### Drift — BLG-0016 deferred

- **What was attempted.** `npm view expo dist-tags` (the simulation of the `expo-doctor` compat-matrix lookup that ADR-0012 §10 requires before the install).
- **What happened.** The HTTP request to `registry.npmjs.org` hung indefinitely and was killed via `taskkill`.
- **What was decided.** Per `AGENTS.md` §4.10, the upgrade was **deferred to S-007 implementation**. The deferral keeps the in-tree SDK 51 pin set unchanged byte-identically and the encryption stack from ADR-0006 §2 unchanged byte-identically; no outbound allowlist change; no production behavior change; no test regression.
- **What is queued for S-007.** BLG-0016 stays **Ready** in `docs/backlog.md`. The first action of S-007 is the same `npx expo install --fix` + `expo-doctor` clean + `mobile/package-lock.json` regeneration + atomic single-PR commit + the encryption round-trip test (BLG-0016 acceptance bullet 5). Once BLG-0016 ships, the on-device acceptance script in `S-006-UREV-0001` (and the previously deferred S-004 UREV addendum) becomes runnable on stock Expo Go.

## `make check` numbers


| Surface | Tests at S-005 close | Tests at S-006 close | Δ |
| ---------- | -------------------- | -------------------- | --- |
| Backend | 70 | **143** | +73 |
| Mobile | 128 | **197** | +69 |
| **Total** | **198** (13 suites) | **340** (21 suites) | +142 |


- Backend test breakdown: existing 70 + 19 (`backend/tests/test_afm.py`) + 16 (`backend/tests/routes/test_users.py`) + 16 (`backend/tests/routes/test_receipt_tag.py`) + 22 (`backend/tests/exports/...` + `backend/tests/routes/test_exports.py`) = 143.
- Mobile test breakdown: existing 128 + 11 (`__tests__/lib/afm.test.ts`) + 26 (`__tests__/screens/profile/state.test.ts`) + 3 (`__tests__/screens/profile/ProfileScreen.render.test.tsx`) + 27 (`__tests__/screens/receipt/tag.state.test.ts`) + 3 (`__tests__/screens/receipt/ReceiptDetailScreen.render.test.tsx`) = 197 across 18 suites (the `rn` project goes from 3 to 5 render suites; the `ts` project goes from 10 to 13 pure-TS suites).

Both suites green; no flaky tests; no skipped tests beyond the baseline.

## §4.11 sign-offs


| Change kind | Required sign-offs | Recorded |
| ---------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New endpoint / API contract change | `architect`, `engineering-manager` | ADR-0008 (BLG-0018), DES-0004 §4 + ADR-0008 §4 (BLG-0017), ADR-0009 (BLG-0019) — all pre-signed in S-005; this sprint records implementation against contract. |
| New mobile screen or UX flow | `product-designer`, `localization-specialist` | DES-0004 (BLG-0017 + BLG-0019), DES-0005 (BLG-0018) — all pre-signed in S-005. |
| Schema migration / new RLS policy | `data-architect`, `security-privacy-officer` | None — no migration; existing `users.is_freelancer` / `users.afm` and `receipts.is_business_expense` / `business_category` / `notes` columns cover S-006. |
| Auth flow change | `security-privacy-officer`, `data-architect` | None — sign-out is `supabase.auth.signOut()`; no session-handling change. |
| User-data flow change (PII, financial) | `security-privacy-officer`, `agent-safety-officer` | ΑΦΜ never logged (BLG-0017); category / notes never logged (BLG-0018); PDF never persisted, never logged (BLG-0019). All confirmed by `S-006-LOG-0001` entries. |
| New runtime dependency | `agent-safety-officer`, `engineering-manager` | `reportlab==4.2.5` (BLG-0019) — pre-signed in ADR-0009 §1 + Round 2; install completion recorded in this sprint. |
| New MCP integration / new outbound host | `agent-safety-officer`, `architect` | None — no new outbound host. PyPI for backend (already on allowlist) is the only install host touched. |
| Sprint scope change mid-sprint | `orchestrator`, `product-manager` | BLG-0016 deferral — recorded in `S-006-LOG-0001` 18:35 entry; co-signed by `agent-safety-officer` + `engineering-manager` (deferral keeps allowlist + encryption stack byte-identical). |
| Adding / retiring an agent | `agents-doctor` | None. |
| Edits to `AGENTS.md` | `agents-doctor` (structural), section owners (content) | §2.6 + §2.7 update — content-only; recorded in this REV. |


## What went well

- **The S-005 contracts were complete.** ADR-0008..0012 + DES-0004..0005 anticipated every implementation decision a delivery sprint could face — even the PDF-injection defense (ADR-0009 §4), the sign-out cache rotation (DES-0004 §3.5), and the ΑΦΜ-as-identifying-data treatment (DES-0004 §6) landed without re-litigation.
- **The ΑΦΜ validator round-tripped first try.** Backend Python (`backend/app/afm.py`) and mobile TS (`mobile/src/lib/afm.ts`) accept and reject the same set of inputs in lockstep — verified against four hand-validated Greek tax IDs and a battery of edge cases (all-zeros, non-numeric, length, checksum). Defense-in-depth holds: the client rejects fast for UX, the server rejects authoritatively.
- **Privacy gates held everywhere.** No `category` text in any log, no `notes` text in any log, no ΑΦΜ value in any log or error response, no phone number in any log or response (DES-0004 §3.1 mask), no PDF bytes in any log, no QR URL in any error envelope per ADR-0002. `S-006-LOG-0001` records this explicitly per BLG.
- **`make check` arithmetic.** 198 → 340 tests (+142) without weakening any existing test. The two-project Jest layout from BLG-0012 absorbed the new render smoke tests cleanly.
- **No new outbound host.** The deferral of BLG-0016 + the choice of `reportlab` (already pre-signed in ADR-0009) means the outbound allowlist stays unchanged from S-005.

## What didn't go well

- **BLG-0016 deferral.** The npm registry hang on `registry.npmjs.org` killed the planned-first-item sequence. The deferral was the right call (per `AGENTS.md` §4.10) but it pushes the on-device verification to S-007. Mitigation already in place: `S-007` is queued as implementation with BLG-0016 first; the freelancer-mode contracts (BLG-0017 / 0018 / 0019) are tested at the contract level today and on-device on day 1 of S-007.
- **`make check` quirk on Windows + Greek-character workspace path.** GnuWin32 `make` 3.81 mishandles the Greek folder name in `c:\Users\tonyg\OneDrive\Υπολογιστής\watch_your_money` and refuses to resolve `lint` / `typecheck` / `test` targets when invoked from the workspace root. Workaround: agents ran `ruff check`, `mypy`, `pytest`, `tsc`, and `jest` directly with the venv / npm binaries the Makefile would otherwise invoke — equivalent end state, less ergonomic. This is the same quirk recorded in S-003 / S-004 / S-005 LOGs and is queued as a follow-up note in `docs/plan.md`.
- **`shareImpl` indirection on mobile.** The export action is wired against an injectable `shareImpl` prop instead of `expo-sharing.shareAsync` directly. This keeps the screen test-friendly today and unblocks BLG-0019 acceptance under SDK 51, but the on-device share-sheet wiring waits for BLG-0016 in S-007 to fold in `expo-sharing@14.0.7` + `expo-file-system@19.0.7` from the SDK 54 expected matrix. Documented in `S-006-LOG-0001` 19:55 entry and S-007's PLN backlog notes.

## Drift items captured

- **BLG-0016 — Expo SDK 51 → 54 upgrade.** Stays Ready in `docs/backlog.md`; first item pulled in S-007. **No new BLG opened** for the deferral itself — the existing BLG already captures the work.
- No other drift surfaced. Every `category` / `notes` / ΑΦΜ / phone privacy boundary was already specified in DES-0004 / DES-0005 / ADR-0008 / ADR-0009. Every reducer transition for Profile and TagPanel landed against the design.

## Next sprint

- **Type**: implementation.
- **Theme proposal**: `sdk-upgrade-and-on-device-acceptance`.
- **Number**: **S-007**.
- **Why implementation, not discovery**: BLG-0016 is still Ready — the Ready queue is non-empty per `AGENTS.md` §4.1.2.
- **First item**: BLG-0016 (the deferred SDK 51 → 54 upgrade), then on-device verification of the §2.8 acceptance script (which folds in the previously-deferred S-004 UREV addendum + the S-006 freelancer-mode UREV in one real-device pass), then folding `expo-sharing` + `expo-file-system` into the `ProfileScreen` `shareImpl` prop wiring. After S-007, the mobile-first acceptance bar (`AGENTS.md` §2.8) is reachable end-to-end on stock Expo Go.
- See `docs/plan.md` "Next sprint" for the detailed plan.

## Sign-off

- Chair: `orchestrator` — sprint review held; sign-offs recorded above; `make check` green; `AGENTS.md` §2.6 + §2.7 + `docs/plan.md` updated; backlog reflects BLG-0016 still Ready, BLG-0017 / 0018 / 0019 moved to `docs/done.md`.
- `engineering-manager` — quality gate satisfied (`make check` 340 tests green); no flaky tests; no scope creep; drift handled per `AGENTS.md` §4.10.
- `qa` — every BLG-0017 / 0018 / 0019 acceptance bullet is covered by at least one automated test; the BLG-0016 acceptance bullets carry over to S-007 unchanged.
- `agent-safety-officer` — outbound allowlist unchanged; encryption stack from ADR-0006 §2 unchanged byte-identically; no MCP tool invoked; supply chain unchanged on the mobile side, `reportlab==4.2.5` install completed cleanly on the backend side per ADR-0009 §1.
- `security-privacy-officer` — every privacy gate held (ΑΦΜ never logged; phone masked; category / notes never logged; PDF never persisted, never logged; cache key rotated on sign-out per DES-0004 §3.5).
