---
paths:
  - "**/*.py"
---

# Python Antipatterns

## ANTIPATTERNS

### Mutable default arguments
- `def f(items=[])` -- shared across calls, causes subtle bugs
- Fix: `def f(items=None): items = items or []`

### Bare except
- `except:` catches SystemExit, KeyboardInterrupt, GeneratorExit
- Fix: `except Exception:` at minimum; prefer specific exceptions

### Global mutable state
- Module-level mutable dicts/lists modified at runtime
- Fix: pass values as parameters, use classes, or use thread-local storage

### type: ignore without error code
- `# type: ignore` silences all type errors on the line
- Fix: `# type: ignore[assignment]` -- specific error code, or fix the type

### Wildcard imports
- `from module import *` pollutes namespace, hides dependencies
- Fix: explicit imports; use `__all__` in `__init__.py` for re-exports only

### Manual resource management
- `f = open(path); data = f.read(); f.close()` -- leaked on exception
- Fix: `with open(path) as f: data = f.read()`

### Reinventing stdlib
- Manual counting instead of `collections.Counter`
- Manual path joining instead of `pathlib.Path`
- Manual caching instead of `functools.lru_cache`
- Manual iteration patterns instead of `itertools`
- Fix: learn and use the standard library

### Assert for runtime validation
- `assert user.is_admin, "Not admin"` -- stripped with `python -O`
- Fix: `if not user.is_admin: raise PermissionError("Not admin")`

### String-based type checking
- `if type(obj).__name__ == "MyClass":` -- fragile, breaks with inheritance
- Fix: `if isinstance(obj, MyClass):`

### Property with side effects
- Properties that trigger I/O, DB calls, or state changes
- Fix: use explicit methods for operations with side effects

### Boolean trap
- `def process(data, True, False, True)` -- unclear at call site
- Fix: use keyword arguments or enums for flags
