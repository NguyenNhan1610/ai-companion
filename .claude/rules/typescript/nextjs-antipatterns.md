---
paths:
  - "**/app/**"
  - "**/pages/**"
  - "**/actions/**"
  - "**/*.tsx"
  - "**/components/**"
---

# Next.js Antipatterns

## ANTIPATTERNS

### 'use client' overuse
- Entire page marked `'use client'` when only a small button/form needs interactivity
- Fix: extract interactive elements into small client components; keep page as server component

### Waterfall fetches
- Layout awaits data, then page awaits, then component awaits -- serial chain
- Fix: use `Promise.all()` for independent fetches; leverage parallel data loading

### Missing Suspense boundaries
- Slow component without `<Suspense>` wrapper blocks entire page streaming
- Fix: wrap async components in `<Suspense fallback={<Loading />}>`

### Barrel imports in client components
- `import { Button } from "@/components"` pulls server-only code or heavy libraries into client bundle
- Fix: import directly from component file; use `export type` for types

### Client-side data fetching for server-available data
- `useEffect(() => { fetch("/api/data") })` for data known at request time
- Fix: use server component with direct DB/API access

### Missing loading.tsx / error.tsx
- No loading state during navigation; unhandled errors crash entire layout
- Fix: add `loading.tsx` and `error.tsx` at each meaningful route segment

### Prop drilling across server/client boundary
- Passing full DB records as props to client components
- Fix: select only needed fields; use composition pattern

### Server actions for reads
- Using server actions to fetch data (defeats caching, slower than server components)
- Fix: server actions for mutations only; server components or API routes for reads

### No revalidation after mutations
- Server action mutates data but doesn't call `revalidatePath()` or `revalidateTag()`
- Fix: always revalidate affected paths/tags after mutations

### Metadata anti-patterns
- Missing metadata on public pages; static titles on dynamic pages; fetching data twice for metadata
- Fix: use `generateMetadata()` with shared `cache()` calls
