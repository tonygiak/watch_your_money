# Phone-OTP provider, flow, rate limits, and GDPR posture

Status: accepted
Date: 2026-04-30
Chair: orchestrator
Participants: security-privacy-officer, data-architect, agent-safety-officer, architect, engineering-manager, mobile-builder, backend-builder, product-designer, localization-specialist, qa
Co-signs required: security-privacy-officer + data-architect (auth flow change — `AGENTS.md` §4.11), agent-safety-officer (any new external SMS surface beyond Supabase).

## Context

`AGENTS.md` §2.8 #2 makes phone-OTP the only authentication path for the MVP. §5.5.2 mandates a "phone number input → OTP verification flow via Supabase Auth", and §5.6 already lists `SUPABASE_URL` + `SUPABASE_ANON_KEY` on the mobile side and `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` on the backend.

Three things are *not* yet decided and gate BLG-0005:

1. **Provider.** Supabase native phone OTP, a direct Twilio integration, or "deferred for MVP" (e.g. magic-link email).
2. **Rate-limit and abuse posture.** OTP endpoints are a classic attack surface: SIM-swap, brute force, SMS-pumping, enumeration of registered phone numbers.
3. **GDPR posture.** The phone number is personal data. Storage, retention, lawful basis, and cross-border transfer all need a recorded position.

Constraints in scope:

- `AGENTS.md` §2.4 — "no third-party paid services beyond Supabase, Railway / Render, and `e-invoicing.gr`".
- `AGENTS.md` §3.2.1 — outbound surface; new hosts are a backlog item, not in-sprint.
- `AGENTS.md` §3.2.1 — secrets only via env, never in agent context.
- `AGENTS.md` §5.4.1 — `users.phone (text, unique)`; RLS on `auth.uid()`.
- ADR-0002 — backend already verifies a Supabase HS256 JWT (`SUPABASE_JWT_SECRET`) stdlib-only. Picking a non-Supabase auth provider invalidates that path.
- `.agents/context/outbound-allowlist.md` — `*.supabase.co` is allowed; Twilio is **not** on the allowlist and would need its own ADR + co-sign + provenance.

## Rounds

### Round 1

