# Sprint S-002 — User review

## Where we are right now

Sprint **S-002 (implementation, `scan-and-store`)** closed green. This is the first sprint that ships **user-visible behavior**: the backend now exposes `POST /receipts/parse` end-to-end (Greek QR → parsed receipt → stored under your RLS scope, with idempotent re-scan support), and the mobile app now has the full Greek-first scanner state machine + i18n + on-device QR validator (the actual camera screen runs as soon as the next sprint installs the Expo runtime tree under proper safety review). `make check` is **90 tests green** (38 backend + 52 mobile).

The next sprint is **S-003 (discovery, `auth-and-cache`)** — settles ADRs for phone-OTP login, insights computation, the offline cache, and the Expo runtime install. Then **S-004 (implementation)** ships login + insights + offline cache + the runnable scanner screen.

## What changed

- **Backend**:
  - `POST /receipts/parse` (`backend/app/routes/receipts.py`) — Bearer JWT auth, body `{ "qr_url": string }`, idempotent on `(user_id, mark)`, RFC-7807 errors, drift logging that never echoes the QR URL or raw HTML.
  - Stdlib-only HS256 JWT verifier (`backend/app/auth.py`) — no new runtime dependency.
  - Storage layer with both an in-memory fake (tests + local dev) and a Supabase service-key implementation (production).
  - Full Greek e-receipt parser at `backend/app/parsers/gr/parser.py` — every `AGENTS.md` §5.3.3 field, label-driven extraction, full `ParserError` taxonomy.
  - First synthetic fixture at `backend/tests/fixtures/receipts/gr/gr-001-supermarket/` (clearly labeled as synthetic, not a real receipt).
  - `backend/.env.sample` declares `SUPABASE_JWT_SECRET`.

- **Mobile**:
  - Pure-TS scanner reducer at `mobile/src/screens/scanner/state.ts` — every DES-0001 transition, ~30 unit tests.
  - On-device GR QR validator at `mobile/src/parsers/gr.ts` — regex mirrored from the backend (defense in depth).
  - Greek-first i18n table at `mobile/src/i18n/strings.ts` — every `scanner.*` string from DES-0001.
  - Greek-first locale detector at `mobile/src/lib/locale.ts` — `el-*` → Greek, `en-*` → English, anything else → Greek.
  - Production-shape `ScannerScreen.tsx` written against `expo-camera` + `useReducer` + `Linking.openSettings()` + `AbortController` — kept out of the gate until the Expo runtime tree lands in BLG-0012.

- **CI**: `.github/workflows/ci.yml` runs `make check` on every push and PR.

- **Backlog**:
  - BLG-0001, BLG-0002, BLG-0003 (testable parts), BLG-0008 → `docs/done.md`.
  - BLG-0004 stays open (1 synthetic fixture shipped; 4 real-receipt triplets pending consenting users).
  - BLG-0012 added — Expo runtime install, gated on a future ADR co-signed by `agent-safety-officer` + `engineering-manager`.

## How to verify (delivery sprint)

Even though the runnable scanner screen is gated on BLG-0012, you can verify everything else end-to-end today:

1. **Run `make check`** from the repo root. Expected: `make check: green` with 38 backend + 52 mobile tests passing.
2. **Inspect the synthetic fixture**:
   - Read `backend/tests/fixtures/receipts/gr/gr-001-supermarket/raw.html` — a complete Greek e-receipt shape.
   - Read `backend/tests/fixtures/receipts/gr/gr-001-supermarket/expected.json` — the ground truth the parser must produce.
   - Read `backend/tests/fixtures/receipts/gr/gr-001-supermarket/provenance.md` — note the **synthetic** label and the security-privacy-officer co-sign block.
3. **Verify the parser end-to-end** against the fixture:
   ```bash
   cd backend
   .venv/Scripts/python -m pytest tests/parsers/test_gr_fixtures.py -v
   ```
   Expected: every §5.3.3 field asserted at 100% accuracy without any network call.
4. **Run the API locally** and exercise the auth gate:
   ```bash
   make run-backend            # in one shell
   curl -i -X POST http://localhost:8000/receipts/parse \
        -H "Content-Type: application/json" \
        -d '{"qr_url":"https://e-invoicing.gr/edocuments/ViewInvoice/-1/abc_token"}'
   # → 401 + {"type":"unauthenticated", ...}
   ```
   Note: a real 201 happy-path requires a real Supabase JWT (and a real Greek QR), which is the S-003 → S-004 path.
5. **Verify the scanner state machine** (no camera needed):
   ```bash
   cd mobile && npm test --silent
   ```
   Expected: 52 jest tests green, including every reducer transition listed in DES-0001.
6. **Check CI** — push or open a PR and watch `.github/workflows/ci.yml` run. The job runs `make check` end-to-end.

## How to review (discovery sprint)

N/A — this was an implementation sprint. The discovery review is in `docs/sprints/S-001-discovery-receipt-parser-contract/S-001-UREV-0001-Receipt-parser-contract.md`.

## Where to look next

- `AGENTS.md` §2.6 — shipped features (now non-empty for the first time).
- `AGENTS.md` §2.7 — current sprint snapshot.
- `docs/plan.md` — S-003 plan.
- `docs/backlog.md` — what's still planned (note BLG-0012 as the new drift item).
- `docs/done.md` — what's now completed (newest on top).
- `backend/app/routes/receipts.py` — the new endpoint.
- `mobile/src/screens/scanner/state.ts` — the heart of the scanner UX.
