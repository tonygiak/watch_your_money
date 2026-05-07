# Sprint S-006 — UREV (User Review)

- Type: implementation
- Theme: `freelancer-mode-and-sdk-upgrade`
- Closed: 2026-05-07

## What you can verify today (without leaving the laptop)

S-006 shipped freelancer-mode end-to-end at the **contract level** under the in-tree SDK 51 mobile tree. The on-device verification on stock Expo Go is queued for S-007 (BLG-0016 deferred — see `S-006-REV-0001` and `S-006-LOG-0001` 18:35 entry). Until S-007 ships, the entire `AGENTS.md` §2.8 freelancer-mode acceptance is reachable through `make check` and the contract tests; this UREV walks you through how to reproduce that locally.

### Prerequisites

- Python 3.11+ with `make install` already run (creates `backend/.venv` and installs `requirements.txt`, including the new `reportlab==4.2.5`).
- Node.js (Expo SDK 51 toolchain — same as S-005 close; no upgrade in S-006).
- The workspace path may contain Greek characters — that's expected; see "Known limitations" below for the `make` workaround.

### 1. Run the gate

From the workspace root:

```
make check
```

(If `make check` complains about resolving the target on PowerShell with the Greek-character path, run the equivalent commands directly:

```
cd backend
.venv\Scripts\python.exe -m ruff check .
.venv\Scripts\python.exe -m mypy app tests
.venv\Scripts\python.exe -m pytest -q

cd ..\mobile
npx tsc --noEmit
npm test --silent
```
)

You should see:

- `ruff check . → All checks passed`
- `mypy → Success: no issues found in 52 source files`
- `pytest → 143 passed in ~2 s`
- `tsc → clean`
- `jest → 197 passed across 18 suites in ~6 s`

**Total: 340 tests across 21 suites, all green.** This proves every BLG-0017 / 0018 / 0019 acceptance bullet against contract-level evidence.

### 2. Hit the new endpoints with `curl` (optional)

If you want to feel the new endpoints rather than just trust the test counts, spin up the backend against a local Supabase project (or against the in-memory storage in dev mode) per `README.md` and the runbooks:

- **Tag a receipt** — `POST /receipts/{receipt_id}/tag` with `Authorization: Bearer <Supabase JWT>` and body `{ "is_business": true, "category": "Groceries", "notes": "client lunch" }`. Expect a 200 with the full updated receipt; `business_category` echoes back **lowercased** (`"groceries"`); `notes` echoes back trimmed.
- **Untag the same receipt** — same URL, body `{ "is_business": false }`. Expect 200; `is_business_expense=false`, `business_category=null`, `notes=null`.
- **Patch your profile** — `PATCH /users/me` with body `{ "is_freelancer": true, "afm": "094019245" }`. Expect 200; response excludes `phone`. Try a wrong checksum (e.g. `"094019246"`) — expect 422 with the RFC-7807 envelope from ADR-0002. Try `{ "afm": null }` — expect 200 with `afm: null` (the field is **cleared**, not "untouched").
- **Export business expenses** — `GET /export/business-expenses?from_date=2026-04-01&to_date=2026-04-30` with `Authorization: Bearer <Supabase JWT>`. Expect a 200 with `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="business-expenses-2026-04-01-2026-04-30.pdf"`, `Cache-Control: private, no-store`, and a streamed PDF body. Try `to_date < from_date` — expect 422. Try a 400-day range — expect 422.

Every one of these paths is exercised by the contract tests in `backend/tests/routes/test_users.py`, `backend/tests/routes/test_receipt_tag.py`, and `backend/tests/routes/test_exports.py` — so the `curl` walk-through is just for tactile confidence, not a gate.

### 3. Render the new screens (optional, dev-build only)

The mobile screens are wired and rendered under `jest-expo` smoke tests, but a true on-device render needs the SDK 54 tree from BLG-0016 (queued for S-007). If you have an Expo dev build already configured for SDK 51, you can:

1. Open `mobile/src/screens/profile/ProfileScreen.tsx` — full Greek copy, freelancer toggle, ΑΦΜ field with MOD-11 validator, two date `TextInput`s + "Δημιουργία PDF" CTA, sign-out CTA. The export action is **disabled** when freelancer mode is off (with the `Διαθέσιμο μόνο σε λειτουργία ελεύθερου επαγγελματία` hint per DES-0004 §3.4).
2. Open `mobile/src/screens/receipt/ReceiptDetailScreen.tsx` + `mobile/src/screens/receipt/TagPanel.tsx` — full Greek copy, accessible switch role, tag-and-save with optimistic UI per DES-0005 §3.

The full **stock-Expo-Go** acceptance script lives in §A below and is queued for S-007 UREV.

## What a Greek freelancer will see (after S-007 lands BLG-0016)

§A is the agreement: this is what the next sprint must demonstrate live on a real Greek consumer's stock Expo Go installation. Everything in §A is already true at the contract level; the only outstanding work is the SDK upgrade itself + the share-sheet wiring on `ProfileScreen.tsx` (which currently goes through an injectable `shareImpl` prop).

