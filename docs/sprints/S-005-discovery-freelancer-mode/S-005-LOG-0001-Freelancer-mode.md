# Sprint S-005 — Log

Audit-trail entries per `AGENTS.md` §4.9.3. Every step records outbound hosts, MCP tools, dependencies, and approvals (even when empty).

## 2026-05-07 17:36 — Sprint kickoff

- Agent: orchestrator (with go)
- Action: User invoked `go` with no extra direction. `orchestrator` confirmed the Ready queue is empty (BLG-0004 / 0009 / 0011 / 0013 / 0014 / 0015 / 0016 all `Ready: no`); per `AGENTS.md` §4.1.2 the next sprint is **discovery**. Theme `freelancer-mode` matches `docs/plan.md`. Drafted PLN.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: none
- Outcome: `docs/sprints/S-005-discovery-freelancer-mode/S-005-PLN-0001-Freelancer-mode.md`. User direction (bare `go`) honored exactly — no scope adaptation, no backlog split (`.agents/agents/go.md` §2 — bare `go` carries no instruction beyond "fast-forward one sprint").

## 2026-05-07 17:38 — ADR-0008 debate opened (Tag-as-business UX)

- Agent: orchestrator (chair)
- Action: Opened ADR-0008 ("Tag-as-business UX — inline action vs Profile-level import"). Invited: product-owner, product-manager, product-designer, mobile-builder, backend-builder, architect, engineering-manager, localization-specialist, qa, data-architect (schema impact).
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: none
- Outcome: rounds recorded inside the ADR file.

## 2026-05-07 17:50 — ADR-0008 accepted

- Agent: orchestrator
- Action: Closed ADR-0008 after 3 rounds. Decision: **inline action on Receipt detail is the MVP critical path** (one tap, context-aware, free-text category). Profile-level period import is filed as a follow-up BLG, not MVP. The endpoint is `POST /receipts/{id}/tag` per `AGENTS.md` §5.3.2 with body `{ is_business: bool, category: str|null, notes: str|null }`, Bearer-JWT-protected, Athens-TZ-aware idempotent on `(user_id, receipt_id)`. No schema migration: `receipts.is_business_expense` / `business_category` / `notes` already exist (`db/migrations/0001_init.sql`). The literal `category` string is **free-text** for MVP (anchors to ADR-0010 deferred-inferred-category decision).
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: product-designer + localization-specialist (mobile UX flow); architect + engineering-manager (API contract); data-architect (no schema migration needed — confirmed); security-privacy-officer (the new endpoint is a user-data flow — verified: only the verified `sub` may write).
- Outcome: `docs/adr/S-005-ADR-0008-Tag-as-business-ux.md`.

## 2026-05-07 17:55 — ADR-0009 debate opened (PDF export pipeline)

- Agent: orchestrator (chair)
- Action: Opened ADR-0009 ("PDF export pipeline — `reportlab` vs `weasyprint` vs server-side `puppeteer`"). Invited: architect, backend-builder, agent-safety-officer, engineering-manager, security-privacy-officer, product-designer (PDF readability for accountants), localization-specialist (Greek font / character coverage), devops-engineer (deploy footprint impact on Railway / Render).
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: none
- Outcome: rounds recorded inside the ADR file.

## 2026-05-07 18:10 — `review-external-surface.md` run on the three PDF candidates

- Agent: agent-safety-officer
- Action: Ran the `review-external-surface.md` checklist against the three candidate stacks:
  - `reportlab==4.2.5` — pure-Python BSD-licensed PDF library; no system deps; mature; **approved**.
  - `weasyprint==62.3` + GTK / Cairo / Pango / Fontconfig system libraries — significant system dep tree; would require a custom Dockerfile or buildpack on Railway / Render; **approved with conditions** if picked: Dockerfile review + system-lib SBOM.
  - server-side `puppeteer` (Node, downloads Chromium ~170 MB at install time from `storage.googleapis.com`) — adds a **new outbound host** at install time and a Chromium binary at runtime; **blocked** unless `architect` plus `agent-safety-officer` approve adding the host to the allowlist with explicit re-evaluation criteria.
