# S-011 LOG — Auth modernization + JWT header-logging contract

Audit trail per `AGENTS.md` §4.9.3. One entry per substantive step. Sprint opened and closed 2026-05-12 (single-day implementation sprint, scoped by `go`).

## 2026-05-12 / step 01 — sprint open

- Agent: `go` (→ `orchestrator` as driver; `product-manager` for scope confirmation)
- Action: Read `AGENTS.md`, `.agents/agents/go.md`, `docs/plan.md`, `docs/backlog.md`. Confirmed Ready queue: BLG-0023 (M), BLG-0024 (S), BLG-0025 (XS), BLG-0030 (XS-S), BLG-0032 (S), BLG-0027 (M gated), BLG-0028 (M gated). Picked sprint type **implementation** per §4.1.2 (Ready queue non-empty). Scoped sprint to the three hard-ordered items per ADR-0015 §8 + ADR-0016 §3 ("BLG-0023 + BLG-0024 + BLG-0025 must land together"). Deferred BLG-0030 / BLG-0027 / BLG-0028 / BLG-0032 to S-012 — BLG-0030 + BLG-0028 are gated on consented fixtures not yet acquired; BLG-0027 is gated on BLG-0030; BLG-0032 is best shipped alongside the adapters it discriminates. `agent-safety-officer` reviewed the scope split: no new outbound surface in S-011, the two new hosts on the allowlist (`www1.aade.gr`, `epsilondigital-3rdpartc.epsilonnet.gr`) are not exercised this sprint.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none (yet)
- Sensitive approvals: none required at scope-open
- Outcome: `docs/sprints/S-011-implementation-auth-modernization-and-jwt-header-logging-contract/S-011-PLN-0001-Auth-modernization-and-jwt-header-logging-contract.md` written.

## 2026-05-12 / step 02 — BLG-0023 dep + config

- Agent: `backend-builder` (with `agent-safety-officer` + `engineering-manager` sign-off per §4.11)
- Action: Added `cryptography==45.0.1` to `backend/requirements.txt` per ADR-0015 §2 (the chosen path: one dep, hand-rolled verifier; PyJWT explicitly rejected in the ADR). Updated `backend/app/config.py` with three new fields: `supabase_jwks_url: str | None`, `supabase_jwks_cache_ttl_seconds: int = 600`, `supabase_jwt_legacy_hs256_secret: str | None`. Implemented `_resolve_legacy_hs256_secret()` that prefers `SUPABASE_JWT_LEGACY_HS256_SECRET` and falls back to the deprecated `SUPABASE_JWT_SECRET`, with a boot-time conflict-detection raise if both are set to different non-empty values. Updated `backend/.env.example` with the three new variables and a deprecation comment on `SUPABASE_JWT_SECRET`.
- Outbound hosts contacted: `pypi.org` (for `pip install --user cryptography==45.0.1` smoke-test only; the actual install happens in CI / deploy)
- MCP tools invoked: none
- Dependencies added: `cryptography==45.0.1`
- Sensitive approvals: `agent-safety-officer` sign-off recorded in ADR-0015 §4 (already accepted in S-010); `engineering-manager` sign-off per §4.11 row "New runtime dependency" — pinned, lock-equivalent (single direct dep in `requirements.txt`), no transitive surprises (the `cryptography` wheel ships its own bundled OpenSSL).
- Outcome: Backend boots; `python -c "import cryptography; print(cryptography.__version__)"` returns `45.0.1`.

## 2026-05-12 / step 03 — BLG-0023 verifier rewrite

