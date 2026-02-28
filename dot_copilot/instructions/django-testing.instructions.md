---
name: django-testing
description: Djangoを利用時のテストルール
applyTo: "**/tests/**/*.py"
---

- Use `factory_boy` for test data — avoid fixtures
- Test edge cases and error paths, not just happy paths
- Use `pytest.mark.django_db` for any test requiring database access
- Comments in tests should describe intent, not repeat the assertion
