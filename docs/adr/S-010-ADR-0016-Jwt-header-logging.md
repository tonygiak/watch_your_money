# JWT header logging — ADR-0002 §6 amendment recognizing JWT headers as PII-safe public metadata

Status: accepted
Date: 2026-05-12
Chair: orchestrator
Participants: agent-safety-officer, security-privacy-officer, backend-builder, qa
Co-signs required: `agent-safety-officer` (runtime-security posture per `agent-runtime-security.md` §3); `security-privacy-officer` (user-data flow review); `backend-builder` + `qa` (implementation + test contract).

Amends ADR-0002 §6 (logging). Companion to ADR-0015 (which changes *what* is verified); this ADR changes *what* is loggable on a rejection.

## Context

The 2026-05-12 live debugging session that surfaced Drift A (Supabase ES256 rotation breaking the HS256-only verifier) was diagnosed in **under two minutes** thanks to an ad-hoc log line added to `jwt_exception_handler` in `backend/app/routes/receipts.py`. The line surfaced:

- `code=<JwtError subclass code>` — `jwt_malformed`, `jwt_expired`, etc.
- `alg=<JWT header alg>` — `ES256`, `RS256`, `HS256`, `none`, etc.
- `typ=<JWT header typ>` — `JWT` typically.
- `kid=<truncated to first 6 chars + "…">` — opaque key identifier.
- `reason=<short static error message>` — e.g. `"unsupported alg: 'ES256'"`.

That single log line let the operator instantly see that **every** rejection that day was `alg=ES256` against an HS256 verifier — pointing immediately at the Supabase JWT-key rotation. Without it, the rollback to Option A would have taken hours of bisecting Supabase auth state vs backend code.

The change was deployed in-session as a pre-S-010 patch (visible in `backend/app/routes/receipts.py` lines 287–339 in the working tree). It is currently uncovered by tests and not formally part of any ADR contract. Two questions need an ADR answer before BLG-0025 closes:

1. **Are JWT *header* fields (alg / typ / kid) safe to log?** The original ADR-0002 §6 reads "we only log the URL host (`e-invoicing.gr`) and an opaque `trace_id`" — it predates this kind of auth-diagnostic line. JWT headers are *public by the JWT spec* (RFC 7519 §5): they are base64url-encoded plain JSON, transmitted in clear, are not part of the signature input to be kept secret, and contain no user identity. Logging them is conceptually equivalent to logging the value of a `Content-Type` header.
2. **What MUST NOT be logged?** The full token, the payload (claims — these *are* user-identifying), the signature, and the raw `Authorization` header value.

Constraints:

- `agent-runtime-security.md` §3 (Secrets hygiene): "Never include secrets, tokens, service keys, OTP codes, or user PII in prompts, agent context, logs, ADRs, sprint artifacts, code comments, or commits."
- `AGENTS.md` §4.10 (Failure modes): a suspected secret leak triggers `agent-safety-officer` + `security-privacy-officer` incident response.
- `AGENTS.md` §5.7 (Error handling): backend must surface auth failures clearly without leaking sensitive material.

Prior ADRs relevant:

- ADR-0002 §4 (Error envelope): always 401 + `unauthenticated` envelope; never echo the specific failure reason to the client.
- ADR-0002 §6 (Logging): existing rule "log the URL host and `trace_id`; never log the QR URL or raw HTML."
- ADR-0015 (this sprint, parallel): asymmetric verification adds `JwtMalformedError("jwks_unreachable")` and several new algorithm-allowlist failure modes that all flow through the same `jwt_exception_handler`. The diagnostic line carries them too.

## Rounds

### Round 1

**agent-safety-officer:**

> The classification matters. JWT *headers* are public metadata in the JWT spec sense:
>
> - `alg` — names the signature algorithm. Public by definition (the verifier must read it to dispatch).
> - `typ` — almost always `JWT`. Pure schema metadata.
> - `kid` — opaque identifier pointing into the issuer's key set. By itself reveals **only** "this token was signed with key X." The `kid` is not a secret-adjacent identifier; the secret is the private key the issuer holds. Note the existing in-session change already truncates `kid` to first-6-chars + `"…"` as defense-in-depth — keep that practice even though it is conservative.
>
> What is **not** safe:
>
> - The full token (any segment of `<header>.<payload>.<signature>`).
> - The payload (`sub`, `email`, `phone`, `aud`, `exp`, `iat`, custom claims) — these *are* user PII.
> - The signature — together with the payload it is a forgery primitive.
> - The raw `Authorization` header value — contains the full token.
>
> My position: amend ADR-0002 §6 to explicitly allow header logging (`alg`, `typ`, `kid`-truncated, `code`, static `reason` message) and explicitly forbid payload / signature / token / `Authorization` value. The in-session change is correct in shape; we lock it in with a regression test + a redaction test.

