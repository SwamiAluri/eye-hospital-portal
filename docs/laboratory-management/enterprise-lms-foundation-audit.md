# Enterprise LMS Foundation Audit (L0)

**Date:** 2026-10-08  
**Mode:** Variant B+ (new `/dashboard/lms` workspace)  
**PRD SoT:** Enterprise Hospital Laboratory Management System | PRD BRD v1.0 | 08 October 2026

## 1. Application structure

| Area | Finding |
|---|---|
| Monorepo | `apps/hospital-portal-web` (Next.js 14 App Router), `microservices/*` (.NET), shared docs/design-system |
| Staff shell | Dashboard layout + navy sidebar (`Sidebar.tsx`) + `sidebar-menu-sections.tsx` |
| Auth | JWT staff auth via `auth-store` + `ProtectedRoute` |
| Permissions | Code-based (`*.view`, `module.action`); seeded in AuthService `PermissionSeeder` |
| Branch/site | `useBranchContext` + `/user-branches/me` |
| Design system | shadcn/ui + Tailwind; Counsellor is UX quality bar |

## 2. Existing Laboratory (preserved)

| Item | Location | Classification |
|---|---|---|
| Nav item | Diagnostics & Lab → Laboratory (Pathology) | Preserve |
| Route | `/dashboard/laboratory` | Preserve |
| Permission | `laboratory.view` | Preserve (not LMS gate) |
| UI | `LaboratoryWorkbench`, order/catalog dialogs | Partially reusable later / RED for L0 |
| APIs | `lab-reports.api`, `laboratory-catalog.api` | YELLOW — prior track |
| Orphan | `lab.api.ts` `/lab/*` | Obsolete/unsafe as LMS SoT |
| Docs | `docs/decisions/laboratory-management-*` | Preserve; historical track |
| Tests | `laboratory-l*.test.*` | Preserve |

## 3. Counsellor UX patterns reused (patterns only)

Page header hierarchy, operational density, empty/error honesty, permission-gated nav, Sheet/Dialog primitives (available for later slices), loading/empty/error expectations. **No** Counsellor ownership/business logic copied.

## 4. Shared platform reused

- `ProtectedRoute`
- Sidebar + `filterSidebarSectionsByPermission` (extended for `subItems`)
- `useBranchContext` / auth store user+roles
- shadcn/Tailwind staff page header classes
- AuthService permission catalog seed pattern

## 5. New LMS surfaces (L0)

- Route namespace `/dashboard/lms/*`
- Sidebar section **Laboratory Management**
- Components under `components/lms/*`
- Permission root `lms.view` (catalog seed; **no** role auto-grants)
- Docs under `docs/laboratory-management/`

## 6. Out of scope confirmed

No LMS domain tables, order/specimen/result workflows, billing logic, QC, integrations, fabricated KPIs, or changes to Counsellor / Patient Directory / Patient 360 / Billing / Pathology Laboratory.

## 7. Decisions required

See implementation plan § Product / Architecture decisions.
