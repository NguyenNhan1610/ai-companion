# Utility Commands

## `/ai:mermaid` — Diagram Validation

```bash
/ai:mermaid validate graph TD; A-->B; B-->C
```

Inline content — no file needed. Only validation is supported; rendering to SVG/PNG was removed. Requires mmdc (`/ai:setup --install-mermaid`).

## `/ai:knowledge` — Knowledge Base

```bash
/ai:knowledge extract                       # Scan all docs, extract knowledge
/ai:knowledge extract --from FDR-03         # Extract from specific document
/ai:knowledge search django performance     # Search by keywords
/ai:knowledge search --tag python,security  # Filter by tags
/ai:knowledge suggest                       # Suggest for current context
/ai:knowledge list                          # List all entries
```

Types: patterns, lessons, decisions, antipatterns. Auto-suggested when starting FDR/ADR/IMPL/debug. Saved to `.claude/project/knowledge-entries/`.

## `/ai:cascade` — Implementation Record

```bash
/ai:cascade                                # All changes in current cascade
/ai:cascade Add session caching feature    # With context label
/ai:cascade --since 2h                     # Last 2 hours only
```

Outputs: Traceability table, task completion, edge case/risk coverage, session timeline, file:line citations. Saved to `.claude/project/handoff-records/`.

## `/ai:lint` — Lint & Typecheck

```bash
/ai:lint                                   # Check recently changed files
/ai:lint --fix                             # Auto-fix where possible
```

## Job Management

```bash
/ai:status                    # All running and recent jobs
/ai:status job-id             # Specific job details
/ai:status job-id --wait      # Poll until completion
/ai:result                    # Latest finished job output
/ai:result job-id             # Specific job output
/ai:cancel job-id             # Cancel active job
```

## Setup & Configuration

```bash
/ai:setup --init                       # Init project dirs + append to CLAUDE.md
/ai:setup                              # Check backend readiness
/ai:setup --install-rules fastapi      # Install FastAPI + Python rules
/ai:setup --install-rules nextjs       # Install Next.js + TypeScript rules
/ai:setup --install-rules fastapi,nextjs # Both stacks
/ai:setup --install-mermaid            # Install Mermaid CLI (mmdc)
/ai:setup --enable-review-gate         # Enable stop-time review gate
/ai:setup --disable-review-gate        # Disable review gate
```

Available rule stacks: `python`, `fastapi`, `django`, `typescript`, `nextjs`

## Set Up New Project
```bash
/ai:setup
/ai:setup --install-rules fastapi,nextjs
/ai:setup --install-mermaid
```