### §A — Stock-Expo-Go acceptance (for S-007 UREV)

1. **Install Expo Go** (latest store version, iOS or Android).
2. **Sign in** — open the app, type a `+30` phone number, receive the OTP via SMS, enter it. The app lands on Home with the empty-state copy.
3. **Scan a receipt** — tap the FAB, scan a `e-invoicing.gr` QR from any Entersoft- or SoftOne-issued Greek receipt. Within 5 seconds the receipt appears with all line items in Greek (per `AGENTS.md` §2.5).
4. **Tag the receipt as a business expense** — open the receipt detail. The tag panel says `Επαγγελματικά έξοδα`. Tap the switch — the panel opens with `Κατηγορία` and `Σημειώσεις (προαιρετικές)` inputs. Type `Γραφική ύλη` (or any other Greek category) and a short note. Tap `Αποθήκευση`. The switch flips immediately (optimistic UI per DES-0005 §3); on save, the panel collapses to the tagged-summary state.
5. **Insights pick up the new tag** — open the Insights tab. Switch to "Μήνας". The `Κατηγορίες` rollup shows `γραφική ύλη` (lowercased server-side per ADR-0008 §2.4) with the tagged receipt's total.
6. **Open the Profile screen** — tap the Profile tab. The header shows your masked phone (`+30 6XX *** 4321` per DES-0004 §3.1). Toggle `Ελεύθερος επαγγελματίας`. The ΑΦΜ field unlocks. Type your 9-digit ΑΦΜ. Tap `Αποθήκευση`. The MOD-11 checksum is validated on the client (`mobile/src/lib/afm.ts`) and on the server (`backend/app/afm.py`); a mismatch shows the Greek "Μη έγκυρο ΑΦΜ" hint without a network round-trip.
7. **Export business expenses** — on the Profile screen, the export action is now enabled. The two date pills default to `01/04/2026` (first day of current month) → today. Tap `Δημιουργία PDF`. The screen enters `exporting` (spinner), the backend streams the PDF, and the **native share sheet** opens with the file. Pick Mail / Drive / Files / Telegram — whichever you want — and you get a PDF with: cover (title + ΑΦΜ + range + timestamp), totals block, the tagged receipt with its category and notes — all in Greek-rendered text.
8. **Sign out** — tap `Αποσύνδεση`. The cache key `wym.cache.aes-256-gcm.v1` is rotated (deleted) and every cached receipt is purged from `AsyncStorage` (per DES-0004 §3.5 / ADR-0006 §2). The next sign-in by a different user starts with a clean cache.

After S-007, every bullet in `AGENTS.md` §2.8 is reachable through this script.

## Known limitations (for the human reading this UREV)

- **On-device verification still gated by BLG-0016.** The freelancer-mode endpoints + UI work end-to-end at the contract level under SDK 51, but the stock-Expo-Go acceptance script in §A above needs the SDK 54 upgrade. S-007 is queued as implementation with BLG-0016 first.
- **PDF share sheet is wired against an injectable `shareImpl` prop on `ProfileScreen.tsx`.** The host App will fold `expo-sharing@14.0.7` + `expo-file-system@19.0.7` (both in the SDK 54 expected matrix) into the prop wiring during S-007. Today, the export action computes the PDF base64 + filename and hands them to the prop; on the test path, the prop is a fake.
- **Date range UI uses two plain `TextInput`s.** Native `@react-native-community/datetimepicker` is in the SDK 54 expected matrix and lands with BLG-0016 in S-007. Today, you type the dates in `YYYY-MM-DD` (the placeholder text). Validation is enforced on input (parse, range order, max-366-day cap).
- **Workspace path quirk.** The Greek-character path (`Υπολογιστής`) breaks GnuWin32 `make` 3.81 target resolution from the workspace root. Workaround already in this UREV §1.
- **No real-receipt fixtures yet.** BLG-0004 stays planned; the Tag-as-business and PDF-export paths are exercised against in-memory fakes + the synthetic baseline `gr-001-supermarket` fixture from S-002. Real-receipt corner cases come with consenting users.
- **No drift-detection CI yet.** BLG-0009 stays planned; the canary fetch from `e-invoicing.gr` is queued for a later sprint.

## How to review S-006 itself (for `product-owner` / `product-manager`)

1. Read `S-006-PLN-0001` to confirm scope.
2. Read `S-006-LOG-0001` for the audit trail (in particular the 18:35 entry recording the BLG-0016 deferral).
3. Read `S-006-REV-0001` for the closing balance, sign-offs, and the `make check` numbers.
4. Skim `docs/done.md` Sprint S-006 entry for the per-BLG outcomes.
5. Confirm `AGENTS.md` §2.6 + §2.7 reflect the new shipped behavior + the next sprint focus.
6. Confirm `docs/plan.md` carries the S-006 close snapshot and queues S-007.
7. Confirm `docs/backlog.md` no longer carries BLG-0017 / 0018 / 0019 but **still carries BLG-0016** as Ready (deferred — S-007 first item).

If anything in §A above feels short of `AGENTS.md` §2.8, raise it as a backlog item before S-007 starts so the sequencing rule can adapt.
