---
paths:
  - "**/app/**"
  - "**/pages/**"
  - "**/actions/**"
  - "**/*.tsx"
  - "**/components/**"
---

# Next.js Performance Rules

## DO
- Push `'use client'` to the smallest possible component, not entire pages
- Use `next/dynamic` with `{ ssr: false }` for client-only components (modals, charts, editors)
- Always use `<Image>` from `next/image` with `width`, `height`, `sizes`, and `priority` props
- Use ISR with `revalidate` for semi-static content; `generateStaticParams` for known-at-build routes
- Use `Promise.all()` for independent data fetches in server components
- Wrap slow components in `<Suspense>` to enable streaming (don't block entire page)
- Set explicit fetch cache config: `fetch(url, { next: { revalidate: 3600, tags: ["posts"] } })`
- Use subpath imports: `import groupBy from "lodash/groupBy"` not `import { groupBy } from "lodash"`
- Use `cache()` from React for request-scoped DB calls shared across server components
- Use `generateStaticParams()` for known routes to enable ISR/static generation
- Use route segment config (`export const dynamic`, `export const revalidate`) for explicit caching

## DON'T
- Never use `<img>` tag -- always `<Image>` from `next/image`
- Never set `export const dynamic = "force-dynamic"` without a reason
- Never fetch data sequentially in nested layouts (layout awaits -> page awaits -> component awaits)
- Never import entire libraries in client components (kills bundle size)
- Never skip `sizes` prop on responsive images (defeats optimization)

## ANTIPATTERNS
- `'use client'` on page.tsx when only a button needs interactivity -- extract interactive part
- Layout fetches data, then page fetches, then component fetches (serial waterfall)
- `<img src={url} />` without next/image -- no optimization, no lazy loading
- `import _ from "lodash"` in client component -- entire library in bundle
- Missing `<Suspense>` on slow data-fetching component -- blocks page render
- `fetch(url)` without cache config -- unclear caching behavior
