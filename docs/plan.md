# Plan

The current direction of the project and the focus of the next sprint.

## Where we are right now

Sprint **S-011 (implementation, `auth-modernization-and-jwt-header-logging-contract`)** has just closed. **BLG-0023 + BLG-0024 + BLG-0025 all shipped in one PR** per the ADR-0015 §8 + ADR-0016 §3 hard-ordering constraint.

- **BLG-0023 — Asymmetric Supabase JWT verifier on the backend.** `backend/app/auth.py` rewritten end-to-end per ADR-0015. New dep `cryptography==45.0.1` (the only dep added — PyJWT stayed rejected). Hand-rolled verifier covering ES256 + RS256 + HS256-transitional with a strict algorithm allowlist and a `(alg, key-type)` cross-check matrix that rejects RS256-signed-with-EC-key and ES256-signed-with-RSA-key mismatches. `alg=none`, malformed shapes, unknown KIDs, bad signatures, expired / wrong-audience / wrong-subject claims all rejected with the same RFC-7807 envelope clients already speak. `CachedJwksProvider` implements 600 s TTL + 60 s refetch-floor; serves stale keys on transient fetch failure if a cache exists; hard-fails 401 only on unreachable-and-no-cache. New singleton `app/services/jwks_provider.py` wires it into FastAPI DI. **Backend tests: 39 in `tests/auth/test_jwt.py` (was 9) + 9 in `tests/test_auth_logging.py` (new) — see BLG-0025.**
- **BLG-0024 — Mobile soft auth-error handling.** Scanner reducer (`mobile/src/screens/scanner/state.ts`) gains `auth_error_recoverable` + `auth_error_terminal` states + `hasAttemptedAuthRefresh` flag + a new `RETRY_AFTER_REFRESH` action. The first 401 on a scan now silently calls `supabase.auth.refreshSession()` (wired through `App.tsx`) and re-attempts the parse before surfacing the terminal sign-out path. New string `scanner.error.auth.refreshing` (el + en). The reducer + screen changes are gated by the new `refreshSession` prop so tests can inject a fake. **Mobile tests: scanner state reducer covers all four new transitions.**
- **BLG-0025 — JWT-rejection diagnostic log line formalized.** ADR-0016 §3 test contract implemented in `backend/tests/test_auth_logging.py`. Asserts: exactly one log line per `JwtError`, fields `code` + `alg` + `typ` + `kid` (truncated to `first 6 chars + "…"`) + static `reason`; malformed tokens log `None` for header fields without crashing; and — most importantly — a redaction regex scans every captured log record to prove the full token, the `Bearer ` prefix, the payload claims (email / phone / sub), and the raw `Authorization` value never appear in logs. ADR-0002 §6 amendment recorded by ADR-0016 itself.

Backlog state after S-011:

- **Ready (carried to S-012)**: BLG-0030 (XS-S, gated on consented AADE receipt), BLG-0027 (M, gated on BLG-0030), BLG-0028 (M, gated on consented Epsilon Net fixture), BLG-0032 (S, couples to BLG-0027 + 0028).
- **Planned (gated)**: BLG-0029 (XS, gated on owner photo of Family C receipt), BLG-0033 (M, post-MVP), BLG-0034 (XS, **gated on BLG-0023 running one release cycle in production**).
- **Carried**: BLG-0004, BLG-0009, BLG-0011, BLG-0014, BLG-0015 — unchanged.

For the latest user-facing snapshot, read `AGENTS.md` §2.6 (no shipped user-visible behavior in S-011 beyond the silent BLG-0024 refresh — see §2.6 entry) and §2.7 (updated with the S-011 close).

`make check` posture: **389 tests across 21+ suites — green** (346 → 389, +43: +30 in `tests/auth/test_jwt.py`, +9 in `tests/test_auth_logging.py`, +4 in `mobile/__tests__/screens/scanner/state.test.ts`).

## Next sprint

- **Type**: `implementation` (Ready queue carried from S-011 + S-010).
- **Theme**: **First GR adapter expansions** — BLG-0030 (AADE HTML-shape spike) lands first since it gates BLG-0027; BLG-0027 (AADE limited-info adapter) and BLG-0028 (Epsilon Net full-SKU adapter) ship next; BLG-0032 (mobile QR-validator discriminated-union mirror) couples to both adapters and ships in the same PR or right after.
- **Number**: **S-012**.
- **Why implementation**: §4.1.2 — Ready queue is non-empty (BLG-0030 / 0027 / 0028 / 0032 all Ready, with the gating order well-understood from ADR-0014). `make check` must be green at sprint close per §4.7.

### Sizing risk

BLG-0030 (XS-S) + BLG-0027 (M) + BLG-0028 (M) + BLG-0032 (S) ≈ ~2 M-equivalents. The bottleneck is **consented-fixture acquisition**: BLG-0030 needs one AADE receipt under §5.8.1, BLG-0028 needs one Epsilon Net receipt under §5.8.1. If either fixture stalls, the corresponding adapter carries to S-013. BLG-0032 can ship the *shape* (discriminated union + tests for E-invoicing + AADE patterns) ahead of either adapter landing — the mobile validator should be allowed to discriminate even if the backend adapter returns "limited info pending."

