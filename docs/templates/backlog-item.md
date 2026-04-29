# Template: Backlog item

Copy this block into `docs/backlog.md` (or use it as the spec when creating a new item). Schema is verbatim from `AGENTS.md` §4.9.1.

```
- ID: BLG-<NNNN>
  Title: <short, outcome-oriented sentence>
  Status: planned | in-progress | drift
  Owner: <agent name>
  Type: product | engineering | parser | data | security | agentic
  Outcome: <user / system outcome and why it matters>
  Acceptance: <bullets QA can turn into tests; for parser work, the fixture IDs it must pass>
  Design: <link to DES artifact, if user-facing>
  Approach: <one paragraph; links to ADRs>
  Size: XS | S | M | L (must fit one delivery sprint)
  Impact-notes: { rls?, localization?, country-code?, external-surface? }
  Links: [ADR-*, DES-*, prior done.md entries]
```
