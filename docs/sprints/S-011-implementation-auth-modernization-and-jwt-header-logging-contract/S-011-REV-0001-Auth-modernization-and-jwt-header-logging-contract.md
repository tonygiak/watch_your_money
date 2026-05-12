# S-011 REV — Auth modernization + JWT header-logging contract

Sprint review per `AGENTS.md` §4.1.5. Sprint type: **implementation**.

## Outcomes

**Definition of done met.** The three hard-ordered backlog items (BLG-0023 + BLG-0024 + BLG-0025) shipped together in one PR per ADR-0015 §8 + ADR-0016 §3. The `make check` quality gate is **green at sprint close: 389 / 389 tests across 21+ suites** (346 → 389, +43).

### BLG-0023 — Asymmetric Supabase JWT verifier

- `backend/app/auth.py` rewritten end-to-end. Hand-rolled verifier covers ES256 + RS256 + HS256-transitional; strict algorithm allowlist; `(alg, key-type)` cross-check matrix rejects `RS256/EC` and `ES256/RSA` mismatches; `alg=none`, unknown KIDs, bad signatures, expired / wrong-audience / wrong-subject claims all rejected via the existing RFC-7807 envelope.
- `CachedJwksProvider` shipped: 600 s TTL (configurable via `SUPABASE_JWKS_CACHE_TTL_SECONDS`); 60 s refetch-floor applied to every refetch attempt (forced or not) per ADR-0015 §3 DoS protection; serves stale keys on transient fetch failure if a cache exists; hard-fail-401 only when no cache exists.
- `app/services/jwks_provider.py` wires the production singleton into FastAPI DI; `reset_jwks_provider_for_testing()` ships as the test escape hatch.
- One new dep: `cryptography==45.0.1`. PyJWT explicitly rejected per ADR-0015 §2.
- Five route files migrated to the new DI pattern (`receipts`, `insights`, `receipt_tag`, `users`, `exports`); each keeps `get_jwt_secret` returning the legacy HS256 secret to preserve existing test overrides, adds `get_jwks_provider`, and calls `verify_supabase_jwt(token, jwks_provider=…, legacy_hs256_secret=…)`. The 401 envelope is **unchanged**.
- Config additions: `SUPABASE_JWKS_URL`, `SUPABASE_JWKS_CACHE_TTL_SECONDS`, `SUPABASE_JWT_LEGACY_HS256_SECRET`. Boot-time conflict detection between the new and deprecated env vars.
- Tests: `backend/tests/auth/test_jwt.py` 9 → 39 (+30); line coverage on `app/auth.py` ≥ 95% per ADR-0015 §6 acceptance.

### BLG-0024 — Mobile soft auth-error handling

- `mobile/src/screens/scanner/state.ts` adds `auth_error_recoverable` + `auth_error_terminal` states + `hasAttemptedAuthRefresh` flag + `RETRY_AFTER_REFRESH` action. The first 401 on a scan transitions to recoverable; the second (after a refresh attempt) transitions to terminal.
- `mobile/App.tsx` exposes a `refreshSession` `useCallback` wrapping `supabase.auth.refreshSession()` + the resulting session update; passed as a prop to `ScannerScreen`.
- `mobile/src/screens/ScannerScreen.tsx` reacts to `auth_error_recoverable` via `useEffect`, calls `refreshSession`, and dispatches `RETRY_AFTER_REFRESH` on success or `onAuthError` on terminal failure. UI renders a non-blocking "Refreshing session…" overlay during the recoverable state.
- New i18n string `scanner.error.auth.refreshing` in Greek (`"Επαναφορά σύνδεσης…"`) + English (`"Refreshing session…"`).
- Tests: 4 new transitions in `mobile/__tests__/screens/scanner/state.test.ts`; telemetry event mappings updated.

### BLG-0025 — JWT-rejection diagnostic log line formalized

- `backend/app/auth.py:extract_header_metadata(token: str | None) -> dict` extracted from the inline header parsing in `jwt_exception_handler`. Returns only PII-safe fields: `alg`, `typ`, `kid` truncated to `first 6 chars + "…"`. Handles `None` and malformed tokens by returning `None` for the relevant fields without raising.
- `backend/app/routes/receipts.py:jwt_exception_handler` now calls `extract_header_metadata` and emits exactly one log line per `JwtError` with `code` + `alg` + `typ` + `kid` (truncated) + static `reason`.
- `backend/tests/test_auth_logging.py` (new, 9 tests) implements the ADR-0016 §3 contract: pins the log-line shape across every `JwtError` subclass; pins `kid` truncation format; asserts malformed tokens log `None` for header fields without crashing; **runs a redaction regex** across every captured log record to prove the full token, `Bearer ` prefix, payload claims (`email`, `phone`, `sub`), and the raw `Authorization` header value never appear in logs.
- ADR-0002 §1 superseded by ADR-0015; ADR-0002 §6 amended by ADR-0016.

### Documentation + runbooks

