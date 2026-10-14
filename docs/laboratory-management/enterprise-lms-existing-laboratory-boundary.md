# Enterprise LMS ↔ Existing Laboratory Boundary

**Date:** 2026-10-08  
**Decision:** Variant B+  
**Status:** AUTHORITATIVE FOR L0

## Separation

| Workspace | Route namespace | Permission (L0) | Status |
|---|---|---|---|
| Existing Pathology Laboratory | `/dashboard/laboratory` | `laboratory.view` | Preserved intact (L1–L3 implementation track) |
| Enterprise Laboratory Management (LMS) | `/dashboard/lms` | `lms.view` | New PRD-driven workspace (L0 foundation) |

These workspaces are **intentionally isolated**. L0 does not migrate, redirect, rename, or rewrite the existing Laboratory module.

## Why

The Enterprise Hospital Laboratory Management System PRD/BRD (v1.0, 08 October 2026) defines an end-to-end controlled laboratory workflow (order → specimen → examination → verification → authorization → reporting → quality → billing handoff → audit).

The existing `LaboratoryWorkbench` / catalog / L3 commercial surfaces are a prior implementation track. They must **not** become the architectural root of the Enterprise LMS merely because they already exist.

## Hard rules (L0)

Do **not**:

- delete, rewrite, rename, move, migrate, replace, or redirect `/dashboard/laboratory`
- change existing Laboratory business rules, APIs, permissions, tests, or decision docs
- reuse `laboratory.view` as the Enterprise LMS gate
- mount Enterprise LMS pages under `/dashboard/laboratory/*`

Do:

- keep both navigation entries independently accessible
- document any future integration/migration as a separate Product Owner decision

## Component reuse classification (L0)

| Asset | Class | L0 action |
|---|---|---|
| Shared shadcn/ui, `ProtectedRoute`, sidebar, branch context | GREEN | Reuse |
| Counsellor UX patterns (shell density, empty/error) | GREEN (patterns only) | Reuse patterns; no business logic |
| `LaboratoryWorkbench`, order dialog, catalog picker, L2/L3 lab APIs | RED / YELLOW | Do not reuse in L0 |
| Orphan `lab.api.ts` `/lab/*` client | RED | Do not adopt |
| `lab-reports.api.ts` / `LabReportsController` | YELLOW | Legacy Pathology SoT; not LMS SoT |

## Future integration

A later explicit product decision may authorize:

- coexistence with clear persona routing
- migration of reusable catalogue/commercial concepts into LMS
- retirement of the Pathology Laboratory workspace

None of that is authorized in L0.
