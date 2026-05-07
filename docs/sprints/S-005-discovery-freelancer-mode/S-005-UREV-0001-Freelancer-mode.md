# Sprint S-005 — User review

## Where we are right now

Sprint **S-005 (discovery, `freelancer-mode`)** closed today. We agreed exactly how a Greek freelancer will tag a receipt as a business expense (one inline toggle on Receipt detail), exactly which library generates the PDF accountants get (`reportlab`, pure-Python, no system deps, no new outbound surface), exactly how the inferred-category posture is parked (deferred with three concrete re-evaluation triggers), exactly how `tzdata` is codified as a Windows-host dep, and exactly how we'll move to Expo SDK 54 so on-device verification works on stock Expo Go again — all locked into five ADRs and two design artifacts. **No production code changed in this sprint** other than a single comment-only update in `backend/requirements.txt` (BLG-0013 audit-trail closure) — that's the point of a discovery sprint: we *plan*, then S-006 implements.

The next sprint is **S-006 implementation (`freelancer-mode-and-sdk-upgrade`)**, which closes the §2.8 MVP: install on stock Expo Go (iOS or Android, latest store version) → sign in → scan → **tag as business** → open Profile → enter ΑΦΜ → **export PDF** → share via native sheet. After S-006, every bullet in `AGENTS.md` §2.8 is shippable.

## What changed

- **5 ADRs accepted** under `docs/adr/`:
  - **ADR-0008** — Tag-as-business UX. **Inline tag-on-detail** is the MVP critical path; bulk Profile-level period import is deferred to a future BLG (not opened in S-005). Endpoint: `POST /receipts/{id}/tag` with body `{ is_business, category?, notes? }`. `category` is **free text**, lowercased server-side, capped at 64 chars; `notes` is free text, capped at 500 chars; untagging clears both. No schema migration — `receipts.is_business_expense` / `business_category` / `notes` already exist.
  - **ADR-0009** — PDF export pipeline. **`reportlab==4.2.5`** wins: pure-Python, no system deps, no new outbound surface, full Greek glyph coverage via bundled `DejaVuSans`. PDF generated **on-the-fly**, **streamed back to the client**, **never** written to disk, **never** logged. `weasyprint` rejected for its Cairo / Pango / GTK Dockerfile cost; server-side `puppeteer` rejected because it would have added `storage.googleapis.com` to the outbound allowlist.
  - **ADR-0010** — Inferred-category heuristic. **Stay deferred.** Re-evaluation triggers: ≥ 100 tagged receipts, OR explicit user demand, OR supply-chain shift (e.g. an open Greek-language category model becomes available, or `AGENTS.md` §2.4 amends). LLM-API call directly forbidden by §2.4 — recorded as rejected so a future agent doesn't re-debate without amending §2.4 first.
  - **ADR-0011** — `tzdata` codification. Standalone ADR (don't pollute ADR-0007's mobile / Expo scope). Pin `tzdata==2024.2` in `backend/requirements.txt`. PSF-maintained, data-only, PyPI already on the allowlist. Closes BLG-0013 audit-trail gap.
  - **ADR-0012** — Expo SDK 51 → 54 upgrade. Target SDK 54 (matches Expo Go on iOS / Android stores). **Supersedes ADR-0007 §2** (the version table) only; ADR-0007's discipline (exact pins, lockfile, telemetry-off, single-PR install) carries forward. Both existing in-tree compat-matrix warnings (`netinfo`, `typescript`) re-aligned to the SDK 54 matrix. Encryption stack from ADR-0006 must survive byte-identically — round-trip test in S-006 is BLG-0016 acceptance bullet 5.
- **2 design artifacts** under the sprint folder:
  - **DES-0004** — Profile screen UX (layout, freelancer toggle, ΑΦΜ field with Greek MOD-11 validator, business-expenses PDF export with date-range picker, sign-out, accessibility, telemetry, full Greek copy).
  - **DES-0005** — Tag-as-business inline flow on Receipt detail (state machine, optimistic UI, length caps, accessibility, telemetry, full Greek copy).
- **4 backlog items refined to Ready**: BLG-0016 (Expo SDK upgrade), BLG-0017 (Profile screen), BLG-0018 (Tag endpoint + UX), BLG-0019 (PDF export endpoint + Profile action). These are what S-006 pulls from.
- **5 backlog items kept on hold** with sharper acceptance: BLG-0004 (real-receipt fixtures), BLG-0009 (drift-detection CI), BLG-0011 (Profile language switch — out of MVP), BLG-0014 (chart-kit re-eval — cross-referenced to ADR-0012 §6), BLG-0015 (live insights-RPC integration test).
- **1 admin closed** — BLG-0013: comment block in `backend/requirements.txt` above `tzdata==2024.2` updated to point at ADR-0011. Pin byte-identical.

