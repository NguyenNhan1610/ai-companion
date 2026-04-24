---
name: architecture-decision-record
description: Internal template holder for the ADR subagent. Use the `/ai:architecture-decision-record` slash command instead of invoking this skill directly.
user-invocable: false
---

# Architecture Decision Record — Template Skill

This skill only bundles the ADR template under `references/adr-template.md` for the `ai:architecture-decision-record` subagent. It has no standalone behavior.

To generate an ADR, use the slash command:

```
/ai:architecture-decision-record <decision topic or question>
```

That command routes to the `ai:architecture-decision-record` subagent, which reads `references/adr-template.md` and produces the final document under `.project/architecture-decision-records/`.

If this skill is invoked directly, stop and instruct the caller to use the slash command above.
