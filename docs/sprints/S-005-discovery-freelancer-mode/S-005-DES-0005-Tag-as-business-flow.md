# DES-0005 — Tag-as-business flow on Receipt detail

Companion design artifact for ADR-0008 (tag-as-business UX). Locks the *what the user sees state by state* on the Receipt detail screen for the inline tag flow; the *behavioral / endpoint* decisions live in ADR-0008.

Owner: `product-designer` (with `mobile-builder`, `localization-specialist`, `qa`, `security-privacy-officer`).

## 1. Scope

The Receipt detail screen already exists from S-002 / S-004 (renders header + line items + totals from the structured `ParsedReceipt` per ADR-0001 / ADR-0002). This DES adds **one inline UI block** to that screen: the tag-as-business panel.

It does **not** redesign the rest of the receipt detail. It adds:

- A **tag toggle** in the receipt header, immediately under the merchant name and above the line-items table.
- An **inline panel** (in-place expansion below the toggle) for entering / editing the category and notes when tagging.
- A **toast-on-success** for tagged / untagged feedback.
- A **revert path** when the network call fails.

Out of scope:

- Profile-level period import for tagging (ADR-0008 explicitly defers this).
- Multi-receipt batch tag (deferred — same).
- Inferred-category labels on tagged receipts (deferred per ADR-0010).

## 2. State machine

A small reducer composed into the existing Receipt detail screen reducer (or as a sibling). Implementation lives in `mobile/src/screens/receipt/tag.state.ts`.

### States

| State | Description | Allowed transitions |
|---|---|---|
| `untagged_idle` | Receipt is not currently a business expense (`is_business_expense=false`); panel collapsed, toggle off. | → `editing` (user taps toggle on) |
| `tagged_idle` | Receipt is currently a business expense (`is_business_expense=true`); panel shows the saved category + notes summary; toggle on. | → `editing` (user taps the row to edit), → `untagging` (user taps toggle off) |
| `editing` | Inline panel open with category + notes inputs. | → `saving` (user taps Save), → previous idle (user taps Cancel) |
| `saving` | `POST /receipts/{id}/tag` in flight with `is_business=true` and the new category / notes. Optimistic UI: toggle and panel show the target state. | → `tagged_idle` (success), → `editing` (network / validation error — revert toggle if it was a flip), → `auth_error` |
| `untagging` | `POST /receipts/{id}/tag` in flight with `is_business=false`. Optimistic UI: toggle off, panel collapsed. | → `untagged_idle` (success), → `tagged_idle` (network error — revert toggle), → `auth_error` |
| `auth_error` | 401 from server. | → terminal (navigate to Login) |

### Transition triggers

- **Untagged → editing** (`untagged_idle → editing`): user taps the toggle while it's off; toggle visually flips to on; panel slides open below; category input gets focus.
- **Tagged → editing** (`tagged_idle → editing`): user taps anywhere on the tagged-summary row (not the toggle itself); panel slides open with the existing category + notes pre-filled; category input gets focus.
- **Tagged → untagging** (`tagged_idle → untagging`): user taps the toggle while it's on; optimistic flip to off; panel collapses; POST fires.
- **Editing → saving** (`editing → saving`): user taps `Αποθήκευση` (Save); category + notes validated client-side (length caps, `category` non-empty after trim); POST fires.
- **Editing → untagged_idle / tagged_idle** (`editing → cancel`): user taps `Ακύρωση` (Cancel); panel collapses; if this was a fresh tag attempt (we entered from `untagged_idle`), the toggle reverts to off.

## 3. Layout

The tag block lives between the receipt header (merchant name, ΑΦΜ, date, total) and the line-items table.

### 3.1 Untagged state — collapsed

```
ALPHA SUPER MARKET                                     ← merchant name
ΑΦΜ 094543987 · 12-04-2026 · 42,50 €                   ← metadata strip

[ off ]   Επαγγελματικό έξοδο                          ← tag toggle row
                                                       ← line items below…
```

