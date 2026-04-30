# DES-0003 — Insights screen UX

Companion design artifact for ADR-0005 (and ADR-0006 §7 for the offline empty state). Locks the *what the user sees state by state*; the *behavioral / endpoint* decisions live in ADR-0005.

Owner: `product-designer` (with `mobile-builder`, `localization-specialist`, `qa`).

## 1. Scope

The Insights screen aggregates the user's spending across the configured period (week / month / year), shows comparison with the previous period, and breaks the spend down by category, by merchant, and by top products. It consumes only the two endpoints in ADR-0005 — it does NOT iterate raw receipts client-side.

Out of scope:

- Receipt list (lives in DES-0004 — Home — to be authored alongside S-004).
- Inferred-category logic (deferred per ADR-0005 §6).
- Custom date-range pickers (week/month/year only in MVP, with an "anchor" date defaulting to today).

## 2. State machine

Single `useReducer`. Implementation lives in `mobile/src/screens/insights/state.ts`.

### States

| State | Description | Allowed transitions |
|---|---|---|
| `idle` | First mount; no period selected. | → `loading` (default = month, anchor=today) |
| `loading` | Calling `/insights/summary` and `/insights/products` in parallel. | → `loaded`, → `network_error`, → `auth_error`, → `empty` |
| `loaded` | Both responses received; data displayed. | → `loading` (period change), → `network_error` (re-fetch), → `offline` |
| `empty` | No receipts in the selected period (current.receipt_count === 0). | → `loading` (period change) |
| `offline` | `NetInfo.isConnected === false`. | → `loading` (when reconnected) |
| `network_error` | 5xx or timeout from one of the endpoints. | → `loading` (retry) |
| `auth_error` | 401 from either endpoint (session expired). | → terminal (navigate to Login) |

### Period selector

Three pills in a horizontal segmented control: **Εβδομάδα / Μήνας / Έτος** (Week / Month / Year). Tapping a pill resets the anchor to today and triggers a `loading` transition. Default selection on first mount: `Μήνας`.

## 3. Layout

Vertical scroll, three sections.

### 3.1 Header — period summary

```
[ Εβδομάδα ] [ Μήνας ] [ Έτος ]                    ← segmented control

ΜΗΝΑΣ                          απρ 2026             ← period name + localized anchor

412,50 €                                            ← current.total
στις 11 αποδείξεις                                  ← current.receipt_count

▼ 18% σε σχέση με τον προηγούμενο μήνα              ← vs-previous, color-coded
   503,10 € σε 14 αποδείξεις                        ← previous totals (small)
```

- Big-money typography for `current.total`. Greek decimal: `412,50 €`.
- vs-previous indicator:
  - **Decreased**: down-arrow ▼ + green color.
  - **Increased**: up-arrow ▲ + red color.
  - **Equal / first period (no previous)**: dash – + neutral color, copy `Δεν υπάρχει σύγκριση`.
- Color is **never** the only signal (icon always present) per ADR-0003 §6 accessibility rule.

### 3.2 By-category breakdown

```
ΑΝΑ ΚΑΤΗΓΟΡΙΑ
┌────────────────────────────────────────────┐
│  [PieChart]                                │
└────────────────────────────────────────────┘
groceries        210,30 €    51%             ← bullet color matches pie slice
untagged         202,20 €    49%
```

- `react-native-chart-kit`'s `PieChart` (per ADR-0007).
- Categories with 0 spend in the period are omitted.
- The literal `"untagged"` is localized to `Χωρίς κατηγορία` (Greek) / `Untagged` (English) per ADR-0005 §6.
- Tap a row: opens a filtered receipt list (S-004+ — DES-0004 spec).

### 3.3 By-merchant top 5

```
ΚΟΡΥΦΑΙΟΙ ΕΜΠΟΡΟΙ
ALPHA SUPER MARKET   180,40 €  • 4 αποδείξεις
FARMACY KENTRO        62,80 €  • 2 αποδείξεις
…
```

- Top 5 merchants by `total`, descending.
- `BarChart` is **not** used here — the list view is more compact and reads better with Greek merchant names that can be long.
- Tap a row: opens a filtered receipt list (S-004+).

### 3.4 Top products

```
ΚΟΡΥΦΑΙΑ ΠΡΟΪΟΝΤΑ
ΓΑΛΑ ΦΡΕΣΚΟ 1L          1,45 € μ.ο.  • 8 αγορές  • 23,20 € συνολικά
…
```

