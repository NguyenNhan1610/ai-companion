---
description: Generate a Feature Development Record with edge cases, risk assessment against existing codebase, and impact analysis. Use when user wants to plan a new feature, analyze implementation impact, assess risks, or create a feature spec before coding.
argument-hint: '[--scope backend|frontend|fullstack|api|data] <feature description>'
context: fork
allowed-tools: Read, Glob, Grep, Bash(node:*), Bash(git:*), Agent, AskUserQuestion
---

Route this request to the `ai:feature-development-record` subagent.

Raw user request:
$ARGUMENTS

The FDR agent produces a comprehensive Feature Development Record by:
1. **Mapping** the current codebase to understand affected modules, dependencies, and API surface
2. **Designing** the implementation with affected code paths
3. **Stress-testing** by systematically enumerating edge cases and failure modes
4. **Assessing** risks — both feature-specific AND risks the new feature introduces to the existing codebase (regressions, contract breaks, performance degradation, dependency conflicts)
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
- It validates Mermaid diagrams using `node "${CLAUDE_PLUGIN_ROOT}/scripts/mermaid-helper.mjs" validate` before embedding them.
- Diagrams are embedded as fenced ```mermaid``` blocks directly in the FDR markdown. No .svg files are written.
- Saves the FDR to `.project/feature-development-records/FDR-{NN}-{slug}.md`.
- Do NOT implement the feature. Only document the plan.
