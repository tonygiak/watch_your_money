# Sprint S-010 — Receipt-format scope expansion + auth modernization

- Type: discovery
- Theme: `receipt-format-scope-and-auth-modernization`
- Number: S-010
- Start: 2026-05-12
- Chair: orchestrator
- Participants: `product-owner`, `product-manager`, `architect`, `parser-specialist`, `data-architect`, `security-privacy-officer`, `agent-safety-officer`, `localization-specialist`, `engineering-manager`, `backend-builder`, `mobile-builder`, `product-designer`, `qa`, `devops-engineer`

## Why this sprint exists

S-009 closed with the §2.8 MVP bullets 4 (on-device scanning) and 9 (PDF export → native share sheet) **reachable on a real device**. The first live on-device acceptance run on 2026-05-12 surfaced **two distinct drift findings** that block the next implementation sprint until they are decided:

1. **Drift A — Backend auth misconfigured against Supabase asymmetric JWT signing keys.** Every `POST /receipts/parse` returned 401 because Supabase rotated the project from legacy HS256 to ECC P-256 (ES256) signing keys six days earlier. The hand-rolled HS256-only verifier in `backend/app/auth.py` (ADR-0002 §1, deliberately stdlib-only) refused every ES256 token. Short-term mitigation (Option A — revert to a Legacy HS256 signing key in the Supabase dashboard) verified end-to-end the same session. **Long-term fix is BLG-0023 (asymmetric JWT verification) + BLG-0024 (soft auth-error handling) + BLG-0025 (formalize the diagnostic log line)**.

2. **Drift B — Real Greek receipts do not match the §2.8 "Entersoft or SoftOne via e-invoicing.gr" scope.** Of the receipts the test user scanned, **0 were `e-invoicing.gr` viewer URLs**. Three distinct Greek QR families appeared (BLG-0026):
   - **Family A — AADE `q1.php?SIG=<hex>` signature URLs** (8 scans — the dominant Greek consumer-receipt format).
   - **Family B — Epsilon Net `epsilondigital-3rdpartc.epsilonnet.gr/fd/<hash>:<n>` provider URLs** (1 scan).
   - **Family C — 15-hex-char non-URL codes** like `45C07BD642067E5` (5 scans of the same physical receipt — unidentified).

Per `AGENTS.md` §4.1.1 ("No new architectural decisions in a delivery sprint") and §4.4 (multi-round chaired ADR debate before any meaningful decision), both drift findings require chaired discovery before any implementation sprint can pull them as Ready items.

## Goals

1. **Settle the receipt-format scope (BLG-0026).** Multi-round ADR per `AGENTS.md` §4.4 deciding, **for each family A / B / C**: (a) is it in MVP §2.8 scope, (b) does the chosen integration path preserve the §2.2 SKU-level differentiator, (c) does it require a new outbound host (allowlist update by `agent-safety-officer`), (d) does it require a new auth surface (myDATA B2C / user TIN). Output: **ADR-0014** + per-family Ready BLG(s) (BLG-0027 AADE, BLG-0028 Epsilon Net, BLG-0029 Family C identification, BLG-0030 AADE HTML shape spike).
2. **Modernize the backend JWT verifier (BLG-0023).** Multi-round ADR replacing the HS256-only stdlib verifier with an asymmetric-capable verifier (ES256 + RS256 via JWKS, with HS256 kept as a transition path). Output: **ADR-0015** + Ready BLG-0023 + Ready BLG-0024 (mobile soft-auth-error coupling).
3. **Formalize the JWT-rejection diagnostic log line (BLG-0025).** Short ADR amending ADR-0002 §6 to recognize JWT *headers* as PII-safe public metadata; lock the contract with a regression test + a redaction test. Output: **ADR-0016** + Ready BLG-0025.
4. **Confirm Option A sufficiency until ADR-0015 lands.** Short DES note (DES-0006) confirming the 2026-05-12 HS256-rollback works end-to-end and is acceptable as the production mitigation until BLG-0023 ships in S-011.
5. **Update the outbound allowlist** (`.agents/context/outbound-allowlist.md`) with `www1.aade.gr` and `epsilondigital-3rdpartc.epsilonnet.gr`, scoped to **parser fetches** (production runtime) and **spike fetches** (under `docs/spikes/` with §5.8.1 consent), per `agent-safety-officer` sign-off recorded in ADR-0014.

## Scope

**In scope for S-010:**

- BLG-0026, BLG-0023, BLG-0024, BLG-0025.
- ADR-0014 (receipt-format scope), ADR-0015 (asymmetric JWT), ADR-0016 (JWT header logging amendment).
- DES-0006 (Option A sufficiency).
- New Ready BLGs emerging from the ADRs (BLG-0027 / 0028 / 0029 / 0030 — sized at sprint close).
- Outbound allowlist update for AADE + Epsilon Net hosts.
- `docs/plan.md`, `docs/backlog.md`, `docs/done.md`, `AGENTS.md` §2.7 updates at sprint close per `AGENTS.md` §4.1.5.

