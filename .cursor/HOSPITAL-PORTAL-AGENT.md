# Hospital Portal Agent Index

## Goal
Execute Hospital Portal work as fast as correctness allows while preserving the existing architecture, safety rules, and full available skill set.

## Start here
1. `.cursor/rules/00-hospital-architecture.mdc`
2. `.cursor/rules/02-healthcare-ux.mdc`
3. `.cursor/skills/hospital-task-routing/SKILL.md`
4. For FAST work: `.cursor/skills/hospital-fast-execution/SKILL.md`
5. For staff UI work: `.cursor/skills/hospital-counsellor-reference/SKILL.md`
6. Then load only domain-specific rules/skills that actually apply.

## Canonical UI benchmark
The existing Counsellor/Counselling module is the Hospital Portal reference for staff UI quality. For every new or changed staff UI, inspect one closest existing Counsellor implementation and use it as the quality benchmark. Do not copy counselling business logic or domain semantics.

Primary reference path: `apps/hospital-portal-web/src/components/counsellors-desk`.

## Execution lanes
- FAST: localized existing behavior → targeted inspect → implement → targeted verify → stop.
- CONTROLLED: multi-file/domain feature → short plan → implement → focused verification.
- HEAVY: architecture/schema/API contracts/cross-domain/clinical/financial/security/destructive → full Superpowers workflow + required approval.

## Context discipline
Do not load whole `src/app`, whole AuthService, migrations, EF snapshots, `*.Designer.cs`, generated/archive folders, or known giant files unless directly required.

## Skill policy
All existing Skills remain available. Use every skill that is genuinely applicable, but do not invoke overlapping or heavyweight workflows solely because they exist. Correctness/safety rules always win over speed.
