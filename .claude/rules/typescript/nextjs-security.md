---
paths:
  - "**/app/**"
  - "**/pages/**"
  - "**/actions/**"
  - "**/*.tsx"
  - "**/components/**"
---

# Next.js Security Rules

## DO
- Validate all server action input with Zod/schema at the top of the function
- Derive user identity from session/cookie, never from FormData or hidden fields
- Check ownership on every mutation: `if (session.user.id !== record.userId) throw new Error("Forbidden")`
- Add auth checks in route handlers even if middleware handles auth (defense in depth)
- Add `import 'server-only'` to modules containing secrets, DB clients, or auth logic
- Use `.select()` to expose only safe fields before serializing to client components
- Set `Secure`, `HttpOnly`, `SameSite` on cookies via `cookies().set()`
- Protect `revalidatePath`/`revalidateTag` endpoints with secret tokens
- Validate user-supplied URLs against an allowlist before `fetch()` in server actions (SSRF)

## DON'T
- Never prefix secrets with `NEXT_PUBLIC_` -- exposes to client bundle
- Never trust `formData.get("userId")` for authorization decisions
- Never serialize full database records to client components (leaks internal fields)
- Never skip auth in API route handlers assuming middleware covers it
- Never use `dangerouslySetInnerHTML` with user-supplied content
- Never store tokens in `localStorage` -- use httpOnly cookies

## ANTIPATTERNS
- `const userId = formData.get("userId")` in server action -- IDOR; derive from `auth()`
- `return NextResponse.json(dbRecord)` without field selection -- leaks internal fields
- `NEXT_PUBLIC_DATABASE_URL` in `.env` -- secret exposed to browser
- Missing `matcher` in middleware config -- auth middleware doesn't cover `/api/*` routes
- `revalidatePath("/data")` without secret verification -- cache poisoning
