# Sprint S-005 — Review

- Type: discovery
- Closed: 2026-05-07
- Chair: orchestrator

## Outcomes

- **ADR-0008** accepted: inline tag-on-detail is the MVP critical path; Profile-level period import deferred to a future BLG. Endpoint `POST /receipts/{id}/tag` Bearer-JWT-protected, body `{ is_business, category?, notes? }` with server-side trim + lowercase + length caps (64 / 500), idempotent 200, optimistic UI on the mobile client. No schema migration. Free-text `category` for MVP — lowercased server-side so the `/insights/summary` `by_category` rollup collapses inputs that differ only in case.
- **ADR-0009** accepted: **`reportlab==4.2.5`** for the PDF export pipeline. Pure-Python, no system deps, no new outbound surface, full Greek glyph coverage via bundled `DejaVuSans`. PDF generated on-the-fly + `StreamingResponse`, **never** persisted server-side, **never** logged. `weasyprint` rejected (Cairo / Pango / GTK Dockerfile cost on Railway / Render); server-side `puppeteer` rejected (would have added `storage.googleapis.com` to the outbound allowlist). 366-day range cap. `agent-safety-officer` supply-chain review captured verbatim in §Round 2.
- **ADR-0010** accepted: inferred-category heuristic stays **deferred**. Three concrete re-evaluation triggers recorded so the deferral doesn't become forever-open: ≥ 100 receipts have populated `business_category`, OR explicit user demand surfaces, OR the supply-chain landscape shifts. LLM-API call directly forbidden by `AGENTS.md` §2.4 — recorded as rejected so a future agent doesn't re-debate without amending §2.4 first. Future architecture sketched (per-country `category.py` module) so the successor ADR has a starting point.
- **ADR-0011** accepted: standalone ADR codifying `tzdata==2024.2` in `backend/requirements.txt`. PSF-maintained data-only shim; PyPI already on the outbound allowlist; refresh on every `requirements.txt` audit. Closes the audit-trail gap from S-004 drift.
- **ADR-0012** accepted: target Expo SDK 54 (matches Expo Go on iOS / Android stores). Strategy: `npx expo install --fix` + `expo-doctor` clean + atomic single-PR commit in S-006. **Supersedes ADR-0007 §2** (the version table) only; ADR-0007's discipline (exact pins, lockfile committed, `EXPO_NO_TELEMETRY=1`, single-PR install) carries forward unchanged. Both existing in-tree compat-matrix warnings (`@react-native-community/netinfo`, `typescript`) re-aligned to the SDK 54 matrix; deliberate-deviation option rejected. Encryption stack from ADR-0006 (`@noble/ciphers`, `expo-secure-store`, `expo-crypto`) must survive byte-identically — round-trip test in S-006 is BLG-0016 acceptance bullet 5. `react-native-chart-kit` (BLG-0014) expected to survive; if not, BLG-0014 collapses into the same S-006 PR.
- **DES-0004** drafted: full Profile screen — layout, freelancer toggle, ΑΦΜ field with Greek MOD-11 validator, business-expenses PDF export action with date-range picker, sign-out (rotates the cache key on the way out per ADR-0006 §2), accessibility, telemetry rules, full Greek copy.
- **DES-0005** drafted: full Tag-as-business inline state machine on Receipt detail, optimistic UI (toggle flip), category text input + notes textarea, length caps mirroring ADR-0008 §2, accessibility, telemetry rules, full Greek copy.
- **BLG-0013 closed**: comment block in `backend/requirements.txt` above `tzdata==2024.2` updated to point at ADR-0011 instead of the "next discovery sprint" placeholder. Pin byte-identical. Moved to `docs/done.md`. Same in-sprint-admin precedent as BLG-0010 in S-003.
- **4 backlog items moved to Ready**: BLG-0016 (Expo SDK upgrade), BLG-0017 (Profile screen), BLG-0018 (Tag-as-business endpoint + UX), BLG-0019 (PDF export endpoint + Profile action).
- **5 backlog items kept on hold** with sharper acceptance: BLG-0004 (real-receipt fixtures — gated on consenting users), BLG-0009 (drift-detection CI — gated on real-receipt canary), BLG-0011 (Profile language switch — out of MVP), BLG-0014 (`react-native-chart-kit` re-eval — cross-referenced to ADR-0012 §6), BLG-0015 (live insights-RPC integration test — gated on Supabase test project).
- **`docs/plan.md`** updated: next sprint = **S-006 implementation (`freelancer-mode-and-sdk-upgrade`)**.
- **`AGENTS.md` §2.7** updated.
- **`.agents/context/decisions.md`** indexed with ADR-0008..0012 (and ADR-0007 §2 supersession note).
- **ADR-0007 status** edited inline: "§2 superseded-by ADR-0012; §3..§8 remain in force".

## `make check`

