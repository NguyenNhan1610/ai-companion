# FDR-{NN}: {Feature Title}

**Date:** {YYYY-MM-DD}
**Status:** Proposed | In Progress | Completed | Abandoned
**Scope:** {backend|frontend|fullstack|api|data}
**Author:** {name/role}
**Related ADRs:** {ADR-XX if applicable}
**Ticket:** {link to issue/ticket if applicable}

---

## Feature Summary

{One paragraph describing what the feature does, who it's for, and why it's needed.}

## Current State

{How things work today in the area this feature touches. Reference specific code.}

### Dependency Graph

![Dependency Graph](./FDR-{NN}-{slug}-dependencies.svg)

<details>
<summary>Mermaid source</summary>

```mermaid
graph TD
    A[auth/middleware.py] --> B[auth/jwt.py]
    A --> C[auth/permissions.py]
    D[api/views/users.py] --> A
    D --> E[models/user.py]
    E --> F[db/base.py]

    style D fill:#fff3cd
    style A fill:#fff3cd
```

</details>

## Proposed Implementation

{Detailed description of how the feature works. Technical, not conceptual.}

### Data Flow

![Data Flow](./FDR-{NN}-{slug}-dataflow.svg)

<details>
<summary>Mermaid source</summary>

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant Auth
    participant DB
    participant Cache

    Client->>API: POST /api/feature
    API->>Auth: Validate token
    Auth-->>API: User context
    API->>DB: Query data
    DB-->>API: Result
    API->>Cache: Store result
    API-->>Client: 200 OK
```

</details>

### Affected Code Paths

| File | Change | Type |
|------|--------|------|
| `api/views/users.py:45-89` | Add new endpoint handler | New |
| `models/user.py:12` | Add `last_feature_use` field | Modify |
| `auth/permissions.py:30` | Add `CanUseFeature` permission | New |
| `tests/test_users.py` | Update user creation tests | Modify |
| `migrations/0042_add_feature.py` | New migration | New |

### New Components

- `api/views/feature.py` — endpoint handler with input validation
- `services/feature_service.py` — business logic layer
- `serializers/feature.py` — request/response serialization
- `tests/test_feature.py` — unit and integration tests

## Edge Cases

### Input Boundaries

| # | Scenario | What Goes Wrong | Handling | Severity |
|---|----------|----------------|----------|----------|
| E1 | Empty request body | 500 with NoneType error at `views.py:52` | Pydantic/Zod validation rejects before handler | medium |
| E2 | Name field > 255 chars | DB constraint violation, unhandled | Add `max_length=255` validation in serializer | medium |
| E3 | Unicode in name field (emoji, CJK) | Works but search index breaks on `search.py:89` | Add unicode normalization before indexing | high |
| E4 | Negative quantity value | Business logic produces negative total | Add `ge=0` constraint in request model | high |

### Concurrency

| # | Scenario | What Goes Wrong | Handling | Severity |
|---|----------|----------------|----------|----------|
| E5 | Duplicate submission (double-click) | Two records created | Idempotency key in request header, check before insert | high |
| E6 | Parallel updates to same resource | Last-write-wins, silent data loss | Add optimistic locking with version field | critical |
| E7 | Read during write (stale cache) | User sees old data after mutation | Invalidate cache key on write, add `Cache-Control: no-cache` on mutation response | medium |

### Authorization

| # | Scenario | What Goes Wrong | Handling | Severity |
|---|----------|----------------|----------|----------|
| E8 | User accesses another tenant's data | Data leak across tenants | Add tenant_id filter on every query, test with multi-tenant fixture | critical |
| E9 | Expired token during long operation | 401 mid-operation, partial state | Validate token at start AND before commit | high |

### External Dependencies

| # | Scenario | What Goes Wrong | Handling | Severity |
|---|----------|----------------|----------|----------|
| E10 | Payment API timeout (>30s) | User sees spinner forever | Set 10s timeout, return 202 + async processing | high |
| E11 | Email service returns 429 | Registration fails even though user was created | Decouple: create user first, queue email, retry | medium |

### Scale

| # | Scenario | What Goes Wrong | Handling | Severity |
|---|----------|----------------|----------|----------|
| E12 | 10x current users hit endpoint | DB connection pool exhausted | Configure pool size, add read replica for reads | high |
| E13 | Large payload (10MB file upload) | Memory spike, OOM in container | Stream processing, 5MB limit with 413 response | medium |

## Risk Assessment

### Risk Matrix

![Risk Matrix](./FDR-{NN}-{slug}-risk-matrix.svg)

<details>
<summary>Mermaid source</summary>

```mermaid
quadrantChart
    title Risk Assessment Matrix
    x-axis Low Likelihood --> High Likelihood
    y-axis Low Impact --> High Impact
    quadrant-1 Monitor
    quadrant-2 Mitigate urgently
    quadrant-3 Accept
    quadrant-4 Mitigate when possible
    Data loss on concurrent update: [0.6, 0.9]
    Tenant isolation breach: [0.3, 0.95]
    Payment timeout: [0.7, 0.7]
    Duplicate submission: [0.8, 0.5]
    Unicode search break: [0.4, 0.3]
