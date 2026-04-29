# Context: Decisions

Index of recorded ADRs. Each entry links to the canonical file under `docs/adr/`.

The init run did not produce ADRs — the structural choices in `AGENTS.md` (no OCR, RLS-required, country-agnostic schema, pluggable parser, secrets via env) are mission-level constraints recorded directly in the entry file. New decisions taken in subsequent sprints land here as they are written.

## Index

(Empty until the first discovery sprint after S-000 produces ADR-0001.)

## Conventions

- ADR files: `docs/adr/S-<NNN>-ADR-<CCCC>-<title>.md`.
- One ADR per decision. No batching.
- Status flow: `proposed → accepted → (superseded-by ADR-<id>)`.
- Co-signs required:
  - new external surface (host / MCP server / dependency) → `agent-safety-officer` + `architect`,
  - schema migration / new RLS policy → `data-architect` + `security-privacy-officer`,
  - new EU adapter → `parser-specialist` + `architect` + `data-architect`,
  - API contract change → `architect` + `engineering-manager`,
  - new mobile screen / UX flow → `product-designer` + `localization-specialist`.
