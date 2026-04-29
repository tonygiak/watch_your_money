# DES-0001 — Scanner UX

Author: product-designer
Reviewers: mobile-builder, localization-specialist, security-privacy-officer, qa
Companion ADR: `docs/adr/S-001-ADR-0003-Scanner-ux-flow.md`

The scanner is the **single most important** screen of the MVP. If it fails on the first scan, users will not give us a second one. This design enumerates every state, every transition, and every Greek-first string.

## Goals

- One-tap to scan from Home (FAB).
- Greek-first copy with English fallback (`localization-conventions.md`).
- Reject anything that is not a valid Greek e-invoice QR **before** any network call (`agent-runtime-security.md` §1).
- Recover gracefully from every failure mode without losing the user.
- Hit the §2.5 quality bar: receipt visible in app within **5 seconds** of a successful scan on a normal mobile network.

## State machine

```
idle ──tap FAB──► permission_check
   │
   permission_check
   ├── granted ──► scanning
   ├── denied   ──► permission_denied (recoverable: prompt again)
   └── blocked  ──► permission_blocked (route to OS settings)

   scanning
   ├── valid Greek e-invoice QR detected ──► validating_url
   ├── unsupported QR detected             ──► unsupported_qr
   ├── camera error                        ──► camera_error
   └── user cancels                        ──► idle

   validating_url
   ├── domain check ok ──► submitting
   └── domain check fail ──► unsupported_qr

   submitting (POST /receipts/parse)
   ├── 201 Created ──► success_new
   ├── 200 OK + is_duplicate=true ──► success_duplicate
   ├── 401 ──► auth_error (force re-login)
   ├── 422 unsupported_url / empty_receipt ──► parse_error_user
   ├── 502 upstream_error ──► network_error (retry)
   ├── 503 parser_drift ──► parser_drift (report + retry)
   ├── network timeout (>10s) ──► network_error (retry)
   └── any other ──► generic_error (retry)

   success_new      ──► navigate to ReceiptDetail(id) with toast "Παραστατικό αποθηκεύτηκε."
   success_duplicate──► navigate to ReceiptDetail(id) with toast "Έχετε ήδη σαρώσει αυτό το παραστατικό."
```

## Screens & states

### Idle (Home with FAB)

- Home screen shows the receipt list. A circular **FAB** in the bottom-right with a camera icon.
- Greek label (visually hidden, exposed for screen readers): `Σάρωση παραστατικού`.
- English fallback: `Scan receipt`.

### Permission check (modal, before scanning)

- First time only: native OS permission prompt.
- Pre-prompt (custom modal explaining why):
  - Title (gr): `Πρόσβαση στην κάμερα`
  - Body (gr): `Χρειαζόμαστε πρόσβαση στην κάμερα για να σαρώσουμε το QR code του παραστατικού. Δεν αποθηκεύουμε εικόνες — μόνο τη δομή του παραστατικού.`
  - Primary action (gr): `Συνέχεια`
  - Secondary action (gr): `Άκυρο`
- English fallback strings provided 1:1.

### Scanning

- Full-screen camera view with a centered **square viewfinder** overlay.
- Header (gr): `Στοχεύστε στο QR του παραστατικού`. (en): `Aim at the receipt QR.`
- Subtle "scanning" animation around the viewfinder (no flashing — accessibility, §2.5).
- A small **× Close** button top-left to return to Home.
- The torch toggle (top-right) is enabled only on devices that report it.

### permission_denied

- Modal dialog (not full screen — preserves context).
- Title (gr): `Δεν έχουμε πρόσβαση στην κάμερα`. (en): `We don't have camera access.`
- Body (gr): `Για να σαρώσετε QR codes χρειαζόμαστε πρόσβαση στην κάμερα. Μπορείτε να το επιτρέψετε τώρα.`
- Actions: `Επιτρέψτε` (re-prompt) / `Άκυρο` (return to Home).

### permission_blocked

- Title (gr): `Η πρόσβαση στην κάμερα είναι αποκλεισμένη`.
- Body (gr): `Ανοίξτε τις Ρυθμίσεις και ενεργοποιήστε την πρόσβαση στην κάμερα για το idi8.`
- Actions: `Άνοιγμα Ρυθμίσεων` (deep-link to OS settings via `Linking.openSettings()`) / `Άκυρο`.

### unsupported_qr

- A non-blocking **toast/snackbar** at the bottom (the camera stays open so the user can try again).
- Greek: `Αυτός ο κωδικός QR δεν είναι ελληνικό e-παραστατικό.`
- English: `This QR is not a Greek e-receipt.`
- Auto-dismiss after 3 seconds. Logged client-side as `qr_unsupported_count` (no PII).

### validating_url (transient — usually <100ms)

