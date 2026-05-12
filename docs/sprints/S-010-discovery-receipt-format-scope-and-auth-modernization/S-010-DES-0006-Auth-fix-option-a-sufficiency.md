# DES-0006 — Option A (HS256-rollback) sufficiency until ADR-0015 (BLG-0023) lands

Owner: `architect` + `security-privacy-officer` + `backend-builder`
Status: confirmed (this DES is the recording of an in-session verification, not a forward-looking design)
Date: 2026-05-12

## What this DES records

The 2026-05-12 live debugging session that surfaced Drift A executed an in-session mitigation ("Option A") on the running production project:

1. In the Supabase dashboard: **JWT Signing Keys → "Create Standby Key" on the previously-used Legacy HS256 key → "Rotate keys"**. The project moved from the new ECC P-256 (ES256) signing key back to the Legacy HS256 shared-secret signing key.
2. On the backend host: **set `SUPABASE_JWT_SECRET` to the actual legacy secret value** (obtained from "Reveal" on the Legacy JWT Secret tab — a UUID had been pasted by mistake earlier, breaking the verifier).
3. **Full uvicorn restart** to clear the in-process config cache.

This DES records the **end-to-end verification** that Option A holds, and the **sufficiency window** it gives us until ADR-0015 / BLG-0023 ships in S-011.

## Verification performed (2026-05-12 17:43 UTC+3)

Two test paths exercised post-restart:

**Path 1 — Synthetic-URL test (loopback `127.0.0.1`):**

- `POST /receipts/parse` from a curl on the same host, with a freshly-minted Supabase access token.
- Body: `{"qr_url": "https://example.invalid/fake"}` — deliberately not a valid `e-invoicing.gr` URL.
- **Expected**: token verification succeeds (the auth gate is now happy with HS256); parser rejects the URL at the next step (422 `Unsupported QR URL`).
- **Observed**: `HTTP/1.1 422 Unprocessable Entity` returned in **47 ms**. No `jwt_rejected` line in the uvicorn log for this request.
- **Conclusion**: the auth gate accepted the token; the failure was at the parser-routing step, exactly as expected. **Auth gate works.**

**Path 2 — Live mobile device request (`192.168.1.208`):**

- The test device (an in-house Android phone running the SDK 54 build from S-009) scanned an in-wallet receipt and sent `POST /receipts/parse`.
- Token: real, Supabase-issued, HS256 under the rolled-back signing key.
- **Expected**: token verification succeeds; parser then attempts to fetch the QR URL upstream.
- **Observed**: `HTTP/1.1 502 upstream_error` returned. The `jwt_rejected` diagnostic line did **not** appear in the uvicorn log for this request — only the `upstream_error` line from the parser path appeared.
- **Conclusion**: the token passed the auth gate. The 502 came from a downstream fetch failure, not auth.

The 502 on path 2 is a separate finding logged in `docs/plan.md` "Open questions for S-010" — it indicates either an expired upstream URL, a 404 from `e-invoicing.gr` for that UUID + token pair, or HTML drift. It is **not** an auth issue, which is what this DES is concerned with.

## Sufficiency window

Option A is **production-acceptable until BLG-0023 ships in S-011**. The conditions for that statement:

| Condition | Status as of 2026-05-12 |
| --- | --- |
| Auth gate accepts Supabase-issued tokens for the rolled-back project | **Yes (verified path 1 + path 2).** |
| Mobile session refresh (`supabase.auth.refreshSession()`) still works against the rolled-back project | **Yes** — refresh tokens are project-scoped, not signing-key-scoped per Supabase docs. The 14-day refresh window per ADR-0004 remains valid. |
| No Supabase auto-rotation event can re-break auth in the rollback window | **At risk.** If Supabase auto-rotates the project away from the Legacy HS256 key (as it did six days ago, autonomously), auth breaks again instantly. Mitigation: monitor the dashboard for the next scheduled rotation; if rotation appears imminent, prioritize BLG-0023 over any other S-011 work. |
| No new endpoint contract change required | **Yes** — the verifier surface stays HS256-only until BLG-0023; no call site changes. |
| Diagnostic log line (BLG-0025 / ADR-0016) catches any silent re-break | **Yes** — the ad-hoc log line is in the working tree; any future ES256 token would surface as `jwt_rejected alg=ES256` within seconds. |

