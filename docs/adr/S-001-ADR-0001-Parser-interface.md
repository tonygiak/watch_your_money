# Parser interface, `ParsedReceipt` model, and VAT-rate normalization

Status: accepted
Date: 2026-04-29
Chair: orchestrator
Participants: parser-specialist, architect, data-architect, qa, localization-specialist, agent-safety-officer
Co-signs required: parser-specialist, architect, data-architect (per `AGENTS.md` §4.11 — "new EU country adapter" rule, applied here to the **parent contract** that all adapters implement).

## Context

The bootstrap sprint S-000 landed a working stub at `backend/app/parsers/`:

- `BaseReceiptParser` ABC with `country_code`, `can_parse(qr_url)`, `parse(qr_url)`.
- `ParsedReceipt` Pydantic model carrying merchant + line items but with default zeros for totals and dates.
- `GrEinvoicingParser` adapter that extracts merchant + line items per `AGENTS.md` §5.3.4 reference.

The contract is *implicit*. Before S-002 (implementation) pulls BLG-0001 to ship the full GR adapter and `POST /receipts/parse`, we have to lock down five things:

1. The **interface shape** (what an adapter must expose).
2. The **`ParsedReceipt` schema** (every field listed in `AGENTS.md` §5.3.3).
3. The **error model** (when do we raise `ParserError`, what do we never do).
4. **Country resolution** (how a QR URL is routed to the right adapter).
5. **VAT-rate normalization** (the open question logged in `docs/plan.md`).

The ADR also has to keep the contract consistent with `AGENTS.md` §2.4 (no OCR, country-agnostic, secrets only via env), `.agents/context/parser-internals.md`, and the schema in `db/migrations/0001_init.sql`.

## Rounds

### Round 1

