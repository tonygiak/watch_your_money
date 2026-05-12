# Plan

The current direction of the project and the focus of the next sprint.

## Where we are right now

Sprint **S-010 (discovery, `receipt-format-scope-and-auth-modernization`)** has just closed. **Three ADRs accepted + one DES recorded.** Both drift findings from the 2026-05-12 live on-device acceptance run are resolved at the decision level; implementation lands in S-011.

- **ADR-0014 — Receipt-format scope expansion.** 9-participant chaired debate. GR parser becomes a registry-of-adapters within `backend/app/parsers/gr/` (sibling subpackages `einvoicing/`, `aade/`, `epsilon/`). New boolean `is_limited_info` on `ParsedReceipt` + `receipts` schema (default false; lands in S-011 under BLG-0027). Family A (AADE tameiakí `q1.php?SIG=...`) in MVP as a limited-info adapter (gated on BLG-0030 spike confirming SKU-level ceiling). Family B (Epsilon Net) in MVP as a full-SKU adapter. Family C (15-hex non-URL codes) pending identification (BLG-0029). Two new outbound hosts added to `.agents/context/outbound-allowlist.md`: `www1.aade.gr` and `epsilondigital-3rdpartc.epsilonnet.gr`, scoped to parser + spike fetches with §5.8.1 consent precondition. `AGENTS.md` §2.2 / §2.8 / §2.9 amended verbatim per ADR-0014 §6.
- **ADR-0015 — Asymmetric JWT verification.** 6-participant chaired debate. Supersedes ADR-0002 §1. Hand-rolled verifier + `cryptography==45.0.1` (one dep, not two; PyJWT rejected). JWKS cache: 600s TTL, 60s refetch-floor, hard-fail-401 on unreachable. Algorithm allowlist: ES256 + RS256 + HS256-transitional. ≥ 22 tests, ≥ 95% line coverage on `app/auth.py`. Mobile coupling: BLG-0024 (silent refresh + retry before sign-out).
- **ADR-0016 — JWT header logging.** 4-participant chaired debate. Amends ADR-0002 §6. JWT header fields (`alg`, `typ`, `kid`-truncated) classified as PII-safe public metadata; payloads / signatures / full token / `Authorization` value never logged. ≥ 8 tests including a redaction-regex scan across every captured log record.
- **DES-0006 — Option A (HS256-rollback) sufficiency confirmed.** End-to-end verified 2026-05-12 17:43 UTC+3 (synthetic curl 422 + live device 502 — auth gate accepts tokens in both cases). Sufficiency window: until BLG-0023 ships in S-011.

Backlog state after S-010:

- **Ready**: BLG-0023 (M), BLG-0024 (S), BLG-0025 (XS), BLG-0027 (M, gated on BLG-0030), BLG-0028 (M, gated on fixture), BLG-0030 (XS-S, gated on consented receipt), BLG-0032 (S, couples to BLG-0027 + 0028).
- **Planned (gated)**: BLG-0029 (XS, gated on owner photo of Family C receipt), BLG-0033 (M, post-MVP), BLG-0034 (XS, post-BLG-0023).
- **Carried**: BLG-0004, BLG-0009, BLG-0011, BLG-0014, BLG-0015 — unchanged.

For the latest user-facing snapshot, read `AGENTS.md` §2.6 (unchanged — no user-visible behavior shipped in this discovery sprint) and §2.7 (updated with the S-010 close).

`make check` posture: **346 tests across 21+ suites — green** (unchanged from S-009 close, as expected for a zero-code discovery sprint per `AGENTS.md` §4.7 + §4.1.1).

## Next sprint

- **Type**: `implementation` (Ready queue refilled by S-010).
- **Theme**: **Auth modernization + first GR adapter expansions** — BLG-0023 (asymmetric JWT verifier) lands first because it gates the long-term auth posture; BLG-0024 (mobile soft auth-error) and BLG-0025 (JWT-header logging contract + tests) ship in the same PR or right after; BLG-0030 (AADE HTML-shape spike) runs in parallel since it touches `docs/spikes/` not `backend/app/`; BLG-0032 (mobile QR-validator discriminated-union mirror) couples to BLG-0027 + 0028; BLG-0027 + BLG-0028 (the per-family adapters) are pulled if BLG-0030 + fixture acquisition resolve in time, otherwise carry to S-012.
- **Number**: **S-011**.
- **Why implementation**: §4.1.2 — Ready queue is non-empty (BLG-0023 / 0024 / 0025 / 0030 / 0032 all Ready). `make check` must be green at sprint close per §4.7.

### Sizing risk

The Ready queue is M-heavy: BLG-0023 (M) + BLG-0024 (S) + BLG-0025 (XS) + BLG-0030 (XS-S) + BLG-0032 (S) ≈ ~1.5 M-equivalents *before* pulling either of BLG-0027 / BLG-0028 (each M). `product-manager` will scope at S-011 PLN open and may choose to ship BLG-0023 + BLG-0024 + BLG-0025 + BLG-0030 + BLG-0032 in S-011 and carry BLG-0027 / BLG-0028 to S-012. The hard ordering constraint is **BLG-0023 + BLG-0024 + BLG-0025 must land together** (per ADR-0015 §8 and ADR-0016 §3 — they share a PR for review safety).

