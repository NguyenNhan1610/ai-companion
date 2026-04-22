---
name: knowledge-base
description: Extract, index, search, and suggest reusable knowledge from project documents. Use when user asks about lessons learned, past solutions, knowledge base, patterns, antipatterns, what worked before, past experience, or wants to capture/retrieve project knowledge.
user-invocable: true
---

# Knowledge Base

Extract reusable knowledge from project experience and retrieve it when starting new work.

## Commands

```bash
/ai:knowledge extract                       # Scan all project docs, extract knowledge
/ai:knowledge extract --from FDR-03         # Extract from specific document
/ai:knowledge search django performance     # Search by keywords
/ai:knowledge search --tag python,security  # Search by tags
/ai:knowledge suggest                       # Suggest for current task
/ai:knowledge list                          # List all entries
```

## Knowledge Types

| Type | What | Example |
|------|------|---------|
| Pattern | Reusable implementation with code | Redis caching with tenant isolation |
| Lesson | What went wrong/right and why | N+1 query fix dropped P95 from 4.2s to 0.8s |
| Decision | ADR outcome (did it work?) | Redis over Memcached was right because... |
| Antipattern | Project-specific bad pattern | Sync I/O in async endpoint blocked event loop |

## How It Works

**Extraction:** Scans ADR, FDR, IMPL, cascade records, hypothesis results. Identifies patterns, lessons, decisions, antipatterns. Deduplicates. Updates index.

**Retrieval:** Keyword search, tag filtering, trigger pattern matching. Ranked by relevance.

**Auto-suggestion (Phase 2):** When starting FDR/ADR/IMPL/debug, the agent checks the knowledge index and surfaces relevant past experience.

## Files

```
.project/knowledge-entries/
├── index.yaml                    ← Master index for retrieval
├── patterns/PAT-{NN}-{slug}.md
├── lessons/LES-{NN}-{slug}.md
├── decisions/DEC-{NN}-{slug}.md
└── antipatterns/ANT-{NN}-{slug}.md
```

## Schema Reference

See `references/knowledge-entry-template.md` for the full entry format.
