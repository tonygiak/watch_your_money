# Rule: Secrets only via environment variables

No hard-coded credentials anywhere. Ever. This rule is verbatim from `AGENTS.md` §2.4 and reinforces `agent-runtime-security.md` §3.

## Required

- All secrets (Supabase service key, anon key, OTP provider keys, deploy tokens) live in environment variables.
- Each runtime ships a `.env.sample` listing the variable **names** with empty or placeholder values. Real values are never committed.
- `.gitignore` excludes `.env`, `.env.local`, `*.pem`, service-key JSON files.

## Forbidden

- Pasting tokens into prompts, ADRs, sprint logs, code comments, or PR descriptions.
- Reading a real `.env` file into agent context.
- Logging the value of a secret (redact before logging).

## On suspected leak

Follow `AGENTS.md` §4.10: stop, rotate credentials, scrub artifact history, open an `incident` backlog item. `agent-safety-officer` and `security-privacy-officer` co-own the response; `devops-engineer` rotates env vars.

Owner: `agent-safety-officer` + `security-privacy-officer`. Always-on.
