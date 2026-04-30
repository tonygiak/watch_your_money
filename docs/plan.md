# Plan

The current direction of the project and the focus of the next sprint.

## Where we are right now

Sprint **S-003 (discovery, `auth-and-cache`)** has just closed. It produced four ADRs, two design artifacts, and one admin edit:

- **ADR-0004** — Supabase native phone OTP. No new outbound surface; refresh tokens shortened to 14 days; `auth.users` ↔ `public.users` linked via FK + sync trigger; explicit rejection of direct Twilio.
- **ADR-0005** — Insights computation: PostgREST RPC functions for the math (`insights_summary_for_user`, `insights_top_products_for_user`); FastAPI orchestrates with Athens-TZ period boundaries; decimal-as-string responses; categories = `business_category` ∪ `"untagged"`.
- **ADR-0006** — Offline cache: AsyncStorage substrate + AES-256-GCM via `@noble/ciphers` + key in `expo-secure-store`; LRU cap 200 receipts; sanitizer enforces a documented cacheable subset (`raw_html` never cached); offline UX banner + disabled-action rules.
- **ADR-0007** — Expo runtime tree: SDK 51 with 17 runtime + 6 dev exact-pinned packages; `package-lock.json` committed; `npm ci` discipline; `EXPO_NO_TELEMETRY=1` default; gate re-inclusion of `ScannerScreen.tsx` + `mobile/src/api/receipts.ts`. Supply-chain review captured verbatim by `agent-safety-officer`.
- **DES-0002** — Login screen UX (full state machine, Greek-first copy, accessibility, telemetry, phone-normalizer rules).
- **DES-0003** — Insights screen UX (period selector, by-category / top-merchants / top-products sections, empty + offline states).
- **BLG-0010 closed** — `AGENTS.md` §5.3.2 reconciled with ADR-0002 + ADR-0005. The body shape `{ "qr_url": string }` is now codified in `AGENTS.md` itself; `user_id` query parameters are removed from every endpoint; the §4.4 tie-breaker precedent is captured in the spec preamble.

`make check` is green: 38 backend + 52 mobile = 90 tests (smoke check; no production code changed).

For the latest user-facing snapshot, read `AGENTS.md` §2.6 (shipped features unchanged this sprint) and §2.7 (sprint snapshot updated).

## Next sprint

- **Type**: `implementation`.
- **Theme proposal**: `login-insights-cache-runnable-scanner`.
- **Number**: **S-004**.
- **Why implementation, not discovery**: the Ready queue has four well-formed items (BLG-0005, BLG-0006, BLG-0007, BLG-0012) — all four ADR-anchored, all four with testable acceptance bullets, all four sized for a delivery sprint. Per `AGENTS.md` §4.1.2, that's an implementation sprint.

### Goals for the implementation sprint S-004

The sprint pulls all four Ready items in one run; the contracts are tight enough that they fit together cleanly:

1. **BLG-0012 — Install + wire the Expo runtime tree FIRST.** This unblocks every other item. `mobile/package.json` declares the ADR-0007 §2 table; `mobile/package-lock.json` is committed in the same PR; `mobile/.env.sample` includes `EXPO_NO_TELEMETRY=1` + the §5.6 vars; `mobile/tsconfig.json` and `mobile/jest.config.js` switch to `jest-expo` and re-include the BLG-0003 carve-out files; the existing 52 mobile tests pass under the new preset; one render test for `ScannerScreen` lands as a smoke demo. Top-level `Makefile` switches `install-mobile` to `npm ci`.
2. **BLG-0005 — Login screen + Supabase native OTP.** `mobile/src/lib/phone.ts` (E.164 normalizer); `mobile/src/screens/login/state.ts` (reducer per DES-0002 §2); `mobile/src/screens/login/LoginScreen.tsx` (renders DES-0002 §4 against `@supabase/supabase-js`); `db/migrations/<...>_handle_new_user.sql` (FK + sync trigger per ADR-0004 §3); refresh-token lifetime configured to 14 d; privacy notice + provider line per ADR-0004 §7. Greek strings under `login.*`. Telemetry counts only.
3. **BLG-0006 — Insights endpoints + screen.** `db/migrations/<...>_insights_rpc.sql` (the two RPC functions per ADR-0005 §1); `backend/app/insights/period.py` (Athens-TZ helper); `backend/app/insights/repository.py` (interface + in-memory + Supabase); `backend/app/routes/insights.py` (two endpoints per ADR-0005 §4 with Bearer JWT verification per ADR-0002); contract tests assert exact JSON shape; `mobile/src/screens/insights/state.ts` + `InsightsScreen.tsx` per DES-0003.
4. **BLG-0007 — Encrypted offline cache + offline UX.** `mobile/src/cache/types.ts` (`CacheRepository` interface); `InMemoryCacheRepository.ts` + `EncryptedAsyncStorageCacheRepository.ts`; sanitizer + LRU eviction at 200; key management via `expo-secure-store`; offline UX strings under `offline.*`; Home / Receipt detail / Insights / Scanner all honor the offline rules in ADR-0006 §7.