- Toggle row height ≥ 44 dp.
- Toggle label: `Επαγγελματικό έξοδο` (Business expense).
- No category / notes shown when untagged.

### 3.2 Editing state — panel expanded

```
ALPHA SUPER MARKET
ΑΦΜ 094543987 · 12-04-2026 · 42,50 €

[ on ]    Επαγγελματικό έξοδο                          ← toggle now on
┌─────────────────────────────────────────────┐
│ ΚΑΤΗΓΟΡΙΑ                                   │       ← inline panel
│ [ groceries                              ]  │       ← free-text input
│                                             │
│ ΣΗΜΕΙΩΣΕΙΣ (προαιρετικό)                    │
│ [ team lunch with vendor X                ] │       ← free-text input, multi-line
│                                             │
│ [ Αποθήκευση ] [ Ακύρωση ]                  │
└─────────────────────────────────────────────┘
                                                       ← line items below…
```

- `ΚΑΤΗΓΟΡΙΑ` input rules:
  - Free text per ADR-0008 §2.
  - Trimmed and length-capped at 64 chars after trim.
  - Required (non-empty after trim) when saving in `editing` state. Empty → inline error.
  - The label is `Κατηγορία` (Category), **not** `Φορολογική κατηγορία` (Tax category) — per ADR-0008 §6 the field is the user's word, not a tax classification.
- `ΣΗΜΕΙΩΣΕΙΣ` input rules:
  - Optional. Multi-line (`numberOfLines={3}`).
  - Trimmed and length-capped at 500 chars after trim.
- `Αποθήκευση` button: enabled only when category is non-empty after trim. Tapping fires `saving` state.
- `Ακύρωση` button: collapses the panel; on a fresh tag attempt, also reverts the toggle.

### 3.3 Tagged state — collapsed (summary row)

```
ALPHA SUPER MARKET
ΑΦΜ 094543987 · 12-04-2026 · 42,50 €

[ on ]    Επαγγελματικό έξοδο · groceries              ← summary
          team lunch with vendor X                     ← notes (truncated to 1 line, 80 chars)
                                                       ← line items below…
```

- The summary row shows the category inline next to the toggle, separated by `·`.
- If notes are present, they show on a second line, truncated to ~80 chars with ellipsis.
- Tapping anywhere on the summary row (except the toggle itself) opens the editing panel pre-filled.

### 3.4 Saving / untagging — optimistic UI

- Toggle and summary line show the target state immediately.
- A small spinner appears at the right edge of the toggle row.
- Network failure flow:
  - Toast: `Αποτυχία αποθήκευσης. Δοκιμάστε ξανά.`
  - Toggle reverts to its prior state.
  - Panel re-opens in `editing` state with the user's last entered values, so they don't lose them.

## 4. Greek-first copy (`mobile/src/i18n/strings.ts` keys `tag.*`)

| Key | Greek | English |
|---|---|---|
| `tag.toggle_label` | Επαγγελματικό έξοδο | Business expense |
| `tag.summary.connector` | · | · |
| `tag.category.label` | Κατηγορία | Category |
| `tag.category.placeholder` | π.χ. groceries, fuel, transport | e.g. groceries, fuel, transport |
| `tag.category.required` | Η κατηγορία είναι υποχρεωτική. | Category is required. |
| `tag.category.too_long` | Η κατηγορία έχει όριο 64 χαρακτήρες. | Category is limited to 64 characters. |
| `tag.notes.label` | Σημειώσεις (προαιρετικό) | Notes (optional) |
| `tag.notes.placeholder` | π.χ. συνάντηση με πελάτη Χ | e.g. meeting with client X |
| `tag.notes.too_long` | Οι σημειώσεις έχουν όριο 500 χαρακτήρες. | Notes are limited to 500 characters. |
| `tag.save` | Αποθήκευση | Save |
| `tag.cancel` | Ακύρωση | Cancel |
| `tag.toast.tagged` | Σημαδεύτηκε ως επαγγελματικό έξοδο. | Tagged as business expense. |
| `tag.toast.untagged` | Αφαιρέθηκε από τα επαγγελματικά. | Removed from business expenses. |
| `tag.toast.error.network` | Δεν υπάρχει σύνδεση. Δοκιμάστε ξανά. | No connection. Try again. |
| `tag.toast.error.generic` | Αποτυχία αποθήκευσης. Δοκιμάστε ξανά. | Save failed. Try again. |

