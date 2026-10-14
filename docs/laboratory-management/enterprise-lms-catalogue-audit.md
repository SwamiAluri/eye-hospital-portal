# Enterprise LMS Catalogue Audit — L-CAT-01 Pre-Implementation

**Date:** 2026-10-08  
**Slice:** L-CAT-01 — Enterprise Catalogue Foundation  
**Mode:** READ-ONLY AUDIT (implementation gated on ownership decisions)  
**PRD SoT:** Enterprise Hospital Laboratory Management System PRD/BRD v1.0 | 08 October 2026  
**Boundary:** Variant B+ — `/dashboard/lms` vs `/dashboard/laboratory`

```text
AUDIT COMPLETE
AD-CAT-01 APPROVED: OPTION B — Laboratory Service (LaboratoryApi)
AD-CAT-02 APPROVED: Dedicated LMS persistence (no legacy bridge)
L-CAT-01A: Architecture shell (no catalogue tables/APIs)
L-CAT-01B: Catalogue domain — NOT STARTED (awaits architecture review)
```

---

## 1. Executive summary

| Track | Route | Catalogue backend | UI |
|---|---|---|---|
| Pathology Laboratory (prior) | `/dashboard/laboratory` | AuthService `LaboratoryTestDefinition` / panels / analytes | L1–L3 implemented |
| Enterprise LMS | `/dashboard/lms/configuration/*` | **None** | L0 placeholders only |

There is **no** dedicated lab/LIS microservice. All live laboratory catalogue persistence and APIs are in **AuthService** under the legacy Pathology track.

Enterprise LMS must **not** silently adopt legacy tables/APIs as SoT without an explicit Product/Architecture decision.

---

## 2. What already exists

### 2.1 Legacy Pathology catalogue (AuthService)

| Asset | Path |
|---|---|
| Entities | `Models/Domain/LaboratoryCatalog.cs` — `LaboratoryTestDefinition`, specimen options, `LaboratoryPanel`, `LaboratoryPanelItem`, `LaboratoryAnalyte` |
| Operational orders | `LabReport` + `LabReportItem` (`lab_reports`) |
| Counsellor Pre-Op catalog | `LabTestCatalog` (`lab_test_catalog`) — different SoT |
| Controller | `LaboratoryCatalogController` → `api/laboratory/catalog` |
| Commercial | `LaboratoryCommercialMappingService` (L3) |
| FE client | `lib/api/laboratory-catalog.api.ts` |
| FE UI | `components/laboratory/LaboratoryCatalogAdminDialog.tsx`, picker, order dialog |
| Migrations | `Data/Migrations/20261007194500_AddLaboratoryClinicalCatalog.sql` (+ non-billable) |

**Gaps vs PRD enterprise catalogue:**

- No `TestCatalogueVersion` / version chain
- No Draft → Review → Approved → Active lifecycle (creates go active immediately)
- No branch/site/section scope (TenantId only)
- Backend auth uses `patient.view` / `patient.update` (not LMS configuration permissions)
- Clinical create/update is **not** fully audited (commercial mapping is)

### 2.2 Enterprise LMS (L0)

| Asset | State |
|---|---|
| `/dashboard/lms/configuration/test-catalogue` | Placeholder (`LmsCapabilityPage`) |
| `/dashboard/lms/configuration/panels` | Placeholder |
| Permission | `lms.view` only; planned `lms.configuration.view` not seeded |
| Domain tables | None |

### 2.3 Platform (reusable)

| Concern | Location |
|---|---|
| Audit | `AuditService` / `audit_log` (`StageAsync` pattern) |
| Tenant | JWT `TenantId` on AuthService controllers |
| Branch UI | `useBranchContext` (display; not catalogue SoT) |
| Migrations | Additive SQL under `AuthService/Data/Migrations/` |
| Commercial master | Service Catalog (`master_data.*`) — Billing ownership |
| LMS shell | `components/lms/*` |

### 2.4 Approval / versioning analogues

No lab catalogue draft/approve workflow exists. Nearest patterns: Service Catalog immediate CRUD; Examination drafts (clinical, not publish); Canonical documents (document supersession). **L-CAT-01 needs a new governed lifecycle.**

---

## 3. GREEN / YELLOW / RED classification

