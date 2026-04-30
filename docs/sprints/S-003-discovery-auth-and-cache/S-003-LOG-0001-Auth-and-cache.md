# Sprint S-003 — Log

Audit-trail entries per `AGENTS.md` §4.9.3. Every step records outbound hosts, MCP tools, dependencies, and approvals (even when empty).

## 2026-04-30 17:32 — Sprint kickoff

- Agent: orchestrator (with go)
- Action: User invoked `go` with direction "Move on sprint 3". `orchestrator` confirmed the Ready queue is empty (BLG-0005, 0006, 0007, 0009, 0011, 0012 all `Ready: no`); per `AGENTS.md` §4.1.2 the next sprint is **discovery**. Theme `auth-and-cache` matches `docs/plan.md`. Drafted PLN.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: none
- Outcome: `docs/sprints/S-003-discovery-auth-and-cache/S-003-PLN-0001-Auth-and-cache.md`. User direction honored in scope (no backlog split needed; matches the queued plan exactly).

## 2026-04-30 17:35 — ADR-0004 debate opened

- Agent: orchestrator (chair)
- Action: Opened ADR-0004 ("Phone-OTP provider, flow, rate limits, GDPR posture"). Invited: security-privacy-officer, data-architect, agent-safety-officer, architect, engineering-manager, mobile-builder, backend-builder, product-designer, localization-specialist, qa.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: none
- Outcome: rounds recorded inside the ADR file.

## 2026-04-30 17:50 — ADR-0004 accepted

- Agent: orchestrator
- Action: Closed ADR-0004 after 3 rounds. Decision: **Supabase native phone OTP** via `@supabase/supabase-js`; no widening of the outbound surface; refresh tokens shortened to 14 d; on-device E.164 normalizer with `+30` default; `auth.users` ↔ `public.users` linked via FK + sync trigger; explicit rejection of direct Twilio without a fresh ADR.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: security-privacy-officer + data-architect (auth flow / RLS shape); agent-safety-officer (no new outbound surface; codified rejection of direct Twilio).
- Outcome: `docs/adr/S-003-ADR-0004-Phone-otp-provider.md`.

## 2026-04-30 17:55 — ADR-0005 debate opened

- Agent: orchestrator (chair)
- Action: Opened ADR-0005 ("Insights computation strategy"). Invited: architect, data-architect, engineering-manager, backend-builder, mobile-builder, qa, parser-specialist, localization-specialist.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: none
- Outcome: rounds recorded inside the ADR file.

## 2026-04-30 18:10 — ADR-0005 accepted

- Agent: orchestrator
- Action: Closed ADR-0005 after 3 rounds. Decision: **PostgREST RPC functions** for the math (`insights_summary_for_user`, `insights_top_products_for_user`); FastAPI orchestrates with Athens-TZ period boundaries; decimal-as-string responses; categories = `business_category` ∪ `"untagged"`. Extends ADR-0002's "no client-supplied identity" rule to the insights endpoints (consequence captured in BLG-0010 scope).
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: data-architect + architect (engineering decision crossing schema + endpoint boundaries).
- Outcome: `docs/adr/S-003-ADR-0005-Insights-computation.md`.

## 2026-04-30 18:15 — ADR-0006 debate opened

- Agent: orchestrator (chair)
- Action: Opened ADR-0006 ("Offline cache strategy + at-rest encryption"). Invited: mobile-builder, security-privacy-officer, architect, engineering-manager, agent-safety-officer, qa, product-designer, localization-specialist.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: none
- Outcome: rounds recorded inside the ADR file.

## 2026-04-30 18:30 — ADR-0006 accepted

