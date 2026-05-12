# Sprint S-010 — REV (Sprint Review)

- Type: discovery
- Theme: `receipt-format-scope-and-auth-modernization`
- Closed: 2026-05-12
- Chair: orchestrator

## Outcome

S-010 delivered its four outputs — three accepted ADRs and one DES — that resolve **both drift findings** surfaced by the 2026-05-12 live on-device acceptance run, and produce a complete Ready queue for S-011.

| Item | Outcome |
| --- | --- |
| **BLG-0026 — Receipt-format scope expansion (umbrella discovery item)** | **Done.** Multi-round ADR-0014 debate accepted; nine participants converged in Round 2 with no dissent. GR parser registry-of-adapters confirmed; `is_limited_info` flag added to the contract; family-by-family decisions recorded; AADE + Epsilon Net hosts added to the outbound allowlist with §5.8.1 consent preconditions for spike work. §2.2 / §2.8 / §2.9 amendments recorded in ADR-0014 §6 and landed verbatim in `AGENTS.md` by `product-owner`. Spawns five Ready BLGs (BLG-0027, BLG-0028, BLG-0029, BLG-0030, BLG-0032). |
| **BLG-0023 — Asymmetric JWT verification with JWKS** | **Ready.** Multi-round ADR-0015 debate accepted; six participants converged. Path 1 (hand-rolled + `cryptography==45.0.1`) chosen over path 2 (PyJWT). JWKS cache contract: 600s TTL, 60s refetch floor, hard-fail on unreachable. Algorithm allowlist: ES256 / RS256 / HS256 (transitional); `alg=none` rejected. ADR-0002 §1 superseded. Sized M; pulled first in S-011. |
| **BLG-0024 — Soft auth-error handling on the scanner** | **Ready.** Couples to BLG-0023; UREV step in S-011 validates the integration. Sized S. |
| **BLG-0025 — Formalize the JWT-rejection diagnostic log line** | **Ready.** ADR-0016 accepted; ADR-0002 §6 amended. ≥ 8 tests including redaction-regex scan. Sized XS; ships co-located with BLG-0023 PR. |
| **DES-0006 — Option A (HS256-rollback) sufficiency** | **Confirmed.** End-to-end verification recorded (curl loopback 422 + live device 502; both confirm auth gate accepts tokens). Sufficiency window: until BLG-0023 ships in S-011. Reversal procedure documented. |

## ADRs accepted

