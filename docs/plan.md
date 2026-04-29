# Plan

The current direction of the project and the focus of the next sprint.

## Where we are right now

Sprint **S-002 (implementation, `scan-and-store`)** has just closed green. It shipped:

- **BLG-0001** — full GR receipt parser at `backend/app/parsers/gr/parser.py` extracting every `AGENTS.md` §5.3.3 field, with the full `ParserError` taxonomy and a network-free `parse_html` path (per ADR-0001).
- **BLG-0002** — `POST /receipts/parse` at `backend/app/routes/receipts.py` with stdlib-only HS256 Bearer JWT verification (`backend/app/auth.py`), `(user_id, mark)` idempotency, RFC-7807 error envelope, and a privacy gate that scrubs parser detail from client responses (per ADR-0002).
- **BLG-0003 (testable parts)** — pure-TS scanner reducer (`mobile/src/screens/scanner/state.ts`), on-device GR QR validator (`mobile/src/parsers/gr.ts`, regex mirrored from backend), Greek-first i18n table (`mobile/src/i18n/strings.ts`), Greek-first locale detector (`mobile/src/lib/locale.ts`), and a scaffolded `ScannerScreen.tsx` ready to wire (per ADR-0003 + DES-0001).
- **BLG-0004 (partial)** — one synthetic fixture triplet at `backend/tests/fixtures/receipts/gr/gr-001-supermarket/` so BLG-0001 can prove green without exposing real PII. Acquiring the 4 remaining real-receipt triplets (with consent) stays open.
- **BLG-0008** — `.github/workflows/ci.yml` runs `make check` on every push and PR.
- **BLG-0012 (new, drift)** — install Expo + react-native runtime deps and wire `ScannerScreen.tsx` + `mobile/src/api/receipts.ts` into the gate. Needs an ADR co-signed by `agent-safety-officer` + `engineering-manager`. Created because pulling the Expo runtime tree mid-implementation would have introduced a new external surface without sign-off.

`make check` is green: 38 backend tests + 52 mobile tests = 90 total.

For the latest user-facing snapshot, read `AGENTS.md` §2.6 (shipped features) and §2.7 (sprint snapshot).

## Next sprint

- **Type**: `discovery`.
- **Theme proposal**: `auth-and-cache`.
- **Why discovery, not implementation**: the Ready queue is empty — every Ready item from S-001 was either delivered or kept open as a planned/drift backlog item that needs a fresh ADR before it's safe to build (`AGENTS.md` §4.1.2 — "no ready items → discovery").

### Goals for the discovery sprint S-003

The sprint takes these planned items through ADR debates and produces Ready backlog entries for S-004:

1. **BLG-0005** — phone OTP provider decision (Supabase native phone OTP vs Twilio vs deferred for MVP). ADR co-signed by `security-privacy-officer` + `architect`. Output: ADR + Ready login flow item.
2. **BLG-0006** — insights computation (Postgres views vs in-process FastAPI aggregation). ADR co-signed by `data-architect` + `architect`. Output: ADR + Ready Insights screen + endpoint items.
3. **BLG-0007** — offline cache strategy (sqlite vs AsyncStorage vs in-memory; at-rest encryption decision). ADR co-signed by `security-privacy-officer` + `architect`. Output: ADR + Ready cache item.
4. **BLG-0012** — Expo runtime tree decision: which packages, pinned versions, native build implications, EAS pipeline impact. ADR co-signed by `agent-safety-officer` + `engineering-manager`. Output: ADR + Ready scanner-runtime item that lifts the `tsconfig.json` / `make check` exclusions.
5. **BLG-0010** — small admin: reconcile `AGENTS.md` §5.3.2 body shape with ADR-0002 (drop `user_id` from the body in the prose).
6. **BLG-0009** + **BLG-0011** — the remaining S-001 follow-ups, picked up if time permits.

### Cadence after that

- **S-004 — implementation** — ships authenticated phone-OTP login, the Insights screen + endpoint, the offline cache, and the runnable scanner screen against the S-003 ADRs.
- After that, alternation continues per `AGENTS.md` §4.1.2.

## Open questions queued for S-003 discovery

- **Phone OTP provider** (BLG-0005): see §S-003 goal 1.
- **Insights computation** (BLG-0006): see §S-003 goal 2.
- **Offline cache strategy** (BLG-0007): see §S-003 goal 3.
- **Expo runtime install** (BLG-0012): see §S-003 goal 4.
- **Real-receipt fixture acquisition** (BLG-0004): not blocking S-003 ADRs, but sourcing 4 more consenting receipts is a parallel ask of `parser-specialist` + `security-privacy-officer`. The synthetic fixture is enough to keep `make check` green; the real ones validate the parser against upstream HTML drift.

## Notes for whoever picks this up

- The Greek QR regex is **shared between backend and mobile by design**. Backend lives at `backend/app/parsers/gr/url.py` (`GR_VIEWER_PATH_REGEX`, `GR_HOST`); mobile lives at `mobile/src/parsers/gr.ts`. Mobile tests already assert the two regexes match — keep them in sync.
- The privacy gate in `backend/app/routes/receipts.py` is load-bearing: parser exception detail is logged server-side under a `trace_id` but never echoed in the RFC-7807 `detail`. Codifying this as an `.agents/rules/` entry is captured in BLG-0011's spirit and should be considered in S-003.
- HS256 JWT verification is hand-rolled stdlib-only on purpose (no new runtime dependency). If S-003 picks Supabase native OTP, the verifier already works against `SUPABASE_JWT_SECRET`. If S-003 picks Twilio, the verifier needs an ADR before any change.
- `ScannerScreen.tsx` and `mobile/src/api/receipts.ts` are intentionally excluded from `tsconfig.json` until BLG-0012 lands. They are written against DES-0001 and ADR-0002 already and should compile + test green the moment the runtime tree is installed.
- The first synthetic fixture is **clearly labeled synthetic** in its `provenance.md`. Real fixtures must follow `AGENTS.md` §5.8.1 (consent recorded, redaction documented, never sent to any external LLM/MCP service).
