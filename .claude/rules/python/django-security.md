---
paths:
  - "**/django/**"
  - "**/views/**"
  - "**/models/**"
  - "**/admin/**"
  - "**/templates/**"
  - "**/settings/**"
  - "**/settings.py"
---

# Django Security Rules

## DO
- Enable `CsrfViewMiddleware` in MIDDLEWARE for all form-handling views
- Use parameterized raw SQL: `Model.objects.raw("SELECT ... WHERE id=%s", [user_id])`
- Whitelist allowed filter keys before `Model.objects.filter(**user_dict)` to prevent relationship traversal
- Use `|json_script` filter for passing data to JavaScript in templates
- Store `SECRET_KEY` in environment variables, never in committed settings
- Set `DEBUG = False`, `ALLOWED_HOSTS = ["specific.domain.com"]` in production
- Set `SESSION_COOKIE_SECURE=True`, `SESSION_COOKIE_HTTPONLY=True`, `CSRF_COOKIE_SECURE=True`
- Change default `/admin/` URL to a non-guessable path
- Require 2FA for admin access; audit superuser grants
- Use `FileExtensionValidator` + file size limits for uploads
- Serve uploaded files from a separate domain or with `Content-Disposition: attachment`
- Use `get_user_model()` not direct `User` import

## DON'T
- Never use `@csrf_exempt` except for webhook endpoints with signature verification
- Never use f-strings or %-formatting in `.raw()`, `.extra()`, or `RawSQL()`
- Never use `mark_safe()` with user-supplied content
- Never disable `{% autoescape %}` blocks for user content
- Never commit `SECRET_KEY` or set `DEBUG=True` in production settings
- Never set `ALLOWED_HOSTS = ['*']` in production
- Never grant superuser via `is_superuser=True` without explicit approval flow
- Never trust `Content-Type` header for uploaded files (verify actual content)

## ANTIPATTERNS
- `Model.objects.filter(**request.GET.dict())` -- allows `user__password__startswith` traversal
- `mark_safe(f"<div>{user_input}</div>")` -- XSS via unsanitized user content
- `Model.objects.extra(where=[f"id={user_id}"])` -- SQL injection
- `SessionAuthentication` without CSRF middleware -- session auth requires CSRF protection
- Storing secrets in `settings.py` committed to git -- use environment variables or vault
- Default `/admin/` URL -- easy target for brute force attacks
