# DES-0004 — Profile screen UX

Companion design artifact for ADR-0008 (tag-as-business UX — Profile-level export action only) and ADR-0009 (PDF export pipeline). Locks the *what the user sees state by state*; the *behavioral / endpoint* decisions live in the ADRs.

Owner: `product-designer` (with `mobile-builder`, `localization-specialist`, `qa`, `security-privacy-officer`).

## 1. Scope

The Profile screen is the user's settings + freelancer hub. It surfaces:

- Current sign-in identity (phone number, masked).
- Freelancer mode toggle (writes `users.is_freelancer`).
- ΑΦΜ field (writes `users.afm`) — only meaningful when `is_freelancer=true`.
- Business-expenses PDF export action (consumes `GET /export/business-expenses` per ADR-0009).
- Sign-out action.

Out of scope:

- Profile-level period import for tagging (ADR-0008 explicitly defers this).
- Language switch (BLG-0011 — out of MVP).
- Cache-clear action ("Καθαρισμός cache") — captured in ADR-0006 §Future BLG, post-MVP.
- Any account-deletion flow (post-MVP; the §3.2.1 GDPR Art. 17 right to erasure is honored via Supabase admin path for MVP).

## 2. State machine

Single `useReducer` covering the freelancer toggle, ΑΦΜ field, and export flow. Implementation lives in `mobile/src/screens/profile/state.ts`.

### States

| State | Description | Allowed transitions |
|---|---|---|
| `idle` | Profile screen mounted; current `users` row loaded. | → `editing_freelancer`, → `editing_afm`, → `pre_export`, → `signing_out` |
| `editing_freelancer` | Freelancer toggle being flipped; PATCH `/users/me` in flight. | → `idle` (success), → `network_error` (revert toggle locally), → `auth_error` |
| `editing_afm` | ΑΦΜ input being edited; on Save, PATCH `/users/me` in flight. | → `idle` (success), → `validation_error` (invalid ΑΦΜ — 9 digits / Greek checksum), → `network_error`, → `auth_error` |
| `pre_export` | Date-range picker open; user selecting `from_date` / `to_date`. | → `exporting`, → `idle` (cancel) |
| `exporting` | `GET /export/business-expenses` in flight; spinner shown. | → `export_done`, → `network_error`, → `auth_error`, → `export_validation_error` (422 from server — e.g. range too long) |
| `export_done` | PDF stream received; native share sheet dispatched. | → `idle` |
| `signing_out` | Supabase sign-out in flight. | → `idle` (terminal — navigate to Login) |
| `network_error` | Last network call failed; banner shown with retry. | → previous state on retry |
| `auth_error` | Last call returned 401; session expired. | → terminal (navigate to Login) |
| `validation_error` | Local validation failed (ΑΦΜ shape, date range). | → previous state on edit |

## 3. Layout

Vertical scroll, four sections separated by a thin divider. Greek-first labels.

### 3.1 Header — identity

```
ΛΟΓΑΡΙΑΣΜΟΣ                                            ← section header
+30 6XX *** ****                                       ← masked phone (last-4 visible)
Σύνδεση: 2026-05-07 17:30                              ← last-sign-in timestamp (local Athens)
```

- Phone is **masked**: only the country code + the last four digits are shown. The middle digits are replaced with `*`. Mirrors the DES-0002 §3 rule that the full phone is never shown after login.

### 3.2 Freelancer mode

```
ΕΠΑΓΓΕΛΜΑΤΙΑΣ                                         ← section header
[switch ON]   Είμαι ελεύθερος επαγγελματίας            ← toggle, large 44×44 dp
```

- Toggle writes `users.is_freelancer` via `PATCH /users/me { is_freelancer: bool }`.
- Optimistic UI: flip toggle locally → PATCH → revert on failure with a Greek toast.
- When `is_freelancer=false`: the ΑΦΜ field (§3.3) is disabled (greyed out, read-only). Existing `users.afm` value, if any, is **kept** in the database — it just can't be edited until the toggle flips back.
- When `is_freelancer=false`: the export action (§3.4) is also disabled with a hint copy: `Διαθέσιμο μόνο σε λειτουργία ελεύθερου επαγγελματία`.

### 3.3 ΑΦΜ

```
ΑΦΜ                                                    ← section header
[ 123456789 ] [ Αποθήκευση ]                           ← text input + Save button
```

- Input rules:
  - Numeric keyboard (`keyboardType="number-pad"` on the RN `TextInput`).
  - Length capped at 9 digits.
  - On Save, run the **Greek ΑΦΜ checksum validator** (the standard MOD-11 algorithm) before PATCH. Invalid → inline `validation_error` state with Greek copy.
  - Empty (after trim) → also a validation error: ΑΦΜ is required when `is_freelancer=true`.
- Telemetry: `profile.afm.saved.success` / `profile.afm.saved.failure` (counts only). The ΑΦΜ value itself is **never logged** anywhere (it is identifying data).

### 3.4 Επαγγελματικά έξοδα — export

