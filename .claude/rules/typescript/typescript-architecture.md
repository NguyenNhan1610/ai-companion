---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---

# TypeScript Architecture Rules

## DO
- Export public API from barrel `index.ts` per feature; don't import implementation details across features
- Use `export type` for type-only re-exports to prevent tree-shaking issues
- Always use `import type { ... }` when importing only types
- Use `interface` for API contracts (extendable, declaration merging); `type` for unions/intersections
- Inject abstractions (interfaces/protocols) as dependencies, not concrete implementations
- Use discriminated unions with `kind`/`type` field for exhaustive switch checks
- Use branded types for domain values: `type UserId = string & { readonly __brand: "UserId" }`
- Keep domain/core logic free of infrastructure imports (DB, HTTP, filesystem)
- Use proper `package.json` `exports` field in monorepos; don't import from `src/` of other packages
- Centralize shared domain types in a dedicated package

## DON'T
- Never import from another feature's internal files (bypass its barrel export)
- Never export heavy dependencies from barrel files (forces them into every consumer's bundle)
- Never use `interface` for computed property types or unions (use `type`)
- Never hard-code `new ConcreteService()` in business logic -- inject via constructor/parameter
- Never let domain layer import from infrastructure layer

## ANTIPATTERNS
- `import { helperFn } from "../auth/internal/utils"` -- crosses feature boundary; use public API
- `export { everything } from "./heavy-module"` in barrel -- pulls heavy deps into all consumers
- `import { UserService } from "./user-service"` (imports value) when only type needed -- use `import type`
- `class OrderService { db = new Database() }` -- untestable; inject `Database` interface
- Shared types duplicated across packages instead of extracted to shared package
- `enum Direction { Up, Down, Left, Right }` -- use `type Direction = "up" | "down" | "left" | "right"`
