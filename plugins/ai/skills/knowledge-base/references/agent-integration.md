# Knowledge Base Integration for Agents

Add this step to Phase 1 of any planning/analysis agent (FDR, ADR, IMPL, debug).

## Knowledge Consultation Step

Before starting analysis, check the knowledge base for relevant past experience:

1. Check if `.claude/project/knowledge/index.yaml` exists
2. If yes, read it and match the current task against `trigger_patterns`
3. For each match, read the full entry and extract:
   - What solution worked before
   - What pitfalls to avoid
   - What edge cases were discovered
4. Include relevant knowledge in the analysis:
   - "Past experience [LES-01]: N+1 queries are common in Django list views. Apply select_related."
   - "Past antipattern [ANT-02]: Missing idempotency caused duplicate records. Add idempotency key."
5. If no index exists or no matches, skip silently

## Integration Format

In the output document, add a section:

```markdown
## Relevant Past Knowledge

| Entry | Type | Relevance |
|-------|------|-----------|
| [LES-01](../knowledge/lessons/LES-01-n+1-query-fix.md) | Lesson | N+1 pattern applies to the list endpoint in this feature |
| [ANT-02](../knowledge/antipatterns/ANT-02-missing-idempotency.md) | Antipattern | This feature has concurrent mutation — needs idempotency |
```
