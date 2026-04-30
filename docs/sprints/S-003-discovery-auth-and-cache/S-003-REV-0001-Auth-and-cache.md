# Sprint S-003 — Review

- Type: discovery
- Closed: 2026-04-30
- Chair: orchestrator

## Outcomes

- **ADR-0004** accepted: Supabase native phone OTP via `@supabase/supabase-js`; no widening of outbound surface; refresh tokens shortened to 14 d; on-device E.164 normalizer with `+30` default; explicit rejection of direct Twilio. `auth.users` ↔ `public.users` linked via FK + sync trigger; deletion order recorded for Art. 17 right to erasure.
- **ADR-0005** accepted: PostgREST RPC functions for week / month / year + previous-period math; FastAPI orchestrates with **Athens-TZ** boundaries; decimal-as-string in responses; categories = `business_category` ∪ `"untagged"` for MVP; inferred-category deferred. Extends ADR-0002's "no client-supplied identity" rule to the insights endpoints (consequence reflected in BLG-0010).
- **ADR-0006** accepted: AsyncStorage substrate + AES-256-GCM via `@noble/ciphers` with the symmetric key in `expo-secure-store`; LRU cap at 200 receipts; sanitizer drops `raw_html` and any field outside the documented cacheable subset; offline UX banner + disabled actions per ADR-0006 §7. Threat model excludes rooted/jailbroken devices, recorded.
- **ADR-0007** accepted: Expo SDK 51 with the exact-pinned package set in §2 (17 runtime + 6 dev); `package-lock.json` committed; `npm ci` discipline; `EXPO_NO_TELEMETRY=1` in `.env.sample`; gate re-inclusion plan locked. `agent-safety-officer` supply-chain review captured verbatim in Round 2 ("approved with conditions"). `react-native-chart-kit` flagged for re-evaluation post-MVP.
- **DES-0002** drafted: full Login state machine, layout, Greek-first copy, accessibility, telemetry rules, phone-normalizer rules.
- **DES-0003** drafted: Insights screen layout, period selector, by-category / top-merchants / top-products sections, empty + offline states, full Greek copy.
- **BLG-0010 closed**: `AGENTS.md` §5.3.2 reconciled with ADR-0002 + ADR-0005. Body shape `{ "qr_url": string }` for `/receipts/parse`; `user_id` removed from every other endpoint's query; insights endpoints anchored to ADR-0005 §4. The "no client-supplied identity" rule is now codified in `AGENTS.md` itself, not just in ADRs.
- **4 backlog items moved to Ready**: BLG-0005 (Login + OTP), BLG-0006 (Insights endpoints + screen), BLG-0007 (Encrypted offline cache + offline UX), BLG-0012 (Expo runtime tree install).
- **2 backlog items kept `planned`** with sharper acceptance: BLG-0009 (drift-detection CI), BLG-0011 (Profile language switch).
- **`docs/plan.md`** updated: next sprint = **S-004 implementation (`login-insights-cache-runnable-scanner`)**.
- **`.agents/context/decisions.md`** indexed with ADR-0004..0007.
- **`AGENTS.md` §2.7** updated.

## `make check`

- Status: **green**.
- Last run: 2026-04-30 19:15.
- Backend: ruff (clean), mypy ("Success: no issues found in 31 source files"), pytest (38 passed in 2.80 s).
- Mobile: tsc --noEmit (clean), jest (52 passed in 3.65 s, 5 suites).
- Note: discovery-sprint smoke check — no production code changed in S-003. Same precedent as S-001 close.
- **Windows quirk recorded**: a bare `make check` from PowerShell can resolve the wrong `make` shim and report `No rule to make target 'check'`; using the explicit GnuWin32 binary works (`& "C:\Program Files (x86)\GnuWin32\bin\make.exe" -f Makefile check`). Logged in the LOG so S-004 doesn't trip.

## Sign-offs (`AGENTS.md` §4.11)

