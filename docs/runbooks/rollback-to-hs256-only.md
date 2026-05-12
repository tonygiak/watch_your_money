# Runbook — Roll back to HS256-only Supabase signing (Option A / DES-0006)

**Owner:** `devops-engineer` (executor); the on-call engineer can run this without a sign-off when production auth is actively broken.
**Audience:** human operators when production `POST /receipts/parse` (and every other authenticated endpoint) is returning 401 with `code=jwt_malformed alg=ES256` because Supabase has auto-rotated the project to JWT Signing Keys and the backend can't yet verify ES256 (BLG-0023 not yet shipped or just regressed).

> This is the **emergency rollback** that mitigated the live 2026-05-12 incident in under 10 minutes. It is the documented Option A from DES-0006. The fix is the BLG-0023 asymmetric verifier; this runbook is the bridge.

## When to use this

Symptom: every authenticated request to the backend returns 401. The server log shows `jwt_rejected code=jwt_malformed alg=ES256 typ=JWT kid=<truncated> reason=unsupported alg: 'ES256'` (or `alg=RS256`).

Diagnostic check (read-only, safe):

```bash
# In the production environment with the operator's curl or backend logs
grep "jwt_rejected" backend.log | tail -n 20
```

If most rejections show `alg=ES256` or `alg=RS256`, Supabase has rotated to asymmetric signing keys and the backend either does not have BLG-0023 deployed or has a JWKS misconfiguration.

## Procedure

1. **In the Supabase dashboard** (the only required step):
   1. Open the production project.
   2. *Project Settings → API → JWT Settings → JWT Signing Keys*.
   3. Click *Move to standby* on the current ECC P-256 key. The previous Legacy HS256 key automatically becomes standby (or stays current, depending on the project's history).
   4. If a Legacy HS256 key is **not** in the standby slot, click *Create standby key* and select **HMAC (HS256)**. Generate it now. Note its secret (copy to a secure clipboard — never to a chat / log).
   5. Click *Rotate keys*. The HS256 key is now the current signing key.
2. **In production env** (only if you had to create a new HS256 key in step 1.4):
   1. Set `SUPABASE_JWT_LEGACY_HS256_SECRET=<the new HS256 secret>` in Railway / Render env settings.
   2. Restart the backend service.
   3. The HS256 secret is also acceptable in the deprecated `SUPABASE_JWT_SECRET` slot for one release cycle.
3. **Verify on a real device.**
   1. Open the production mobile app, scan one receipt.
   2. Receipt should save (201). The home list should refresh.
   3. Backend logs: `grep "jwt_rejected" backend.log | tail -n 5` — no recent rejections from legitimate users.
4. **Open a `drift` BLG** in `docs/backlog.md` referencing the incident, so the next discovery sprint can decide whether BLG-0023 needs to be re-verified or whether the JWKS provider had a config issue.

## Notes

- Existing user sessions that hold an ES256-signed token will still 401 until they re-sign-in or until their session refreshes (Supabase clients auto-refresh against the new key set). The mobile BLG-0024 silent-refresh path (shipped in S-011) catches most of these without any user-visible sign-out.
- This rollback does **not** require a backend redeploy. Step 2 is only needed when the HS256 secret needs to be created from scratch.
- The Legacy HS256 path is on Supabase's deprecation track. Treat this rollback as a temporary patch, not a long-term posture. The long-term fix is BLG-0023 (ADR-0015).

## Auditability

Record in the on-call incident ticket / sprint LOG:

- The rollback timestamp.
- Why the asymmetric path failed (best hypothesis).
- Outcome (auth restored Y/N; user-visible duration).
- The new HS256 secret was NEVER written to chat / logs / commit history (mandatory).
- A `drift` BLG is open in `docs/backlog.md`.