- Agent: orchestrator
- Action: Closed ADR-0006 after 3 rounds. Decision: **AsyncStorage** + **AES-256-GCM** via `@noble/ciphers` with the symmetric key in `expo-secure-store`; **LRU cap at 200** receipts; sanitizer drops `raw_html` and any field outside the documented cacheable subset (default-deny); offline UX banner + disabled actions per ADR-0006 §7. Threat model excludes rooted/jailbroken devices.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none (deps are committed via ADR-0007 in the same sprint; no actual install yet)
- Sensitive approvals: security-privacy-officer + architect (financial data on device + encryption decision).
- Outcome: `docs/adr/S-003-ADR-0006-Offline-cache-strategy.md`.

## 2026-04-30 18:35 — ADR-0007 debate opened

- Agent: orchestrator (chair)
- Action: Opened ADR-0007 ("Expo runtime tree — pinned packages, supply-chain review, gate re-inclusion"). Invited: agent-safety-officer, engineering-manager, mobile-builder, devops-engineer, architect, qa.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: none
- Outcome: rounds recorded inside the ADR file.

## 2026-04-30 18:40 — `review-external-surface.md` run on the proposed dep set

- Agent: agent-safety-officer
- Action: Ran the `review-external-surface.md` checklist against the 17 runtime + 6 dev packages proposed by `mobile-builder` for ADR-0007. Verdict: **approved with conditions** (commit `package-lock.json` in the same PR, set `EXPO_NO_TELEMETRY=1` in `.env.sample`, open a follow-up BLG to re-evaluate `react-native-chart-kit` post-MVP). Verdict copied into ADR-0007 §Round 2.
- Outbound hosts contacted: none (the review is a static audit; no actual `npm install` was performed in this sprint)
- MCP tools invoked: none
- Dependencies added: none in this sprint — the install lands in S-004 implementation under BLG-0012, with `npm ci` against the ADR-pinned `package.json` + committed `package-lock.json`.
- Sensitive approvals: agent-safety-officer **conditional approval** on the proposed pinned set; engineering-manager co-sign on the version table; architect non-block; devops-engineer noted EAS impact.
- Outcome: ADR-0007 §Round 2 captures the verbatim verdict; BLG-0012 acceptance bullets reflect the three conditions.

## 2026-04-30 18:50 — ADR-0007 accepted

- Agent: orchestrator
- Action: Closed ADR-0007 after 3 rounds. Decision: **Expo SDK 51** with the version table in ADR-0007 §2 (exact pins, no carets); `package-lock.json` committed; `npm ci` discipline; `EXPO_NO_TELEMETRY=1` in `.env.sample`; gate re-inclusion plan locked. No new outbound host (npm + Expo already on `.agents/context/outbound-allowlist.md`).
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none in this sprint (pinning decision only).
- Sensitive approvals: agent-safety-officer + engineering-manager (new runtime dependency / supply-chain); architect (architecture impact).
- Outcome: `docs/adr/S-003-ADR-0007-Expo-runtime-tree.md`.

## 2026-04-30 18:55 — DES-0002 + DES-0003 drafted

- Agent: product-designer (with mobile-builder, localization-specialist, qa)
- Action: Drafted DES-0002 (Login screen — state machine, layout, Greek-first copy, accessibility, telemetry, phone normalizer rules) on top of ADR-0004. Drafted DES-0003 (Insights screen — period selector, by-category, top-merchants, top-products, empty + offline states, Greek copy) on top of ADR-0005.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: localization-specialist on Greek copy (`login.*`, `insights.*`, `offline.*`); product-designer on the layout flow; security-privacy-officer reviewed for telemetry-no-PII (counts only).
- Outcome: `docs/sprints/S-003-discovery-auth-and-cache/S-003-DES-0002-Login-ux.md`, `docs/sprints/S-003-discovery-auth-and-cache/S-003-DES-0003-Insights-ux.md`.

## 2026-04-30 19:00 — BLG-0010 admin edit to AGENTS.md §5.3.2

