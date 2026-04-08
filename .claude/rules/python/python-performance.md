---
paths:
  - "**/*.py"
---

# Python Performance Rules

## DO
- Use `multiprocessing.Pool` for CPU-bound work (bypasses GIL)
- Use `ThreadPoolExecutor` for I/O-bound concurrent work
- Use `httpx.AsyncClient`, `aiofiles`, `asyncio.sleep` in async contexts
- Use `"".join(parts)` for string building in loops, not `+=` concatenation
- Use generators for large datasets iterated once: `(x for x in items)` not `[x for x in items]`
- Use `set` / `dict` for membership tests: O(1) vs `list` O(n)
- Use `__slots__` on data-heavy classes to reduce memory per instance
- Stream large files line-by-line: `for line in open(f):` not `f.read()`
- Use `functools.lru_cache(maxsize=N)` for expensive pure function results
- Defer heavy imports (torch, pandas) inside functions when only used conditionally
- Use `collections.Counter`, `defaultdict`, `deque` instead of manual implementations
- Use `itertools` for efficient iteration patterns

## DON'T
- Never use `threading` for CPU-bound work (GIL serializes it)
- Never call sync I/O (`requests.get`, `open`, `time.sleep`) in `async def`
- Never use `string += piece` in a loop (O(n^2) for large strings)
- Never use `x in large_list` for repeated lookups (convert to set first)
- Never use `lru_cache` without `maxsize` on methods (memory leak via self reference)
- Never load entire large file with `.read()` when streaming suffices

## ANTIPATTERNS
- `result = ""; for item in items: result += str(item)` -- O(n^2); use `"".join()`
- `if user_id in [u.id for u in all_users]:` -- builds full list for one check; use set
- `data = open("large.csv").read().split("\n")` -- loads entire file; use csv.reader or iterate
- `@lru_cache` on instance method -- caches hold `self` reference, preventing GC
- `import pandas` at top of module used in one rare code path -- slows every import
