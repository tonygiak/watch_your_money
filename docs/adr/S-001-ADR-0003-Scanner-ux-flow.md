# Scanner UX flow (permission, domain validation, retry)

Status: accepted
Date: 2026-04-29
Chair: orchestrator
Participants: product-designer, mobile-builder, localization-specialist, security-privacy-officer, qa
Co-signs required: product-designer + localization-specialist (new mobile screen / UX flow — `AGENTS.md` §4.11).

## Context

The scanner is the first interaction every user has with the app. It also has the strictest constraints:

- It calls a sensitive OS permission (camera).
- It is the **only** path to ingest receipts (no manual entry, no OCR — §2.4).
- It must reject crafted / non-Greek QR codes **before** any network call (`agent-runtime-security.md` §1, §3.2.2).
- It must hit the §2.5 quality bar (receipt visible within 5 seconds of a successful scan).
- It must be Greek-first with English fallback (`localization-conventions.md`).

DES-0001 enumerates every state, every transition, and every Greek-first string. This ADR locks the *behavioral* decisions that DES-0001 expresses, so the implementation sprint S-002 has a single source of truth.

## Rounds

### Round 1

- **product-designer**: DES-0001 captures every state I want. The big decisions are: (1) viewfinder is a square overlay, not a thin reticle (Greek receipts have small QRs printed at the bottom — large viewfinder helps users center the camera); (2) on `unsupported_qr` we do NOT close the scanner — we keep it open with a non-blocking toast so the user can try the next receipt without re-tapping FAB; (3) `is_duplicate=true` is treated as a *success*, not an error. I want sign-off on those three.
- **mobile-builder**: All three are implementable. One technical concern: Expo's `expo-camera` and `expo-barcode-scanner` overlap. I propose using `expo-camera` with the built-in barcode scanning (single dependency). On state machine: I'll model it as a finite state machine with a single `useReducer` so qa can write tests against the reducer without rendering the camera. Also: the 10-second submit timeout should be implemented as `AbortController` not `setTimeout`-then-fetch — clean cancellation.
- **localization-specialist**: All Greek strings in DES-0001 are correct and natural. One nit: the duplicate toast `Έχετε ήδη σαρώσει αυτό το παραστατικό.` reads better than a more literal translation. Confirming the formal "you" (πληθυντικός ευγενείας) is the right register for a finance app — keep it. Strings go in `mobile/src/i18n/strings.ts` under `scanner.*`. English fallback is fine but should NOT be auto-detected against device locale that just happens to be `en-US`; it kicks in only when `el` is unsupported on the device — agree with mobile-builder if that means defaulting to `el`.
- **security-privacy-officer**: Two requirements. (1) **Domain validation must happen on-device before the network call**. DES-0001 has it; codify it in this ADR. (2) The pre-prompt explanation (`Πρόσβαση στην κάμερα` modal) is required by Apple App Review and is good practice on Android too — keep it. Also: on `permission_blocked`, the deep-link to OS settings must be `Linking.openSettings()`, not a custom URL scheme.
- **qa**: The reducer-based state machine is exactly what I want. Acceptance for BLG-0003 then becomes a unit test per state transition — concrete and high-coverage. Add to the contract: every error state MUST surface a `code` in client telemetry so we can correlate with backend logs without leaking PII.

### Round 2

- **product-designer** (responding to mobile-builder): Agree with `expo-camera` (single dependency). Agree on the reducer pattern. On the duplicate-as-success: confirming it's a SUCCESS path — same toast pattern, just different copy.
- **mobile-builder** (responding to localization-specialist): Default language order: device locale `el-*` → Greek; device locale `en-*` or `el-*` not supported by app → English fallback; everything else (e.g. `de-*`) → Greek. This matches the §2.5 "built for Greek consumers" promise. Codifying.
- **localization-specialist** (responding): Default order is correct.
- **security-privacy-officer** (responding to qa): Telemetry codes must NEVER include the QR URL, the `raw_html`, the `user_id`, or any merchant-identifying data. Only opaque codes (`unsupported_url`, `parser_drift`, `network_error`, etc.) and counts. Confirming.
- **qa** (responding): All good. Sign-off ready.

No new concerns. Closing.

## Decision

### 1. State machine

DES-0001's state machine is normative. Implementation MUST use a single reducer (`useReducer` or a small state library) with one state node per state listed in DES-0001. Every transition MUST be exhaustively covered by unit tests.

### 2. Camera and permission

- Use `expo-camera` with built-in barcode scanning. **No** `expo-barcode-scanner` (deprecated path).
- Show a custom **pre-prompt** modal before the OS permission dialog on first use.
- Handle the three permission outcomes (`granted`, `denied`, `blocked`) with distinct screens per DES-0001.
- For `blocked`, use `Linking.openSettings()` for the deep-link.

### 3. On-device domain validation

The mobile client MUST validate the QR URL **before** any network call:

- Scheme is `https`.
- Host is exactly `e-invoicing.gr`.
- Path matches `/edocuments/ViewInvoice/-1/[0-9a-fA-F-]+_[A-Za-z0-9]+$`.

Failures route directly to `unsupported_qr` (no `POST /receipts/parse` is sent). The backend also re-validates (defense in depth — ADR-0001). Both validators are kept in sync via a shared regex constant exported from `mobile/src/parsers/gr.ts` and `backend/app/parsers/gr/url.py`.

### 4. Submit, idempotency, retry

- POST is sent with `AbortController`. 10-second client-side timeout.
- 201 → `success_new`, 200 with `is_duplicate=true` → `success_duplicate`. Both navigate to ReceiptDetail.
- Network errors (502, timeout) and parser drift (503) show retry actions; retries reuse the same `qr_url` and `AbortController` lifecycle.
- 401 routes to Login (session expired).
- 422 (unsupported / empty) is a terminal state for that QR — user can dismiss or scan another.

### 5. Localization

- Default language order: device `el-*` → Greek; device `en-*` → English; everything else → Greek (the app is Greek-first per §2.5).
- All strings live under `mobile/src/i18n/strings.ts` keys `scanner.*` per DES-0001.
- Numbers and dates in toasts use `mobile/src/lib/format.ts` (Greek conventions: `X,XX €`, `DD-MM-YYYY`).

### 6. Accessibility

- Touch targets ≥ 44×44 dp.
- Screen-reader labels on every interactive element.
- Color contrast ≥ 4.5:1 (text), ≥ 3:1 (controls and large text).
- No color-only state cues.

### 7. Telemetry

Counts and timings only. No URLs, no HTML, no `user_id`. Concrete events listed in DES-0001 §"Telemetry". `time_to_receipt_ms` is the §2.5 quality-bar metric.

## Dissent

None recorded. All participants converged in Round 2.

## Consequences

**Positive:**
- BLG-0003 is now Ready: S-002 implements the scanner against DES-0001 + this ADR with a reducer-based state machine.
- The "domain check before network call" rule is enforced at the contract level on both client and server.
- The duplicate-as-success path eliminates a class of frustrating "error" UX for users who scan the same receipt twice.

**Negative:**
- Greek-first default means English-locale device users still see Greek by default — acceptable per §2.5 ("Greek consumers should immediately feel 'this is built for me'") and reversible from Profile in a future sprint.

**Follow-ups (added to backlog):**
- BLG-0011 — *Profile screen language switch (Greek / English)* (deferred — out of MVP scope per §2.9 unless a user-test reveals it's blocking).