- Agent: agents-doctor (with orchestrator)
- Action: Reconciled `AGENTS.md` §5.3.2 with ADR-0002 + ADR-0005: dropped `user_id` from `/receipts/parse` body, dropped `user_id` from every other endpoint's query, added the explicit "Authentication contract" preamble that anchors all endpoints to Bearer JWT + verified `sub`. Insights endpoints' shape anchored to ADR-0005 §4. The §4.4 tie-breaker precedent is now codified in §5.3.2 itself.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: agents-doctor (structural); architect + engineering-manager (API contract); security-privacy-officer (no client-supplied identity); orchestrator (sprint LOG records the change per `AGENTS.md` §4.11).
- Outcome: `AGENTS.md` §5.3.2 patched. BLG-0010 moved to `docs/done.md`.

## 2026-04-30 19:05 — Backlog refined

- Agent: product-manager (with orchestrator)
- Action: BLG-0005, BLG-0006, BLG-0007, BLG-0012 marked **Ready: yes** with full Acceptance / Design / Approach / Size / Impact-notes / Links per `AGENTS.md` §4.1.3. BLG-0009 and BLG-0011 stay **Ready: no** but with sharper acceptance reflecting ADR-0007 (chart-kit follow-up captured implicitly under BLG-0012). BLG-0010 closed and moved to `docs/done.md`. `docs/backlog.md` rewritten with the S-003 close header.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: orchestrator co-sign that all four newly-Ready items have every Definition-of-Ready field filled.
- Outcome: `docs/backlog.md`, `docs/done.md` updated.

## 2026-04-30 19:08 — Decisions index updated

- Agent: architect
- Action: Indexed ADR-0004, ADR-0005, ADR-0006, ADR-0007 in `.agents/context/decisions.md` with one-paragraph summaries each.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: none
- Outcome: `.agents/context/decisions.md` updated.

## 2026-04-30 19:10 — Outbound allowlist confirmed unchanged

- Agent: agent-safety-officer
- Action: Confirmed that none of ADR-0004, ADR-0005, ADR-0006, ADR-0007 introduces a new outbound host. `.agents/context/outbound-allowlist.md` remains as it was at S-002 close. (Supabase + e-invoicing.gr + Railway/Render + Expo + npm + pypi.)
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: none required (no change).
- Outcome: `.agents/context/outbound-allowlist.md` unchanged.

## 2026-04-30 19:15 — Quality-gate smoke check

- Agent: qa (with engineering-manager)
- Action: Ran `make check` to confirm the discovery sprint did not silently regress the gate even though no production code changed. **Operational note for next agents:** on this Windows shell, the bare `make` resolves to a different binary that misreports the target tree; using `& "C:\Program Files (x86)\GnuWin32\bin\make.exe" -f Makefile check` from PowerShell works reliably. Logged so S-004 implementation does not trip on the same quirk.
- Outbound hosts contacted: pypi.org (pip — Python deps install during `install-backend`), registry.npmjs.org (`npm install` during `install-mobile`). Both already on `.agents/context/outbound-allowlist.md`.
- MCP tools invoked: none
- Dependencies added: none in the repo (`mobile/package.json` unchanged; backend `requirements-dev.txt` unchanged). The `npm install` re-resolved against the existing manifest only.
- Sensitive approvals: engineering-manager confirms gate green.
- Outcome: 38 backend tests + 52 mobile tests = 90 tests passing. ruff clean. mypy "Success: no issues found in 31 source files". jest 5 suites passed. `make check: green`.

## 2026-04-30 19:20 — Sprint review + handoff

- Agent: orchestrator + go
- Action: Wrote REV + UREV. Picked next sprint type = **implementation S-004** (theme `login-insights-cache-runnable-scanner`). Recorded sign-offs per `AGENTS.md` §4.11.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: §4.11 sign-offs collected per ADR (architect + engineering-manager on ADR-0005 + ADR-0007; security-privacy-officer + data-architect on ADR-0004 + ADR-0006; agent-safety-officer on ADR-0007 supply-chain review and confirming no new outbound surface; product-designer + localization-specialist on DES-0002 + DES-0003; agents-doctor + orchestrator on the BLG-0010 §5.3.2 edit).
- Outcome: sprint S-003 closed.
