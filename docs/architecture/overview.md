# Architecture overview

This page is the human-facing summary. The agent-facing version lives at `.agents/context/architecture.md`. Both must stay consistent — `architect` owns drift.

## System

```
[Mobile (Expo / RN)] ──HTTPS──► [Backend (FastAPI, Py 3.11+)] ──HTTPS──► [Supabase: Postgres + Auth + RLS]
        │                                  │
        │ Supabase anon key                │ HTTPS (UTF-8)
        │ (RLS-gated reads/writes) ◄───────┘
        ▼
   [Supabase]                                                        [e-invoicing.gr]
```

## Layers

- **Mobile** — Expo + React Native. Greek-first UI. Anon Supabase access only. No service key on device.
- **Backend** — FastAPI service. Implements receipt ingestion, insights, freelancer export. Holds the pluggable parser interface and country adapters.
- **Database** — Supabase Postgres with RLS on every user-scoped table. Country-agnostic schema (`country_code`).
- **Parser layer** — `backend/app/parsers/` with `base.py`, `registry.py`, and one folder per country (`gr/`, future `ro/`, `it/`, `pt/`, `es/`).

## Constraints baked in

- No OCR (`AGENTS.md` §2.4, `.agents/rules/no-ocr.md`).
- RLS required (`AGENTS.md` §2.4, `.agents/rules/rls-required.md`).
- Country-agnostic schema (`AGENTS.md` §2.4, `.agents/rules/country-agnostic-schema.md`).
- Secrets only via env (`AGENTS.md` §2.4, `.agents/rules/secrets-only-via-env.md`).
- Strict outbound allowlist (`.agents/context/outbound-allowlist.md`).

## Quality gate

`make check` runs lint + typecheck + tests across backend and mobile. Sprint close requires green (`AGENTS.md` §4.7, `.agents/rules/quality-gate.md`).

## Future expansion

- New EU country adapters drop in next to `gr/`. The schema and call sites do not change.
- New endpoints follow `add-endpoint.md`. New screens follow `add-screen.md`. New migrations follow `add-migration.md`.
