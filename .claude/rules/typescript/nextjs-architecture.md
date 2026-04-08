---
paths:
  - "**/app/**"
  - "**/pages/**"
  - "**/actions/**"
  - "**/*.tsx"
  - "**/components/**"
---

# Next.js Architecture Rules

## DO
- Use route groups `(groupName)` for layout isolation without affecting URLs
- Server component parent fetches data, passes only needed fields to client child
- Use `@slot` directories for parallel routes (independently loading dashboard sections)
- Use layouts for persistent state (shared navigation); templates for remounting on navigation
- Use `generateMetadata()` for dynamic titles and OpenGraph; avoid static metadata on dynamic pages
- Define server actions in separate `actions.ts` files (testable, reusable), not inline
- Use `cache()` to share request-scoped data across multiple server components without duplication
- Add `error.tsx` and `loading.tsx` at appropriate route segment levels
- Co-locate data fetching with the consuming component (server components fetch their own data)
- Use `not-found.tsx` for custom 404 pages per route segment

## DON'T
- Never put data fetching logic in client components when server components can handle it
- Never use server actions for reads (defeats caching); use them for mutations only
- Never forget `revalidatePath()` or `revalidateTag()` after mutations (stale UI)
- Never nest layouts deeply without route groups -- hard to reason about which layout applies
- Never duplicate metadata fetches -- use `generateMetadata` once per route

## ANTIPATTERNS
- Entire page as client component with `useEffect + fetch` -- use server component instead
- Server action that reads and returns data -- use server component or API route for reads
- Missing `loading.tsx` -- blank page during data fetch
- Missing `error.tsx` -- unhandled error crashes entire layout
- `<Layout>` component that fetches data for all children -- let each component fetch its own
- Prop drilling full DB records across server/client boundary -- use `.select()` and composition
