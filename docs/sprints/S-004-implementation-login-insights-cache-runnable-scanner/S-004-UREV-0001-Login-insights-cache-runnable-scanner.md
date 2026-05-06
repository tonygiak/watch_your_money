# Sprint S-004 — User review

## Where we are right now

S-004 (`implementation`, `login-insights-cache-runnable-scanner`) closed on 2026-04-30 with `make check` green: 70 backend + 128 mobile = 198 tests. **Phone-OTP login, Insights, the encrypted offline cache, and the runnable Scanner all ship together.** The MVP definition of done in `AGENTS.md` §2.8 is now reachable end-to-end for a Greek consumer; only the freelancer-mode bullets (8 + 9) remain.

## What changed

- **Login + phone-OTP** (BLG-0005): `mobile/src/screens/login/LoginScreen.tsx` is wired to Supabase's native phone-OTP flow with E.164 normalization and 14-day refresh tokens. New users automatically get a `public.users` row via the `handle_new_user` trigger.
- **Insights** (BLG-0006): `GET /insights/summary` and `GET /insights/products` are live, both Bearer-JWT-protected; `mobile/src/screens/insights/InsightsScreen.tsx` renders the period selector, vs-previous comparison, by-category, top-merchants, and top-products sections from DES-0003.
- **Encrypted offline cache** (BLG-0007): receipts read after sign-in are mirrored to AsyncStorage, encrypted with AES-256-GCM, with the key in `expo-secure-store`. LRU cap at 200. Offline UX banners and disabled-action rules from ADR-0006 §7.
- **Runnable scanner** (BLG-0012): the Expo SDK 51 runtime tree from ADR-0007 §2 is installed and committed (`mobile/package-lock.json`); `ScannerScreen.tsx` and `mobile/src/api/receipts.ts` are back in the gate (typecheck + tests).
- **Greek-first copy** for `login.`*, `insights.`*, and `offline.*` is in `mobile/src/i18n/strings.ts` with English fallback.
- **Drift recorded**: `tzdata==2024.2` added to `backend/requirements.txt` so `zoneinfo` works on Windows hosts (BLG-0013, queued for S-005 review).

## How to verify (delivery sprint)

You need: Python 3.11+, Node.js, `make`, and **Expo Go** on a real Android / iOS device.

