# Spike: GR receipt QR ground truth (2026-05-12)

**Status**: closed (recommendations actionable as BLG-0035 + BLG-0036 + ADR-0014 §3 amendment).
**Owner**: `parser-specialist` (with `mobile-builder`, `agent-safety-officer`, `security-privacy-officer`).
**Trigger**: Post-S-012-close, the project owner provided photos and QR-decoded strings of two real Greek consumer receipts they personally hold, plus explicit `AGENTS.md` §5.8.1 consent for fixture use. The QR decodes disagreed with ADR-0014 §3's documented patterns on two specific points — captured here as the input to S-013.

## §5.8.1 consent (verbatim from the project owner, 2026-05-12)

> "I consent to the two receipts in [this conversation] being used as parser fixtures per `AGENTS.md` §5.8.1. Redactions: card PAN partials, AUTH codes, and any buyer ΑΦΜ."

This consent statement applies to **both** receipts described below. It must be copied verbatim into each per-receipt `provenance.md` when the corresponding fixture triplet is committed under `backend/tests/fixtures/receipts/`.

Redactions to apply when the fixtures land:

- **Card PAN partials** (e.g. `4148**…3812` on the AIR CANTEEN slip) — masked further or removed entirely.
- **AUTH codes** (e.g. the `Auth Code: …` line on the AIR CANTEEN slip) — removed.
- **Buyer ΑΦΜ** — removed if present. Merchant ΑΦΜ stays (public business data).

Photos themselves are **not** committed to the repo — they live only in the agent's local assets folder per the editor's conventional image-attachment storage, never in `backend/tests/fixtures/`. Only the structured triplets ship.

## Receipt 1 — MONOGRAM ROASTERS Ε.Ε. (cafeteria) — Family A (AADE tameiakí)

### Photo metadata

- Merchant: `MONOGRAM ROASTERS Ε.Ε.` (cafeteria / coffee roastery).
- Merchant ΑΦΜ: visible on the slip, in the merchant header block. (Not transcribed verbatim here — capture from the slip when assembling the fixture triplet.)
- Date / time printed: `05/05/2026 11:54`.
- Two items, `ΣΥΝΟΛΟ: €19,00`.
- Printer / register identification: `ΑΡΙΘΜΟΣ ΜΗΤΡΟΥ: DMB 23002071`.
- Receipt sequence on the slip: `ΗΜΕΡ.ΑΡ. ΑΠΟΔ ΕΣΟΣΩΝ: 00204715` (approximate read).
- Σύστημα Σήμανσης markers present (`ΦΟΡΟΛΟΓΙΚΗ ΑΠΟΔΕΙΞΗ - ΕΝΑΡΞΗ` … `ΛΗΞΗ`).

### QR decoded string (the ground truth)

```
https://www1.aade.gr/tameiakes/myweb/q1.php?SIG=DMB230020710020471523FF055EC975FA1D260A2C9674D007260427092515.00
```

### Confirmation against ADR-0014 §3 Family A pattern

| Field | ADR-0014 §3 | Reality | Verdict |
|---|---|---|---|
| Scheme | `https://` | `https://` | ✓ |
| Host | `www1.aade.gr` | `www1.aade.gr` | ✓ |
| Path | `/tameiakes/myweb/q1.php` | `/tameiakes/myweb/q1.php` | ✓ |
| Query param name | `SIG` | `SIG` | ✓ |
| **SIG character set** | `[0-9A-Fa-f]+` (hex-only) | `[A-Z0-9]+(\.[0-9]+)?` (uppercase Latin alphanumeric + optional `.NN` suffix) | **✗ — drift** |

### SIG structure analysis (best-effort, no upstream fetch performed)

The SIG value `DMB230020710020471523FF055EC975FA1D260A2C9674D007260427092515.00` appears to concatenate:

- `DMB23002071` — printer/register model + tax-register number (matches the `ΑΡΙΘΜΟΣ ΜΗΤΡΟΥ: DMB 23002071` line on the slip).
- `0020471` — receipt sequence number (correlates with the `ΗΜΕΡ.ΑΡ. ΑΠΟΔ ΕΣΟΣΩΝ` line, modulo an extra trailing digit).
- `523FF055EC975FA1D260A2C9674D007` — the cryptographic signature segment (the only substring that **is** hex).
- `260427092515` — date+time encoding (printer-local format; not strictly Gregorian-decodable without the AADE spec).
- `.00` — terminator / amount-delta / checksum, unclear without the official spec.

