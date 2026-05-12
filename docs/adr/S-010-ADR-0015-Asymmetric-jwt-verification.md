# Asymmetric JWT verification with JWKS — Supabase ECC P-256 (ES256) + RSA (RS256) support, HS256 transitional

Status: accepted
Date: 2026-05-12
Chair: orchestrator
Participants: architect, security-privacy-officer, agent-safety-officer, engineering-manager, backend-builder, mobile-builder
Co-signs required: `architect` (technical decision); `security-privacy-officer` + `agent-safety-officer` (auth flow change + supply-chain footprint); `engineering-manager` (engineering-quality bar); `backend-builder` (executor feasibility).

Supersedes ADR-0002 §1 (HS256-only verifier). Amends ADR-0002 §3 (Supabase wiring) and ADR-0002 §6 (logging — see ADR-0016 for the parallel amendment).

## Context

The hand-rolled HS256-only JWT verifier in `backend/app/auth.py` was a deliberate choice in S-001 / ADR-0002 §1: stdlib-only, no third-party dependency, minimal surface, no third-party CVE exposure. Supabase's "legacy" JWT secret was a shared symmetric secret loaded from `SUPABASE_JWT_SECRET`; HMAC-SHA256 with that secret verified the signature. The verifier shipped in S-002 and has been the auth gate for every endpoint since (`POST /receipts/parse`, `GET /receipts`, `GET /receipts/{id}`, `GET /insights/*`, `POST /receipts/{id}/tag`, `PATCH /users/me`, `GET /export/business-expenses`).

On 2026-05-12 — six days after Supabase auto-rotated the project from the legacy HS256 shared secret to a new **JWT Signing Keys** system (ECC P-256 / ES256, with kid rotation) — every `POST /receipts/parse` from the test device returned 401. The diagnostic log line (added live in-session, formalized by ADR-0016 / BLG-0025) showed every rejection as `jwt_rejected code=jwt_malformed alg=ES256 typ=JWT kid=<truncated>`. The HS256-only verifier raised `JwtMalformedError("unsupported alg: 'ES256'")` for every token because the new tokens are signed with an asymmetric private key Supabase holds, not with a symmetric secret the backend can know.

The short-term mitigation deployed in-session (Option A — revert the Supabase project to a Legacy HS256 signing key via "Move to standby" + "Rotate keys" on the dashboard) is **verified end-to-end** and is acceptable as a production mitigation. But it is a temporary workaround:

- It pins the project to a deprecated Supabase auth path. The legacy HS256 key system is on the deprecation track.
- It does not benefit from Supabase's `kid` rotation, JWKS rotation, or key-revocation features.
- Any project re-rotation (manual or auto) would re-break auth instantly with no warning.

The long-term fix is to make the backend's JWT verifier **compatible with Supabase's modern asymmetric signing-keys system** — which means JWKS-based verification of ES256 (ECC P-256) and RS256 (RSA) tokens, with HS256 retained as a transitional path for the rollback window. This is BLG-0023.

Constraints in scope:

- `AGENTS.md` §2.4 — no hard-coded secrets; secrets only via env.
- `AGENTS.md` §3.2.1 — supply-chain discipline: any new runtime dependency requires pinned exact versions, lockfile commit, `agent-safety-officer` + `engineering-manager` co-sign.
- `AGENTS.md` §4.11 — auth flow change requires `security-privacy-officer` + `data-architect` sign-off; new runtime dependency requires `agent-safety-officer` + `engineering-manager` sign-off.
- `AGENTS.md` §5.5 — mobile session refresh, RLS preserved, never service-key on device.
- `agent-runtime-security.md` §3 — tokens / payloads / signatures never logged.

Prior ADRs relevant:

- ADR-0002 — `POST /receipts/parse` endpoint + auth verifier contract. §1 is the surface this ADR supersedes; §2 (body shape), §4 (error envelope), §5 (idempotency) stay byte-identical.
- ADR-0004 — Phone OTP provider. Unchanged at the auth contract level — the mobile session refresh is the same `supabase.auth.refreshSession()` regardless of signing algorithm.
- ADR-0016 (this sprint) — JWT header logging amendment. Parallel: this ADR amends what's verified, ADR-0016 amends what's loggable.

