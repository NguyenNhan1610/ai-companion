---
name: fdr
description: Generate Feature Development Decision Records with edge cases, risk assessment, impact analysis, and Mermaid diagrams. Use when user wants to plan a new feature, analyze implementation impact, assess risks before coding, create a feature spec, or asks about feature planning, risk assessment, edge case analysis, or implementation impact.
user-invocable: true
---

# Feature Development Decision Records

Plan features with deep codebase analysis, systematic edge case enumeration, risk assessment, and visual implementation roadmaps.

## Command

```bash
/ai:fdr Add multi-tenant session caching
/ai:fdr --scope api Add rate limiting to the public API
/ai:fdr --scope frontend Add real-time notifications to the dashboard
/ai:fdr --scope fullstack Add user impersonation for support agents
/ai:fdr --scope data Migrate from SQL to event sourcing for orders
```

## Scopes

| Scope | Focus |
|-------|-------|
| `backend` (default) | Server-side feature implementation |
| `frontend` | Client/UI feature |
| `fullstack` | Spans client and server |
| `api` | API endpoint or contract changes |
| `data` | Data model or storage changes |

## Process

1. **Map** — explore codebase: dependencies, API surface, test coverage, existing patterns
2. **Design** — propose implementation with affected code paths and new components
3. **Stress-test** — enumerate edge cases: input boundaries, concurrency, auth, scale, external deps
4. **Assess** — risk matrix (likelihood x impact) with concrete mitigations
5. **Plan** — implementation steps, testing strategy, rollout plan, observability

## Output

Saved to `.claude/project/fdr/FDR-{NN}-{slug}.md` with:
- Dependency graph + data flow diagrams (Mermaid SVG + raw source)
- Edge case table by category (input, concurrency, auth, external, scale)
- Risk assessment matrix with quadrant chart
- Backward compatibility analysis
- Testing strategy with priority levels
- Implementation timeline (Gantt chart)
- Rollout plan with canary metrics and rollback triggers
- Observability plan (metrics, logs, alerts, dashboards)

## Template Reference

See `references/fdr-template.md` for the complete output format with examples.