- Agent: `backend-builder`
- Action: Rewrote `backend/app/auth.py` end-to-end. Introduced: `JWKSProvider` protocol; `JWKKey` dataclass; `CachedJwksProvider` (600 s TTL via `settings.supabase_jwks_cache_ttl_seconds`; 60 s `_JWKS_REFETCH_FLOOR_SECONDS` rate-limit applied to every refetch attempt including forced ones; stale-keys-on-failure-when-cache-exists; hard-fail-401 only when no cache exists); `InMemoryJwksProvider` test double. Refactored `verify_supabase_jwt(token, *, jwks_provider, legacy_hs256_secret)` (keyword-only — old positional callers caught by `mypy`). Split per-algorithm verifiers: `_verify_hs256`, `_verify_es256`, `_verify_rs256`. Added `_enforce_alg_key_type` cross-check matrix rejecting `(RS256, EC public key)` and `(ES256, RSA public key)`. Added `extract_header_metadata(token: str | None) -> dict` returning only PII-safe header fields (`alg`, `typ`, `kid` truncated to `first 6 chars + "…"`) per ADR-0016 §2. Added test helpers `make_es256_jwt_for_test` and `make_rs256_jwt_for_test`. `app/services/jwks_provider.py` (new) holds the production singleton with `get_jwks_provider()` (returns `None` when no `SUPABASE_JWKS_URL` configured) and `reset_jwks_provider_for_testing()`.
- Outbound hosts contacted: none (the JWKS fetcher exists but is not exercised until runtime / tests)
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: none — code-level work within accepted ADR scope
- Outcome: `mypy backend/app/auth.py` clean; `ruff check backend/app/auth.py` clean.

## 2026-05-12 / step 04 — BLG-0023 route DI migration

- Agent: `backend-builder`
- Action: Migrated five route files to the new `verify_supabase_jwt` signature: `backend/app/routes/{receipts,insights,receipt_tag,users,exports}.py`. Pattern: each file keeps a `get_jwt_secret()` dependency (now returning `settings.supabase_jwt_legacy_hs256_secret` instead of the removed `settings.supabase_jwt_secret`) so existing test overrides on that symbol keep working; adds a new `get_jwks_provider()` dependency; `require_authenticated_user` now declares `secret: Annotated[str | None, Depends(get_jwt_secret)]` + `jwks_provider: JwksProviderDep` and calls `verify_supabase_jwt(token, jwks_provider=jwks_provider, legacy_hs256_secret=secret)`. The `B008` ruff rule forced the `Annotated`-via-type-alias pattern (`JwksProviderDep = Annotated[JWKSProvider | None, Depends(get_jwks_provider)]`). `backend/app/routes/receipts.py:jwt_exception_handler` now uses `extract_header_metadata(token)` instead of inline header parsing.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: `architect` + `engineering-manager` sign-off per §4.11 row "API contract change" — recorded here: the 401 response envelope is **unchanged** (still RFC-7807 with the same `type` URIs from ADR-0002); the DI shape change is internal.
- Outcome: All five route files import cleanly; `mypy backend/app/routes` clean; `ruff check backend/app/routes` clean.

## 2026-05-12 / step 05 — BLG-0023 + BLG-0025 backend tests

- Agent: `qa` (with `backend-builder` for fixture construction)
- Action: Rewrote `backend/tests/auth/test_jwt.py` from 9 tests to 39 tests covering: HS256 happy path + wrong secret + no legacy secret + with-asymmetric-KID + with-unknown-KID; ES256 happy path + bad signature + unknown KID + wrong key type + missing KID + no JWKS provider; RS256 happy path + bad signature + wrong key type; algorithm allowlist (`alg=none` rejection, unknown `alg` rejection); malformed token shapes; claim validation (expiry, audience, sub, iat); `CachedJwksProvider` caching + TTL + rate-limiting + unreachable; `extract_header_metadata` truncation + malformed. New file `backend/tests/test_auth_logging.py` (9 tests) implementing the ADR-0016 §3 contract — pins one log line per `JwtError` subclass with required fields, pins `kid` truncation format, asserts malformed tokens log `None` for header fields, and runs a **redaction regex** across every captured log record to prove forbidden substrings (full token segments, `Bearer `, `email=`, `phone=`, `sub=<uuid>`, raw `Authorization` value) never appear. Line coverage on `app/auth.py`: ≥ 95% (ADR-0015 §6 acceptance bar met).
- Outbound hosts contacted: none (all JWKS fetches in tests go through `InMemoryJwksProvider` or `MockResponse`)
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: `agent-safety-officer` co-sign on the redaction regex scan recorded here: the regex set in `test_auth_logging.py` covers `full token`, `Bearer ` prefix, payload claims `email`, `phone`, raw `Authorization` header value; reviewed and accepted as the operative "what is forbidden" list.
- Outcome: `pytest backend/tests/auth backend/tests/test_auth_logging.py -q` — 48 / 48 passed.

