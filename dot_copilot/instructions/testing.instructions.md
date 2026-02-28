---
name: Testing Philosophy
description: >
  Unit testing principles based on Classical School (Vladimir Khorikov,
  "Unit Testing: Principles, Practices, and Patterns") and AAA pattern
  from 自走プログラマー (BeProud). Applied to all test files.
applyTo: "**/tests/**/*.py"
---

## Philosophy: Classical School

Ref: "Unit Testing: Principles, Practices, and Patterns" — Vladimir Khorikov

- A "unit" is a **unit of behavior**, not a unit of class.
  One test may exercise multiple collaborating classes if they share a single goal.
- Isolation means **test cases must not affect each other** —
  not that every dependency must be replaced with a mock.
- Use real objects for in-process dependencies (models, services, repositories).
  Mock only **shared mutable dependencies** that are external and uncontrollable
  (e.g., third-party APIs, email/SMS providers).
- Verify **outcomes and state**, not implementation details.
  Tests that assert on internal calls are brittle and should be avoided.
- A good unit test has four properties:
  protection against regressions, resistance to refactoring,
  fast feedback, and maintainability — the first two take priority.

## Structure: AAA Pattern

Ref: 自走プログラマー (BeProud, 技術評論社, 2020)

- Every test must follow Arrange / Act / Assert — in that order, no exceptions.
- One Act per test. If multiple acts are needed, split into separate tests.
- Do not mix Arrange logic into Assert; keep each phase clearly separated.
- Avoid multiple Arrange-Act-Assert cycles in a single test method.

## Rules

- Name tests as: `test_<what>_<condition>_<expected>`
  e.g. `test_login_with_expired_token_returns_401`
- Use `factory_boy` for test data — avoid fixtures and hardcoded values.
- Use `pytest.mark.django_db` for any test requiring database access.
- Test edge cases and error paths, not just happy paths.
- Do not assert on more than one behavior per test.

