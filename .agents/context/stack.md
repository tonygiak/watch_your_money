# Context: Stack

The exact tools, versions, and how to run each runtime.

## Backend

- **Python 3.11+** (3.12 is fine).
- **FastAPI** (web).
- **Uvicorn** (ASGI server).
- **Pydantic v2** (models).
- **requests** (HTTP).
- **beautifulsoup4** (HTML parsing).
- **supabase** (Python client).
- **python-dotenv** (env loading).
- **pytest** (tests).
- **ruff** (lint + format).
- **mypy** (typecheck).

Run:

```bash
make install         # creates .venv, pip-installs from backend/requirements.txt
make run-backend     # uvicorn backend.app.main:app --reload
make test            # pytest backend/tests
```

## Mobile

- **Node 20 LTS or 22**.
- **Expo SDK** (latest stable at time of bootstrap).
- **React Native** (managed by Expo).
- **TypeScript strict**.
- **expo-camera**, **expo-barcode-scanner** (scanner).
- **@supabase/supabase-js** (anon key on device).
- **react-navigation** (navigation).
- **react-native-chart-kit** (insights charts).
- **jest** + **@testing-library/react-native** (tests).
- **eslint** + **prettier** (lint + format).

Run:

```bash
make install         # npm ci in mobile/
make run-mobile      # expo start (then scan QR with Expo Go on a real device)
```

## Database

- **Supabase** (managed Postgres + Auth + Storage).
- Migrations in `db/migrations/`, RLS policies in `db/policies/`.
- Auth: phone number OTP (`AGENTS.md` §5.1).

## Hosting

- **Railway** or **Render** for backend.
- **Expo EAS** for mobile builds.
- Supabase managed.

## Versions

Pin exact versions in `backend/requirements.txt` and `mobile/package.json` once a real version is committed. Adding a dep requires an ADR + `agent-safety-officer` + `engineering-manager` co-sign (`agent-runtime-security.md` §4).
