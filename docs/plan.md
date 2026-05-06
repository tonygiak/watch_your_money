# Plan

The current direction of the project and the focus of the next sprint.

## Where we are right now

Sprint **S-004 (implementation, `login-insights-cache-runnable-scanner`)** has just closed green. All four ADR-anchored Ready items shipped together:

- **BLG-0012 — Expo runtime tree.** `mobile/package.json` now declares the ADR-0007 §2 exact-pinned set verbatim (17 runtime + 6 dev). `mobile/package-lock.json` regenerated. `mobile/.env.sample` extended with `EXPO_NO_TELEMETRY=1` and the §5.6 vars. `mobile/tsconfig.json` re-includes `src/screens/**/*.tsx` and `src/api/**/*` (the BLG-0003 carve-out is gone). `mobile/jest.config.js` adopted a two-project layout: `ts` (existing pure-TS suite under `ts-jest`) and `rn` (new render smoke tests under `jest-expo`). `mobile/babel.config.js` added with `babel-preset-expo` so RN's Flow polyfills parse under Jest.
- **BLG-0005 — Phone-OTP login.** E.164 normalizer + DES-0002 reducer + `LoginScreen.tsx` against `@supabase/supabase-js`; `db/migrations/0002_handle_new_user.sql` ships the FK + sync trigger per ADR-0004 §3; refresh-token lifetime configured to 14 days. Greek `login.*` strings. No phone or OTP ever logged.
- **BLG-0006 — Insights endpoints + screen.** `db/migrations/0003_insights_rpc.sql` (the two `plpgsql security invoker set search_path = public` RPCs per ADR-0005 §1, both with explicit `WHERE user_id = user_uuid` aggregation guards). Athens-TZ period helper. `InsightsRepository` interface + `InMemoryInsightsRepository` + `SupabaseInsightsRepository`. `GET /insights/summary` + `GET /insights/products` per ADR-0005 §4 with Bearer JWT verification. `mobile/src/screens/insights/InsightsScreen.tsx` renders DES-0003 §3.
- **BLG-0007 — Encrypted offline cache.** `CacheRepository` interface + sanitizer (default-deny on unknown fields, `raw_html` explicitly dropped) + `InMemoryCacheRepository` (LRU at 200 by `last_seen_at`) + `EncryptedAsyncStorageCacheRepository` (AES-256-GCM via `@noble/ciphers/aes`, key in `expo-secure-store` under `wym.cache.aes-256-gcm.v1` per ADR-0006 §2, sanitizer-first + re-sanitize-on-decrypt for defense-in-depth). Greek `offline.*` strings.

`make check` is green: backend 70 + mobile 128 = 198 tests across 13+ suites.

Three follow-up backlog items were filed:

