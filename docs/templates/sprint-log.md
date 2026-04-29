# Template: Sprint log (`LOG`)

File path: `docs/sprints/S-<NNN>-<sprint-type>-<short-title>/S-<NNN>-LOG-0001-<short-title>.md`. Each entry follows the audit-trail schema in `AGENTS.md` §4.9.3.

```
## <YYYY-MM-DD HH:MM> — <step name>
- Agent: <agent name>
- Action: <what was done>
- Outbound hosts contacted: [<host>, …] (or `none`)
- MCP tools invoked: [<server.tool>, …] (or `none`)
- Dependencies added: [<pkg@version>, …] (or `none`)
- Sensitive approvals: [<who approved what>] (or `none`)
- Outcome: <result, links to commits / ADRs / files>
```

Append entries as work happens. Even when a list is empty, write `none` so audit is explicit.
