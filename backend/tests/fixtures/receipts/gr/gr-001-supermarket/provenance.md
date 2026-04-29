# Provenance — `gr-001-supermarket`

- **Type**: synthetic test fixture (NOT a real receipt).
- **Purpose**: lock the GR adapter against the agreed `AGENTS.md` §5.3.3 contract before real-receipt fixtures are acquired with explicit consent. Exercises every required field (merchant + ΑΦΜ + Address + ΔΟΥ + document number + issue date + MARK + UID + auth code + transmission timestamp + provider + 3 line items across 2 VAT rates + a discounted line + all totals + payment method).
- **Source merchant**: fictional — *ΠΑΡΑΔΕΙΓΜΑ ΣΟΥΠΕΡ ΜΑΡΚΕΤ ΑΕ* with ΑΦΜ `123456789` (clearly bogus). All EANs (`5201234567890`, `5209876543210`, `5203334445556`) are deliberately not real product codes.
- **PII**: none. No real merchant, no real ΑΦΜ, no card data, no phone number, no real customer.
- **Consent**: not applicable — synthetic data, no real merchant or user.
- **Capture date**: 2026-04-29 (sprint S-002 implementation).
- **Author**: parser-specialist (this sprint).
- **Co-sign**: `security-privacy-officer` reviewed the fixture and confirmed there are no PII concerns to address (synthetic content, no real-person data, never to be transmitted to any external service per `agent-runtime-security.md` §8 / `AGENTS.md` §5.8.1).
- **Redactions applied**: none — there is nothing to redact.

## Math (hand-validated)

Line items:

| EAN | Description | Qty | Unit | Pre-disc. | Disc. | VAT% | Total |
|-----|-------------|-----|------|-----------|-------|------|-------|
| 5201234567890 | Γάλα φρέσκο πλήρες 1L | 2 | 1,50 | 3,00 | 0,00 | 13 | 3,00 |
| 5209876543210 | Ψωμί ολικής άλεσης 500g | 1 | 2,40 | 2,40 | 0,40 | 13 | 2,00 |
| 5203334445556 | Καθαριστικό γενικής χρήσης 1L | 1 | 5,40 | 5,40 | 0,00 | 24 | 5,40 |

Totals (rounded to 0,01):

- Pre-discount sum: 3,00 + 2,40 + 5,40 = **10,80**
- Discount sum: 0,00 + 0,40 + 0,00 = **0,40**
- Surcharge: **0,00**
- ΤΕΛΙΚΗ ΑΞΙΑ: 3,00 + 2,00 + 5,40 = **10,40**
- Net (= Total ÷ (1+VAT)): 2,65 + 1,77 + 4,35 = **8,77**
- ΦΠΑ (= Total − Net): 0,35 + 0,23 + 1,05 = **1,63**
- 8,77 + 1,63 = 10,40 ✓

## Replacement plan

Real consenting receipts replace this when available. Tracking item: **BLG-0004** stays open for the 4 remaining real triplets (`gr-002-pharmacy`, `gr-003-fuel`, `gr-004-restaurant`, `gr-005-bookstore`, or any 5 covering ≥ 3 verticals).

## Forbidden (per `AGENTS.md` §5.8.1, `agent-runtime-security.md` §8)

This fixture must NEVER be:

- Sent to an LLM, MCP server, or external service for "help debugging".
- Auto-uploaded to any cloud storage.
- Replaced with real receipt data without re-capturing this consent block.