## What Option A does NOT cover

- **A future Supabase deprecation of Legacy HS256 keys.** Per Supabase's published roadmap, the JWT Signing Keys system is the new default and the Legacy HS256 path is on the deprecation track. Option A buys time but is **not** a long-term posture. BLG-0023 must ship before Legacy HS256 is removed by Supabase.
- **Multi-project resilience.** If the project is migrated to a new Supabase project (for any reason — pricing, region, account ownership), the new project ships with JWT Signing Keys by default. Option A would not apply; BLG-0023 is the only path.
- **Manual operator error.** If an operator clicks the wrong button in the Supabase dashboard and re-rotates to ES256, Option A is reversed. Mitigation: BLG-0023 makes this class of error impossible (the verifier handles both).

## Operational checklist if Option A is reversed accidentally before BLG-0023 ships

1. Confirm symptom: every `POST /receipts/parse` returns 401; the uvicorn log shows `jwt_rejected code=jwt_malformed alg=ES256` (or `RS256`) for every request.
2. Open the Supabase dashboard → JWT Signing Keys.
3. If the current key is ES256 / RS256: "Move to standby" on the active asymmetric key; "Promote" the Legacy HS256 key from standby back to active; "Rotate keys."
4. Reveal the Legacy JWT Secret on the dashboard. Copy it.
5. On the backend host: `export SUPABASE_JWT_SECRET=<the-revealed-value>`; restart uvicorn.
6. Verify per path 1 above (a curl with a freshly-minted token to `POST /receipts/parse` returns 422 for a synthetic URL, not 401).
7. Log the incident in the active sprint's `LOG`. If still in S-010 / S-011, this DES is the existing record; reference it. Otherwise open an incident BLG.

## Why this DES exists in S-010 (a discovery sprint that does not ship code)

The Option A mitigation is **already deployed** as a production-side change in the Supabase dashboard, plus a one-line env-var change on the backend host. It is not source code; it does not enter `make check`; it is not a sprint deliverable. But it **is** an operational fact relevant to ADR-0015's "until BLG-0023 ships in S-011" framing, and it is the artifact the S-010 plan explicitly named as needing confirmation:

> _docs/plan.md Drift A line 64_: "**Option A is verified end-to-end as of 2026-05-12 17:43 UTC+3** ... The mitigation holds until BLG-0023 lands."
>
> _BLG-0026 acceptance bullet_: "Auth-fix verification: while we're scoping S-010, confirm in a short DES note whether Option A (the live HS256-rollback executed in this debugging session) is sufficient or whether BLG-0023 needs to land first."

This DES is that "short DES note." Its conclusion: **Option A is sufficient. BLG-0023 is the long-term fix and lands in S-011. No production code change in S-010.**

## Sign-offs

| Agent | Statement |
| --- | --- |
| `architect` | Co-sign — Option A is the right technical mitigation; ADR-0015 is the right long-term posture. |
| `security-privacy-officer` | Co-sign — verified the auth gate accepts Supabase-issued tokens end-to-end; no PII leaked during diagnostic; reversal procedure documented above is sufficient as an operational runbook stub (a fuller runbook ships under BLG-0023 acceptance per ADR-0015 §9). |
| `backend-builder` | Co-sign — verified path 1 + path 2 in-session; the rolled-back project is currently the production posture and stays so until BLG-0023 deploys. |
| `agent-safety-officer` | Co-sign — no new outbound host (this is a dashboard change); no new dependency; no secret committed (the Legacy HS256 value is in the host's env var, not the repo). |
