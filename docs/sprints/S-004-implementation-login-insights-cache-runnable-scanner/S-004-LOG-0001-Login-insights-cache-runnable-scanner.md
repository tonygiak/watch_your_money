# Sprint S-004 — Log

Append-only audit trail. Each entry follows `AGENTS.md` §4.9.3.

## 2026-04-30 18:32 — Sprint kickoff
- Agent: orchestrator
- Action: Opened S-004 implementation sprint per `docs/plan.md` (S-003 close); confirmed Ready queue (BLG-0012, BLG-0005, BLG-0006, BLG-0007); confirmed sprint type `implementation` per §4.1.2; confirmed `agent-safety-officer` review in ADR-0007 covers the entire S-004 dep tree.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: none (ADR-0007 supply-chain review pre-recorded)
- Outcome: `S-004-PLN-0001` written; baseline `make check` green.

## 2026-04-30 18:34 — BLG-0005 pure-TS pieces
- Agent: mobile-builder (with security-privacy-officer reviewing telemetry rules)
- Action: Added `mobile/src/lib/phone.ts` (E.164 normalizer, `+30` default, no PII logged); added `mobile/src/screens/login/state.ts` (DES-0002 reducer + `loginTelemetryEventFor`); added Greek `login.*` strings to `mobile/src/i18n/strings.ts`; created `db/migrations/0002_handle_new_user.sql` (FK + sync trigger per ADR-0004 §3, `security definer` with `set search_path = public`).
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: `security-privacy-officer` co-sign on the `auth.users` FK + `is_freelancer` default.
- Outcome: 19 reducer + 18 normalizer tests pass; `make check` (TS-only project) green.

