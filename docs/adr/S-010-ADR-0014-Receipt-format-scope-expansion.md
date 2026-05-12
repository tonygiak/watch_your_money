# Receipt-format scope expansion — AADE tameiakí + Epsilon Net + non-URL hex codes (Greek QR families A / B / C)

Status: accepted
Date: 2026-05-12
Chair: orchestrator
Participants: product-owner, product-manager, architect, parser-specialist, data-architect, security-privacy-officer, agent-safety-officer, localization-specialist, product-designer
Co-signs required: `parser-specialist` + `architect` + `data-architect` (per `AGENTS.md` §4.11 — applies to the *parent contract* governing all GR adapters); `agent-safety-officer` + `architect` (per §4.11 — new outbound hosts); `security-privacy-officer` (per §4.11 — user-data flow change: the new `is_limited_info` field shapes how SKU-poor receipts surface to insights).

## Context

The first live on-device acceptance run on 2026-05-12, immediately after S-009 unblocked stock Expo Go scanning, surfaced a scope mismatch between `AGENTS.md` §2.8 bullet 3 and what Greek consumers actually carry in their wallets. Of the receipts the test user scanned that day:

- **0 receipts** matched the current scope: `https://e-invoicing.gr/edocuments/ViewInvoice/-1/<uuid>_<token>$` (Entersoft / SoftOne via `e-invoicing.gr`).
- **8 receipts** were AADE `https://www1.aade.gr/tameiakes/myweb/q1.php?SIG=<hex>` URLs — the official "Σύστημα Σήμανσης" per-receipt fiscal signature URL printed by every certified Greek cash register.
- **1 receipt** was `https://epsilondigital-3rdpartc.epsilonnet.gr/fd/<hash>:<n>` — Epsilon Net, a Greek tax-tech provider on the same tier as Entersoft / SoftOne but on their own viewer domain.
- **5 scans of 1 physical receipt** were `45C07BD642067E5` — a 15-hex-char code with no URL prefix, unidentified.

The scope inherited into §2.8 from S-001 / S-002 ("any Greek receipt with an `e-invoicing.gr` QR") was the right starting point because the parser interface (`ADR-0001` §1, §5) is **adapter-pluggable by design** — `find_parser(qr_url)` walks a registry and dispatches on `can_parse(qr_url)`. The premise of ADR-0001 was always that this registry would grow. The question this ADR settles is **how it grows for Greece** and **what that means for §2.2 / §2.8**.

The four constraints in scope:

- `AGENTS.md` §2.2 — SKU-level differentiator (the headline value proposition).
- `AGENTS.md` §2.4 — no OCR, no schema lock-in to a single country, no hard-coded secrets, RLS preserved.
- `AGENTS.md` §3.2.1 — outbound surface additions require an ADR + `agent-safety-officer` sign-off; fetched content is untrusted.
- `AGENTS.md` §5.8.1 — fixtures require consent + provenance; never transmitted to LLMs / MCPs.

Prior ADRs relevant:

- ADR-0001 — parser interface + `ParsedReceipt` schema + error taxonomy. The contract is unchanged; this ADR populates it with more adapters.
- ADR-0002 — `POST /receipts/parse` contract. Body shape unchanged; only the host-validation surface widens.
- ADR-0008 — Tag-as-business UX. Unchanged.

## Rounds

### Round 1

**product-owner:**