### Acceptance at S-012 review

- `backend/app/parsers/gr/` re-organized as a registry-of-adapters per ADR-0014 §3: `einvoicing/`, `aade/`, `epsilon/` subpackages each exposing `parse(html_or_qr) -> ParsedReceipt`; the dispatcher in `backend/app/parsers/gr/__init__.py` (or `registry.py`) routes based on QR shape.
- `ParsedReceipt` (and the `receipts` table) gains the `is_limited_info: bool` field per ADR-0014 §4. Schema migration applied + RLS regression test.
- `docs/spikes/gr-aade-html-shape/` removed (or marked closed) once BLG-0027 lands — the spike's recommendation lives in the adapter's docstring.
- ≥ 2 consented AADE fixtures + ≥ 2 consented Epsilon Net fixtures in `backend/tests/fixtures/receipts/` with `provenance.md` per §5.8.1.
- `mobile/src/parsers/gr.ts` exposes `validateGrQrCode(rawText): { family: "einvoicing"|"aade"|"epsilon", ... } | { family: "unknown", reason: ... }`; `validateGrQrUrl` stays as a delegate for backwards compatibility.
- `make check` green; 389 → ~410+ tests after the adapter + validator additions land.
- `AGENTS.md` §2.6 updated with the new user-visible behavior (scanning an AADE receipt now lands in history as a limited-info receipt; scanning an Epsilon Net receipt now lands with full SKUs); §2.7 snapshot at S-012 close.

### Cadence after that

- **S-013** — likely implementation, mopping up whichever of BLG-0027 / BLG-0028 carries from S-012 plus BLG-0029 (Family C, if owner photo arrives) plus any BLGs spawned by BLG-0030's findings. If a non-trivial product decision surfaces (e.g. AADE genuinely forbids automated fetches and BLG-0027 narrows to QR-string-only mode), a small discovery interlude may be inserted between S-012 and S-013.
- **Post-MVP** — BLG-0033 (cross-source dedup) and BLG-0034 (HS256 retirement) stay parked. BLG-0034 unlocks once BLG-0023 has run one production release cycle without incident.

## Open questions for S-012

- **AADE ToS / robots.txt outcome.** Still open from S-011's open questions list. If AADE forbids automated fetches, BLG-0027 narrows to "parse-the-QR-string-only mode" (the SIG hex becomes `mark`, merchant remains "Άγνωστος έμπορος" until a future feature). The §2.2 / §2.8 wording from ADR-0014 §6 already permits this degraded path because it explicitly hedges to "merchant + total + date when the format is limited-info." `agent-safety-officer` sign-off required for the first BLG-0030 fetch.
- **The 2026-05-12 `502 upstream_error` from the live device.** Still unexplained. Hypothesis remains: AADE QR misread as e-invoicing.gr by the pre-validator. BLG-0030's HTML-shape work may incidentally explain it; if not, open BLG-0035 in S-012 close.
- **Family C identification timing.** BLG-0029 is gated on the project owner sending a photo of the printed receipt + system name. If it doesn't arrive by S-012 open, BLG-0029 carries to S-013.
- **Supabase JWT-key rotation timing.** Per `docs/runbooks/rotate-supabase-jwt-signing-keys.md`, rotation back to ES256 should be scheduled within S-012's deploy window now that BLG-0023 is live and ≥ 95% covered. The HS256-transitional path stays active for ≥ one full release cycle post-rotation; BLG-0034 retires it.

## Notes for whoever picks this up

- **The asymmetric verifier is now the production posture-in-waiting.** `backend/app/auth.py` does the right thing on every algorithm; the only step left is the Supabase project rotation (runbook above). Do **not** delete the HS256-transitional code path until BLG-0034 — that code-path is what protects users mid-rotation if a token signed under the old HS256 key arrives at a backend that already trusts the new JWKS.
- **ADR-0014 is the contract for S-012.** Read it (especially §3 registry-of-adapters and §6 product wording amendments) before opening BLG-0027 or BLG-0028. The multi-round debate records the rationale.
- **No outbound fetches to AADE or Epsilon Net have happened yet.** The allowlist is updated; the first actual HTTP calls are BLG-0030 (AADE, under §5.8.1 consent) and the BLG-0028 inline spike (Epsilon Net, under §5.8.1 consent). Spike artifacts live under `docs/spikes/` and are never sent to LLMs / MCPs (§3.2.2).
- **PowerShell `make check` quirk persists** with the Greek folder name. Direct binary invocations (`ruff check`, `mypy`, `pytest`, `tsc`, `jest`) remain the documented workaround.
- **`NODE_EXTRA_CA_CERTS` workaround from S-009 is still in force.** Per-developer-machine; not committed; documented in `S-009-UREV-0001`.
- **The S-005 / S-007 / S-008 / S-009 / S-010 ADRs stay locked.** ADR-0001 (parser interface) is **populated** by ADR-0014 but not superseded — the contract holds verbatim. ADR-0002 §1 is **superseded** by ADR-0015; ADR-0002 §6 is **amended** by ADR-0016.
