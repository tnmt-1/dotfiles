---
name: django
description: Django仕様時のコーディングルール
applyTo: "**/*.py"
---

## ORM

- Always use `select_related()` for ForeignKey lookups to avoid N+1
- Always use `prefetch_related()` for ManyToMany or reverse ForeignKey
- Never call `.all()` inside a loop without prefetch
- Use `get_object_or_404()` over bare `try/except ObjectDoesNotExist` in views
- Use `F()` and `Q()` objects for complex queries

## Views & URLs

- Use `reverse()` or `reverse_lazy()` — never hardcode URL paths
- Always apply `@login_required` or `LoginRequiredMixin` consistently
- Return appropriate HTTP status codes (201 for create, 204 for delete)

## Forms & Validation

- All user input must go through Django Forms or ModelForms
- Field-level validation goes in `clean_<field>()`; cross-field in `clean()`

## Security

- Always use `@require_http_methods` to restrict HTTP methods
- Never bypass the ORM with raw SQL unless explicitly instructed