> The 2026-05-12 wallet sample is small (n=14, single user) but it is **directionally definitive**: the "Entersoft or SoftOne via e-invoicing.gr" scope was a sampling artifact of which merchants S-001 happened to look at, not a representative cross-section of Greek consumer receipts. Family A (AADE `q1.php?SIG=...`) is what gets printed by *every* certified Greek cash register — supermarkets, pharmacies, restaurants, fuel stations. If we ship MVP without supporting Family A, we fail bullet 3 (`A user can scan a Greek e-invoice QR code from any Entersoft or SoftOne merchant`) the moment the user scans their next groceries receipt.
>
> The hard product question is the §2.2 SKU-level differentiator. If AADE's `q1.php?SIG=...` truly returns only merchant + AFM + total + date + signature (no line items), shipping a "limited-info" adapter for Family A means the headline pitch **"granular SKU-level data"** becomes **"granular SKU-level data when your merchant uses Entersoft / SoftOne / Epsilon Net; merchant + total + date for the rest"**. That is still meaningfully better than every existing personal-finance product for Greek consumers (which has zero structured receipt data of any kind), and totals + categorization by merchant still drive every §5.5.2 Insights chart except *top products by frequency*. **My position: ship Family A as a limited-info adapter, surface a clearly-worded "Λιγότερες λεπτομέρειες" / "Less detail" banner on receipts that came from a limited-info source, and amend §2.2 to be precise about which receipts deliver SKU.**
>
> Family B (Epsilon Net) is the same tier as Entersoft / SoftOne and almost certainly supports SKU-level. It belongs in MVP as a separate adapter under `gr/`.
>
> Family C (15-hex-char code) — I have no opinion yet. We identify it first; product call comes after identification.

**parser-specialist:**

