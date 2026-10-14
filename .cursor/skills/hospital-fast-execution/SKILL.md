---
name: hospital-fast-execution
description: Execute bounded Hospital Portal changes quickly with narrow context, reuse-first implementation, Counsellor-quality UI benchmarking, and proportional verification; use for FAST tasks.
---

# Hospital Fast Execution

## Objective

Finish bounded work as quickly as correctness allows. The agent should spend time coding and validating, not rediscovering the whole repository.

## Context budget

Read only:
1. The applicable `.cursor/rules/*.mdc` files.
2. The target route/component/service.
3. Directly referenced domain components/hooks/API module.
4. One representative existing implementation that solves a similar problem.
5. One relevant test when available.

Do not inspect repository-wide `src/app`, `AuthService`, migrations, EF snapshots, `*.Designer.cs`, generated/archive folders, or unrelated domains unless evidence requires it.

## UI execution

For every new or changed staff UI:
- Use the Counsellor module as the **quality benchmark**.
- Inspect the smallest relevant Counsellor screen/component to understand its current polish and interaction patterns.
- Match hierarchy, density, spacing, controls, state handling, modal/sheet behavior, feedback, accessibility, and finish.
- Reuse the target domain's existing visual system and business semantics; do not copy counselling-specific domain logic or styling blindly.
- Prefer existing shadcn/Radix/Lucide/domain-kit components.

## Implementation

- Preserve current routes and architecture.
- Reuse existing API/client/query/store/permission patterns.
- Keep changes localized.
- Do not perform unrelated cleanup.
- Do not invent mock production data.
- Do not add a library to solve a problem already solved in the repo.

## Verification

Select the smallest evidence that proves the change:
- type/lint for code-level changes
- focused unit test when logic changed
- browser workflow for meaningful UI behavior/layout
- expanded regression suite when shared components, APIs, permissions, realtime, clinical, financial, or cross-module behavior changed

If a check fails because of the change, fix it before completion. Do not fix unrelated pre-existing failures unless necessary to establish the changed behavior.

## Completion

Report only:
- changed files
- behavior implemented
- verification performed and evidence
- remaining limitation, if any

Then stop.