## How to verify (delivery sprints)

N/A — this was a discovery sprint, no shipped runtime behavior to test on a real device. The runnable shipped behavior arrives in S-006.

## How to review (discovery sprint)

If you have 20 minutes, read in this order — concrete first, abstract last:

1. `docs/sprints/S-005-discovery-freelancer-mode/S-005-DES-0004-Profile-ux.md` — the most concrete picture of the Profile screen (every section, every Greek string, every state).
2. `docs/sprints/S-005-discovery-freelancer-mode/S-005-DES-0005-Tag-as-business-flow.md` — the most concrete picture of the inline tag-as-business flow (state machine, optimistic UI rules).
3. `docs/adr/S-005-ADR-0008-Tag-as-business-ux.md` — why tag-on-detail wins over Profile-level period import for MVP, and the exact endpoint contract.
4. `docs/adr/S-005-ADR-0009-Pdf-export-pipeline.md` — why `reportlab` over `weasyprint` over `puppeteer`. The supply-chain footprint is the deciding factor; the data-flow contract (PDF on-the-fly, streamed, never persisted, never logged) is the privacy posture.
5. `docs/adr/S-005-ADR-0012-Expo-sdk-upgrade.md` — what the SDK 54 upgrade actually looks like, what conditions `agent-safety-officer` set, and how the encryption stack from ADR-0006 must survive.
6. `docs/adr/S-005-ADR-0010-Inferred-category-heuristic.md` — why we are explicitly **not** activating inferred categories for MVP, and what would change that.
7. `docs/adr/S-005-ADR-0011-Tzdata-codification.md` — short, single-round; closes the S-004 drift gap on `tzdata`.
8. `docs/backlog.md` — confirm BLG-0016, BLG-0017, BLG-0018, BLG-0019 are marked **Ready: yes**. BLG-0004, 0009, 0011, 0014, 0015 should still be **Ready: no**, intentionally.
9. `docs/plan.md` — what S-006 will actually do and why.
10. `AGENTS.md` §2.7 — current sprint snapshot.

If anything in these decisions feels wrong, **surface it before S-006 starts**. Once S-006 lands implementation against these contracts, changing them is materially more expensive (a new mobile dep tree, a Profile screen migration, a different PDF library, a different SDK target).

A few specific things to look for during review:

- **Tag-on-detail vs Profile-level period import** (ADR-0008 §1) — we picked inline tag-on-detail as the MVP critical path. If your real-world workflow expects to bulk-tag at month-end (50 untagged receipts in one go), flag it now — that pushes a Profile-level period import into S-006 instead of "later".
- **`category` as free text** (ADR-0008 §2) — no server-side allow-list. Lowercased server-side so `"Groceries"` and `"groceries"` collapse on the by-category rollup. If you want a curated category list, raise it before S-006.
- **`reportlab` vs HTML→PDF** (ADR-0009 §1) — the PDF will be programmatically rendered with `reportlab.platypus.Table` + `Paragraph` primitives. Boring and legible, accountant-friendly. If you have a richer PDF design in mind (color, logo, complex CSS), flag it now — the fix is `weasyprint` with the conditions captured in ADR-0009 §Round 2.
- **Inferred-category re-eval triggers** (ADR-0010 §2) — three concrete conditions. If you want one of them to be *the* trigger (e.g. user demand only, no quantitative threshold), raise it now. Otherwise the next ADR opens when whichever fires first.
- **Expo SDK 54 cascade** (ADR-0012) — the SDK upgrade transitively re-pins ~20 packages. The list isn't in the ADR (it lands in the S-006 PR after `expo install --fix`). If you have a strong opinion about a specific package surviving (e.g. you depend on a quirk of `react-native-chart-kit@6.12.0`), raise it now so the S-006 PR doesn't surprise you.
- **`@react-native-community/netinfo` and `typescript` re-alignment** (ADR-0012 §3) — both are getting re-aligned to whatever the SDK 54 matrix expects. The deliberate-deviation option was rejected (no fresh reason). If you have one, the time to add it is now.

## Where to look next

- `AGENTS.md` §2.6 — shipped features (still reflects S-004's user-visible behavior; updates again after S-006 when the freelancer-mode bullets ship).
- `AGENTS.md` §2.7 — current sprint snapshot (now reflects S-005 closing).
- `docs/plan.md` — S-006 plan.
- `docs/backlog.md` — what's planned and what's Ready (BLG-0016, BLG-0017, BLG-0018, BLG-0019).
- `docs/done.md` — completed work (S-005 added: BLG-0013 closed; ADR-0008..0012 listed for context; S-004 + S-003 + S-002 + S-000 unchanged).