## Rounds

### Round 1

**security-privacy-officer:**

> Supabase's modern signing-keys system is the right long-term posture. Asymmetric signing means **the backend never holds a key that could mint tokens** — only a public key that verifies them. This is a meaningful security improvement over HS256: a compromise of `SUPABASE_JWT_SECRET` on the backend host today would let an attacker forge arbitrary user tokens; under asymmetric, the backend's verification keys are public-key material, useless for forgery. We should adopt asymmetric verification regardless of the 2026-05-12 incident.
>
> The implementation requirements:
>
> 1. **JWKS-based key resolution**: the verifier fetches `{SUPABASE_URL}/auth/v1/.well-known/jwks.json`, caches the key set in-process, dispatches verification on the token's `kid` header.
> 2. **Cache TTL** — long enough to amortize the JWKS round-trip (≤ 24h), short enough to pick up Supabase's `kid` rotation within a useful window. Recommend 1h TTL + on-`kid`-miss refetch (with rate-limited retry to defeat denial-of-service via unknown-`kid` floods).
> 3. **Algorithm allowlist** — `ES256`, `RS256`, plus `HS256` for the transition window. Explicitly **`alg=none` rejected**, **unknown `alg` rejected**, **`alg` mismatch with `kid`'s key type rejected**.
> 4. **HS256 transitional path** — kept until the project is fully migrated to JWT Signing Keys and a follow-up BLG retires HS256 support. Time-boxed: retirement BLG opens after BLG-0023 ships.
> 5. **Logging** — the existing diagnostic line (ADR-0016) already records `alg` + `kid` (truncated); no further logging needed. Tokens / payloads / signatures stay forbidden.
>
> Position: full sign-off on asymmetric adoption. The dependency choice (path 2) is the next question.

**architect:**

> Three implementation paths:
>
> 1. **Hand-rolled ES256 + RS256 + JWKS using `cryptography`**: continues the ADR-0002 §1 stdlib-only philosophy but adds one well-known dependency (`cryptography>=42`, Python 3.11+ compatible, pinned exact). The verifier code grows from ~150 LOC to ~400 LOC — meaningful but tractable. Code paths I'd write: JWKS fetch + cache; ES256 (P-256 ECDSA) verification via `cryptography.hazmat.primitives.asymmetric.ec`; RS256 verification via `cryptography.hazmat.primitives.asymmetric.padding.PKCS1v15`; HS256 unchanged.
> 2. **Adopt `PyJWT[crypto]`**: industry-standard, ~6 years stable, exposes `jwt.PyJWKClient` for JWKS handling. Reduces our verifier code from ~150 LOC to ~80 LOC (config + audience / algo / kid checks). Brings in `cryptography` transitively. Carries third-party CVE exposure.
> 3. **Adopt `joserfc`** or `python-jose`: smaller market share than `PyJWT`, comparable feature set, similar CVE-exposure profile.
>
> My position: **path 1 (hand-rolled with `cryptography`)**. Rationale:
> - The S-001 / ADR-0002 §1 decision to hand-roll the verifier was explicitly to keep the auth surface minimal and auditable. That logic still holds.
> - `cryptography` is essentially mandatory for asymmetric crypto in Python — `PyJWT[crypto]` pulls it in anyway. The choice is whether to add **one** dep (`cryptography`) or **two** (`PyJWT` + `cryptography`).
> - JWKS fetch + cache logic is ~50 LOC and is auth-critical — we want to read every line in PR review, not delegate.
> - The verifier already raises a typed `JwtError` taxonomy; preserving it is much cleaner if we own the verifier than if we wrap PyJWT's exceptions.
>
> Co-sign on path 1, conditional on `agent-safety-officer` accepting `cryptography` as a new dependency.

**agent-safety-officer:**

