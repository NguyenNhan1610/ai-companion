---
name: ai-plugin-usage
description: Guide for using the AI Companion plugin commands in Claude Code. Use this skill whenever the user asks how to use the AI plugin, wants help with /ai:review, /ai:adversarial-review, /ai:rescue, /ai:status, /ai:result, /ai:cancel, or /ai:setup commands, asks about code review workflows, task delegation to Codex/Copilot, background job management, plugin installation, configuration, or troubleshooting. Also trigger when the user mentions Codex integration, review gates, or wants to understand what the AI plugin can do.
user-invocable: true
---

# AI Companion Plugin Usage Guide

This skill helps you get the most out of the AI Companion plugin for Claude Code. The plugin bridges Claude Code with AI backends (Codex and GitHub Copilot) for code reviews, task delegation, and background job management.

## Quick Start

### Installation

```bash
/plugin marketplace add NguyenNhan1610/codex-copilot-plugin-cc
/plugin install ai@ai-backends
/reload-plugins
/ai:setup
```

If Codex is not installed, `/ai:setup` can install it for you (requires npm). If Codex is installed but not authenticated, run:

```bash
!codex login
```

### First Run

```bash
/ai:review --background
/ai:status
/ai:result
```

## Commands Reference

### Code Review

#### `/ai:review` - Standard Code Review

Runs a read-only AI review on your current work. When the resolved backend is Codex, this uses the native `/review` flow; other backends (e.g., Copilot) use a generic task-based review path.

```bash
/ai:review                    # Review uncommitted changes
/ai:review --base main        # Review branch vs main
/ai:review --background       # Run in background (recommended for multi-file changes)
/ai:review --wait             # Force foreground execution
```

- Read-only: never modifies code
- Not steerable: does not accept custom focus text
- For custom focus or challenge-style reviews, use `/ai:adversarial-review`

#### `/ai:adversarial-review` - Challenge Review

Runs a steerable review that questions implementation choices and design tradeoffs. Pressure-tests assumptions, failure modes, and alternative approaches.

```bash
/ai:adversarial-review
/ai:adversarial-review --base main challenge whether this caching design is right
/ai:adversarial-review --background look for race conditions
```

Use this when you want to:
- Challenge the direction, not just the code details
- Focus on design choices, tradeoffs, and hidden assumptions
- Pressure-test around specific risk areas (auth, data loss, rollback, race conditions)

Also read-only: does not fix code.

### Task Delegation

#### `/ai:rescue` - Delegate Work to Codex

Hands a task to Codex through the `ai:rescue` subagent. Write-capable by default.

```bash
/ai:rescue investigate why the tests started failing
/ai:rescue fix the failing test with the smallest safe patch
/ai:rescue --resume apply the top fix from the last run
/ai:rescue --fresh start a new investigation of the auth bug
/ai:rescue --model gpt-5.4-mini --effort medium investigate the flaky test
/ai:rescue --model spark fix the issue quickly
/ai:rescue --background investigate the regression
```

Key flags:
- `--model provider:model` - Select a specific model (e.g., `codex:gpt-5.4`, `copilot:claude-opus-4.5`)
- `--effort <level>` - Set reasoning effort: none, minimal, low, medium, high, xhigh
- `--resume` - Continue the latest rescue thread for this repo
- `--fresh` - Force a new thread even if a previous one exists
- `--background` / `--wait` - Control execution mode

Model shortcuts: `spark` maps to `gpt-5.3-codex-spark`.

You can also delegate naturally without the slash command:
> Ask Codex to redesign the database connection to be more resilient.

### Job Management

#### `/ai:status` - Check Job Progress

```bash
/ai:status                    # Show all running and recent jobs
/ai:status task-abc123        # Check a specific job
/ai:status task-abc123 --wait # Poll until a specific job completes
```

#### `/ai:result` - Get Job Output

```bash
/ai:result                    # Show latest finished job output
/ai:result task-abc123        # Show specific job output
```

Includes the Codex session ID when available, so you can resume in Codex directly with `codex resume <session-id>`.

#### `/ai:cancel` - Cancel a Job

```bash
/ai:cancel                    # Cancel the active job
/ai:cancel task-abc123        # Cancel a specific job
```

### Setup & Configuration

#### `/ai:setup` - Plugin Setup

```bash
/ai:setup                          # Check backend readiness
/ai:setup --enable-review-gate     # Enable the review gate
/ai:setup --disable-review-gate    # Disable the review gate
```

**Review Gate**: When enabled, a `Stop` hook runs a targeted Codex review on Claude's recent changes before allowing the session to end. If issues are found, the stop is blocked so Claude can address them first. Warning: this can create long-running loops and drain usage limits.

## Common Workflows

### Review Before Shipping
```bash
/ai:review                    # Quick review of uncommitted changes
# or for branch review:
/ai:review --base main
```

### Get a Second Opinion on Design
```bash
/ai:adversarial-review --base main challenge whether this was the right approach
```

### Delegate a Bug Investigation
```bash
/ai:rescue investigate why the build is failing in CI
/ai:status                    # Check progress
/ai:result                    # Get findings
```

### Long-Running Background Work
```bash
/ai:rescue --background investigate the flaky integration test
/ai:adversarial-review --background
# Later:
/ai:status
/ai:result
```

### Continue Previous Work
```bash
/ai:rescue --resume apply the top fix from the last run
# Or resume directly in Codex:
codex resume <session-id>
```

### Use a Specific Model or Effort Level
```bash
/ai:rescue --model gpt-5.4-mini --effort high fix the type error
/ai:rescue --model spark quick fix for the typo
```

## Configuration

The plugin uses your existing Codex configuration. Customize defaults in `config.toml`:

**User-level**: `~/.codex/config.toml`
**Project-level**: `.codex/config.toml` (requires trusted project)

Example - always use gpt-5.4-mini with high effort for a project:
```toml
model = "gpt-5.4-mini"
model_reasoning_effort = "xhigh"
```

Config resolution order: user-level -> project-level overrides -> command-line flags.

## Supported Backends

| Feature | Codex (Default) | Copilot |
|---|---|---|
| Type | Persistent app server | Stateless CLI |
| Native reviews | Yes | No (task-based) |
| Auth | `~/.codex/config.toml` | GitHub Copilot CLI auth |
| Models | gpt-5.4, gpt-5.4-mini, gpt-5.3-codex-spark | Via Copilot CLI |

## Troubleshooting

- **"Codex not found"**: Run `/ai:setup` to check, or install manually with `npm install -g @openai/codex`
- **"Not authenticated"**: Run `!codex login` to authenticate
- **Review takes too long**: Use `--background` and check with `/ai:status`
- **Want to resume in Codex UI**: Get the session ID from `/ai:result`, then run `codex resume <session-id>`
- **Review gate draining limits**: Disable with `/ai:setup --disable-review-gate`