**Out of scope (explicit):**

- No production code changes (`AGENTS.md` §4.1.1 — discovery sprints don't ship). The 2026-05-12 in-session diagnostic-log addition to `backend/app/routes/receipts.py` stays in the working tree as a pre-S-010 patch; the S-011 implementation sprint that lands ADR-0015 will absorb it via BLG-0025.
- No actual AADE / Epsilon Net spike fetches in this sprint — fixture acquisition under §5.8.1 consent is the gating risk for BLG-0030. The ADR records the allowlist update; the fetch happens in S-011 (or later) under the Ready BLG-0030.
- No EAS / pre-launch ADR work (ADR-0007 §7 — deferred to a later discovery sprint).
- BLG-0004 (real-receipt fixtures), BLG-0009 (CI drift hook), BLG-0011 (language switch), BLG-0014 (chart-kit re-eval), BLG-0015 (live insights-RPC test) — unchanged. They remain post-MVP.
- The §2.9 out-of-scope list refresh — folded into S-012+ once the AADE limited-info scope from ADR-0014 is verified by an S-011 spike.

## Ready items pulled

None — this is a discovery sprint. The Ready items are the **output** of S-010, not the input.

## Risks & known unknowns

- **Risk: AADE `q1.php?SIG=...` may genuinely not expose SKU-level data.** If the verification page returns only merchant + AFM + total + date + signature, BLG-0027 ships as a "limited-info" adapter. The §2.2 differentiator survives because we still ship SKU-level for Entersoft / SoftOne / Epsilon Net receipts; we just no longer claim SKU-level for **every** Greek receipt. Mitigation: ADR-0014 explicitly chooses a "limited-info" path with a UI banner, and BLG-0030 (HTML-shape spike) confirms the ceiling before BLG-0027 ships.
- **Risk: Family C may not be identifiable without the printed receipt.** Mitigation: BLG-0029's acceptance bullets include "request a photo of the QR area + the printed text near the QR from the project owner" as the first step.
- **Risk: The asymmetric JWT verifier requires a new runtime dependency (`cryptography` or equivalent).** Mitigation: ADR-0015 enumerates candidates (`cryptography`, `PyJWT[crypto]`, hand-rolled with stdlib) with `agent-safety-officer` + `engineering-manager` co-sign on the choice.
- **Risk: JWKS endpoint adds new failure modes** (network timeout, key rotation, kid mismatch). Mitigation: ADR-0015 §4 defines the cache contract (TTL, `kid`-miss refetch, hard-fail on JWKS unreachable — no silent allow).
- **Risk: ADR debates expand into scope creep** (e.g. re-litigating EU expansion mid-sprint). Mitigation: chair (`orchestrator`) closes rounds the moment new concerns stop arriving; any tangent becomes a new backlog item, not an in-sprint decision.

## User direction (if `go` was used)

- Direction: bare `go` (no extra text).
- Honored in scope: yes — selection follows the orchestrator default (no Ready items → discovery sprint), and the discovery theme is already pre-shaped by the live drift findings recorded in `docs/plan.md` between S-009 close and this sprint start.

## Definition of done

- `docs/adr/S-010-ADR-0014-Receipt-format-scope-expansion.md` accepted (multi-round debate; chair + participants + dissent recorded).
- `docs/adr/S-010-ADR-0015-Asymmetric-jwt-verification.md` accepted (multi-round debate; supersedes ADR-0002 §1 + amends §3 / §6).
- `docs/adr/S-010-ADR-0016-Jwt-header-logging.md` accepted (amends ADR-0002 §6).
- `docs/sprints/S-010-.../S-010-DES-0006-Auth-fix-option-a-sufficiency.md` written.
- BLG-0023, BLG-0024, BLG-0025 updated in `docs/backlog.md` to **Ready** with full §4.9.1 schema.
- BLG-0027 (AADE adapter), BLG-0028 (Epsilon Net adapter), BLG-0029 (Family C identification), BLG-0030 (AADE HTML-shape spike) added to `docs/backlog.md` per §4.9.1 (Ready status depends on fixture-acquisition gating recorded per BLG).
- BLG-0026 moved to `docs/done.md` as the umbrella discovery item that produced ADR-0014.
- `.agents/context/outbound-allowlist.md` updated with `www1.aade.gr` + `epsilondigital-3rdpartc.epsilonnet.gr` (scoped to parser + spike fetches), `agent-safety-officer` sign-off recorded.
- `docs/plan.md` rewritten to reflect S-010 close + S-011 next-sprint theme.
- `AGENTS.md` §2.7 snapshot updated (no §2.6 change — no user-visible behavior shipped).
- Sprint LOG records: chair invoked, agents participated, no outbound hosts contacted, no MCP tools invoked, no dependencies added, sensitive approvals recorded.
- `make check` **not run** — discovery sprint, no code changed. `AGENTS.md` §4.7 expressly allows this.
