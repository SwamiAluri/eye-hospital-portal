# Agent instructions

This is an existing production-oriented Eye Hospital Management System, not a greenfield app.

1. **Domain and safety** — Follow `.cursor/rules/` (especially `00-hospital-architecture.mdc`). Those rules beat Superpowers skills on patient safety, privacy, financial integrity, ownership, and stack freeze.
2. **Methodology** — Use Superpowers skills in `.cursor/skills/` (obra/superpowers v6.3.0). Before any task, invoke the matching skill. Specs go in `docs/superpowers/specs/`. Plans go in `docs/superpowers/plans/`.
3. **Do not** replace the stack, invent a second design system, ship mock data as production, or change clinical/financial/coverage behavior without explicit approval.
