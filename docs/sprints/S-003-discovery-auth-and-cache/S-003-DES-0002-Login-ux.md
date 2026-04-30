# DES-0002 — Login screen UX

Companion design artifact for ADR-0004. Locks the *what the user sees state by state*; the *behavioral* decisions live in ADR-0004.

Owner: `product-designer` (with `mobile-builder`, `localization-specialist`, `security-privacy-officer`, `qa`).

## 1. Scope

The Login screen is the user's first encounter with the app's auth model. It runs the full Supabase native phone-OTP cycle (per ADR-0004) and produces an authenticated session that all other screens depend on. ΑΦΜ is **not** captured here (see ADR-0004 §1 / §8). Profile captures it later.

Out of scope:

- The post-login Home screen (DES-0004 — to be authored alongside S-004 implementation).
- Long-form privacy page (a static document; copy authored alongside S-004 implementation).
- Adaptive country-code picker (Greek `+30` is the default and the only country code in MVP).

## 2. State machine

Single `useReducer` (same pattern as ADR-0003 §1). Implementation lives in `mobile/src/screens/login/state.ts`.

### States

| State | Description | Allowed transitions |
|---|---|---|
| `idle` | First mount; phone field empty. | → `entering_phone` |
| `entering_phone` | User typing in the phone field. | → `idle`, → `submitting_phone` |
| `submitting_phone` | `signInWithOtp` in flight. | → `awaiting_otp`, → `network_error`, → `rate_limited`, → `entering_phone` (validation error) |
| `awaiting_otp` | Supabase confirmed OTP sent; user typing the 6 digits. | → `verifying_otp`, → `cooldown` (resend), → `entering_phone` (back) |
| `verifying_otp` | `verifyOtp` in flight. | → `success`, → `wrong_otp`, → `expired_otp`, → `network_error` |
| `wrong_otp` | OTP mismatch (Supabase generic error). | → `awaiting_otp` (clear field) |
| `expired_otp` | OTP expired (Supabase invalidates after attempts or TTL). | → `entering_phone` (auto-restart) |
| `cooldown` | "Resend" tapped; `Retry-After`-driven disabled state. | → `awaiting_otp` |
| `network_error` | Connectivity lost or 5xx from Supabase. | → `entering_phone` (with last-typed value retained) |
| `rate_limited` | Supabase 429. Per-phone cap hit. | → `cooldown` |
| `success` | Session established (access + refresh tokens stored in `expo-secure-store`). | → terminal (navigate Home) |

### Transitions (selected)

