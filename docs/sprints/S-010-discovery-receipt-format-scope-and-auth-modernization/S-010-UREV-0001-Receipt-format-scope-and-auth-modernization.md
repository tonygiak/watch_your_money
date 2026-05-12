# Sprint S-010 — UREV (User Review)

How a human verifies S-010's outputs **before** any code ships in S-011. Discovery sprints don't change user-visible behavior — so this UREV is about reading the decisions, not running the app.

- Type: discovery
- Theme: `receipt-format-scope-and-auth-modernization`
- Closed: 2026-05-12

## What S-010 delivered (no code; three accepted ADRs + one DES + 10 backlog changes)

If you only have five minutes, **read this section.**

1. **The §2.8 MVP scope now matches real Greek receipts.** Before today, the project promised "scan any Entersoft / SoftOne receipt." After today, it promises "scan any receipt printed by a certified Greek cash register (AADE tameiakí signature URLs) **plus** the Entersoft / SoftOne / Epsilon Net family — with SKU-level data when the QR carries it and merchant + total + date when it doesn't." The product covers ~9x more receipts; the §2.2 SKU-level pitch is *hedged* but stays the most differentiated personal-finance product for Greek consumers.
2. **The backend auth gate is being upgraded to Supabase's modern JWT signing-keys system.** The 2026-05-12 incident (where Supabase auto-rotated the project to ES256 keys and broke every endpoint) cannot recur after BLG-0023 ships in S-011. The mitigation deployed in-session (HS256-rollback) is **production-acceptable** until then.
3. **The diagnostic log line that solved Drift A in two minutes is locked in by a regression-tested contract.** No future refactor can silently remove it.

## How to verify

### 1. Read the three ADRs

In order of importance for the user:

- **`docs/adr/S-010-ADR-0014-Receipt-format-scope-expansion.md`** — the product decision. Read §1 (registry-of-adapters), §3 (per-family table), §5 (UX banner), §6 (the §2.2 / §2.8 / §2.9 amendments). 9 participants, 3 rounds, no dissent.
- **`docs/adr/S-010-ADR-0015-Asymmetric-jwt-verification.md`** — the auth decision. Read §1–§4 + §9 (production deployment). 6 participants, 3 rounds, no dissent. `cryptography==45.0.1` is the only new dependency.
- **`docs/adr/S-010-ADR-0016-Jwt-header-logging.md`** — the logging-hygiene decision. Read §1 + §3 (test contract). 4 participants, 3 rounds, no dissent.

Each ADR has a "Rounds" section recording the multi-agent debate verbatim. If you want to see *why* a decision is what it is, read those.

### 2. Read DES-0006

`docs/sprints/S-010-discovery-receipt-format-scope-and-auth-modernization/S-010-DES-0006-Auth-fix-option-a-sufficiency.md` — confirms the 2026-05-12 in-session HS256-rollback works end-to-end and is acceptable until BLG-0023 ships. Includes the operator-runbook stub for reversing accidentally.

### 3. Verify `AGENTS.md` §2.2 / §2.8 / §2.9 amendments landed

In `AGENTS.md`:

- **§2.2 second bullet** now reads "**SKU-level** receipt data **for receipts whose QR carries it** (Entersoft / SoftOne / Epsilon Net); **merchant + total + date** for receipts whose QR carries only a fiscal signature (AADE tameiakí — the most common Greek consumer-receipt format)."
- **§2.8 bullet 3** now reads "A user can scan a Greek receipt QR code from any of the supported families: **e-invoicing.gr (Entersoft / SoftOne)**, **Epsilon Net**, **AADE tameiakí signature URLs**."
- **§2.8 bullet 4** now reads "**The receipt (with all line items when the format carries them; with merchant + total + date when the format is limited-info)** appears in their app within 5 seconds."
- **§2.9** has a new line: "Detection of probable duplicates across QR sources (same physical purchase scanned from two different QRs) — post-MVP."

The wording is binding and identical to ADR-0014 §6.

### 4. Verify the outbound allowlist update

In `.agents/context/outbound-allowlist.md`:

- A row for `https://www1.aade.gr` exists under "Production runtime hosts" with the scope note and the `parser-specialist` consumer.
- A row for `https://epsilondigital-3rdpartc.epsilonnet.gr` exists under "Production runtime hosts" with the same scope note.
- The `https://*.supabase.co` row carries an annotation that the host is used for both data (`/rest/...`) and auth verification (`/auth/v1/.well-known/jwks.json`) — same hostname, no new entry.

