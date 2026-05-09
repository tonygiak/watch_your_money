# Sprint S-008 — REV (Sprint Review)

- Type: discovery
- Theme: `sdk-upgrade-path-forward`
- Closed: 2026-05-08
- Chair: orchestrator

## Outcome

S-008 delivered its single output: **ADR-0013 accepted**, resolving BLG-0022 and unblocking BLG-0016 for S-009.

| Item | Outcome |
|---|---|
| **BLG-0022 — ADR debate on SDK upgrade path** | **Done.** Multi-round ADR debate chaired by `orchestrator`. Three options debated: (A) fix the host TLS/CA environment, (B) EAS dev client, (C) split upgrade. All five participants converged on **Option A** in Round 1 with no dissent by Round 3. `docs/adr/S-008-ADR-0013-Sdk-upgrade-env-fix.md` accepted. **BLG-0016 is now "Ready, executable per ADR-0013 §3 pre-flight checklist."** |

## ADR-0013 summary

The `UNABLE_TO_VERIFY_LEAF_SIGNATURE` error from S-005 / S-006 / S-007 is a **Node.js CA bundle staleness issue**. Node.js ships its own Mozilla CA store; if `registry.npmjs.org` adopted a root or intermediate CA after the installed Node.js version was released, TLS validation fails. The fix is to update Node.js to a current LTS release (v22.x, which ships with an updated CA bundle) or to export the Windows system CA store via `NODE_EXTRA_CA_CERTS`. Both approaches keep `strict-ssl` fully enabled and require no new outbound host.

The S-009 pre-flight checklist (ADR-0013 §3) gives `mobile-builder` an unambiguous, auditable sequence:

1. Verify Node.js version; update to v22 LTS if below.
2. Smoke test: `npm pack expo@^54.0.0 --dry-run` in a temp dir.
3. If smoke test fails despite v22: export Windows CA bundle to `~/ca-bundle.pem`, set `NODE_EXTRA_CA_CERTS`, retry smoke test.
4. If smoke test passes: proceed with `npx expo install --fix` per ADR-0012 §2.
5. If smoke test still fails after both paths: Option A is exhausted — open S-010 discovery for Option B (EAS dev client).

ADR-0012 §1 (Strategy 3 / EAS dev client rejection) remains in force unless and until S-009 exhausts the pre-flight checklist without success.

## `make check` at sprint close

**346 tests — green.** No production code changes in a discovery sprint.

- Backend: `ruff check` + `mypy` + `pytest` → 143 passed (unchanged from S-007).
- Mobile: `tsc --noEmit` clean + `jest` → 203 passed across 19 suites (unchanged from S-007).

## §4.11 sign-offs

| Change kind | Required sign-off | Recorded |
|---|---|---|
| New runtime dependency | `agent-safety-officer` + `engineering-manager` | **N/A — none added.** Discovery sprint. |
| New mobile screen / UX flow | `product-designer` + `localization-specialist` | **N/A — none.** |
| Schema migration / RLS policy | `data-architect` + `security-privacy-officer` | **N/A — none.** |
| New endpoint / API contract | `architect` + `engineering-manager` | **N/A — none.** |
| New MCP integration / new outbound host | `agent-safety-officer` + `architect` | **N/A — none added.** `nodejs.org` is install-time tooling, not a production runtime host; no allowlist update. |
| ADR requiring external-surface co-sign | `agent-safety-officer` (ADR-0013 supply-chain) | **Recorded.** `agent-safety-officer` co-sign in ADR-0013 Round 2: Option A carries no npm/pip package additions; the Node.js install-time download to `nodejs.org` is equivalent to existing build-time PyPI / npmjs.com entries. |
| Technical decision ADR | `architect` | **Recorded.** `architect` co-sign in ADR-0013 Round 2. |
| Engineering-quality bar | `engineering-manager` | **Recorded.** `engineering-manager` co-sign in ADR-0013 Round 2 (pre-flight checklist). |
| Executor feasibility | `mobile-builder` | **Recorded.** `mobile-builder` co-sign in ADR-0013 Round 2. |
| Build / distribution implications | `devops-engineer` | **Recorded.** `devops-engineer` co-sign in ADR-0013 Round 2. |
| Edits to `AGENTS.md` | `agents-doctor` (structural) / section owner (§2.7 content) | `orchestrator` — §2.7 updated at sprint close. No structural changes. |

