# Inferred-category heuristic (activate now or stay deferred)

Status: accepted
Date: 2026-05-07
Chair: orchestrator
Participants: architect, data-architect, parser-specialist, localization-specialist, qa, product-owner, product-manager
Co-signs required: architect (technical decision), data-architect (schema impact — confirmed: none), parser-specialist (Greek description / EAN inputs).

## Context

`AGENTS.md` §5.4.3 declares `receipt_items.inferred_category TEXT NULL` and `receipt_items.inferred_brand TEXT NULL` — placeholder columns for an *automated* category / brand label per line item. Neither is populated today.

ADR-0005 §6 (the Insights computation ADR) explicitly **deferred** the inferred-category question: *"Inferred category from EAN / description is **out of scope** for MVP. A future BLG can add it; the schema already carries `receipt_items.inferred_category` for that day."*

This ADR closes that deferred decision: do we activate the heuristic now (S-005 / S-006), or formally **stay deferred** with explicit re-evaluation criteria.

The user-typed `business_category` is the **other** category column. ADR-0008 just locked it as free-text on `receipts.business_category`. The two columns serve different purposes:

- `receipts.business_category` — the **user's** word for tagging a receipt as a business expense. Free text, lowercased server-side, populated only when the user taps "Tag as business".
- `receipt_items.inferred_category` — an **automated** label per line item, derived from EAN / description. Useful for non-business spend insights (groceries / fuel / pharmacy / restaurants), without requiring the user to tag every receipt.

Constraints in scope:

- `AGENTS.md` §2.4 — no third-party paid services beyond Supabase + Railway / Render + `e-invoicing.gr`. An LLM-based category classifier (e.g. OpenAI / Anthropic API) is **directly forbidden** by §2.4.
- `AGENTS.md` §2.4 — country-agnostic schema. Any heuristic must work for non-GR adapters too (RO / IT / PT / ES per §5.9), or at least carry a `country_code` switch so GR-specific rules don't pollute the others.
- `AGENTS.md` §3.2.1 — supply-chain discipline. New runtime deps need an ADR + `agent-safety-officer` + `engineering-manager` review.
- `AGENTS.md` §5.3.3 — line-item fields available: EAN, description (Greek free text), unit, quantity, unit price, VAT rate.
- ADR-0001 — VAT rate stored as percent number; description preserved verbatim from `e-invoicing.gr` HTML.
- ADR-0005 §6 — inferred-category is explicitly out of scope for MVP; this ADR confirms or reverses that.

The candidate approaches:

1. **EAN-range tables** — map EAN prefixes to category buckets (e.g. EAN-13 starting `5201360` ⇒ "groceries-dairy" via a curated lookup). Pro: deterministic, fast, no new runtime deps. Con: tedious to curate, brittle (EAN ranges drift, manufacturer-specific), low coverage for Greek-only or restaurant-style receipts that often print descriptive non-EAN codes.
2. **Description-NLP heuristics** — pattern-match `description` text (Greek!) against keyword lists or a small embedding-based classifier. Pro: works without EANs (covers restaurants, pharmacies, services). Con: requires Greek-language NLP — sentence-transformers, FastText, or similar — which adds a real dep tree (`numpy`, `torch` or `onnxruntime`, model weights ~50-300 MB). Quality without per-domain fine-tuning is mediocre.
3. **Per-merchant defaults** — when a merchant is "Alpha Super Market", default the inferred category to "groceries"; "Avis Hellas" → "transport". Pro: cheap, deterministic, covers the common case. Con: no per-line-item granularity (a supermarket receipt has snacks + cleaning + cosmetics — all become "groceries"), requires a curated merchant table.
4. **LLM API call** (OpenAI / Anthropic / etc.) — send `description` to an external LLM, parse a category back. **Directly forbidden by §2.4** ("no third-party paid services beyond Supabase / Railway / Render / `e-invoicing.gr`"). Mentioned only to formally reject.
5. **Stay deferred** — leave `inferred_category` NULL until a future ADR re-opens this. The Insights "by category" rollup keeps using `business_category ∪ "untagged"` per ADR-0005 §6.

## Rounds

### Round 1

