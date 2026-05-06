# Sprint S-004 — Review

- Type: implementation
- Closed: 2026-04-30
- Chair: orchestrator

## Outcomes

S-004 takes the app from "scan-and-store works on a real Greek receipt" (S-002) to **"a Greek user can install, sign in with phone OTP, scan a receipt, see insights, and stay useful offline"** — the §2.8 MVP definition of done is now reachable with only the freelancer-mode backlog left between us and bullets 8 + 9.

Concretely:

- **BLG-0012** — The full ADR-0007 mobile runtime tree is installed against `package-lock.json`. `tsconfig.json` and `jest.config.js` re-include the BLG-0003 carve-out (`ScannerScreen.tsx` + `mobile/src/api/receipts.ts`). `babel-preset-expo` is wired so React Native's Flow-flavored polyfills parse under Jest. One smoke render test for `ScannerScreen` proves the Expo runtime tree is live in the gate.
- **BLG-0005** — Phone-OTP login lands end-to-end: `mobile/src/lib/phone.ts` (E.164 normalizer, `+30` default), `mobile/src/screens/login/state.ts` (DES-0002 reducer, every transition tested), `mobile/src/screens/login/LoginScreen.tsx` (renders DES-0002 §4 against `@supabase/supabase-js`, never logs phone or OTP), `mobile/src/api/auth.ts` (outcome-tagged wrapper around the SDK), `db/migrations/0002_handle_new_user.sql` (FK + sync trigger per ADR-0004 §3, `security definer` with `set search_path = public`, `is_freelancer=false` default). Greek strings under `login.*`. Telemetry events count-only.
- **BLG-0006** — Insights ships end-to-end: `db/migrations/0003_insights_rpc.sql` (the two RPCs per ADR-0005 §1, `plpgsql security invoker set search_path=public`, explicit `WHERE user_id = user_uuid`), `backend/app/insights/period.py` (Athens-TZ boundaries, leap-year + year-rollover tested), `backend/app/insights/repository.py` (interface + `InMemoryInsightsRepository` + `SupabaseInsightsRepository`), `backend/app/routes/insights.py` (`GET /insights/summary` + `GET /insights/products` per ADR-0005 §4 with Bearer JWT verification per ADR-0002, decimal-as-string responses, "untagged" category bucketing). Mobile reducer + screen render the layout in DES-0003.
- **BLG-0007** — Encrypted offline cache: `mobile/src/cache/types.ts` (interface + constants), `sanitizer.ts` (default-deny on unknown fields; `raw_html` explicitly dropped), `InMemoryCacheRepository.ts` (LRU at 200, ordered by `last_seen_at`), `EncryptedAsyncStorageCacheRepository.ts` (AES-256-GCM via `@noble/ciphers/aes`, key in `expo-secure-store` under `wym.cache.aes-256-gcm.v1` per ADR-0006 §2, sanitizer-first + re-sanitize-on-decrypt for defense-in-depth). Greek `offline.*` strings.

The acceptance test promised in S-004's plan (`docs/plan.md` § "Acceptance test at S-004 review") becomes verifiable end-to-end on a real device once `mobile/.env` is populated; the `UREV` enumerates the steps.

## `make check`

- Status: **green**
- Last run: 2026-04-30 19:00
- Tests: backend 70 + mobile 128 = 198 (pure-TS reducer / cache / phone tests, parser fixtures, period helper, repository aggregations, route contracts, RN render smoke tests under `jest-expo`).

## Sign-offs (from `AGENTS.md` §4.11)

