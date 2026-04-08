---
paths:
  - "**/*.py"
---

# Python Architecture Rules

## DO
- Keep `__init__.py` small with public re-exports via `__all__`
- Use `Protocol` for structural typing ("has these methods") over `ABC` (inheritance-based)
- Use `TypedDict` for API boundaries, `dataclass` for internal objects, `Pydantic` for external input validation
- Use constructor dependency injection: accept dependencies as parameters
- Use `frozen=True` on dataclasses for value objects (immutable)
- Keep domain logic free of infrastructure imports (DB, HTTP, filesystem)
- Centralize configuration with environment-based overrides
- Extract shared types to a separate module to break circular imports
- Use `src/` layout for packages to avoid import confusion
- Delegate to testable `main()` function, avoid `if __name__ == "__main__"` logic

## DON'T
- Never put business logic in `__init__.py`
- Never create circular imports between modules (A imports B imports A)
- Never use module-level singletons for dependencies (hard to test)
- Never let domain layer import from infrastructure layer (dependency arrow points inward)
- Never mix concerns in a single module (DB access + business logic + HTTP handling)
- Never use `NamedTuple` for mutable data (use `dataclass` instead)

## ANTIPATTERNS
- `__init__.py` with 500+ lines of implementation -- should be re-exports only
- `from app.models import User` in domain logic -- domain depends on infrastructure
- `db = Database()` at module level -- untestable singleton; inject via constructor
- Circular import fixed with `import inside function` -- extract shared types instead
- God module with 20+ public functions -- split by responsibility
- `class Config: DEBUG = True; DB_URL = "..."` scattered across modules -- centralize with env overrides