- **`idle` → `entering_phone`**: any text input event.
- **`entering_phone` → `submitting_phone`**: tap "Συνέχεια" with a normalizer-valid E.164 string. Disabled-button when invalid.
- **`submitting_phone` → `awaiting_otp`**: Supabase `signInWithOtp` resolves successfully.
- **`submitting_phone` → `entering_phone`** (validation error): normalizer rejected the phone (shouldn't happen post-button-disable, but defensive).
- **`awaiting_otp` → `verifying_otp`**: 6 digits entered + tap "Επαλήθευση" (or auto-submit on 6th digit).
- **`verifying_otp` → `success`**: Supabase returns a session.
- **`verifying_otp` → `wrong_otp`**: Supabase returns invalid-OTP.
- **`verifying_otp` → `expired_otp`**: Supabase returns expired/3-strikes-exhausted.
- **`awaiting_otp` → `cooldown`**: tap "Στείλτε ξανά". Disabled until the cooldown timer (default 30 s, or `Retry-After` if higher) elapses.
- **`*` → `network_error`**: any RN `NetInfo` offline event during a request.

## 3. Greek-first copy (`mobile/src/i18n/strings.ts` keys `login.*`)

All strings authored Greek-first; English fallback in parentheses.

| Key | Greek | English |
|---|---|---|
| `login.title` | Καλώς ήρθατε | Welcome |
| `login.subtitle` | Συνδεθείτε με τον αριθμό του κινητού σας. | Sign in with your mobile number. |
| `login.phone_label` | Αριθμός κινητού | Mobile number |
| `login.phone_placeholder` | 6XXXXXXXXX | 6XXXXXXXXX |
| `login.country_code_hint` | Κωδικός χώρας: +30 | Country code: +30 |
| `login.continue_cta` | Συνέχεια | Continue |
| `login.privacy_short` | Συνεχίζοντας, αποδέχεστε την Πολιτική Απορρήτου. | By continuing, you accept the Privacy Policy. |
| `login.privacy_link` | Διαβάστε περισσότερα | Read more |
| `login.privacy_sms_provider` | Το SMS αποστέλλεται μέσω παρόχου του Supabase. | The SMS is delivered via Supabase's provider. |
| `login.otp_title` | Εισαγάγετε τον κωδικό | Enter the code |
| `login.otp_subtitle` | Στείλαμε έναν 6ψήφιο κωδικό στο {phone}. | We sent a 6-digit code to {phone}. |
| `login.otp_label` | Κωδικός επαλήθευσης | Verification code |
| `login.verify_cta` | Επαλήθευση | Verify |
| `login.resend_cta` | Στείλτε ξανά | Send again |
| `login.resend_cooldown` | Στείλτε ξανά σε {seconds}s | Send again in {seconds}s |
| `login.back_cta` | Λάθος αριθμός; | Wrong number? |
| `login.error_invalid_phone` | Ελέγξτε τον αριθμό και δοκιμάστε ξανά. | Check the number and try again. |
| `login.error_wrong_otp` | Λάθος κωδικός. Δοκιμάστε ξανά. | Wrong code. Try again. |
| `login.error_expired_otp` | Ο κωδικός έληξε. Ζητήστε νέο. | The code expired. Request a new one. |
| `login.error_rate_limited` | Πολλές προσπάθειες. Δοκιμάστε σε λίγο. | Too many attempts. Try again shortly. |
| `login.error_network` | Δεν υπάρχει σύνδεση. Δοκιμάστε ξανά. | No connection. Try again. |
| `login.success_toast` | Είσοδος επιτυχής. | Signed in. |

Decimal/date format (no money on this screen, but for consistency with `mobile/src/lib/format.ts`): N/A — Login screen only renders phone numbers, OTP digits, and timer seconds.

## 4. Layout

- **Single-column**, vertical safe-area padded layout.
- Hero text (`login.title` + `login.subtitle`) at the top.
- Phone input occupies the central focus area; "country code" hint is a small label above the input (not an interactive picker — `+30` is the only country code in MVP).
- "Συνέχεια" CTA below input, full-width, **disabled** unless the normalizer says the input is valid E.164.
- Privacy short-form (`login.privacy_short`) below the CTA, with `login.privacy_link` linking to a privacy page.
- `login.privacy_sms_provider` line shown in a smaller font directly under the phone field (transparency requirement, ADR-0004 §7).
- After `signInWithOtp` resolves: the screen **transitions in place** to OTP entry (no navigation push) — the phone-input becomes a static label "Στείλαμε κωδικό στο {phone}" with `login.back_cta` to edit, and the OTP field replaces the CTA.
- After `verifyOtp` resolves successfully: brief `login.success_toast` then a navigation **replace** (not push) to Home — back-button cannot return to Login.

## 5. Accessibility

- Phone input: `keyboardType="phone-pad"`, `autoComplete="tel"`, `textContentType="telephoneNumber"`, `accessibilityLabel="login.phone_label"`.
- OTP input: `keyboardType="number-pad"`, `textContentType="oneTimeCode"` (iOS auto-fill), `autoComplete="sms-otp"` (Android), `maxLength={6}`.
- All CTAs have `accessibilityRole="button"` and `accessibilityState={{ disabled }}`.
- Touch targets ≥ 44×44 dp, contrast ≥ 4.5:1 for body text.
- Screen-reader announces state transitions: `wrong_otp` triggers `AccessibilityInfo.announceForAccessibility(login.error_wrong_otp)`.

## 6. Telemetry (counts only, no PII per ADR-0003 §7)

Events emitted by the reducer's `telemetryEventFor(prev, next)` helper (extends BLG-0003's pattern):

- `login.submit_phone.attempted`
- `login.submit_phone.succeeded`
- `login.submit_phone.failed.network`
- `login.submit_phone.failed.rate_limited`
- `login.verify_otp.attempted`
- `login.verify_otp.succeeded`
- `login.verify_otp.failed.wrong`
- `login.verify_otp.failed.expired`
- `login.verify_otp.failed.network`
- `login.resend_otp.attempted`
- `login.cooldown.entered`

No phone numbers, OTPs, JWTs, or `Retry-After` values are ever attached.

## 7. Phone normalizer (`mobile/src/lib/phone.ts`)

- Inputs accepted: any combination of digits, spaces, dashes, parentheses, or a leading `+`.
- Output: E.164 string (`+30...`) or `null` if invalid.
- Rules:
  - If the input starts with `+`, accept as-is and validate digit count (8–15 digits per E.164).
  - Otherwise, prepend `+30` (the only country code in MVP).
  - Strip all non-digit characters before validation.
  - Greek mobile numbers must be 10 digits starting with `6` (after country code) — soft-validate and return `null` if not.
- Unit tests cover: valid Greek mobile, valid international `+44...`, malformed (letters), too-short, too-long, leading zeros (rejected per E.164).

## 8. Open items (handed off to BLG-0005)

- The privacy page itself (long-form) — copy is drafted by `localization-specialist` alongside S-004 implementation.
- The Supabase region picked at provisioning (data-residency) — recorded by `devops-engineer` in `docs/runbooks/` during S-004.