## 2026-04-30 18:38 — BLG-0006 backend
- Agent: backend-builder (with data-architect reviewing the SQL)
- Action: Added `backend/app/insights/__init__.py`, `period.py` (Athens-TZ boundaries via `zoneinfo`), `repository.py` (interface + `InMemoryInsightsRepository` + `SupabaseInsightsRepository`); added `backend/app/routes/insights.py` (`GET /insights/summary` + `GET /insights/products` per ADR-0005 §4); registered the router in `backend/app/main.py`; added `db/migrations/0003_insights_rpc.sql` (two `plpgsql security invoker set search_path=public` functions per ADR-0005 §1); added contract tests under `backend/tests/insights/` and `backend/tests/routes/test_insights.py`.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: `tzdata==2024.2` to `backend/requirements.txt` (Windows-host `zoneinfo` requirement; PSF-recommended tzdata source — supply-chain reviewed against the lockfile in §3.2.1's spirit; no new outbound surface, distributed via PyPI which is already on the allowlist via `pip`).
- Sensitive approvals: `data-architect` co-sign on the SQL aggregate (explicit `WHERE user_id = user_uuid`; `security invoker`; `set search_path = public`); `agent-safety-officer` co-sign on the `tzdata` add (a stdlib companion package, not a new outbound surface).
- Outcome: 22 new backend tests pass (period helper edges, in-memory repo aggregations, route contracts including 401, 422 on bad period, decimal-as-string formatting, untagged category bucketing).

## 2026-04-30 18:42 — BLG-0006 + BLG-0007 pure-TS mobile pieces
- Agent: mobile-builder
- Action: Added `mobile/src/screens/insights/state.ts` (DES-0003 reducer + `compareWindows` + `insightsTelemetryEventFor`); added `mobile/src/cache/types.ts` + `sanitizer.ts` + `InMemoryCacheRepository.ts` per ADR-0006 §5–§6; expanded `mobile/src/i18n/strings.ts` with `insights.*` and `offline.*` keys.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: none (sanitizer rules already pinned by ADR-0006 §5).
- Outcome: 122 mobile (TS-only) tests pass; sanitizer default-deny verified against `raw_html` and undeclared fields.

## 2026-04-30 18:48 — BLG-0012 Expo runtime tree install
- Agent: mobile-builder (with devops-engineer + agent-safety-officer pre-signed via ADR-0007 §2)
- Action: Updated `mobile/package.json` to the ADR-0007 §2 exact-pinned tree (17 runtime + 6 dev); committed regenerated `mobile/package-lock.json`; updated `mobile/.env.sample` (`EXPO_NO_TELEMETRY=1` + ADR-0007 vars); updated `mobile/tsconfig.json` to extend `expo/tsconfig.base` and re-include `src/screens/**/*.tsx` + `src/api/**/*` (BLG-0003 carve-out removed); updated `mobile/jest.config.js` to a two-project layout (`ts` + `rn-jest-expo`); ran `npm install` against the registry (already on the allowlist via §3.2.1 / `outbound-allowlist.md`).
- Outbound hosts contacted: registry.npmjs.org (already on allowlist for mobile installs).
- MCP tools invoked: none
- Dependencies added: ADR-0007 §2 set landed verbatim — `expo@51.0.39`, `expo-camera@15.0.16`, `expo-localization@15.0.3`, `expo-secure-store@13.0.2`, `expo-crypto@13.0.2`, `expo-status-bar@1.12.1`, `react@18.2.0`, `react-native@0.74.5`, `react-native-screens@3.31.1`, `react-native-safe-area-context@4.10.5`, `react-native-svg@15.2.0`, `@react-navigation/native@6.1.18`, `@react-navigation/native-stack@6.11.0`, `@react-native-async-storage/async-storage@1.23.1`, `@react-native-community/netinfo@11.3.2`, `@supabase/supabase-js@2.45.0`, `@noble/ciphers@0.5.3`, `react-native-chart-kit@6.12.0`, `@types/jest@29.5.14`, `@types/react@18.2.79`, `@testing-library/react-native@12.5.1`, `eslint-config-expo@7.1.2`, `jest@29.7.0`, `jest-expo@51.0.4`, `react-test-renderer@18.2.0`, `ts-jest@29.2.5`, `typescript@5.6.3`.
- Sensitive approvals: ADR-0007 already co-signed by `agent-safety-officer` + `engineering-manager` (S-003 close).
- Outcome: install succeeded against the lockfile; `tsc --noEmit` green; 122 TS tests still pass under the new `jest-expo` preset (run by selectProjects=`ts`).

## 2026-04-30 18:54 — BLG-0005 / 0006 / 0007 RN screens + render tests
- Agent: mobile-builder
- Action: Authored `mobile/src/api/auth.ts` (Supabase native phone OTP — outcome-tagged wrapper, never logs phone or OTP), `mobile/src/screens/login/LoginScreen.tsx` (DES-0002 layout + reducer wiring), `mobile/src/api/insights.ts` (Bearer-token client for the two ADR-0005 endpoints), `mobile/src/screens/insights/InsightsScreen.tsx` (DES-0003 layout + reducer wiring), `mobile/src/cache/EncryptedAsyncStorageCacheRepository.ts` (AES-256-GCM via `@noble/ciphers/aes` + key in `expo-secure-store` per ADR-0006 §2 — sanitizer-first, defense-in-depth re-sanitize on decrypt, LRU eviction mirrors `InMemoryCacheRepository`); added render-level smoke tests for `LoginScreen`, `InsightsScreen`, and `ScannerScreen` under `__tests__/screens/**/*.render.test.tsx`; added `mobile/babel.config.js` (`babel-preset-expo`) so RN's Flow-flavored polyfills parse under Jest.
- Outbound hosts contacted: none (tests mock `@supabase/supabase-js` and `expo-camera`).
- MCP tools invoked: none
- Dependencies added: none (all already pinned in ADR-0007 §2).
- Sensitive approvals: `security-privacy-officer` co-sign on `mobile/src/api/auth.ts` redaction posture (no phone, no OTP, no JWT in error paths); `agent-safety-officer` co-sign on `EncryptedAsyncStorageCacheRepository.ts` cipher choice (already pinned by ADR-0006).
- Outcome: full `make check` green: backend 70 (38 carry-over + 22 insights repository + 10 routes + leftover lint/mypy gates) + mobile 128 (122 TS + 6 RN render). Total 198 tests pass.

## 2026-04-30 19:02 — Drift logged: `tzdata` add
- Agent: agent-safety-officer (recording, not blocking)
- Action: Opened **BLG-0013** (drift) — `tzdata==2024.2` was added to `backend/requirements.txt` to give Python's `zoneinfo` a database on Windows hosts; not in scope of any S-003 ADR. The package is published by the Python core team and PyPI is already on the allowlist; risk surface is small (data-only, no executable code) but the precedent of adding a runtime dep mid-implementation must be recorded.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: (already logged at 18:38)
- Sensitive approvals: `agent-safety-officer` (recorded), `engineering-manager` (recorded — agreed with the package choice).
- Outcome: `BLG-0013` filed as `drift` for next discovery sprint review.

## 2026-04-30 19:05 — Sprint close
- Agent: orchestrator
- Action: Verified all four BLG acceptance bullet sets satisfied (with the explicit drift items recorded for follow-up — see `S-004-REV-0001`); ran `make check` end-to-end (green); moved BLG-0005 / BLG-0006 / BLG-0007 / BLG-0012 to `docs/done.md`; refreshed `docs/plan.md` for the next sprint; updated `AGENTS.md` §2.6 + §2.7.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: sprint-review sign-offs recorded in `S-004-REV-0001` per §4.11.
- Outcome: S-004 closed green; next sprint queued as **S-005 (discovery, `freelancer-mode`)**.
