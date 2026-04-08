# AI Companion Plugin for Claude Code

A high-quality fork of the Codex plugin that adds aspect-based code reviews, multi-agent council discussions, and auto-installable coding rules for FastAPI, Next.js, Django, and more.

## What's New in This Fork

| Feature | Original | This Fork |
|---------|----------|-----------|
| Code review | Diff-based only | **Full codebase** + aspect-based (`security`, `performance`, `architecture`, `antipatterns`) |
| Language support | Generic | **Python, TypeScript, Dart** with techstack variants (FastAPI, Django, Next.js, Flutter) |
| Multi-agent | None | **`/ai:council`** — parallel agents discuss, debate, synthesize |
| Coding rules | None | **`/ai:setup --install-rules`** — auto-install best-practice rules into `.claude/rules/` |
| Cascade logging | None | **PostToolUse hook** tracks all file changes to `.claude/cascades/{branch}.md` |

## Commands

| Command | Description |
|---------|-------------|
| `/ai:review` | Standard or aspect-based code review |
| `/ai:review security` | Full codebase security audit |
| `/ai:review python/fastapi:performance` | FastAPI-specific performance review |
| `/ai:adversarial-review` | Challenge review that questions design choices |
| `/ai:council --roles security,performance` | Multi-agent discussion with debate |
| `/ai:rescue` | Delegate investigation or fix to Codex |
| `/ai:status` | Check job progress |
| `/ai:result` | Get finished job output |
| `/ai:cancel` | Cancel a running job |
| `/ai:setup` | Check backend readiness, install rules, configure review gate |

## Requirements

