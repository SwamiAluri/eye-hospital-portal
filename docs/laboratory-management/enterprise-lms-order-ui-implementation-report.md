# L-ORD-01C — Enterprise LMS Order Intake UI — Implementation Report

**Date:** 2026-10-09  
**Status:** `IMPLEMENTATION_COMPLETE_READY_FOR_MANUAL_UAT`  
**Product decisions:** PD-ORD-01…19 unchanged; PD-ORD-UI-01…04 closed for this slice as authorized  

---

## 1. Scope implemented

Complete functional Orders workspace at `/dashboard/lms/orders`:

- Worklist (list/filter/search/pagination states)
- New Order / Draft composer
- Draft edit
- Patient selection (Patient Hub autosuggest)
- Optional visit selection (recent visits)
- Distinct Ordering Provider & Responsible Clinician pickers
- Operating branch from platform branch context (performing = operating, display)
- Source / Priority / Priority reason / Indication
- Governed orderables picker (`GET /api/lms/catalogue/orderables`)
- Draft create/update, Submit, Detail, Version history, Amend, Cancel
- Permission gates (`lms.orders.view|create|manage`)
- Loading / empty / error / permission-denied
- Concurrency conflict UX + Idempotency-Key reuse for logical retries
- Typed FE API client `src/lib/lms/lms-orders.api.ts`
- Automated FE tests

## 2. Scope explicitly NOT implemented

Collection, CollectionTask, specimens, accession, barcode, labels, requisitions, custody, receiving, triage, testing, results, verification, authorization, reporting, referrals, QC, CAPA, analytics, Work Queue, billing charge posting, AOE, favourites, pathways, new patient/visit masters, Pathology changes, automatic production role grants, new LMS order tables/migrations, SignalR.

## 3. UI architecture

FE-first against LaboratoryApi (AD-ORD-UI-01…04).

```text
/dashboard/lms/orders
  → OrdersWorkbench (ProtectedRoute lms.view)
       ├── Worklist → GET /api/lms/orders
       ├── OrderComposerDialog → create/update/submit/amend
       └── OrderDetailSheet → detail/versions/submit/cancel
```

Reuse: `LmsPageShell`, shadcn Dialog/Sheet/Select, `PatientSearchAutosuggest`, `useBranchContext`, `useHasPermission`, `usersApi.getAll` (no Doctor heuristic).

## 4. Routes

| Route | Component |
|---|---|
| `/dashboard/lms/orders` | `OrdersWorkbench` (replaced `LmsCapabilityPage`) |

No Pathology route changes. No new app.

## 5. API client

`apps/hospital-portal-web/src/lib/lms/lms-orders.api.ts`

- Uses `getLaboratoryApi()` + JWT interceptors
- `skipForbiddenRedirect` for in-page 403 handling
- Helpers: `newLmsIdempotencyKey`, `parseLmsOrderApiError`, `validateOrderComposerClient`

## 6. Worklist

Filters supported by API only: `search` (order number), `status`, `operatingBranchId`, `page`/`pageSize`.

## 7. Order composer

Sections: Patient & encounter → Ordering context → Clinical request → Tests/panels → Save draft / Save & submit (or Submit amendment).

## 8. Patient / Visit / Provider

- Patient: `PatientSearchAutosuggest` + unified suggest (PD-ORD-UI-03)
- Visit: optional recent visits via `usePatientRecentVisitsQuery`
- Providers: platform `/users` list filtered to active; distinct fields; no Pathology ordering-clinicians / doctors/search

## 9. Orderables / panels

`listLmsOrderables` only. Server remains authoritative for panel explosion and pinning. Submitted OrderTests shown read-only on detail.

## 10. Submit / amend / cancel

Existing LaboratoryApi endpoints; ExpectedRowVersion + Idempotency-Key; cancel terminal; amend creates new version (no Amended status).

## 11. Permission behavior

| Permission | UI |
|---|---|
| `lms.view` | Route shell |
| `lms.orders.view` | Worklist/detail |
| `lms.orders.create` | New/edit/submit/orderables |
| `lms.orders.manage` | Amend/cancel |

Admin `*` sufficient for initial UAT (PD-ORD-UI-01/04). No role grants added.

## 12. Error / concurrency / idempotency UX

Mapped 400/403/404/409/503/network. Stale RowVersion shows refresh guidance. Idempotency key held for logical retry of create/submit/amend/cancel.

## 13. Accessibility / responsive

Labels, dialog/sheet patterns, keyboard-usable controls, status badge + text, desktop-primary table with horizontal scroll.