The category label (when displayed in the summary row) is shown **as the user typed it** (lowercased server-side per ADR-0008 §2 — so the round-trip displays the lowercased form). No Title-Casing or other automatic transformation in the UI.

## 5. Accessibility

- Tag toggle: `accessibilityRole="switch"`, `accessibilityState={{ checked: isTagged }}`, `accessibilityLabel="Επαγγελματικό έξοδο"`.
- Tagged summary row (when present): `accessibilityRole="button"`, `accessibilityHint="Διπλό άγγιγμα για επεξεργασία"`.
- Category input: `accessibilityLabel="Κατηγορία"`, `accessibilityHint="Έως 64 χαρακτήρες"`.
- Notes input: `accessibilityLabel="Σημειώσεις"`, `accessibilityHint="Προαιρετικό. Έως 500 χαρακτήρες."`.
- Save / Cancel: `accessibilityRole="button"`, `accessibilityState={{ disabled: !isCategoryValid }}` for Save.
- Touch targets ≥ 44×44 dp.
- Color is never the only signal (toggle has both color + position; tagged summary has the explicit category text).

## 6. Telemetry (counts only, no PII)

- `tag.panel.opened` (with `from: "untagged"|"tagged"`)
- `tag.applied` (after `saving` succeeds with `is_business=true`)
- `tag.removed` (after `untagging` succeeds)
- `tag.failed.network`
- `tag.failed.auth`
- `tag.failed.validation` (with `field: "category"|"notes"`)
- `tag.cancelled`

The category text and notes text are **never** logged or attached to telemetry events. The receipt id is also not attached (it's a UUID — not PII per se, but a per-receipt identifier we don't need at the telemetry layer).

## 7. Empty / offline / error states

### 7.1 Offline

- The toggle is **disabled** when offline (per ADR-0006 §7) — POST requires network.
- The cached receipt detail still renders fully; the tagged / untagged state shown is the last-known cached state.
- Standard offline banner at the top of the screen.

### 7.2 Auth expired (401)

- Any 401 from POST → terminal `auth_error` state → navigate to Login. Same rule as DES-0002 §6 / DES-0003 §2.

### 7.3 Validation error (422)

- Server-side category / notes validation errors map to `tag.failed.validation` with the localized Greek inline message under the offending field. The user stays in `editing` state, the inputs preserved.

## 8. Optimistic UI rules

- **Tag flip on**: toggle flips immediately, panel opens, server fires when Save tapped — so optimistic happens at Save, not at toggle (the user might cancel).
- **Untag flip off**: toggle flips immediately, panel collapses, server fires immediately. On failure, toggle reverts and a toast surfaces.

This split means a user who taps the toggle on but never taps Save does **not** create a tagged-with-empty-category state on the server. The `untagged_idle → editing` transition is purely client-side.

## 9. Open items (handed off to BLG-0018)

- Which toast library / pattern is used (Expo's built-in `Alert` is too modal; ideally a non-blocking toast — `react-native-toast-message` or a tiny custom one). `mobile-builder` decides during BLG-0018 implementation; if a new dep is needed, `agent-safety-officer` reviews.
- Inline-panel slide animation (LayoutAnimation vs `Animated`): implementation choice.
- Whether the tagged-summary row should also surface the merchant ΑΦΜ (already in the receipt header, so probably redundant) — left to BLG-0018 visual QA.