- **ChatGPT subscription (incl. Free) or OpenAI API key** — [pricing](https://developers.openai.com/codex/pricing)
- **Node.js 18.18 or later**

## Install

```bash
/plugin marketplace add NguyenNhan1610/ai-companion
/plugin install ai@ai-backends
/reload-plugins
/ai:setup
```

If Codex is not installed: `/ai:setup` can install it for you (requires npm).
If not authenticated: run `!codex login`.

### Install Coding Rules (Optional)

```bash
/ai:setup --install-rules fastapi          # FastAPI + Python rules
/ai:setup --install-rules nextjs           # Next.js + TypeScript rules
/ai:setup --install-rules fastapi,nextjs   # Both stacks
/ai:setup --install-rules django           # Django + Python rules
```

This copies best-practice rules into `.claude/rules/` — they load on-demand when Claude reads matching files.

## Aspect-Based Code Review

Review the full codebase through a specific lens. Each aspect uses a dedicated prompt template with deep, language-specific expertise.

```bash
/ai:review security                        # Generic security audit
/ai:review python:performance              # Python performance review
/ai:review python/fastapi:security         # FastAPI-specific security
/ai:review typescript/nextjs:performance   # Next.js App Router performance
/ai:review dart/flutter:architecture       # Flutter architecture review
/ai:review --base main                     # Diff-based review (no aspect)
```

**Available aspects:** `security`, `performance`, `architecture`, `antipatterns`

**Supported stacks:**

| Language | Base | Techstacks |
|----------|------|------------|
| Python | `python:security` | `python/fastapi:*`, `python/django:*` |
| TypeScript | `typescript:security` | `typescript/nextjs:*` |
| Dart | `dart:security` | `dart/flutter:*` |

When no aspect is given, `/ai:review` uses the native Codex diff-based review. When an aspect is specified, it reads the **full codebase** and applies a specialized prompt template.

## Multi-Agent Council

Multiple AI agents analyze the codebase independently, debate each other's findings, and a synthesis agent produces the final verdict.

```bash
/ai:council --roles security,performance Analyze the auth flow
/ai:council --roles attacker,defender,judge Is our rate limiting sufficient?
/ai:council --roles architecture,antipatterns --background
```

**Discussion model:**

```
Round 1 (parallel):  Agent A ──┐
                     Agent B ──┼── independent codebase exploration
                     Agent C ──┘
                         │
Round 2 (parallel):  Agent A ──┐
                     Agent B ──┼── each sees all Round 1 findings, challenges/agrees/adds
                     Agent C ──┘
                         │
Synthesis:           Judge ────── resolves disagreements, deduplicates, final verdict
```

**Predefined roles:** `security`, `performance`, `architecture`, `antipatterns`, `attacker`, `defender`, `judge`

Custom freeform roles are also accepted. Default roles if `--roles` is omitted: `security,performance,architecture`. Maximum 7 roles.

Total backend calls: `2 * N + 1` (3 roles = 7 calls).

## Adversarial Review

A steerable review that challenges the implementation approach and design choices.

```bash
/ai:adversarial-review
/ai:adversarial-review --base main challenge whether this caching design is right
/ai:adversarial-review --background look for race conditions
```

## Task Delegation

Hand work to Codex through the rescue subagent.

```bash
/ai:rescue investigate why the tests started failing
/ai:rescue fix the failing test with the smallest safe patch
/ai:rescue --resume apply the top fix from the last run
/ai:rescue --model gpt-5.4-mini --effort medium investigate the flaky test
/ai:rescue --background investigate the regression
```

Supports `--model provider:model`, `--effort level`, `--resume`, `--fresh`, `--background`, `--wait`.

## Job Management

```bash
/ai:status                    # Show all running and recent jobs
/ai:status job-id             # Check a specific job
/ai:result                    # Show latest finished job output
/ai:result job-id             # Show specific job output
/ai:cancel job-id             # Cancel an active job
```

## Coding Rules

The plugin bundles best-practice rules for Python/FastAPI/Django and TypeScript/Next.js. Install them into any project:

```bash
/ai:setup --install-rules fastapi,nextjs
```

Rules are copied to `.claude/rules/` and load **on-demand** when Claude reads matching files — zero context cost for unrelated work.

**What's included:**

| Stack | Rules |
|-------|-------|
| Python | security, performance, antipatterns, architecture |
| FastAPI | security, performance, antipatterns + Python base |
| Django | security, performance + Python base |
| TypeScript | security, performance, antipatterns, architecture |
| Next.js | security, performance, architecture, antipatterns + TypeScript base |

## Cascade Change Tracking

A PostToolUse hook automatically records every file edit, create, and removal to `.claude/cascades/{branch}.md`:

```markdown
# Cascade: main

- EDIT `plugins/ai/scripts/ai-companion.mjs`
- CREATE `plugins/ai/prompts/council/security.md`
- EDIT `plugins/ai/scripts/lib/render.mjs`
- REMOVE `old-file.js`
```

This provides a per-branch reference of what changed during a session.

## Setup & Configuration

### Review Gate

```bash
/ai:setup --enable-review-gate
/ai:setup --disable-review-gate
```

When enabled, a `Stop` hook runs a Codex review on Claude's recent changes before allowing the session to end.

> **Warning:** The review gate can create long-running loops and drain usage limits.

### Codex Configuration

The plugin uses your existing Codex configuration:

- **User-level:** `~/.codex/config.toml`
- **Project-level:** `.codex/config.toml` (requires trusted project)

Example — always use gpt-5.4-mini with high effort:

```toml
model = "gpt-5.4-mini"
model_reasoning_effort = "xhigh"
```

### Supported Backends

| Feature | Codex (Default) | Copilot |
|---------|-----------------|---------|
| Type | Persistent app server | Stateless CLI |
| Native reviews | Yes | No (task-based) |
| Auth | `~/.codex/config.toml` | GitHub Copilot CLI |
| Models | gpt-5.4, gpt-5.4-mini, gpt-5.3-codex-spark | Via Copilot CLI |

## FAQ

### Do I need a separate Codex account?

If you're already signed into Codex on this machine, it works immediately. This plugin uses your local Codex CLI authentication. If you haven't used Codex yet, run `/ai:setup` to check readiness and `!codex login` to authenticate.

### Does the plugin modify my code?

Reviews (`/ai:review`, `/ai:adversarial-review`, `/ai:council`) are **read-only**. Only `/ai:rescue` can make changes, and it defaults to write-capable mode (use `--no-write` for read-only).

### Can I resume work in Codex?

Yes. `/ai:result` includes the Codex session ID. Run `codex resume <session-id>` to continue in Codex directly.

### What's the difference from the original plugin?

This fork adds aspect-based reviews (28 prompt templates for 3 languages + 5 techstacks), multi-agent council (parallel discussion + debate + synthesis), auto-installable coding rules, and cascade change tracking. The original only supports diff-based reviews with no language or aspect awareness.

## License

Apache 2.0
