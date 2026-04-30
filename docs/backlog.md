# Backlog

Everything **planned** or **in progress**. Schema in `AGENTS.md` §4.9.1 and `docs/templates/backlog-item.md`. When an item completes, **move** (don't duplicate) it into `docs/done.md`.

> S-003 (`auth-and-cache`) closed: ADR-0004, ADR-0005, ADR-0006, ADR-0007 accepted; DES-0002 (Login), DES-0003 (Insights) drafted. BLG-0005, BLG-0006, BLG-0007, BLG-0012 refined to **Ready** for S-004 implementation. BLG-0010 closed (moved to `docs/done.md`). BLG-0009 and BLG-0011 stay `planned` with sharper acceptance.

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
  Approach: Run `.agents/skills/refresh-fixtures.md` once consenting users are recruited. Captured-and-committed in a future implementation sprint (S-004 or later).
  Size: M
  Impact-notes: { external-surface: e-invoicing.gr (already on allowlist) }
  Links: [.agents/skills/refresh-fixtures.md, docs/adr/S-001-ADR-0001-Parser-interface.md]

- ID: BLG-0005
  Title: Phone-OTP authentication (login screen + Supabase native flow)
  Status: planned
  Ready: yes (per ADR-0004 + DES-0002)
  Owner: mobile-builder (with security-privacy-officer + data-architect)
  Type: security
  Outcome: A user can sign in to the app with their Greek phone number via Supabase native OTP. The session powers every authenticated call to `POST /receipts/parse` and the insights endpoints.
  Acceptance:
  - `mobile/src/lib/phone.ts` — E.164 normalizer with Greek `+30` default; unit-tested per DES-0002 §7.
  - `mobile/src/screens/login/state.ts` — reducer covering every state in DES-0002 §2; every transition tested.
  - `mobile/src/screens/login/LoginScreen.tsx` — renders the layout in DES-0002 §4 against `@supabase/supabase-js` per ADR-0004 §1; one render test per state.
  - All Greek strings under `login.*` per DES-0002 §3.
  - Telemetry events per DES-0002 §6 (counts only; no phone, no OTP).
  - `db/migrations/<timestamp>_handle_new_user.sql` — `on_auth_user_inserted` trigger inserts `public.users` with `id = auth.users.id`, `phone = auth.users.phone`, `is_freelancer = false`, per ADR-0004 §3.
  - Supabase region picked + recorded in `docs/runbooks/<...>` (data-residency note per ADR-0004 §7).
  - Refresh-token lifetime configured to 14 days per ADR-0004 §4.
  - Privacy notice short-form rendered before the phone field is enabled (ADR-0004 §7).
  - `make check` green; no real SMS in tests.
  - No new outbound host; allowlist unchanged.
  Design: `docs/sprints/S-003-discovery-auth-and-cache/S-003-DES-0002-Login-ux.md`
  Approach: Implement under S-004 against ADR-0004. Mobile path only — backend stays out of the auth flow (ADR-0002 already verifies the JWT issued by Supabase).
  Size: M
  Impact-notes: { rls: yes (FK on auth.users), localization: yes, country-code: GR-only normalizer (post-MVP can extend) }
  Links: [docs/adr/S-003-ADR-0004-Phone-otp-provider.md, docs/sprints/S-003-discovery-auth-and-cache/S-003-DES-0002-Login-ux.md, docs/adr/S-001-ADR-0002-Receipts-parse-endpoint.md]

- ID: BLG-0006
  Title: Insights summary + top-products endpoints + Insights screen
  Status: planned
  Ready: yes (per ADR-0005 + DES-0003)
  Owner: backend-builder + mobile-builder
  Type: engineering
  Outcome: A user opens Insights and sees, within the §2.5 5-second target, the current period's spending, the comparison vs previous, the by-category and by-merchant breakdowns, and the top products — all scoped via RLS to their own data.
  Acceptance:
  - `db/migrations/<timestamp>_insights_rpc.sql` — two RPC functions: `insights_summary_for_user(user_uuid uuid, from_date date, to_date date, prev_from_date date, prev_to_date date)` and `insights_top_products_for_user(user_uuid uuid, from_date date, to_date date, limit_n int)`. Each ≤ 30 lines. Each filters `WHERE user_id = user_uuid`.
  - `backend/app/insights/period.py` — Athens-TZ period-boundary helper for week / month / year + previous window; unit-tested for leap years and DST.
  - `backend/app/insights/repository.py` — `InsightsRepository` interface + `InMemoryInsightsRepository` + `SupabaseInsightsRepository` (calls the RPC).
  - `backend/app/routes/insights.py` — `GET /insights/summary` and `GET /insights/products` per ADR-0005 §4 endpoint contracts; Bearer JWT verified per ADR-0002.
  - Contract tests assert exact response JSON shape (decimal-as-string).
  - `mobile/src/screens/insights/state.ts` — reducer covering every state in DES-0003 §2.
  - `mobile/src/screens/insights/InsightsScreen.tsx` — renders DES-0003 §3 against the endpoint responses.
  - All `insights.*` Greek strings per DES-0003 §4.
  - Empty + offline empty states per DES-0003 §7.
  - `make check` green.
  - One slow-marked integration test runs the SQL RPC against a local Postgres / Supabase test project.
  - No new outbound host; allowlist unchanged.
  Design: `docs/sprints/S-003-discovery-auth-and-cache/S-003-DES-0003-Insights-ux.md`
  Approach: Implement under S-004 against ADR-0005. Aggregation lives in PostgREST RPCs; orchestration in FastAPI; rendering in React Native via `react-native-chart-kit` (pinned in ADR-0007).
  Size: L
  Impact-notes: { localization: yes, country-code: country-agnostic }
  Links: [docs/adr/S-003-ADR-0005-Insights-computation.md, docs/sprints/S-003-discovery-auth-and-cache/S-003-DES-0003-Insights-ux.md, docs/adr/S-001-ADR-0002-Receipts-parse-endpoint.md]

- ID: BLG-0007
  Title: Encrypted offline cache for receipts + offline UX
  Status: planned
  Ready: yes (per ADR-0006)
  Owner: mobile-builder (with security-privacy-officer)
  Type: engineering
  Outcome: A user who has been online at least once can open the app offline, see their cached receipt list, open detail views, and not see broken or partial UI on auth-required actions. Cache is encrypted at rest with an OS-keystore-backed key.
  Acceptance:
  - `mobile/src/cache/types.ts` — `CacheRepository` interface per ADR-0006 §6.
  - `mobile/src/cache/InMemoryCacheRepository.ts` — tests + local dev.
  - `mobile/src/cache/EncryptedAsyncStorageCacheRepository.ts` — production. AES-256-GCM via `@noble/ciphers`, 96-bit random IV via `expo-crypto.getRandomBytesAsync(12)`, 256-bit key in `expo-secure-store` under `wym.cache.aes-256-gcm.v1` per ADR-0006 §2.
  - Sanitizer drops every field outside the §5 cacheable subset; `raw_html` is never written.
  - LRU eviction at 200 receipts, ordered by `last_seen_at`.
  - Cache populated on (a) `/receipts/parse` 201 + 200, (b) Supabase receipt-list reads, (c) detail open (refreshes `last_seen_at`).
  - Greek-first offline strings under `offline.*` per ADR-0006 §7.
  - Home, Receipt detail, Insights, Scanner all honor the offline UX rules in ADR-0006 §7.
  - Round-trip tests prove Greek characters survive encrypt/decrypt.
  - Sanitizer tests assert default-deny on unknown fields.
  - Key-loss tests prove the cache is silently purged.
  - `make check` green.
  - No new outbound host; allowlist unchanged.
  Design: encoded inline in ADR-0006 §1–§7; UX trims live in DES-0003 (Insights offline) and DES-0004 (Home offline — to be authored alongside S-004).
  Approach: Implement under S-004 against ADR-0006. Deps land via ADR-0007.
  Size: M
  Impact-notes: { localization: yes, external-surface: no }
  Links: [docs/adr/S-003-ADR-0006-Offline-cache-strategy.md, docs/adr/S-003-ADR-0007-Expo-runtime-tree.md]

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
  - `agent-safety-officer` co-sign recorded once the canary set is defined (a re-fetch IS a real outbound call to `e-invoicing.gr` from CI — the host is already on the allowlist but the schedule + identity used must be reviewed).
  - The canary `raw.html` is published in the repo with consent, and the comparison is structural (selectors return non-empty), not byte-equal — upstream HTML can re-flow without breaking the parser.
  Design: N/A.
  Approach: Build on top of `.github/workflows/ci.yml` shipped in S-002 (BLG-0008). Codified follow-up of ADR-0001.
  Size: S
  Impact-notes: { external-surface: e-invoicing.gr (already on allowlist) }
  Links: [docs/adr/S-001-ADR-0001-Parser-interface.md, .agents/skills/refresh-fixtures.md, .github/workflows/ci.yml]

- ID: BLG-0011
  Title: Profile screen language switch (Greek / English)
  Status: planned
  Ready: no (out of MVP scope per §2.9 unless user-test reveals it's blocking)
  Owner: mobile-builder
  Type: product
  Outcome: A user can switch the app's display language between Greek and English from the Profile screen, overriding the device-locale default established by ADR-0003 §5.
  Acceptance:
  - Profile screen lists "Γλώσσα / Language" with two options.
  - Choice persists across app restarts (stored in AsyncStorage under `wym.prefs.language`).
  - Choice overrides the locale-detector default in `mobile/src/lib/locale.ts`.
  - All `scanner.*`, `home.*`, `login.*`, `insights.*`, `offline.*` strings re-render immediately on switch (no app reload).
  - `agent-safety-officer` review: stored language is **not** PII; AsyncStorage write is acceptable without encryption (no override of ADR-0006 §5 sanitizer rules — preferences are in a separate namespace `wym.prefs.*`).
  Design: TBD if the item activates.
  Approach: Built on top of `mobile/src/i18n/`. Captured as a follow-up of ADR-0003.
  Size: S
  Impact-notes: { localization: yes }
  Links: [docs/adr/S-001-ADR-0003-Scanner-ux-flow.md]

- ID: BLG-0012
  Title: Install Expo + react-native runtime deps and wire `ScannerScreen.tsx` into the gate
  Status: planned
  Ready: yes (per ADR-0007)
  Owner: mobile-builder (with devops-engineer)
  Type: engineering
  Outcome: The hand-written `ScannerScreen.tsx` (already in `mobile/src/screens/`) and `mobile/src/api/receipts.ts` are runnable on a real device through Expo, and both files are typechecked + tested as part of `make check`. Login, Insights, and the encrypted cache also become runnable via the same dependency tree.
  Acceptance:
  - ADR-0007 accepted (this sprint).
  - `mobile/package.json` declares the exact pinned versions in ADR-0007 §2 (`dependencies` + `devDependencies` tables).
  - `mobile/package-lock.json` committed in the **same PR** as `package.json`.
  - `mobile/.env.sample` includes `EXPO_NO_TELEMETRY=1`, `SUPABASE_URL=`, `SUPABASE_ANON_KEY=`, `BACKEND_API_URL=`.
  - `mobile/tsconfig.json` re-includes `src/screens/**/*.tsx` and `src/api/**/*` (BLG-0003 carve-out removed).
  - `mobile/jest.config.js` switches to `preset: "jest-expo"`; the existing 52 tests pass under the new preset before any new tests are added.
  - At least one render test for `ScannerScreen` covering: pre-prompt → permission grant → scanning → submit success/duplicate → ReceiptDetail navigation, per DES-0001.
  - Top-level `Makefile`'s `install` target uses `npm ci` for `mobile/`.
  - A new BLG opened to re-evaluate `react-native-chart-kit` post-MVP (per ADR-0007 §8).
  - `make check` green.
  - Outbound allowlist unchanged (Expo + npm registry already on it).
  Design: N/A (the screen design is DES-0001; this item is the runtime wiring).
  Approach: Discovery sprint S-003 produced ADR-0007. Implementation sprint S-004 executes the install + wiring. Until BLG-0012 lands, the testable parts (reducer, validator, i18n, locale, format) carry the contract.
  Size: M
  Impact-notes: { external-surface: yes (Expo + RN + Supabase JS + chart-kit + cache stack — reviewed in ADR-0007 by `agent-safety-officer`) }
  Links: [docs/adr/S-003-ADR-0007-Expo-runtime-tree.md, docs/adr/S-001-ADR-0003-Scanner-ux-flow.md, docs/sprints/S-001-discovery-receipt-parser-contract/S-001-DES-0001-Scanner-ux.md, mobile/src/screens/ScannerScreen.tsx, mobile/src/api/receipts.ts, .agents/context/outbound-allowlist.md]
