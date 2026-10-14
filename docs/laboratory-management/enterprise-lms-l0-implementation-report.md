# Enterprise LMS L0 — Implementation Report

**Date:** 2026-10-08  
**Decision:** Variant B+  
**Stop condition:** Automated tests + manual UAT; do not start next slice automatically.

## 1. Architecture decision implemented

New bounded Enterprise LMS workspace at `/dashboard/lms/*` inside Hospital Portal, isolated from `/dashboard/laboratory`.

## 2. Existing Laboratory audit summary

Preserved: Pathology Laboratory nav, route, `laboratory.view`, workbench, L1–L3 catalog/order/commercial surfaces, tests, decision docs. Classified prior Lab UI as non-root for Enterprise LMS (RED/YELLOW for L0 reuse).

## 3. New LMS route namespace

`/dashboard/lms` and child routes for Overview, Work Queue, Orders, Collection, Specimens, Testing (+ children), Results & Authorization (+ children), Reports, Referrals, Quality (+ children), Operations, Billing, Analytics, Configuration (+ children), Administration.

## 4. New LMS left navigation tree

Sidebar section **Laboratory Management** sourced from `lib/lms/lms-navigation.ts`.

## 5. Existing Laboratory boundary

Documented in `enterprise-lms-existing-laboratory-boundary.md`. No redirects or shared IA.

## 6. Shared components reused

`ProtectedRoute`, sidebar filter, branch context, auth store, staff page header patterns, shadcn/Tailwind.

## 7. New LMS components created

`LmsPageShell`, `LmsContextStrip`, `LmsPlaceholderState`, `LmsCapabilityPage`, `LmsOverviewDashboard`, plus capability registry / permissions / navigation modules.

## 8. Permission model used

- L0 gate: `lms.view` (catalog seeded; **no** role auto-grants)
- Planned fine-grained codes documented in FE constants only
- Legacy `laboratory.view` unchanged

## 9. Files changed (high level)

- `apps/hospital-portal-web/src/app/dashboard/lms/**`
- `apps/hospital-portal-web/src/components/lms/**`
- `apps/hospital-portal-web/src/lib/lms/**`
- `apps/hospital-portal-web/src/lib/navigation/sidebar-menu-sections.tsx` (+ subItems filter)
- AuthService seed catalog + tests
- `docs/laboratory-management/**`

## 10–12. Tests / regression

See chat implementation report after test run.

## 13. Manual UAT checklist

- [ ] LMS nav visible to user with `lms.view` (or Admin `*`)
- [ ] `/dashboard/lms` opens independently
- [ ] `/dashboard/laboratory` still opens independently
- [ ] Pathology Laboratory route/permissions unchanged
- [ ] LMS hierarchy understandable; not a duplicate of Pathology Lab
- [ ] Responsive workstation behavior acceptable
- [ ] Unauthorized user redirected / nav hidden
- [ ] No fake KPI counts
- [ ] Visual language matches Hospital Portal
- [ ] Counsellor-quality operational polish for shell density/copy

## 14–17. Risks / decisions / next slice

See `enterprise-lms-implementation-plan.md`. Recommended next slice only after UAT approval.
