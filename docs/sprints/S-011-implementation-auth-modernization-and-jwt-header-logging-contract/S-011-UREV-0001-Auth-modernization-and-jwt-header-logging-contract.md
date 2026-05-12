# S-011 UREV — User review

How to verify what shipped in S-011, end to end. Sprint type was **implementation** so this UREV covers running code, not just decisions.

**Two user-visible changes** landed this sprint, both deliberately understated:

1. **The first 401 on a scan no longer signs you out** — the mobile client silently refreshes the Supabase session once and re-tries the parse. Only the second 401 in the same flow triggers the terminal sign-out path. (BLG-0024)
2. **Every JWT rejection in the backend logs now emits one well-shaped diagnostic line** with public header metadata only — no token, no payload, no PII. (BLG-0025 — operator-visible; user-invisible.)

The big change underneath — the asymmetric JWT verifier (BLG-0023) — is **deliberately a no-op for users** until the operator rotates the Supabase project's signing keys per the new runbook.

---

## Quick checklist — what you should be able to do after this sprint

- ☐ Sign in to the app on a real device exactly as before.
- ☐ Scan a Greek e-invoicing.gr receipt and have it land in your history within ~5 seconds (no behaviour change from S-009).
- ☐ Have the app *silently* recover from a transient auth blip the first time it happens during a scan — you should see a brief "Επαναφορά σύνδεσης…" / "Refreshing session…" pill, then your scan should complete.
- ☐ Be signed out (and routed to the login screen) only on a *second* consecutive 401 on the same scan.

Everything else — login, list, detail, insights, tag, profile, export — should behave identically to the S-009 acceptance baseline.

---

## Verification path 1 — happy-path scan (regression check)

Goal: confirm the asymmetric-verifier path under HS256-transitional mode doesn't break the existing flow.

The Supabase project is still on Legacy HS256 keys at S-011 close (rotation happens during the S-012 deploy window per `docs/runbooks/rotate-supabase-jwt-signing-keys.md`). So under the hood, every scan today is exercising the **HS256-transitional** branch of the new verifier — the path that takes the legacy secret and proves it still works.

1. Start the backend locally: `make run-backend` (or in PowerShell: `cd backend; uvicorn app.main:app --reload`).
2. Start the mobile app: `make run-mobile` (or `cd mobile; npx expo start`). Open in Expo Go on a real device.
3. Sign in with your phone number + OTP.
4. Open the scanner. Scan a real Greek e-invoicing.gr receipt.
5. **Expected**: the receipt lands in your history within ~5 seconds, line items intact, totals match the printed receipt. No visible difference from S-009.

If this passes, the asymmetric verifier's HS256-transitional path is working in production-equivalent conditions.

## Verification path 2 — silent session refresh on first 401

Goal: confirm BLG-0024's recoverable-then-terminal behaviour.

This one is harder to trigger naturally because Supabase tokens have a generous lifetime, but you can force it:

1. Sign in normally. Scan a receipt; confirm it lands. (Baseline.)
2. **Force a 401** on the next scan. Two practical ways:
   - **(A) Manipulate the in-memory token.** Open the React DevTools / Flipper while the app is running, find the `App` component state, and corrupt the stored access token by one character.
   - **(B) Wait out the access-token TTL.** Leave the app in the foreground without scanning until Supabase's access-token TTL expires (refresh token is still valid). Then scan.
3. Scan a real Greek receipt.
4. **Expected**: you should see a brief "Επαναφορά σύνδεσης…" / "Refreshing session…" pill in Greek (or English if the device locale is set to English), then your scan should complete normally and the receipt should land. No sign-out.
5. **Then force a 401 again immediately** (corrupt the token again) and scan once more.
6. **Expected**: this second 401 should route you to the login screen — the recoverable-then-terminal contract.

To watch the scanner reducer transitions live, you can also run the state-machine tests in watch mode: `cd mobile; npx jest mobile/__tests__/screens/scanner/state.test.ts --watch` and inspect the new `auth_error_recoverable` / `auth_error_terminal` test cases.

## Verification path 3 — backend logging hygiene (operator)

Goal: confirm BLG-0025's log-line shape and the redaction-regex contract.

1. Start the backend with `LOG_LEVEL=info`.
2. Send a `POST /receipts/parse` request with a deliberately bad `Authorization: Bearer …` — for example, take a valid JWT, change one character in the signature, send it.
3. The backend should respond `401` with the existing RFC-7807 envelope.
4. **Check the log output** for the diagnostic line. It should look like (one line, fields collapsed for brevity here):

   ```
   level=warning code=invalid_signature alg=HS256 typ=JWT kid=ab1234… reason=jwt_rejected
   ```