- **BLG-0013** — codify `tzdata` as a Windows-host runtime dep (drift recorded mid-sprint to give Python's `zoneinfo` a tz database).
- **BLG-0014** — re-evaluate `react-native-chart-kit` post-MVP per ADR-0007 §8.
- **BLG-0015** — live `slow`-marked integration test for the insights RPCs against a Supabase test project.

For the latest user-facing snapshot, read `AGENTS.md` §2.6 (shipped features now include Login, Insights, encrypted cache, runnable Scanner) and §2.7 (sprint snapshot updated).

## Next sprint

- **Type**: `discovery`.
- **Theme proposal**: `freelancer-mode`.
- **Number**: **S-005**.
- **Why discovery, not implementation**: the four S-004 items shipped, the Ready queue is now empty (BLG-0004 / BLG-0009 / BLG-0011 are not Ready, and BLG-0013 / BLG-0014 / BLG-0015 are explicit discovery / post-MVP items). Per `AGENTS.md` §4.1.2, the next sprint must be discovery.

### Goals for the discovery sprint S-005

The driving outcome is to unlock bullets **8 + 9** of `AGENTS.md` §2.8 — **a Greek freelancer can sign in, scan a receipt, tag it as a business expense, and export their tagged receipts as a PDF for their accountant**. S-005 produces the contracts; S-006 (implementation) ships the user-visible work.

1. **ADR for the tag-as-business UX.** Inline action on Receipt detail vs Profile-level "import all from period" vs both. Owners: `product-owner`, `product-manager`, `product-designer`, `mobile-builder`, `localization-specialist`. Output: a DES (Profile + tag-on-detail) and a Ready BLG for the mobile + backend implementation.
2. **ADR for the PDF export pipeline.** Compare `reportlab` (Python, no new outbound surface), `weasyprint` (Python, brings GTK / Cairo / Pango deps that need `agent-safety-officer` review), and server-side `puppeteer` / `playwright` (Node, would add a new outbound surface — `agent-safety-officer` review required). Pick one with explicit trade-offs recorded. Owners: `architect`, `backend-builder`, `agent-safety-officer`, `engineering-manager`. Output: ADR + Ready BLG for the `GET /export/business-expenses` endpoint.
3. **ADR for the inferred-category heuristic.** Deferred from ADR-0005 §6. Compare EAN-range tables, description-NLP heuristics, and "deferred-to-later". Owners: `architect`, `data-architect`, `parser-specialist`, `localization-specialist` (Greek-language description matching). Output: ADR (could be a "stay deferred until N receipts are tagged" decision).
4. **`tzdata` codification (BLG-0013).** Either an ADR-0007 amendment or a new short ADR. Owners: `agent-safety-officer`, `engineering-manager`, `architect`.
5. **Real-receipt fixture acquisition path (BLG-0004 follow-through).** Not blocking S-005, but a discovery sprint is the right time to firm up the consent + redaction process so `parser-specialist` can land 4 more triplets when consenting users are recruited. Owners: `parser-specialist`, `security-privacy-officer`.

### Sequencing rule

ADRs in S-005 should be debated **in the order above**. Tag-as-business UX shapes the schema impact; PDF pipeline shapes the outbound-surface posture (and may need `agent-safety-officer` to review a candidate dep tree before we agree); inferred-category is the lowest-priority of the three because "untagged" already works for MVP.

### Acceptance test at S-005 review (discovery)

By the end of S-005, the following exist on the main branch:

- 1 ADR per S-005 goal (3 minimum — tag UX, PDF, inferred-category) plus the BLG-0013 ADR.
- 1 DES per user-visible goal (Profile screen with freelancer toggle + ΑΦΜ field; Tag-on-receipt-detail flow).
- ≥ 3 Ready backlog items for S-006 implementation (login + scan + insights are already done; freelancer-mode items go from `planned` to `ready`).
- `make check` green (no production code changed in a discovery sprint; smoke check only).

### Cadence after that

- **S-006 — implementation** — ship the freelancer items: tag endpoint (`POST /receipts/{id}/tag`), PDF export (`GET /export/business-expenses`), Profile screen (ΑΦΜ + freelancer toggle + export action), tag UX on Receipt detail. After S-006, MVP §2.8 is complete.
- **S-007 — discovery** — open the door to country expansion (RO / IT / PT / ES adapters per §5.9). Or earlier if user feedback during S-006 reveals MVP gaps.

## Open questions queued for S-005 discovery

- **Tag-as-business UX** (goal 1): inline on Receipt detail vs Profile-level period import vs both.
- **PDF export pipeline** (goal 2): `reportlab` (no new outbound surface, Python-pure) vs `weasyprint` (heavier deps) vs server-side rendering (new outbound surface).
- **Inferred-category heuristic** (goal 3): activate now or stay deferred until N tagged receipts give us training data.
- **`tzdata` ADR** (BLG-0013): standalone ADR vs ADR-0007 amendment.
- **Drift-detection CI** (BLG-0009): unblocked once BLG-0004 produces ≥ 1 real-receipt canary; can land as part of S-006 implementation if the canary is ready.

## Notes for whoever picks this up

- **The four S-004 items are done.** Login, Insights, encrypted cache, runnable Scanner all ship together. `AGENTS.md` §2.6 lists the user-visible behavior; `AGENTS.md` §2.7 carries the sprint snapshot.
- **Discovery sprints don't ship production code.** S-005 produces ADRs + designs + Ready items. The simplest litmus test: `git diff main` for an S-005 sprint should touch `docs/`, `.agents/`, and `AGENTS.md` only.
- **Three drift items** were recorded at S-004 close — BLG-0013 is the only one that strictly needs S-005 attention; BLG-0014 and BLG-0015 are passive watches.
- **The Athens-TZ + decimal-as-string contract is now codified.** Any new aggregation endpoint (e.g. for the freelancer PDF) must follow the same shape. ADR-0005 is the source.
- **`agent-safety-officer` will be busy in S-005**: the PDF pipeline ADR (goal 2) almost certainly needs an outbound-host review depending on which candidate wins.
- **`mobile/babel.config.js` is now a permanent fixture** of the mobile project. Don't remove it — `jest-expo` needs it.
- **PowerShell `make check` quirk**: bare `make check` in some PowerShell sessions still misresolves the Makefile target. Use `& "C:\Program Files (x86)\GnuWin32\bin\make.exe" -f Makefile check` from PowerShell when in doubt. Logged in `S-003-LOG-0001` and confirmed again in `S-004-LOG-0001`.
