---
paths:
  - "**/fastapi/**"
  - "**/routers/**"
  - "**/api/**"
  - "**/*fastapi*"
---

# FastAPI Security Rules

## DO
- Add `Depends()` enforcing authentication on every `@app.post`, `@app.put`, `@app.patch`, `@app.delete`
- Set `use_cache=False` on auth dependencies to prevent cached revoked tokens
- Use `Security(oauth2_scheme, scopes=["required_scope"])` for OAuth2 scope enforcement
- Use `extra="forbid"` on Pydantic request models to prevent mass-assignment
- Always specify `response_model` with explicit field selection to prevent internal field leakage
- Pin JWT to a single algorithm; validate signature, expiry, audience, and issuer
- Implement token revocation checks or use short expiry + refresh token pattern
- Pass references (IDs) to BackgroundTasks, not raw secrets or credentials
- Validate `allow_origins` is a specific list when `allow_credentials=True`
- Order middleware so auth runs before data processing (reverse-addition order in FastAPI)

## DON'T
- Never use `allow_origins=["*"]` with `allow_credentials=True` in CORSMiddleware
- Never trust user-submitted IDs for ownership -- derive from authenticated session
- Never accept multiple JWT algorithms (algorithm confusion attack)
- Never return full ORM models as responses without explicit field selection
- Never pass raw API keys or tokens as BackgroundTask arguments (serialization risk)

## ANTIPATTERNS
- `Depends(get_current_user)` with default `use_cache=True` -- revoked tokens still accepted within same request
- `class CreateUser(BaseModel): role: str` without `extra="forbid"` -- attacker can set `is_admin=True`
- `return user` (ORM model) instead of `return UserResponse.model_validate(user)` -- leaks password hash
- Missing auth on GET endpoints that return sensitive data -- "read-only" doesn't mean "public"
- `@app.on_event("startup")` without corresponding shutdown cleanup -- use lifespan context manager
