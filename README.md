# AI Companion Plugin for Claude Code

Use **Codex** or **GitHub Copilot** from inside Claude Code for code reviews, multi-agent discussions, hypothesis debugging, architecture decisions, feature planning, task tracking, and auto-installable coding rules — with deep support for FastAPI, Next.js, Django, Flutter, and more.

A high-quality fork of [openai/codex-plugin-cc](https://github.com/openai/codex-plugin-cc) with significant enhancements.

## Document Flow

```
ADR → FDR → IMPL → TODO → code → test → lint → cascade → review
 ↑                   ↑      ↑       ↑      ↑       ↑       ↑
 └───────────────────┴──────┴───────┴──────┴───────┴───────┘
                         (all trace back)
                              ↓
                    /ai:knowledge extract
                              ↓
              patterns · lessons · decisions · antipatterns
                              ↓
                 Auto-suggested on next ADR/FDR/IMPL/debug

              /ai:trace --verify FDR-03
                              ↓
               READY TO SHIP / NOT READY / NEEDS REVIEW
```

## What's New in This Fork

| Feature | Original | This Fork |
|---------|----------|-----------|
| Code review | Diff-based only | **Full codebase** + aspect-based (security, performance, architecture, antipatterns) |
| Language support | Generic | **Python, TypeScript, Dart** with techstack variants (FastAPI, Django, Next.js, Flutter) |
| Multi-agent | None | **`/ai:council`** — parallel agents discuss, debate, synthesize |
| Debugging | None | **`/ai:debug`** — hypothesis-based with Mermaid decision trees |
| Architecture | None | **`/ai:adr`** — Architecture Decision Records with diagrams |
| Feature planning | None | **`/ai:fdr`** — Feature Development Records with edge cases + risk assessment |
| Implementation | None | **`/ai:implement`** — DAG-based task plans from FDR/ADR |
| Task tracking | None | **`/ai:todo`** — Pydantic-style YAML tasks with status, tickets, evidence |
| Handoff records | None | **`/ai:cascade`** — implementation records tracing back to all documents |
| Lint/typecheck | None | **`/ai:lint`** — batch ruff + pyright + eslint + tsc on Stop hook |
| Diagrams | None | **`/ai:mermaid`** — validate and render Mermaid.js diagrams |
| Coding rules | None | **`/ai:setup --install-rules`** — auto-install rules into `.claude/rules/` |
| Cascade logging | None | **PostToolUse + UserPromptSubmit hooks** — timestamps + file:line |
| Knowledge base | None | **`/ai:knowledge`** — extract, index, search reusable knowledge + auto-suggest |
| Traceability | None | **`/ai:trace`** — verify completeness with 3 parallel sub-agents + ship/no-ship verdict |
| Project init | None | **`/ai:setup --init`** — creates project dirs + appends to CLAUDE.md |

## Commands (18)

### Review & Analysis

| Command | Description |
|---------|-------------|
| `/ai:review` | Standard or aspect-based code review |
| `/ai:review security` | Full codebase security audit |
| `/ai:review python/fastapi:performance` | FastAPI-specific performance review |
| `/ai:adversarial-review` | Challenge review that questions design choices |
| `/ai:council --roles security,performance` | Multi-agent discussion with debate |
| `/ai:debug` | Hypothesis-based debugging with Mermaid decision trees |
| `/ai:lint` | Batch lint/typecheck (ruff, pyright, eslint, tsc) |

### Planning & Documentation

| Command | Description |
|---------|-------------|
| `/ai:adr` | Architecture Decision Records with Mermaid diagrams |
| `/ai:fdr` | Feature Development Records with edge cases + risk assessment |
| `/ai:implement` | DAG-based implementation plans from FDR/ADR |
| `/ai:todo` | Task tracking with status, tickets, and traceability |
| `/ai:cascade` | Handoff records with traceability to all documents |
| `/ai:knowledge` | Extract, index, search reusable knowledge from project docs |
| `/ai:trace` | Traceability report: verify completeness across all documents |
| `/ai:mermaid` | Validate and render Mermaid.js diagrams |

### Delegation & Management

| Command | Description |
|---------|-------------|
| `/ai:rescue` | Delegate investigation or fix to Codex |
| `/ai:status` | Check job progress |
| `/ai:result` | Get finished job output |
| `/ai:cancel` | Cancel a running job |
| `/ai:setup` | Backend readiness, init project, install rules/mermaid, review gate |

## Requirements

- **Node.js 18.18 or later**
- **One or both backends:**
  - **Codex** (default): ChatGPT subscription (incl. Free) or OpenAI API key — [pricing](https://developers.openai.com/codex/pricing)
  - **Copilot**: GitHub Copilot CLI — [install guide](https://docs.github.com/copilot/how-tos/copilot-cli)

## Install

```bash
/plugin marketplace add NguyenNhan1610/ai-companion
/plugin install ai@ai-backends
/reload-plugins
/ai:setup
```

**Codex backend:** If not installed, `/ai:setup` will offer to install Codex for you (requires npm). If not authenticated, run `!codex login`.

**Copilot backend:** Run `/ai:setup --provider copilot` to check readiness. If not authenticated, run `!copilot login`. Use `--model copilot:claude-opus-4.5` to select Copilot for individual commands.

### Full Project Setup

```bash
/ai:setup --init                          # Init project dirs + CLAUDE.md
/ai:setup --install-rules fastapi,nextjs  # Install coding rules
/ai:setup --install-mermaid               # Install Mermaid CLI
```

## Project Structure

After `/ai:setup --init`:

```
.claude/project/
├── adr/                      ← /ai:adr — Architecture Decision Records
├── fdr/                      ← /ai:fdr — Feature Development Records
├── implementation_plans/     ← /ai:implement — DAG task plans
├── todos/                    ← /ai:todo — Task tracking (YAML)
├── cascades/                 ← /ai:cascade — Implementation records
├── scripts/hypothesis/       ← /ai:debug — Hypothesis test scripts + results
├── traces/                   ← /ai:trace — Traceability verification reports
├── knowledge/                ← /ai:knowledge — Patterns, lessons, decisions, antipatterns
│   ├── index.yaml            ← Master index for retrieval + trigger patterns
│   ├── patterns/             ← Reusable implementation approaches
│   ├── lessons/              ← What went wrong/right and why
│   ├── decisions/            ← ADR outcome summaries
│   └── antipatterns/         ← Project-specific bad patterns
├── guidelines/               ← Team guidelines
└── workflows/                ← Team workflows

.claude/cascades/             ← Auto-generated change log (gitignored)
.claude/rules/                ← On-demand coding rules by stack
```

## Aspect-Based Code Review

Review the full codebase through a specific lens with deep, language-specific expertise.

```bash
/ai:review security                        # Generic security audit
/ai:review python:performance              # Python performance review
/ai:review python/fastapi:security         # FastAPI-specific security
/ai:review typescript/nextjs:performance   # Next.js App Router performance
/ai:review dart/flutter:architecture       # Flutter architecture review
/ai:review --base main                     # Diff-based review (no aspect)
```

**Aspects:** `security`, `performance`, `architecture`, `antipatterns`

**28 prompt templates** across 3 languages (Python, TypeScript, Dart) and 5 techstacks (FastAPI, Django, Next.js, Flutter + generic).

## Hypothesis Debugging

Structured debugging using the scientific method.

```bash
/ai:debug The API returns 500 with special characters
/ai:debug --type performance The dashboard takes 8s to load
/ai:debug --type flaky The registration test fails randomly in CI
/ai:debug --type behavior Users see stale data after profile update
```

**Process:** Observe → Hypothesize → Test → Conclude

- Claude agents explore the codebase for evidence
- Generates 3-5 ranked hypotheses with testable predictions
- Codex agents write and run test scripts (saved to `scripts/hypothesis/`)
- Produces Mermaid decision tree with color-coded results

## Multi-Agent Council

Multiple agents analyze independently, debate findings, and synthesize.

```bash
/ai:council --roles security,performance Analyze the auth flow
/ai:council --roles attacker,defender,judge Is our rate limiting sufficient?
```

**Roles:** `security`, `performance`, `architecture`, `antipatterns`, `attacker`, `defender`, `judge` (+ custom freeform)

**Model:** Round 1 (parallel exploration) → Round 2 (debate) → Synthesis

## Architecture Decision Records

```bash
/ai:adr Should we use Redis or Memcached for caching?
/ai:adr --scope api REST vs GraphQL for the mobile API
/ai:adr --scope data Normalize orders table or use JSONB?
```

**Scopes:** `module`, `system`, `api`, `data`, `infra`

Outputs 3 Mermaid diagrams (current, proposed, comparison) + comparison table + implementation plan. Saved to `.claude/project/adr/ADR-{NN}-{slug}.md`.

## Feature Development Records

```bash
/ai:fdr Add multi-tenant session caching
/ai:fdr --scope api Add rate limiting to the public API
/ai:fdr --scope fullstack Add real-time notifications
```

**Scopes:** `backend`, `frontend`, `fullstack`, `api`, `data`

Includes: edge case tables (input, concurrency, auth, scale), risk matrix, backward compatibility, testing strategy, rollout plan with Mermaid diagrams. Saved to `.claude/project/fdr/FDR-{NN}-{slug}.md`.

## Implementation Plans

```bash
/ai:implement --from .claude/project/fdr/FDR-03-session-caching.md
/ai:implement --from .claude/project/adr/ADR-05-redis.md --method tdd
```

**Methods:** `pragmatic` (default), `tdd`, `agile`, `kanban`, `shape-up`

Produces DAG of tasks with dependencies, critical path, parallel tracks. Saved to `.claude/project/implementation_plans/IMPL-{NN}-{slug}.md`.

## Task Tracking

```bash
/ai:todo                              # Kanban board view
/ai:todo --from IMPL-03               # Generate from IMPL plan
/ai:todo update T06 --status complete # Update status
/ai:todo update T06 --ticket JIRA-125 # Link ticket
/ai:todo --sync                       # Auto-sync from cascade
```

Pydantic-style YAML schema: status, priority, track, assignee, ticket, evidence (file:line), references (IMPL/FDR/ADR), tests, dependencies. Saved to `.claude/project/todos/TODO-{NN}-{slug}.yaml`.

## Handoff Records

```bash
/ai:cascade                                # Analyze all cascade changes
/ai:cascade Add session caching feature    # With context label
/ai:cascade --since 2h                     # Last 2 hours only
```

Traces implementation back to ADR/FDR/IMPL. Includes task completion status, edge case coverage, risk mitigation evidence, file:line citations. Saved to `.claude/project/cascades/REC-{NN}-{slug}.md`.

## Knowledge Base

Extract reusable knowledge from project experience and retrieve it when starting new work.

```bash
/ai:knowledge extract                       # Scan all docs, extract knowledge
/ai:knowledge extract --from FDR-03         # From specific document
/ai:knowledge search django performance     # Keyword search
/ai:knowledge search --tag python,security  # Filter by tags
/ai:knowledge suggest                       # What's relevant for current task?
/ai:knowledge list                          # All entries
```

**Types:** `pattern` (reusable code), `lesson` (what went wrong/right), `decision` (ADR outcome), `antipattern` (bad pattern discovered)

**Auto-suggestion (Phase 2):** FDR, ADR, IMPL, and debug agents automatically check the knowledge index and surface relevant past experience before starting analysis.

## Traceability Reports

Verify feature completeness by tracing decisions through plans, code, tests, and knowledge.

```bash
/ai:trace FDR-03                    # Trace feature from plan to code
/ai:trace ADR-05                    # Trace decision downstream
/ai:trace --verify FDR-03           # Ship/no-ship verdict
/ai:trace --query "Is session caching fully implemented?"
```

Uses 3 parallel sub-agents for fast evidence collection. Checks: document chain, edge case coverage, risk mitigation, task completion, test coverage, knowledge applied. Produces gap analysis with severity classification and overall coverage percentage. Saved to `.claude/project/traces/TRACE-{NN}-{slug}.md`.

## Lint & Typecheck

```bash
/ai:lint                  # Lint files from cascade
/ai:lint --all            # Lint entire project
/ai:lint --fix            # Auto-fix safe issues
```

**Automatic Stop hook** — blocks Claude from stopping if lint errors found in changed files.

**Tools:** ruff + pyright (Python), eslint + tsc (TypeScript). Production configs bundled.

## Cascade Change Tracking

PostToolUse + UserPromptSubmit hooks auto-log every change with timestamps and line locations:

```markdown
# Cascade: main

## [09:20:15] User: Add multi-tenant session caching

- [09:20:30] CREATE `services/cache_service.py`
- [09:20:45] EDIT `api/views/users.py` L45-67
- [09:21:02] EDIT `config/settings.py` L12

## [09:25:00] User: Fix the failing test

- [09:25:10] EDIT `services/cache_service.py` L23-25
```

## Mermaid Diagrams

```bash
/ai:mermaid validate graph TD; A-->B; B-->C
/ai:mermaid render graph TD; A[Start]-->B{Decision}; B-->|Yes|C[End]
/ai:mermaid render --format png -o docs/arch.png graph TD; A-->B
/ai:setup --install-mermaid               # Install mmdc if needed
```

## Coding Rules

```bash
/ai:setup --install-rules fastapi,nextjs
```

17 production-level rule files covering security, performance, architecture, antipatterns for Python/FastAPI/Django and TypeScript/Next.js. Load on-demand when Claude reads matching files.

## Setup & Configuration

### Supported Backends

| Feature | Codex (Default) | Copilot |
|---------|-----------------|---------|
| Type | Persistent app server | Stateless CLI |
| Native reviews | Yes | No (task-based) |
| Auth | `~/.codex/config.toml` | GitHub Copilot CLI |
| Models | gpt-5.4, gpt-5.4-mini | Via Copilot CLI |

### Codex Configuration

```toml
# ~/.codex/config.toml or .codex/config.toml
model = "gpt-5.4-mini"
model_reasoning_effort = "xhigh"
```

### Review Gate

```bash
/ai:setup --enable-review-gate    # Codex reviews Claude's work before stop
/ai:setup --disable-review-gate
```

> **Warning:** Can create long-running loops and drain usage limits.

## FAQ

### Do I need a separate Codex account?

If you're already signed into Codex, it works immediately. Run `/ai:setup` to check, `!codex login` to authenticate.

### Can I use Copilot instead of Codex?

Yes. Use `--model copilot:model-name` on any command, or `/ai:setup --provider copilot`.

### Does the plugin modify my code?

Reviews, council, debug, ADR, FDR are **read-only**. Only `/ai:rescue` can make changes. `/ai:lint --fix` auto-fixes safe issues.

### Can I resume work in Codex?

Yes. `/ai:result` includes the Codex session ID. Run `codex resume <session-id>`.

### What's the difference from the original?

This fork adds 18 commands (vs 7), aspect-based reviews (28 templates, 3 languages, 5 techstacks), multi-agent council, hypothesis debugging, ADR/FDR/IMPL/TODO document flow, knowledge extraction with auto-suggestion, cascade tracking with timestamps, batch lint on Stop, Mermaid rendering, and coding rules. The original only supports diff-based reviews.

## License

Apache 2.0