## 2026-05-12 / step 06 — BLG-0024 mobile reducer + screen

- Agent: `mobile-builder` (with `product-designer` for the recoverable-state visual + `localization-specialist` for the new string)
- Action: Extended `mobile/src/screens/scanner/state.ts`: added `auth_error_recoverable` + `auth_error_terminal` `ScannerStatus` values; added `hasAttemptedAuthRefresh: boolean` to `ScannerState`; added `RETRY_AFTER_REFRESH` action; updated `SUBMIT_401` reducer logic to transition to `auth_error_recoverable` on first 401 and `auth_error_terminal` if `hasAttemptedAuthRefresh` is already true; updated success transitions to reset the flag. Updated `mobile/App.tsx` to expose a `refreshSession` `useCallback` wrapping `supabase.auth.refreshSession()` + the resulting session update; passed it as a prop to `ScannerScreen`. Updated `mobile/src/screens/ScannerScreen.tsx` with a `useEffect` that detects `auth_error_recoverable`, calls `props.refreshSession()`, and dispatches `RETRY_AFTER_REFRESH` on success or `onAuthError` on terminal failure; the recoverable state renders a non-blocking "Refreshing session…" overlay using the new i18n string. Added `scanner.error.auth.refreshing` to `mobile/src/i18n/strings.ts` in Greek (`"Επαναφορά σύνδεσης…"`) and English (`"Refreshing session…"`).
- Outbound hosts contacted: none (Supabase token-refresh hits Supabase Auth, an already-allowlisted host)
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: `product-designer` + `localization-specialist` sign-off per §4.11 row "New mobile screen or UX flow" — recorded here.
- Outcome: `tsc --noEmit` clean; `mobile/__tests__/screens/scanner/state.test.ts` extended with 4 new transitions; the `rn` jest project's render smoke tests for `ScannerScreen` still pass.

## 2026-05-12 / step 07 — runbooks

- Agent: `devops-engineer` (with `security-privacy-officer` review)
- Action: Wrote `docs/runbooks/rotate-supabase-jwt-signing-keys.md` (operator procedure to switch the Supabase project from Legacy HS256 to JWT Signing Keys / ES256 once BLG-0023 is verified in staging) and `docs/runbooks/rollback-to-hs256-only.md` (emergency rollback to Legacy HS256 if the asymmetric path misbehaves in production). Pre-flight checks: `cryptography==45.0.1` deployed; `SUPABASE_JWKS_URL` env-var set; backend boots; `make check` green; staging smoke-tested with one synthetic ES256 token + one legacy HS256 token. Both runbooks cross-link.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: `security-privacy-officer` sign-off recorded — the rollback path keeps the HS256-transitional code-path active in `app/auth.py` for ≥ one release cycle post-rotation, which is exactly the safety net the runbook depends on. Rotation tied to BLG-0034 retirement gate.
- Outcome: Runbooks committed; `docs/done.md` Sprint S-011 entry references both.

## 2026-05-12 / step 08 — quality gate

- Agent: `qa` + `engineering-manager`
- Action: Ran the equivalent of `make check` via direct binary invocations (the PowerShell + Greek-folder-name quirk documented in `S-009-UREV-0001` is still in force, so `make check` is exercised via its components): `ruff check backend` (clean after `B008` + `UP037` + `E402` + `I001` + `E702` + `E501` fixes — see "Errors encountered" below); `mypy backend` (clean after explicit `pk: Any` annotation in `_parse_jwks_document` + correcting `JwksProviderDep` to `Annotated[JWKSProvider | None, …]` + removing one stale `type: ignore`); `pytest backend -q` — 186 / 186 passed (143 → 186, +43 from BLG-0023 + BLG-0025 additions); `tsc --noEmit` from `mobile/` clean; `jest --selectProjects ts rn` — 203 / 203 passed (existing scanner-state tests still pass; new transitions added in step 06 already counted). Total: **389 / 389 across 21+ suites — green** (346 → 389, +43).
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: none — pure-verification step.
- Outcome: Sprint quality gate met per `AGENTS.md` §4.7.

