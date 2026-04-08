---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---

# TypeScript Antipatterns

## ANTIPATTERNS

### `any` abuse
- Using `any` to silence type errors instead of fixing the type
- Fix: use `unknown` with type narrowing, or define proper types

### Unsafe double cast
- `value as unknown as TargetType` -- bypasses type safety entirely
- Fix: use runtime validation (Zod) to verify the shape at runtime

### Non-exhaustive switch
- Switch on union type without handling all variants; no `default: never` check
- Fix: add `default: { const _exhaustive: never = value; throw new Error(...) }`

### Unhandled promise rejections
- Calling async functions without `await` or `.catch()`
- Fix: always `await` or attach `.catch()` handler; never fire-and-forget

### Unnecessary Promise wrapping
- `new Promise(async (resolve) => { resolve(await fn()) })` -- wraps existing promise
- Fix: just `return fn()` directly

### Ambient module catch-all
- `declare module '*'` -- silences all import errors across the project
- Fix: write proper type definitions or use @types packages

### Numeric enums
- `enum Status { Active, Inactive }` -- fragile to reordering, opaque values
- Fix: use string literal unions: `type Status = "active" | "inactive"` or `as const` objects

### Throwing plain strings
- `throw "something went wrong"` -- no stack trace, no instanceof check
- Fix: `throw new Error("something went wrong")` or custom Error subclass

### Untyped catch
- `catch(e) { console.log(e.message) }` -- `e` is `unknown` in TS 4.4+
- Fix: `catch(e) { if (e instanceof Error) console.log(e.message) }`

### Fire-and-forget promises
- `deleteOldRecords()` without await in a handler -- silent failures, race conditions
- Fix: `await deleteOldRecords()` or explicitly handle with `.catch(logError)`
