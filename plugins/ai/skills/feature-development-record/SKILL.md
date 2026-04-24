---
name: feature-development-record
description: Internal template holder for the FDR subagent. Use the `/ai:feature-development-record` slash command instead of invoking this skill directly.
user-invocable: false
---

# Feature Development Record — Template Skill

This skill only bundles the FDR template and flow fragments under `references/` for the `ai:feature-development-record` subagent. It has no standalone behavior.

To generate an FDR, use the slash command:

```
/ai:feature-development-record <feature description>
```

That command routes to the `ai:feature-development-record` subagent, which reads `references/fdr-template.md` (plus any matching flow fragment like `references/flow-full.md` or `references/flow-lite.md`) and produces the final document under `.project/feature-development-records/`.

If this skill is invoked directly, stop and instruct the caller to use the slash command above.