### Sequencing rule

**Land BLG-0012 first** in S-004. Every other item depends on the runtime tree being installed and the gate re-inclusion being live. Without BLG-0012 done first, BLG-0005's `LoginScreen.tsx` cannot be added to `make check`; same for the other screens.

### Acceptance test at S-004 review

A real Greek user installs the Expo build, signs in via Supabase native OTP with their `+30` phone, scans a Greek receipt and sees it in ReceiptDetail in ≤ 5 s (`AGENTS.md` §2.5), opens Insights and sees this-month-vs-last with by-category and top-merchants, then kills the network and still sees the cached receipt list with the offline banner. All Greek-first per `localization-conventions.md`.

### Cadence after that

- **S-005 — discovery** — opens up freelancer mode (BLG to be created): tag-as-business UX for `POST /receipts/{receipt_id}/tag`, ΑΦΜ in Profile, PDF export endpoint contract `GET /export/business-expenses`, real-receipt fixture acquisition path (BLG-0004 follow-through).
- After that, alternation continues per `AGENTS.md` §4.1.2.

## Open questions queued for S-005 discovery

- **Tag-as-business UX** (BLG to be created): inline action on Receipt detail vs Profile-level "import all from period" vs both.
- **PDF export pipeline** (BLG to be created): `reportlab` vs `weasyprint` vs server-side `puppeteer` (the third would add a new outbound surface — `agent-safety-officer` review required).
- **Inferred-category heuristic** (deferred from ADR-0005 §6): EAN range tables vs description NLP vs deferred-to-later.
- **Real-receipt fixture acquisition** (BLG-0004): not blocking S-004; sourcing 4 more consenting receipts is a parallel ask of `parser-specialist` + `security-privacy-officer`.
- **Drift-detection CI** (BLG-0009): unblocked once BLG-0004 produces ≥ 1 real-receipt canary; can land as part of S-005 implementation if the canary is ready.

## Notes for whoever picks this up

- **The four S-004 items have one shared dependency: BLG-0012.** Land it first. Every screen, every test, every render asserts against the runtime tree pinned in ADR-0007.
- **`AGENTS.md` §5.3.2 is now the spec source of truth.** ADR-0002 + ADR-0005 + the BLG-0010 edit all converge there. Future agents reading only `AGENTS.md` will not find the breached body shape.
- **`agent-safety-officer` already signed off on the entire mobile dep tree in ADR-0007.** S-004 implementation does not need a fresh review unless `package.json` deviates from ADR-0007 §2's table (which it must not).
- **Encryption key namespace**: `wym.cache.aes-256-gcm.v1` in `expo-secure-store`. The `v1` is intentional — if the cipher / key derivation ever changes, the new key namespace becomes `v2` and the old cache is silently dropped.
- **Telemetry events are PII-free by ADR contract** (ADR-0003 §7, DES-0002 §6, DES-0003 §6). When adding new events, follow the same rule: counts only, no phone, no OTP, no JWT, no merchant-identifying data.
- **Athens TZ is normative for period boundaries.** Greek users count their "April spend" by Greek calendar months. UTC is only used at the SQL boundary.
- **`react-native-chart-kit` is on a re-evaluation watch.** If a better-maintained alternative emerges before S-004 lands, propose the swap as a small ADR before installing.
- **PowerShell `make check` quirk**: bare `make check` in some PowerShell sessions misresolves the Makefile target. Use `& "C:\Program Files (x86)\GnuWin32\bin\make.exe" -f Makefile check` from PowerShell when in doubt. Logged in `S-003-LOG-0001`.
