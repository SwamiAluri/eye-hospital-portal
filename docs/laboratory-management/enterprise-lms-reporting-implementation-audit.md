# L-REP-01 — Report Foundation  
# Implementation Audit

**Date:** 2026-10-12  
**Mode:** AUDIT → CONFIGURATION GATE (no application code in this document)  
**Authorization:** `PRODUCT_DECISIONS_CLOSED_L_REP_01_AUTHORIZED`  
**Closure:** [enterprise-lms-reporting-decision-closure.md](./enterprise-lms-reporting-decision-closure.md)  
**Discovery:** [enterprise-lms-reporting-discovery-audit.md](./enterprise-lms-reporting-discovery-audit.md)

**Reuse key:** **GREEN** = reuse as-is · **YELLOW** = adapt carefully · **RED** = do not reuse as LMS Report SoT / out of bounds

---

## 1. Runtime source of truth

| Domain | SoT | Location |
|---|---|---|
| LMS Result | LaboratoryApi `LmsResult` / `LmsResultVersion` | `microservices/laboratory-service/LaboratoryApi` |
| ResultStatus | `Draft` → `TechnicalVerified` → `ClinicallyAuthorized` only | `Domain/ResultEnums.cs` |
| Critical | Orthogonal `LmsCriticalResultEvent` | LaboratoryApi |
| LMS Report | **Absent** (to be created) | — |
| Legacy Pathology LabReport | AuthService `lab_reports` | **Not** LMS Report SoT |
| CanonicalDocument | AuthService document/bytes storage | **Not** Report SoT |
| Audit | Platform `audit_log` via AuthService internal API | `InternalAuditController` |

---

## 2. LaboratoryApi reuse

| Asset | Class | Path / notes |
|---|---|---|
| `LmsResult` / `LmsResultVersion` | **GREEN** | Provenance input; do not extend statuses |
| `ResultService` / `TestingFunctions` / `LaboratoryAuthz` | **GREEN** | Template for Report service/functions/perms |
| RowVersion + idempotency + `PlatformAuditClient` | **GREEN** | Copy for Report mutations |
| Branch validate `ValidateUserBranchAsync` | **GREEN** | Required on create/list |
| Work-queue `resultStatus=ClinicallyAuthorized` | **GREEN** | Eligible source discovery |
| Report aggregate today | **RED (absent)** | Expected — first create |

**Exact ResultVersion representation:** `LmsResultVersion` with `(ResultId, VersionNumber)` unique; Result holds `AuthorizedVersionNumber` after clinical authorization. ReportVersion must bind exact ResultId + ResultVersionNumber (and ResultVersion row id where stored).

**Latest migration:** `20261012130000_AddLmsCriticalResultEvents`. Next: `yyyyMMddHHmmss_AddLmsReportFoundation`.

---

## 3. LMS UI reuse

| Asset | Class | Path |
|---|---|---|
| Authorized Results | **GREEN** | `/dashboard/lms/results/authorized` → TestingWorkbench |
| TestingWorkbench states | **GREEN** | loading/error/empty/unauthorized |
| `lms-testing.api.ts` | **GREEN** | Client + idempotency pattern |
| Reports capability placeholder | **YELLOW** | `/dashboard/lms/reports` = `not_implemented` |
| `lms.reports.view` planned constant | **YELLOW** | Expand family; no grants |
| Pathology `lab-reports.api.ts` | **RED** | Do not use for LMS |

---

## 4. CanonicalDocument / Pathology

| Asset | Class | Rule |
|---|---|---|
| CanonicalDocument | **RED as SoT** | Downstream bytes only (PD-REP-25); **no attach in this slice** |
| AuthService LabReport / `/api/lab-reports` | **RED** | Legacy Pathology unchanged; no migration/dual-write |

---

## 5. Permission catalogue path

| Pattern | Path |
|---|---|
| Critical catalogue (copy) | `AuthService/SeedData/EnterpriseLmsTestingPermissionCatalog.cs` + `PermissionSeeder.SeedEnterpriseLmsTestingPermissionsAsync` |
| Startup | `AuthService/Program.cs` |
| Rule | Catalogue seed only; **no RolePermission grants** |

**Approved codes:** `lms.reports.view|manage|finalize|release|download` — seed catalogue; finalize/release/download catalogue-only (capabilities not implemented). **No** `lms.reports.publish`.

---

## 6. Audit action allowlist path

| Piece | Path |
|---|---|
| Allowlist SoT | `AuthService/Controllers/InternalAuditController.cs` (`AllowedActions` / `AllowedResourceTypes`) |
| Lab constants | Parallel to `ResultAuditActions` / `CriticalAuditActions` |

**Foundation actions (proposed):** `CREATE_REPORT_DRAFT` (+ resource `LmsReport` / `LmsReportVersion`). Fail closed on audit failure.

---

## 7. Configuration findings (Phase B gate)

| Dependency | Exists for LMS? | Foundation need? | Gate |
|---|---|---|---|
| Report business numbering | **No** | Not required — use GUID `Id` | **PASS** — omit numbering |
| PDF / templates / branding | **No** | Not required | **PASS** — omit PDF |
| Signatory / release authority | **No** | Finalize/Release out of slice | **PASS** — omit Finalize/Release APIs |
| Retention enforcement | **No** | Not required | **PASS** — omit retention |

**Configuration gate result:** `CONFIGURATION_GATE_PASSED_DRAFT_FOUNDATION`

Foundation may proceed with Draft Report create/discover + immutable ReportVersion snapshots without inventing numbering, PDF, signatory, or retention.

If a later task requires Finalize/Release/PDF/numbering/retention without governed config → `CONFIGURATION_REQUIRED`.

---

## 8. Scope risks

| Risk | Mitigation |
|---|---|
| Collapsing Report into ResultStatus | Separate `ReportStatuses.Draft` only; no Final/Released ResultStatus |
| Auto-create on authorize | Explicit create API/UI only |
| Pathology semantic bleed | Separate tables/APIs; no LabReport bridge |
| Over-implement Finalize/Release | No mutation APIs; catalogue perms documented as unused |
| CanonicalDocument SoT creep | No document attach in this slice |
| Role grants | Catalogue seed only |

---

## 9. Proposed bounded implementation

### Schema
- `lms_reports` — aggregate (Draft status, tenant, branch, patient/order context, CurrentVersionNumber, RowVersion)
- `lms_report_versions` — immutable snapshot rows
- `lms_report_version_sources` — exact ResultId + ResultVersionNumber (+ snapshot fields)
- `lms_report_idempotency` — create_report_draft ops

### APIs
- `POST /api/lms/reports` — create Draft from ≥1 ClinicallyAuthorized ResultVersions
- `GET /api/lms/reports` — branch-scoped list
- `GET /api/lms/reports/{id}` — detail + versions
- `GET /api/lms/reports/{id}/versions/{versionNumber}` — snapshot + provenance

**Not in slice:** finalize, release, PDF, publication, amendment.

### UI
- Promote `/dashboard/lms/reports` to Draft worklist + detail + create from eligible sources
- Explicit create only; honest states; no KPI cards; no Final/Released claims

### AuthService
- Seed `lms.reports.*` catalogue (no grants)
- Allowlist CREATE_REPORT_DRAFT + LmsReport resources

---

## 10. Audit stamp

```text
L_REP_01_FOUNDATION_READINESS_AUDIT_COMPLETE
CONFIGURATION_GATE_PASSED_DRAFT_FOUNDATION
IMPLEMENTATION_NOT_STARTED_BY_THIS_AUDIT
```