```
ΕΠΑΓΓΕΛΜΑΤΙΚΑ ΕΞΟΔΑ                                   ← section header
Εξαγωγή PDF                                            ← row label
[ Από: 01-01-2026 ]   [ Έως: 30-04-2026 ]              ← two date pills
[ Δημιουργία PDF ]                                     ← primary CTA
```

- Two date pills open native date pickers (`DateTimePicker` from `@react-native-community/datetimepicker` if available in the SDK 54 tree, or a fallback custom picker — implementation detail in BLG-0019).
- Default range: `from_date` = first day of the current Athens-TZ month; `to_date` = today (Athens-TZ).
- Validation (client-side, mirrors ADR-0009 §2 server rules):
  - `to_date >= from_date` else inline error.
  - `to_date - from_date <= 366 days` else inline error.
- On `Δημιουργία PDF`:
  - Transition to `exporting` (spinner + dim).
  - Call `GET /export/business-expenses?from_date=...&to_date=...` with the Bearer JWT.
  - On 200 + `application/pdf`:
    - Save the streamed bytes to a **temp file** under the app's cache dir (Expo `FileSystem.cacheDirectory`). The temp file is the OS's responsibility to clean; we do not encrypt it (the user has already authenticated to the device, and the OS encrypts the device's storage at rest on modern iOS / Android).
    - Open the native share sheet (`expo-sharing`'s `shareAsync(uri, { mimeType: 'application/pdf' })`).
    - On user dismiss → `export_done` → `idle`.
  - On error (4xx / 5xx / network):
    - Map RFC-7807 problem-detail codes from ADR-0009 §2 to localized Greek strings.
    - Stay in the `pre_export` state with the inline error visible above the CTA.
- Telemetry: `profile.export.opened` / `profile.export.range_changed` / `profile.export.submitted` / `profile.export.failed.network` / `profile.export.failed.auth` / `profile.export.failed.validation` / `profile.export.success` (counts only; the date range itself is **not** attached to the event because some users may treat their fiscal calendar as sensitive — counts only is the safe default).

### 3.5 Sign out

```
[ Αποσύνδεση ]                                         ← bottom of screen, destructive style
```

- Calls `supabase.auth.signOut()` per ADR-0004 + clears the offline cache key namespace from `expo-secure-store` (per ADR-0006 §2 — `wym.cache.aes-256-gcm.v1` is rotated on sign-out so the next user's data is never readable with the previous user's key).
- Telemetry: `profile.signout.tapped` (counts only).

## 4. PATCH `/users/me` contract (thin backend, anchored here for handoff to BLG-0017)

`PATCH /users/me`

- Bearer JWT required (ADR-0002).
- `user_id` is **always** the verified `sub`; never accepted from the client.
- Request body (Pydantic `extra="forbid"`):

```json
{
  "is_freelancer": true,
  "afm": "123456789"
}
```

- Field rules:
  - `is_freelancer` — optional boolean. If present, server writes `users.is_freelancer = value`.
  - `afm` — optional string of exactly 9 digits, validated via the Greek MOD-11 checksum server-side (defense in depth — client also validates). If present and `is_freelancer=true` (or already true on the row), server writes `users.afm = value`. If `is_freelancer=false` after the patch, the server **does not** clear `users.afm` — the value is preserved across mode flips so a user toggling off and back on doesn't have to re-enter it.
- Behavior: idempotent partial update. Re-PATCHing the same body is a 200 no-op.
- Response: HTTP 200, body = the full updated `users` row (minus `phone` — the client already has it from session; never round-tripped to avoid leakage paths).
- Errors: 401 (no JWT), 422 (validation), 500 (internal).

## 5. Greek-first copy (`mobile/src/i18n/strings.ts` keys `profile.*`)

| Key | Greek | English |
|---|---|---|
| `profile.title` | Λογαριασμός | Profile |
| `profile.section.account` | Λογαριασμός | Account |
| `profile.account.phone_label` | Τηλέφωνο | Phone |
| `profile.account.last_signin` | Σύνδεση: {datetime} | Signed in: {datetime} |
| `profile.section.freelancer` | Ελεύθερος επαγγελματίας | Freelancer |
| `profile.freelancer.toggle_label` | Είμαι ελεύθερος επαγγελματίας | I am a freelancer |
| `profile.freelancer.help` | Ενεργοποιήστε για να σημαδεύετε αποδείξεις ως επαγγελματικά έξοδα και να εξάγετε PDF. | Enable to tag receipts as business expenses and export PDF. |
| `profile.section.afm` | ΑΦΜ | ΑΦΜ |
| `profile.afm.placeholder` | π.χ. 123456789 | e.g. 123456789 |
| `profile.afm.save` | Αποθήκευση | Save |
| `profile.afm.invalid` | Ο ΑΦΜ δεν είναι έγκυρος. | This ΑΦΜ is not valid. |
| `profile.afm.required_for_freelancer` | Ο ΑΦΜ απαιτείται όταν είστε ελεύθερος επαγγελματίας. | ΑΦΜ is required when freelancer mode is on. |
| `profile.afm.saved` | Αποθηκεύτηκε. | Saved. |
| `profile.section.export` | Επαγγελματικά έξοδα | Business expenses |
| `profile.export.title` | Εξαγωγή PDF | Export PDF |
| `profile.export.help` | Επιλέξτε περίοδο και δημιουργήστε PDF για τον λογιστή σας. | Choose a period and generate a PDF for your accountant. |
| `profile.export.from_label` | Από | From |
| `profile.export.to_label` | Έως | To |
| `profile.export.cta` | Δημιουργία PDF | Generate PDF |
| `profile.export.empty_period` | Δεν υπάρχουν επαγγελματικά έξοδα στην επιλεγμένη περίοδο. | No business expenses in the selected period. |
| `profile.export.range_invalid` | Η ημερομηνία λήξης δεν μπορεί να είναι πριν την ημερομηνία έναρξης. | End date cannot be before start date. |
| `profile.export.range_too_long` | Η περίοδος δεν μπορεί να υπερβαίνει τους 12 μήνες. | Period cannot exceed 12 months. |
| `profile.export.disabled_no_freelancer` | Διαθέσιμο μόνο σε λειτουργία ελεύθερου επαγγελματία. | Available only in freelancer mode. |
| `profile.export.failed.network` | Δεν υπάρχει σύνδεση. Δοκιμάστε ξανά. | No connection. Try again. |
| `profile.signout.cta` | Αποσύνδεση | Sign out |

Numbers / dates use `mobile/src/lib/format.ts` (`X,XX €`, `DD-MM-YYYY`).

## 6. Accessibility

- Freelancer toggle: `accessibilityRole="switch"`, `accessibilityState={{ checked: isFreelancer }}`, `accessibilityLabel` reads the localized toggle label.
- ΑΦΜ input: `accessibilityLabel="ΑΦΜ"`, `accessibilityHint="Εννέα ψηφία"` (nine digits) for screen readers.
- Date pills: `accessibilityRole="button"`, `accessibilityLabel="Από {dd-mm-yyyy}"` (and From/To English variant).
- Export CTA: `accessibilityRole="button"`, `accessibilityState={{ disabled: !isFreelancer || isExporting }}`.
- Sign-out CTA: `accessibilityRole="button"`, `accessibilityHint="Θα σας μεταφέρει στην οθόνη εισόδου"`.
- Touch targets ≥ 44×44 dp.
- Color is never the only signal (toggle state has both color + position; export disabled state has both color + a `Διαθέσιμο μόνο σε λειτουργία ελεύθερου επαγγελματία` hint).

## 7. Telemetry (counts only, no PII)

- `profile.opened`
- `profile.freelancer.toggled` (with `to: true|false`)
- `profile.afm.saved.success`
- `profile.afm.saved.failure` (with `reason: "validation"|"network"|"auth"`)
- `profile.export.opened`
- `profile.export.range_changed` (no actual range attached)
- `profile.export.submitted`
- `profile.export.success` (no `bytes_generated` attached)
- `profile.export.failed.network`
- `profile.export.failed.auth`
- `profile.export.failed.validation` (with `reason: "range_invalid"|"range_too_long"`)
- `profile.signout.tapped`

The phone number, ΑΦΜ value, date range, PDF size, and any receipt content **never** appear in telemetry.

## 8. Empty / offline / error states

### 8.1 Offline

- The Profile screen does not block on the network for the read path — `users` row is read from the offline cache (or from the in-memory session blob captured at sign-in).
- ΑΦΜ Save and the export CTA are **disabled** when offline (per ADR-0006 §7), with the standard offline banner shown at the top.
- Toggle freelancer is **also disabled** offline (it requires PATCH).

### 8.2 Auth expired (401)

- Any 401 from PATCH or export → terminal `auth_error` state → navigate to Login. Same rule as DES-0002 §6 / DES-0003 §2.

### 8.3 Network error

- Banner above the affected control with `Δεν υπάρχει σύνδεση. Δοκιμάστε ξανά.` and a Retry button. Retry replays the last failed call.

## 9. Open items (handed off)

- The exact `DateTimePicker` package depends on what survives the SDK 54 upgrade (ADR-0012). If `@react-native-community/datetimepicker` is in the SDK 54 expected matrix, use it; else `mobile-builder` picks a small alternative (e.g. `react-native-modal-datetime-picker`) and folds the dep addition into BLG-0019 with an `agent-safety-officer` review.
- The Greek ΑΦΜ MOD-11 checksum validator is a small pure-TS function — implementation lives in `mobile/src/lib/afm.ts`. Reference algorithm well-documented; QA writes 5+ unit tests covering valid, invalid-checksum, all-zeros, non-numeric, and length-mismatch cases.
- The "rotate the cache key on sign-out" rule (§3.5) is a one-line addition to the `EncryptedAsyncStorageCacheRepository` from ADR-0006 — `mobile-builder` writes a tiny acceptance bullet on BLG-0017 to track it.
