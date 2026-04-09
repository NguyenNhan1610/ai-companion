---
name: ai-plugin-usage
description: Guide for using the AI Companion plugin commands in Claude Code. Use this skill whenever the user asks how to use the AI plugin, wants help with /ai:review, /ai:adversarial-review, /ai:council, /ai:debug, /ai:mermaid, /ai:rescue, /ai:status, /ai:result, /ai:cancel, or /ai:setup commands, asks about code review workflows, hypothesis debugging, multi-agent discussions, diagram rendering, task delegation to Codex/Copilot, background job management, plugin installation, configuration, or troubleshooting. Also trigger when the user mentions Codex integration, review gates, multi-agent review, council of agents, mermaid diagrams, or wants to understand what the AI plugin can do.
user-invocable: true
---

# AI Companion Plugin Usage Guide

Use Codex or GitHub Copilot from inside Claude Code for code reviews, multi-agent discussions, hypothesis debugging, diagram rendering, and task delegation.

## When to Use Which Command

| Situation | Command |
|-----------|---------|
| Quick review of changes | `/ai:review` |
| Deep review of security, performance, architecture | `/ai:review python/fastapi:security` |
| Challenge design decisions | `/ai:adversarial-review` |
| Multiple perspectives on the codebase | `/ai:council --roles security,performance` |
| Adversarial red/blue team analysis | `/ai:council --roles attacker,defender,judge` |
| Investigate a bug systematically | `/ai:debug The API returns 500 on special chars` |
| Investigate slow performance | `/ai:debug --type performance The page takes 8s` |
| Investigate a flaky test | `/ai:debug --type flaky Test fails randomly in CI` |
| Delegate a fix to Codex | `/ai:rescue fix the failing test` |
| Continue previous Codex work | `/ai:rescue --resume apply the top fix` |
| Document an architecture decision | `/ai:adr Should we use Redis or Memcached?` |
| Plan a feature with risk assessment | `/ai:fdr Add multi-tenant session caching` |
| Render a diagram | `/ai:mermaid render graph TD; A-->B` |
| Validate diagram syntax | `/ai:mermaid validate graph TD; A-->B` |
| Install coding rules | `/ai:setup --install-rules fastapi,nextjs` |
| Install Mermaid CLI | `/ai:setup --install-mermaid` |
| Check job progress | `/ai:status` |
| Get job result | `/ai:result` |
| Cancel a running job | `/ai:cancel job-id` |

## Quick Start

```bash
/plugin marketplace add NguyenNhan1610/ai-companion
/plugin install ai@ai-backends
/reload-plugins
/ai:setup
/ai:setup --install-rules fastapi,nextjs   # Optional: install coding rules
/ai:setup --install-mermaid                 # Optional: install Mermaid CLI
```

## Commands Reference

### Code Review

#### `/ai:review` — Standard & Aspect-Based Review

```bash
/ai:review                              # Review uncommitted changes (native)
/ai:review --base main                  # Review branch vs main
/ai:review security                     # Full codebase security audit
/ai:review python:performance           # Python performance review
/ai:review python/fastapi:security      # FastAPI-specific security
/ai:review typescript/nextjs:performance # Next.js performance
/ai:review dart/flutter:architecture    # Flutter architecture
/ai:review --background security        # Run in background
```

Aspects: `security`, `performance`, `architecture`, `antipatterns`
Languages: `python`, `typescript`, `dart`
Techstacks: `fastapi`, `django`, `nextjs`, `flutter`

Read-only. Aspect reviews analyze the full codebase. No-aspect reviews use native diff-based review.

#### `/ai:adversarial-review` — Challenge Review

```bash
/ai:adversarial-review
/ai:adversarial-review --base main challenge the caching design
/ai:adversarial-review --background look for race conditions
```

Read-only. Steerable — accepts free-form focus text.

### Hypothesis Debugging

#### `/ai:debug` — Scientific Method Debugging

```bash
/ai:debug The API returns 500 with special characters
/ai:debug --type performance The dashboard takes 8s to load
/ai:debug --type flaky The registration test fails randomly in CI
/ai:debug --type behavior Users see stale data after profile update
```

Types: `bug` (default), `performance`, `flaky`, `behavior`

Process:
1. **Observe** — Claude agents explore codebase (grep, read, git log)
2. **Hypothesize** — generate 3-5 ranked theories with testable predictions
3. **Test** — Codex agents write and run test scripts (parallel)
4. **Conclude** — Mermaid decision tree + structured diagnosis report

Read-only. Does not apply fixes.

### Multi-Agent Council

#### `/ai:council` — Multi-Agent Discussion

```bash
/ai:council --roles security,performance Analyze the auth flow
/ai:council --roles attacker,defender,judge Is our rate limiting sufficient?
/ai:council --roles architecture,antipatterns --background
```

Roles: `security`, `performance`, `architecture`, `antipatterns`, `attacker`, `defender`, `judge` (custom freeform also accepted)

Process: Round 1 (parallel exploration) -> Round 2 (debate) -> Synthesis (final verdict)

