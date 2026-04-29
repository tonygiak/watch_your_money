# Rule: Localization conventions (Greek-first)

Greek consumers must immediately feel "this app was built for me." English is a fallback only.

## Language

- **Greek (`el`)** is the default UI language.
- **English (`en`)** is the fallback. Every user-facing string must exist in both.
- Strings live in `mobile/src/lib/i18n.ts` (or a per-locale JSON loaded by it). No inline strings in screens.

## Currency

- EUR formatted as `X,XX €` — comma decimal separator, space before `€`, two decimals.
- Helpers: `formatEur(amount: number): string` lives in `mobile/src/lib/format.ts`.

## Dates

- Display as `DD-MM-YYYY` (Greek convention).
- Internal storage is ISO-8601 (`YYYY-MM-DD` or full timestamp).
- Helpers: `formatGreekDate(d: Date | string): string` in `mobile/src/lib/format.ts`.

## Numbers

- Decimal separator: comma. Thousands separator: dot or thin space (consistent throughout).
- Quantities respect the unit string from the receipt (`τεμ.`, `kg`, `lt`, …).

## UTF-8

- All HTTP responses set UTF-8 explicitly.
- `requests.Response.encoding = 'utf-8'` is mandatory before parsing `e-invoicing.gr` HTML (see `parser-internals.md`).
- Test fixtures include receipts with full Greek character sets (Σ, ώ, ή, ϊ, …) — they must round-trip exactly.

Owner: `localization-specialist`. Always-on. See `AGENTS.md` §2.4, §5.5.3.
