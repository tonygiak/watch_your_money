# Sprint S-008 — UREV (User Review)

- Type: discovery
- Theme: `sdk-upgrade-path-forward`
- Date: 2026-05-08
- For: human review before S-009 begins

## What to review in a discovery sprint

In a discovery sprint there is no new user-facing behavior to test end-to-end. The review consists of reading the decisions made and confirming the Ready items are coherent and safe to build against.

---

## §A — Review ADR-0013

Read `docs/adr/S-008-ADR-0013-Sdk-upgrade-env-fix.md`.

**What it decides:**

> The `UNABLE_TO_VERIFY_LEAF_SIGNATURE` npm error (which blocked BLG-0016 in S-005, S-006, and S-007) is caused by the host machine's Node.js installation having an outdated built-in CA bundle. The fix is to update Node.js to the current LTS (v22.x), which ships an updated Mozilla CA store. If the Node.js update alone doesn't resolve it, the fallback is to export the Windows system CA trust store and point Node.js to it via `NODE_EXTRA_CA_CERTS`. Both approaches keep TLS verification fully on. Neither adds a new outbound host or any npm/pip package.

**What to verify:**

1. Open `docs/adr/S-008-ADR-0013-Sdk-upgrade-env-fix.md` and confirm it has: `Status: accepted`, all five co-signs present in the Rounds, and a §3 pre-flight checklist.
2. Confirm the checklist has a clear "Option A exhausted" exit criterion (both Node.js update AND `NODE_EXTRA_CA_CERTS` must be tried before escalating).
3. Confirm no new outbound host was added to `.agents/context/outbound-allowlist.md`.

---

## §B — Review BLG-0016 status in backlog

Open `docs/backlog.md` and locate BLG-0016.

**What to verify:**

- Status should read "Ready, executable per ADR-0013 §3 pre-flight checklist" (or similar language noting the pre-flight checklist unblocks the item).
- The escalation note from S-007 ("deferred for the third sprint running") should now be replaced by the S-008 resolution.

---

## §C — Confirm make check is still green

Since S-008 is a discovery sprint, **no production code was changed**. The test suite is identical to S-007 close.

```
# From the backend/ directory with the venv active:
ruff check .
mypy app tests
pytest

# From the mobile/ directory:
npx tsc --noEmit
npx jest
```

Expected: 143 backend tests passed, 203 mobile tests passed across 19 suites (346 total — same as S-007).

> **PowerShell workaround (same as every sprint since S-003):** bare `make check` may misresolve on PowerShell sessions where the workspace path contains the Greek folder name `Υπολογιστής`. Run the four commands above directly with the venv / npm binaries instead.

---

## §D — What happens next (S-009 preview)

S-009 is an **implementation** sprint. The first action is the ADR-0013 §3 pre-flight checklist:

1. Run `node --version`. If below v22, update to Node.js 22 LTS.
2. Smoke test: `npm pack expo@^54.0.0 --dry-run` in a temp dir.
3. If the smoke test passes → `npx expo install --fix` in `mobile/` and full SDK 54 upgrade per ADR-0012 §2.
4. If the smoke test still fails after the Node.js update → export the Windows CA bundle and retry (PowerShell one-liner in ADR-0013 §3 Step 3a).
5. If still failing after both paths → open BLG-0023 and escalate to S-010 discovery.

If S-009 succeeds, the on-device acceptance script from `S-006-UREV-0001` §A (sign in → scan → tag as business → Profile → ΑΦΜ → export PDF → share) finally runs on **stock Expo Go** (iOS or Android, latest store version).

---

## §E — No user-visible behavior shipped in S-008

The app is unchanged from S-007. The §2.6 feature catalog is unchanged. S-009 is the sprint that moves the needle on user-visible on-device delivery.