Cost: `2*N+1` backend calls (3 roles = 7 calls). Max 7 roles.

### Diagrams

#### `/ai:mermaid` — Mermaid.js Diagrams

```bash
/ai:mermaid validate graph TD; A-->B; B-->C
/ai:mermaid render graph TD; A[Start]-->B{Decision}; B-->|Yes|C[End]
/ai:mermaid render --format png graph TD; A-->B
/ai:mermaid render -o docs/arch.svg graph TD; A-->B
```

Inline content — no file needed. Outputs SVG (default) or PNG. Requires mmdc (`/ai:setup --install-mermaid`).

### Architecture Decision Records

#### `/ai:adr` — Architecture Decision Record

Generate a comprehensive ADR with Mermaid diagrams grounded in your codebase.

```bash
/ai:adr Should we use Redis or Memcached for caching?
/ai:adr --scope api REST vs GraphQL for the mobile API
/ai:adr --scope data Normalize orders table or use JSONB?
/ai:adr --scope system Microservices vs monolith
/ai:adr --scope infra ECS vs Kubernetes
```

Scopes: `module` (default), `system`, `api`, `data`, `infra`

Outputs: Context, decision drivers, 2-3 options with trade-offs, comparison table, 3 Mermaid diagrams (current/proposed/comparison) with raw source, implementation plan.

### Feature Development Records

#### `/ai:fdr` — Feature Development Decision Record

Plan a feature with deep codebase analysis, edge cases, risk assessment, and implementation roadmap.

```bash
/ai:fdr Add multi-tenant session caching
/ai:fdr --scope api Add rate limiting to the public API
/ai:fdr --scope fullstack Add real-time notifications
/ai:fdr --scope data Migrate orders to event sourcing
```

Scopes: `backend` (default), `frontend`, `fullstack`, `api`, `data`

Outputs: Dependency graph, data flow diagram, edge case tables, risk matrix, backward compatibility analysis, testing strategy, implementation timeline (Gantt), rollout plan, observability plan. Saved to `.claude/project/fdr/`.

### Task Delegation

#### `/ai:rescue` — Delegate to Codex

```bash
/ai:rescue investigate why the tests are failing
/ai:rescue fix the failing test with the smallest safe patch
/ai:rescue --resume apply the top fix
/ai:rescue --model gpt-5.4-mini --effort medium investigate the flaky test
/ai:rescue --model spark fix the issue quickly
/ai:rescue --background investigate the regression
```

Flags: `--model provider:model`, `--effort level`, `--resume`, `--fresh`, `--background`, `--wait`

Write-capable by default.

### Job Management

```bash
/ai:status                    # All running and recent jobs
/ai:status job-id             # Specific job details
/ai:status job-id --wait      # Poll until completion
/ai:result                    # Latest finished job output
/ai:result job-id             # Specific job output
/ai:cancel job-id             # Cancel active job
```

### Setup & Configuration

```bash
/ai:setup                              # Check backend readiness
/ai:setup --install-rules fastapi      # Install FastAPI + Python rules
/ai:setup --install-rules nextjs       # Install Next.js + TypeScript rules
/ai:setup --install-rules fastapi,nextjs # Both stacks
/ai:setup --install-mermaid            # Install Mermaid CLI (mmdc)
/ai:setup --enable-review-gate         # Enable stop-time review gate
/ai:setup --disable-review-gate        # Disable review gate
```

Available rule stacks: `python`, `fastapi`, `django`, `typescript`, `nextjs`

## Common Workflows

### Review Before Shipping
```bash
/ai:review security                   # Security audit
/ai:review --base main                # Diff-based review
```

### Deep Multi-Perspective Review
```bash
/ai:council --roles security,performance,architecture Analyze the codebase
```

### Investigate a Bug
```bash
/ai:debug The login page shows blank after OAuth redirect
```

### Delegate a Fix
```bash
/ai:rescue fix the N+1 query in the dashboard endpoint
/ai:status
/ai:result
```

### Generate Architecture Diagram
```bash
/ai:mermaid render -o docs/arch.svg graph TD; Client-->API; API-->DB; API-->Cache
```

### Set Up New Project
```bash
/ai:setup
/ai:setup --install-rules fastapi,nextjs
/ai:setup --install-mermaid
```

## Supported Backends

| Feature | Codex (Default) | Copilot |
|---------|-----------------|---------|
| Type | Persistent app server | Stateless CLI |
| Native reviews | Yes | No (task-based) |
| Auth | `~/.codex/config.toml` | GitHub Copilot CLI |
| Models | gpt-5.4, gpt-5.4-mini, spark | Via Copilot CLI |

## Troubleshooting

- **"Codex not found"**: `/ai:setup` or `npm install -g @openai/codex`
- **"Not authenticated"**: `!codex login`
- **"mmdc not found"**: `/ai:setup --install-mermaid`
- **Review takes too long**: Use `--background` + `/ai:status`
- **Resume in Codex**: Get session ID from `/ai:result`, run `codex resume <id>`
- **Review gate draining limits**: `/ai:setup --disable-review-gate`
