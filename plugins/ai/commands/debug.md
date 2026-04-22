---
description: Hypothesis-based debugging with visual decision trees
argument-hint: '[--type bug|performance|flaky|behavior] [--background|--wait] <symptom description>'
context: fork
allowed-tools: Read, Glob, Grep, Bash(node:*), Bash(git:*), Agent, AskUserQuestion
---

Route this request to the `ai:debug` subagent.

Raw user request:
$ARGUMENTS

The debug agent performs structured hypothesis debugging:
1. **Observe** — explore the codebase for evidence related to the symptom
2. **Hypothesize** — generate ranked hypotheses with testable predictions
3. **Test** — run test scripts via Codex to confirm/reject each hypothesis
4. **Conclude** — produce a diagnosis report with Mermaid decision tree

Execution mode:
- If `--background` is present, run the `ai:debug` subagent in the background.
- If `--wait` is present, run in the foreground.
- Otherwise, default to foreground.

Debug type:
- `--type bug` (default) — error paths, input validation, state corruption
- `--type performance` — profiling, N+1, memory, blocking I/O
- `--type flaky` — race conditions, timing, shared state, test isolation
- `--type behavior` — state management, caching, event ordering, data flow

Operating rules:
- The debug agent explores the codebase directly using Read, Grep, Glob, and Bash tools.
- It may spawn sub-agents via the Agent tool for parallel exploration.
- It uses the `ai-cli-runtime` skill to delegate hypothesis testing to Codex.
- It embeds decision-tree diagrams as fenced ```mermaid``` blocks, validated via `mermaid-helper.mjs validate`. No .svg files are written.
- The final output must follow the Hypothesis Debugging Report template.
- Do NOT apply fixes. Only diagnose and recommend.