- Status: **green**.
- Last run: 2026-05-07 19:40.
- Backend: ruff (clean), mypy ("Success: no issues found in 39 source files"), pytest (70 passed in 3.74 s).
- Mobile: lint placeholder, tsc --noEmit (clean), jest (128 passed in 3.867 s, 13 suites — `ts` + `rn` two-project layout).
- Note: discovery-sprint smoke check. The only production-code touch in S-005 was the BLG-0013 comment-only update in `backend/requirements.txt` — pin is byte-identical (`tzdata==2024.2`). Same precedent as S-001 / S-003 close.
- **Windows quirk reaffirmed**: `make check` invoked as `& "C:\Program Files (x86)\GnuWin32\bin\make.exe" -f Makefile check` from PowerShell. The PowerShell stderr stream tagged the Jest "PASS rn..." line as a `NativeCommandError` (cosmetic — exit code is 0, output ends with `make check: green`). Logged in `S-005-LOG-0001` for whoever picks up S-006.

## Sign-offs (`AGENTS.md` §4.11)

- **ADR-0008 (new endpoint / API contract change + new mobile screen / UX flow + user-data flow change)**:
  - API contract: `architect` + `engineering-manager`.
  - Mobile UX: `product-designer` + `localization-specialist`.
  - User-data flow: `security-privacy-officer` (write path scoped to `sub`; `notes` never logged).
  - Schema: `data-architect` confirmed no migration needed.
  - QA: `qa` (acceptance bullets converted into BLG-0018).
- **ADR-0009 (new endpoint / API contract change + new runtime dependency + user-data flow change)**:
  - API contract: `architect` + `engineering-manager`.
  - New runtime dep (`reportlab==4.2.5`): `agent-safety-officer` + `engineering-manager` (supply-chain review captured in ADR-0009 §Round 2).
  - User-data flow (PDF carries financial PII): `security-privacy-officer` (on-the-fly + streamed + never persisted + never logged).
  - Mobile UX: `product-designer` + `localization-specialist` (Greek glyph coverage via `DejaVuSans` confirmed).
  - Deploy: `devops-engineer` (no Dockerfile change needed).
- **ADR-0010 (deferral — no production code change)**:
  - Technical: `architect` (defer until concrete trigger).
  - Schema: `data-architect` (existing `receipt_items.inferred_category` column already supports re-activation — no migration today).
  - Parser path: `parser-specialist` (when re-activated, runs at parse time, per-country module).
  - Localization: `localization-specialist` (Greek-language NLP cost flagged).
  - Product: `product-owner` + `product-manager` (deferral aligns with MVP scope).
  - QA: `qa` (re-eval criteria are testable).
- **ADR-0011 (new runtime dependency — retroactively codified)**:
  - Supply-chain: `agent-safety-officer` + `engineering-manager`.
  - Architectural: `architect` (no impact).
- **ADR-0012 (new runtime dependency / supply-chain delta + supersedes ADR-0007 §2 + encryption-stack survival)**:
  - Supply-chain: `agent-safety-officer` + `engineering-manager` (transitive re-pin of ~20 packages — same `AGENTS.md` §4.11 sign-off pair as ADR-0007).
  - Architectural: `architect` (SDK choice).
  - Mobile execution: `mobile-builder`.
  - Deploy: `devops-engineer` (EAS profile bump).
  - Encryption survival: `security-privacy-officer` (round-trip test bullet on BLG-0016).
- **DES-0004 + DES-0005 (new mobile screens / UX flows)**: `product-designer` + `localization-specialist`. `qa` reviewed reducer testability. `security-privacy-officer` reviewed telemetry-no-PII rules (ΑΦΜ, phone, date range, PDF size, category text, notes text — all explicitly excluded from telemetry).
- **BLG-0013 (in-sprint admin edit to `backend/requirements.txt`)**: `agent-safety-officer` + `engineering-manager` + `architect` (already part of ADR-0011 sign-offs); `orchestrator` recorded the change in `S-005-LOG-0001`.
- **No new external surface introduced this sprint.** `agent-safety-officer` confirms `.agents/context/outbound-allowlist.md` is unchanged. `reportlab` (PyPI) and the SDK 54 tree (`registry.npmjs.org` + `expo.dev`) are already on the allowlist; `puppeteer` was rejected precisely to avoid an allowlist update.
- **Sprint scope change mid-sprint**: none.
- **Adding / retiring an agent**: none.
- **Process**: `orchestrator` (sprint review + chair on all five ADRs).

## ADRs decided

- **ADR-0008** — Tag-as-business UX (inline action vs Profile-level period import).
- **ADR-0009** — PDF export pipeline (`reportlab` vs `weasyprint` vs server-side `puppeteer`).
- **ADR-0010** — Inferred-category heuristic (activate now or stay deferred).
- **ADR-0011** — `tzdata` codification (Windows-host `zoneinfo` requirement).
- **ADR-0012** — Expo SDK 51 → 54 upgrade (supersedes ADR-0007 §2).

## Items moved backlog → done