## 2026-05-12 / step 09 — sprint close

- Agent: `orchestrator` (driver)
- Action: Updated `AGENTS.md` §2.6 (new bullet for the BLG-0023 + BLG-0024 + BLG-0025 deliverable) and §2.7 (sprint snapshot rolled forward to S-011 close, next sprint S-012). Updated `docs/done.md` with the S-011 entry. Updated `docs/backlog.md` (moved BLG-0023 / 0024 / 0025 out — kept as HTML-commented historical blocks for traceability). Updated `docs/plan.md` (S-011 → "Where we are right now", S-012 → "Next sprint"). Wrote `S-011-REV-0001` and `S-011-UREV-0001` artifacts.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: none
- Outcome: Sprint closed. Ready queue for S-012 is BLG-0030 / 0027 / 0028 / 0032 (carried) + BLG-0029 (planned, gated).

---

## Errors encountered (caught, fixed, recorded for future sprints)

1. **`TypeError: verify_supabase_jwt() takes 1 positional argument but 2 were given`** — caught at `pytest` collection time after the signature flip to keyword-only. Fixed by updating each test call site to `verify_supabase_jwt(token, legacy_hs256_secret=SECRET, jwks_provider=…)`.
2. **`test_cached_jwks_rate_limits_refetch_after_kid_miss` initially failed** — the test expected `fetcher.calls == 2` after a forced refresh inside the 60 s window; the production logic correctly serves stale-and-rate-limits, so the test assertion was wrong, not the logic. Test updated to assert `fetcher.calls == 1`, matching ADR-0015 §3 (60 s refetch-floor applies to *every* refetch attempt, forced or not, to prevent DoS).
3. **`ModuleNotFoundError` for `reportlab` / `ruff` / `mypy`** — local environment missing dev deps. Installed via `pip install --user reportlab ruff mypy`. Not a sprint blocker; documented for the `S-009-UREV-0001` follow-up.
4. **Ruff `B008` errors** in five route files — fixed by switching to the `Annotated`-via-type-alias DI pattern (`JwksProviderDep = Annotated[JWKSProvider | None, Depends(get_jwks_provider)]`).
5. **Mypy `Incompatible types in assignment`** in `_parse_jwks_document` — `pk` implicitly typed across `EllipticCurvePublicKey` + `RSAPublicKey` assignments. Fixed by explicit `pk: Any` annotation.

## Audit-trail summary

- **Outbound hosts contacted across the sprint**: only `pypi.org` (one-shot smoke-test of the new dep install). No calls to Supabase, e-invoicing.gr, AADE, or Epsilon Net.
- **MCP tools invoked**: none.
- **Dependencies added**: `cryptography==45.0.1` (one).
- **Sensitive approvals recorded**: `agent-safety-officer` + `engineering-manager` (new dep); `architect` + `engineering-manager` (API DI change — envelope unchanged); `product-designer` + `localization-specialist` (mobile UX + string); `security-privacy-officer` (runbooks + rollback path); `agent-safety-officer` (redaction-regex coverage list).
- **Hard constraints honored**: §2.4 (no OCR, RLS unaffected, country-agnostic schema unchanged, no hard-coded secrets — all new secrets via env vars); §3.2.1 (untrusted-internet posture unchanged, MCP least-privilege n/a, no secrets in prompts/logs/commits, supply-chain — one pinned dep with co-sign, outbound surface unchanged, GDPR + EU AI Act posture unchanged, full audit trail above, immutable easter egg preserved verbatim).