- Renders the `/insights/products` response (top 10 by default).
- `frequency` → "X αγορές" / "X purchases".
- `average_unit_price` → "Y,YY € μ.ο." / "Y.YY € avg".
- `total_spend` → "Z,ZZ € συνολικά" / "Z.ZZ € total".

## 4. Greek-first copy (`mobile/src/i18n/strings.ts` keys `insights.*`)

| Key | Greek | English |
|---|---|---|
| `insights.title` | Στατιστικά | Insights |
| `insights.period.week` | Εβδομάδα | Week |
| `insights.period.month` | Μήνας | Month |
| `insights.period.year` | Έτος | Year |
| `insights.summary.receipts` | στις {count} αποδείξεις | across {count} receipts |
| `insights.compare.decrease` | {pct}% σε σχέση με τον/την προηγούμενο/η {period} | {pct}% vs the previous {period} |
| `insights.compare.increase` | {pct}% σε σχέση με τον/την προηγούμενο/η {period} | {pct}% vs the previous {period} |
| `insights.compare.none` | Δεν υπάρχει σύγκριση | No comparison available |
| `insights.section.by_category` | Ανά κατηγορία | By category |
| `insights.section.top_merchants` | Κορυφαίοι έμποροι | Top merchants |
| `insights.section.top_products` | Κορυφαία προϊόντα | Top products |
| `insights.category.untagged` | Χωρίς κατηγορία | Untagged |
| `insights.product.purchases` | {count} αγορές | {count} purchases |
| `insights.product.avg_price` | {price} μ.ο. | {price} avg |
| `insights.product.total` | {amount} συνολικά | {amount} total |
| `insights.empty.title` | Ακόμα δεν έχετε σαρώσει αποδείξεις | You haven't scanned any receipts yet |
| `insights.empty.cta` | Σαρώστε την πρώτη απόδειξη | Scan your first receipt |
| `insights.error.network` | Δεν υπάρχει σύνδεση. Δοκιμάστε ξανά. | No connection. Try again. |
| `insights.offline.title` | Είστε εκτός σύνδεσης | You are offline |
| `insights.offline.body` | Διαθέσιμο όταν είστε online. | Available when online. |
| `insights.retry_cta` | Δοκιμή ξανά | Retry |

Numbers / dates use `mobile/src/lib/format.ts` (`X,XX €`, `DD-MM-YYYY` / month-anchor like `απρ 2026`).

## 5. Accessibility

- Segmented control: `accessibilityRole="tablist"`, each pill `accessibilityRole="tab"` with `accessibilityState={{ selected }}`.
- Charts have `accessibilityLabel` describing the data ("Πίτα κατηγοριών: groceries 51%, untagged 49%"). The chart is a static accessible image; the list rows below it are the screen-reader's primary path.
- Color-blind friendly palette (8 distinct hues for `PieChart`, never relying on hue alone — labels always present).
- Touch targets ≥ 44×44 dp.

## 6. Telemetry (counts only, no PII)

- `insights.opened`
- `insights.period.changed` (with `period`)
- `insights.loaded.success` (with `period`)
- `insights.loaded.empty`
- `insights.loaded.failed.network`
- `insights.loaded.failed.auth`
- `insights.offline.shown`

No totals, merchant names, EANs, or product descriptions ever attached.

## 7. Empty / offline states

### 7.1 Empty (no receipts in period)

```
[ illustration ]
Ακόμα δεν έχετε σαρώσει αποδείξεις
[ Σαρώστε την πρώτη απόδειξη ] ← CTA, navigates to Scanner
```

### 7.2 Offline (per ADR-0006 §7)

```
[ icon ]
Είστε εκτός σύνδεσης
Διαθέσιμο όταν είστε online.
[ Δοκιμή ξανά ] ← retries when NetInfo flips back
```

The Insights screen does NOT consume the offline cache (the cache stores receipts, not aggregations) — so offline = explicit empty state, never stale numbers.

## 8. Open items (handed off to BLG-0006)

- Drill-down from a category / merchant row into a filtered receipt list. Owned by DES-0004 (Home / receipt list) — to be authored alongside S-004 implementation.
- Custom date-range picker (post-MVP).
- Inferred-category labeling (post-MVP per ADR-0005 §6).