### Acceptance at S-011 review

- `cryptography==45.0.1` in `backend/requirements.txt`; `backend/.env.example` updated with the new config variables; `backend/app/auth.py` rewritten with the asymmetric verifier + JWKS cache + algorithm allowlist; `backend/app/auth.py:extract_header_metadata` helper extracted.
- `backend/tests/test_auth_logging.py` (new) with the ≥ 8 tests from ADR-0016 §3 including the redaction regex scan; `backend/tests/auth/test_jwt_*.py` expanded to ≥ 22 tests covering the algorithm allowlist; ≥ 95% line coverage on `app/auth.py`.
- `mobile/src/screens/scanner/state.ts` (and equivalent state files for tag-panel, profile, receipt-detail) extended with the recoverable + terminal auth-error states; `refreshSession()` adapter wired through `App.tsx`.
- `docs/spikes/gr-aade-html-shape/` with the consented AADE receipt's HTML + field-map + ToS/robots.txt review + adapter-recommendation summary.
- `mobile/src/parsers/gr.ts` exposes `validateGrQrCode` (discriminated union); existing `validateGrQrUrl` stays as a delegate.
- `docs/runbooks/` gains two new runbooks: "rotate Supabase JWT signing keys" and "rollback to HS256-only."
- `make check` green; 346 → likely ~370+ tests after the BLG-0023 + BLG-0025 additions land.
- `AGENTS.md` §2.6 updated with any new user-visible behavior (BLG-0024 toast on the recoverable path; BLG-0027 + BLG-0028 banner / scanner family-recognition if they land in S-011); §2.7 snapshot at S-011 close.
- Operator runbook step at S-011 deploy: rotate the Supabase project from "Legacy HS256" back to "JWT Signing Keys (ES256)" — the Option A workaround reverses once BLG-0023 is verified in staging.

### Cadence after that

- **S-012** — likely implementation, carrying BLG-0027 + BLG-0028 + BLG-0029 (if owner photo arrives) + any new BLGs that emerge from BLG-0030's recommendation. If a non-trivial product decision surfaces (e.g. AADE genuinely forbids automated fetches and BLG-0027 narrows to QR-string-only mode), a small discovery interlude may be inserted.

## Open questions for S-011

- **The 2026-05-12 `502 upstream_error` from the live device.** The same session that triggered S-010 logged a `502 upstream_error` from `POST /receipts/parse` for a real device-originated request that *did* pass the on-device validator. Hypothesis: that scan was actually an AADE QR misread as an e-invoicing.gr URL by the pre-validator. BLG-0030's HTML-shape work may incidentally explain this. If BLG-0030 lands without explaining the 502, open BLG-0035 in S-011 close.
- **AADE ToS / robots.txt outcome.** If AADE forbids automated fetches, BLG-0027 narrows to "parse-the-QR-string-only mode" (the SIG hex becomes `mark`, merchant remains "Άγνωστος έμπορος" until a future feature). The §2.2 / §2.8 wording from ADR-0014 §6 already permits this degraded path because it explicitly hedges to "merchant + total + date when the format is limited-info."
- **Family C identification timing.** BLG-0029 is gated on the project owner sending a photo of the printed receipt + system name. If it doesn't arrive by S-011 open, BLG-0029 carries to S-012.

## Notes for whoever picks this up

- **ADR-0014 / ADR-0015 / ADR-0016 are the contracts now.** Read all three before opening BLG-0023 / BLG-0027 / BLG-0028 implementation work. The multi-round debates in each ADR record the rationale; if a design decision seems surprising during implementation, the answer is almost certainly already in those rounds.
- **Option A is the production posture today.** The Supabase project is on Legacy HS256 keys. DES-0006 documents this and the reversal procedure. **Do not change Supabase signing-key configuration until BLG-0023 is verified in staging.** The S-011 BLG-0023 deploy step explicitly switches the project back to JWT Signing Keys *after* the new verifier is live.
- **No outbound fetches to AADE or Epsilon Net have happened yet.** The allowlist is updated; the first actual HTTP calls are BLG-0030 (AADE, under §5.8.1 consent) and the BLG-0028 inline spike (Epsilon Net, under §5.8.1 consent). Spike artifacts live under `docs/spikes/` and are never sent to LLMs / MCPs (§3.2.2).
- **The diagnostic log line in `backend/app/routes/receipts.py` lines 287–339 (working-tree carry-over from the 2026-05-12 session) is correct in shape.** BLG-0025 / ADR-0016 lock it in with a regression test + a redaction regex test. The S-011 BLG-0023 PR absorbs it as the verifier rewrite touches the same surface; the header-extraction logic moves to `app/auth.py:extract_header_metadata`.
- **PowerShell `make check` quirk persists** with the Greek folder name. Direct binary invocations (`ruff check`, `mypy`, `pytest`, `tsc`, `jest`) remain the documented workaround.
- **`NODE_EXTRA_CA_CERTS` workaround from S-009 is still in force.** Per-developer-machine; not committed; documented in `S-009-UREV-0001`.
- **The S-005 / S-007 / S-008 / S-009 ADRs stay locked.** No changes from this sprint. ADR-0001 (parser interface) is **populated** by ADR-0014 but not superseded — the contract holds verbatim.
