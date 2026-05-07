# Sprint S-005 — Freelancer mode (discovery)

- Type: discovery
- Theme: freelancer-mode
- Start: 2026-05-07
- Chair: orchestrator
- Participants: orchestrator, product-owner, product-manager, product-designer, architect, data-architect, parser-specialist, security-privacy-officer, agent-safety-officer, localization-specialist, qa, mobile-builder, backend-builder, engineering-manager, devops-engineer, go

## Why this sprint

Sprint **S-004 (`login-insights-cache-runnable-scanner`)** closed green: phone-OTP login, Insights, encrypted offline cache, and the runnable Scanner all ship together (`make check`: 70 backend + 128 mobile = 198 tests across 13 suites). The §2.8 MVP is now reachable end-to-end **except for bullets 8 and 9** — *tag a receipt as a business expense* and *export tagged receipts as a PDF for an accountant*. That is the last MVP gap.

The Ready queue is **empty** (BLG-0004 / 0009 / 0011 are not Ready; BLG-0013 / 0014 / 0015 / 0016 are explicit discovery / post-MVP follow-ups), so per `AGENTS.md` §4.1.2 the next sprint is **discovery**.

Two more situations make a discovery sprint the right call right now:

1. **BLG-0016 (Expo SDK 51 → 54).** The S-004 UREV walk-through on 2026-05-07 found that Expo Go on iOS only ships the latest SDK; on-device verification of the S-004 acceptance script is blocked. The fix is a major-rev SDK upgrade — a runtime-dep change requiring `agent-safety-officer` co-sign per `AGENTS.md` §4.11. That belongs in an ADR, not in the middle of a delivery sprint.
2. **BLG-0013 (`tzdata` codification).** Drift recorded in S-004 — the addition of `tzdata==2024.2` to `backend/requirements.txt` was a runtime-dep add that needs a retroactive ADR to close the audit-trail gap.

S-005 settles **five contracts** in one go so S-006 implementation has a clean Ready queue covering both the freelancer flow and the SDK upgrade.

## Goals

1. **ADR-0008 — Tag-as-business UX.** Decide: inline action on Receipt detail vs Profile-level "import all from period" vs both. Co-signs: `product-designer` + `localization-specialist` (mobile UX flow), `architect` + `engineering-manager` (API contract for the tag endpoint).
2. **ADR-0009 — PDF export pipeline.** Decide between `reportlab` (pure Python, no new outbound surface), `weasyprint` (Python + GTK / Cairo / Pango system deps), and server-side `puppeteer` / `playwright` (Node + Chromium binary + likely new outbound surface for fonts). Co-signs: `architect` + `engineering-manager` (engineering decision), `agent-safety-officer` (supply-chain + outbound surface), `security-privacy-officer` (PDF carries user financial data → file generation path is a data flow).
3. **ADR-0010 — Inferred-category heuristic.** Compare EAN-range tables, description-NLP, and "stay deferred until N tagged receipts give us training data". Co-signs: `architect` + `data-architect` + `parser-specialist` + `localization-specialist`.
4. **ADR-0011 — `tzdata` codification (BLG-0013).** Decide standalone ADR vs ADR-0007 amendment. Co-signs: `agent-safety-officer` + `engineering-manager` + `architect`. Closes the supply-chain audit-trail gap from S-004.
5. **ADR-0012 — Expo SDK 51 → 54 upgrade (BLG-0016).** Decide target SDK, upgrade strategy (`expo install --fix` + `expo-doctor` vs hand-pinned), survival check for the existing pinned packages, and how the two existing in-tree compat-matrix warnings (`@react-native-community/netinfo`, `typescript`) are addressed by the same ADR. Supersedes ADR-0007 §2 (the version table) — the discipline (exact pins, lockfile, `EXPO_NO_TELEMETRY=1`) stays. Co-signs: `architect` + `engineering-manager` + `agent-safety-officer` + `mobile-builder`.
6. **DES-0004 — Profile screen.** Layout, freelancer toggle (writes `users.is_freelancer`), ΑΦΜ field (writes `users.afm`), business-expenses export action, sign-out action. Greek-first.
7. **DES-0005 — Tag-as-business flow on Receipt detail.** Inline state machine (untagged → tagged → editing → untagged), category picker (free-text for MVP per ADR-0010 deferral), notes field, accessibility, telemetry rules.
8. **Refine backlog** to Ready for S-006:
   - BLG-0016 → **Ready** (Expo SDK upgrade, anchored to ADR-0012).
   - BLG-0017 (new) → **Ready** — Profile screen + freelancer toggle + ΑΦΜ field (mobile + thin backend).
   - BLG-0018 (new) → **Ready** — `POST /receipts/{id}/tag` endpoint + Tag-as-business UX on Receipt detail.
   - BLG-0019 (new) → **Ready** — `GET /export/business-expenses` PDF endpoint + Profile export action.
   - BLG-0010-shaped admin: close BLG-0013 with a small in-sprint comment update in `backend/requirements.txt` once ADR-0011 lands (precedent: BLG-0010 closed in S-003 alongside the discovery work).
9. **Index** ADR-0008..0012 in `.agents/context/decisions.md`.
10. **Update** `docs/plan.md` with the S-006 plan and `AGENTS.md` §2.7 with the S-005 close snapshot.

## Scope

**In:**