```

</details>

### Risk Register

| # | Risk | Likelihood | Impact | Score | Mitigation | Residual Risk | Owner |
|---|------|-----------|--------|-------|------------|---------------|-------|
| R1 | Data loss on concurrent update | Possible — multiple users edit same resource | Major — silent data loss, no recovery | **High** | Optimistic locking with version field + conflict response | Low — user retries with fresh data | Backend team |
| R2 | Tenant isolation breach | Unlikely — requires missing filter | Catastrophic — data leak, compliance violation | **Critical** | Tenant filter on every query + integration test per endpoint | Very low — caught by tests | Security team |
| R3 | Payment API timeout | Likely — 3rd party, no SLA guarantee | Moderate — user cannot complete purchase | **High** | 10s timeout + async processing + retry queue | Low — user gets email confirmation later | Backend team |
| R4 | Duplicate submission | Likely — no idempotency on form | Minor — duplicate records, confusing UX | **Medium** | Idempotency key header + unique constraint | Very low — duplicates rejected at DB level | Frontend team |

### Backward Compatibility

| Area | Breaking? | Impact | Migration |
|------|-----------|--------|-----------|
| REST API | No — new endpoint, existing unchanged | None | N/A |
| Database | Yes — new column with NOT NULL | Existing rows need default | Migration with default value, backfill script |
| Client SDK | No — additive change | Older clients don't see new field | N/A |
| Cached data | Yes — cache shape changes | Stale cache returns old format | Version cache keys, invalidate on deploy |

## Testing Strategy

### New Tests Required

| Test | Type | What It Covers | Priority |
|------|------|---------------|----------|
| `test_feature_create_success` | Unit | Happy path creation | P0 |
| `test_feature_create_validation` | Unit | Input validation (E1-E4) | P0 |
| `test_feature_concurrent_update` | Integration | Optimistic locking (E6) | P0 |
| `test_feature_tenant_isolation` | Integration | Cross-tenant access denied (E8) | P0 |
| `test_feature_duplicate_submission` | Integration | Idempotency key (E5) | P1 |
| `test_feature_payment_timeout` | Integration | Timeout handling (E10) | P1 |
| `test_feature_large_payload` | Integration | Size limit (E13) | P2 |
| `test_feature_load` | Load | 10x concurrent users (E12) | P2 |

### Existing Tests Affected

| Test File | Change Needed | Reason |
|-----------|--------------|--------|
| `tests/test_users.py:34` | Update user factory | New field `last_feature_use` |
| `tests/test_api.py:120` | Add auth header | New permission check |
| `tests/conftest.py` | Add feature fixtures | Shared test data |

## Implementation Plan

### Timeline

![Implementation Timeline](./FDR-{NN}-{slug}-timeline.svg)

<details>
<summary>Mermaid source</summary>

```mermaid
gantt
    title Feature Implementation
    dateFormat YYYY-MM-DD
    axisFormat %b %d

    section Backend
    DB migration + model         :a1, 2026-04-10, 1d
    Service layer + business logic :a2, after a1, 2d
    API endpoint + serializers   :a3, after a2, 1d
    Edge case handling           :a4, after a3, 1d

    section Testing
    Unit tests                   :b1, after a3, 1d
    Integration tests            :b2, after a4, 2d
    Load testing                 :b3, after b2, 1d

    section Rollout
    Feature flag setup           :c1, after b1, 0.5d
    Staging deploy + QA          :c2, after b2, 2d
    Canary release (5%)          :c3, after c2, 2d
    Full rollout                 :c4, after c3, 1d
```

</details>

### Steps

| # | Step | Files | Depends On | Effort |
|---|------|-------|-----------|--------|
| 1 | DB migration + model update | `models/`, `migrations/` | — | 0.5d |
| 2 | Service layer with business logic | `services/feature_service.py` | Step 1 | 1d |
| 3 | API endpoint + request/response models | `api/views/`, `serializers/` | Step 2 | 1d |
| 4 | Edge case handling (validation, idempotency, locking) | Steps 2-3 files | Step 3 | 1d |
| 5 | Unit + integration tests | `tests/` | Step 4 | 2d |
| 6 | Feature flag + staging deploy | `config/`, deployment | Step 5 | 0.5d |
| 7 | QA + canary rollout | — | Step 6 | 3d |

**Total estimated effort:** ~9 days (5 dev + 2 test + 2 rollout)

### Rollout Plan

| Phase | % Users | Duration | Success Criteria | Rollback Trigger |
|-------|---------|----------|-----------------|-----------------|
| Canary | 5% | 2 days | Error rate < 0.1%, P95 < 500ms | Error rate > 1% OR P95 > 2s |
| Gradual | 25% | 2 days | Same as above | Same |
| Gradual | 50% | 1 day | Same | Same |
| Full | 100% | — | — | — |

**Feature flag:** `ENABLE_FEATURE_X=true` in environment config
**Rollback procedure:** Set `ENABLE_FEATURE_X=false`, deploy. No data migration rollback needed (new column is additive).

### Observability

| Type | What | Where |
|------|------|-------|
| **Metric** | `feature_x_requests_total` (counter) | Prometheus/Datadog |
| **Metric** | `feature_x_latency_seconds` (histogram) | Prometheus/Datadog |
| **Metric** | `feature_x_errors_total` by error type | Prometheus/Datadog |
| **Log** | `feature_x.created` with user_id, tenant_id | Structured logging |
| **Log** | `feature_x.failed` with error, context | Structured logging |
| **Alert** | Error rate > 1% for 5 minutes | PagerDuty/Slack |
| **Alert** | P95 latency > 2s for 5 minutes | PagerDuty/Slack |
| **Dashboard** | Feature X adoption, error rate, latency | Grafana/Datadog |

## References

- {Related ADR} — e.g., "ADR-05: Chose PostgreSQL as primary database"
- {Design doc} — e.g., "RFC: Multi-tenant caching strategy"
- {External docs} — e.g., "Stripe API idempotency: https://stripe.com/docs/api/idempotent_requests"
