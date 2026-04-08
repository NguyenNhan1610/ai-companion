---
paths:
  - "**/fastapi/**"
  - "**/routers/**"
  - "**/api/**"
  - "**/*fastapi*"
---

# FastAPI Performance Rules

## DO
- Use `async def` for I/O-bound endpoints (DB, HTTP, file); use `def` for sync I/O (runs in ThreadPool automatically)
- Create database engine/pool once at startup via lifespan, inject via `Depends()`
- Use `create_async_engine` + `AsyncSession` for async SQLAlchemy
- Set `expire_on_commit=False` on async sessions to avoid lazy-load exceptions
- Use `selectinload()` / `joinedload()` for eager relationship loading
- Create a single `httpx.AsyncClient` at startup, inject via dependency -- not per-request
- Use `ORJSONResponse` instead of default `JSONResponse` (5-10x faster serialization)
- Use `StreamingResponse` with generators for large payloads instead of loading entire dataset
- Always paginate unbounded query results with limit/offset or cursor
- Use lifespan events for startup/shutdown of connection pools, clients, caches
- Configure pool: `pool_size`, `max_overflow`, `pool_pre_ping=True`, `pool_recycle`

## DON'T
- Never call `requests.get()`, `open()`, `time.sleep()` inside `async def` -- blocks the event loop
- Never create a new DB engine or HTTP client per request
- Never return unbounded query results without pagination
- Never use lazy loading with async SQLAlchemy (raises `MissingGreenlet`)
- Never chain more than 3-4 deep `Depends()` -- flatten or parallelize

## ANTIPATTERNS
- `async def get_data(): requests.get(url)` -- sync HTTP in async blocks event loop; use `httpx.AsyncClient`
- `async def upload(): open(path).read()` -- sync file I/O; use `aiofiles`
- `engine = create_engine(url)` inside route handler -- new pool per request
- `session.query(Order).all()` without limit -- unbounded result set
- Deep dependency chains `A->B->C->D->E` -- each awaited serially; parallelize independent deps
