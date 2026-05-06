# Sprint S-004 — User review

## Where we are right now

S-004 (`implementation`, `login-insights-cache-runnable-scanner`) closed on 2026-04-30 with `make check` green: 70 backend + 128 mobile = 198 tests. **Phone-OTP login, Insights, the encrypted offline cache, and the runnable Scanner all ship together.** The MVP definition of done in `AGENTS.md` §2.8 is now reachable end-to-end for a Greek consumer; only the freelancer-mode bullets (8 + 9) remain.

## What changed

- **Login + phone-OTP** (BLG-0005): `mobile/src/screens/login/LoginScreen.tsx` is wired to Supabase's native phone-OTP flow with E.164 normalization and 14-day refresh tokens. New users automatically get a `public.users` row via the `handle_new_user` trigger.
- **Insights** (BLG-0006): `GET /insights/summary` and `GET /insights/products` are live, both Bearer-JWT-protected; `mobile/src/screens/insights/InsightsScreen.tsx` renders the period selector, vs-previous comparison, by-category, top-merchants, and top-products sections from DES-0003.
- **Encrypted offline cache** (BLG-0007): receipts read after sign-in are mirrored to AsyncStorage, encrypted with AES-256-GCM, with the key in `expo-secure-store`. LRU cap at 200. Offline UX banners and disabled-action rules from ADR-0006 §7.
- **Runnable scanner** (BLG-0012): the Expo SDK 51 runtime tree from ADR-0007 §2 is installed and committed (`mobile/package-lock.json`); `ScannerScreen.tsx` and `mobile/src/api/receipts.ts` are back in the gate (typecheck + tests).
- **Greek-first copy** for `login.`*, `insights.*`, and `offline.*` is in `mobile/src/i18n/strings.ts` with English fallback.
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
- `docs/backlog.md` — what's planned / in-progress (BLG-0013, BLG-0014, BLG-0015 added this sprint).
- `docs/done.md` — what has been completed (S-004 entry on top).