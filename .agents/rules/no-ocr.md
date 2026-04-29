# Rule: No OCR (verbatim from AGENTS.md §2.4)

All receipt structure must come from the structured e-invoicing infrastructure. **No OCR** is permitted anywhere in the codebase, in any country adapter, or as a fallback when QR fetching fails.

If the QR target is unreachable, the parser fails loudly, surfaces a typed error, and the user sees a clear message — it does not silently invent fields, hand off to OCR, or scrape a photo.

This rule is non-negotiable. Any proposed feature that would introduce OCR must be rejected or redesigned through the decision system (`AGENTS.md` §4.4).

Owner: `architect` (technical), `product-owner` (product). Always-on.
