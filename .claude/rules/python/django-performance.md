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

# Django Performance Rules

## DO
- Use `.select_related()` for ForeignKey/OneToOne joins (single query)
- Use `.prefetch_related()` for reverse FK and M2M relationships
- Use nested prefetch for deep relations: `Prefetch("items", queryset=Item.objects.select_related("product"))`
- Use `.count()` instead of `len(queryset)` -- avoids loading all objects
- Use `.exists()` instead of `bool(queryset)` or `if queryset:` -- stops at first row
- Use `bulk_create()` and `bulk_update()` for batch operations
- Use `.update()` and `.delete()` on querysets instead of loop-and-save
- Use `F()` expressions for atomic updates: `Model.objects.filter(pk=id).update(counter=F("counter") + 1)`
- Use `.aggregate(total=Sum("amount"))` for DB-side aggregation, not Python-side `sum()`
- Use `.iterator()` for large querysets to avoid loading all into memory
- Add `db_index=True` or `Meta.indexes` for columns used in filter/order_by/join
- Use `@cache_page(timeout)` with `@vary_on_cookie` for per-user cached views
- Use template fragment caching with vary: `{% cache 300 sidebar user.id %}`
- Put `SecurityMiddleware` first in MIDDLEWARE ordering
- Use `GZipMiddleware` before any body-reading middleware
- Use `.values()` or `.values_list()` when you only need specific columns
- Use `.only()` / `.defer()` to skip heavy columns (TextField, BinaryField)

## DON'T
- Never evaluate a queryset twice (assign to variable, don't re-query)
- Never use `len(queryset)` when you only need the count
- Never loop and `.save()` individual objects when bulk operations work
- Never aggregate in Python what the database can compute
- Never use `@cache_page` without `@vary_on_cookie` for authenticated views (serves same cache to all users)
- Never create indexes on every column -- only filter/sort/join columns

## ANTIPATTERNS
- `for item in order.items.all(): print(item.product.name)` -- N+1 on product (use select_related)
- `if MyModel.objects.filter(active=True): ...` -- loads all objects; use `.exists()`
- `for obj in qs: obj.status = "done"; obj.save()` -- N updates; use `qs.update(status="done")`
- `total = sum([o.amount for o in Order.objects.all()])` -- loads all; use `.aggregate(Sum("amount"))`
- `LocMemCache` in multi-process deployment (gunicorn) -- each process has separate cache; use Redis/Memcached
- Missing `pool_pre_ping` on database connection -- stale connections cause intermittent errors