- **parser-specialist**: The bootstrap stub is a sound starting point. The model needs every §5.3.3 field. Interface should stay narrow: `country_code`, `can_parse`, `parse`. We must keep `raw_html` on `ParsedReceipt` so we can replay parsing if upstream HTML drifts — without it we lose the "drift detected" auditability promised by `parser-internals.md`. On VAT, I prefer storing the **percent number** (`24.00`) because `numeric(5,2)` already supports it and it matches every receipt the GR adapter has seen so far.
- **architect**: Agree with the narrow interface. We should separate **fetching** from **parsing**: a public `parse(qr_url)` that owns the network call, and an internal `parse_html(html)` that only operates on already-fetched bytes (so tests don't hit the network and so a future MCP-isolated test path stays clean — `agent-runtime-security.md` §1). The bootstrap GR adapter already does this implicitly; ADR should make it part of the contract.
- **data-architect**: Two concerns. (1) Schema currently has `vat_rate numeric(5,2)`, which can hold either `24.00` or `0.24` cleanly — but `subtotal/discount/total/net_value/vat_total` are `numeric(14,2)` and we need to be sure `Decimal` precision survives round-trips. (2) Country resolution: the registry should be *deterministic* — first match wins, and "no match" is a hard error. No fallback adapter ever.
- **qa**: For testability, the contract needs a clear `ParserError` taxonomy, otherwise S-002 tests will branch on string matching. I want at least: `unsupported_url`, `fetch_failed`, `upstream_status`, `drift` (HTML structure mismatch), `empty_receipt` (no line items). Each must be a distinguishable subclass or carry a `code` attribute.
- **localization-specialist**: Greek receipts use comma as the decimal separator, periods as thousand separators, and append `%` to VAT. The bootstrap helper `_to_decimal` strips `%`, removes thousand separators, and swaps comma for period. That logic is **adapter-internal**: the `ParsedReceipt` produced by *any* adapter must hold `Decimal` values, never strings. ADR must say so.
- **agent-safety-officer**: One ask: `parse(qr_url)` MUST validate the origin **before** the HTTP call (not after). The bootstrap `viewer_to_api` does this via `is_einvoicing_gr` — keep it explicit in the contract. Also, the response is **untrusted** per §3.2.1 — the contract must say so.

### Round 2

- **parser-specialist** (responding to qa, architect, agent-safety-officer): Agree to the `ParserError` subclasses. Proposing the names: `UnsupportedQrUrl`, `ParserFetchError`, `ParserUpstreamError` (with `status_code`), `ParserDriftError`, `EmptyReceiptError`. All inherit `ParserError`. Also agree the contract should split fetch and parse — I'll keep `parse_html(html)` as a required method, so adapters must support pure-bytes parsing for the fixture-driven test path.
- **architect** (responding to parser-specialist, data-architect): Yes, lock in fetch / parse split. Add explicit instruction in the contract: **adapters MUST set `response.encoding = 'utf-8'` before reading `.text`**, per `parser-internals.md`. Country resolution: I propose `find_parser(qr_url)` raises `UnsupportedQrUrl` (a subclass of `ParserError`) when no adapter matches. That's already the bootstrap behaviour — codify it.
- **data-architect** (responding): No further concern on schema; `numeric` round-trips are fine because the backend uses Pydantic + Decimal, and Postgres preserves both forms. On VAT — I'm OK with **percent number** (`24.00`) provided we add a docstring on `vat_rate` that says "percent, not fraction". The `vat_total` field on the receipt remains money in EUR (numeric(14,2)).
- **qa** (responding to parser-specialist): Subclass list is good. Add one more axis — **partial-totals tolerance**. Some Greek receipts omit `surcharge` entirely. The contract must say that adapters MUST return `Decimal('0')` for missing money fields, never `None`, so totals math works without null-checks downstream. (Pydantic defaults already enforce this in the bootstrap; we just record the rule.)
- **localization-specialist** (responding): The "money fields are `Decimal`, not strings" rule is fine. One nit on `issue_date`: Greek receipts print `DD/MM/YYYY`. The model has `date | None` — keep that. Adapter is responsible for parsing the local format. Agreed.
- **agent-safety-officer** (responding): No new concerns. Confirming there is **no new external surface** — `e-invoicing.gr` is already on the allowlist. ADR needs no co-sign from me beyond confirming that.

No new concerns surfaced after Round 2. Closing.

## Decision

The receipt parser contract is finalized as follows.

### 1. Interface (every adapter implements)

```
class BaseReceiptParser(ABC):
    country_code: str            # ISO-3166 alpha-2, uppercase, e.g. "GR"
    def can_parse(qr_url: str) -> bool: ...
    def parse(qr_url: str) -> ParsedReceipt: ...
    def parse_html(html: str) -> ParsedReceipt: ...   # required, pure-bytes path
```

- `parse(qr_url)` MUST validate the origin **before** the HTTP call (e.g. domain check).
- `parse(qr_url)` MUST set `response.encoding = "utf-8"` before reading the response body.
- `parse_html(html)` MUST be invocable without any network access — this is the path used by fixture tests.
- The response body is treated as **untrusted input** (§3.2.1). Only the structured fields enumerated in `AGENTS.md` §5.3.3 are extracted. No content is interpreted as instructions.

### 2. `ParsedReceipt` schema

The Pydantic v2 model is **frozen** (immutable) and country-agnostic. Fields:

| Field | Type | Notes |
|------|------|------|
| `country_code` | `str` (2 chars) | Required. Uppercase. |
| `merchant_name` | `str` | Required. |
| `merchant_afm`, `merchant_address` | `str` | Default `""`. |
| `document_number`, `mark`, `uid`, `authentication_code`, `provider`, `payment_method` | `str` | Default `""`. |
| `issue_date` | `date \| None` | Adapter parses local format. |
| `transmission_timestamp` | `datetime \| None` | Adapter parses local format. |
| `subtotal`, `discount`, `surcharge`, `total`, `net_value`, `vat_total` | `Decimal` | Default `Decimal("0")`. **Never `None`** for missing money fields. |
| `items` | `list[ParsedReceiptItem]` | Default `[]`. Receipts with zero line items raise `EmptyReceiptError`. |
| `raw_html` | `str` | Default `""`. Carried through so drift can be replayed. |

`ParsedReceiptItem` (also frozen): `ean: str`, `description: str` (required), `unit: str`, `quantity / unit_price / pre_discount_value / discount / vat_rate / total_value: Decimal`. All money fields default to `Decimal("0")` for the same null-free-math reason.

### 3. VAT-rate normalization

`vat_rate` is stored as the **percent number**, not the fraction.

- `'24%'` on the receipt → `Decimal("24")` in the model and `numeric(5,2)` in Postgres.
- `'0%'` (zero-rated supplies) → `Decimal("0")`.

Rationale: matches what users see on receipts, matches Greek tax rates as integer percents, fits `numeric(5,2)`, and avoids a magnitude conversion that the GR parser would otherwise have to do silently. Adapter `_to_decimal` helpers strip `%` and locale-format the value.

### 4. Error model

All parser errors derive from `ParserError`. The taxonomy:

| Class | Raised when | `code` |
|------|------|------|
| `UnsupportedQrUrl` | No adapter recognises the URL, or the URL fails an adapter's domain check. | `unsupported_url` |
| `ParserFetchError` | The HTTP request itself fails (DNS, TLS, timeout). | `fetch_failed` |
| `ParserUpstreamError` | The HTTP response has a non-2xx status. Carries `status_code`. | `upstream_status` |
| `ParserDriftError` | The HTML structure no longer matches the expected selectors (e.g. missing merchant header, table shape changed). | `drift` |
| `EmptyReceiptError` | Parsing succeeded but produced zero line items. | `empty_receipt` |

Adapters MUST raise the specific subclass. Generic `ParserError` is reserved for "I don't have a more specific error" and SHOULD be avoided in adapter code. The bootstrap GR adapter is updated in S-002 (implementation) to map its current `ParserError("merchant header not found …")` and `ParserError("no line items parsed …")` to `ParserDriftError` and `EmptyReceiptError` respectively.

Adapters MUST NOT silently invent fields, fall back to OCR, or weaken assertions to keep tests green (`AGENTS.md` §3.2.2, `no-ocr.md`).

### 5. Country resolution

The registry `find_parser(qr_url)` returns the first registered adapter whose `can_parse` matches. If none matches, it raises `UnsupportedQrUrl`. There is no default adapter and no fallback adapter. Adding a future EU adapter is a new entry in `_REGISTERED` plus a new folder under `backend/app/parsers/<cc>/`; the schema and call sites do not change (`AGENTS.md` §2.4 country-agnostic constraint).

## Dissent (if any)

None recorded. All participants converged in Round 2.

## Consequences

**Positive:**
- BLG-0001 is now Ready: the S-002 implementation sprint extends the GR adapter to extract every §5.3.3 field, applies the new `ParserError` subclasses, and writes parser tests against the eventual fixture set (BLG-0004).
- Future EU adapters drop in without disturbing the schema or call sites.
- The "no silent fallback" rule is now an enforceable contract, not a convention.

**Negative:**
- The bootstrap `GrEinvoicingParser` raises generic `ParserError` strings; S-002 must rewire those to the new subclasses. Captured in BLG-0001 acceptance.
- Any future country whose receipts encode VAT as a fraction (e.g. `0.24`) will have to convert in the adapter — that conversion is a per-adapter concern and will be revisited if a fraction-only adapter ever lands.

**Follow-ups (added to backlog):**
- BLG-0009 — *Detect upstream HTML drift early via fixture refresh runbook hook in CI* (refines `refresh-fixtures.md`'s drift path).