- **ADR-0004 (auth flow change)**: `security-privacy-officer` + `data-architect`. `agent-safety-officer` confirmed no new external surface (Supabase already on the allowlist) and codified the rejection of direct Twilio.
- **ADR-0005 (engineering decision crossing schema + endpoint boundaries)**: `data-architect` + `architect`. `engineering-manager` reviewed for SQL footprint discipline.
- **ADR-0006 (data-flow change for financial data on device)**: `security-privacy-officer` + `architect`. `agent-safety-officer` reviewed the four new mobile deps in scope (full sign-off attached to ADR-0007).
- **ADR-0007 (new runtime dependency / supply-chain delta)**: `agent-safety-officer` + `engineering-manager`. `architect` reviewed the SDK choice. `devops-engineer` noted EAS impact for S-004.
- **DES-0002 + DES-0003 (new mobile screens / UX flows)**: `product-designer` + `localization-specialist`. `qa` reviewed reducer testability. `security-privacy-officer` reviewed telemetry-no-PII rules.
- **BLG-0010 (edit to `AGENTS.md` §5.3.2)**: `agents-doctor` (structural) + `architect` + `engineering-manager` (API contract) + `security-privacy-officer` (auth posture). `orchestrator` recorded the change in the LOG.
- **No new external surface introduced this sprint.** `agent-safety-officer` confirms `.agents/context/outbound-allowlist.md` is unchanged.

## ADRs decided

- **ADR-0004** — Phone-OTP provider, flow, rate limits, and GDPR posture.
- **ADR-0005** — Insights computation strategy (PostgREST RPCs + FastAPI orchestration).
- **ADR-0006** — Offline cache strategy + at-rest encryption.
- **ADR-0007** — Expo runtime tree (pinned packages, supply-chain review, gate re-inclusion).

## Items moved backlog → done

- **BLG-0010** — Reconcile `AGENTS.md` §5.3.2 wording with ADR-0002 (extended to ADR-0005). Single in-sprint edit.

## New backlog items (drift / follow-ups)

- None. Each ADR's "Future BLG" notes are recorded in the ADR's *Consequences* section but not yet escalated to the live backlog (they are post-MVP work, captured for whoever picks them up later — re-evaluating `react-native-chart-kit`, RN New Architecture, "Καθαρισμός cache" Profile action, background sync, inferred categories).

## Learnings

- **Single supply-chain review for the whole mobile stack.** ADR-0007 reviewed the 17 runtime + 6 dev packages **once**, after ADR-0004/0005/0006 had each defined what they need. Doing it later (after the cache + insights + login decisions had been made) instead of "as each ADR is written" produced a smaller, more justifiable allowlist than four piecemeal reviews would have. Future sprints with new mobile deps should follow the same pattern: settle the *contracts* first, do the supply-chain review last.
- **The §4.4 tie-breaker precedent has now applied twice.** ADR-0002 superseded `AGENTS.md` §5.3.2's literal `user_id` body. ADR-0005 extended the same supersession to the insights endpoints' `user_id` query. BLG-0010 finally codified both into §5.3.2 itself. Pattern: when literal `AGENTS.md` text collides with security/privacy on the same week as the ADR, write the ADR with the supersession, queue a small admin BLG, close it the next discovery sprint. This sprint did exactly that.
- **Discovery sprints can ship admin edits.** BLG-0010 was an `agentic` admin edit (no production code, no debate needed beyond a §4.11 sign-off check). Folding it into S-003 instead of opening a separate one-line sprint kept ceremony low. Future precedent: small admin BLGs with clear sign-off can ride along with a discovery sprint when they relate to the sprint's theme.
- **Threat-model statements belong in ADRs, not in code comments.** ADR-0006 explicitly records "threat model excludes rooted/jailbroken devices" — when the implementation lands in S-004, that statement is already debated and signed off. Future ADRs should likewise be explicit about what they do *not* protect against.
- **PowerShell `make` resolution is fragile.** Bare `make check` failed to resolve the target on this shell session; explicit binary path worked. Logged so the next agent doesn't waste time debugging it.

## Next sprint

- Type: **implementation**.
- Theme proposal: **`login-insights-cache-runnable-scanner`**.
- Number: **S-004**.
- Pulls: BLG-0005, BLG-0006, BLG-0007, BLG-0012. Optional pickup if time permits: BLG-0004 if a consenting receipt holder comes forward (independent of S-003 ADRs).
- Acceptance test at sprint review: a real Greek user can install the Expo build, sign in via Supabase native OTP with their `+30` phone, scan a Greek receipt and see it in ReceiptDetail in ≤ 5 s (§2.5), open Insights and see this-month-vs-last with by-category and top-merchants, kill the network and still see the cached receipt list + offline banner.
- See `docs/plan.md` for the full plan.
