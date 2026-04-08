---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---

# TypeScript Security Rules

## DO
- Validate all external input at runtime with Zod/joi/superstruct -- type assertions provide zero runtime protection
- Validate `event.origin` and `event.source` before processing `postMessage` data
- Escape user input before `new RegExp()` to prevent ReDoS catastrophic backtracking
- Validate redirect target origins before `window.location`, `res.redirect()`, or router `.push()`
- Use httpOnly cookies for tokens, never `localStorage` or `sessionStorage`
- Sanitize header values -- don't interpolate user input into HTTP headers
- Validate URLs against an allowlist before `fetch`/`axios`/`got` with user-controlled URLs (SSRF)
- Use `Content-Security-Policy` headers to mitigate XSS

## DON'T
- Never use `Object.assign`, spread, or lodash `merge` with untrusted objects without key validation (prototype pollution)
- Never use `dangerouslySetInnerHTML` or `innerHTML` with user-supplied content (XSS)
- Never use `eval()`, `new Function()`, or `vm.runInNewContext()` with user input
- Never trust `as` type assertions as validation -- they're compile-time only
- Never store secrets in `localStorage`/`sessionStorage` (accessible to any JS on the page)
- Never use `http://` for API calls in production

## ANTIPATTERNS
- `const user = JSON.parse(input) as User` -- no runtime validation, trusts shape blindly
- `div.innerHTML = userComment` -- stored XSS
- `eval(userExpression)` -- arbitrary code execution
- `new RegExp(userInput)` without escaping -- ReDoS via `(a+)+$`
- `window.location.href = params.get("redirect")` -- open redirect to attacker site
- `localStorage.setItem("token", jwt)` -- any XSS exfiltrates the token
