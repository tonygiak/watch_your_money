# Sprint S-008 — LOG

- Type: discovery
- Theme: `sdk-upgrade-path-forward`
- Date: 2026-05-08
- Chair: orchestrator

## Sprint log entries

---

### 2026-05-08 — Sprint open

- Agent: orchestrator
- Action: Opened S-008 discovery sprint. Created sprint directory `docs/sprints/S-008-discovery-sdk-upgrade-path-forward/`. Wrote `S-008-PLN-0001`.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: none
- Outcome: Sprint directory and PLN created. Sprint scope confirmed: multi-round ADR debate on BLG-0016 third-deferral options; no production code changes.

---

### 2026-05-08 — ADR-0013 debate opened (Round 1)

- Agent: orchestrator (chair)
- Action: Opened multi-round ADR debate per `AGENTS.md` §4.4. Invited `agent-safety-officer`, `architect`, `engineering-manager`, `mobile-builder`, `devops-engineer`. Presented three options: (A) host TLS/CA environment fix, (B) ADR-0012 §1 amendment toward EAS dev client, (C) split-into-two-upgrade approach.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: none
- Outcome: Round 1 positions recorded in `S-008-ADR-0013-Sdk-upgrade-env-fix.md` Round 1 section. All five participants independently converged on Option A as the correct first step. Key insight from `agent-safety-officer`: the `UNABLE_TO_VERIFY_LEAF_SIGNATURE` error is a Node.js CA bundle staleness issue — the fix is updating Node.js (which ships an updated Mozilla CA bundle) or exporting the Windows system CA trust store via `NODE_EXTRA_CA_CERTS`. Both paths maintain `strict-ssl` fully enabled and add no new outbound host.

---

### 2026-05-08 — ADR-0013 debate Round 2

- Agent: orchestrator (chair)
- Action: Drove Round 2. Focused on: (a) finalizing the S-009 pre-flight checklist text (`engineering-manager` proposed; all reviewed and approved); (b) confirming the Option A exhaustion criterion (both Node.js update AND `NODE_EXTRA_CA_CERTS` fallback must be tried before escalating to Option B in S-010); (c) confirming `nodejs.org` is install-time tooling, not a new production runtime host; (d) confirming BLG-0014 remains passive per ADR-0012 §6.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: `agent-safety-officer` co-sign on supply-chain footprint of Option A (recorded in ADR-0013); `architect` co-sign on technical decision; `engineering-manager` co-sign on quality bar; `mobile-builder` co-sign on executor feasibility; `devops-engineer` co-sign on build/distribution implications.
- Outcome: Pre-flight checklist finalized (Step 1–4 with fallback Step 3a). All participants approved. No dissent.

---

### 2026-05-08 — ADR-0013 Round 3 and close

- Agent: orchestrator (chair)
- Action: Round 3 — confirmed no new concerns from any participant. Declared rounds closed. Wrote and accepted `docs/adr/S-008-ADR-0013-Sdk-upgrade-env-fix.md` (Status: accepted).
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: none (all approvals recorded in Round 2 entry above and in the ADR)
- Outcome: ADR-0013 accepted. BLG-0016 status updated to "Ready, executable per ADR-0013 §3." BLG-0022 completed.

---

### 2026-05-08 — Backlog, done, plan, AGENTS.md updates

- Agent: orchestrator
- Action: Updated `docs/backlog.md` (BLG-0016 status updated; BLG-0022 removed). Updated `docs/done.md` (BLG-0022 entry added under S-008). Updated `docs/plan.md` (next sprint = S-009 implementation). Updated `AGENTS.md` §2.7 (sprint snapshot reflects S-008 close).
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: none
- Outcome: All housekeeping docs updated. Sprint artifacts complete.

---

### 2026-05-08 — make check verification + new environmental finding

- Agent: orchestrator + qa + mobile-builder
- Action: Verified `make check` green. Discovery sprint introduced no production code changes — test suite unchanged from S-007 close. Ran: `ruff check .` (backend, all checks passed), `mypy app tests --no-incremental` (backend, success: no issues in 52 source files), `pytest` (backend, 143 passed, 2 warnings in 1.80s), `tsc --noEmit` (mobile, clean), `jest.cmd` (mobile, 203 passed across 19 suites). Additionally discovered an **important new environmental data point** during sprint execution:
  - `node --version` → **v22.22.0** — the host machine is **already running Node.js v22 LTS**. This means the ADR-0013 §3 pre-flight checklist Step 2 (update Node.js to v22) will be **skipped** in S-009. The checklist proceeds directly to Step 3 (TLS smoke test), and if that fails, to Step 3a (Windows CA bundle export via `NODE_EXTRA_CA_CERTS`).
  - The `UNABLE_TO_VERIFY_LEAF_SIGNATURE` error was independently confirmed to still occur on Node.js v22.22.0 when `npx` attempted to download `jest` from `registry.npmjs.org` during mobile test setup (the mobile `node_modules/` directory was absent from the working tree). Mobile tests ran successfully after `npm install --prefer-offline` restored `node_modules` from the local npm cache — confirming the S-007 pattern.
  - **Impact on ADR-0013**: the decision and checklist are correct as written. The Node.js version check (Step 1) answers "already v22; skip Step 2; proceed to Step 3." The TLS error on Node.js v22 means the root cause is the CA bundle mismatch in Node.js's bundled store specifically (not Node.js version staleness per se), which makes Step 3a (Windows CA export) the path S-009 will actually need to follow. The ADR-0013 decision is unchanged — Option A is still correct; just the first branch of the checklist (Step 2) will be skipped.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none (mobile `node_modules/` restored from local npm cache via `npm install --prefer-offline`)
- Sensitive approvals: none
- Outcome: `make check` green (346 tests). New finding documented. Sprint closed.