- **ADR-0014** — Receipt-format scope expansion. Status: accepted. Supersedes nothing; populates ADR-0001's registry premise with concrete GR adapters. Amends `AGENTS.md` §2.2 / §2.8 / §2.9 (content edits, owned by `product-owner`).
- **ADR-0015** — Asymmetric JWT verification. Status: accepted. **Supersedes ADR-0002 §1**; amends ADR-0002 §3 + §6. Adds new runtime dependency `cryptography==45.0.1` (lands in S-011).
- **ADR-0016** — JWT header logging. Status: accepted. **Amends ADR-0002 §6** (companion to ADR-0015's §6 amendment).

## `make check` at sprint close

**346 tests across 21+ suites — green** (unchanged from S-009 close — no code changes in this discovery sprint per `AGENTS.md` §4.1.1 + §4.7).

- Backend: `ruff check` + `mypy` + `pytest` → 143 passed (unchanged from S-009).
- Mobile: `tsc --noEmit` clean + `jest` → 203 passed across 19 suites (unchanged from S-009).

`make check` not actually re-executed in S-010 because no source files were modified — this is the same posture S-008 took at close per §4.7. Last successful run: S-009 close, 2026-05-09 11:50.

## §4.11 sign-offs

| Change kind | Required sign-off | Recorded |
| --- | --- | --- |
| New endpoint / API contract change | `architect` + `engineering-manager` | **N/A — none.** Discovery sprint. The ADR-0015 verifier-surface evolution lands as an S-011 PR; sign-offs there. |
| New mobile screen / UX flow | `product-designer` + `localization-specialist` | **Recorded.** ADR-0014 §5 + Round 1 — limited-info banner UX + Greek/English strings co-signed by `product-designer` + `localization-specialist`. Full DES under BLG-0027 in S-011. |
| Schema migration / new RLS policy | `data-architect` + `security-privacy-officer` | **Recorded.** ADR-0014 §2 — `receipts.is_limited_info boolean not null default false` migration co-signed by `data-architect` + `security-privacy-officer`. No RLS change. Migration ships under BLG-0027 in S-011. |
| Auth flow change (OTP, sessions, tokens) | `security-privacy-officer` + `data-architect` | **Recorded.** ADR-0015 — verifier rewrite (HS256-only → ES256 + RS256 + HS256-transitional via JWKS) co-signed by `security-privacy-officer`. `data-architect` co-sign is N/A because the schema is unchanged (the verifier is purely an auth-side change). |
| New / changed parser logic | `parser-specialist` + `qa` | **Recorded.** ADR-0014 § 1 + §2 — registry-of-adapters expansion + `is_limited_info` co-signed by `parser-specialist`. `qa` sign-off folded into the per-family BLG acceptance criteria (BLG-0027 / 0028 / 0029 / 0030 each carry their own test requirements). |
| New EU country adapter | `parser-specialist` + `architect` + `data-architect` | **N/A — no new country.** All three families A / B / C stay `country_code='GR'`; the schema is country-agnostic per `AGENTS.md` §5.9. |
| New runtime dependency | `agent-safety-officer` + `engineering-manager` | **Recorded.** ADR-0015 Round 1 + 2 — `cryptography==45.0.1` co-signed by `agent-safety-officer` (PyCA-maintained, CVE history scanned, supply-chain footprint accepted) + `engineering-manager` (path 1 over path 2 — one dep, not two). Dependency lands in S-011 with BLG-0023 implementation. |
| New MCP integration / new outbound host | `agent-safety-officer` + `architect` | **Recorded.** ADR-0014 §7 + LOG 19:05 — `www1.aade.gr` + `epsilondigital-3rdpartc.epsilonnet.gr` added to `.agents/context/outbound-allowlist.md` with documented scope (parser + spike fetches, §5.8.1 consent precondition). `agent-safety-officer` sign-off recorded in ADR-0014 Round 1 + 2 + 3; `architect` sign-off recorded in ADR-0014 Round 1 + 2 + 3. No actual outbound fetches in S-010 itself. |
| User-data flow change (PII, financial) | `security-privacy-officer` + `agent-safety-officer` | **Recorded.** ADR-0014 §2 + §5 — the `is_limited_info` UX banner shape co-signed; the UX honors "limited info is a property of the receipt format, not the app" framing. ADR-0015 — JWKS-unreachable behavior co-signed as hard-401 (no silent allow). ADR-0016 — JWT headers reaffirmed as PII-safe public metadata; payloads / signatures / tokens never logged. |
| Sprint scope change mid-sprint | `orchestrator` + `product-manager` | **N/A — no scope change.** The sprint executed exactly the scope set in PLN. |
| Adding / retiring an agent | `agents-doctor` (+ `orchestrator`) | **N/A — none.** |
| Edits to `AGENTS.md` | `agents-doctor` (structural) / section owner (content) / `orchestrator` (sprint LOG) | `agents-doctor` — N/A (no structural edits). Section owner — `product-owner` (§2.2 / §2.7 / §2.8 / §2.9 content edits per ADR-0014 §6 wording). `orchestrator` recorded in LOG 19:15 entry. |
| ADR co-signs | per ADR | All recorded in the three ADRs. |

## Drift items opened during S-010

None survived the sprint. The two drift items that drove the sprint (the BLG-0023 / 0024 / 0025 / 0026 set surfaced post-S-009) are all resolved — BLG-0023 / 0024 / 0025 lifted to **Ready**, BLG-0026 moved to **done** (umbrella). No new drift was surfaced *during* the sprint.

One **open question** is recorded as a follow-up, not as drift: the 2026-05-12 `502 upstream_error` from the live device against an in-wallet receipt that *did* pass the on-device validator. Candidate causes: receipt expired upstream, e-invoicing.gr 404 for the UUID + token pair, rate-limiting, HTML drift, or a near-matching camera misread. This is now folded into BLG-0030 as a related observation (the AADE spike work may incidentally surface that the test-device scan was actually an AADE QR pre-validator misread, in which case the `502` resolves itself by being scoped out). If BLG-0030 lands without explaining the 502, a new BLG-0033 opens in S-011 close.

## Backlog updates

- **BLG-0023** — updated in `docs/backlog.md`: status `drift` → **Ready**, sized M.
- **BLG-0024** — updated: status `drift` → **Ready**, sized S.
- **BLG-0025** — updated: status `drift` → **Ready**, sized XS.
- **BLG-0026** — moved to `docs/done.md` as the umbrella discovery item that produced ADR-0014.
- **BLG-0027** (new) — AADE tameiakí adapter — Ready, gated on BLG-0030. Owner `parser-specialist`. Sized M.
- **BLG-0028** (new) — Epsilon Net adapter — Ready, gated on fixture. Owner `parser-specialist`. Sized M.
- **BLG-0029** (new) — Family C identification spike — planned, gated on project-owner photo. Owner `parser-specialist`. Sized XS.
- **BLG-0030** (new) — AADE HTML-shape spike — Ready, gated on consented receipt. Owner `parser-specialist`. Sized XS-S.
- **BLG-0032** (new) — Mobile `validateGrQrCode` discriminated-union mirror — Ready, couples to BLG-0027 + BLG-0028. Owner `mobile-builder`. Sized S.
- **BLG-0033** (post-MVP, new) — Detect probable duplicates across QR sources for the same physical purchase — planned, post-MVP. Owner `product-manager`. Sized M.
- **BLG-0034** (post-BLG-0023, new) — Retire HS256 transitional support — planned, opens after BLG-0023 ships for one release cycle. Owner `architect`. Sized XS.
- BLG-0004 / BLG-0009 / BLG-0011 / BLG-0014 / BLG-0015 — unchanged.

## Outbound allowlist update

`.agents/context/outbound-allowlist.md` gained two entries:

- `https://www1.aade.gr` (production parser fetches + `docs/spikes/` with §5.8.1 consent).
- `https://epsilondigital-3rdpartc.epsilonnet.gr` (same scope).

Also added a clarifying note that `*.supabase.co` production-runtime usage now spans both data (`/rest/`) and auth verification (`/auth/v1/.well-known/jwks.json`) — same hostname, no new host, no new line entry; the existing `https://*.supabase.co` row is annotated.

## `AGENTS.md` updates

- **§2.7** — snapshot rewritten to reflect S-010 close + S-011 as the next sprint.
- **§2.2** — second bullet amended per ADR-0014 §6 (hedged SKU-level wording).
- **§2.8** — bullets 3 + 4 amended per ADR-0014 §6 (supported QR families list, limited-info acknowledgement).
- **§2.9** — added "Detection of probable duplicates across QR sources" line.
- **§2.6** — **unchanged**. No user-visible behavior shipped in S-010 (discovery sprint).

## Learnings

1. **Discovery sprints chained back-to-back with implementation are healthy.** S-008 → S-009 → S-010 demonstrates the alternating cadence per `AGENTS.md` §4.1.2 working as intended: a delivery sprint shipped (S-009), the first live use surfaced drift (S-010 trigger), discovery resolved it before the next delivery (S-011). The system *noticed* the drift, *paused* delivery, and *decided* what to do — exactly the §4.10 + §4.1.1 design.
2. **`agent-safety-officer` adding two outbound hosts in one sprint is a meaningful expansion.** The system has only ever added build-time hosts and the original four runtime hosts. Two new production-runtime hosts in one ADR is the largest single allowlist delta since bootstrap. The §5.8.1 consent precondition + the BLG-0027 ToS-review requirement keep the expansion principled.
3. **The §2.2 differentiator survives a meaningful hedge.** Before today, "SKU-level for every Greek receipt" was the unqualified pitch. After ADR-0014, "SKU-level when the QR carries it; merchant + total + date otherwise" is the precise pitch — and it is still the best Greek-consumer personal-finance posture available. The product story doesn't get worse; it gets *honest* and covers ~9x more receipts.
4. **Hand-rolled vs library** is consistent with the project's prior decisions. The verifier (ADR-0002 §1) was hand-rolled; the parser (ADR-0001) is hand-rolled. ADR-0015 continues that with `cryptography` as the single new dep — same posture as S-005's `reportlab` decision for PDF.
5. **One live debugging session can drive two sprints.** The 2026-05-12 session that surfaced Drift A + Drift B drove this whole discovery sprint plus most of the upcoming S-011 work. Real-device acceptance is the most productive kind of testing the project has had.

## Next sprint

Per `AGENTS.md` §4.1.2 (Ready queue has just been refilled): the next sprint is **implementation**.

- **S-011 — implementation (`auth-modernization-and-first-gr-adapter-expansions`)** — Ready queue:
  - **BLG-0023** (M) — asymmetric JWT verifier; lands first because it gates the long-term auth posture.
  - **BLG-0024** (S) — mobile soft auth-error handling; ships in the same PR or right after BLG-0023.
  - **BLG-0025** (XS) — JWT diagnostic-log contract + tests; co-located with BLG-0023.
  - **BLG-0030** (XS-S) — AADE HTML-shape spike; can run in parallel since it touches `docs/spikes/` not `backend/app/`.
  - **BLG-0032** (S) — Mobile `validateGrQrCode` discriminated-union mirror; couples to BLG-0027 + BLG-0028.
  - **BLG-0027** (M) — AADE adapter; pulled only if BLG-0030 lands early. May slip to S-012.
  - **BLG-0028** (M) — Epsilon Net adapter; same gating as BLG-0027 (fixture acquisition).
  - **BLG-0029** (XS) — Family C identification spike; pulled if owner photo arrives in time.

Sprint sizing risk: BLG-0023 + BLG-0024 + BLG-0025 + BLG-0030 + BLG-0032 is already M-heavy (~M + S + XS + XS-S + S ≈ 1.5 M-equivalents). BLG-0027 + BLG-0028 may carry to S-012. `product-manager` will scope at S-011 PLN open.