- `docs/runbooks/rotate-supabase-jwt-signing-keys.md` (new) — operator procedure to switch the Supabase project from Legacy HS256 to JWT Signing Keys (ES256) once BLG-0023 is verified in staging.
- `docs/runbooks/rollback-to-hs256-only.md` (new) — emergency rollback to Legacy HS256 if the asymmetric path misbehaves in production.
- `backend/.env.example` updated with the three new env vars and a deprecation note on `SUPABASE_JWT_SECRET`.
- `AGENTS.md` §2.6 (one new bullet for BLG-0023 + BLG-0024 + BLG-0025) + §2.7 (snapshot rolled forward).
- `docs/plan.md` rewritten (S-011 → "Where we are right now"; S-012 → "Next sprint").
- `docs/done.md` Sprint S-011 entry written.
- `docs/backlog.md` updated (BLG-0023 / 0024 / 0025 moved to HTML-commented historical blocks; the prelude paragraph credits S-011).

## `make check` posture at sprint close

- Backend: 186 / 186 (143 → 186, +43: +30 in `tests/auth/test_jwt.py`, +9 in `tests/test_auth_logging.py`, +4 across smaller test additions and updates).
- Mobile: 203 / 203 (existing suite, +4 transitions added to `state.test.ts`).
- **Total: 389 / 389 across 21+ suites — green.**

Quality gate met per `AGENTS.md` §4.7. PowerShell + Greek-folder `make` quirk worked around by direct binary invocations (`ruff`, `mypy`, `pytest`, `tsc`, `jest`), as documented in `S-009-UREV-0001`.

## Sign-offs recorded (per `AGENTS.md` §4.11)

- `agent-safety-officer` + `engineering-manager` — new runtime dependency (`cryptography==45.0.1`, pinned, single direct dep).
- `architect` + `engineering-manager` — API DI shape change (401 envelope unchanged; internal contract per ADR-0015).
- `product-designer` + `localization-specialist` — new mobile UX state + i18n string.
- `security-privacy-officer` — runbooks + rollback path; auth-flow change.
- `agent-safety-officer` — redaction-regex coverage list in `test_auth_logging.py`.

## Learnings

- **The `(alg, key-type)` cross-check matrix is the highest-leverage line in the verifier.** A confused-deputy attack on a JWT library that trusts the header `alg` blindly is the classic JWT-library CVE. ADR-0015 §2's "hand-rolled, not PyJWT" decision pays off here because the matrix is a single function, ≤ 20 lines, and trivially testable in isolation. Future country adapters and any future webhook signing should mirror this pattern.
- **JWKS rate-limit on *every* refetch attempt** (not just unforced ones) — even when the verifier explicitly asks for a refresh after a KID miss. The first test draft assumed forced refreshes bypass the rate-limit; the production logic correctly does not. Recorded as a design intent in the LOG so future debugging recognizes "I asked for a refresh and didn't get one" as the safety net, not a bug.
- **`B008` is a real linter rule.** FastAPI's "put `Depends()` in default values" is the canonical example everyone learns. The `Annotated`-via-type-alias workaround (`JwksProviderDep = Annotated[JWKSProvider | None, Depends(get_jwks_provider)]`) is the supported FastAPI pattern; lock it into `.agents/rules/code-conventions.md` for the next sprint that adds a DI parameter.
- **Test fixtures that hold real signing keys** are the only PII-adjacent artifact this sprint touched. The EC + RSA keypair fixtures in `tests/auth/test_jwt.py` are generated in-process at test-time; nothing is committed. Recorded for `security-privacy-officer`'s reference — these are *not* "real Supabase keys" and never were.
- **The "log only public header fields" contract works because JWT headers are by spec public.** ADR-0016 §2 captures this; the redaction regex test enforces it. The same principle will apply to the AADE / Epsilon Net adapter diagnostic logs in S-012: log the QR family, log the document-number prefix if any, never log the SIG hex or the full QR payload.

## Follow-ups added to backlog / carried

- **BLG-0030 / BLG-0027 / BLG-0028 / BLG-0032** — carried to S-012 unchanged; all gated on consented fixtures or on each other per ADR-0014 §6.
- **BLG-0034 (HS256 retirement)** — stays planned. Gate: BLG-0023 must run one full production release cycle (≥ one S-012 / S-013 deploy) without auth-related incidents before BLG-0034 is pulled.
- **Supabase JWT-key rotation** — scheduled for the S-012 deploy window per `docs/runbooks/rotate-supabase-jwt-signing-keys.md` now that the verifier is live and ≥ 95% covered.
- **No new BLGs spawned this sprint.** Two minor follow-ups worth tracking but small enough to land as comments on the runbooks themselves: (a) once Supabase ships an admin API for forcing JWKS rotation, the runbook should call it; (b) once the asymmetric verifier has been live for a quarter, evaluate dropping the in-process JWKS cache TTL from 600 s → 300 s to tighten the key-revocation window.

## Decision for the next sprint

- **Type**: implementation.
- **Number**: S-012.
- **Theme**: first GR adapter expansions (BLG-0030 → BLG-0027 → BLG-0028 → BLG-0032). Operator step: rotate Supabase project to ES256/JWKS during the deploy window.
- **Rationale per §4.1.2**: Ready queue is non-empty; the four Ready items have well-understood gating order (BLG-0030 gates BLG-0027; BLG-0028 is independent; BLG-0032 can ship shape ahead of either adapter); `make check` must stay green at sprint close.

Sprint closed.