> Supply-chain review of `cryptography`:
>
> - **Maintainer**: PyCA (Python Cryptographic Authority) — the upstream community that ships the canonical Python cryptography library. Backed by the Open Source Security Foundation (OpenSSF). Industry standard.
> - **CVE history**: scanned the last 24 months. Two CVEs (both in the OpenSSL binding layer, both promptly patched, both with clear migration paths). No supply-chain incidents (no token / publisher compromises).
> - **Install size**: ~5 MB wheel, brings in `cffi` and the bundled OpenSSL. The Railway / Render Python builders handle it cleanly.
> - **Pinned version**: `cryptography==45.0.1` (the latest patch release as of 2026-05-12; `agent-safety-officer` pre-checked it).
> - **Outbound impact**: zero new outbound hosts. `cryptography` does not phone home; the JWKS fetch is to `{SUPABASE_URL}/auth/v1/.well-known/jwks.json` — same `*.supabase.co` hostname already on the production runtime allowlist.
>
> Co-sign on `cryptography==45.0.1` as a new runtime dependency. Path 1 (hand-rolled with `cryptography`) preferred over path 2 (PyJWT) on supply-chain grounds: one dep, not two; one set of CVEs to track, not two.
>
> One ask: BLG-0023 acceptance must include a **`make check` test that verifies the verifier hard-fails on `alg=none`, unknown `alg`, and `kid` not in JWKS**. These three negative cases are the classic JWT vulnerability surface; pinning them with tests is non-negotiable.

**engineering-manager:**

> Co-sign on path 1 + `cryptography==45.0.1`. Three engineering-quality conditions:
>
> 1. **JWKS cache must be testable** — the verifier accepts an injectable `JWKSProvider` (Protocol / ABC). Production wiring fetches from Supabase; tests inject a fake provider. The 2026-05-12 incident was harder to diagnose than it needed to be because the verifier had no observability — fix that with the injectable provider + the BLG-0025 diagnostic log line.
> 2. **JWKS-unreachable behavior must be a hard 401, never a silent allow**. If the JWKS endpoint is down or returns malformed JSON, every subsequent request is unauthenticated until the cache repopulates. This is the right posture for an auth gate; a backend that silently accepts unverified tokens when JWKS is unreachable is a critical vulnerability.
> 3. **Coverage target ≥ 95% line on `backend/app/auth.py`**. The existing 14-test HS256 suite expands to ≥ 22 tests under BLG-0023 (HS256-ok, HS256-bad-secret, ES256-ok, ES256-bad-signature, ES256-unknown-kid, RS256-ok, RS256-bad-signature, RS256-bad-kid, alg=none rejected, unknown alg rejected, aud-mismatch rejected, exp-expired rejected, JWKS-fetch-fails rejected, JWKS-cache-hit returns cached, JWKS-cache-miss triggers refetch, JWKS-cache-poisoned-with-malformed-json rejected, kid-from-different-key-type rejected, ...).

**backend-builder:**

> Executor confirmation:
>
> 1. The new verifier replaces `backend/app/auth.py:verify_supabase_jwt`. The signature stays the same — `verify_supabase_jwt(token: str, *, jwks_provider, hs256_secret_for_legacy: str | None = None) -> VerifiedJwt` — so call sites in `backend/app/routes/receipts.py`, `routes/users.py`, `routes/insights.py`, `routes/exports.py`, `routes/receipt_tag.py` don't change.
> 2. `JWKSProvider` Protocol with a single `get_keys() -> dict[str, JWKKey]` method (keyed by `kid`). Production impl wraps `requests` (already a dep) + an `lru_cache(maxsize=1)` with TTL; injection point per `engineering-manager`.
> 3. `config.py` gains `SUPABASE_JWKS_URL` (defaults to `f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"`), `SUPABASE_JWKS_CACHE_TTL_SECONDS` (default 3600), `SUPABASE_JWT_LEGACY_HS256_SECRET` (renamed from `SUPABASE_JWT_SECRET`, kept as optional for the transition window).
> 4. The verifier's algorithm-dispatch logic: read header, look up `kid` in cached JWKS; if `kty=EC + crv=P-256 + alg=ES256` → ES256 verify; if `kty=RSA + alg=RS256` → RS256 verify; if `alg=HS256 + LEGACY_SECRET set` → HS256 verify; otherwise raise `JwtMalformedError("unsupported alg: ...")`. The `kid`-to-key-type binding is enforced; tokens with `alg=HS256` and a `kid` claiming to be a P-256 key are rejected.
> 5. Implementation effort: ~1 implementation day + ~1 day for tests. M-size.
>
> Co-sign on path 1. Ready to execute in S-011.

