---
description: Generate a Feature Development Decision Record with edge cases, risk assessment, and impact analysis
argument-hint: '[--scope backend|frontend|fullstack|api|data] <feature description>'
context: fork
allowed-tools: Read, Glob, Grep, Bash(node:*), Bash(git:*), Agent, AskUserQuestion
---

Route this request to the `ai:fdr` subagent.

Raw user request:
$ARGUMENTS

The FDR agent produces a comprehensive Feature Development Decision Record by:
1. **Mapping** the current codebase to understand affected modules, dependencies, and API surface
2. **Designing** the implementation with affected code paths
3. **Stress-testing** by systematically enumerating edge cases and failure modes
4. **Assessing** risks with a likelihood x impact matrix and concrete mitigations
5. **Planning** implementation steps, testing strategy, and rollout plan with Mermaid diagrams

Execution mode:
- If `--background` is present, run in background.
- If `--wait` is present, run in foreground.
- Otherwise, default to foreground.

Scope:
- `--scope backend` — backend/server-side feature (default)
- `--scope frontend` — frontend/UI feature
- `--scope fullstack` — full-stack feature spanning client and server
- `--scope api` — API endpoint or contract change
- `--scope data` — data model or storage change

Operating rules:
- The FDR agent explores the codebase directly using Read, Grep, Glob, Bash.
- It renders Mermaid diagrams using `node "${CLAUDE_PLUGIN_ROOT}/scripts/mermaid-helper.mjs"`.
- Both rendered SVG paths AND raw Mermaid code blocks are included in the output.
- Saves the FDR to `.claude/project/fdr/FDR-{NN}-{slug}.md`.
- Do NOT implement the feature. Only document the plan.