- ADR-0008, ADR-0009, ADR-0010, ADR-0011, ADR-0012.
- DES-0004 (Profile screen), DES-0005 (Tag-as-business flow on Receipt detail).
- Backlog refinement: BLG-0016 to Ready; BLG-0017 / 0018 / 0019 created as Ready; BLG-0013 closed in-sprint via the ADR-0011 admin edit (precedent: BLG-0010 in S-003).
- Smoke `make check` at sprint close (per `AGENTS.md` §4.10 / `.agents/skills/run-sprint.md` §6).
- Documentation updates: `.agents/context/decisions.md`, `docs/plan.md`, `AGENTS.md` §2.7.

**Out (explicitly):**

- Production code changes other than the BLG-0013 audit-trail comment edit (`backend/requirements.txt`). `AGENTS.md` §4.1.1 — discovery sprints ship no production code.
- The actual SDK 51 → 54 upgrade. Implementation of ADR-0012 lands in S-006.
- The freelancer flow implementation. Lands in S-006 against BLG-0017 / 0018 / 0019.
- Real-receipt fixture acquisition (BLG-0004). Still gated on consenting users.
- Drift-detection CI (BLG-0009). Still gated on a real-receipt canary.
- Profile language switch (BLG-0011). Out of MVP per `AGENTS.md` §2.9.
- Live insights-RPC integration test (BLG-0015). Carry-over.
- `react-native-chart-kit` swap (BLG-0014). Carry-over; may be re-touched as part of ADR-0012's survival check, but no decision lands here.
- Any change to `.agents/context/outbound-allowlist.md`. The five ADRs in this sprint should not introduce a new outbound host. If one of them does (unlikely), it becomes a follow-up BLG before close.

## Ready items pulled (delivery only)

N/A — discovery sprint.

## Risks & known unknowns

- **Risk: ADR-0009 picks a heavy supply-chain.** `weasyprint` brings GTK / Cairo / Pango (libgobject, libpango-1.0, libfontconfig, …). On Railway / Render this means a custom Dockerfile or buildpack to install system libs, which increases attack surface and ships images we have to maintain. *Mitigation*: ADR-0009 must default to **`reportlab`** unless a hard layout requirement forces HTML→PDF; the ADR captures which design constraints would bump us up to `weasyprint` (e.g. complex CSS, full Greek font rendering with ligatures).
- **Risk: ADR-0012 cascades into a multi-package re-debate.** Bumping SDK 51 → 54 may force `react-native-chart-kit` (BLG-0014), `@noble/ciphers`, `expo-secure-store`, `expo-camera`, `@supabase/supabase-js`, etc. to new versions. *Mitigation*: ADR-0012 runs `expo install --fix` against a clean clone first, captures the diff, and folds the result into one supply-chain review (same pattern as ADR-0007 — settle the contracts first, do the supply-chain review last). If `react-native-chart-kit` cannot survive on SDK 54, BLG-0014 collapses into ADR-0012's swap decision.
- **Risk: Tag UX scope creep.** Picking "both inline + Profile-level period import" doubles the implementation surface for S-006. *Mitigation*: ADR-0008 must rank inline tag-on-detail as the **MVP critical path**; the Profile-level period import becomes a backlog item only if it adds clear value beyond "tag receipts one at a time".
- **Risk: Inferred-category gold-plating.** Pulling description-NLP into MVP introduces a non-trivial dep tree (sentence-transformers? a Greek-language model?) and an explainability problem. *Mitigation*: ADR-0010 must default to **deferred-until-N** with a concrete N and re-evaluation criteria; only an ADR-0009-style "we already have it for free" should change the default.
- **Risk: PDF-as-PII vector.** A generated PDF contains every line item the user has tagged: merchant ΑΦΜ, dates, totals, often products. *Mitigation*: ADR-0009 records that the PDF is generated **on-the-fly**, **streamed back to the client**, and **never stored on the server**; outbound-host posture stays unchanged; `security-privacy-officer` co-sign on the data-flow note.
- **Risk: ADR debate spiral.** Five ADRs in one discovery sprint is a lot. *Mitigation*: orchestrator runs them in the priority order in `docs/plan.md` §"Sequencing rule"; ADRs 0008 + 0009 are the only two that depend on each other (the tag UX shapes what fields the PDF rows show). 0010 / 0011 / 0012 are independent and can resolve in any order.

## User direction (if `go` was used)

- Direction: **`go`** (no extra text on this invocation).
- Honored in scope: **yes** — bare `go` defers sprint-type selection to `orchestrator` (`.agents/agents/go.md` §1). The Ready queue is empty so the type is `discovery`; the queued theme in `docs/plan.md` is `freelancer-mode`. No backlog split required. Recorded here per `AGENTS.md` §7.

## Definition of done

- ADR-0008, ADR-0009, ADR-0010, ADR-0011, ADR-0012 written, accepted, and indexed in `.agents/context/decisions.md`.
- DES-0004 + DES-0005 written under the sprint folder.
- BLG-0016 satisfies the Definition of Ready (`AGENTS.md` §4.1.3).
- BLG-0017 + BLG-0018 + BLG-0019 created and Ready.
- BLG-0013 closed and moved to `docs/done.md` (small in-sprint admin edit anchored to ADR-0011).
- BLG-0014 stays planned but cross-references ADR-0012 if applicable.
- `docs/plan.md` updated with the S-006 implementation plan.
- `AGENTS.md` §2.7 updated with the S-005 close snapshot.
- Sprint REV + UREV written.
- `make check` re-run as smoke check (no production code changed beyond the one-line comment update in `requirements.txt`; same precedent as S-001 / S-003 close).
- `.agents/context/outbound-allowlist.md` unchanged (or updated only via a follow-up BLG if one of the ADRs introduces a new host — currently expected: none).