The structure decomposition is **not load-bearing** for the on-device validator — the validator only needs the *overall character-set + length* shape to recognise this is a well-formed AADE SIG. The decomposition is recorded here so the future BLG-0027 backend adapter (which actually parses the AADE response HTML) can map any visible substrings to the §5.3.3 receipt fields without re-discovery.

### Drift finding 1 — AADE SIG charset

`mobile/src/parsers/gr.ts` ships (post-S-012) `GR_AADE_SIG_REGEX = /^[0-9A-Fa-f]+$/`. This regex rejects the real SIG at the `M` in `DMB…`. The corrected pattern must:

- Accept uppercase Latin alphanumerics (`A`–`Z`, `0`–`9`).
- Optionally accept one trailing `.NN` suffix (where `NN` is digits).
- Reject lowercase / punctuation / whitespace to keep the on-device defense-in-depth tight.
- Cap total length at a safe upper bound (the observed SIG is 66 chars; a 256-char ceiling leaves ample headroom).

**Proposed regex**: `/^[A-Z0-9]{1,256}(\.[0-9]+)?$/`

This is the focus of **BLG-0036**.

## Receipt 2 — AIR CANTEEN A.E. — Family B (Epsilon Net)

### Photo metadata

- Merchant: `AIR CANTEEN A.E.`.
- Merchant ΑΦΜ: visible on the slip, header block.
- Date / time printed: `8/1/2026 09:02`.
- Multiple items, `ΣΥΝΟΛΟ ΜΕ ΦΠΑ: €4,80`.
- VAT analysis present (mixed 13 % + 24 % rates).
- Payment method: card (`Π.ΚΑΡΤΑ`), card PAN partial visible (**must be redacted** per consent above).
- `Πάροχος: Epsilon Net A.E.` — confirms Family B at the provider level.
- `MARK: 400015485051109` (15 digits) — myDATA MARK; serves as the parser's `mark` field per ADR-0014 §3 / data-architect Round 2.
- `ΑΡ.ΠΑΡΑΣΤ.: 15` — document number.

### QR decoded string (the ground truth)

```
https://epsilondigital-3rdpartc.epsilonnet.gr/DocViewer/99564b3c-b21f-47d0-6d4a-08deaa87277d
```

### Confirmation against ADR-0014 §3 Family B pattern

| Field | ADR-0014 §3 | Reality | Verdict |
|---|---|---|---|
| Scheme | `https://` | `https://` | ✓ |
| Host | `epsilondigital-3rdpartc.epsilonnet.gr` | `epsilondigital-3rdpartc.epsilonnet.gr` | ✓ |
| **Path shape** | `/fd/<hash>:<n>` | `/DocViewer/<uuid>` | **✗ — drift** |
| **Identifier shape** | `<hash>:<index>` (e.g. `abc:1`) | UUID v4 (`99564b3c-b21f-47d0-6d4a-08deaa87277d`) | **✗ — drift** |

### Path-shape correction

- Printed text on the slip *also* shows a URL near the QR which appears to start `https://www.epsilondigital.gr/...`. That **printed text differs from the QR-encoded URL** — it is presumably a marketing-shortener / branded vanity URL, not the actual viewer endpoint. The QR-encoded URL is the authoritative one for parser routing.

