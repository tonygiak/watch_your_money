# Receipt fixtures

Real receipts go here as **triplets**, one folder per receipt:

```
backend/tests/fixtures/receipts/<cc>/<receipt-id>/
├── raw.html         # exact bytes returned by the API endpoint, UTF-8
├── expected.json    # ground-truth structured receipt
└── provenance.md    # source merchant, capture date, consent statement, redactions
```

Fixture handling rules live in `AGENTS.md` §5.8.1 and `.agents/skills/refresh-fixtures.md`.

> **No fixtures committed yet.** Acquisition is queued as `BLG-0004` for the next discovery sprint, with `security-privacy-officer` co-sign required before any commit.