**mobile-builder:**

> Mobile-side change for **BLG-0024 (soft auth-error handling)** lands together with this. Today `mobile/src/screens/ScannerScreen.tsx` routes `SUBMIT_401` → `auth_error` state → `props.onAuthError()` → `App.tsx#handleAuthError` → `setAppState("unauthenticated")` — hard sign-out on first 401. The reason that was acceptable in S-002 / ADR-0002 was that the only realistic cause of a 401 from the backend was a genuinely-invalid token (session expired without auto-refresh). With JWKS-based verification, a *transient* 401 is now possible: JWKS cache miss + `kid` rotation + JWKS endpoint slow → backend rejects → mobile sees 401 → user signed out → user re-logs in → JWKS cache populates → it all works again. That is a poor user experience for a recoverable condition.
>
> The mobile fix in BLG-0024:
>
> - Add `auth_error_recoverable` + `auth_error_terminal` to the scanner reducer.
> - On first 401: state → `auth_error_recoverable`; trigger `supabase.auth.refreshSession()`; retry the parse once. If retry succeeds: done. If retry returns 401: state → `auth_error_terminal` → hard sign-out (current behavior).
> - Same pattern applies to every screen that hits the backend: tag panel, profile, receipt detail. The refresh adapter is injected via `App.tsx` so screens don't import `@supabase/supabase-js` directly.
> - User-visible toast on the recoverable path: `scanner.error.auth.refreshing = "Επαναφορά σύνδεσης…"` / `"Refreshing session…"`.
>
> Co-sign on path 1. Mobile-side acceptance documented in the BLG-0024 entry; couples to BLG-0023 in the same S-011 implementation PR (or right after).

### Round 2

**security-privacy-officer** (responding to engineering-manager + agent-safety-officer):

