# Backlog

Everything **planned** or **in progress**. Schema in `AGENTS.md` §4.9.1 and `docs/templates/backlog-item.md`. When an item completes, **move** (don't duplicate) it into `docs/done.md`.

> S-005 (`freelancer-mode`) closed: 5 ADRs decided (ADR-0008..0012), 2 design artifacts written (DES-0004 Profile, DES-0005 Tag-as-business flow), 4 backlog items refined to **Ready** (BLG-0016 SDK upgrade, BLG-0017 Profile screen, BLG-0018 Tag-as-business endpoint + UX, BLG-0019 PDF export endpoint + Profile action), and **BLG-0013 closed** in-sprint via the ADR-0011 admin edit (moved to `docs/done.md`). BLG-0004 / BLG-0009 / BLG-0011 / BLG-0014 / BLG-0015 carry over unchanged. ADR-0010 explicitly **deferred** the inferred-category heuristic with three concrete re-evaluation triggers; **no new BLG was opened** for it (the deferred state is the default).
>
> S-006 (`freelancer-mode-and-sdk-upgrade`) implementation pulls **BLG-0016 first** (so on-device acceptance tests can run on stock Expo Go), then BLG-0017 / BLG-0018 / BLG-0019 to close §2.8 MVP bullets 8 + 9.

---

- ID: BLG-0004
  Title: Acquire and curate 4 more **real** GR receipt fixtures
  Status: in-progress
  Ready: no (waits on consenting receipt holders)
  Owner: parser-specialist
  Type: parser
  Outcome: A baseline real-receipt fixture set so the GR parser is verified against actual `e-invoicing.gr` HTML — not just a synthetic shape — at 100% accuracy without ever touching the network in tests.
  Acceptance:
  - 4 additional triplets under `backend/tests/fixtures/receipts/gr/<id>/` covering ≥ 3 distinct merchant verticals (e.g. `gr-002-pharmacy`, `gr-003-fuel`, `gr-004-restaurant`, `gr-005-bookstore`). The synthetic `gr-001-supermarket` shipped in S-002 stays as a baseline shape fixture.
  - Each fixture has `raw.html` (UTF-8, byte-exact), `expected.json` (every §5.3.3 field, hand-validated against the printed receipt), and `provenance.md` with **explicit consent** statement and redactions list.
  - `security-privacy-officer` co-sign recorded in each `provenance.md`.
  - `backend/tests/parsers/test_gr_fixtures.py` walks every fixture via `parse_html` (no network) at 100% accuracy.
  - `make check` runs the new tests and stays green.
  - No fixture is ever sent to an LLM, MCP server, or external service (`agent-runtime-security.md` §8).
  Design: N/A.
  Approach: Run `.agents/skills/refresh-fixtures.md` once consenting users are recruited. Captured-and-committed in a future implementation sprint.
  Size: M
  Impact-notes: { external-surface: e-invoicing.gr (already on allowlist) }
  Links: [.agents/skills/refresh-fixtures.md, docs/adr/S-001-ADR-0001-Parser-interface.md]

- ID: BLG-0009
  Title: CI hook for upstream HTML drift detection
  Status: planned
  Ready: no (delivery item; depends on BLG-0008 done + BLG-0004 having ≥ 1 real-receipt canary)
  Owner: parser-specialist
  Type: parser
  Outcome: A scheduled CI job that re-fetches a small canary set against `e-invoicing.gr` (with consent) and fails loudly when the HTML structure changes — so we don't ship a silently broken parser.
  Acceptance:
  - Scheduled GitHub Actions workflow (`.github/workflows/parser-drift.yml`) runs daily.
  - Uses ONLY a public canary fixture or a deliberately-consented set; never user data.
  - Fails the job (and opens a `drift` BLG via gh-cli or notification) when `parse_html` raises `ParserDriftError` against the canary HTML re-fetched from upstream.
  - `agent-safety-officer` co-sign recorded once the canary set is defined.
  - The canary `raw.html` is published in the repo with consent, and the comparison is structural (selectors return non-empty), not byte-equal — upstream HTML can re-flow without breaking the parser.
  Design: N/A.
  Approach: Build on top of `.github/workflows/ci.yml` shipped in S-002 (BLG-0008). Codified follow-up of ADR-0001.
  Size: S
  Impact-notes: { external-surface: e-invoicing.gr (already on allowlist) }
  Links: [docs/adr/S-001-ADR-0001-Parser-interface.md, .agents/skills/refresh-fixtures.md, .github/workflows/ci.yml]

- ID: BLG-0011
  Title: Profile screen language switch (Greek / English)
  Status: planned
  Ready: no (out of MVP scope per `AGENTS.md` §2.9 unless user-test reveals it's blocking)
  Owner: mobile-builder
  Type: product
  Outcome: A user can switch the app's display language between Greek and English from the Profile screen, overriding the device-locale default established by ADR-0003 §5.
  Acceptance:
  - Profile screen lists "Γλώσσα / Language" with two options.
  - Choice persists across app restarts (stored in AsyncStorage under `wym.prefs.language`).
  - Choice overrides the locale-detector default in `mobile/src/lib/locale.ts`.
  - All `scanner.*`, `home.*`, `login.*`, `insights.*`, `offline.*`, `profile.*`, `tag.*` strings re-render immediately on switch (no app reload).
  - `agent-safety-officer` review: stored language is **not** PII; AsyncStorage write is acceptable without encryption (no override of ADR-0006 §5 sanitizer rules — preferences are in a separate namespace `wym.prefs.*`).
  Design: TBD if the item activates.
  Approach: Built on top of `mobile/src/i18n/`. Captured as a follow-up of ADR-0003.
  Size: S
  Impact-notes: { localization: yes }
  Links: [docs/adr/S-001-ADR-0003-Scanner-ux-flow.md]

- ID: BLG-0014
  Title: Re-evaluate `react-native-chart-kit` post-MVP per ADR-0007 §8
  Status: planned
  Ready: no (post-MVP — only blocking if a security advisory drops or it doesn't survive the SDK 54 upgrade)
  Owner: mobile-builder (with agent-safety-officer + product-designer)
  Type: engineering
  Outcome: Either `react-native-chart-kit` is confirmed as the long-term chart library, replaced with a better-maintained alternative (`victory-native`, `react-native-svg-charts`, custom SVG via `react-native-svg`), or removed in favor of plain table-based renders if charts add little.
  Acceptance:
  - Comparison ADR (or short decision note) listing maintenance cadence, bundle-size delta, accessibility coverage, and security posture for the candidates.
  - If a swap is proposed, ADR-0007 §2 / ADR-0012 §3 are amended via the standard ADR superseding flow.
  - `make check` green after the change.
  - `agent-safety-officer` co-sign on any new dep.
  Design: N/A.
  Approach: Cross-referenced with **ADR-0012 §6**: chart-kit is expected to survive the SDK 54 upgrade in S-006; if it does not, BLG-0014 collapses into the same S-006 PR and is closed there. Otherwise this BLG stays passive until a real reason to swap surfaces.
  Size: S (research) → M (if a swap lands)
  Impact-notes: { external-surface: yes if a new dep is proposed }
  Links: [docs/adr/S-003-ADR-0007-Expo-runtime-tree.md, docs/adr/S-005-ADR-0012-Expo-sdk-upgrade.md]

- ID: BLG-0015
  Title: Live integration test for the insights RPCs (slow-marked)
  Status: planned
  Ready: no (waits on Supabase test project provisioning)
  Owner: backend-builder + devops-engineer
  Type: engineering
  Outcome: A `slow`-marked pytest hits a real Supabase test project's `insights_summary_for_user` and `insights_top_products_for_user` RPCs and asserts the same response shape as the contract tests. Closes the loop on ADR-0005 §8 ("the SQL RPC must be tested against real Postgres at least once"). Same shape as the optional `slow` test for `GET /export/business-expenses` per ADR-0009 §7.
  Acceptance:
  - `backend/tests/insights/test_supabase_rpc.py` (or similar) with `@pytest.mark.slow` and explicit env-var gating (`SUPABASE_TEST_URL`, `SUPABASE_TEST_SERVICE_KEY`).
  - The test seeds at most a handful of receipts into a `test_*` schema, runs both RPCs, asserts shape + decimal-as-string formatting, and tears down.
  - `make check` keeps the slow tests off by default (`-m "not slow"`); a separate `make test-slow` (or env flag) runs them.
  - `devops-engineer` documents the Supabase test-project provisioning runbook under `docs/runbooks/`.
  - No real user data ever touches the test project.
  Design: N/A.
  Approach: Wait for the Supabase test project to be created. Likely lands in S-006 implementation if the project is up by then; otherwise carries forward.
  Size: S
  Impact-notes: { external-surface: yes (Supabase test project — the host is already on the allowlist) }
  Links: [docs/adr/S-003-ADR-0005-Insights-computation.md, docs/adr/S-005-ADR-0009-Pdf-export-pipeline.md, db/migrations/0003_insights_rpc.sql]

- ID: BLG-0016
  Title: Upgrade Expo SDK 51 → 54 (Expo Go compatibility + compat-matrix alignment)
  Status: planned
  Ready: yes (S-006 implementation pulls this — anchored to ADR-0012)
  Owner: mobile-builder (with architect, engineering-manager, agent-safety-officer, security-privacy-officer)
  Type: engineering
  Outcome: A real Greek consumer can run the Watch-Your-Money app on stock Expo Go (iOS or Android, latest store version) end-to-end. `expo-doctor` reports a clean compat matrix (no version-drift warnings). The encryption stack from ADR-0006 (`@noble/ciphers`, `expo-secure-store`, `expo-crypto`) survives byte-identically. The two existing in-tree compat-matrix warnings (`@react-native-community/netinfo`, `typescript`) are explicitly resolved against the SDK 54 matrix.
  Acceptance:
  - Single S-006 PR contains: `mobile/package.json` (SDK 54 tree, exact versions, no carets), regenerated `mobile/package-lock.json`, any required `mobile/babel.config.js` / `mobile/jest.config.js` / `mobile/tsconfig.json` updates, `eas.json` profile bumps to SDK 54.
  - `expo-doctor` runs clean — zero compat-matrix warnings.
  - Both in-tree compat-matrix deviations re-aligned: `@react-native-community/netinfo` → SDK-54-expected version (no deviation recorded); `typescript` → SDK-54-expected version (no deviation recorded). Per ADR-0012 §3 the deliberate-deviation option was rejected absent a fresh reason.
  - **Encryption-stack round-trip test**: encrypt a sample receipt under the pre-upgrade tree, switch to the SDK 54 branch, decrypt and re-sanitize the same payload — receipt matches the original byte-for-byte. If this fails, the upgrade is **blocked** pending an ADR-0006 amendment.
  - `react-native-chart-kit` survives the upgrade. If it doesn't, BLG-0014 collapses into this PR with the swap (likely `victory-native@~37.x` or `react-native-svg-charts`) co-signed by `mobile-builder` + `agent-safety-officer` + `engineering-manager` + `product-designer`.
  - All 198 existing tests pass under the new `jest-expo@~54` preset before any new test is added (the two-project Jest layout from BLG-0012 stays).
  - `expo start` no longer prints the "packages should be updated for best compatibility" block.
  - `eas.json` `development` and `preview` profiles bumped to SDK 54.
  - **Runtime acceptance** (folded into S-006-UREV-0001): a real Greek consumer with stock Expo Go (iOS or Android, latest store version) can run the full S-004 acceptance script (sign in → scan → Insights → offline → restore) end-to-end.
  - No new outbound host (`registry.npmjs.org` + `expo.dev` already on the allowlist).
  - `agent-safety-officer` + `engineering-manager` co-sign on the final pin set after `expo install --fix`. `architect` co-sign on the SDK choice. `security-privacy-officer` co-sign on the encryption round-trip result.
  Design: N/A.
  Approach: `npx expo install --fix` against a clean clone in S-006 → `expo-doctor` until clean → regenerate `package-lock.json` → manually verify ADR-0006 deps + chart-kit → encryption round-trip test → atomic single-PR commit. Should land **first** in S-006 so the freelancer-mode UREV (BLG-0017 / 0018 / 0019) can be exercised on a real device.
  Size: M (research + dependency tree update + RN config touch-ups + render-test verification + encryption round-trip)
  Impact-notes: { external-surface: no (npmjs.com + expo.dev already on allowlist); supply-chain: yes (transitive re-pin of ~20 packages requires `agent-safety-officer` co-sign per `AGENTS.md` §4.11) }
  Links: [docs/adr/S-005-ADR-0012-Expo-sdk-upgrade.md, docs/adr/S-003-ADR-0007-Expo-runtime-tree.md, docs/adr/S-003-ADR-0006-Offline-cache-strategy.md, docs/sprints/S-004-implementation-login-insights-cache-runnable-scanner/S-004-UREV-0001-Login-insights-cache-runnable-scanner.md]

- ID: BLG-0017
  Title: Profile screen — freelancer toggle, ΑΦΜ field, sign-out (mobile + thin backend)
  Status: planned
  Ready: yes (S-006 implementation — anchored to DES-0004 + ADR-0008 §4 PATCH contract)
  Owner: mobile-builder (with backend-builder, data-architect, product-designer, localization-specialist, qa, security-privacy-officer)
  Type: product
  Outcome: A Greek freelancer can open the Profile screen, toggle freelancer mode on, enter their ΑΦΜ (validated against the Greek MOD-11 checksum), save it, and sign out cleanly. This unlocks bullet 9 of `AGENTS.md` §2.8 indirectly (the export action lives on this screen) and is the prerequisite for BLG-0019.
  Acceptance:
  - **Backend** — `PATCH /users/me` endpoint per DES-0004 §4: Bearer JWT, body `{ is_freelancer?: bool, afm?: string }` with `extra="forbid"`, server-side ΑΦΜ MOD-11 validation, idempotent partial update, returns the updated `users` row minus `phone`. Errors per RFC-7807 envelope (ADR-0002).
  - **Mobile** — `mobile/src/screens/profile/ProfileScreen.tsx` + `mobile/src/screens/profile/state.ts` reducer covering DES-0004 §2 states (`idle`, `editing_freelancer`, `editing_afm`, `pre_export`, `exporting`, `export_done`, `signing_out`, `network_error`, `auth_error`, `validation_error`).
  - **Mobile** — `mobile/src/lib/afm.ts` Greek ΑΦΜ MOD-11 validator with ≥ 5 unit tests (valid, invalid-checksum, all-zeros, non-numeric, length-mismatch).
  - **Mobile** — Greek `profile.*` strings shipped per DES-0004 §5.
  - **Mobile** — Render smoke test for `ProfileScreen.tsx` covering at least the `idle` and `editing_afm` states under `jest-expo`.
  - **Sign-out** — calls `supabase.auth.signOut()` AND clears `wym.cache.aes-256-gcm.v1` from `expo-secure-store` (DES-0004 §3.5 — key rotation on sign-out).
  - **Phone masking** — phone display shows `+30 6XX *** ****` (only last 4 digits) per DES-0004 §3.1.
  - **Telemetry** — only the events listed in DES-0004 §7 are emitted; ΑΦΜ value, phone number, date range, and PDF size are **never** in any event.
  - **Accessibility** — DES-0004 §6 fully implemented (switch role, hints, touch targets ≥ 44 dp).
  - **No schema migration** — existing `users.is_freelancer` and `users.afm` columns from `0001_init.sql` already cover this; `data-architect` confirms.
  - **No new outbound host.** No new runtime dep beyond what the SDK 54 tree (BLG-0016) brings.
  - **Sign-offs in PR**: `architect` + `engineering-manager` (PATCH endpoint contract); `product-designer` + `localization-specialist` (Profile screen UX + Greek strings); `data-architect` + `security-privacy-officer` (ΑΦΜ as identifying data — never logged); `qa` (reducer transitions tested).
  Design: `docs/sprints/S-005-discovery-freelancer-mode/S-005-DES-0004-Profile-ux.md`.
  Approach: One backend route (`PATCH /users/me`) + one mobile screen + one ΑΦΜ validator + key-rotation-on-sign-out. Lands after BLG-0016 (so the SDK 54 tree is in place).
  Size: M
  Impact-notes: { rls: yes (writes scoped to `sub`); localization: yes; country-code: GR (ΑΦΜ is GR-specific — country-agnostic story is via `users.afm` column being nullable; future EU adapters fill it differently or skip it); external-surface: no }
  Links: [docs/sprints/S-005-discovery-freelancer-mode/S-005-DES-0004-Profile-ux.md, docs/adr/S-005-ADR-0008-Tag-as-business-ux.md, docs/adr/S-001-ADR-0002-Receipts-parse-endpoint.md, docs/adr/S-003-ADR-0006-Offline-cache-strategy.md]

- ID: BLG-0018
  Title: Tag-as-business — `POST /receipts/{id}/tag` endpoint + Receipt-detail UX
  Status: planned
  Ready: yes (S-006 implementation — anchored to ADR-0008 + DES-0005)
  Owner: backend-builder (with mobile-builder, architect, engineering-manager, product-designer, localization-specialist, qa, security-privacy-officer)
  Type: product
  Outcome: A Greek user can tap one toggle on a Receipt detail screen, type a category and optional notes, and the receipt is marked as a business expense. Closes bullet 8 of `AGENTS.md` §2.8.
  Acceptance:
  - **Backend** — `POST /receipts/{receipt_id}/tag` per ADR-0008 §2: Bearer JWT, body `{ is_business: bool, category?: str, notes?: str }` with `extra="forbid"`, server-side trim + lowercase on `category` (1..64 chars after trim when `is_business=true`), server-side trim on `notes` (0..500 chars), 200 always (idempotent), response = full updated receipt.
  - **Backend** — RLS + WHERE-guard: `WHERE user_id = sub AND id = receipt_id` (defense in depth on top of RLS); 404 returned for both "no such receipt" and "belongs to another user" (no enumeration).
  - **Backend** — contract tests cover (a) tag → 200 + receipt with `is_business_expense=true` + `business_category=<lowercased>` + `notes`; (b) untag (`is_business=false`) → 200 + `is_business_expense=false` + `business_category=NULL` + `notes=NULL`; (c) re-POST same body → 200 no-op; (d) different user → 404; (e) malformed body → 422; (f) too-long category → 422; (g) extra `user_id` field → 422 (`extra="forbid"`).
  - **Backend** — Insights `by_category` rollup picks up the new tag immediately (same RPC; the test from ADR-0005 §8 in-memory fixture extends to assert the new bucket appears).
  - **Mobile** — `mobile/src/screens/receipt/tag.state.ts` reducer covering DES-0005 §2 states; `mobile/src/screens/receipt/TagPanel.tsx` (or inline in `ReceiptDetailScreen.tsx`) covering DES-0005 §3 layout (untagged-collapsed, editing, tagged-collapsed, optimistic UI).
  - **Mobile** — Greek `tag.*` strings shipped per DES-0005 §4.
  - **Mobile** — Render smoke test for `ReceiptDetailScreen.tsx` covering at least one tagged and one untagged receipt under `jest-expo`.
  - **Telemetry** — only the events listed in DES-0005 §6 are emitted; category text, notes text, and receipt id are **never** in any event.
  - **Accessibility** — DES-0005 §5 fully implemented (switch role, hints, validation states).
  - **No schema migration** — existing `receipts.is_business_expense` / `business_category` / `notes` columns from `0001_init.sql` cover this.
  - **No new outbound host.** No new runtime dep.
  - **Sign-offs in PR**: `architect` + `engineering-manager` (POST endpoint contract); `product-designer` + `localization-specialist` (Tag-as-business UX + Greek strings); `data-architect` + `security-privacy-officer` (write path scoped to `sub`, RLS + WHERE guard verified, `notes` never logged); `qa` (reducer transitions + every contract bullet tested).
  Design: `docs/sprints/S-005-discovery-freelancer-mode/S-005-DES-0005-Tag-as-business-flow.md`.
  Approach: One backend route + one mobile screen-block + one Greek string set. Lands after BLG-0016 (so the SDK 54 tree is in place); can ship in parallel with BLG-0017 since the surfaces don't overlap.
  Size: M
  Impact-notes: { rls: yes (writes scoped to `sub`); localization: yes; country-code: agnostic (`category` is free text); external-surface: no }
  Links: [docs/adr/S-005-ADR-0008-Tag-as-business-ux.md, docs/sprints/S-005-discovery-freelancer-mode/S-005-DES-0005-Tag-as-business-flow.md, docs/adr/S-003-ADR-0005-Insights-computation.md, docs/adr/S-001-ADR-0002-Receipts-parse-endpoint.md]

- ID: BLG-0019
  Title: PDF export — `GET /export/business-expenses` endpoint + Profile export action
  Status: planned
  Ready: yes (S-006 implementation — anchored to ADR-0009 + DES-0004 §3.4)
  Owner: backend-builder (with mobile-builder, architect, engineering-manager, agent-safety-officer, security-privacy-officer, product-designer, localization-specialist, qa, devops-engineer)
  Type: product
  Outcome: A Greek freelancer picks a date range on the Profile screen, taps "Δημιουργία PDF", and the device share sheet hands them a generated PDF of all their tagged business expenses for that range. Closes bullet 9 of `AGENTS.md` §2.8.
  Acceptance:
  - **Backend** — `GET /export/business-expenses?from_date=YYYY-MM-DD&to_date=YYYY-MM-DD` per ADR-0009 §2: Bearer JWT, server-side validation (`to_date >= from_date`, `to_date - from_date <= 366 days`), `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="business-expenses-<from>-<to>.pdf"`, `StreamingResponse` from in-memory buffer, never written to disk, never logged (only count + bytes_generated counters).
  - **Backend** — `reportlab==4.2.5` added to `backend/requirements.txt` (exact pin, no caret, ADR-0009 §1 + supply-chain review captured in ADR-0009 §Round 2).
  - **Backend** — `backend/app/exports/business_expenses.py` query helper: filters `WHERE user_id = sub AND is_business_expense = true AND issue_date BETWEEN from_date AND to_date`, uses existing `receipts (user_id, is_business_expense)` index from `0001_init.sql`.
  - **Backend** — `notes` field sanitized for control characters (NULL bytes, RTL marks) before passing to `reportlab.platypus.Paragraph` per ADR-0009 §4 (PDF-injection defense).
  - **Backend** — PDF layout per ADR-0009 §5 + DES-0004 §6: cover block (title + ΑΦΜ + range + timestamp), totals block, per-receipt rows (date, merchant, ΑΦΜ, total, VAT, category, notes truncated to ~120 chars), footer with page numbers, Greek + Latin glyphs via `DejaVuSans`, A4 page size, 2 cm margins.
  - **Backend** — formatting helpers: `X,XX €` currency, `DD-MM-YYYY` dates, comma decimal separator (mirrors `mobile/src/lib/format.ts`).
  - **Backend** — empty range still returns a valid 200 PDF with a "Δεν υπάρχουν επαγγελματικά έξοδα στην περίοδο" / "No business expenses in this period" page.
  - **Backend** — contract tests cover ADR-0009 §7: 200 + `application/pdf` for valid input; 401 no-JWT; 422 invalid date range; 422 range too long; 200 small PDF for empty range. Plus the unit tests for the query helper and the PDF generator (PDF magic bytes, Greek glyphs in text stream, totals match, notes truncation).
  - **Mobile** — Profile-screen export action per DES-0004 §3.4: two date pills with default range (current Athens-TZ month start → today), client-side validation mirroring server rules, `Δημιουργία PDF` CTA, `exporting` spinner state.
  - **Mobile** — On 200: write streamed bytes to `FileSystem.cacheDirectory`, dispatch native share sheet via `expo-sharing`'s `shareAsync(uri, { mimeType: 'application/pdf' })`. (If `expo-sharing` doesn't survive the SDK 54 upgrade, an equivalent share dep is added with `agent-safety-officer` review folded into this BLG.)
  - **Mobile** — `DateTimePicker` dep choice resolved per DES-0004 §9 (use `@react-native-community/datetimepicker` if in the SDK 54 expected matrix, else a small alternative with `agent-safety-officer` review).
  - **Mobile** — Render smoke test for the Profile export sub-tree under `jest-expo`.
  - **Telemetry** — only the events listed in DES-0004 §7; date range, PDF size, and receipt content **never** attached.
  - **`agent-safety-officer` co-sign** on `reportlab==4.2.5` install (the supply-chain review is already in ADR-0009 §Round 2; this BLG records install completion). No new outbound host (PyPI already on the allowlist).
  - **`security-privacy-officer` co-sign** on the data-flow contract: PDF on-the-fly, streamed, never persisted server-side, never logged.
  - **`devops-engineer`** confirms no Dockerfile / buildpack change needed; existing Railway / Render Python builder picks up the dep on next push.
  - **No schema migration** — existing index `receipts (user_id, is_business_expense)` from `0001_init.sql` covers the export query.
  Design: `docs/sprints/S-005-discovery-freelancer-mode/S-005-DES-0004-Profile-ux.md` §3.4 + §6.
  Approach: One backend route + one PyPI dep + one mobile sub-flow on the Profile screen. Depends on BLG-0017 having shipped the Profile screen scaffold (the export action is a section on that screen). Pulls together with BLG-0017 in S-006.
  Size: M
  Impact-notes: { rls: yes (read scoped to `sub`); localization: yes (Greek glyphs in PDF); country-code: GR (ΑΦΜ in cover); external-surface: no (PyPI already on allowlist); supply-chain: yes (`reportlab==4.2.5` runtime dep — review captured in ADR-0009) }
  Links: [docs/adr/S-005-ADR-0009-Pdf-export-pipeline.md, docs/sprints/S-005-discovery-freelancer-mode/S-005-DES-0004-Profile-ux.md, docs/adr/S-001-ADR-0002-Receipts-parse-endpoint.md, db/migrations/0001_init.sql]