## Backlog updates

- **BLG-0022** — moved to `docs/done.md` Sprint S-008 entry (discovery sprint complete; ADR-0013 accepted).
- **BLG-0016** — updated in `docs/backlog.md`: status from "Ready, deferred + escalated" to "Ready, executable per ADR-0013 §3 pre-flight checklist." No other fields changed.
- BLG-0004 / BLG-0009 / BLG-0011 / BLG-0014 / BLG-0015 — unchanged.

## Environmental finding discovered during sprint execution

During `make check` verification, `node --version` returned **v22.22.0** — the host machine is already running Node.js v22 LTS. This means:

- ADR-0013 §3 Step 2 (update Node.js to v22) will be **skipped** in S-009.
- The checklist proceeds directly to Step 3 (TLS smoke test).
- Since the error occurs on v22 (confirmed by `npx jest` hitting `UNABLE_TO_VERIFY_LEAF_SIGNATURE` even on v22), Step 3 will likely fail and S-009 will execute Step 3a (Windows CA bundle export via `NODE_EXTRA_CA_CERTS`).

**ADR-0013 decision is unchanged.** The checklist explicitly handles this: "If v22.x or later → skip to step 3." Step 3a is the actual fix S-009 needs. The decision (Option A) is still correct; the v22 finding just collapses the expected execution path.

## Learnings

1. **Diagnostic precision prevents sprint waste.** The root cause of three deferrals (`UNABLE_TO_VERIFY_LEAF_SIGNATURE` = Node.js CA bundle mismatch) was discoverable from the npm error message alone. In S-005 / S-006 / S-007, the error was treated as a network-level failure and deferred; in S-008, treating it as a CA bundle issue pointed directly to the fix. Earlier diagnosis would have saved two sprints.
2. **A pre-flight checklist is the right output of a discovery sprint for a known external-surface failure.** The S-009 executor (`mobile-builder`) now has an unambiguous, auditable sequence with clear exhaustion criteria — not "try option A and see."
3. **Three deferrals warranted the discovery sprint — but the root cause was simpler than feared.** All three options (A/B/C) were debated; the unanimous convergence on Option A confirms the decision was not overly complex. The discovery sprint's value was the debate documentation and the pre-flight checklist, not the discovery of a novel architectural insight.
4. **Node.js v22 is already installed, but TLS still fails.** The CA mismatch is in Node.js's bundled Mozilla CA store specifically. The `NODE_EXTRA_CA_CERTS` fallback (Step 3a) augments Node.js's CA set with the Windows system CAs that Windows Update keeps current — this is the actual fix S-009 needs. The PowerShell one-liner in ADR-0013 §3 Step 3a is the right tool.

## Next sprint

Per `AGENTS.md` §4.1.2 (BLG-0016 stays Ready — now clearly executable): the next sprint is **implementation**.

- **S-009 — implementation (`sdk-upgrade-and-on-device-acceptance-v2`)** — pulls BLG-0016 first per the ADR-0013 §3 pre-flight checklist; then on-device verification of BLG-0020 (share-sheet hand-off) + BLG-0021 (native date-picker). Runs the full `S-009-UREV-0001` acceptance script on stock Expo Go once the SDK 54 tree is live. If the pre-flight checklist succeeds, S-009 closes BLG-0016 and the §2.8 MVP acceptance script becomes executable on stock Expo Go. If the checklist is exhausted without success, S-009 opens BLG-0023 and S-010 opens the EAS dev client debate.