- New endpoint / API contract change (`/insights/summary`, `/insights/products`): `architect`, `engineering-manager`.
- New mobile screen or UX flow (`LoginScreen`, `InsightsScreen`, runnable `ScannerScreen`): `product-designer`, `localization-specialist`.
- Schema migration / new RLS policy (`db/migrations/0002_handle_new_user.sql`, `db/migrations/0003_insights_rpc.sql`): `data-architect`, `security-privacy-officer`.
- Auth flow change (Supabase native OTP, 14-d refresh, `auth.users` ↔ `public.users` trigger): `security-privacy-officer`, `data-architect`.
- New runtime dependency (full ADR-0007 §2 tree + `tzdata` for `zoneinfo` on Windows hosts): `agent-safety-officer`, `engineering-manager` (ADR-0007 pre-signed; `tzdata` recorded as drift in `BLG-0013`).
- New MCP integration / new outbound host: **none**.
- User-data flow change (login session storage, encrypted cache): `security-privacy-officer`, `agent-safety-officer`.
- Sprint scope change mid-sprint: **none**.
- Adding / retiring an agent: **none**.

## ADRs decided

**None this sprint.** S-004 is a delivery sprint; no new architectural decisions were taken (per `AGENTS.md` §4.1.1). All implementation followed ADR-0002, ADR-0004, ADR-0005, ADR-0006, ADR-0007 exactly.

## Items moved backlog → done

- **BLG-0005** — Phone-OTP authentication (login screen + Supabase native flow).
- **BLG-0006** — Insights summary + top-products endpoints + Insights screen.
- **BLG-0007** — Encrypted offline cache for receipts + offline UX.
- **BLG-0012** — Install Expo + react-native runtime deps and wire `ScannerScreen.tsx` into the gate.

## New backlog items (drift / follow-ups)

- **BLG-0013** (drift) — `tzdata==2024.2` added to `backend/requirements.txt` mid-sprint to give Python's `zoneinfo` a tz database on Windows hosts. PyPI is already on the allowlist and the package is data-only (no executable code), but the precedent of mid-implementation runtime-dep adds must be reviewed in S-005 discovery and either codified as an ADR (canonical "use `tzdata` on Windows") or rolled into ADR-0007's pinned set.
- **BLG-0014** — `react-native-chart-kit` re-evaluation post-MVP, per ADR-0007 §8. Already flagged; explicitly tracked as a backlog item now that the dep is installed.
- **BLG-0015** — Live integration test for the insights RPCs against a Supabase test project, marked `slow` per ADR-0005 §8. The InMemory repository covers the contract today; a live test will close the loop in S-005 implementation.

## Learnings

- Splitting each BLG into a "pure-TS / pure-Python" pass and an "RN runtime" pass paid off: the install of the Expo SDK 51 tree on a Windows + PowerShell + OneDrive-path environment had no surprises because every reducer, sanitizer, normalizer, and repository was already green before the install ran. If `npm install` had failed (the risk recorded in `S-004-PLN-0001`), we would have shipped half the sprint anyway.
- `babel-preset-expo` is required even for `jest-expo` test runs; the `jest-expo` preset alone does not register the Babel preset for transitive RN sources. Adding `mobile/babel.config.js` is now the standard.
- `zoneinfo` on Windows needs `tzdata`. The fix is a one-line `requirements.txt` add but it surfaces a class of "Python-stdlib-completeness depends on the host OS" issues that should be recorded as a recurring rule.
- The `jest-expo` two-project layout (`ts` for pure logic, `rn` for render tests) keeps the fast 4-second test loop intact while letting screen tests cost the React Native bring-up only when needed.
- Greek-first copy review during the sprint pass surfaced one dropped string (`scanner.scanning.header` was rendered with the wrong test fixture); the fix was a 1-line correction in the render test, not a string-table change.

## Next sprint

- Type: **discovery**.
- Theme proposal: **`freelancer-mode`** — `S-005` opens up bullets 8 + 9 of `AGENTS.md` §2.8 (tag-as-business, ΑΦΜ in Profile, PDF export endpoint), plus the open questions queued in `docs/plan.md` ("Open questions queued for S-005 discovery").
- Driving outcome: a Greek **freelancer** can sign in, scan a receipt, tag it as a business expense with a category, and export their tagged receipts as a PDF for their accountant.