1. **Configure secrets.**
  - Copy `backend/.env.sample` to `backend/.env` and set `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_JWT_SECRET`.
  - Copy `mobile/.env.sample` to `mobile/.env` and set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `BACKEND_API_URL` (your laptop's LAN IP, e.g. `http://192.168.1.10:8000`).
  - In your Supabase project, enable phone OTP and configure your SMS provider (e.g. Twilio) on the Supabase side. The mobile app only knows about Supabase; no Twilio credentials touch the device.
2. **Apply the new migrations.**
  - Run `db/migrations/0002_handle_new_user.sql` and `db/migrations/0003_insights_rpc.sql` on your Supabase project (Supabase SQL editor or `supabase db push`).
3. **Run the gate.**
  - `make check` — should print `make check: green`.
4. **Start the runtime.**
  - `make run-backend` — boots FastAPI on `:8000`.
  - `make run-mobile` — boots Expo. Scan the QR with Expo Go on a real device.
5. **End-to-end acceptance test** (matches `docs/plan.md` § "Acceptance test at S-004 review"):
  - Sign in with your Greek mobile in `+30XXXXXXXXXX` or `6XXXXXXXXX` form. Verify the SMS code arrives, the screen says "Είσοδος επιτυχής", and you land on Home.
  - Tap **Σαρώστε απόδειξη** and scan a Greek `e-invoicing.gr` QR. The receipt detail should appear in ≤ 5 seconds (`AGENTS.md` §2.5).
  - Tap **Στατιστικά**. You should see this month's total, comparison vs the previous month, by-category, top merchants, and top products — all formatted as `X,XX €` with Greek strings.
  - Turn airplane mode on. Re-open the app. The receipt list should still render with the offline banner ("Είστε εκτός σύνδεσης") and the Scanner / Insights actions disabled per ADR-0006 §7. Open a cached receipt — it should render with no `raw_html` field exposed.
  - Turn airplane mode off. The banner disappears; Insights re-loads.
6. **Verify RLS** (one-time, on a test phone): create a second user (different `+30` number) and confirm that user can't see the first user's receipts via the Supabase REST API.

## How to review (discovery sprints)

(N/A — this is a delivery sprint.)

## Where to look next

- `AGENTS.md` §2.6 — shipped features (now includes Login, Insights, encrypted cache, runnable Scanner).
- `AGENTS.md` §2.7 — current sprint snapshot (S-004 closed; S-005 discovery queued for `freelancer-mode`).
- `docs/plan.md` — next sprint direction.
- `docs/backlog.md` — what's planned / in-progress (BLG-0013, BLG-0014, BLG-0015 added this sprint; BLG-0016 added 2026-05-07 — see addendum below).
- `docs/done.md` — what has been completed (S-004 entry on top).

---

## Addendum — Verification finding (2026-05-07)

The user walked through this UREV after S-004 close. Here is the exact state observed:

**Verified green:**

- Step 1 — `backend/.env` and `mobile/.env` configured against the user's Supabase project (`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_JWT_SECRET`, `SUPABASE_ANON_KEY`, `BACKEND_API_URL`).
- Step 2 — migrations applied successfully on the user's Supabase project. `0001_init.sql` was already present; `0002_handle_new_user.sql` and `0003_insights_rpc.sql` ran clean. Verification query returns `handle_new_user`, `insights_summary_for_user`, `insights_top_products_for_user`. **One drift fix landed during this step**: `db/migrations/0003_insights_rpc.sql` had a `GROUP BY` mismatch (`case when coalesce(ean, '') = '' then '' else ean end as ean` vs the grouping key) that Supabase rejected with `ERROR: 42803`. Replaced the SELECT expression with `coalesce(min(ean), '')` — semantically identical (all rows in a group share the same EAN) and groups now match. The migration is forward-only; this counts as an in-place fix to a not-yet-applied migration on the user's environment, **not** a new migration. No backlog item needed; tracked here for audit.
- Step 3 — `make check` green: 70 backend + 128 mobile = 198 tests across 13 suites. (PowerShell quirk: must invoke as `make -f Makefile check` per `docs/plan.md` notes.)
- Step 4a — `make run-backend` boots cleanly: `Uvicorn running on http://127.0.0.1:8000`, `Application startup complete`.

**Blocked:**

- Step 4b — `make run-mobile` starts the Expo bundler but **Expo Go on iOS rejects the project**:
  > `ERROR  Project is incompatible with this version of Expo Go.`
  > `The installed version of Expo Go is for SDK 54.0.0.`
  > `The project you opened uses SDK 51.`
  iOS Expo Go only ships the latest SDK; older SDK runtimes are not installable on iOS devices.
- Step 5 — end-to-end acceptance test (sign in → scan → view Insights → offline mode → restore) **cannot run on the user's device** until the SDK situation is resolved.
- Step 6 — RLS verification (second user, cross-tenant read) is unblocked from the backend / SQL side but the second-device test on iOS shares the same blocker.

**Mitigation filed:**

- **BLG-0016 — Upgrade Expo SDK 51 → 54** (`docs/backlog.md`). Per the agentic process: ADR debate in **S-005 (discovery)** with `architect` + `engineering-manager` + `agent-safety-officer` (supply-chain review) + `mobile-builder`. Implementation in **S-006**, ideally landing first so the freelancer-mode UREV can run on a real device. ADR-0007 will be amended (or superseded) once the decision is made.
- **In-tree compat-matrix drift, folded into BLG-0016.** `expo start` also surfaced two warnings on top of the SDK mismatch: `@react-native-community/netinfo@11.3.2` vs SDK 51 expected `11.3.1`, and `typescript@5.6.3` vs SDK 51 expected `~5.3.3`. Both are explicit decisions in ADR-0007 §2 (`mobile-builder` Round 1 picked `netinfo@11.3.2`, and the `typescript@5.6.3` line is the ADR's "stays" decision), so silently editing them mid-conversation would violate `AGENTS.md` §3.2 / §4.4. The S-005 ADR for BLG-0016 must therefore explicitly address them — re-align to the SDK matrix or record a deliberate deviation — and `expo-doctor` clean becomes the S-006 acceptance criterion that catches any lingering drift automatically.

**Workarounds available right now (without waiting for S-006):**

- An Android device with a sideloaded SDK 51 Expo Go APK from `expo.dev/go?sdkVersion=51&platform=android` would let the on-device acceptance script run before S-006 lands.
- An iOS Simulator on a Mac with the SDK 51 Expo Go bundle would also work.

Otherwise, the on-device acceptance test is deferred to S-006 close, where it merges with the S-006 freelancer-mode UREV.