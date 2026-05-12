# Plan

The current direction of the project and the focus of the next sprint.

## Where we are right now

Sprint **S-009 (implementation, `sdk-upgrade-and-on-device-acceptance-v2`)** has just closed. **The three-sprint Expo SDK 51 → 54 upgrade landed.**

ADR-0013 §3 pre-flight checklist executed end-to-end on the local Windows host:

- Step 1 (`node --version` → v22.22.0) passed.
- Step 2 (Node.js update) skipped — already on LTS.
- Step 3 (TLS smoke test, `npm pack expo@^54.0.0 --dry-run`) **failed even on Node v22** with `UNABLE_TO_VERIFY_LEAF_SIGNATURE`.
- Step 3a (export Windows OS-managed CA bundle to `~/ca-bundle.pem` + set `NODE_EXTRA_CA_CERTS`) **passed the retry on the first try**: 62 OS-managed root CAs, 97208-byte PEM bundle, never committed, fully reversible.
- Step 4 (`npx expo install --fix` + `expo-doctor`) clean: **17/17 checks passed, no issues detected**.

`mobile/package.json` rewritten with the SDK 54 pin set (exact pins per ADR-0007 §1): `expo@54.0.34`, `react@19.1.0`, `react-native@0.81.5`, plus the full Expo SDK 54 native modules and `jest-expo@54.0.17`. Both ADR-0012 §3 deviations closed: `@react-native-community/netinfo@11.4.1` (was 11.3.2), `typescript@5.9.2` (was 5.6.3). Three drift candidates resolved in-sprint as runtime-tree mechanics: `mobile/tsconfig.json` `moduleResolution: "node"` override removed; eight `JSX.Element` migrated to `React.JSX.Element`; `babel-preset-expo@54.0.10` + `expo-modules-core@3.0.30` promoted to direct devDependencies for SDK 54 + npm 10 hoisting. The S-007 encryption-stack round-trip test runs unchanged under SDK 54's `@noble/ciphers@0.5.3`. `react-native-chart-kit@6.12.0` survived — BLG-0014 stays passive per ADR-0012 §6. ADR-0012 §1 (EAS dev client rejection) **remains in force** — Option A was sufficient.

The §2.8 MVP bullets 4 (on-device receipt scanning under stock Expo Go) and 9 (PDF export → native share sheet) are now reachable on a real Greek consumer's phone via the verification path in `S-009-UREV-0001`.

`make check` is **green at S-009 close: 143 backend + 203 mobile = 346 tests across 21+ suites** under `jest-expo@54.0.17` + `react@19.1.0` + `react-native@0.81.5`. Identical count to S-007 / S-008 close — no new tests; the contract surface didn't change, only the runtime tree moved underneath.

For the latest user-facing snapshot, read `AGENTS.md` §2.6 (BLG-0016 + BLG-0020 / BLG-0021 on-device-resolution lines added) and §2.7 (snapshot now reflects S-009 closing).

## Drift discovered post-S-009 close (2026-05-12 live debugging session)

Between S-009 close and the start of S-010, a live on-device debugging session with the project owner surfaced **two distinct drift findings** that redirect S-010's theme and add three new backlog items.

### Drift A — Backend auth misconfigured against Supabase asymmetric JWT signing keys

While exercising the §2.8 MVP end-to-end on a real device, **every `POST /receipts/parse` request returned 401**. Root cause traced in ~10 minutes via an ad-hoc diagnostic log line added to `jwt_exception_handler` (now also tracked as BLG-0025): the Supabase project was auto-rotated 6 days earlier (2026-05-06) from the legacy HS256 JWT secret to the new ECC P-256 (ES256) signing key. The hand-rolled HS256-only verifier in `backend/app/auth.py` (ADR-0002 §1, deliberately stdlib-only) refused the ES256 token with `jwt_malformed: unsupported alg: 'ES256'`. Compounding: the operator's `SUPABASE_JWT_SECRET` env var had a UUID pasted in (likely the kid of the current signing key), not the actual legacy HS256 secret value.

**Mitigation in-session (Option A)**: rotate the Supabase project back to the Legacy HS256 signing key via JWT Signing Keys → "Move to standby" on the previously-used key → "Rotate keys", then set `SUPABASE_JWT_SECRET=<the actual legacy secret value from the "Reveal" button on the Legacy JWT Secret tab>`, then full uvicorn restart. **Option A is verified end-to-end as of 2026-05-12 17:43 UTC+3**: (a) a synthetic-URL `POST /receipts/parse` from `127.0.0.1` returned `422 Unsupported QR URL` in 47 ms with no `jwt_rejected` line — auth gate passed, parser correctly rejected the fake URL; (b) live `POST /receipts/parse` from the test device at `192.168.1.208` returned `502 upstream_error` for at least one in-wallet receipt — meaning that receipt passed both the on-device validator AND the backend auth gate before failing only at the upstream-fetch step. The mitigation holds until BLG-0023 lands.