> The architectural answer is clean: the GR parser becomes a **registry of adapters**, one per QR family. ADR-0001 §5 already supports this — the registry walks all `can_parse(qr_url)` checks in order. We add three new entries: `GrAadeTameiakiParser`, `GrEpsilonNetParser`, and (pending Family C identification) a third. `find_parser` continues to return the first match; `UnsupportedQrUrl` continues to be raised when none matches. No call-site change at `POST /receipts/parse`.
>
> For `ParsedReceipt`, the schema in ADR-0001 §2 already tolerates SKU-poor receipts cleanly: `items: list[ParsedReceiptItem]` defaults to `[]`, and money fields default to `Decimal("0")`. **However**, `EmptyReceiptError` (ADR-0001 §4) is currently raised when a receipt parses but produces zero line items. For a Family A adapter that legitimately cannot produce items, raising `EmptyReceiptError` would mean every AADE scan returns 422. We need a way to distinguish "the parser failed to find items that exist" (drift / error) from "the receipt format does not carry items at all" (legitimate). My proposal: add a boolean `is_limited_info` to `ParsedReceipt` (defaults to `False`); when `is_limited_info=True`, an empty `items` list is **not** an error.
>
> Position: registry-of-adapters; new `is_limited_info` flag on `ParsedReceipt` and on the `receipts` schema; per-family adapters added in S-011+ once fixtures are consented and acquired (BLG-0030 is the gating spike for Family A's HTML ceiling).

**architect:**

> Endorsing `parser-specialist`'s shape. The registry-of-adapters approach was the explicit premise of ADR-0001 — that ADR's "Greek e-invoicing.gr parser is one implementation" sentence in §5.9 should be plural in fact, but the *shape* doesn't change. Three concrete architectural notes:
>
> 1. **No nested registry.** Don't introduce a "GR sub-registry" — keep one flat `_REGISTERED` list in `backend/app/parsers/registry.py` with all adapters (GR variants today; RO / IT / PT / ES tomorrow). Routing by `can_parse(qr_url)` stays linear-search; with ~5 entries the cost is negligible, and the deterministic-first-match contract (ADR-0001 §5) is preserved.
> 2. **Folder layout.** `backend/app/parsers/gr/` becomes a package with `einvoicing/`, `aade/`, `epsilon/` subpackages. Each subpackage owns its own `parser.py` + `url.py`. The shared GR utilities (locale parsing, VAT-rate normalization) move to `backend/app/parsers/gr/_common.py` or stay inline per adapter — `parser-specialist`'s call.
> 3. **`is_limited_info` is the right flag.** It is **not** the same as "drift" (HTML changed unexpectedly) and **not** the same as "empty" (parser failure). It is a *contractual property* of a specific receipt format. The flag travels through `POST /receipts/parse` response (extend `ReceiptResponse` in `backend/app/routes/receipts.py`), through `receipts.is_limited_info` in the schema, and surfaces in the mobile UI as a banner. The mobile contract change is one new boolean field — no breaking change.
>
> Position: accept the registry expansion + `is_limited_info` flag. Co-sign on the technical decision.

**data-architect:**

> Schema delta is **one column**: `receipts.is_limited_info boolean not null default false`. Migration is additive, backwards-compatible (existing receipts default to `false` which matches their actual semantics — they all came from the full-SKU `e-invoicing.gr` adapter), and does not touch any RLS policy. The defense-in-depth `WHERE user_id = sub` guard in `backend/app/storage/receipts.py` is unaffected. The `(user_id, mark)` upsert key is unchanged — every adapter must produce a `mark` (or its family's equivalent: AADE's `SIG` hex string is unique per receipt and can map to `mark`; Epsilon's `<hash>:<n>` can map similarly; Family C TBD).
>
> One concern: if AADE's `SIG=<hex>` is what we store as `mark`, the dedup uniqueness has to hold across families. Two receipts from the same merchant on the same day — one printed via e-invoicing.gr (has a real MARK), one printed via the cash register (has an AADE SIG) — would be **two different `mark` values** and store as two separate receipts. That is *correct* (they are two different receipts even if they reflect overlapping data) but it means the deduplication contract is per-QR-source, not per-purchase. Worth recording in the ADR.
>
> Position: co-sign on the schema delta. RLS untouched. Country code stays `'GR'` for all three families — the diversity is below the schema line per `AGENTS.md` §5.9.

**security-privacy-officer:**

> Two concerns to address explicitly in the decision:
>
> 1. **AADE `www1.aade.gr` is a government domain.** Production scrapes against `www1.aade.gr` are fundamentally different from scraping a commercial provider's viewer. AADE may have rate limits, a terms-of-service prohibiting automated fetches, or other restrictions. Before any production fetch lands in S-011, the BLG-0027 acceptance must include: (a) a review of `www1.aade.gr/tameiakes/myweb/` terms / robots.txt; (b) a polite-fetch contract (max QPS, user-agent header identifying the app, no parallelism per session). If AADE forbids automated fetches, BLG-0027 collapses to "limited-info from the QR string itself only (the SIG hex), no upstream fetch" — which still gives us merchant identification eventually, just from a static lookup table the user maintains.
> 2. **The `is_limited_info` flag is user-visible**. The UX must make crystal clear that "limited info" is a property of the receipt's format, **not** a missed parse on our side. Otherwise the user perceives a buggy app. `product-designer` + `localization-specialist` own the banner copy.
>
> Position: conditional co-sign — conditional on (a) BLG-0027 acceptance requiring an AADE ToS / robots.txt review, (b) the UX banner being non-alarming and explicitly attributing the limited info to the receipt format.

**agent-safety-officer:**

> Outbound-surface review for ADR-0014:
>
> - **`www1.aade.gr`** — new outbound host. Production runtime + spike fetches. Owned by AADE (Greek tax authority). HTTPS-only. The host serves `q1.php` as a verification-of-fiscal-signature page; whether it carries the SKU-level data we want is BLG-0030. Allowlist entry: **scoped to parser fetches + spike fetches with §5.8.1 consent**. No login surface, no API-key surface, no credentials in flight — public unauthenticated verification URL. **Co-sign granted conditional on**: (i) `security-privacy-officer`'s ToS check landing in BLG-0027 acceptance; (ii) every BLG-0030 spike fetch is preceded by §5.8.1 consent recording in `provenance.md`.
> - **`epsilondigital-3rdpartc.epsilonnet.gr`** — new outbound host. Owned by Epsilon Net (commercial). HTTPS-only. The same-tier-as-Entersoft pattern means we expect a viewer URL that exposes SKU-level data the same way `e-invoicing.gr` does. Allowlist entry: **same scope as AADE** — parser fetches + spike fetches with §5.8.1 consent. No login surface — the hash + index in the URL is the only authentication. **Co-sign granted** with the same §5.8.1 consent precondition.
> - **No new MCP servers.** No new dependencies (the existing `requests` + `beautifulsoup4` cover all three adapters at the language level).
> - **Prompt-injection threat is identical to ADR-0001's:** every adapter only extracts the structured fields named in `AGENTS.md` §5.3.3 + `is_limited_info`; no fetched text is interpreted as instructions.
>
> Position: co-sign on the outbound-surface addition with the §5.8.1 consent + ToS-review preconditions. Both hosts get added to `.agents/context/outbound-allowlist.md` with the documented scope at S-010 close. The allowlist update applies *only* once the ADR is accepted — i.e. only once Round 2 closes — so this sprint does **not** make any outbound fetch to either host. The spike work is BLG-0030's responsibility under §5.8.1.

**localization-specialist:**

> One new copy key per locale for the limited-info banner. Greek-first per `AGENTS.md` §2.5: `receipt.limited_info.banner = "Λιγότερες λεπτομέρειες — αυτή η απόδειξη δείχνει μόνο τα σύνολα, όχι κάθε προϊόν."` (`"Less detail — this receipt shows only totals, not each product."` in English fallback). Plus a one-line tooltip / accessibility-label explaining *why*: `receipt.limited_info.tooltip = "Αυτή η απόδειξη εκδόθηκε από το σύστημα σήμανσης ΑΑΔΕ που δεν περιλαμβάνει επιμέρους προϊόντα."` (`"This receipt was issued via the AADE signature system which does not include individual line items."`). No font / glyph concerns — Greek + ASCII only. EUR + date formats per ADR-0001 §3 stay unchanged.
>
> Position: co-sign on the localization impact. Strings ship in the same PR as the BLG-0027 mobile UI per the standard pattern.

**product-designer:**

> The "limited-info" UX needs to be **information**, not **apology**. The user should feel "ah, this format doesn't carry that detail" — not "the app is broken / less useful than promised." Concretely:
>
> - On the receipt list (`HomeScreen`), a limited-info receipt renders identically to a full-SKU receipt — same row layout, same merchant + date + total. **No badge**, **no warning icon**, no different color. The difference is invisible at the list level.
> - On the receipt detail screen, the line-items section is **replaced** (not "empty-stated") with a small informational card carrying `receipt.limited_info.banner` + `receipt.limited_info.tooltip`. The rest of the detail (merchant, AFM, address, totals, payment method) renders normally.
> - On the Insights screen (§5.5.2), limited-info receipts contribute to merchant + category + total metrics exactly like full-SKU receipts. They do **not** contribute to "top products by frequency / spend" (Family A has no products). This is *correct behavior*, not a bug; no UI change needed.
> - The freelancer tag-as-business flow (ADR-0008) is unaffected — tagging works on every receipt regardless of `is_limited_info`.
>
> Position: co-sign on the UX shape. The full DES note for the banner lands with BLG-0027 in S-011; not pre-committed in this ADR.

**product-manager:**

> Sequencing the per-family Ready BLGs:
>
> - **BLG-0030 (AADE HTML-shape spike)** is the *gating* item. We don't know whether AADE returns SKU-level or merchant-only until we fetch one consented response. **BLG-0030 sized XS-to-S; first thing pulled in S-011.**
> - **BLG-0027 (AADE adapter)** sized M; pulled after BLG-0030 lands. Acceptance criteria depend on whether the spike confirms SKU-level (in which case the adapter is full-SKU like Entersoft / SoftOne) or limited-info (in which case `is_limited_info=true` is set + the banner UX ships).
> - **BLG-0028 (Epsilon Net adapter)** sized M; pulled in parallel with BLG-0027 in S-011 — Epsilon's structure is independent of AADE's outcome. Same fixture-acquisition gating as BLG-0030.
> - **BLG-0029 (Family C identification)** sized XS — first step is requesting a photo of the printed receipt + system name from the project owner. Pulled in S-011 if the response arrives in time; otherwise carries forward.
>
> Schema change (`is_limited_info` column) lands in S-011 as part of BLG-0027 or as a standalone schema-only BLG-0031 if we want to decouple it. Recommend folding into BLG-0027 to keep one PR per shipped feature.

### Round 2

**parser-specialist** (responding to data-architect on dedup):

> The dedup-per-QR-source observation is correct and acceptable. Two QR families pointing to the *same physical purchase* will produce two `receipts` rows because their `mark` values differ. That is the *honest* behavior: the app cannot tell that two QRs reflect overlapping purchase data without solving the merchant + total + line-item equality problem, which is out of MVP scope. If a user scans both QRs from the same receipt, they get two list rows — the right product follow-up is "detect probable duplicates by `(merchant_afm, issue_date, total)` triplet and offer a merge action," which becomes a post-MVP BLG. **Recording this as a follow-up, not a blocker.**
>
> Mapping AADE's `SIG=<hex>` to `mark`: agreed. The SIG is per-receipt unique by construction (it's the fiscal signature). For Epsilon, the `<hash>:<n>` URL path tail becomes `mark`. For Family C, TBD pending identification.

**security-privacy-officer** (responding to product-designer + agent-safety-officer):

> Conditional sign-off lifted to full sign-off with the BLG-0027 acceptance preconditions written into the per-family BLG:
>
> 1. BLG-0027 must include "review AADE `www1.aade.gr/tameiakes/myweb/` terms of service + robots.txt before any production fetch lands" as an acceptance bullet. If AADE forbids automated fetches, BLG-0027 narrows to "limited-info from the QR string itself" (parse the SIG hex, store as `mark`, don't fetch upstream).
> 2. BLG-0030 (the spike) must record the ToS + robots.txt review in its `provenance.md` alongside the consent statement.
> 3. The UX banner copy from `localization-specialist` is correct in tone (informational, attributes to the format, not the app).
>
> Co-sign granted on the user-data flow change (the `is_limited_info` column + the banner are the entire data-flow delta).

**architect** (responding to parser-specialist's mention of `_common.py`):

> Folder layout decided here: `backend/app/parsers/gr/` contains `einvoicing/`, `aade/`, `epsilon/` as sibling packages. Each owns its `parser.py`, `url.py` (for the URL → API conversion or `can_parse` shape check), and `__init__.py` exporting the parser class. Shared GR utilities (`_to_decimal`, VAT-rate normalization, Athens-TZ date parsing) consolidate in `backend/app/parsers/gr/_common.py`. This minimizes per-adapter boilerplate without nesting a sub-registry.
>
> `backend/app/parsers/registry.py` `_REGISTERED` list grows from `[GrEinvoicingParser()]` to `[GrEinvoicingParser(), GrAadeTameiakiParser(), GrEpsilonNetParser()]` (and a Family C adapter pending identification). Linear-search dispatch unchanged.
>
> Mobile mirror (per ADR-0003 §3): `mobile/src/parsers/gr.ts` extends `validateGrQrUrl` to a discriminated-union `validateGrQrCode(input: string)` that returns `{ family: "einvoicing" | "aade" | "epsilon" | "unknown_code", ...family-specific fields }` on success. The Scanner screen consumes the discriminator to know whether to send the value as-is (Family A / B URL) or as a freeform code (Family C, when it arrives). **One additional Ready BLG** captures this mobile mirror — BLG-0032 (mobile QR-validator mirror update), sized S, pulled with BLG-0027 + BLG-0028 in S-011.

**parser-specialist** (responding):

> Folder layout + mobile mirror decision both fine. BLG-0032 added to the bundle.

**product-owner** (responding to product-designer + product-manager):

> §2.2 + §2.8 amendment is the **single piece of user-facing communication** that has to be precise. Recommend:
>
> - §2.2 second bullet ("**SKU-level** receipt data (not just merchant and total)") amended to: "**SKU-level** receipt data for receipts whose QR carries it (Entersoft, SoftOne, Epsilon Net); merchant + total + date for receipts whose QR carries only fiscal signature (AADE-tameiakí — the most common Greek consumer-receipt format)."
> - §2.8 bullet 3 ("A user can scan a Greek e-invoice QR code from any Entersoft or SoftOne merchant") amended to: "A user can scan a Greek receipt QR code from any of the supported families: e-invoicing.gr (Entersoft / SoftOne), Epsilon Net, AADE tameiakí signature URLs."
> - §2.8 bullet 4 ("**The full receipt with all line items** appears in their app within 5 seconds") amended to: "**The receipt (with all line items when the format carries them; with merchant + total + date when the format is limited-info)** appears in their app within 5 seconds."
> - §2.9 out-of-scope list grows: "Detection of probable duplicates across QR sources (same physical purchase scanned from two different QRs) — post-MVP."
>
> §2.6 will get a new BLG-0027 / 0028 / 0029 line once they ship. §2.7 updated at S-010 close.
>
> Position: full co-sign with the §2.2 / §2.8 / §2.9 wording above.

**product-manager** (responding):

> Wording from `product-owner` is acceptable and lands at S-010 close. Note that `AGENTS.md` §2.2 / §2.8 / §2.9 edits cross the line-cap guidance — they are content edits to §2 sections, not structural changes, so `product-owner` owns them per the §4.11 sign-off matrix ("Edits to `AGENTS.md`: section owner for content"). `orchestrator` records them in the sprint LOG.

**agent-safety-officer** (responding):

> Re-confirming the outbound-allowlist update is **deferred to S-010 close** (not in-sprint). The allowlist entries for `www1.aade.gr` + `epsilondigital-3rdpartc.epsilonnet.gr` will list:
>
> - **Scope**: parser fetches (production runtime, S-011+ once Ready BLGs land) + spike fetches (under `docs/spikes/`, §5.8.1 consent precondition).
> - **Owner**: `parser-specialist` (consumer); `agent-safety-officer` (steward).
> - **Conditions**: no credentials in flight; HTTPS-only; user-agent header identifying the app; max QPS to be set in BLG-0027 / BLG-0028 polite-fetch contract.
>
> No outbound fetch in S-010 itself. Co-sign final.

### Round 3

Rounds called closed by the chair. No new concerns surfaced in Round 2. All participants confirm:

- Registry-of-adapters architecture per `parser-specialist` + `architect` accepted.
- `is_limited_info` flag added to `ParsedReceipt` + `receipts` schema (default `false`).
- `www1.aade.gr` + `epsilondigital-3rdpartc.epsilonnet.gr` added to outbound allowlist with documented scope.
- §2.2 / §2.8 / §2.9 amendments per `product-owner` wording.
- Per-family Ready BLGs created: BLG-0027 (AADE adapter), BLG-0028 (Epsilon Net adapter), BLG-0029 (Family C identification), BLG-0030 (AADE HTML-shape spike), BLG-0032 (mobile QR-validator mirror).
- No production code in S-010.

All participants signal no further concerns. Chair declares rounds closed.

## Decision

### 1. Architecture — registry-of-adapters within GR

`backend/app/parsers/gr/` becomes a package containing per-family sub-packages: `einvoicing/`, `aade/`, `epsilon/`, and one TBD for Family C (pending identification). Each sub-package owns its `parser.py` + `url.py` (or its family equivalent) + `__init__.py`. Shared GR utilities (`_to_decimal`, VAT-rate normalization, Athens-TZ parsing) consolidate in `backend/app/parsers/gr/_common.py`.

`backend/app/parsers/registry.py` `_REGISTERED` list grows linearly. Routing remains the deterministic first-match-wins walk from ADR-0001 §5. No nested registry.

Mobile mirror per ADR-0003 §3: `mobile/src/parsers/gr.ts` exposes a discriminated-union `validateGrQrCode(input: string) => { ok: true; family: "einvoicing" | "aade" | "epsilon" | "unknown_code"; ... } | { ok: false; reason: ... }`. The scanner consumes the discriminator. The existing `validateGrQrUrl` stays as a delegate for backwards compatibility within the file.

### 2. `is_limited_info` flag

`ParsedReceipt` (per ADR-0001 §2) gains:

```
is_limited_info: bool = False
```

`receipts` schema gains:

```sql
is_limited_info boolean not null default false
```

Migration is additive and applies in S-011 alongside BLG-0027. No RLS change. No index needed (the column is queried only by per-row read paths). `_to_response` in `backend/app/routes/receipts.py` extends `ReceiptResponse` with the new field; the mobile `Receipt` type mirrors it.

When `is_limited_info=True`, an empty `items: []` is **not** an error: `EmptyReceiptError` (ADR-0001 §4) is **not** raised by limited-info adapters even when items is empty. Full-SKU adapters (existing `GrEinvoicingParser`, future `GrEpsilonNetParser`) continue to raise `EmptyReceiptError` on empty items — their semantic contract is unchanged.

### 3. Family-by-family decisions

| Family | In MVP §2.8? | Integration path | New outbound host | `is_limited_info` ceiling | Ready BLGs |
| --- | --- | --- | --- | --- | --- |
| **A — AADE `q1.php?SIG=<hex>`** | **Yes — as limited-info** | `parser-specialist` decides at BLG-0030 close: if SKU-level reachable, full-SKU adapter; if only merchant + total + date + signature, limited-info adapter | `www1.aade.gr` | `True` if confirmed merchant-only at BLG-0030; otherwise `False` | BLG-0030 (spike, gating), BLG-0027 (adapter) |
| **B — Epsilon Net `epsilondigital-3rdpartc.epsilonnet.gr/fd/<hash>:<n>`** | **Yes — as full-SKU** (expected) | Adapter parses the viewer page same way Entersoft / SoftOne is parsed | `epsilondigital-3rdpartc.epsilonnet.gr` | `False` (expected) | BLG-0028 (adapter — includes its own micro-spike inline since the file count is small) |
| **C — 15-hex non-URL code** | **Pending identification** | TBD at BLG-0029 close | TBD | TBD | BLG-0029 (identification spike) |

### 4. AADE-specific preconditions

Per `security-privacy-officer` + `agent-safety-officer` Round 1 + 2:

- **ToS / robots.txt review**: BLG-0027 acceptance must include a documented review of `www1.aade.gr/tameiakes/myweb/` terms of service + robots.txt before any production fetch ships. If automated fetches are forbidden, BLG-0027 narrows to "parse the QR string in-app (extract SIG hex, store as `mark`); no upstream fetch; `is_limited_info=True` always; merchant remains 'Άγνωστος έμπορος' until a future feature lets the user attach a merchant name." This degraded path is explicitly an acceptable MVP outcome.
- **Polite-fetch contract**: if production fetches are allowed, BLG-0027 must define max QPS (suggest 1 req/s per user; never parallel), include a `User-Agent` header identifying the app + version + a contact URL, and set request timeout ≤ 10s (matching the existing `e-invoicing.gr` adapter timeout).
- **No credentials in flight**: `www1.aade.gr/tameiakes/myweb/q1.php?SIG=<hex>` is a public unauthenticated verification URL. The adapter must never attach any Authorization header, cookie, or session token to AADE requests.

### 5. UX — limited-info banner

`product-designer` + `localization-specialist` agreed wording:

- **List screen (`HomeScreen`)**: limited-info receipts render identically to full-SKU receipts.
- **Receipt detail screen**: when `is_limited_info=true`, the line-items section is **replaced** by an informational card:
  - Greek: `"Λιγότερες λεπτομέρειες — αυτή η απόδειξη δείχνει μόνο τα σύνολα, όχι κάθε προϊόν."`
  - English: `"Less detail — this receipt shows only totals, not each product."`
  - Tooltip / accessibility label explains the source (AADE signature system).
- **Insights**: limited-info receipts contribute to merchant + category + total metrics; they do **not** appear in top-products (correct — they have none).
- **Tag-as-business**: works identically on limited-info receipts.

Full DES under BLG-0027.

### 6. §2.2 / §2.8 / §2.9 amendments (recorded for `product-owner` to land in `AGENTS.md` at S-010 close)

- §2.2 second bullet: "**SKU-level** receipt data **for receipts whose QR carries it** (Entersoft / SoftOne / Epsilon Net); **merchant + total + date** for receipts whose QR carries only a fiscal signature (AADE tameiakí — the most common Greek consumer-receipt format)."
- §2.8 bullet 3: "A user can scan a Greek receipt QR code from any of the supported families: **e-invoicing.gr (Entersoft / SoftOne)**, **Epsilon Net**, **AADE tameiakí signature URLs**."
- §2.8 bullet 4: "**The receipt (with all line items when the format carries them; with merchant + total + date when the format is limited-info)** appears in their app within 5 seconds."
- §2.9: add "Detection of probable duplicates across QR sources (same physical purchase scanned from two different QRs) — post-MVP."

The wording above is binding; `product-owner` lands it verbatim in this sprint's `AGENTS.md` §2.7 update *and* in §2.2 / §2.8 / §2.9 themselves at S-010 close (these are content edits to §2 sections, owned by `product-owner` per §4.11).

### 7. Outbound allowlist update

`.agents/context/outbound-allowlist.md` gains two entries, recorded at S-010 close:

| Host | Why | Scope | Used by |
| --- | --- | --- | --- |
| `https://www1.aade.gr` | AADE tameiakí signature verification (Family A) | Production parser fetches + `docs/spikes/` with §5.8.1 consent | `parser-specialist` (GR-AADE adapter) |
| `https://epsilondigital-3rdpartc.epsilonnet.gr` | Epsilon Net fiscal-doc viewer (Family B) | Production parser fetches + `docs/spikes/` with §5.8.1 consent | `parser-specialist` (GR-Epsilon adapter) |

No new MCP servers. No new package registries.

### 8. Per-family Ready BLGs (created at S-010 close)

- **BLG-0027** — AADE tameiakí adapter — `Status: Ready (gated on BLG-0030 outcome)`, Size: M.
- **BLG-0028** — Epsilon Net adapter — `Status: Ready (gated on fixture acquisition)`, Size: M.
- **BLG-0029** — Family C identification spike — `Status: planned (gated on project-owner photo + system name)`, Size: XS.
- **BLG-0030** — AADE HTML-shape spike — `Status: Ready (gated on consented AADE receipt)`, Size: XS-S.
- **BLG-0032** — Mobile `validateGrQrCode` discriminated-union mirror — `Status: Ready (couples to BLG-0027 + 0028)`, Size: S.

## Dissent

None recorded. All nine participants converged in Round 2 with no dissent in Round 3.

## Consequences

**Positive:**

- The §2.8 MVP scope now matches the **real Greek receipt diversity** users carry, not the artifactual scope inherited from S-001's small sample.
- Family A (AADE) is the dominant Greek consumer-receipt format. Bringing it in expands product coverage from ~10% of receipts (Entersoft / SoftOne via `e-invoicing.gr`) to ~90%+ (every certified Greek cash register).
- The registry-of-adapters architecture is exactly what ADR-0001 §5 was designed for. Zero rework — just new adapter entries.
- The `is_limited_info` flag is a clean, contractual property of the receipt format. It does not pollute the parser error taxonomy and does not collide with `EmptyReceiptError`.
- §2.2's "SKU-level" pitch becomes **honest and precise**: SKU-level for ~10% of receipts today; merchant + total + date for the rest. This is *still* the best personal-finance product for Greek consumers (none has structured receipt data of any kind).

**Negative:**

- The §2.2 differentiator wording is now hedged. Users may find this disappointing relative to the previous unqualified claim. Mitigation: the UX banner (§5) attributes the limited info to the receipt format, not the app.
- Dedup is per-QR-source, not per-purchase. Scanning two different QRs from the same physical receipt produces two list rows. Acceptable for MVP; a "detect probable duplicates" feature is a post-MVP follow-up (added to §2.9).
- Three new adapter PRs to land in S-011 (BLG-0027, BLG-0028, possibly BLG-0029) — a meaningful single-sprint workload. BLG-0030 (spike) is XS and lands first.

**Follow-ups added to backlog (per `AGENTS.md` §4.9.1):**

- BLG-0027 — AADE adapter (Ready, gated on BLG-0030).
- BLG-0028 — Epsilon Net adapter (Ready, gated on fixture acquisition).
- BLG-0029 — Family C identification spike (planned, gated on project-owner input).
- BLG-0030 — AADE HTML-shape spike (Ready, gated on consented AADE receipt).
- BLG-0032 — Mobile `validateGrQrCode` discriminated-union mirror (Ready).
- BLG-0033 (post-MVP) — Detect probable duplicates across QR sources for the same physical purchase. Sized post-MVP; not pulled until §2.9 review.

BLG-0026 (umbrella discovery item) **moves to `docs/done.md`** at S-010 close as the item that produced this ADR.