- The `<uuid>` is a per-receipt opaque handle; like the e-invoicing.gr `_<token>` pattern from S-001, it is the only protection on an unauthenticated viewer endpoint. Treating it as `mark` for `(user_id, mark)` uniqueness would be reasonable. Open question for BLG-0028 acceptance: which identifier serves as `mark` — the QR UUID (per ADR-0014 §3 data-architect Round 2's "Epsilon's `<hash>:<n>` URL tail serves as `mark`" — now becomes "Epsilon's `<uuid>` URL tail serves as `mark`"), or the printed myDATA `MARK: 400015485051109` from the slip body? Both are unique per receipt; the myDATA MARK has the advantage that it's already the canonical primary key across the e-invoicing.gr family. The first BLG-0028 backend fetch will inform this decision.

### Drift finding 2 — Epsilon path

`mobile/src/parsers/gr.ts` ships (post-S-012):

```
GR_EPSILON_PATH_REGEX = /^\/fd\/(?<hash>[A-Za-z0-9]+):(?<index>[0-9]+)$/
```

This rejects the real URL at the first `/D` of `/DocViewer/…`. The corrected pattern must:

- Match `/DocViewer/<uuid>` where the UUID conforms to RFC 4122 v4 shape (8-4-4-4-12 hex).
- Replace the `{ hash, index }` discriminator fields on the `epsilon` variant of `GrQrValidationOk` with a single `{ uuid }` field.
- Keep the host check unchanged (the hostname in the QR ground truth matches ADR-0014 §3 verbatim).

**Proposed regex**: `/^\/DocViewer\/(?<uuid>[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/`

This is the focus of **BLG-0035**.

## ADR-0014 §3 amendment (proposed; lands as part of S-013)

The two corrections above sit **within `parser-specialist`'s ADR-0014 §3 authority** (ADR-0014 §6: "`parser-specialist` decides at BLG-0030 close … if SKU-level reachable, full-SKU adapter; if only merchant + total + date + signature, limited-info adapter"). The shape of the registry-of-adapters architecture is unchanged; only two regex constants are revised based on consented ground-truth data. No new architectural decision is taken.

If the S-013 agent reads this and judges the amendment crosses agent boundaries (a possibility under `AGENTS.md` §4.4's "any decision that crosses agent boundaries"), it should escalate to drift and route to a discovery interlude per §4.1.1. The §4.10 escape valve applies.

The amendment block to append at the bottom of `docs/adr/S-010-ADR-0014-Receipt-format-scope-expansion.md` (proposed text — final wording owned by `parser-specialist` in S-013):

> ### 2026-05-13 amendment — Family A SIG charset + Family B path shape (parser-specialist)
>
> Post-acceptance ground-truth from two consented receipts (see `docs/spikes/gr-qr-ground-truth-2026-05-12/findings.md`) corrects two regex constants in §3:
>
> - **Family A SIG** is `[A-Z0-9]+(\.[0-9]+)?` (uppercase Latin alphanumeric + optional `.NN` suffix), not `[0-9A-Fa-f]+` hex-only. The hex-only assumption was a S-001 best-guess against an unobserved example.
> - **Family B path** is `/DocViewer/<uuid>` (RFC 4122 v4 UUID), not `/fd/<hash>:<n>`. The `:n` index assumption was a S-001 best-guess derived from a misread printed URL on the slip; the QR-encoded URL is authoritative.
>
> The §3 architecture (registry-of-adapters, deterministic first-match dispatch per ADR-0001 §5) is unchanged. The `is_limited_info` flag, the AADE polite-fetch contract, and the §4 ToS / robots.txt review precondition all remain in force.

## What this spike does **not** unlock

- **No backend fetch was performed.** The `agent-safety-officer` + `security-privacy-officer` ToS / robots.txt review precondition from ADR-0014 §4 still gates the first AADE fetch. The Epsilon fetch still needs `agent-safety-officer` co-sign per the §4.11 outbound-host rule. BLG-0030 + BLG-0027 + BLG-0028 stay Ready with their existing gates.
- **No `raw.html` exists for either receipt.** The `provenance.md` + decoded-URL stubs that S-013 commits under `backend/tests/fixtures/receipts/gr-aade-001/` and `backend/tests/fixtures/receipts/gr-epsilon-001/` will ship **without** `raw.html` or `expected.json`. Those triplets become full fixtures only after a consented fetch lands the HTML.
- **No conclusion on the AIR CANTEEN slip's printed `www.epsilondigital.gr/...` vanity URL.** That is a marketing-shortener observation, not a parser requirement.

## Suggested S-013 scope (input to the next sprint's PLN)

- **BLG-0035** — Mobile Epsilon path regex correction (`/DocViewer/<uuid>` shape; `epsilon` variant carries `{ uuid }` instead of `{ hash, index }`).
- **BLG-0036** — Mobile AADE SIG charset regex correction (`[A-Z0-9]+(\.[0-9]+)?` shape).
- **ADR-0014 §3 amendment block** (one new section appended at the bottom of the ADR file; `parser-specialist` signs off in the sprint LOG).
- **Fixture stubs** under `backend/tests/fixtures/receipts/gr-aade-001/provenance.md` and `backend/tests/fixtures/receipts/gr-epsilon-001/provenance.md` — consent + decoded URLs + redactions list + ToS-review status (`pending — BLG-0030 fetch gated` for AADE; `pending — BLG-0028 fetch gated` for Epsilon). No `raw.html`, no `expected.json` until BLG-0030 / BLG-0028 land.
- **Real-URL test cases** in `mobile/__tests__/parsers/gr.test.ts` replacing the synthetic ADR-0014 §3-derived strings.
- **No backend changes** in S-013. Backend adapters carry to S-014.

`make check` target at S-013 close: green, +4 to +6 tests in the validator suite.