**security-privacy-officer:**

> Concur. One additional consideration: log-aggregator forwarding (Railway / Render → wherever the operator routes logs) may surface these lines to downstream observers. Even so, the listed fields are not PII and are not user-identifying. **`kid`-truncated** is the right belt-and-suspenders posture.
>
> One narrow concern: `reason=<exc message>` could in principle carry implementation detail that leaks more than intended (e.g. a future verifier might raise `JwtMalformedError(f"signature failed for sub=<sub>")` carelessly). Lock down the contract so `reason` is **a static string per JwtError subclass**, never an f-string interpolated with claim values, header values beyond the four listed, or token segments. Test that pins this.
>
> Position: full co-sign with the static-reason constraint.

**backend-builder:**

> Implementation:
>
> - `JwtError.__init__` accepts only static messages defined in the verifier's own code (no f-string interpolation of claim / payload values). This is already mostly true in the existing verifier; ADR-0015 maintains this discipline.
> - `jwt_exception_handler` already extracts header fields safely via base64url decode of part-1 of the token. The `except (ValueError, TypeError)` swallows malformed-header cases silently — if the header can't be decoded, the fields are logged as `None`. That is the right posture (don't crash the auth gate over a logging concern).
> - One small refactor proposed for S-011 (lands with BLG-0023): extract the header-extraction logic into `backend/app/auth.py:extract_header_metadata(token: str) -> HeaderMetadata` so it lives next to the verifier, not in the route's exception handler. The exception handler then calls it. Easier to test, easier to reason about.
>
> Position: co-sign with the S-011 refactor folded into BLG-0023 implementation (the verifier rewrite touches the same surface anyway).

**qa:**

> Test contract:
>
> 1. **Happy-path negative tests** — for each `JwtError` subclass, assert the diagnostic log line is emitted exactly once via `caplog`, with `code=<expected code>` present and the static `reason` message matching the subclass.
> 2. **Header-field tests** — synthesize tokens with various `alg` / `typ` / `kid` values; assert each value appears in the log record's message, **kid truncated to first-6 chars + `"…"` when the original is > 6 chars**, unchanged when ≤ 6 chars.
> 3. **Redaction test** — regex-scan every captured log record (across the test session) for: a JWT structure (`[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}`), the literal full token, the literal payload base64, the literal signature base64, the literal raw `Authorization` header value. Assert zero matches. This is the *negative contract* — we can never log these.
> 4. **Malformed-token tests** — assert the verifier handles a token whose header is not valid JSON, a token with fewer than 3 segments, a token with bytes that fail base64url decode, a token with an empty header. All result in `header_alg=None, header_typ=None, header_kid=None` in the log; no exception leaks out of the handler.
>
> Position: co-sign on the test contract. ≥ 8 new tests land with BLG-0025 (or with BLG-0023 if folded together).

### Round 2

**security-privacy-officer** (responding to backend-builder):

> The S-011 refactor (extracting `extract_header_metadata`) is the right boundary. Fold it into BLG-0023 implementation; do not ship BLG-0025 separately. The amendment to ADR-0002 §6 stands as the ADR; the implementation lives in the same PR as the verifier rewrite. No test work is duplicated.

**agent-safety-officer** (responding):

> Affirming: BLG-0025 is the *test + contract amendment*; the *code path* lands with BLG-0023. This is the right way to keep auth-critical changes co-located in PR review.

**qa** (responding):

> Test contract land alongside BLG-0023 verifier tests in the same S-011 PR. ≥ 8 test cases bundled into `backend/tests/test_auth_logging.py` (new file). 

**backend-builder** (responding):

