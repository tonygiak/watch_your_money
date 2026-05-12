# Context: Outbound allowlist

The exhaustive list of external hosts and MCP servers the agentic system and the running app are permitted to contact. Adding to this list is a backlog item, not an in-sprint decision (`agent-runtime-security.md` §5).

Owner: `agent-safety-officer`. Co-sign required from `architect` for any addition.

## Production runtime hosts

| Host | Why | Used by |
|------|-----|---------|
| `https://e-invoicing.gr` | Greek e-invoice viewer + API (Family A — Entersoft / SoftOne / etc.) | backend parser (`parser-specialist`) |
| `https://www1.aade.gr` | Greek AADE tameiakí "Σύστημα Σήμανσης" per-receipt signature verification (Family A — `q1.php?SIG=<hex>`). Scope: production parser fetches **+** `docs/spikes/` with §5.8.1 consent. Added in S-010 per ADR-0014 §7. Production fetches gated on the BLG-0027 ToS / robots.txt review. | backend parser (`parser-specialist`) |
| `https://epsilondigital-3rdpartc.epsilonnet.gr` | Epsilon Net fiscal-document viewer (Family B — `fd/<hash>:<n>`). Scope: production parser fetches **+** `docs/spikes/` with §5.8.1 consent. Added in S-010 per ADR-0014 §7. | backend parser (`parser-specialist`) |
| `https://*.supabase.co` | Supabase managed Postgres + Auth. As of ADR-0015 the production runtime contacts **both** `/rest/...` (data) and `/auth/v1/.well-known/jwks.json` (JWKS for asymmetric JWT verification). Same hostname; no new entry. | backend service key, mobile anon key |
| `https://*.railway.app` *(or)* `https://*.onrender.com` | Backend hosting | `devops-engineer` |
| `https://exp.host` / `https://expo.dev` | Expo build / OTA | `devops-engineer` |

## Package registries (build-time only)

| Host | Why |
|------|-----|
| `https://pypi.org` | Python deps |
| `https://registry.npmjs.org` | Node deps |

## MCP servers

(none declared yet)

## Forbidden by default

- Any LLM / OpenAI / Anthropic / Gemini API call from production runtime.
- Any analytics / telemetry SaaS.
- Any third-party paid service beyond Supabase + Railway/Render + Expo (`AGENTS.md` §2.4).

## Process for adding a host

1. Open `BLG-*` of type `agentic` (or `engineering`) describing the need.
2. `agent-safety-officer` runs `review-external-surface.md`.
3. ADR is written, co-signed (`agent-safety-officer` + `architect`).
4. Allowlist updated here.
5. CI / runtime allowlist (where enforced) updated.