- Inline spinner on the viewfinder corner. No state change visible to users unless it lasts >800ms (then a tiny "Έλεγχος…" caption appears).

### submitting

- Full-screen loader on top of the camera with copy:
  - (gr): `Λήψη παραστατικού…`
  - (en): `Fetching receipt…`
- Spinner; no progress bar (we don't have a meaningful percentage).
- Cancel button (`Άκυρο`) cancels the request and returns to Scanning. After 10 seconds with no response, auto-transition to `network_error`.

### success_new / success_duplicate

- Navigate to `ReceiptDetailScreen(id)` immediately.
- Toast at the bottom for 3 seconds:
  - new (gr): `Παραστατικό αποθηκεύτηκε.` / (en): `Receipt saved.`
  - duplicate (gr): `Έχετε ήδη σαρώσει αυτό το παραστατικό.` / (en): `You already scanned this receipt.`

### auth_error

- Title (gr): `Η συνεδρία έληξε`. (en): `Session expired.`
- Body: `Παρακαλούμε συνδεθείτε ξανά για να συνεχίσετε.`
- Action: `Σύνδεση` → routes to Login.

### parse_error_user (422)

- Title (gr): `Δεν μπορούμε να διαβάσουμε αυτό το παραστατικό`.
- Body: `Βεβαιωθείτε ότι το QR ανήκει σε ελληνικό e-παραστατικό από έναν υποστηριζόμενο εκδότη.`
- Action: `Δοκιμή ξανά` (back to Scanning) / `Άκυρο` (Home).

### network_error (502 / timeout)

- Title (gr): `Πρόβλημα δικτύου`.
- Body: `Δεν καταφέραμε να φέρουμε το παραστατικό. Δοκιμάστε ξανά.`
- Action: `Επανάληψη` (retries the same `qr_url`) / `Άκυρο` (Home).

### parser_drift (503)

- Title (gr): `Προσωρινό τεχνικό πρόβλημα`.
- Body: `Έχουμε ειδοποιηθεί. Δοκιμάστε ξανά σε λίγο.`
- Action: `Επανάληψη` / `Άκυρο` (Home).
- Client logs `parser_drift_seen` event (no PII) so we can correlate with backend drift logs.

### generic_error

- Title (gr): `Κάτι πήγε στραβά`.
- Body: `Δοκιμάστε ξανά. Αν συνεχίσει, ενημερώστε μας.`
- Action: `Επανάληψη` / `Άκυρο`.

### camera_error

- Title (gr): `Δεν μπορούμε να ανοίξουμε την κάμερα`.
- Body: `Κλείστε άλλες εφαρμογές που χρησιμοποιούν την κάμερα και δοκιμάστε ξανά.`
- Action: `Δοκιμή ξανά` / `Άκυρο`.

## Domain validation rules (client-side, before `POST /receipts/parse`)

The mobile client MUST reject any QR whose URL fails:

- Scheme is not `https`.
- Host is not exactly `e-invoicing.gr`.
- Path does not match `/edocuments/ViewInvoice/-1/<uuid>_<token>` (regex: `/edocuments/ViewInvoice/-1/[0-9a-fA-F-]+_[A-Za-z0-9]+$`).

A failure here goes straight to `unsupported_qr` (no network call). This protects against:
- Accidental scans of unrelated QR codes.
- Crafted QR codes pointing to attacker-controlled hosts (`agent-runtime-security.md` §1).

The backend also re-validates (defense in depth). Both layers must agree.

## Accessibility

- Every screen and modal exposes a screen-reader label.
- Touch targets ≥ 44×44 dp (iOS HIG / Material).
- Color contrast ≥ 4.5:1 for body text and 3:1 for large text and UI controls.
- No color-only state cues (icons + text always together).
- Dynamic-type respected (camera screen uses fixed sizes for the camera UI itself, but all text on it scales up to 200%).

## Greek-first / English fallback

- Default language: device locale, falling back to Greek then English (`localization-conventions.md`).
- Numbers in toasts (e.g. counts) follow `X,XX €` and `DD-MM-YYYY` rules (`format.ts`).
- All copy in the table above must be added to the i18n map under `mobile/src/i18n/strings.ts` keys `scanner.*`.

## Telemetry (no PII)

- `scanner_opened` (count)
- `qr_detected` (count, unsupported / supported)
- `submit_success_new` / `submit_success_duplicate` / `submit_failure_<code>` (counts)
- `time_to_receipt_ms` (histogram, success_new only) — used to verify the §2.5 5-second target.

No URLs, no `raw_html`, no `user_id` in client logs.

## Out of scope for this design

- Multi-receipt batch scan.
- OCR fallback (forbidden, `no-ocr.md`).
- Off-camera receipt capture (e.g. uploading a screenshot — out of scope for MVP per `AGENTS.md` §2.9).
- Receipt sharing between users (out of scope for MVP).
