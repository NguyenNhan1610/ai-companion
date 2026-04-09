---
id: "{TYPE}-{NN}"              # LES-01, PAT-03, DEC-02, ANT-01
title: "{descriptive title}"
type: "{pattern|lesson|decision|antipattern}"
tags: ["{tag1}", "{tag2}", "{tag3}"]
technology: ["{python}", "{django}"]
source:
  - type: "{fdr|adr|cascade|debug|impl|code}"
    ref: "{document ID or file path}"
    section: "{specific section reference}"
confidence: "{high|medium|low}"
reuse_context: "{one sentence: when this knowledge applies}"
trigger_patterns:
  - "{keyword or regex that should surface this entry}"
  - "{another trigger}"
created: "{YYYY-MM-DD}"
updated: "{YYYY-MM-DD}"
---

## Problem

{What problem was encountered or what question needed answering.
Be specific — name the technology, the context, the symptom.}

Example:
> Dashboard endpoint in Django averaged 4.2s response time due to 47 SQL
> queries per request. Each `order.customer` and `order.items` access in
> the template triggered a separate query.

## Root Cause / Solution

{What was discovered or implemented. Include actual code with file:line.}

```python
# Before: 47 queries (N+1)
orders = Order.objects.all()

# After: 3 queries
orders = Order.objects.select_related("customer").prefetch_related(
    Prefetch("items", queryset=Item.objects.select_related("product"))
)
```

Source: `api/views/dashboard.py:89-93`

## Evidence

{Concrete evidence this knowledge is validated.}

- Source document: [FDR-03](../fdr/FDR-03-session-caching.md) Edge Case E12
- Cascade record: [REC-02](../cascades/REC-02-dashboard-fix.md) Session [09:20]
- Hypothesis test: `scripts/hypothesis/H02_n1_dashboard_result.json` — confirmed
- Performance data: P95 dropped from 4.2s to 0.8s

## When to Apply

{Specific conditions where this knowledge is relevant.
Help future retrieval by being precise about context.}

- Any Django list view iterating over related objects
- Template accessing `{{ order.customer.name }}` in a `{% for %}` loop
- DRF serializer with nested serializer without `select_related`
- Dashboard/report pages that aggregate multiple models

## When NOT to Apply

{Conditions where applying this would be wrong or wasteful.}

- Single object detail views (N=1, no N+1 problem)
- Already using `.values()` or `.values_list()` (no ORM objects loaded)
- Write-heavy operations where read optimization doesn't help
- Small datasets (<100 rows) where the overhead is negligible

## Related Knowledge

- [PAT-01](../patterns/PAT-01-redis-caching.md) — caching layer that was added after this fix
- [ANT-01](../antipatterns/ANT-01-sync-io-in-async.md) — similar performance issue in async context
