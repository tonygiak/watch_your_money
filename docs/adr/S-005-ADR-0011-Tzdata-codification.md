# `tzdata` codification (Windows-host `zoneinfo` requirement)

Status: accepted
Date: 2026-05-07
Chair: orchestrator
Participants: agent-safety-officer, engineering-manager, architect, backend-builder, devops-engineer, qa
Co-signs required: agent-safety-officer + engineering-manager (new runtime dependency — `AGENTS.md` §4.11), architect (no architectural impact).

## Context

S-004 implementation introduced `tzdata==2024.2` to `backend/requirements.txt` mid-sprint as **drift** (BLG-0013). The reason: `backend/app/insights/period.py` uses `zoneinfo.ZoneInfo("Europe/Athens")` per ADR-0005 §3 to compute period boundaries, and Python's `zoneinfo` module on Windows hosts has **no system IANA timezone database** to fall back on, so it raises `ZoneInfoNotFoundError` until the `tzdata` PyPI package is installed.

`AGENTS.md` §3.2.1 supply-chain discipline requires runtime-dep additions to be ADR-anchored with `agent-safety-officer` + `engineering-manager` review. The S-004 in-flight addition was correctly tagged as drift and queued for this discovery sprint. This ADR closes the audit-trail gap.

The decision space is small:

1. **Standalone ADR** (this one) — own its own existence under `docs/adr/`. ADR-0007 stays mobile / Expo-scoped; this one stays backend / Python-scoped. No cross-pollution.
2. **Amendment to ADR-0007** — fold the backend dep into the existing Expo runtime-tree ADR. Pro: one fewer ADR file. Con: ADR-0007 is explicitly about the *mobile* runtime tree; mixing in a *backend* dep muddies its scope.

Constraints in scope:

- `AGENTS.md` §3.2.1 — supply-chain discipline; pinned versions; review.
- `AGENTS.md` §3.2.1 — outbound surface; PyPI is already on the allowlist.
- `AGENTS.md` §4.10 — drift handling; this ADR closes the drift cycle.
- ADR-0005 §3 — period boundaries computed in `Europe/Athens` via `zoneinfo`.
- ADR-0007 — mobile runtime tree; out of scope for this question.

## Rounds

### Round 1

- **agent-safety-officer**: I propose **standalone ADR**. Reasoning: ADR-0007 has a clear scope (mobile / Expo) and a well-thumbed table of pinned packages. Adding a Python backend dep to it makes it a *grab-bag* runtime-tree ADR rather than two clean documents. From a supply-chain audit POV, it's also easier to find: future agents looking at "why is `tzdata` in `backend/requirements.txt`" can grep for `tzdata` and find this ADR; if folded into ADR-0007, they have to know to look there. The dep itself: `tzdata` is the **PSF-maintained** Python wrapper around the IANA timezone database. License: APSL-1.0 / public domain (the IANA TZ data has been ruled non-copyrightable). No native code, no scripts, data-only. **Approved.** Pinning: exact (`tzdata==2024.2` already in `backend/requirements.txt`).
- **engineering-manager**: Standalone ADR also separates concerns operationally: ADR-0007 has the `agent-safety-officer` + `engineering-manager` co-sign for the mobile tree; this one gets the same co-signs for the backend tree. Cleaner sign-off matrix. **Co-sign on standalone.**
- **architect**: No architectural impact either way. Lean standalone.
- **backend-builder**: Standalone is also more honest about how the dep is consumed: only the backend's `make install` pulls it; the mobile install path doesn't touch it. Folding it into ADR-0007 would imply otherwise.
- **devops-engineer**: Operationally, on Linux production runtimes (Railway / Render), the system IANA db wins and `tzdata` is shadowed. On Windows dev machines, `tzdata` is the only db `zoneinfo` finds. Both behaviors are correct without any deploy / Dockerfile change.
- **qa**: Test impact: every ADR-0005 §3 period-boundary test in `backend/tests/insights/test_period.py` (and the integration tests that use Athens-TZ) depends on `Europe/Athens` resolving. On the project's Windows dev hosts, that requires `tzdata`. **The pin is mandatory** — going below `tzdata==2024.2` could resurrect bugs in the Greek DST calendar table.

### Round 2 (single confirmation round, uncontested)

