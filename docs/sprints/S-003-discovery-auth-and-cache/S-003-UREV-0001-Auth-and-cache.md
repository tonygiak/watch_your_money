# Sprint S-003 — User review

## Where we are right now

Sprint **S-003 (discovery, `auth-and-cache`)** closed today. We agreed exactly how a user will sign in, exactly how the Insights screen computes "this month vs last", exactly what the offline cache looks like (and that it's encrypted at rest), and exactly which Expo packages we are committing to — locked into four ADRs and two design artifacts. **No production code changed** in this sprint (that's the point of a discovery sprint — we *plan*, then S-004 implements). One admin edit landed: `AGENTS.md` §5.3.2 now matches what the endpoints actually accept (Bearer JWT, no client-supplied `user_id`).

The next sprint is **S-004 implementation (`login-insights-cache-runnable-scanner`)**, which ships the second wave of user-visible behavior: install the app → sign in with your phone → scan a receipt (now runnable on a real device) → open Insights → kill the network and still see your cached list.

## What changed

- **4 ADRs accepted** under `docs/adr/`:
  - **ADR-0004** — phone-OTP login uses Supabase native OTP. No new third-party paid services. Refresh tokens shortened to 14 days. Direct Twilio is **rejected** without a fresh ADR.
  - **ADR-0005** — Insights aggregations live in two PostgREST RPC functions (the math runs in Postgres for speed), but the orchestration stays in FastAPI (no DB views — the math is relocatable later). Period boundaries are computed in Athens timezone, not UTC.
  - **ADR-0006** — receipts are cached on the device with **AES-256-GCM** encryption. The key lives in the OS keystore (Keychain / Android Keystore via `expo-secure-store`). Cap is 200 receipts, LRU eviction, sanitizer drops anything outside a documented "cacheable subset" (no `raw_html`).
  - **ADR-0007** — exactly which Expo packages we're going to install in S-004. SDK 51, 17 runtime + 6 dev packages, all exact-pinned, `package-lock.json` committed, `npm ci` discipline. `agent-safety-officer` ran a supply-chain review on the whole set; verdict captured verbatim in the ADR.
- **2 design artifacts** under the sprint folder:
  - **DES-0002** — Login screen (state machine, Greek-first copy, accessibility, telemetry, phone-normalizer rules).
  - **DES-0003** — Insights screen (period selector, by-category / top-merchants / top-products sections, empty + offline states, full Greek copy).
- **4 backlog items refined to Ready**: BLG-0005 (Login), BLG-0006 (Insights endpoints + screen), BLG-0007 (Encrypted offline cache), BLG-0012 (Expo runtime install + gate re-inclusion). These are what S-004 pulls from.
- **2 backlog items kept on hold** with sharper acceptance: BLG-0009 (drift-detection CI — depends on a consenting real-receipt canary set), BLG-0011 (Profile language switch — out of MVP per `AGENTS.md` §2.9).
- **1 admin closed** — **BLG-0010**: `AGENTS.md` §5.3.2 now lists the body shape that ADR-0002 actually requires (`{ "qr_url": string }`, no `user_id`) and extends the same security tightening to the insights endpoints per ADR-0005.

## How to verify (delivery sprints)

N/A — this was a discovery sprint, no shipped behavior to test on a real device. The runnable shipped behavior arrives in S-004.

## How to review (discovery sprint)

If you have 15 minutes, read in this order — concrete first, abstract last:

1. `docs/sprints/S-003-discovery-auth-and-cache/S-003-DES-0002-Login-ux.md` — the most concrete picture of what login will look like (every screen, every Greek string).
2. `docs/sprints/S-003-discovery-auth-and-cache/S-003-DES-0003-Insights-ux.md` — same for the Insights screen.
3. `docs/adr/S-003-ADR-0004-Phone-otp-provider.md` — why Supabase, why not Twilio, what the rate-limit / GDPR / session-lifetime story is.
4. `docs/adr/S-003-ADR-0006-Offline-cache-strategy.md` — what the offline experience is, what's in the cache vs not, and how encryption-at-rest works on the device.
5. `docs/adr/S-003-ADR-0005-Insights-computation.md` — where the aggregation math runs and why we picked RPC over views.
6. `docs/adr/S-003-ADR-0007-Expo-runtime-tree.md` — the exact list of packages + versions; this is the "scariest" deliverable (largest dep delta the project will see) so the supply-chain review verdict is right inside it.
7. `docs/backlog.md` — confirm BLG-0005, BLG-0006, BLG-0007, BLG-0012 are marked **Ready: yes**. BLG-0009 + BLG-0011 should still be **Ready: no**, intentionally.
8. `docs/plan.md` — what S-004 will actually do and why.
9. `AGENTS.md` §5.3.2 — confirm the new "Authentication contract" preamble + the dropped `user_id` fields in the body / queries.

If anything in these decisions feels wrong, **surface it before S-004 starts**. Once S-004 lands implementation against these contracts, changing them is materially more expensive (mobile dep tree, RPC migrations, encryption key namespace, login flow, etc.).

A few specific things to look for during review:

- **Phone normalizer** (DES-0002 §7) — Greek mobile numbers must start with `6` after the `+30` country code. If you have edge cases (toll-free, landlines from older accounts, numbers held abroad), flag them before S-004 implementation.
- **Cacheable subset** (ADR-0006 §5) — every field that survives the sanitizer is enumerated explicitly. If you want a field cached that isn't on that list (e.g. for an offline detail view), flag it now; default-deny is the rule.
- **`react-native-chart-kit`** (ADR-0007 §2) — the only "second-tier maintained" dep we're accepting; flagged for re-evaluation post-MVP. If you have strong feelings about chart libraries, this is the moment.
- **14-day refresh token** (ADR-0004 §4) — shortened from Supabase's 30-day default. Users will re-authenticate every 14 days. If user-research indicates this is too aggressive, raise it before S-004.

## Where to look next

- `AGENTS.md` §2.6 — shipped features (still reflects S-002's first user-visible behavior; updates again after S-004).
- `AGENTS.md` §2.7 — current sprint snapshot (now reflects S-003 closing).
- `docs/plan.md` — S-004 plan.
- `docs/backlog.md` — what's planned and what's Ready (BLG-0005, BLG-0006, BLG-0007, BLG-0012).
- `docs/done.md` — completed work (S-003 added: BLG-0010 admin edit; S-002 + S-000 unchanged).
