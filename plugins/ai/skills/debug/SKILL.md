---
name: debug
description: Routing stub for the `/ai:debug` slash command. The real content lives in the `debug` subagent and the `hypothesis-debugging` skill.
user-invocable: false
---

# Debug — Routing Stub

This skill exists only to let `/ai:debug` resolve its `Skill(ai:debug)` lookup without hanging. It has no standalone behavior.

Use the slash command:

```
/ai:debug <bug description>
```

That command forks to the `debug` subagent, which runs hypothesis-based investigation with a visual decision tree.

For the hypothesis-debugging methodology and templates see the `hypothesis-debugging` skill.

If this skill is invoked directly, stop and instruct the caller to use the slash command above.