- **BLG-0013** — `tzdata` codification. Closed via the in-sprint admin edit anchored to ADR-0011 (precedent: BLG-0010 in S-003).

## New backlog items (drift / follow-ups)

- **BLG-0017** — Profile screen + freelancer toggle + ΑΦΜ field + sign-out (mobile + thin backend `PATCH /users/me`). Ready: yes. Anchored to DES-0004 + ADR-0008 §4.
- **BLG-0018** — Tag-as-business endpoint + Receipt-detail UX. Ready: yes. Anchored to ADR-0008 + DES-0005.
- **BLG-0019** — PDF export endpoint + Profile export action. Ready: yes. Anchored to ADR-0009 + DES-0004 §3.4.
- **BLG-0016** — Expo SDK 51 → 54 upgrade. Status flipped from `Ready: no` to `Ready: yes`. Anchored to ADR-0012.
- (No new follow-ups beyond these. ADR-0010 explicitly **does not** open a BLG — the deferred state is the default.)

## Learnings

- **Five ADRs in one discovery sprint can ship cleanly when they're sequenced.** `docs/plan.md` had them ordered (tag UX → PDF → inferred-category → tzdata → Expo upgrade) precisely because the tag UX shapes what fields the PDF rows show, and the PDF + Expo decisions both touched `agent-safety-officer`. Running them in that order kept each round focused. Future discovery sprints with multiple ADRs should follow the same pattern: sequence by **dependency**, then by **shared sign-off pressure**, not alphabetically.
- **An ADR can decide "stay deferred" with concrete triggers — and that is a real decision.** ADR-0010 doesn't change anything today, but it locks the conditions under which we re-open the question. Without that, "deferred" drifts into "forgotten". Pattern: every deferral ADR carries (a) what is being deferred, (b) the concrete re-evaluation triggers, (c) what is rejected outright (so a future agent doesn't re-debate it from scratch). ADR-0010 §2 is the template.
- **Supply-chain reviews can resolve a 3-way decision by default-deny on the outbound allowlist.** ADR-0009's `puppeteer` rejection was driven primarily by "would add `storage.googleapis.com` to the allowlist" — that single condition collapsed the 3-way debate. The same pattern applied in S-003 ADR-0007 / S-004 BLG-0007. Codifying outbound-allowlist tightness as a hard tie-breaker pays off again.
- **Superseding only part of an ADR works fine, as long as the supersession is explicit at the top of the original.** ADR-0007's status header was edited inline to read "§2 superseded-by ADR-0012; §3..§8 remain in force". This avoids the dilemma of either rewriting all of ADR-0007 (too much churn) or letting the version table silently become wrong (too risky for future agents). Pattern locked for future ADR amendments.
- **The S-004 UREV addendum proved its value.** A user-driven walk-through *after* sprint close surfaced BLG-0016 in time for S-005 discovery — not S-007 or later, when the SDK situation could have rotted. The UREV is not just documentation; it's a feedback loop. Future delivery-sprint UREVs should be exercised in the same `go`-cycle as the close, not weeks later.
- **In-sprint admin edits keep ceremony low.** BLG-0013 closed in this discovery sprint via a comment-only update to `backend/requirements.txt`, anchored to ADR-0011. Same pattern as BLG-0010 in S-003. Pattern: small admin BLGs with clear sign-offs ride along with a discovery sprint when they relate to the sprint's theme.
- **PowerShell `make check` quirk reaffirmed.** Bare `make check` failed on this shell again; explicit `& "C:\Program Files (x86)\GnuWin32\bin\make.exe" -f Makefile check` worked. The Jest "PASS rn..." line gets tagged as `NativeCommandError` because Jest writes to stderr while exit code is 0 — purely cosmetic. Logged in S-003, S-004, and S-005 LOGs now; consider a `make check` runbook addendum if it surfaces again.

## Next sprint

- Type: **implementation**.
- Theme proposal: **`freelancer-mode-and-sdk-upgrade`**.
- Number: **S-006**.
- Pulls: **BLG-0016 first** (Expo SDK 51 → 54 upgrade — unblocks on-device acceptance tests), then BLG-0017 / BLG-0018 / BLG-0019 in any order (or in parallel — they touch different surfaces).
- Acceptance test at sprint review: a Greek freelancer can install the Expo build on stock Expo Go (iOS or Android, latest store version), sign in via Supabase native OTP with their `+30` phone, scan a Greek receipt, **tag it as a business expense** with a Greek category and optional notes, see it appear in the by-category rollup on Insights, open Profile, type their ΑΦΜ, **export their tagged business expenses for the current month as a PDF**, and share the PDF via the native share sheet. The encryption-stack round-trip test (BLG-0016 acceptance bullet 5) passes — pre-upgrade encrypted state decrypts byte-identically under the SDK 54 tree. `expo-doctor` runs clean. `make check`: 198 + new tests, green.
- See `docs/plan.md` for the full plan.
