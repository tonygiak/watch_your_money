# Rule: Country-agnostic schema (no GR-only lock-in)

The data model carries `country_code` from day one. Every receipt-bearing row knows which country produced it, even though only `GR` ships in MVP.

## Required

- `receipts.country_code TEXT NOT NULL DEFAULT 'GR'` (and an index when query patterns demand it).
- Any new receipt-bearing or merchant-bearing table must include `country_code`.
- The receipt parser is a **pluggable module** behind a typed interface; the Greek `e-invoicing.gr` adapter is one implementation. Future EU adapters (RO, IT, PT, ES) must not require schema changes or call-site changes.

## Forbidden

- Hard-coded `'GR'` constants outside the country-resolution layer.
- Greek-specific column names (e.g. `afm` is allowed because we model it as the merchant tax id, but country-specific *table* shapes are not).
- Foreign-key shapes that assume one country.

## Tests

- Adapter tests run in a country loop; the country code is part of the fixture metadata.
- Adding a country adapter must be possible without altering the schema.

Owner: `data-architect` + `architect`. Always-on. See `AGENTS.md` §2.4, §4.8, §5.4.2, §5.9.