| Asset | Class | L-CAT-01 action |
|---|---|---|
| Auth, `ProtectedRoute`, LMS shell, shadcn, Counsellor UX patterns | GREEN | Reuse |
| `AuditService` + `audit_log` | GREEN | Reuse for lifecycle |
| TenantId + soft-delete EF conventions | GREEN | Reuse patterns |
| Service Catalog as **commercial reference** only | GREEN | Reference FK/code; no second pricing system |
| L2 `LaboratoryTestDefinition` schema/API/UI | YELLOW | Reference only — **not** LMS SoT without PO decision |
| `laboratory-catalog.api.ts` / Pathology controller | YELLOW | Do not mount under LMS |
| `LabTestCatalog` / Pre-Op | YELLOW | Different domain |
| `lab.api.ts` orphan | RED | Do not adopt |
| Using `laboratory.view` / `patient.update` as LMS catalogue admin gate | RED | Do not |
| Rewriting Pathology Laboratory components | RED | Forbidden |

---

## 4. Proposed LMS backend ownership

### Options

| Option | Description | Pros | Cons |
|---|---|---|---|
| **A — AuthService new LMS schema** (recommended for first slice) | New `lms_*` tables + `api/lms/catalogue` in AuthService; isolated from `laboratory_*` | Matches repo reality (all lab data in AuthService); fastest; audit/tenant already there | Grows AuthService; must enforce hard isolation from Pathology APIs |
| **B — Dedicated lab microservice** | New service + DB for enterprise catalogue | Clean long-term boundary | No lab service exists; large greenfield for L-CAT-01 |
| **C — Extend legacy `laboratory_*` as LMS SoT** | Versioning/lifecycle bolted onto L2 tables | Less schema duplication | Couples Enterprise LMS to Pathology; violates Variant B+ spirit |

**Decision (supersedes recommendation):** **Option B approved** — dedicated `LaboratoryApi` service (`microservices/laboratory-service`). See L-CAT-01A docs. Catalogue domain remains **L-CAT-01B**.

---

## 5. Proposed persistence (if Option A approved)

New tables (names illustrative; final names follow repo snake_case conventions):

- `lms_catalogue_items` — identity shell (type: Test | Panel | ReferralTest)
- `lms_catalogue_versions` — versioned payload + lifecycle status + effective dates
- `lms_catalogue_panel_components` — panel → component version refs + sort order
- Discipline codes as constrained enum/lookup (configurable activation later)
- Optional commercial **references** only (service variant id / external code) — no price engine

No order/specimen/result tables in L-CAT-01.

---

## 6. Dependencies

| Dependency | Status |
|---|---|
| L0 LMS workspace | Complete |
| Platform audit | Available |
| Billing Service Catalog | Available for reference only |
| Pathology L2 catalog | Coexists; not SoT |
| Order Intake | Must **not** start until catalogue accepted |

---

## 7. Risks

1. Dual catalogues (Pathology vs LMS) confuse operators until migration decision.
2. AuthService file-lock / migration apply discipline (SQL-first, no startup Migrate).
3. Inventing approver roles without PO mapping.
4. Scope creep into reference intervals / TAT / pricing.
5. Permission over-seeding without role grants.

---

## 8. Decisions required (blocking)

| ID | Decision | Options |
|---|---|---|
| **AD-CAT-01** | Backend ownership | A AuthService new LMS schema (rec.) / B new microservice / C extend legacy |
| **AD-CAT-02** | Catalogue SoT isolation | Separate `lms_*` tables (rec.) / bridge to L2 / replace L2 |
| **PD-CAT-01** | Minimum permissions for L-CAT-01 | e.g. `lms.catalogue.view` + `lms.catalogue.manage` vs full granular matrix |
| **PD-CAT-02** | Which roles receive catalogue permissions | Do not invent Lab Director etc. without mapping |
| **PD-CAT-03** | Org/site/lab scope for catalogue versions | Tenant-only for L-CAT-01 vs branch-scoped |
| **PD-CAT-04** | Who may Approve/Activate | Capability-based only until role map approved |

---

## 9. Non-blocking product notes

- Discipline taxonomy from PRD supported as codes; none auto-activated as “deployed clinical menu.”
- Reference intervals / critical / TAT = configuration **references** only (null / not configured).
- No fake clinical seed data for UAT.

---

## 10. Stop condition

Per L-CAT-01 brief: **STOP** — backend ownership is ambiguous until AD-CAT-01 / AD-CAT-02 are confirmed.

Implementation begins only after explicit approval of ownership + L-CAT-01 design.
