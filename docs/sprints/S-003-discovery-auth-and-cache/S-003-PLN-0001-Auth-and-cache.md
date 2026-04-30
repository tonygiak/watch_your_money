# Sprint S-003 — Auth and cache (discovery)

- Type: discovery
- Theme: auth-and-cache
- Start: 2026-04-30
- Chair: orchestrator
- Participants: orchestrator, product-owner, product-manager, product-designer, architect, data-architect, parser-specialist, security-privacy-officer, agent-safety-officer, localization-specialist, qa, mobile-builder, backend-builder, engineering-manager, devops-engineer, go

## Why this sprint

Sprint S-002 (`scan-and-store`) closed green and shipped the first user-visible behavior — a real Greek QR can be scanned in the testable mobile stack and stored idempotently behind RLS. The Ready queue is now **empty**: every Ready item from S-001 was either delivered or kept open as a `planned` / `drift` backlog item that needs a fresh ADR before it's safe to build (BLG-0005, BLG-0006, BLG-0007, BLG-0012). Per `AGENTS.md` §4.1.2, the next sprint must therefore be **discovery**.

This sprint settles the four contracts that gate everything S-004 will pull:

1. **Phone OTP authentication** (BLG-0005) — provider, flow, rate limits, GDPR posture.
2. **Insights computation** (BLG-0006) — where week / month / year aggregations live so we hit the §2.5 5-second target without coupling logic to the DB schema.
3. **Offline cache** (BLG-0007) — receipts viewable offline once seen at least once, with an at-rest encryption decision for financial data on a user device.
4. **Expo runtime tree** (BLG-0012, drift from S-002) — pinned package set, supply-chain review, `tsconfig.json` / `make check` re-inclusion of `ScannerScreen.tsx` and `mobile/src/api/receipts.ts`.

It also lands one small admin (BLG-0010 — reconcile `AGENTS.md` §5.3.2 wording with ADR-0002).

## Goals

1. Decide and record **ADR-0004 — Phone-OTP provider, flow, and rate-limit story** (covers BLG-0005). Co-signs: `security-privacy-officer` + `data-architect` (RLS shape) + `agent-safety-officer` (any external SMS surface beyond the Supabase allowlist).
2. Decide and record **ADR-0005 — Insights computation strategy** (covers BLG-0006). Co-signs: `data-architect` + `architect`.
3. Decide and record **ADR-0006 — Offline cache strategy + at-rest encryption** (covers BLG-0007). Co-signs: `security-privacy-officer` + `architect`.
4. Decide and record **ADR-0007 — Expo runtime tree** (covers BLG-0012). Co-signs: `agent-safety-officer` + `engineering-manager` (per `AGENTS.md` §4.11 — "new runtime dependency" + supply-chain review).
5. Draft **DES-0002 — Login screen UX** (state machine, Greek-first copy) on top of ADR-0004.
6. Draft **DES-0003 — Insights screen UX** (period selector, by-category, by-merchant, vs-previous-period) on top of ADR-0005.
7. Refine **BLG-0005, BLG-0006, BLG-0007, BLG-0012** to **Ready** for S-004 implementation. Sharper acceptance for **BLG-0009** and **BLG-0011** (kept `planned`).
8. **BLG-0010** — small admin: edit `AGENTS.md` §5.3.2 to drop `user_id` from the body and explicitly cite ADR-0002.
9. Index ADR-0004..0007 in `.agents/context/decisions.md`.
10. Pick the next sprint type (implementation **S-004**, theme `login-insights-cache-runnable-scanner`) and reflect it in `docs/plan.md` and `AGENTS.md` §2.7.

## Scope

**In:**

- ADR-0004, ADR-0005, ADR-0006, ADR-0007.
- DES-0002 (login screen), DES-0003 (insights screen).
- Backlog refinement: BLG-0005..0007 + BLG-0012 to **Ready**; BLG-0009 + BLG-0011 stay `planned` with sharper acceptance.
- BLG-0010 admin edit to `AGENTS.md` §5.3.2.
- Smoke `make check` at sprint close (per `AGENTS.md` §4.10 / §6 of `run-sprint.md`).
- Documentation updates in `docs/plan.md`, `.agents/context/decisions.md`, `AGENTS.md` §2.7.