**Long-term fix**: BLG-0023 (asymmetric JWT verification with JWKS support — S-010 discovery → S-011 implementation). Co-fix: BLG-0024 (soft auth-error handling in the scanner — silent token refresh + retry before sign-out, so a transient JWKS-cache miss can't hard-sign-out the user).

### Drift B — Real Greek receipts do not match the §2.8 "Entersoft or SoftOne via e-invoicing.gr" scope

The same on-device run surfaced **three distinct Greek QR families**, none currently handled by `mobile/src/parsers/gr.ts` or `backend/app/parsers/gr/`. Of the receipts scanned: **0 were `e-invoicing.gr` viewer URLs**.

| Family | Shape | Count | Notes |
| --- | --- | --- | --- |
| A | `https://www1.aade.gr/tameiakes/myweb/q1.php?SIG=<hex>` | 8 | AADE "Σύστημα Σήμανσης" cash-register per-receipt signature URL. The most common Greek consumer receipt format. **Open product question**: AADE's verification page typically returns merchant + date + signature + totals — *not* SKU-level. Hits §2.2 differentiator. |
| B | `https://epsilondigital-3rdpartc.epsilonnet.gr/fd/<hash>:<n>` | 1 | Epsilon Net fiscal-doc viewer — same tier as Entersoft / SoftOne but on their own domain instead of `e-invoicing.gr`. Adapter pattern likely transfers cleanly. |
| C | `45C07BD642067E5` (15 hex chars, not a URL) | 5 (same physical receipt re-scanned) | Unknown — possibly a MARK, fiscal signature, or verification code. Identification + integration path TBD. |

This is the dominant signal for what S-010 must discover. **Long-term fix**: BLG-0026 (umbrella discovery scope; spawns per-family Ready BLGs at S-010 close).

## Next sprint

- **Type**: `discovery`
- **Theme**: **Receipt-format scope expansion — AADE tameiakí + Epsilon Net + non-URL codes** (Drift B). The four post-MVP discovery questions previously listed here (post-MVP direction quartet, §2.9 refresh, EAS pre-launch ADR, audit refresh) become subordinate to this finding; they may still be on the table but only after the receipt-format scope is decided.
- **Number**: **S-010**
- **Why discovery**: §4.1.1 — multi-agent scope-redefining decision requiring `architect` + `parser-specialist` + `data-architect` + `product-owner` + `product-manager` + `security-privacy-officer` + `agent-safety-officer` + `localization-specialist`, chaired by `orchestrator` per §4.4. No production code can ship until the ADRs land.

### Discovery questions for S-010 (revised order — receipt-format expansion first)

1. **Receipt-format scope (BLG-0026, primary theme).** For each of the three families A / B / C:
   - Is it in scope for the MVP §2.8 bullet 3, or do we revise §2.8 to acknowledge a "supported QR set" smaller than "all Greek receipts"?
   - Does the integration path preserve §2.2 SKU-level data? Specifically for Family A (AADE), what is the data ceiling when scanning the signature URL alone, and is an alternative path (myDATA B2C with user TIN — new auth surface) acceptable for §2.4 hard constraints?
   - Each new family adds a new outbound host — `www1.aade.gr` and `epsilondigital-3rdpartc.epsilonnet.gr`. `agent-safety-officer` must approve the allowlist update before any spike fetches.
2. **Auth modernization (BLG-0023 + BLG-0024).** Adopt Supabase asymmetric JWT signing keys (ES256/JWKS) on the backend. Multi-sign-off per §4.11: `architect` + `security-privacy-officer` + `agent-safety-officer` + `engineering-manager` + `backend-builder`. Couples with the soft auth-error mobile change so the rollout doesn't sign users out on a transient JWKS-cache miss.
3. **Diagnostic log formalization (BLG-0025).** Lock in the ad-hoc 2026-05-12 change with a regression test + a redaction test (token / payload / signature never logged) + an ADR-0002 §6 amendment recognizing JWT *headers* as loggable public metadata.
4. **Auth-fix verification (Option A from this session) — DONE in-session.** Both a synthetic-URL test and a live mobile request confirmed the HS256 auth gate now accepts Supabase-issued tokens after the JWT-key rollback. No S-010 DES note required for this; the verification record lives in this `docs/plan.md` "Drift A" section and in terminal 39's trace.
5. **Deferred — only addressed if time permits after 1–4.** The previous quartet:
   - (a) Real-receipt fixture set + drift detection (BLG-0004 + BLG-0009) — now coupled to BLG-0026 (each new family needs its own fixtures).
   - (b) EU country expansion — likely **deferred to S-012+**. Family C may turn out to be a Greek format anyway; let the country-agnostic parser registry first prove out on three GR sub-adapters before adding a non-GR adapter.
   - (c) Post-MVP UX gaps (BLG-0011 language switch).
   - (d) §2.9 out-of-scope list refresh.
   - (e) EAS pre-launch ADR (ADR-0007 §7).
   - (f) `agent-safety-officer` audit refresh on `NODE_EXTRA_CA_CERTS` runbook.

### Acceptance at S-010 review

- ADR(s) under `docs/adr/S-010-*` covering BLG-0026 (per-family scope decisions), BLG-0023 (asymmetric JWT verification), and an amendment to ADR-0002 §6 (BLG-0025 logging recognition).
- Per-family Ready BLGs (e.g. BLG-0027 AADE adapter, BLG-0028 Epsilon Net adapter, BLG-0029 non-URL-code identification) carrying outcome, acceptance criteria, fixture-acquisition plan with §5.8.1 consent, localization + RLS + country-code impact notes.
- DES note confirming Option A is sufficient until BLG-0023 lands.
- `.agents/context/outbound-allowlist.md` updated with `www1.aade.gr` and `epsilondigital-3rdpartc.epsilonnet.gr` (allowlisted for parser fetches only, allowlisted for in-sprint spike fetches only) per `agent-safety-officer` sign-off.
- `make check` not run if no code changed (§4.7 — discovery sprint).
- `AGENTS.md` §2.6 unchanged (no user-visible behavior shipped in discovery); §2.7 + `docs/plan.md` updated at sprint close per §4.1.5.

### Cadence after that

- **S-011** — implementation, scoped to the Ready items that emerge from S-010. Likely BLG-0023 + BLG-0024 + BLG-0025 + the first 1–2 per-family adapters from BLG-0026.

## Open questions for S-010

- **Family C identification.** What system emits a 15-hex-char QR with no URL prefix? Candidate hypotheses: (i) older or non-certified thermal printer encoding the receipt MARK without a viewer URL, (ii) a B2B-only myDATA identifier, (iii) a verification code intended to be typed into a portal rather than scanned. Resolution path: ask the project owner for the printed receipt's merchant + a photo of the QR area + the printed text near the QR (which usually identifies the system).
- **AADE SKU-level data ceiling.** Can scanning `q1.php?SIG=...` plus following onward links from the AADE verification page get us to SKU-level, or is myDATA B2C the only path? Resolution: a sandbox spike against a consented AADE receipt under `docs/spikes/`, never via an LLM/MCP per §5.8.1.
- **`502 upstream_error` from the phone.** The same 2026-05-12 session logged two `502 upstream_error` responses from a real device-originated `POST /receipts/parse`, meaning at least one in-wallet QR *did* pass the current `e-invoicing.gr` validator but failed at the upstream-fetch step. S-010 should fold "of receipts that pass the validator, what fraction fetch?" into the BLG-0026 spike alongside "what fraction of in-wallet receipts pass the validator at all?". Candidate causes: receipt expired upstream, e-invoicing.gr 404 for the UUID + token pair, rate-limiting, HTML drift, or a near-matching camera misread.

## Notes for whoever picks this up

- **ADR-0013 closed.** Its purpose (a precise, exhaustion-clear pre-flight checklist for the SDK 54 install) was served. The Step 3a fallback was the operative path; future SDK upgrades that hit the same TLS failure mode follow the same pattern. Do not re-open ADR-0013.
- **The encryption-stack round-trip test from S-007 is now the canonical regression canary across SDK upgrades.** Forward-only variant; SDK-version-agnostic; runs in `make check`.
- **PowerShell `make check` quirk persists** with the Greek folder name `Υπολογιστής` in the workspace path. Workaround: invoke `ruff check`, `mypy`, `pytest`, `tsc`, `jest` directly. Logged since S-003. Future Makefile fix is a low-priority drift item (no BLG opened — the workaround works).
- **`NODE_EXTRA_CA_CERTS` is per-developer-machine.** Set it once via `[Environment]::SetEnvironmentVariable('NODE_EXTRA_CA_CERTS', "$env:USERPROFILE\ca-bundle.pem", 'User')`. CI is unaffected — GitHub Actions runners ship a current Mozilla CA bundle. This is documented in `S-009-UREV-0001`.
- **The S-005 ADRs + DES are still the contracts.** ADR-0008, ADR-0009, ADR-0010, ADR-0011 stay locked. ADR-0012 is now byte-identical except §3 (deviations closed). DES-0004, DES-0005 unchanged.
