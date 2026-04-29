# Receipt fixtures

Real receipts go here as **triplets**, one folder per receipt:

```
backend/tests/fixtures/receipts/<cc>/<receipt-id>/
├── raw.html         # exact bytes returned by the API endpoint, UTF-8
├── expected.json    # ground-truth structured receipt
└── provenance.md    # source merchant, capture date, consent statement, redactions
```

Fixture handling rules live in `AGENTS.md` §5.8.1 and `.agents/skills/refresh-fixtures.md`.

## What's here

- **`gr/gr-001-supermarket/`** — *synthetic* fixture shipped in S-002 to unblock BLG-0001. Exercises every `AGENTS.md` §5.3.3 field (merchant + ΑΦΜ + address + ΔΟΥ + 10 metadata fields + 3 line items across 2 VAT rates + all totals + payment method). Clearly labeled synthetic in `provenance.md`. Co-signed by `security-privacy-officer`. **Not** a real receipt.

## Open work

- **BLG-0004** stays open for **4 real-receipt triplets with explicit consent** (e.g. `gr-002-pharmacy`, `gr-003-fuel`, `gr-004-restaurant`, `gr-005-bookstore`). Use `.agents/skills/refresh-fixtures.md`.