5. **Confirm what is NOT in the log**: the full token, the `Bearer ` prefix, any of the JWT payload claims (`sub`, `email`, `phone`, `aud`, `exp`, `iat`), and the raw `Authorization` header value. None of those should ever appear.
6. To prove this mechanically, run the negative-contract test: `cd backend; python -m pytest tests/test_auth_logging.py -v`. All 9 tests pass at sprint close (the last one is the redaction-regex scan over every captured log record).

## Verification path 4 — asymmetric verifier under JWKS (staging only)

Goal: prove the ES256 / JWKS path works *before* the operator rotates the production Supabase project.

This requires a staging Supabase project. **Do not run this against production until the runbook says so.**

1. In your staging Supabase project's settings, enable "JWT Signing Keys" (rotates the project to ES256 with JWKS).
2. Set `SUPABASE_JWKS_URL=https://<staging-project>.supabase.co/auth/v1/jwks` in the backend's staging env.
3. Keep `SUPABASE_JWT_LEGACY_HS256_SECRET=<staging-hs256-secret>` set as well — the transitional path stays active per ADR-0015 §4 until BLG-0034.
4. Restart the backend. Confirm boot-time logs include the JWKS provider initializing (no errors).
5. Sign in to the mobile app pointed at staging. Scan a receipt.
6. **Expected**: the receipt lands. The verifier picked the ES256 path because the token's `alg` is now ES256 and its `kid` matches one of the JWKS entries.
7. Run the full backend test suite to confirm coverage: `cd backend; python -m pytest tests/auth -v`. All 39 tests pass.

Once verification path 4 succeeds in staging, the operator can follow `docs/runbooks/rotate-supabase-jwt-signing-keys.md` to do the same on production during the S-012 deploy window.

## Verification path 5 — emergency rollback (operator drill)

Goal: confirm the rollback path is exercisable.

Per `docs/runbooks/rollback-to-hs256-only.md`:

1. In Supabase, switch the project back to "Legacy HS256."
2. Confirm `SUPABASE_JWT_LEGACY_HS256_SECRET` is set on the backend (it should still be — ADR-0015 §4 keeps it active for ≥ one release cycle post-rotation).
3. Optionally unset `SUPABASE_JWKS_URL` to short-circuit the JWKS provider to `None` (saves a refetch attempt that would now always return 404 anyway).
4. Restart the backend.
5. The mobile app should keep working without any client-side change — the verifier picks HS256 by header, finds the legacy secret in config, and accepts the token.

Recorded as a drill step, not an instruction to actually roll back today. The rollback path stays as a safety net through BLG-0034.

---

## What you do *not* need to verify after this sprint

- **Receipt parsing accuracy** — untouched in S-011; the S-009 fixture-driven tests still pin all 20+ Entersoft fixtures and pass.
- **RLS / data isolation** — untouched in S-011; no schema migration, no policy change.
- **Insights / tag / profile / export flows** — untouched in S-011 beyond the DI shape change in their route files (which is internal — the 401 envelope is identical).
- **Encrypted offline cache** — untouched in S-011.
- **PDF export → native share sheet** — untouched in S-011.

If any of those regress, that is a sprint blocker for S-012's open day — file it as a `drift` backlog item per `AGENTS.md` §4.10.

---

## Where to read more

- **Why these three items had to ship together**: `docs/adr/S-010-ADR-0015-Asymmetric-jwt-verification.md` §8 and `docs/adr/S-010-ADR-0016-Jwt-header-logging.md` §3.
- **Why the verifier is hand-rolled, not PyJWT**: `docs/adr/S-010-ADR-0015-Asymmetric-jwt-verification.md` §2.
- **Why JWT *headers* are loggable while everything else is not**: `docs/adr/S-010-ADR-0016-Jwt-header-logging.md` §2.
- **Sprint LOG with the audit trail (outbound hosts, deps added, sign-offs)**: `S-011-LOG-0001-Auth-modernization-and-jwt-header-logging-contract.md`.
- **Sprint REV with outcomes, learnings, and follow-ups**: `S-011-REV-0001-Auth-modernization-and-jwt-header-logging-contract.md`.
- **What ships in S-012**: `docs/plan.md` "Next sprint" section.
