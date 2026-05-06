# Sprint S-004 — Login + Insights + Encrypted cache + Runnable scanner

- Type: implementation
- Theme: `login-insights-cache-runnable-scanner`
- Start: 2026-04-30
- Chair: orchestrator
- Participants: backend-builder, mobile-builder, data-architect, qa, engineering-manager, security-privacy-officer, agent-safety-officer, localization-specialist, product-designer, devops-engineer

## Why this sprint

The S-003 discovery sprint produced four ADRs, two designs, and four well-formed Ready items (BLG-0005, BLG-0006, BLG-0007, BLG-0012). All four sit on shared infrastructure that has already been debated, signed off, and pinned. Per `AGENTS.md` §4.1.2 with a full Ready queue the next sprint must be implementation. This sprint pulls all four and brings the app to its first end-to-end usable state for a Greek user.

## Goals

1. Land the ADR-0007 mobile runtime tree behind the gate (BLG-0012) so every other deliverable has a runtime to run against.
2. Ship Supabase native phone-OTP login end-to-end (BLG-0005) with the `auth.users` ↔ `public.users` trigger and DES-0002 UX.
3. Ship the two insights endpoints + screen (BLG-0006) with the Athens-TZ period helper, the two RPC migrations, and DES-0003 UX.
4. Ship the encrypted offline cache (BLG-0007) with sanitizer, LRU eviction, and offline-UX rules from ADR-0006 §7.

## Scope

**In:**

- BLG-0012 — Expo SDK 51 install per ADR-0007 §2; `package-lock.json` regenerated; `mobile/.env.sample` extended; `tsconfig.json` re-includes `src/screens/**/*.tsx` + `src/api/**/*`; `jest.config.js` switches to `jest-expo`; one render test for `ScannerScreen`.
- BLG-0005 — `mobile/src/lib/phone.ts` (E.164 normalizer); `mobile/src/screens/login/state.ts` (DES-0002 reducer); `mobile/src/screens/login/LoginScreen.tsx`; `db/migrations/0002_handle_new_user.sql`; Greek `login.*` strings.
- BLG-0006 — `db/migrations/0003_insights_rpc.sql` (two RPCs per ADR-0005 §1); `backend/app/insights/period.py` (Athens-TZ helper); `backend/app/insights/repository.py` (interface + `InMemory` + `Supabase` impl); `backend/app/routes/insights.py` (`GET /insights/summary` + `GET /insights/products` per ADR-0005 §4); `mobile/src/screens/insights/state.ts` + `InsightsScreen.tsx`; Greek `insights.*` strings.
- BLG-0007 — `mobile/src/cache/types.ts` (interface); `mobile/src/cache/sanitizer.ts`; `mobile/src/cache/InMemoryCacheRepository.ts`; `mobile/src/cache/EncryptedAsyncStorageCacheRepository.ts`; LRU eviction at 200; key namespace `wym.cache.aes-256-gcm.v1`; Greek `offline.*` strings.

**Out (explicitly):**

- New ADRs / new architectural decisions — surface as `drift` per `AGENTS.md` §4.1.1.
- New external surfaces beyond the ADR-0007 set — already reviewed by `agent-safety-officer`.
- Real-receipt fixture acquisition (BLG-0004) — parallel discovery work.
- Drift-detection CI (BLG-0009) — waits on BLG-0004 canary.
- Profile language switch (BLG-0011) — out of MVP.
- The freelancer `POST /receipts/{id}/tag` endpoint, profile screen, and PDF export — queued for S-005 discovery.

## Ready items pulled

- **BLG-0012** — Install Expo + RN runtime deps and wire `ScannerScreen.tsx` into the gate (sequencing rule: lands first).
- **BLG-0005** — Phone-OTP authentication (login screen + Supabase native flow).
- **BLG-0006** — Insights summary + top-products endpoints + Insights screen.
- **BLG-0007** — Encrypted offline cache for receipts + offline UX.

## Risks & known unknowns

- **Expo SDK 51 install on Windows**: `npm install` of the full pinned tree may surface peer-dep or native-module quirks on the agent's PowerShell environment. Mitigation: install in stages, use `npm install --legacy-peer-deps` only if a peer-dep is provably wrong (per ADR-0007 supply-chain review), and if the install genuinely fails, ship the pure-TS deliverables (reducers, normalizer, sanitizer, period helper, backend endpoints) and reopen BLG-0012 with the specific install-failure log as drift. The bar is `make check` green, not "no fallback".
- **Insights RPC integration**: the `slow`-marked SQL test (per ADR-0005 §8) requires either a local Postgres or a Supabase test project. We ship the SQL migration and the `InMemoryInsightsRepository` covers the contract; the live test stays marked `slow` and is run manually by `devops-engineer` once the Supabase project is provisioned.
- **`expo-secure-store` and `@react-native-async-storage/async-storage` mocking under `jest-expo`**: tests for `EncryptedAsyncStorageCacheRepository` need either `jest.mock` shims or an `InMemoryCacheRepository`-only test set. Mitigation: round-trip + sanitizer + LRU tests run against `InMemoryCacheRepository` (which deliberately mirrors the encrypted variant's semantics minus the encryption); the encrypted variant carries a thinner test set focused on key management + sanitizer-before-encrypt order.

## User direction (if `go` was used)

- Direction: `GO` (no extra text).
- Honored in scope: yes — the sprint follows the plan recorded in `docs/plan.md` from S-003 close, with no scope adjustment requested.

## Definition of done

- All four BLG acceptance bullet sets satisfied, OR the unmet bullets are recorded as `drift` backlog items with a written reason.
- `make check` green at sprint close.
- `docs/done.md` updated with completed BLGs.
- `docs/backlog.md` updated (completed items removed; drift items added).
- `docs/plan.md` rewritten to reflect S-004 close + S-005 direction.
- `AGENTS.md` §2.6 + §2.7 refreshed.
- Sprint REV + UREV written.