- **security-privacy-officer**: Default position is **Supabase native phone OTP**. Reasoning: (a) §2.4 already lists Supabase as an allowed paid service, so we don't widen the third-party surface; (b) ADR-0002's stdlib JWT verifier *only* trusts Supabase HS256 tokens — a non-Supabase provider would force a parallel verification path; (c) Supabase Auth gives us per-phone rate limits, OTP TTL, and audit logging out of the box, with no additional secret-handling code on our side. Concerns to settle: lawful basis under GDPR (Art. 6(1)(b) — performance of a contract: the user signs up to use the app, so phone is necessary to fulfill the service), retention (delete phone + receipts on user deletion), and transparency (privacy notice listed before phone entry).
- **data-architect**: The schema already has `users.phone (text, unique)` and RLS keyed on `auth.uid()`. With Supabase native OTP, `auth.users.id` is the canonical user id and we mirror it into our `users.id` via a `handle_new_user()` trigger or an explicit insert on first session. **Concern**: we currently have a *separate* `public.users` table with `phone` and `is_freelancer` — under Supabase Auth, `auth.users` already stores phone. Risk of drift. Resolution proposal: **`public.users.id` = `auth.users.id` via FK + on-insert trigger; `public.users.phone` is denormalized for query convenience and synced from `auth.users` on signup**. RLS policies stay keyed on `auth.uid()`; no change to ADR-0002.
- **agent-safety-officer**: I do not need to add a new outbound host: Supabase already covers SMS via its managed provider (Supabase contracts with the SMS gateway; the app does not). This satisfies `agent-runtime-security.md` §5 — we don't widen our outbound surface. **Hard requirement**: if anyone ever proposes "let's just use Twilio directly", that's a new outbound host (`*.twilio.com`) and needs its own ADR + this office's co-sign per `AGENTS.md` §4.11 — so I want this ADR to explicitly reject the direct-Twilio path. **Soft requirement**: the privacy notice on the login screen must name the SMS provider in plain Greek per GDPR Art. 14 transparency (Supabase exposes its delivery partner per region; we surface that string).
- **architect**: Strong preference for Supabase native. ADR-0002 is built on `SUPABASE_JWT_SECRET`; introducing Twilio splits the auth path and doubles the verifier surface. Concerns to settle: (1) **session lifetime** — Supabase default is 1-hour access token + 30-day refresh; do we shorten? (2) the freelancer ΑΦΜ field (`AGENTS.md` §5.5.2) is *not* part of OTP — it's a Profile field, recorded after login; this ADR should be explicit that ΑΦΜ entry is **not** an auth gate (so accountants can still onboard via OTP and add ΑΦΜ later).
- **engineering-manager**: Supabase native is right. Implementation cost is the lowest by an order of magnitude (one `supabase.auth.signInWithOtp({ phone })` + one `verifyOtp` call vs a full Twilio integration with our own state, secrets, and rate-limit code we'd have to maintain). Concern: client-side error handling — Supabase returns generic errors for OTP attempts; we need a small mapping table for the Greek-first UX so the user gets actionable Greek messages.
- **mobile-builder**: Supabase JS SDK already declared in BLG-0012's pinned tree (`@supabase/supabase-js`). Implementing OTP is the canonical example in their docs. One concern: **phone number normalization** — Supabase requires E.164 (`+30...`); the user types `694…` (Greek mobile). The Login screen needs an on-device normalizer that defaults the country code to `+30` (Greece) and validates the format before calling `signInWithOtp`. This is UX-only; no extra dependency.
- **product-designer**: I can build DES-0002 against Supabase's signInWithOtp lifecycle: enter-phone → consent-checkbox-with-privacy-notice → OTP-entry → verify → home. With "resend OTP" (cooldown) and "wrong number" (back) affordances. Concern: empty-state on first launch — what happens if the user denies notification permission, has no SMS, etc.? Solution: a simple "I didn't get the code" flow that triggers `resend` after a 30-second cooldown.
- **localization-specialist**: All Greek copy will live under `mobile/src/i18n/strings.ts` keys `login.*`. The privacy-notice block needs careful Greek — "Επιβεβαίωση τηλεφώνου" / "Στέλνουμε έναν 6ψήφιο κωδικό μέσω SMS" / etc. I want sign-off on the whole `login.*` table inside DES-0002.
- **qa**: Test strategy — three layers: (1) unit tests for the phone-normalizer (E.164, Greek country code default, malformed inputs); (2) reducer tests for the Login state machine (idle → otp_pending → verifying → success / error / cooldown); (3) one integration test that uses `@supabase/supabase-js` against a mocked HTTP layer (no real network) to assert the SDK is called with the right shape. No real SMS in CI.

### Round 2

- **security-privacy-officer** (responding to architect on session lifetime): **Shorten to 1-hour access + 14-day refresh**. Reasoning: financial data on a mobile device + phone-OTP is the only second factor → 30-day refresh is permissive. 14 days balances UX (user logs in every fortnight) with blast-radius if a device is lost. Refresh-token rotation stays on (Supabase default).
- **security-privacy-officer** (responding to data-architect on `public.users` ↔ `auth.users`): Agree on FK + sync trigger. Add: when a user requests deletion (Art. 17 right to erasure), we delete from `public.users` first (cascades to `receipts` + `receipt_items` per FK), then from `auth.users`. Order matters — delete in `auth.users` first and the cascade fails silently in an edge case where the trigger has already fired. **Recorded.**
- **data-architect** (responding): Sync trigger draft — `on_auth_user_inserted` SQL function inserts a `public.users` row with `id = NEW.id`, `phone = NEW.phone`, `is_freelancer = false` (default). Migration goes in S-004 implementation. RLS unchanged.
- **agent-safety-officer** (responding to all): **Codifying the Twilio rejection.** This ADR explicitly **forbids** any direct Twilio (or other SMS-vendor) integration without a new ADR + co-sign by this office. If Supabase deprecates phone OTP or the SMS provider becomes inadequate, the response is: open `BLG-` (`agentic` type) → discovery sprint → ADR with this office's co-sign → allowlist update → only then implement. The *application code* must never include a Twilio SDK or call `*.twilio.com` directly.
- **agent-safety-officer** (responding to product-designer): On the privacy notice, Supabase's per-region SMS provider is documented in their dashboard. We'll surface a static line like "Το SMS αποστέλλεται μέσω παρόχου του Supabase" (no specific vendor name in the UI — Supabase can rotate its provider; we keep the wording stable). The transparency requirement is satisfied by linking to a privacy page that names the provider with a last-updated date. The privacy page itself is a delivery item, captured under BLG-0005's acceptance.
- **architect** (responding to engineering-manager + mobile-builder on UX): Agree on the phone normalizer + reducer. **Adding to scope**: the backend stays out of the auth path entirely. The mobile client talks Supabase Auth directly; the backend is reached only via the Bearer JWT issued by Supabase (per ADR-0002). This means **no new backend endpoint** for OTP. Recording it so S-004 doesn't accidentally invent one.
- **engineering-manager** (responding): No new concerns.
- **mobile-builder** (responding to product-designer): Resend cooldown is 30s on the UX, but the actual Supabase rate limit is per-phone (default 1 OTP / 60s + project-level cap). We mirror the Supabase response (`429` with Retry-After) into a Greek-first error and disable the resend button until the cooldown ends.
- **product-designer** (responding to mobile-builder): Yes, the cooldown timer is per-phone and the disabled-button surface follows it.
- **localization-specialist** (responding): Privacy notice short-form goes inline; long-form lives under a "Διαβάστε περισσότερα" link to a privacy page. Both Greek-first; English fallback per ADR-0003 §5.
- **qa** (responding): No new concerns.

### Round 3

- **security-privacy-officer**: No new concerns.
- **data-architect**: No new concerns.
- **agent-safety-officer**: No new concerns.
- **architect**: No new concerns.

No new concerns surfaced after Round 3. Closing.

## Decision

### 1. Provider

**Supabase native phone OTP**, via `@supabase/supabase-js` `signInWithOtp({ phone })` + `verifyOtp({ phone, token, type: "sms" })`.

- **Rejected**: direct Twilio (or other SMS-vendor) integration. This ADR forbids it without a fresh ADR co-signed by `agent-safety-officer` (`AGENTS.md` §3.2.1, `agent-runtime-security.md` §5).
- **Rejected**: deferring auth to post-MVP. `AGENTS.md` §2.8 #2 makes phone-OTP an MVP gate.

### 2. Outbound surface

- **No new outbound host.** Supabase is already on `.agents/context/outbound-allowlist.md` (`*.supabase.co`). Supabase contracts with its own SMS delivery partner; the app does not.
- The mobile client makes the OTP call directly to Supabase; the backend is **not** in the auth path.

### 3. Schema interaction (RLS unchanged)

- Authoritative user record lives in `auth.users` (Supabase-managed).
- `public.users.id` = `auth.users.id` via FK; on `auth.users` insert, an `on_auth_user_inserted` trigger inserts `public.users (id, phone, is_freelancer=false)`.
- RLS policies stay keyed on `auth.uid()` per the existing migrations. No change to ADR-0002.
- On user deletion (Art. 17 right to erasure): delete from `public.users` **first** (cascades to `receipts`, `receipt_items`), then from `auth.users`.

### 4. Session lifetime

- **Access token: 1 hour** (Supabase default).
- **Refresh token: 14 days** (shortened from Supabase's 30-day default — financial data + single factor).
- Refresh-token rotation **on** (Supabase default).
- ADR-0002's stdlib JWT verifier already handles 1-hour access tokens; no change there.

### 5. Phone-number handling

- **Format**: E.164 (`+30...` for Greek mobile).
- **On-device normalizer** in `mobile/src/lib/phone.ts`: default country code `+30`; strips spaces, dashes, parentheses; validates length and digit-only payload before calling `signInWithOtp`.
- **No phone number is ever logged** by the app or the backend (per ADR-0002 §6 logging rules; extended here to OTP flows).

### 6. Rate limit and abuse posture

- **Per-phone**: rely on Supabase's default (1 OTP / 60 s) + project-level cap; mirror `429 Retry-After` into a Greek-first toast.
- **UI cooldown**: disable the "Resend" button for 30 s after a send, then up to the value of `Retry-After` if Supabase returns `429`.
- **Enumeration defense**: the Login screen's verify-OTP error is a generic Greek string (`"Λάθος κωδικός. Δοκιμάστε ξανά."`) and is identical for "wrong code" and "expired code"; no path returns "this phone is not registered".
- **Brute-force defense**: Supabase invalidates the OTP after 3 wrong attempts (default); the UI surfaces an opaque "Λάθος κωδικός" toast.

### 7. GDPR posture

- **Lawful basis**: Art. 6(1)(b) — performance of a contract (the user signs up to use the app; the phone number is necessary to deliver the service).
- **Transparency**: Login screen shows a short privacy notice **before** the phone-input field is enabled. Long-form privacy page linked from the same notice.
- **Retention**: phone is retained while the user account exists; on deletion, removed per §3 above.
- **Cross-border**: covered by Supabase's DPA (the project follows Supabase's region selection at provisioning time; recorded in `docs/runbooks/` once a region is picked in S-004 implementation — captured as a BLG-0005 acceptance bullet).
- **DPIA**: not triggered for phone-OTP alone; trigger reviewed if/when sensitive financial categories of data are added. Tracked by `security-privacy-officer`.

### 8. Login screen UX (companion DES-0002)

States (full state machine in DES-0002):

- `idle` → `entering_phone` → `awaiting_otp` (Supabase send returned) → `verifying_otp` → `success` (navigate Home) | `wrong_otp` | `cooldown` | `network_error`.
- Greek-first, English fallback per ADR-0003 §5.
- `login.*` strings live in `mobile/src/i18n/strings.ts`.
- ΑΦΜ entry is **not** an auth gate; it is a Profile field captured post-login (`AGENTS.md` §5.5.2).

### 9. Test strategy (BLG-0005 acceptance)

- Unit: `mobile/src/lib/phone.ts` E.164 normalizer.
- Reducer: every Login state transition.
- Integration: Supabase JS SDK called with the right shape against a mocked HTTP layer (no real SMS in CI).
- No SMS or phone number ever touches a fixture file or a log line.

## Dissent

None recorded. All participants converged in Round 3.

## Consequences

**Positive:**

- BLG-0005 is now **Ready**: S-004 implements the Login screen, the phone normalizer, the reducer, the `on_auth_user_inserted` trigger migration, and the privacy notice + page.
- No widening of the outbound surface; allowlist unchanged.
- ADR-0002's JWT verification path stays valid as-is — the same `SUPABASE_JWT_SECRET` covers OTP-issued access tokens.
- The "no client-supplied identity" rule (ADR-0002) extends naturally: every authenticated request to `POST /receipts/parse` carries a Supabase access token whose `sub` is the canonical user id.

**Negative:**

- Refresh-token lifetime shortened from 30 d to 14 d → users have to re-authenticate twice as often. Acceptable trade for financial-data blast radius; revisit if user research shows friction.
- We are dependent on Supabase's SMS provider availability for OTP delivery; if Supabase deprecates phone OTP, this ADR is superseded by a fresh debate (Twilio or otherwise) — explicitly NOT something the implementation sprint can decide unilaterally.

**Follow-ups (added to backlog):**

- BLG-0005 Acceptance bullets folded into the backlog item (this sprint).
- New: `docs/runbooks/<...>` for picking a Supabase region (data-residency) — captured as a BLG-0005 acceptance bullet, not a new top-level item.
- No allowlist change.