## 14. Automated tests

| Command | Result |
|---|---|
| `npx vitest run src/app/dashboard/lms src/lib/lms/lms-orders.api.test.ts` (cwd: `apps/hospital-portal-web`) | **Passed 33 / 33** |

## 15. Regression tests

| Command | Result |
|---|---|
| `dotnet test microservices/laboratory-service/LaboratoryApi.Tests/LaboratoryApi.Tests.csproj` | **Passed 80 / 80** |
| `dotnet test microservices/auth-service/AuthService.Tests/AuthService.Tests.csproj --filter "FullyQualifiedName~EnterpriseLms"` | **Passed 7 / 7** |

## 16. Files changed

- `apps/hospital-portal-web/src/lib/lms/lms-orders.api.ts` **(new)**
- `apps/hospital-portal-web/src/lib/lms/lms-orders.api.test.ts` **(new)**
- `apps/hospital-portal-web/src/components/lms/orders/OrdersWorkbench.tsx` **(new)**
- `apps/hospital-portal-web/src/components/lms/orders/OrderComposerDialog.tsx` **(new)**
- `apps/hospital-portal-web/src/components/lms/orders/OrderDetailSheet.tsx` **(new)**
- `apps/hospital-portal-web/src/components/lms/orders/OrderablesPicker.tsx` **(new)**
- `apps/hospital-portal-web/src/components/lms/orders/OrderProviderPicker.tsx` **(new)**
- `apps/hospital-portal-web/src/components/lms/orders/OrderStatusBadge.tsx` **(new)**
- `apps/hospital-portal-web/src/app/dashboard/lms/orders/page.tsx`
- `apps/hospital-portal-web/src/app/dashboard/lms/orders/enterprise-lms-orders-ui.test.ts` **(new)**
- `apps/hospital-portal-web/src/lib/lms/lms-capability-registry.ts`
- `apps/hospital-portal-web/src/app/dashboard/lms/enterprise-lms-l0-foundation.test.ts`
- `docs/laboratory-management/enterprise-lms-order-ui-implementation-report.md` **(new)**
- `docs/laboratory-management/enterprise-lms-implementation-plan.md`

## 17. Product decisions

- PD-ORD-01…19: **unchanged**
- PD-ORD-UI-01: Admin-only initial UAT; production role grants deferred
- PD-ORD-UI-02: Complete Orders UI as one bounded slice
- PD-ORD-UI-03: Patient Hub / visit patterns reused
- PD-ORD-UI-04: Non-Admin UAT not mandatory for initial acceptance

## 18. Manual UAT checklist

**MANUAL UI UAT — READY**

Prerequisites: LaboratoryApi running with order migration applied; AuthService; Admin user with `*`; Active catalogue orderables for operating branch; at least one patient and active user.

1. Open `/dashboard/lms/orders` with Admin  
2. Worklist loads (empty or populated)  
3. New order  
4. Patient selection via search  
5. Visit optional (none + one recent visit)  
6. Ordering provider ≠ Responsible clinician  
7. Operating branch from context strip  
8. Source values (incl. SelfRequested + acknowledgement)  
9. Priority Urgent/STAT requires reason  
10. Orderables search/add (Active only)  
11. Panel selection (if available)  
12. Save draft → order number appears  
13. Submit → Submitted + OrderTests  
14. Detail shows selections/tests/snapshots  
15. Version history after amend  
16. Amend Submitted order with reason  
17. Cancel with reason → terminal; no amend  
18. Stale concurrency: open same order two tabs, mutate both → 409 guidance  
19. Permission denied: user without `lms.orders.view` sees unauthorized panel  
20. Network/error: stop LaboratoryApi → honest error + retry  
21. Confirm no CollectionTask/specimen/label/accession created  
22. Confirm `/dashboard/laboratory` Pathology unchanged  

## 19. Known limitations

- Provider picker requires ability to list users (`user.view` / Admin); no dedicated LMS clinician directory  
- List API has no source/priority/date filters — UI does not invent them  
- No SignalR live refresh  
- Production role grants for `lms.orders.*` still deferred  

## 20. Scope leakage check

**None.** Diff contains no CollectionTask, Specimen creation, Accession, Barcode, Custody, Receiving, or Triage behavior. Submit ends at Submitted Order + OrderTests.

---

## Final status

**IMPLEMENTATION_COMPLETE_READY_FOR_MANUAL_UAT**

Do not declare product acceptance until Manual UAT is performed.  
Do not start Collection or any other LMS slice without new authorization.
