# S-011 — Implementation: Auth modernization + JWT header logging contract

Sprint type: **implementation** (per `AGENTS.md` §4.1.1).

Theme: land the asymmetric-JWT-verification contract from ADR-0015 and the JWT-header-logging contract from ADR-0016 in a single PR — the `agent-safety-officer` + `security-privacy-officer` + `engineering-manager` consensus from S-010 was that the auth-gate rewrite and its logging discipline must be co-located in review.

Chair: `orchestrator` (process). Driver: `backend-builder` (verifier) + `mobile-builder` (soft auth-error). Sign-offs at review per `AGENTS.md` §4.11: `architect`, `security-privacy-officer`, `agent-safety-officer`, `engineering-manager`, `qa`.

## Goals

Ship these three BLGs (Ready since S-010 close):

1. **BLG-0023** (M) — Asymmetric Supabase JWT verification. Replaces `backend/app/auth.py`'s HS256-only verifier with a `cryptography==45.0.1`-backed verifier supporting ES256 / RS256 / HS256-transitional, JWKS-cached (600 s TTL, 60 s refetch-floor, hard-fail-401 on unreachable). Algorithm allowlist + key-type/kid binding enforced. Coverage ≥ 95 % on `app/auth.py`, ≥ 22 verifier tests.
2. **BLG-0024** (S) — Soft auth-error handling on the scanner. Recoverable vs terminal 401 split in the scanner reducer; one silent `supabase.auth.refreshSession()` + retry before sign-out. `refreshSession` adapter wired through `App.tsx`. New i18n string `scanner.error.auth.refreshing` (el + en).
3. **BLG-0025** (XS) — Formalize the JWT-rejection diagnostic log line. New `backend/tests/test_auth_logging.py` with ≥ 8 tests including a redaction regex scan that scans every captured log record for token-shaped strings, raw `Authorization` values, full payload base64, full signature base64. Header-extraction moves from the route into `app/auth.py:extract_header_metadata`.

The ADR-0015 §8 + ADR-0016 §3 hard-ordering constraint (these three land together in one PR for review safety) is honored.

## Out of scope

These were Ready at S-010 close but carry to **S-012** because their gates are not yet resolved:

- **BLG-0030** — AADE HTML-shape spike. Gated on a consented AADE receipt under §5.8.1. No receipt acquired yet. Carry.
- **BLG-0027** / **BLG-0028** — AADE + Epsilon Net adapters. BLG-0027 is gated on BLG-0030 outcome; BLG-0028 is gated on a consented Epsilon Net fixture. Carry.
- **BLG-0032** — Mobile QR-validator discriminated-union mirror. Couples to BLG-0027 + BLG-0028 per its acceptance bullets. Carry.

`product-manager` sized this at sprint open: the M-heavy queue noted in `docs/plan.md` would not fit in one delivery sprint with the auth-modernization ordering constraint in force. Splitting along the constraint boundary is cleaner.

## Definition of Done

Per `AGENTS.md` §4.7 + the ADR-0015 §8 acceptance bullets + the ADR-0016 §3 test contract:

- `backend/requirements.txt` contains `cryptography==45.0.1` (exact pin, `agent-safety-officer` + `engineering-manager` co-signed in ADR-0015 Round 1).
- `backend/app/config.py` exposes `supabase_jwks_url`, `supabase_jwks_cache_ttl_seconds`, `supabase_jwt_legacy_hs256_secret`, with the one-cycle `SUPABASE_JWT_SECRET` alias + conflict detection at boot per ADR-0015 §5 Round-2.
- `backend/app/auth.py` rewritten: asymmetric verifier; `JWKSProvider` Protocol with injectable `get_keys()`; `extract_header_metadata(token) -> HeaderMetadata` helper; algorithm allowlist + cross-check matrix from ADR-0015 §4; same `JwtError` taxonomy preserved (ADR-0015 §6).
- `backend/app/routes/receipts.py` `jwt_exception_handler` calls `extract_header_metadata`; the static-`reason` discipline from ADR-0016 §2 is enforced by tests.
- `backend/.env.example` updated with the new vars and a deprecation note on `SUPABASE_JWT_SECRET`.
- `backend/tests/auth/test_jwt.py` expanded to ≥ 22 tests (ES256-ok, ES256-bad-signature, ES256-unknown-kid, ES256-kid-rsa-mismatch, RS256-ok, RS256-bad-signature, RS256-bad-kid, HS256-ok, HS256-bad-secret, HS256-no-legacy-secret, HS256-with-asymmetric-kid, `alg=none` rejected, unknown alg rejected, aud mismatch, exp expired, JWKS-cache-hit, JWKS-cache-miss-then-refetch, JWKS-rate-limited-window, JWKS-fetch-failure, JWKS-malformed-json, kid-rotation-simulated, plus existing happy-path / signature-mismatch / malformed / audience-list).
- `backend/tests/test_auth_logging.py` (new) ≥ 8 tests including the redaction regex scan from ADR-0016 §3 across every captured log record in the auth test session.
- `mobile/src/screens/scanner/state.ts` extended with `auth_error_recoverable` + `auth_error_terminal` states + `SUBMIT_401_RECOVERED` + `SUBMIT_401_TERMINAL` actions.
- `mobile/App.tsx` exposes a `refreshSession()` adapter injected into screens; no screen imports `@supabase/supabase-js` for refresh.
- `mobile/src/screens/ScannerScreen.tsx` consumes the refresh adapter + drives the recoverable path.
- New i18n string `scanner.error.auth.refreshing` (el + en).
- `mobile/__tests__/screens/scanner/state.test.ts` extended with the two new branches.
- `docs/runbooks/rotate-supabase-jwt-signing-keys.md` (new) and `docs/runbooks/rollback-to-hs256-only.md` (new) per ADR-0015 §9 acceptance bullets.
- `AGENTS.md` §2.6 amended with BLG-0023 + BLG-0024 + BLG-0025 user-visible behavior (the **users don't notice** anything when JWKS-unreachable transients hit — that's the point); §2.7 snapshot at sprint close.
- `docs/plan.md` rewritten for S-012; `docs/backlog.md` moves BLG-0023 / BLG-0024 / BLG-0025 to `docs/done.md`; BLG-0030 / BLG-0032 / BLG-0027 / BLG-0028 stay Ready.
- `make check` green (target: 346 → ~370+ tests across 21+ suites).
- LOG entries for the run, REV at close, UREV with the manual on-device verification script.

## Notes

- Operator action at deploy time (out of repo) per ADR-0015 §9.4: rotate the Supabase project from "Legacy HS256" back to "JWT Signing Keys (ES256)" once the new verifier is verified in staging. The Option A (DES-0006) workaround reverses.
- `cryptography==45.0.1` is pre-checked by `agent-safety-officer` in ADR-0015 Round 1 — no new outbound host (Supabase JWKS endpoint shares `*.supabase.co` with the existing data path).
- Mobile-side BLG-0024 + backend-side BLG-0023 compose by design (per ADR-0015 Round 2 backend-builder + engineering-manager exchange): a transient JWKS-unreachable window returns 401; the mobile reducer's single silent refresh + retry rides over a 60-second window without signing the user out. The S-011 UREV captures this end-to-end check.

## Risks

- **Boot conflict between `SUPABASE_JWT_SECRET` and `SUPABASE_JWT_LEGACY_HS256_SECRET` set to different values** (rare, but ADR-0015 §5 mandates fail-loud). Implementation has explicit `RuntimeError` at config load with a clear operator message.
- **PowerShell `make check` quirk** on the Greek folder name (carry-over from S-009). Documented workaround: invoke `ruff`, `mypy`, `pytest`, `tsc`, `jest` directly. The S-011 LOG records actual invocations.
- **No real network during tests.** All JWKS interactions in tests go through an injectable `JWKSProvider` (per ADR-0015 Round 1 engineering-manager point #1). Zero new outbound surface in CI.