- **product-owner**: I want to be honest about MVP scope. The §2.8 MVP definition does not mention inferred categories. The Insights "by category" rollup (ADR-0005 §6) already produces a usable grouping via the user's `business_category` + an "untagged" bucket. Adding inferred categories is *value-add*, not a *gap*. I want it eventually, but not at the cost of one more ADR debate, one more dep, one more thing to maintain when MVP isn't shipped yet. **Position: stay deferred.**
- **product-manager**: Same. The cost-vs-value of any of approaches 1-3 is dubious until we know whether users *want* the granularity. Better to ship MVP, watch behavior, and let user demand surface a concrete need. Stay deferred.
- **architect**: Technically I'd lean per-merchant defaults (approach 3) if we had to pick one — it's the cheapest and the schema already supports it (we'd populate `receipt_items.inferred_category` from a tiny merchant→category table at insert time in the parser path). But "cheapest" still means: a curated Greek merchant table, a maintenance cadence to keep it current, a parser pipeline change, and a migration step to backfill existing rows. None of that has user demand behind it. Stay deferred.
- **data-architect**: Schema impact is **none** in either direction — the columns already exist (`receipt_items.inferred_category TEXT NULL`, `receipt_items.inferred_brand TEXT NULL`). Re-activating would require zero migration; deferring requires zero action. Either way the column stays NULL until populated.
- **parser-specialist**: If activated, I'd want the heuristic to run **at parse time** (in the GR adapter's `_extract_items` or a post-processor on `ParsedReceipt`), not at query time — that's where the receipt is fresh and the description text is intact. But: any *Greek-language* description-NLP requires a dependency on Greek language tooling we don't currently have, and per `AGENTS.md` §3.2.1 we'd need an ADR for that. I'd rather defer until the user asks for it.
- **localization-specialist**: Greek-language NLP tooling (sentence-transformers Greek models, fastText `cc.el.300.bin`, spaCy `el_core_news_sm`) is uneven in quality and not consistent in glyph normalization (Greek uppercase variants like `ς` vs `σ`, accents, diacritics). Description text on `e-invoicing.gr` is often abbreviated or all-caps in non-standard ways. Without per-domain fine-tuning, accuracy will likely be ~70%, which produces visible errors in the Insights screen. The "wrong category" UX is worse than "no category" — defer.
- **qa**: From a testing perspective: a heuristic-based label is hard to test deterministically (no clean ground truth for "is this dairy or pharmacy"), and the test set would itself depend on Greek-language receipts. If we activate, BLG acceptance becomes "manual evaluation against a curated set of 50 receipts" — fuzzy. **Stay deferred until we can write deterministic acceptance.**

### Round 2

- **architect** (responding): To make the deferral concrete and not just open-ended: re-evaluation triggers should be (a) **a quantitative threshold** ("≥ 100 tagged receipts have populated `business_category` across the active user base") so we have *some* signal for what categories real users actually want, OR (b) **explicit user demand** via the `product-owner` feedback loop, OR (c) the supply-chain landscape changes meaningfully (e.g. an open, BSD-licensed Greek-language category model becomes available, or §2.4 is amended to allow a specific managed service).
- **data-architect** (responding): Threshold (a) is testable from the existing `receipts` table without any new instrumentation: `SELECT count(*) FROM receipts WHERE business_category IS NOT NULL` — when that exceeds 100 and `product-owner` confirms users are tagging meaningfully (not just noise), the trigger fires.
- **parser-specialist** (responding): When re-activated, I'd put the heuristic behind a `category_inferrer.py` module per country (`backend/app/parsers/gr/category.py`), pluggable identical to the parser interface in ADR-0001. Country-agnostic by default — Romanian / Italian / Portuguese / Spanish adapters get their own module without touching GR.
- **product-owner** (responding): Re-eval criteria are crisp. Confirming the deferral.
- **product-manager** (responding): Same.
- **qa** (responding): Re-eval criteria are testable. Defer confirmed.

### Round 3 (single confirmation round, uncontested)

- **architect**: No new concerns.
- **data-architect**: No new concerns.
- **parser-specialist**: No new concerns.
- **product-owner**: No new concerns.
- **product-manager**: No new concerns.
- **localization-specialist**: No new concerns.
- **qa**: No new concerns.