### 5. Verify backlog state

In `docs/backlog.md`:

- BLG-0023, BLG-0024, BLG-0025 — all **Ready** (no longer `drift`).
- BLG-0027, BLG-0028, BLG-0030, BLG-0032 — Ready (per their gating notes).
- BLG-0029 — planned (gated on project-owner input).
- BLG-0033, BLG-0034 — planned post-MVP / post-BLG-0023.
- BLG-0026 — **not present** (moved to `docs/done.md`).

In `docs/done.md`:

- Sprint S-010 entry exists with BLG-0026 listed as closed-as-ADR-0014.

In `docs/plan.md`:

- "Just completed" reflects S-010.
- "Next sprint" reads **S-011 implementation** with the Ready queue per the S-010 REV.

### 6. Confirm `make check` posture

Discovery sprints with zero code changes do not run `make check` (per `AGENTS.md` §4.7 + §4.1.1, identical to S-008). The last green run was at S-009 close on 2026-05-09: **346 tests across 21+ suites — green.**

To confirm the current tree still passes (optional, only if you want to be defensive):

```powershell
# Backend
cd backend
ruff check .
mypy app tests
pytest

# Mobile
cd ..\mobile
npx tsc --noEmit
npx jest --silent
```

Expected: identical pass count to S-009 close. (The PowerShell `make check` quirk with the Greek folder name persists per `docs/plan.md`; direct binary invocations are the documented workaround.)

### 7. (No) on-device action

Discovery sprints don't ship anything to the device. **No phone action needed.** The next time you'll touch a phone is the S-011 UREV, which will include the BLG-0023 + BLG-0024 integration step (verifying that a transient backend JWKS-unreachable window does **not** sign the user out).

## What did NOT happen in S-010 (deliberate)

- **No production code change.** All `backend/`, `mobile/`, `db/` source files are byte-identical to S-009 close. (The in-session 2026-05-12 patch to `backend/app/routes/receipts.py` adding the diagnostic log line is in the working tree as a pre-S-010 carry-over; S-011 absorbs it into BLG-0025.)
- **No outbound fetches to AADE or Epsilon Net.** The two new hosts are registered in the allowlist; no actual HTTP call was made to either host in this sprint. Spike fetches happen in S-011 under BLG-0030 (AADE) and inline within BLG-0028 (Epsilon Net), each gated on §5.8.1 consent.
- **No new runtime dependency installed.** `cryptography==45.0.1` is pre-approved in ADR-0015 but lands in `backend/requirements.txt` with the S-011 BLG-0023 PR.
- **No schema migration applied.** The `is_limited_info` column is pre-approved in ADR-0014 but lands in `db/migrations/` with the S-011 BLG-0027 PR.
- **No `AGENTS.md` structural change.** Only §2.2 / §2.7 / §2.8 / §2.9 content edits.

## Open questions parked for S-011 or later

- **Family C (15-hex non-URL codes) identification.** Resolution path: ask the project owner for a photo of the printed receipt + the printed text near the QR. Tracked as BLG-0029.
- **AADE SKU-level data ceiling.** Whether `www1.aade.gr/tameiakes/myweb/q1.php?SIG=...` returns SKU-level or only merchant + total + date. Tracked as BLG-0030 (the spike).
- **The 2026-05-12 `502 upstream_error` from the live device.** May resolve incidentally via BLG-0030 (if that scan was actually an AADE pre-validator misread); otherwise opens BLG-0033 in S-011 close.
- **AADE ToS / robots.txt review.** Tracked as a BLG-0027 acceptance bullet. May force BLG-0027 to narrow to "parse the QR string in-app only; no upstream fetch."

## If something looks wrong

If reading the ADRs you find a decision that contradicts a hard constraint in `AGENTS.md` §2.4 or `agent-runtime-security.md` (§3.2.1), **do not edit the ADR directly** — that would violate `AGENTS.md` §4.4. Instead:

1. Open a discovery-sprint backlog item titled "ADR-0014/0015/0016 reconsideration: <specific concern>" via `docs/backlog.md` per §4.9.1.
2. Tag the relevant agents per §4.11.
3. The next discovery sprint chairs the reconsideration; if accepted, a superseding ADR (e.g. ADR-0017) records the new decision.

Discovery decisions are not infallible. They are recorded, debated, and re-openable. The system is designed for that.
