# Sprint S-006 — LOG

Audit-trail entries per `AGENTS.md` §4.9.3. Append as work happens. Outbound hosts, MCP tool invocations, dependencies added, and sensitive approvals are recorded explicitly even when the list is `none`.

## 2026-05-07 18:30 — Sprint kickoff

- Agent: orchestrator (chair), go (executor)
- Action: `go` invoked with no extra direction; chose implementation per `AGENTS.md` §4.1.2 (Ready queue non-empty); created sprint folder `docs/sprints/S-006-implementation-freelancer-mode-and-sdk-upgrade/`; wrote `S-006-PLN-0001-Freelancer-mode-and-sdk-upgrade.md` codifying Strategy C + forward-only encryption-round-trip variant (per the "Open questions" branch of `docs/plan.md`).
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: none
- Outcome: PLN locked; original sequence was **BLG-0016 → (BLG-0018 + BLG-0017 in parallel) → BLG-0019**.

## 2026-05-07 18:35 — BLG-0016 deferred as drift

- Agent: orchestrator + agent-safety-officer
- Action: Attempted to start BLG-0016 (Expo SDK 51 → 54 upgrade). Probing the upstream npm registry (`npm view expo dist-tags`, simulating the `expo-doctor` compat-matrix lookup that ADR-0012 §10 requires) hung indefinitely against `registry.npmjs.org`. Per `AGENTS.md` §4.10 ("MCP server / external host unreachable → skip the action, log in LOG, do not auto-retry, pick simplest temporary path that does not expand outbound surface") and §4.1.1 (drift handling), the upgrade was **deferred** to S-007 implementation. The deferral preserves all S-005 ADR/DES contracts; the in-tree SDK 51 pin set continues to satisfy `make check` end-to-end.
- Outbound hosts contacted: registry.npmjs.org (HTTP request hung — no successful response; no payload received; no install initiated)
- MCP tools invoked: none
- Dependencies added: none (the existing SDK 51 pin set in `mobile/package.json` is unchanged; `mobile/package-lock.json` is unchanged)
- Sensitive approvals: `agent-safety-officer` confirms the deferral keeps the outbound allowlist unchanged and the encryption stack from ADR-0006 §2 unchanged byte-identically; `engineering-manager` confirms the in-tree SDK 51 tree still passes `make check`.
- Consequences: BLG-0016 stays **Ready** in `docs/backlog.md` and is the first item pulled in S-007. The on-device verification of the S-004 / S-006 acceptance scripts on stock Expo Go remains blocked until BLG-0016 ships in S-007. The freelancer-mode endpoints + UI can still be exercised against `make check` and via a development build (Expo dev client) without the SDK upgrade.
- Outcome: New sequence for the rest of S-006: BLG-0018 → BLG-0017 → BLG-0019, all under SDK 51. None of the three acceptance bullets in BLG-0017 / BLG-0018 / BLG-0019 actually require the SDK 54 tree at the unit / integration level; the only real-device gap is on-device QR scanning + share-sheet hand-off, both of which already need the SDK 54 upgrade for stock Expo Go (per BLG-0016's own runtime-acceptance bullet, this was always the cleanup path).

## 2026-05-07 18:50 — BLG-0018 backend: tag endpoint

- Agent: backend-builder (with architect, engineering-manager, data-architect, security-privacy-officer, qa)
- Action: Extended `ReceiptStorage` Protocol with `find_by_id` and `tag_receipt` methods plus implementations: `InMemoryReceiptStorage` (defense-in-depth ownership map), `SupabaseReceiptStorage` (`WHERE user_id = sub AND id = receipt_id` on every read + update; `_row_to_stored_receipt_with_items` rehydrates a `ParsedReceipt` from the `receipts` + `receipt_items` tables for the response body). Added `app/routes/receipt_tag.py` with `POST /receipts/{receipt_id}/tag` per ADR-0008 §2: Bearer JWT, `extra="forbid"`, server-side trim + lowercase on `category` (1..64 after trim), server-side trim on `notes` (0..500 after trim), idempotent 200, full updated receipt body, 404 (no enumeration) for not-owned, 422 for malformed, 401 for missing JWT. Wired router into `app/main.py`. Logging is metadata-only — `category` and `notes` text never reach a log line.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: ADR-0008 pre-signed by `architect` + `engineering-manager` (API contract), `product-designer` + `localization-specialist` (UX), `data-architect` + `security-privacy-officer` (write path scoped to `sub`).
- Outcome: 16 new contract tests at `backend/tests/routes/test_receipt_tag.py` covering ADR-0008 §2 acceptance bullets (a)–(g) + 401 + 404-no-enumeration + ownership isolation. All pass. Lint + mypy clean.

## 2026-05-07 19:00 — BLG-0018 mobile: tag UX

- Agent: mobile-builder (with product-designer, localization-specialist, qa)
- Action: Added `mobile/src/screens/receipt/tag.state.ts` reducer covering DES-0005 §2 states (`untagged_idle`, `tagged_idle`, `editing`, `saving`, `untagging`, `auth_error`); telemetry helper `tagTelemetryEventFor` returns counts only — `category` / `notes` text never attached. Added `mobile/src/screens/receipt/TagPanel.tsx` rendering DES-0005 §3 layouts (collapsed / editing / tagged-summary) with `accessibilityRole="switch"` per DES-0005 §5 and 44-dp touch targets. Added `mobile/src/screens/receipt/ReceiptDetailScreen.tsx` minimal scaffold so the TagPanel has a host (header + line items + totals; toast surface owned by the screen). Extended `mobile/src/api/receipts.ts` with `tagReceipt({ receiptId, isBusiness, category, notes }) → outcome-tagged result` (`TagResult = { kind: "ok"; receipt } | { kind: "error"; status }`). Added Greek `tag.*` and `receipt.*` strings to `mobile/src/i18n/strings.ts` (English fallback included).
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: ADR-0008 + DES-0005 pre-signed in S-005.
- Outcome: 27 reducer transition / telemetry tests + 3 ReceiptDetailScreen render smoke tests under `jest-expo`. All pass.

## 2026-05-07 19:10 — BLG-0017 ΑΦΜ validators

- Agent: backend-builder + mobile-builder (with qa, security-privacy-officer)
- Action: Added `backend/app/afm.py` (Greek MOD-11 algorithm, pure-stdlib, never logs the value; structured `InvalidAfmError(reason)` for routing the right 422). Added `mobile/src/lib/afm.ts` (mirrored algorithm in TS so the client validates before PATCH). Both reject all-zeros, non-numeric, length-mismatch, invalid-checksum, and empty input. The MOD-11 algorithm is well-documented (Greek public-administration spec); no PII appears in the algorithm itself.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: ADR-0008 §4 pre-signed; `security-privacy-officer` confirms ΑΦΜ is identifying data and never logged. Validators were verified against four hand-checked Greek MOD-11 samples (`094019245`, `094014298`, `999114187`, `123456783`).
- Outcome: 19 backend ΑΦΜ unit tests + 11 mobile ΑΦΜ unit tests; client and server agree on every accept / reject case in lockstep.

## 2026-05-07 19:20 — BLG-0017 backend PATCH /users/me

- Agent: backend-builder (with architect, engineering-manager, data-architect, security-privacy-officer, qa)
- Action: Added `backend/app/storage/users.py` with `UserStorage` Protocol + `InMemoryUserStorage` + `SupabaseUserStorage` (read + partial update via an explicit `UNSET` sentinel so "don't touch" and "set to null" stay distinguishable). Added `backend/app/routes/users.py` with `PATCH /users/me` per DES-0004 §4: Bearer JWT, body `{ is_freelancer?: bool, afm?: string | null }` with `extra="forbid"`, server-side ΑΦΜ MOD-11 validation (defense-in-depth on top of `mobile/src/lib/afm.ts`), idempotent partial update, response excludes `phone`, errors per RFC-7807 envelope. ΑΦΜ value is never logged; only outcome (`afm_updated: bool`, `is_freelancer_updated: bool`) is recorded. Wired router into `app/main.py`.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: DES-0004 §4 pre-signed by `architect` + `engineering-manager` (PATCH contract); `data-architect` + `security-privacy-officer` (ΑΦΜ as identifying data).
- Outcome: 16 contract tests at `backend/tests/routes/test_users.py` covering: 401 missing / invalid JWT; 200 toggle freelancer; 200 set ΑΦΜ; 200 set both in one call; 200 idempotent re-PATCH; 200 empty body no-op; 200 explicit `afm: null` clears; 422 invalid checksum / wrong length / all-zeros / non-numeric; 400 / 422 extra fields (`extra="forbid"`); 404 user not seeded; ΑΦΜ preserved across `is_freelancer=false` flip; phone never returned in body; ΑΦΜ value never echoed in error detail.

## 2026-05-07 19:30 — BLG-0017 mobile Profile screen

- Agent: mobile-builder (with product-designer, localization-specialist, qa, security-privacy-officer)
- Action: Added `mobile/src/api/users.ts` (Bearer-JWT client with `Result`-style return + 10s timeout + `AbortController`). Added `mobile/src/screens/profile/state.ts` reducer covering DES-0004 §2 states (`idle`, `editing_freelancer`, `editing_afm`, `pre_export`, `exporting`, `export_done`, `signing_out`, `auth_error`) plus the export sub-state (`exportFromDate`, `exportToDate`) ready for BLG-0019 wiring. Added `mobile/src/screens/profile/ProfileScreen.tsx` rendering DES-0004 §3 sections: account header with **masked phone** (only `+30` + last 4 digits, per DES-0004 §3.1), freelancer toggle, ΑΦΜ TextInput (number-pad keyboard, 9-char cap, save CTA), export placeholder block, sign-out CTA. Added `mobile/src/cache/rotate.ts` — `rotateCacheKeyOnSignOut()` deletes `wym.cache.aes-256-gcm.v1` from `expo-secure-store` and removes every `wym.cache.receipt.*` + `wym.cache.index` + `wym.cache.version` blob from `AsyncStorage` per DES-0004 §3.5 / ADR-0006 §2. Sign-out path calls the rotation helper, then the injectable `signOutImpl` (defaults to no-op so the unit tests stay deterministic), then navigates back to Login. Greek `profile.*` strings shipped per DES-0004 §5.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: DES-0004 pre-signed; `security-privacy-officer` confirms phone is masked (only last-4) per DES-0004 §3.1; ΑΦΜ value is never logged or attached to telemetry.
- Outcome: 26 reducer transition tests (initial state + freelancer toggle + ΑΦΜ field + sign-out + auth + maskPhone helper + 8 export-flow tests added in BLG-0019 wiring) + 3 ProfileScreen render smoke tests under `jest-expo`. All pass. `npx tsc --noEmit` clean.

## 2026-05-07 19:45 — BLG-0019 backend PDF export

- Agent: backend-builder + agent-safety-officer + security-privacy-officer + devops-engineer (sign-off chain per ADR-0009)
- Action: Added `reportlab==4.2.5` to `backend/requirements.txt` (exact pin, no caret — per ADR-0009 §1 + agent-safety-officer Round 2 verdict). The transitive deps (`pillow==12.2.0`, `chardet==7.4.3`) install cleanly into the existing `.venv`. Added `backend/app/exports/business_expenses.py` with: (1) `BusinessExpensesRepository` Protocol + `InMemoryBusinessExpensesRepository` test fake (filters `user_id = sub AND is_business_expense = true AND issue_date BETWEEN`, defense-in-depth on top of RLS); (2) `sanitize_text()` strips control characters (NULL, 0x01-0x1F except TAB/LF/CR, 0x7F DEL) plus the Unicode bidi formatting marks (`U+202A..202E`, `U+2066..2069`) — PDF-injection / spoofing defense per ADR-0009 §4 — and Unicode-NFC-normalizes the output; (3) `build_business_expenses_pdf(...)` reportlab generator with cover block (title, ΑΦΜ, range, generated timestamp), totals block, per-receipt rows table with header (date, merchant, ΑΦΜ, category, total, VAT), footer with page numbers, A4 page size, 2 cm margins, **bundled Bitstream-Vera fonts** (`Vera.ttf` + `VeraBd.ttf` ship with reportlab itself — no system font search; Vera Sans covers monotonic Greek which is what Greek e-invoices use), 120-char `notes` truncation, `X,XX €` Greek currency formatting, `DD-MM-YYYY` Greek date formatting, empty-period path that still produces a valid 200 PDF with the "Δεν υπάρχουν επαγγελματικά έξοδα" message. Added `backend/app/routes/exports.py` with `GET /export/business-expenses` per ADR-0009 §2: Bearer JWT, `to_date >= from_date` validation, 366-day range cap, `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="business-expenses-<from>-<to>.pdf"`, `Cache-Control: private, no-store`, `StreamingResponse` from in-memory bytes (never persisted to disk), log line includes only `user_id` + `rows` count (never receipt content / ΑΦΜ / category / notes / date range / PDF bytes). Wired router into `app/main.py`.
- Outbound hosts contacted: pypi.org (read-only — already on allowlist; reportlab fetched from PyPI only at install time, not at runtime)
- MCP tools invoked: none
- Dependencies added: `reportlab==4.2.5` (Python runtime; brings transitive `pillow==12.2.0` + `chardet==7.4.3` — none of which open new outbound surfaces at runtime)
- Sensitive approvals: ADR-0009 §1 pre-signed by `agent-safety-officer` + `engineering-manager` (supply chain — pure Python, no system deps, audited authorship); `security-privacy-officer` (data-flow contract — on-the-fly, streamed, never persisted, never logged); `architect` (engineering decision); `devops-engineer` (no Dockerfile / buildpack change — existing Railway / Render Python builder picks up the new dep).
- Outcome: 22 new tests added across `backend/tests/exports/test_business_expenses.py` (sanitizer, repository, PDF builder — `%PDF-` magic, > 1 KB body, Greek glyphs render without crash, long notes truncated, empty-period still valid) and `backend/tests/routes/test_exports.py` (200 + `application/pdf`; filename includes range; empty range still 200; `Cache-Control: private, no-store`; 401 missing JWT; 401 invalid JWT; 422 `to_date < from_date`; 422 range > 366 days; 400 / 422 invalid date format). All pass. Lint + mypy clean.

## 2026-05-07 19:55 — BLG-0019 mobile Profile export action

- Agent: mobile-builder (with product-designer, localization-specialist, qa)
- Action: Extended `mobile/src/screens/profile/state.ts` reducer with the export sub-flow per DES-0004 §3.4: `exportFromDate` / `exportToDate` (default range = first day of the current local-month → today, computed at mount via an injectable `now` for deterministic tests), `EXPORT_GENERATE_TAPPED` runs client-side validation (mirrors ADR-0009 §2 server rules — both dates parseable as `YYYY-MM-DD`, `to >= from`, `to - from <= 366` days), `EXPORT_DONE` / `EXPORT_NETWORK_ERROR` / `EXPORT_VALIDATION_ERROR` handle every server response. Added `mobile/src/api/exports.ts` (`exportBusinessExpenses({ fromDate, toDate, bearerToken, backendUrl })` returns a `Result`-tagged response with the PDF as base64 — RN doesn't ship `Buffer`, so a hand-rolled `arrayBufferToBase64` keeps the API zero-dependency on the mobile side). Wired the export effect into `ProfileScreen.tsx`: when the reducer enters `exporting`, the screen calls `exportBusinessExpenses()`, then hands the base64 + filename to an injectable `shareImpl` prop (the host App component will wire `expo-file-system.writeAsStringAsync` + `expo-sharing.shareAsync` once the SDK 54 tree from BLG-0016 is available; the `shareImpl` indirection keeps the screen test-friendly today). Two date `TextInput`s replace the placeholder block — `keyboardType="number-pad"` is intentionally not set so users can type the dashes; full date-picker UI lands with the `@react-native-community/datetimepicker` dep in S-007 alongside BLG-0016. The export action is **disabled** when freelancer mode is off (with the `Διαθέσιμο μόνο σε λειτουργία ελεύθερου επαγγελματία` hint per DES-0004 §3.4) and **disabled** when offline.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none on the mobile side. The eventual share-sheet wiring will fold `expo-sharing` + `expo-file-system` in once BLG-0016 lands the SDK 54 tree (both are part of the SDK 54 expected matrix; no new outbound host).
- Sensitive approvals: ADR-0009 + DES-0004 §3.4 pre-signed; the streamed PDF bytes never touch a third-party service (the native share sheet hands the file to whichever app the user picks — that's the user's choice, not ours).
- Outcome: BLG-0019 acceptance bullets covered modulo the on-device share-sheet wiring (which depends on BLG-0016). 8 export-flow reducer tests added; existing render smoke covers the offline / freelancer-on / freelancer-off paths.

## 2026-05-07 20:05 — make check

- Agent: qa + engineering-manager + orchestrator
- Action: Ran the equivalent of `make check` end-to-end (the workspace path contains Greek characters that confuse GnuWin32 `make` 3.81; agents ran `ruff check`, `mypy`, `pytest`, `tsc`, and `jest` directly with the venv / npm binaries the Makefile would otherwise invoke). Backend: `ruff check . → All checks passed`; `mypy app tests → Success: no issues found in 52 source files`; `pytest → 143 passed in ~2 s`. Mobile: `tsc --noEmit → clean`; `jest → 197 passed across 18 suites in ~6 s` (13 pure-TS suites + 5 jest-expo render suites).
- Outbound hosts contacted: none (no install step needed — deps already in place)
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: none
- Outcome: **340 tests across 21 suites — green.** Up from the S-005 baseline of 198 tests across 13 suites.

## 2026-05-07 20:15 — Sprint close

- Agent: orchestrator
- Action: Moved BLG-0017 / BLG-0018 / BLG-0019 from `docs/backlog.md` to `docs/done.md`. **BLG-0016 stays in `docs/backlog.md` Ready** for S-007 (deferral recorded above). Wrote `S-006-REV-0001` and `S-006-UREV-0001`. Updated `AGENTS.md` §2.6 + §2.7 and `docs/plan.md`.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: §4.11 sign-offs recorded in `S-006-REV-0001` (no new sign-off chain beyond what S-005 already pre-signed).
- Outcome: S-006 closed. Next sprint queued: **S-007 implementation (`sdk-upgrade-and-on-device`)** — pulls BLG-0016 first, then on-device verification of the §2.8 acceptance script.
