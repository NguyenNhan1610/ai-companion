---
name: implement
description: Routing stub for the `/ai:implement` slash command. The real content lives in the `implement` subagent and the `implementation-plan` skill.
user-invocable: false
---

# Implement — Routing Stub

This skill exists only to let `/ai:implement` resolve its `Skill(ai:implement)` lookup without hanging. It has no standalone behavior.

Use the slash command:

```
/ai:implement --from <path-to-fdr-or-adr>
```

That command forks to the `implement` subagent, which reads the source FDR/ADR and produces an IMPL document under `.project/implementation-plans/`.

For the full reference material (template, flow modes, methods) see the `implementation-plan` skill.

If this skill is invoked directly, stop and instruct the caller to use the slash command above.
