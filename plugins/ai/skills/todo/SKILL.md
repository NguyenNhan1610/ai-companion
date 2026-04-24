---
name: todo
description: Routing stub for the `/ai:todo` slash command. The real content lives in the `todo` subagent and the `todo-tracking` skill.
user-invocable: false
---

# Todo — Routing Stub

This skill exists only to let `/ai:todo` resolve its `Skill(ai:todo)` lookup without hanging. It has no standalone behavior.

Use the slash command:

```
/ai:todo                                  # render kanban board
/ai:todo --from IMPL-03                   # generate todo-list from IMPL
/ai:todo update task-03 --status done     # update a task
```

That command forks to the `todo` subagent, which manages the DAG-based todo-list under `.project/todo-lists/`.

For the schema and field reference see the `todo-tracking` skill.

If this skill is invoked directly, stop and instruct the caller to use the slash command above.