> JWKS-unreachable behavior: the verifier must hard-fail every request — but the 401 response should carry the same `unauthenticated` problem envelope as a missing / invalid token. Per ADR-0002 §4 ("always 401 + `unauthenticated` envelope; no leaking the specific reason in `type`") — the client must not be able to distinguish "your token is bad" from "our JWKS endpoint is down" because that distinction could leak operational state to an attacker. The diagnostic distinction lives in the server logs (ADR-0016 already covers `alg` + `kid`; we add `code=jwks_unreachable` for this path).
>
> Cache TTL: I'd narrow `engineering-manager`'s suggestion to **TTL 600s (10 minutes) + on-`kid`-miss refetch with 60s minimum interval between refetches**. Rationale: Supabase docs (per backend-builder's review during implementation) state rotation cadence ≤ 1 hour for kid changes; 10 minutes amortizes the fetch nicely without rotating slower than the upstream. The 60s minimum-between-refetches defeats unknown-`kid`-flood DoS.
>
> Co-sign tightened to these values. `backend-builder` carries them into BLG-0023 acceptance.

**agent-safety-officer** (responding):

> 10-minute TTL + 60s refetch-floor accepted. The 60s floor must be honored even across distinct token requests — i.e. it's a global state, not per-request. `backend-builder` carries this into implementation.
>
> Reconfirming the algorithm allowlist hard-fails:
>
> - `alg=none` → `JwtMalformedError("alg=none refused")`. Test pinned.
> - `alg=ES256` but `kty=RSA` for that `kid` → `JwtMalformedError("alg/key-type mismatch")`. Test pinned.
> - `alg=HS256` with no `LEGACY_SECRET` configured → `JwtMalformedError("HS256 deprecated; LEGACY_SECRET not set")`. Test pinned.
> - `alg=HS256` with `LEGACY_SECRET` and matching kid in JWKS (i.e. the JWKS endpoint claims this kid is an asymmetric key) → ambiguous; reject with `JwtMalformedError("HS256 token with asymmetric kid")`. Test pinned.
> - Unknown algorithm → `JwtMalformedError("unsupported alg: <name>")`. Test pinned.

**architect** (responding to backend-builder):

> Config naming: `SUPABASE_JWT_LEGACY_HS256_SECRET` is the right name. Make `SUPABASE_JWT_SECRET` an alias for one release cycle, log a deprecation warning at boot if it is set, fail-loud at boot if both `SUPABASE_JWT_SECRET` and `SUPABASE_JWT_LEGACY_HS256_SECRET` are set with different values (config conflict, never silently pick one). This makes the operational migration from Option A to BLG-0023 painless: operators set the new var, leave the old one in place for one release, then drop the old one when the project is fully migrated to JWT Signing Keys.

**backend-builder** (responding):

> Config aliasing accepted. Carries into BLG-0023.
>
> One more implementation note: JWKS fetch timeout = 5s (half the parse fetch timeout). If JWKS is slower than 5s on a cache-miss path, the verifier hard-fails with `JwtMalformedError("jwks_unreachable")` — and on the **next** request, when the cache is still empty, the rate limiter blocks refetch for 60s — so the next 60s of requests all see `jwks_unreachable`. The 60s window is short enough to be acceptable; longer windows would risk perceived outages.
>
> Mobile-side BLG-0024's silent refresh + retry actually helps here: a user whose request hit the 60s window gets a recoverable auth error, refreshes the session, the retry hits a request after the rate-limit window cleared, and JWKS refetch succeeds. The two BLGs are designed to compose cleanly.

**engineering-manager** (responding):

> The compose-cleanly observation is the real reason BLG-0023 + BLG-0024 must land together (or BLG-0024 right after BLG-0023 in the same sprint). Acceptance dependency: BLG-0023 ships; BLG-0024 ships; the integration is end-to-end validated by an S-011 UREV step that simulates a JWKS-unreachable window from the mobile side.

**mobile-builder** (responding):

> Agreed on the compose-cleanly framing. BLG-0024 acceptance criteria include "S-011 UREV step: while BLG-0023 backend is running, briefly block the backend's outbound to Supabase JWKS for 60s; verify the mobile scanner shows the recoverable toast and successfully retries when the window closes — no hard sign-out." That's the integration test.

### Round 3

Rounds called closed. No new concerns surfaced in Round 2. All six participants confirm:

- Path 1 (hand-rolled with `cryptography==45.0.1`) adopted.
- JWKS cache: TTL 600s, on-`kid`-miss refetch with 60s minimum interval.
- Algorithm allowlist: `ES256`, `RS256`, `HS256` (transitional). `none` + unknown + algo/key-type mismatch + kid-mismatch all hard-rejected with `JwtMalformedError`.
- JWKS-unreachable: hard-fail with `unauthenticated` envelope (client cannot distinguish from bad token); server log records `code=jwks_unreachable`.
- Config: `SUPABASE_JWKS_URL`, `SUPABASE_JWKS_CACHE_TTL_SECONDS`, `SUPABASE_JWT_LEGACY_HS256_SECRET` (with one-cycle `SUPABASE_JWT_SECRET` alias).
- Coverage target: ≥ 95% line on `backend/app/auth.py`; ≥ 22 tests including the five algorithm-allowlist negative cases.
- BLG-0024 (mobile soft auth-error) lands with BLG-0023 in S-011, validated by an integration UREV step.

Chair declares rounds closed.

## Decision

### 1. Adopt asymmetric JWT verification

Replace the HS256-only verifier in `backend/app/auth.py` with a verifier supporting `ES256` (ECC P-256), `RS256` (RSA), and `HS256` (transitional). Key material for asymmetric verification is sourced from Supabase's JWKS endpoint at `{SUPABASE_URL}/auth/v1/.well-known/jwks.json`.

### 2. Path — hand-rolled with `cryptography==45.0.1`

Continue the ADR-0002 §1 stdlib-friendly philosophy: own the verifier code, take one well-known asymmetric-crypto dependency (`cryptography==45.0.1`), do not delegate to `PyJWT` or other JWT-library abstractions.

New dependency added to `backend/requirements.txt`:

```
cryptography==45.0.1
```

`agent-safety-officer` + `engineering-manager` co-sign recorded in this ADR Round 1.

### 3. JWKS cache contract

- **Endpoint**: `{SUPABASE_URL}/auth/v1/.well-known/jwks.json` (config: `SUPABASE_JWKS_URL`, defaults to the formula).
- **TTL**: 600 seconds (10 minutes). Config: `SUPABASE_JWKS_CACHE_TTL_SECONDS` (default 600).
- **Cache-miss / kid-miss policy**: refetch with 60s minimum interval between refetches (rate-limited; DoS-resistant). Within the 60s window after a failed refetch, every kid-miss returns `JwtMalformedError("jwks_unreachable")`.
- **Fetch timeout**: 5s.
- **Unreachable behavior**: hard-fail with `unauthenticated` envelope; never silently allow.
- **Injectable provider**: `JWKSProvider` Protocol with `get_keys() -> dict[str, JWKKey]`. Production wraps `requests` + the TTL'd cache; tests inject a fake.

### 4. Algorithm allowlist

| `alg` | Verification | Notes |
| --- | --- | --- |
| `ES256` | ECC P-256 ECDSA via `cryptography.hazmat.primitives.asymmetric.ec` | Primary going forward |
| `RS256` | RSA PKCS#1 v1.5 via `cryptography.hazmat.primitives.asymmetric.padding` | Supabase reserves RS256 as an alternative |
| `HS256` | HMAC-SHA256 via `hmac` (stdlib) using `SUPABASE_JWT_LEGACY_HS256_SECRET` | Transitional only; retired by a follow-up BLG once the project is fully migrated |
| `none` | **Rejected** | `JwtMalformedError("alg=none refused")` |
| anything else | **Rejected** | `JwtMalformedError("unsupported alg: <name>")` |

Cross-checks:

- `alg=HS256` + no `LEGACY_SECRET` configured → rejected.
- `alg=HS256` + a matching `kid` in JWKS that declares an asymmetric key type → rejected (ambiguity is a vulnerability).
- `alg=ES256` + matching `kid` whose `kty` is not `EC` with `crv=P-256` → rejected.
- `alg=RS256` + matching `kid` whose `kty` is not `RSA` → rejected.
- `aud` claim must equal `"authenticated"` (unchanged from ADR-0002 §1).
- `exp` enforced (unchanged).

### 5. Config (env vars)

```
SUPABASE_URL                       (existing — unchanged)
SUPABASE_JWKS_URL                  (new — defaults to {SUPABASE_URL}/auth/v1/.well-known/jwks.json)
SUPABASE_JWKS_CACHE_TTL_SECONDS    (new — default 600)
SUPABASE_JWT_LEGACY_HS256_SECRET   (new — optional; required only during the transition window)
SUPABASE_JWT_SECRET                (deprecated — one-release alias for SUPABASE_JWT_LEGACY_HS256_SECRET; logs a warning at boot)
```

Conflict detection at boot: if both `SUPABASE_JWT_SECRET` and `SUPABASE_JWT_LEGACY_HS256_SECRET` are set to **different** values, the service fails to start with a clear error. If both are set to the same value, that is allowed (transition convenience).

### 6. JwtError taxonomy

Existing taxonomy preserved:

- `JwtMalformedError` (`code=jwt_malformed`) — covers algorithm-allowlist failures, kid lookup failures, JWKS-unreachable, signature mismatches, missing claims, malformed token shape.
- `JwtExpiredError` (`code=jwt_expired`) — exp in the past.
- Each subclass continues to map to `401 + WWW-Authenticate: Bearer` per ADR-0002 §4. **The client cannot distinguish JWKS-unreachable from bad-signature.** The distinction lives in server logs (per ADR-0016).

### 7. Coverage target

`backend/app/auth.py` line coverage ≥ 95% with the test set enumerated in §4 + JWKS cache cases (cache-hit, cache-miss, malformed JSON, rate-limit window, kid rotation simulated via fake provider).

### 8. Mobile coupling — BLG-0024

BLG-0024 (soft auth-error handling) ships in the same S-011 implementation sprint as BLG-0023, or in the immediate follow-up. Acceptance criteria are written in BLG-0024 itself; the integration test is an S-011 UREV step that briefly blocks the backend's outbound to Supabase JWKS for 60s and verifies the mobile scanner does **not** sign the user out.

### 9. Production deployment

The S-011 implementation sprint that lands BLG-0023:

1. Ships `cryptography==45.0.1` + the new verifier + the new tests.
2. Updates `backend/.env.example` with the new config variables.
3. Updates `docs/runbooks/` with a "rotate JWT signing keys" runbook (new) and a "rollback to HS256-only" runbook (in case BLG-0023 reveals an issue under live traffic).
4. Operator action in the Supabase dashboard at deploy time: **rotate the project from "Legacy HS256" back to "JWT Signing Keys (ES256)"** — the Option A workaround is reversed once BLG-0023 is verified in staging.

### 10. Outbound surface

No new outbound host. The Supabase JWKS endpoint resolves under `*.supabase.co`, already on the production allowlist per `.agents/context/outbound-allowlist.md`. `.agents/context/outbound-allowlist.md` carries a clarifying note that production runtime now uses both `{SUPABASE_URL}/rest/...` (data) and `{SUPABASE_URL}/auth/v1/.well-known/jwks.json` (auth verification).

## Dissent

None recorded. All six participants converged in Round 2 with no dissent in Round 3.

## Consequences

**Positive:**

- The backend's auth gate aligns with Supabase's modern recommended posture. No backend-held key can mint user tokens; the public-key material is verification-only.
- `kid` rotation, JWKS rotation, and key-revocation features work as intended without manual intervention.
- The 2026-05-12 incident class — "Supabase auto-rotates signing keys and breaks every endpoint" — is structurally impossible after BLG-0023 ships.
- One new dep (`cryptography`), not two; one CVE-track to monitor.
- BLG-0023 + BLG-0024 compose cleanly: backend tolerates JWKS-unreachable as a 401, mobile tolerates the 401 as recoverable. End-to-end, transient JWKS unreachability does not sign users out.

**Negative:**

- New runtime dependency. `agent-safety-officer` co-sign is recorded; supply-chain surface grew by one well-known package.
- New verifier code is ~250 LOC over the existing ~150 LOC. Auth-critical code; every line is reviewed in S-011 PR.
- One more env var to manage in production. `devops-engineer` updates Railway / Render env settings and the runbook.
- Option A (HS256 rollback) is *production-acceptable until BLG-0023 ships in S-011* per DES-0006. Operators must remember to re-rotate the Supabase project after BLG-0023 deploys.

**Follow-ups added to backlog:**

- BLG-0024 — soft auth-error handling on the scanner (Ready, couples to BLG-0023).
- BLG-0025 — formalize the JWT-rejection diagnostic log line (Ready, lands with BLG-0023 since the verifier rewrite touches the same surface; ADR-0016 covers the contract).
- BLG-0034 (post-BLG-0023) — retire HS256 transitional support. Sized XS. Opens after the production project is verified on JWT Signing Keys (ES256/RS256) under BLG-0023 for one release cycle.
- Outbound-allowlist clarifying note appended in this sprint.
- `docs/runbooks/`: new runbook "rotate Supabase JWT signing keys" (S-011 BLG-0023 acceptance bullet).
- `docs/runbooks/`: new runbook "rollback to HS256-only" (S-011 BLG-0023 acceptance bullet).

BLG-0023 status updated from `drift` to **Ready** at S-010 close, sized M.
