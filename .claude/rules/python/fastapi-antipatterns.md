---
paths:
  - "**/fastapi/**"
  - "**/routers/**"
  - "**/api/**"
  - "**/*fastapi*"
---

# FastAPI Antipatterns

## ANTIPATTERNS

### Sync I/O in async endpoints
- `async def endpoint(): data = requests.get(url)` -- blocks event loop
- Fix: use `httpx.AsyncClient` or change to `def` (ThreadPool)

### Per-request resource creation
- Creating DB engine, HTTP client, or cache connection inside route handlers
- Fix: create at startup via lifespan, inject via `Depends()`

### Missing error handlers
- No `HTTPException` for validation failures, relying on 500 errors
- Fix: add explicit error handling with appropriate status codes

### No pagination
- `return db.query(Model).all()` on list endpoints
- Fix: always add `limit`/`offset` or cursor-based pagination

### BackgroundTasks for heavy work
- Using `BackgroundTasks` for long-running jobs (>30s)
- Fix: use Celery, ARQ, or task queue for heavy background work

### Missing lifespan management
- Using deprecated `@app.on_event("startup")` without shutdown cleanup
- Fix: use `@asynccontextmanager` lifespan with proper cleanup

### Depends caching confusion
- Auth dependencies with default `use_cache=True` returning stale user state
- Fix: `use_cache=False` for auth; `use_cache=True` only for idempotent lookups

### Pydantic v1/v2 mixing
- Using `.dict()` instead of `.model_dump()`, `@validator` instead of `@field_validator`
- Fix: use Pydantic v2 API consistently

### No response model
- Returning raw dicts or ORM models without `response_model`
- Fix: always define explicit response models with field selection
