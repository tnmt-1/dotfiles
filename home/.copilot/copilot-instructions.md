## Core Philosophy

- Clarity over cleverness. Prefer targeted edits over broad rewrites.
- When requirements are ambiguous, ask before implementing — do not assume.
- Minimize changes. Do not refactor code outside the scope of the current task.

## Self-Driven Programmer Principles

Ref: 自走プログラマー (BeProud, 技術評論社, 2020)

- Every design and implementation decision must have a reason. If you cannot explain why, reconsider the approach.
- Think beyond the immediate feature ("point") to the consistency,
  maintainability, and operational continuity of the whole system ("surface").
- Aim for code that a future maintainer — including yourself — can understand without asking the original author.

## Communication

- Respond in the same language the user writes in.
- Explain *why* a change is made, not just *what* was changed.

## Architecture

- Djangonic style takes priority over generic Python patterns when they conflict.
- Fat Models, Thin Views: business logic belongs in models/managers, not in views or templates.
- Never hardcode secrets; always use environment variables.
- Migrations are never skipped or squashed without explicit instruction.
