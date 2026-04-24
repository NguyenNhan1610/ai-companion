---
name: cascade
description: Routing stub for the `/ai:cascade` slash command. The real content lives in the `cascade` subagent and the `handoff-recording` skill.
user-invocable: false
---

# Cascade — Routing Stub

This skill exists only to let `/ai:cascade` resolve its `Skill(ai:cascade)` lookup without hanging. It has no standalone behavior.

Use the slash command:

```
/ai:cascade
```

That command forks to the `cascade` subagent, which reads `.project/cascades/` logs and produces a HANDOFF record with traceability.

For the handoff-record template and fields see the `handoff-recording` skill.

If this skill is invoked directly, stop and instruct the caller to use the slash command above.