**Out (explicitly):**

- Production code changes. `AGENTS.md` §4.1.1 — discovery sprints ship no production code.
- Capturing real user receipts (BLG-0004 acquisition). Still gated on consenting users; not unblocked by any of this sprint's ADRs.
- The drift-detection CI hook (BLG-0009). Depends on a real-receipt canary which depends on BLG-0004; queued for a later sprint.
- The Profile language switch (BLG-0011). Out of MVP scope per `AGENTS.md` §2.9.
- Any change to the outbound allowlist beyond what each ADR records and `agent-safety-officer` sign-offs.

## Ready items pulled (delivery only)

N/A — discovery sprint.

## Risks & known unknowns

- **Risk: Supabase native phone OTP carries paid SMS provider.** If Supabase's phone provider depends on Twilio or MessageBird under the hood, that would technically expose us to a "third-party paid service beyond Supabase / Railway / Render / `e-invoicing.gr`" reading of `AGENTS.md` §2.4. *Mitigation*: ADR-0004 reads §2.4 strictly: Supabase is allowed; Supabase-managed external SMS providers count as part of Supabase from the app's perspective (we don't directly contract with them). Recorded as a Round-1 concern and resolved by §4.4 tie-breaker (hard-constraint reading).
- **Risk: insights coupling.** Pushing aggregation into Postgres (views) is fast but couples logic to the schema; pushing it into Python is portable but slower. *Mitigation*: ADR-0005 picks a path that keeps SQL **inside the FastAPI layer** (parameterized queries, no DB views in the MVP) — same code-locality as the parser, cleanly testable, room to migrate to materialized views later without contract change.
- **Risk: encryption-at-rest UX cost.** OS-keystore-backed encryption (Keychain / Android Keystore via `expo-secure-store`) adds latency and a key-management story. *Mitigation*: ADR-0006 caps cache size (≤ 200 receipts), encrypts only the cached blob (not in-memory state), and restricts what's cached (no `raw_html`).
- **Risk: Expo dep tree expansion.** Pulling `expo-camera`, `expo-localization`, `react-native`, `@supabase/supabase-js`, plus `jest-expo` + `@testing-library/react-native` is a meaningful supply-chain delta. *Mitigation*: ADR-0007 pins exact versions, lock files committed, `agent-safety-officer` runs `review-external-surface.md` before sign-off, allowlist already covers `registry.npmjs.org` and `expo.dev`.
- **Risk: discovery scope creep.** Adding ADRs for, e.g., the Insights endpoint shape pulls work from S-004. *Mitigation*: this sprint stops at ADR + DES + Ready acceptance bullets; concrete endpoint shapes ride DES-0003 + ADR-0005 and are encoded as acceptance bullets on BLG-0006, not new ADRs.

## User direction (if `go` was used)

- Direction: **"Move on sprint 3"**.
- Honored in scope: **yes** — `orchestrator` confirms the user direction matches the queued plan exactly (S-003 discovery, theme `auth-and-cache`). No backlog split required; no re-prioritization. Recorded here per `AGENTS.md` §7 / `.agents/agents/go.md`.

## Definition of done

- ADR-0004, ADR-0005, ADR-0006, ADR-0007 written, accepted, and indexed in `.agents/context/decisions.md`.
- DES-0002 + DES-0003 written.
- BLG-0005, BLG-0006, BLG-0007, BLG-0012 satisfy the Definition of Ready (`AGENTS.md` §4.1.3).
- BLG-0010 closed: `AGENTS.md` §5.3.2 drops `user_id` from the body and cites ADR-0002. Moved to `docs/done.md`.
- BLG-0009, BLG-0011 stay `planned` with sharper acceptance.
- `docs/plan.md` updated with the S-004 implementation plan.
- `AGENTS.md` §2.7 updated.
- Sprint REV + UREV written.
- `make check` re-run as smoke check (no production code changed; same rule as S-001 close).
