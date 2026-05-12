# Runbook — Rotate Supabase JWT signing keys (move project to ES256 / JWKS)

**Owner:** `devops-engineer` (executor); `security-privacy-officer` + `architect` sign-off before running in production.
**Audience:** human operators after BLG-0023 has shipped to staging and been verified end-to-end (S-011 acceptance bullets).
**When to run:** the production Supabase project is currently on the Legacy HS256 signing key (Option A / DES-0006). BLG-0023 is live in staging with green `make check`. You want to switch production back to the modern JWT Signing Keys system (ES256 + JWKS) per ADR-0015 §9.4.

> Do **NOT** run this if BLG-0023 has not yet been verified in staging. Until then the production project must stay on Legacy HS256, otherwise every endpoint that requires auth will return 401 (the 2026-05-12 incident class).

## Pre-flight

1. `make check` is green on the backend `main` branch.
2. BLG-0023 has been merged + deployed to **staging** and the staging app passes the BLG-0024 silent-refresh end-to-end UREV step from `docs/sprints/S-011-*/S-011-UREV-0001-*.md`.
3. `backend/.env` in production has both variables set (operator action — out of repo):
   - `SUPABASE_JWKS_URL` — leave unset to use the default `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`, or set explicitly if you proxy JWKS through a CDN.
   - `SUPABASE_JWT_LEGACY_HS256_SECRET` — keep the current Legacy HS256 secret here through the cut-over so any in-flight HS256 token from before the cut-over still verifies until it expires (max 1 hour with Supabase defaults).
4. `agent-safety-officer` + `security-privacy-officer` have signed off (recorded in the deploy PR / change ticket).

## Procedure

1. **Staging dry-run** (must already be done before reaching this runbook). On the **staging** Supabase project: dashboard → *Project Settings → API → JWT Settings → JWT Signing Keys → Rotate keys*. Wait 60 s. Open the staging mobile app, sign in, scan a real receipt. Confirm the receipt parses and saves (no 401 surfaced to the user).
2. **Production cut-over.** During a low-traffic window:
   1. Snapshot the current Supabase project state (signing-key id, current revision).
   2. Dashboard → *Project Settings → API → JWT Settings*.
   3. Confirm a **Standby** key is configured for the new asymmetric signing material. If not, click *Create standby key* (Supabase generates an ECC P-256 key pair). Wait until the standby shows up in the project's JWKS at `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`.
   4. Click *Rotate keys* — the standby becomes current. New tokens issued from now on are signed with the new ES256 key.
   5. Wait 5 minutes (Supabase's max access-token lifetime is 1 hour, but the typical session in flight expires under 5 minutes for users actively scanning).
3. **Verify on a real device.**
   1. Open the production mobile app, scan one fresh receipt.
   2. Confirm `POST /receipts/parse` returns `201 Created` and the receipt appears in the home list.
   3. Tail the backend logs for 60 seconds — search for `jwt_rejected`. There should be **zero** rejections for legitimate users. (Some malformed-token noise from unauthenticated traffic is fine.)
4. **Drop the legacy HS256 secret** (optional, deferred to BLG-0034). The HS256 transitional path stays available as a rollback until BLG-0034 retires it. Leave `SUPABASE_JWT_LEGACY_HS256_SECRET` set for one release cycle, then unset it and follow BLG-0034.

## Rollback

If a production rotation causes auth to break unexpectedly, follow `docs/runbooks/rollback-to-hs256-only.md`. The Legacy HS256 secret is still configured during the transition window so the rollback is one Supabase dashboard click + zero backend redeploy.

## Auditability

Record in the deploy ticket / sprint LOG:

- The rotation timestamp.
- The new key's `kid` prefix (truncated — never the full key material).
- Who approved the rotation (`security-privacy-officer` + `agent-safety-officer` co-sign).
- Outcome (verification successful / rollback required).