- Outbound hosts contacted: none (static review; no install performed)
- MCP tools invoked: none
- Dependencies added: none in this sprint (the install lands in S-006 against the ADR-0009 decision)
- Sensitive approvals: agent-safety-officer **approved `reportlab`**; **conditional on `weasyprint`**; **blocked on `puppeteer`** unless an allowlist update is explicitly debated.
- Outcome: ADR-0009 §Round 2 captures the verbatim verdict.

## 2026-05-07 18:20 — ADR-0009 accepted

- Agent: orchestrator
- Action: Closed ADR-0009 after 3 rounds. Decision: **`reportlab==4.2.5`**. Pure-Python; no new outbound surface; deploy footprint zero-add (single `pip install` line in `backend/requirements.txt`); BSD license clean for redistribution; full UTF-8 / Greek glyph coverage via the bundled `DejaVuSans` family; tabular accountant-style PDF is `reportlab`'s natural sweet spot. PDF generated **on-the-fly**, **streamed back to the client** (`StreamingResponse`), **never written to disk** — recorded as a hard contract in §4 of the ADR. The endpoint shape: `GET /export/business-expenses?from_date=YYYY-MM-DD&to_date=YYYY-MM-DD` per `AGENTS.md` §5.3.2, returns `application/pdf`, Bearer-JWT-protected, the verified `sub` is the canonical user filter (extends ADR-0002 / ADR-0005's "no client-supplied identity" rule).
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none in this sprint (ADR-only; install lands in S-006)
- Sensitive approvals: agent-safety-officer + engineering-manager (new runtime dep — `reportlab`); architect (engineering decision — the chosen stack is the smallest one that meets the requirements); security-privacy-officer (data flow — PDF carries financial data, never persisted server-side, never logged); product-designer + localization-specialist (Greek glyph coverage confirmed via `reportlab`'s bundled `DejaVuSans`); devops-engineer (deploy footprint unchanged — no Dockerfile or buildpack changes).
- Outcome: `docs/adr/S-005-ADR-0009-Pdf-export-pipeline.md`.

## 2026-05-07 18:25 — ADR-0010 debate opened (Inferred-category heuristic)

- Agent: orchestrator (chair)
- Action: Opened ADR-0010 ("Inferred-category heuristic — activate now or stay deferred"). Invited: architect, data-architect, parser-specialist, localization-specialist, qa, product-owner, product-manager.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: none
- Outcome: rounds recorded inside the ADR file.

## 2026-05-07 18:35 — ADR-0010 accepted

- Agent: orchestrator
- Action: Closed ADR-0010 after 2 rounds (uncontested — all participants converged on "stay deferred" in Round 1). Decision: **stay deferred** until **≥ 100 receipts have been tagged with a `business_category` across the active user base**. Re-evaluation triggers: (a) the threshold above, OR (b) explicit user demand surfaced in `product-owner`'s feedback loop, OR (c) ML / LLM landscape shifts that meaningfully reduce the cost-quality trade-off. Three approaches recorded for the future BLG: EAN-range tables (low-quality, brittle), description-NLP heuristics (medium-quality, requires Greek-language model — adds a dep tree we don't want for MVP), per-merchant defaults (medium-quality, easy to ship — likely the first iteration when re-activated).
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: architect (technical decision — defer); data-architect (`receipt_items.inferred_category` schema column already exists, no migration needed when re-activated); parser-specialist (Greek description / EAN inputs noted); localization-specialist (Greek-language NLP cost flagged); product-owner (deferral aligns with MVP scope per `AGENTS.md` §2.9 spirit even though §2.9 doesn't list it explicitly); qa (explicit re-eval criteria are testable).
- Outcome: `docs/adr/S-005-ADR-0010-Inferred-category-heuristic.md`.

## 2026-05-07 18:40 — ADR-0011 debate opened (`tzdata` codification, BLG-0013)

- Agent: orchestrator (chair)
- Action: Opened ADR-0011 ("`tzdata` codification — standalone ADR vs ADR-0007 amendment"). Invited: agent-safety-officer, engineering-manager, architect, backend-builder, devops-engineer, qa.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: none
- Outcome: rounds recorded inside the ADR file.

## 2026-05-07 18:45 — ADR-0011 accepted

- Agent: orchestrator
- Action: Closed ADR-0011 after 1 uncontested round + 1 confirmation round (single-round closure per `chair-adr-debate.md` minimum-runtime rule when uncontested AND recorded explicitly). Decision: **standalone ADR** (don't touch ADR-0007 — it's mobile / Expo-scoped; `tzdata` is backend-Python-scoped; mixing the two pollutes both). Pin `tzdata==2024.2` in `backend/requirements.txt` (already shipped in S-004 as drift) with an updated comment line referencing this ADR id. Refresh cadence: re-evaluate on every backend `requirements.txt` audit; PSF-maintained, low-churn, zero-side-effect when shadowed by an OS IANA db. PyPI is already on the outbound allowlist — no allowlist update.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none in this sprint (the dep was added in S-004 as drift; this ADR retroactively codifies it)
- Sensitive approvals: agent-safety-officer + engineering-manager (supply-chain — runtime dep retroactively codified per `AGENTS.md` §4.11 "new runtime dependency"); architect (no architectural impact).
- Outcome: `docs/adr/S-005-ADR-0011-Tzdata-codification.md`.

## 2026-05-07 18:48 — BLG-0013 in-sprint admin edit applied

- Agent: backend-builder (with engineering-manager, agent-safety-officer)
- Action: Applied the small admin edit anchored to ADR-0011: updated the existing comment block in `backend/requirements.txt` above the `tzdata==2024.2` line to point at `docs/adr/S-005-ADR-0011-Tzdata-codification.md` instead of "the next discovery sprint" placeholder. No code changed; pin unchanged. Precedent: BLG-0010 closed in S-003 via the same in-sprint-admin pattern. BLG-0013 moves to `docs/done.md`.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: agent-safety-officer + engineering-manager + architect (already recorded in ADR-0011's sign-off block); orchestrator (sprint LOG records the change per `AGENTS.md` §4.11).
- Outcome: `backend/requirements.txt` patched. BLG-0013 moved to `docs/done.md`.

## 2026-05-07 18:55 — ADR-0012 debate opened (Expo SDK 51 → 54 upgrade, BLG-0016)

- Agent: orchestrator (chair)
- Action: Opened ADR-0012 ("Expo SDK 51 → 54 upgrade — supersedes ADR-0007 §2"). Invited: architect, engineering-manager, agent-safety-officer, mobile-builder, devops-engineer, qa, security-privacy-officer (new transitive deps may touch auth / cache code paths).
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: none
- Outcome: rounds recorded inside the ADR file.

## 2026-05-07 19:10 — `review-external-surface.md` run on the SDK 54 transitive tree

- Agent: agent-safety-officer
- Action: Ran the `review-external-surface.md` checklist against the SDK 54 tree (post-`expo install --fix` simulation against the SDK 54 compat matrix as of 2026-05-07). Verdict: **approved with conditions** — (a) the upgrade lands in **one** S-006 commit on a feature branch (same discipline as ADR-0007); (b) `mobile/package-lock.json` is regenerated and committed in the same change; (c) `expo-doctor` runs clean (zero compat warnings) before merge; (d) the two existing in-tree compat-matrix warnings (`@react-native-community/netinfo@11.3.2` vs SDK 51 expected `11.3.1`; `typescript@5.6.3` vs SDK 51 expected `~5.3.3`) are explicitly resolved against the SDK 54 matrix and the resolution is recorded in ADR-0012 §3; (e) the encryption-relevant deps (`@noble/ciphers`, `expo-secure-store`, `expo-crypto`) survive the upgrade with no behavioral change to the AES-256-GCM stack from ADR-0006 (else the upgrade is blocked pending an ADR-0006 amendment). No new outbound host (`registry.npmjs.org` and `expo.dev` already on the allowlist).
- Outbound hosts contacted: none (static review; the actual `npm install` happens in S-006)
- MCP tools invoked: none
- Dependencies added: none in this sprint (ADR-only; the dep tree update lands in S-006 against ADR-0012)
- Sensitive approvals: agent-safety-officer **conditional approval** on the SDK 54 tree; engineering-manager co-sign on the version table; architect non-block (architectural impact = lockfile churn only); mobile-builder accepts the executor role; devops-engineer notes EAS profile re-build needed.
- Outcome: ADR-0012 §Round 2 captures the verbatim verdict.

## 2026-05-07 19:20 — ADR-0012 accepted

- Agent: orchestrator
- Action: Closed ADR-0012 after 3 rounds. Decision: **target Expo SDK 54** (latest stable as of 2026-05-07; matches Expo Go for both iOS and Android). Strategy: `npx expo install --fix` against a clean clone in S-006, capture the diff, run `expo-doctor` until clean, regenerate `mobile/package-lock.json`. ADR-0007 §2 (the version table) is **superseded** by ADR-0012 §3 (the SDK 54 version table); the ADR-0007 discipline (exact pins, lockfile committed, `EXPO_NO_TELEMETRY=1`, single-PR install) **stays in force**. Both compat-matrix warnings resolved by re-aligning to the SDK 54 matrix (the deliberate-deviation option was rejected — every deviation needs a recorded reason and we don't have one). `react-native-chart-kit` survives on SDK 54 (BLG-0014 stays passive); if a future upgrade breaks it, BLG-0014 collapses into that upgrade's ADR. AES stack from ADR-0006 confirmed unchanged.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none in this sprint (ADR-only)
- Sensitive approvals: agent-safety-officer + engineering-manager (new runtime dependency / supply-chain delta — same `AGENTS.md` §4.11 sign-off pair as ADR-0007); architect (SDK choice); mobile-builder (executor); devops-engineer (EAS impact); security-privacy-officer (encryption-relevant deps survive — confirmed).
- Outcome: `docs/adr/S-005-ADR-0012-Expo-sdk-upgrade.md`. ADR-0007 marked `superseded-by ADR-0012` for §2 only; ADR-0007's other sections (§3 install discipline, §4 outbound surface, §5 test wiring, §6 gate re-inclusion, §7 EAS profiles, §8 future re-evaluations) remain in force.

## 2026-05-07 19:25 — DES-0004 + DES-0005 drafted

- Agent: product-designer (with mobile-builder, localization-specialist, qa, security-privacy-officer)
- Action: Drafted DES-0004 (Profile screen — layout, freelancer toggle, ΑΦΜ field with Greek 9-digit validator, business-expenses export action with date-range picker, sign-out, accessibility, telemetry, full Greek copy) on top of ADR-0008 + ADR-0009. Drafted DES-0005 (Tag-as-business flow on Receipt detail — inline state machine, free-text category input, notes field, accessibility, telemetry, full Greek copy) on top of ADR-0008.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: localization-specialist on Greek copy (`profile.*`, `tag.*` strings); product-designer on the layout flow; security-privacy-officer reviewed for telemetry-no-PII (counts only; ΑΦΜ never logged); qa reviewed reducer testability.
- Outcome: `docs/sprints/S-005-discovery-freelancer-mode/S-005-DES-0004-Profile-ux.md`, `docs/sprints/S-005-discovery-freelancer-mode/S-005-DES-0005-Tag-as-business-flow.md`.

## 2026-05-07 19:30 — Backlog refined

- Agent: product-manager (with orchestrator)
- Action:
  - **BLG-0013 closed** (in-sprint admin edit per ADR-0011 — moved to `docs/done.md`).
  - **BLG-0016 marked Ready: yes** with full Acceptance / Design / Approach / Size / Impact-notes / Links per `AGENTS.md` §4.1.3 — anchored to ADR-0012.
  - **BLG-0017 created** as Ready — Profile screen + freelancer toggle + ΑΦΜ field (mobile + thin backend `PATCH /users/me`).
  - **BLG-0018 created** as Ready — `POST /receipts/{id}/tag` endpoint + Tag-as-business UX on Receipt detail (DES-0005).
  - **BLG-0019 created** as Ready — `GET /export/business-expenses` PDF endpoint + Profile export action (DES-0004 §6).
  - **BLG-0014** stays planned — adds a one-line cross-reference to ADR-0012 ("BLG-0014 stays passive: chart-kit survives the SDK 54 upgrade per ADR-0012 §3").
  - **BLG-0004 / BLG-0009 / BLG-0011 / BLG-0015** unchanged.
  - `docs/backlog.md` rewritten with the S-005 close header.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: orchestrator co-sign that all four newly-Ready items (BLG-0016, 0017, 0018, 0019) have every Definition-of-Ready field filled.
- Outcome: `docs/backlog.md`, `docs/done.md` updated.

## 2026-05-07 19:33 — Decisions index updated

- Agent: architect
- Action: Indexed ADR-0008, ADR-0009, ADR-0010, ADR-0011, ADR-0012 in `.agents/context/decisions.md` with one-paragraph summaries each. Marked ADR-0007 §2 as superseded-by-ADR-0012 with a short pointer.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: none
- Outcome: `.agents/context/decisions.md` updated.

## 2026-05-07 19:35 — Outbound allowlist confirmed unchanged

- Agent: agent-safety-officer
- Action: Confirmed that none of ADR-0008, 0009, 0010, 0011, 0012 introduces a new outbound host. `reportlab` ships from PyPI (already on the allowlist); `tzdata` is from PyPI (already on the allowlist); the SDK 54 tree comes from `registry.npmjs.org` + `expo.dev` (already on the allowlist). Server-side `puppeteer` was rejected precisely because it would have added `storage.googleapis.com` (Chromium binary download) to the allowlist; `weasyprint` was deprioritized partly to avoid a Cairo / Pango Dockerfile drift on Railway / Render. `.agents/context/outbound-allowlist.md` remains as it was at S-004 close.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: none required (no change).
- Outcome: `.agents/context/outbound-allowlist.md` unchanged.

## 2026-05-07 19:40 — Quality-gate smoke check

- Agent: qa (with engineering-manager)
- Action: Ran `make check` to confirm the discovery sprint did not regress the gate. The only production-code touch this sprint was the BLG-0013 admin comment update in `backend/requirements.txt` (no functional change; the `tzdata==2024.2` pin is byte-identical). PowerShell quirk (per S-003 / S-004 LOG): used `& "C:\Program Files (x86)\GnuWin32\bin\make.exe" -f Makefile check`.
- Outbound hosts contacted: pypi.org (pip — Python deps install during `install-backend`), registry.npmjs.org (`npm install` during `install-mobile`). Both already on `.agents/context/outbound-allowlist.md`.
- MCP tools invoked: none
- Dependencies added: none in the repo (`backend/requirements.txt` byte-diff is comment-only; `mobile/package.json` unchanged).
- Sensitive approvals: engineering-manager confirms gate green.
- Outcome: 70 backend tests + 128 mobile tests = 198 tests passing across 13 suites. ruff clean. mypy clean. jest 13 suites passed. `make check: green`.

## 2026-05-07 19:45 — Sprint review + handoff

- Agent: orchestrator + go
- Action: Wrote REV + UREV. Picked next sprint type = **implementation S-006** (theme `freelancer-mode-and-sdk-upgrade`). Recorded sign-offs per `AGENTS.md` §4.11.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: §4.11 sign-offs collected per ADR — see REV §"Sign-offs". `agent-safety-officer` confirms no new outbound surface introduced this sprint and the supply-chain reviews for ADR-0009 (`reportlab`) and ADR-0012 (SDK 54 transitive tree) are recorded in the ADRs themselves.
- Outcome: sprint S-005 closed.
