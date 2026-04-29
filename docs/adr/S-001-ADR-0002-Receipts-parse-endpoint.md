# `POST /receipts/parse` contract + Supabase RLS interaction + `MARK` idempotency

Status: accepted
Date: 2026-04-29
Chair: orchestrator
Participants: architect, engineering-manager, data-architect, security-privacy-officer, parser-specialist, qa
Co-signs required: architect + engineering-manager (new endpoint / API contract — `AGENTS.md` §4.11), data-architect + security-privacy-officer (RLS interaction — §4.11).

## Context

`AGENTS.md` §5.3.2 specifies `POST /receipts/parse` with input `{ "qr_url": string, "user_id": string }` and a structured response. ADR-0001 just locked the parser contract. We still have to settle the **server-side** flow:

1. **How is the calling user authenticated**, given that mobile uses Supabase Auth (anon key + session JWT)?
2. **How is `user_id` set on the `receipts` row** without trusting the client to claim an identity?
3. **How does RLS interact** with the backend writing on the user's behalf?
4. **How is duplicate scanning prevented** (the same QR scanned twice from two devices, or a user scanning a receipt that's already in their history)?
5. **What's the response shape** — bare receipt? wrapped envelope? error model?
6. **Is the endpoint idempotent**, and how does the client treat a 200 vs a 409?

The `AGENTS.md` §5.3.2 input shape includes a `user_id`. That is a problem if read literally: a client-supplied `user_id` over Bearer auth is forgeable. The ADR has to reconcile §5.3.2 with `auth.uid()`-based RLS in `db/policies/receipts.sql` and the no-secrets-on-device rule (`AGENTS.md` §2.4). Per `AGENTS.md` §4.4 tie-breaker priority, hard constraints (§2.4) and runtime security (§3.2.1) win over the literal §5.3.2 wording.

## Rounds

### Round 1

- **architect**: The endpoint must accept a Supabase **Bearer JWT** in the `Authorization` header. The backend verifies the JWT (using Supabase JWKS or the project's JWT secret), extracts `sub` (= the user UUID), and uses **that** for `user_id`. The body's `user_id` is dropped or ignored; we should remove it from the contract entirely and amend §5.3.2 in a follow-up. Body becomes `{ "qr_url": string }`. Response wraps the parsed receipt + the row id assigned by Postgres.
- **engineering-manager**: Agree on Bearer auth. Two engineering concerns: (1) validation latency — JWT verification should be in-process (no extra Supabase round-trip); use the JWT secret from env. (2) error model — return RFC-7807-style problem details so the mobile client can branch on `code` not on string matching. Also: the response should always include the parsed receipt, even on idempotent 200, so the client doesn't have to do a second GET.
- **data-architect**: Two RLS questions. (a) The backend uses the **service-key** Supabase client (bypasses RLS) to insert. That's fine *only if* the backend has independently verified the JWT and is writing `user_id = sub`. (b) Idempotency: `receipts (user_id, mark)` is already a uniqueness constraint in `0001_init.sql`. Use it. On conflict, return the existing row, not a 500.
- **security-privacy-officer**: Hard requirements: (1) **never** trust a client-supplied `user_id`. (2) Bearer JWT verification must be done by the backend itself, not delegated. (3) Sensitive fields in the request/response must not be logged in plaintext (no logging the QR URL with tokens; no logging raw HTML). (4) `MARK`-based idempotency is per-user, never global — so two different users scanning the same receipt each get their own row (this is correct because the **owner** is who paid). Confirming that the existing `unique (user_id, mark)` constraint already enforces this.
- **parser-specialist**: ADR-0001 already specifies the parser error taxonomy. Map them to HTTP statuses: `UnsupportedQrUrl` → 422, `ParserFetchError` → 502 (we treat upstream network failure as a bad gateway), `ParserUpstreamError` → 502, `ParserDriftError` → 503 (drift is not the user's fault — and 503 with a Retry-After-style hint signals "this might fix itself"), `EmptyReceiptError` → 422. Validation errors on `qr_url` (missing, malformed) → 400.
- **qa**: For testability the contract needs strict request/response Pydantic models, an OpenAPI schema we can snapshot, and a documented "what idempotency means" rule we can write contract tests for. Also: response should expose `is_duplicate: bool` so the client can show a friendly "you already scanned this" instead of an error.

### Round 2

- **architect** (responding to engineering-manager + qa): Agree on RFC-7807-style problem details. Proposing this envelope on errors: `{ "type": "<code>", "title": "<short>", "status": <int>, "detail": "<long>", "trace_id": "<uuid>" }`. On 200/201 success, return `{ "receipt": <ParsedReceipt + id + created_at>, "is_duplicate": <bool> }`. `is_duplicate=true` is returned with **HTTP 200** (not 409) so the client treats both first-scan and re-scan in one happy path; this matches qa's UX request.
- **engineering-manager** (responding): The 200-with-`is_duplicate` decision is good, but I want one nuance — `Location` header set to `/receipts/{id}` in both cases so the contract matches REST norms and the mobile client can navigate uniformly. New row is 201 + `Location`; idempotent hit is 200 + `Location`.
- **data-architect** (responding to architect): One more rule — when `is_duplicate=true`, we **do not overwrite** any user-set fields on the existing row (e.g. `is_business_expense`, `notes`, `business_category`). Idempotent re-scan returns the row as-is. This protects user edits.
- **security-privacy-officer** (responding to all): Confirming the data flow is acceptable. One residual question: the §5.3.2 spec includes `user_id` in the body. If we drop it, we are technically amending the spec. **Resolution**: this ADR explicitly supersedes the body shape in `AGENTS.md` §5.3.2; a follow-up doc-update (handled in §2.7 / runbooks) records the spec-tightening. We never trust a client-supplied identity.
- **parser-specialist** (responding): On status mappings — agree, with a clarification: if `ParserDriftError` is raised, the backend MUST also log a structured drift event (sprint LOG + a future ops alert hook) so we don't ship a silently broken parser. That hook is engineering-only; doesn't change the API contract.
- **qa** (responding): Looks good. Adding one test-strategy note: contract tests will assert (a) a missing/invalid Bearer = 401, (b) a valid Bearer + valid Greek QR = 201 + body shape, (c) a re-scan = 200 + `is_duplicate=true` and same `id` returned, (d) a non-Greek-domain QR = 422 with `type: "unsupported_url"`. These are the acceptance criteria for BLG-0002.

### Round 3

- **architect** (responding to security-privacy-officer): Capturing the §5.3.2 amendment explicitly: **the ADR overrides the body to `{ "qr_url": string }`** because §5.3.2's `user_id` would breach §2.4 (no bypass of user privacy) and §3.2.1 (least-privilege). The amendment is recorded in this ADR's *Consequences* and surfaced in the next AGENTS.md edit. The §4.4 tie-breaker (hard constraints win) authorizes this without further escalation.
- **engineering-manager**: No new concerns. Sign-off ready.
- **data-architect**: No new concerns. Sign-off ready.
- **security-privacy-officer**: No new concerns. Sign-off ready.

No new concerns surfaced after Round 3. Closing.

## Decision

### 1. Authentication and authorization

- The endpoint requires a **Supabase Auth Bearer JWT** in the `Authorization: Bearer <token>` header.
- The backend verifies the JWT in-process using the project's JWT secret (loaded from env var `SUPABASE_JWT_SECRET`) — no Supabase round-trip.
- The verified `sub` claim is the canonical `user_id`. The request body is **not** allowed to carry `user_id`.

### 2. Request body

```
{
  "qr_url": "https://e-invoicing.gr/edocuments/ViewInvoice/-1/<uuid>_<token>"
}
```

`qr_url` is required, length-bounded (≤ 2048), and **not** logged in plaintext. The body shape supersedes the literal `AGENTS.md` §5.3.2 wording (`user_id` in body) under the §4.4 tie-breaker priority.

### 3. Response

**201 Created** (new receipt stored):

```
HTTP/1.1 201 Created
Location: /receipts/{id}
Content-Type: application/json

{
  "receipt": { ...ParsedReceipt..., "id": "<uuid>", "created_at": "2026-04-29T22:55:00Z" },
  "is_duplicate": false
}
```

**200 OK** (idempotent re-scan — `(user_id, mark)` already exists):

```
HTTP/1.1 200 OK
Location: /receipts/{id}
Content-Type: application/json

{
  "receipt": { ...existing row, untouched... },
  "is_duplicate": true
}
```

User-set fields (`is_business_expense`, `business_category`, `notes`) are NEVER overwritten by an idempotent re-scan.

### 4. Error envelope (RFC-7807 style)

All non-2xx responses return:

```
{
  "type": "<error_code>",
  "title": "<short, human-readable>",
  "status": <int>,
  "detail": "<long, no PII>",
  "trace_id": "<uuid>"
}
```

| Status | `type` | When |
|--------|--------|------|
| 400 | `invalid_request` | Missing or malformed body / `qr_url`. |
| 401 | `unauthenticated` | Missing or invalid Bearer JWT. |
| 422 | `unsupported_url` | `UnsupportedQrUrl` (no adapter matches) or `EmptyReceiptError` (parsed but empty). |
| 502 | `upstream_error` | `ParserFetchError` or `ParserUpstreamError`. |
| 503 | `parser_drift` | `ParserDriftError`. Logged as a structured drift event for ops. |

### 5. Idempotency and storage

- Backend uses the Supabase **service-key** client (env var `SUPABASE_SERVICE_KEY`) to write, **after** verifying the JWT.
- Insert sets `user_id = sub`, `country_code = parsed_receipt.country_code`, plus every parsed field.
- The `receipts_mark_per_user_unique unique (user_id, mark)` constraint in `db/migrations/0001_init.sql` enforces idempotency. On `IntegrityError` for that constraint, the backend SELECTs the existing row and returns it with `is_duplicate=true`.
- `raw_html` is stored on insert; an idempotent re-scan does NOT update `raw_html` (the original capture is the source of truth).
- The mobile client reads `/receipts` and `/receipts/{id}` directly from Supabase using the **anon key** and RLS. No service key on device (`AGENTS.md` §2.4).

### 6. Logging and audit

- The verified `user_id` is included in structured logs.
- The `qr_url` and `raw_html` are NEVER logged in plaintext. Log only the URL host (`e-invoicing.gr`) and an opaque `trace_id`.
- `ParserDriftError` triggers a structured `drift_detected` log entry (level WARN) with `trace_id`, `country_code`, and the parser version. No raw HTML.

## Dissent

None recorded. All participants converged in Round 3.

## Consequences

**Positive:**
- BLG-0002 is now Ready: S-002 implements the endpoint, JWT verification middleware, the storage path, the idempotency branch, and contract tests.
- The "no client-supplied identity" rule is now enforced by contract, not by convention.
- The mobile client gets a single happy-path call (`POST /receipts/parse`), with re-scans handled gracefully via `is_duplicate`.

**Negative:**
- `AGENTS.md` §5.3.2 lists `user_id` in the body. **This ADR supersedes that literal wording** under the §4.4 tie-breaker. A follow-up edit to AGENTS.md will harmonize the wording, but the *contract* in this ADR is the source of truth.
- The backend now needs `SUPABASE_JWT_SECRET` in addition to `SUPABASE_SERVICE_KEY`. Captured in BLG-0002 acceptance and to be reflected in `backend/.env.sample`.

**Follow-ups (added to backlog):**
- BLG-0010 — *Reconcile `AGENTS.md` §5.3.2 wording with this ADR* (a small documentation patch in the next discovery sprint or a low-risk edit by `agents-doctor` with `orchestrator` co-sign per §4.11).
