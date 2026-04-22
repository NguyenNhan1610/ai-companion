---
name: ai-plugin-usage
description: Guide for using the AI Companion plugin commands in Claude Code. Use this skill whenever the user asks how to use the AI plugin, wants help with /ai:review, /ai:adversarial-review, /ai:council, /ai:debug, /ai:mermaid, /ai:rescue, /ai:status, /ai:result, /ai:cancel, or /ai:setup commands, asks about code review workflows, hypothesis debugging, multi-agent discussions, diagram rendering, task delegation to Codex, background job management, plugin installation, configuration, or troubleshooting. Also trigger when the user mentions Codex integration, review gates, multi-agent review, council of agents, mermaid diagrams, or wants to understand what the AI plugin can do.
user-invocable: true
---

# AI Companion Plugin Usage Guide

Use Codex from inside Claude Code for code reviews, multi-agent discussions, hypothesis debugging, diagram rendering, and task delegation.

## When to Use Which Command

| Situation | Command |
|-----------|---------|
| Full codebase review | `/ai:review` |
| Aspect-focused codebase review | `/ai:review python/fastapi:security` |
| Bug-finding review with P0-P3 tags | `/ai:finding-review` |
| Quick git diff review | `/ai:git-review` |
| Commit impact analysis | `/ai:git-effect-review` |
| Challenge design decisions | `/ai:adversarial-review` |
| Multiple perspectives | `/ai:council --roles security,performance` |
| Investigate a bug | `/ai:debug The API returns 500` |
| Delegate a fix to Codex | `/ai:rescue fix the failing test` |
| Document an architecture decision | `/ai:architecture-decision-record` |
| Plan a feature with risks | `/ai:feature-development-record` |
| Generate test plan from FDR | `/ai:test-plan --from FDR-03` |
| Generate implementation checklist | `/ai:implement --from FDR-03.md` |
| Track task progress | `/ai:todo` or `/ai:todo --from IMPL-03` |
| Validate stage coverage | `/ai:validate FDR-03 IMPL-03` |
| Verify feature completeness | `/ai:trace --verify FDR-03` |
| Document what was built | `/ai:cascade` |
| Extract project knowledge | `/ai:knowledge extract` |
| Lint/typecheck changed files | `/ai:lint` or `/ai:lint --fix` |
| Render a diagram | `/ai:mermaid render graph TD; A-->B` |
| Install coding rules | `/ai:setup --install-rules fastapi,nextjs` |
| Check job progress | `/ai:status` |
| Get job result | `/ai:result` |
| Cancel a running job | `/ai:cancel job-id` |

## Quick Start

```bash
/plugin marketplace add NguyenNhan1610/ai-companion
/plugin install ai@ai-backends
/reload-plugins
/ai:setup
/ai:setup --install-rules fastapi,nextjs   # Optional
/ai:setup --install-mermaid                 # Optional
```

## Detailed Command Reference

Load the relevant section based on what the user is asking about:

- **Review commands** (review, adversarial-review, council): Read `references/review-commands.md`
- **Planning commands** (ADR, FDR, test-plan, implement, todo, validate, trace): Read `references/planning-commands.md`
- **Debug & rescue commands** (debug, rescue): Read `references/debug-commands.md`
- **Utility commands** (mermaid, knowledge, cascade, lint, setup, status, result, cancel): Read `references/util-commands.md`

## Supported Backends

| Feature | Codex (Default) | Claude |
|---------|-----------------|--------|
| Type | Persistent app server | Stateless CLI |
| Native reviews | Yes | Yes |
| Auth | `~/.codex/config.toml` | `~/.claude` |
| Models | gpt-5.4, gpt-5.4-mini, spark | sonnet, opus, haiku |

## Troubleshooting

- **"Codex not found"**: `/ai:setup` or `npm install -g @openai/codex`
- **"Not authenticated"**: `!codex login`
- **"mmdc not found"**: `/ai:setup --install-mermaid`
- **Review takes too long**: Use `--background` + `/ai:status`
- **Resume in Codex**: Get session ID from `/ai:result`, run `codex resume <id>`
- **Review gate draining limits**: `/ai:setup --disable-review-gate`
