---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---

# TypeScript Performance Rules

## DO
- Use `Promise.all()` for independent async operations, not sequential `await`
- Use `useMemo()` for expensive computations and objects passed as props
- Use `useCallback()` for functions passed as props to child components
- Clean up event listeners, timers, and subscriptions in `useEffect` return function
- Use `AbortController` for fetch cancellation on component unmount
- Use subpath imports: `import groupBy from "lodash/groupBy"` not `import { groupBy } from "lodash"`
- Use `Map`/`Set` for repeated lookups: O(1) vs `Array.find`/`includes` O(n)
- Use dynamic `import()` for heavy libraries loaded conditionally (charts, PDF, markdown)
- Use `requestAnimationFrame` for visual updates, not `setTimeout`

## DON'T
- Never use `fs.readFileSync()` or heavy `JSON.stringify()` in request handlers
- Never skip `useEffect` cleanup -- causes memory leaks from listeners, timers, subscriptions
- Never import entire libraries in client bundles (`import _ from "lodash"`)
- Never use sequential `await` for independent operations (doubles latency)
- Never retain DOM node references in closures (detached DOM memory leak)

## ANTIPATTERNS
- `const a = await fetchA(); const b = await fetchB();` -- sequential; use `Promise.all([fetchA(), fetchB()])`
- `useEffect(() => { window.addEventListener("resize", handler) })` -- missing cleanup
- `import moment from "moment"` in client component -- 300KB+ in bundle; use `date-fns` or `dayjs`
- `items.filter(i => ids.includes(i.id))` in a loop -- O(n*m); convert `ids` to `Set` first
- `<Component config={{ key: "value" }} />` -- new object every render; extract or useMemo