- **agent-safety-officer**: No new concerns. Verdict: standalone, approved, exact pin.
- **engineering-manager**: No new concerns.
- **architect**: No new concerns.
- **backend-builder**: No new concerns.
- **devops-engineer**: No new concerns.
- **qa**: No new concerns.

This decision was **uncontested in Round 1** — every participant arrived at "standalone ADR, exact pin, approved" independently. Per `chair-adr-debate.md` minimum-runtime, "Single round is allowed only when the decision is uncontested **and** the ADR records that explicitly." Recording it explicitly here. Round 2 served only as a confirmation round.

## Decision

### 1. Standalone ADR

This ADR is a **standalone** record — ADR-0007 is **not** amended. ADR-0007 covers the mobile / Expo runtime tree; this ADR covers a single backend / Python data-only dep. They live independently in `docs/adr/`.

### 2. The pin

- Package: **`tzdata==2024.2`** (PyPI).
- License: APSL-1.0 / public domain (IANA TZ data).
- Maintainer: Python Software Foundation.
- Side-effects: data-only — no native code, no install hooks, no runtime scripts, no network calls.
- Pinning: exact (no caret).
- Where: `backend/requirements.txt`.
- Why: Python's `zoneinfo` module requires an IANA TZ database. On Linux (Railway / Render) and macOS the OS provides one. On Windows there is no system db, so `zoneinfo.ZoneInfo("Europe/Athens")` per ADR-0005 §3 raises `ZoneInfoNotFoundError` without `tzdata` installed.

### 3. Refresh cadence

- Re-evaluated on every `backend/requirements.txt` audit.
- Bumped if a new IANA TZ database release adds Greek DST changes (rare — Greek DST has been stable since 1996) or if the PSF releases a security fix.
- The bump is a one-line dep update; no ADR is required for routine refresh, but the version change must be captured in the next sprint's LOG per `AGENTS.md` §4.9.3.

### 4. Outbound surface

- **No change.** PyPI (`pypi.org`) is already on `.agents/context/outbound-allowlist.md`.

### 5. Sprint LOG entry

The S-004 LOG already recorded the drift addition (`backend/requirements.txt` change in `S-004-LOG-0001` for BLG-0013). This ADR retroactively closes that drift per `AGENTS.md` §4.10 (drift handling), and the comment block above the `tzdata==2024.2` line in `backend/requirements.txt` is updated in this sprint to point at this ADR id (small in-sprint admin edit, same precedent as BLG-0010 in S-003).

### 6. Audit-trail check

- **Origin**: PyPI / PSF — confirmed.
- **Integrity**: SHA-256 hash recorded in `mobile/package-lock.json`-equivalent for backend? **No** — backend uses `requirements.txt` without a hash file. This ADR records that the backend supply chain currently **does not enforce hash pinning** (only version pinning), which is a known gap; closing it would require either `pip install --require-hashes` plus a `requirements.lock` file or a move to `pip-tools` / `poetry`. That is a separate ADR; opened as a future BLG (`Backend hash-pinning for `pip install`'). For `tzdata` specifically, the integrity risk is bounded: data-only package, PSF maintainer, IANA TZ database is itself authoritative.
- **Side-effects**: none.
- **Secrets**: none introduced.
- **Data flow**: none — no PII, no network calls.
- **Regulatory**: none — public domain TZ data.
- **Auditability**: this ADR + the sprint LOG entry covers it.

## Dissent

None recorded. Single-round consensus.

## Consequences

**Positive:**

- BLG-0013 closes cleanly: the dep was already in `backend/requirements.txt` from S-004 drift; this ADR retroactively codifies it and the comment line in the file updates to point at this ADR id.
- ADR-0007's scope stays clean (mobile / Expo).
- Future Windows dev hosts get a green `make check` out of the box. Linux / macOS production hosts are unaffected.

**Negative:**

- The backend supply chain is still version-pinned but not hash-pinned. Captured as a future BLG (separate from BLG-0013) so this ADR doesn't bundle two debates.

**Follow-ups (added to backlog):**

- BLG-0013 closed (in-sprint admin edit anchored to this ADR). Moves to `docs/done.md`.
- Future BLG (out of scope here): **Backend hash-pinning** for `pip install`. Owner: `agent-safety-officer` + `engineering-manager` + `devops-engineer`. Tracked separately.
