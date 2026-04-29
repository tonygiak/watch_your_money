# Context: Architecture

High-level shape of the system. The detailed contracts live in `AGENTS.md` §5; this page is the agent-oriented summary.

## Three runtimes

```
┌────────────┐      ┌──────────────────┐      ┌────────────────┐
│  Mobile    │ HTTPS│  Backend (Py +   │ HTTPS│  Supabase      │
│  (Expo /   ├─────►│  FastAPI)        ├─────►│  (Postgres +   │
│  RN)       │      │                  │      │  Auth, RLS)    │
└─────┬──────┘      └────────┬─────────┘      └────────────────┘
      │ Supabase anon key             │
      └──── direct (RLS-gated) ───────┘
                              │
                              │ HTTPS (UTF-8)
                              ▼
                     ┌────────────────────┐
                     │  e-invoicing.gr    │
                     │  (gov endpoint)    │
                     └────────────────────┘
```

- The **mobile app** uses the **Supabase anon key** for direct, RLS-gated reads/writes of receipts already owned by the user.
- The **backend** uses the **Supabase service key** only inside parser ingestion paths that have already authenticated the calling user.
- The **`e-invoicing.gr`** endpoint is the only external HTML source. No OCR, no third-party paid services beyond Supabase + Railway/Render.

## Parser as a pluggable module

```
backend/app/parsers/
├── base.py            # BaseReceiptParser (abstract), ParsedReceipt (typed)
├── registry.py        # picks the adapter by country_code / URL
└── gr/
    └── parser.py      # GrEinvoicingParser implements BaseReceiptParser
```

Future EU adapters drop in next to `gr/` (`ro/`, `it/`, `pt/`, `es/`) without disturbing the schema or call sites. See `country-agnostic-schema.md` and `add-parser-adapter.md`.

## Data ownership (who writes what)

| Path | Owner |
|------|-------|
| `backend/app/parsers/**` | `parser-specialist` |
| `backend/app/routes/**`, `services/**`, `models/**` | `backend-builder` |
| `backend/tests/**` | `qa` (with builders) |
| `mobile/src/**` | `mobile-builder` |
| `mobile/__tests__/**` | `qa` (with `mobile-builder`) |
| `db/migrations/**`, `db/policies/**` | `data-architect` |
| `docs/adr/**`, `docs/architecture/**` | `architect` |
| `docs/plan.md`, `docs/backlog.md`, `docs/done.md` | `product-manager` |
| `Makefile`, CI | `engineering-manager` + `devops-engineer` |
| `.agents/**` | `agents-doctor` |

## Non-functional requirements

- Receipt visible in app within **5 seconds** of scan on a normal mobile network (`AGENTS.md` §2.5).
- 100% parse accuracy on the 20-receipt fixture set (`AGENTS.md` §2.8 #10).
- UTF-8 correctness end-to-end.
- Accessibility (screen reader, dynamic text, contrast).
- RLS enforced on every user-scoped table.