> Confirmed: BLG-0025 ships as the ADR + tests, BLG-0023 ships as the verifier rewrite + the extracted helper. One PR.

### Round 3

No new concerns. Chair declares rounds closed.

## Decision

### 1. ADR-0002 §6 amended

The amendment to **ADR-0002 §6 (logging)** is recorded here and lands as a "Status: superseded-by-ADR-0016" note appended to ADR-0002 §6 by the S-011 PR. The full text of the amendment:

> **JWT *header* fields — `alg`, `typ`, `kid` (truncated to first-6-chars + `"…"` when > 6 chars) — are PII-safe public metadata per RFC 7519 §5 and MAY be logged on every JwtError rejection alongside `code=<JwtError.code>` and a static `reason` string. JWT *payloads* (claims), *signatures*, the full *token*, and the raw *Authorization* header value MUST NOT appear in any log record. The `reason` string MUST be a static literal defined in the verifier's code; it MUST NOT be an f-string interpolating claim values, header values beyond the three listed, or any token segment. The diagnostic line is the operational tool that surfaced the 2026-05-12 Supabase ES256 rotation in under two minutes; it stays.**

### 2. Code contract

`jwt_exception_handler` continues to emit (per the existing in-session implementation):

```
log.warning(
    "jwt_rejected code=%s alg=%s typ=%s kid=%s reason=%s",
    exc.code,
    header_alg,
    header_typ,
    header_kid,    # truncated
    str(exc),      # static literal per JwtError subclass
)
```

The header-extraction logic moves from the route's exception handler to `backend/app/auth.py:extract_header_metadata(token: str) -> HeaderMetadata` in the S-011 BLG-0023 PR. This refactor:

- Co-locates header-extraction next to verification.
- Is independently unit-testable.
- Keeps the `try / except` swallow-all-decode-errors behavior (logging concern must not crash auth).

### 3. Test contract (lands in S-011 with BLG-0023, governed by BLG-0025)

`backend/tests/test_auth_logging.py` (new file), ≥ 8 tests:

1. `JwtMalformedError` emits the diagnostic line with `code=jwt_malformed`.
2. `JwtExpiredError` emits the diagnostic line with `code=jwt_expired`.
3. `alg`, `typ` from a valid header are logged unchanged.
4. `kid` > 6 chars is logged truncated to first-6 + `"…"`.
5. `kid` ≤ 6 chars is logged unchanged.
6. Malformed-header tokens (non-JSON, wrong segment count, base64-broken) log `alg=None typ=None kid=None` and do not raise.
7. **Redaction regex scan** across every captured log record finds zero JWT structures, zero literal token strings, zero literal payload base64, zero literal `Authorization` header values.
8. The `reason` string for each `JwtError` subclass is the static literal defined in `app/auth.py` — pinned by exact-match assertions on the captured log message.

### 4. Scope — what this ADR does NOT cover

- It does **not** add any new field to the diagnostic line beyond the five already enumerated.
- It does **not** authorize logging *any* payload claim (`sub`, `email`, `phone`, `aud`, `exp`, etc.) — those remain forbidden.
- It does **not** authorize wider header logging — only `alg`, `typ`, `kid`-truncated. Future header fields (e.g. `cty`, `x5c`) require a follow-up ADR amendment.

## Dissent

None recorded. All four participants converged in Round 2 with no dissent in Round 3.

## Consequences

**Positive:**

- The diagnostic capability that surfaced Drift A in under two minutes is locked in by a regression-tested contract. Operators cannot accidentally remove it via refactoring without failing tests.
- The negative contract (payload / signature / token / `Authorization` never logged) is **pinned by a redaction regex test** — defense-in-depth against future careless logging.
- ADR-0002 §6 evolves cleanly without superseding the original (the original's other rules — `e-invoicing.gr` host + `trace_id`, never the QR URL, never raw HTML — stay valid).

**Negative:**

- One more place in the codebase where logging hygiene has to be enforced. Mitigation: the redaction regex test scans every captured log record across the suite, not just auth tests, so a future feature that leaks anywhere fails the same gate.

**Follow-ups added to backlog:**

- BLG-0025 status updated from `drift` to **Ready** at S-010 close, sized XS. Ships co-located with BLG-0023 in S-011.
- No outbound surface change.
- No new dependency.