This decision was uncontested in Round 1 — every relevant agent independently arrived at "stay deferred". Round 2 served only to make the deferral concrete (re-eval triggers, future architecture). Two rounds is sufficient per `chair-adr-debate.md` minimum-runtime ("at least two rounds of cross-agent reply for any decision that crosses agent boundaries"). Closing.

## Decision

### 1. Stay deferred

- The inferred-category heuristic is **not** activated for MVP.
- `receipt_items.inferred_category` remains NULL until this decision is reversed by a future ADR.
- The Insights "by category" rollup continues to use `business_category ∪ "untagged"` per ADR-0005 §6.

### 2. Re-evaluation triggers

The deferral is reviewed (a future BLG opens an ADR-0010-successor) when **any** of the following becomes true:

- **(a) Quantitative threshold** — at least **100** receipts across the active user base have populated `business_category` (i.e. have been tagged as business expenses by users). The threshold is intentionally low so we have signal early; a meaningful classifier would need significantly more, but 100 is enough to validate that user-driven categorization actually happens.
- **(b) Explicit user demand** — `product-owner` records demand from real users for automatic categorization (e.g. via direct feedback, support requests, or app-store reviews). The demand is captured as a backlog item.
- **(c) Supply-chain shift** — the constraints in `AGENTS.md` §2.4 change (a new managed service is permitted by an `AGENTS.md` amendment), or a stable, BSD-licensed Greek-language category classifier with deterministic outputs becomes available.

When triggered, a new ADR is opened to debate the approach (EAN-range, description-NLP, per-merchant default, or hybrid). The new ADR amends or supersedes this one.

### 3. Future architecture (when activated)

For the avoidance of future debate, this ADR records the architectural shape the successor should follow:

- Heuristic runs at **parse time** (post-processor on `ParsedReceipt`), not at query time.
- One module per country: `backend/app/parsers/<country>/category.py`. Country-agnostic by default; GR module covers GR; future EU adapters get their own module.
- Per-line-item label written to `receipt_items.inferred_category`.
- Optional per-line-item brand label written to `receipt_items.inferred_brand`.
- The heuristic must be **deterministic** (same input ⇒ same output) so QA can write acceptance tests against a curated fixture set.
- The Insights `by_category` rollup logic in ADR-0005 §6 may be amended to prefer `business_category` if non-null else `inferred_category` if non-null else `"untagged"`.

### 4. What is rejected

- **LLM-API call** (OpenAI, Anthropic, Google, etc.) — directly forbidden by `AGENTS.md` §2.4 (third-party paid service beyond the allowed list). Recorded as rejected so a future agent does not re-debate without first amending §2.4.

### 5. What this ADR does **not** decide

- Which heuristic wins (EAN, NLP, per-merchant, hybrid). The successor ADR debates that.
- Whether `inferred_brand` is populated alongside `inferred_category`. Same — successor ADR.
- Whether the `business_category` (user-typed) and `inferred_category` (automatic) labels appear together in the Insights screen. UX decision; the successor's companion DES handles it.

## Dissent

None recorded. All participants converged in Round 1; Round 2 only added re-eval triggers.

## Consequences

**Positive:**

- No new runtime dep, no new outbound surface, no new schema migration. The MVP scope stays tight.
- ADR-0008's `business_category` (user-typed) carries the entire MVP categorization story; the Insights screen renders it cleanly via ADR-0005 §6.
- The deferral is not open-ended — three concrete re-eval triggers prevent this from becoming forever-deferred.

**Negative:**

- The Insights "by category" rollup quality depends entirely on whether users tag their receipts. For a non-freelancer (no business expenses to tag), the entire rollup is one big "Χωρίς κατηγορία" bucket — usable but not insightful. Acceptable for MVP; mitigated by the explicit user-demand re-eval trigger.

**Follow-ups (added to backlog):**

- No new BLG opened in this sprint. The deferred state is the default.
- When trigger (a), (b), or (c) fires, a successor ADR is opened. The opener records which trigger fired and what evidence supports it.
