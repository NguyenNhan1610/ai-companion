
## AI Companion Project Structure

- `.project/architecture-decision-records/` — Architecture Decision Records (`ADR-{NN}-{slug}.md`)
- `.project/feature-development-records/` — Feature Development Records (`FDR-{NN}-{slug}.md`)
- `.project/test-plans/` — Test Plans with traceability matrices (`TP-{NN}-{slug}.md`)
- `.project/implementation-plans/` — DAG task plans (`IMPL-{NN}-{slug}.md`)
- `.project/handoff-records/` — Implementation records with traceability (`HANDOFF-{NN}-{slug}.md`)
- `.project/validation-reports/` — Pairwise validation reports (`VAL-{NN}-{upstream}-to-{downstream}.md`)
- `.project/traceability-reports/` — Traceability reports with coverage verification (`TRACE-{NN}-{slug}.md`)
- `.project/knowledge-entries/` — Reusable knowledge: patterns, lessons, decisions, antipatterns
- `.project/todo-lists/` — Task tracking with DAG, priority, confidence, effort (`TODO-{NN}-{slug}.yaml`)
- `.project/scripts/hypothesis/` — Hypothesis test scripts (`H{NN}_{slug}.py` + `_result.json`)
- `.claude/cascades/` — Auto-generated change log (timestamps + file:line, gitignored)
- `.claude/rules/` — On-demand coding rules by stack (install via `/ai:setup --install-rules`)

## Planning document frontmatter

Every planning doc in `.project/` (except knowledge entries) declares its relationships in strict YAML frontmatter:

```yaml
id: FDR-03                             # short-form, matches filename stem
type: feature-development-record       # full form
slug: chat-ui-copilot-experience
title: Chat UI Copilot Experience
status: draft                          # draft | active | superseded | deprecated
upstream:
  - .project/architecture-decision-records/ADR-02-session-caching.md
downstream: []                         # patched automatically when downstream docs are created
created: 2026-04-22
updated: 2026-04-22
```

Upstream / downstream are **full relative paths from the repo root**, not bare IDs. When a generator writes a new doc, it also patches each upstream's `downstream:` list. Validation is enforced by `plugins/ai/scripts/lib/planning-docs.mjs`.

## Short-form prefixes (IDs + filenames only)

| Prefix | Full type |
|---|---|
| `ADR` | `architecture-decision-record` |
| `FDR` | `feature-development-record` |
| `TP` | `test-plan` |
| `IMPL` | `implementation-plan` |
| `TODO` | `todo-list` |
| `HANDOFF` | `handoff-record` |
| `TRACE` | `traceability-report` |
| `VAL` | `validation-report` |

Document flow: ADR → FDR → TP → IMPL → TODO → code → test → lint → handoff-record → review
Pairwise validation: `/ai:validate {upstream} {downstream}` — checks coverage between any two stages
Acceptance hierarchy: AAC (ADR) → FAC (FDR) → TC (TP) → EAC (IMPL) → task acceptance_trace (TODO)
Minimum viable chain: FDR → IMPL → TODO (lite mode — no ADR, no TP)

Scope flags: `--scope {backend|frontend|fullstack|api|data}[,lite]`
- Feature scope: backend (default), frontend, fullstack, api, data
- Flow modifier: `lite` = no ADR/TP in chain (FDR → IMPL → TODO only)
- Templates load only relevant fragments per scope (core + scope-frontend + flow-lite/full)

## TODO DAG

Task tracking uses an explicit node+edge DAG:

- `tasks:` — list of task nodes with `id` (kebab `task-NN`), `title`, `status`, `priority` (P0-P3), `confidence` (0..1), `effort` (XS/S/M/L/XL), `acceptance_trace`, `evidence`.
- `dependencies:` — explicit edges with `from`, `to`, `kind` (`hard` | `soft` | `data`), required `reason:`.
- `computed:` — regenerated block with `roots`, `ready`, `critical_path`, `parallel_tracks`. Do not hand-edit.
- View the graph with `/ai:task-graph` (ASCII by default; `--format mermaid|json`; `--critical-path`; `--ready`).
