# L-REP-01 — Report Foundation  
# PRE-UAT Verification

**Date:** 2026-10-12  
**Authorization:** `PRODUCT_DECISIONS_CLOSED_L_REP_01_AUTHORIZED`  
**Implementation:** [enterprise-lms-reporting-implementation.md](./enterprise-lms-reporting-implementation.md)  
**Mode:** Automated verification complete — **STOP FOR MANUAL UAT** (do not claim acceptance)

---

## 1. Configuration gate

| Dependency | Required for Draft foundation? | Result |
|---|---|---|
| Report business numbering | No (GUID Id) | **PASS** — omitted |
| PDF / templates / branding | No | **PASS** — omitted |
| Signatory / release authority | No (Finalize/Release out of slice) | **PASS** — omitted |
| Retention enforcement | No | **PASS** — omitted |

`CONFIGURATION_GATE_PASSED_DRAFT_FOUNDATION`

---

## 2. Schema / migration

| Check | Result |
|---|---|
| Migration `20261012160000_AddLmsReportFoundation` present | **PASS** |
| Tables `lms_reports`, `lms_report_versions`, `lms_report_version_sources`, `lms_report_idempotency` | **PASS** (model + migration) |
| Exact ResultVersion FK provenance | **PASS** |
| No Pathology / ResultStatus schema changes | **PASS** |
| LaboratoryDbContext entity count includes Report types (30) | **PASS** (shell tests) |

**Note:** Apply migration to target PostgreSQL before Manual UAT. In-memory tests cover domain logic; production path uses EF PostgreSQL conventions consistent with prior LMS migrations.

---

## 3. Lifecycle boundaries

| Check | Result |
|---|---|
| ResultStatuses remain Draft / TechnicalVerified / ClinicallyAuthorized | **PASS** |
| No ResultStatus Final / Released / Published | **PASS** |
| Report status created as Draft only | **PASS** |
| No Finalize / Release mutation APIs | **PASS** |
| Authorize does not auto-create Report | **PASS** (automated) |
| Critical lifecycle unchanged | **PASS** (CriticalResultServiceTests in suite) |

---

## 4. Snapshot / provenance

| Check | Result |
|---|---|
| ReportVersion binds ResultId + ResultVersionId + ResultVersionNumber | **PASS** |
| Snapshot values from ResultVersion row | **PASS** |
| Historical snapshot unchanged when live Result mutated | **PASS** |
| Append creates distinct ReportVersion | **PASS** |

---

## 5. Idempotency / concurrency / audit

| Check | Result |
|---|---|
| Same key + hash replay | **PASS** |
| Same key + different hash → 409 idempotency_conflict | **PASS** |
| Stale RowVersion on append → 409 concurrency_conflict | **PASS** |
| Audit success path | **PASS** |
| Audit failure fail-closed (revert + 503) | **PASS** |
| No second audit store | **PASS** |

---

## 6. Authorization / permissions

| Check | Result |
|---|---|
| Tenant isolation on source Result | **PASS** |
| Branch validate on create/list | **PASS** |
| Catalogue seed `lms.reports.*` (no publish) | **PASS** (code + AuthService unit tests when buildable) |
| **No role grants** | **PASS** (seeder does not write RolePermissions) |
| Finalize/Release/Download catalogue-only | **Documented** — not implemented |

---

## 7. UI

| Check | Result |
|---|---|
| `/dashboard/lms/reports` real workbench | **PASS** |
| Detail + version provenance + snapshot | **PASS** |
| Honest empty/loading/error/unauthorized | **PASS** (static UI tests) |
| No KPI / Final / Release / patient-visibility claims as features | **PASS** |
| Capability registry `reports` = implemented | **PASS** |

---

## 8. Automated test evidence

| Suite | Result |
|---|---|
| `ReportServiceTests` | **16 passed** |
| `LaboratoryDbContextShellTests` (updated) | **passed** |
| Full `LaboratoryApi.Tests` | **282 passed / 0 failed** (includes L-TST / L-VER / L-AUTH / L-CRT / Collection / Specimen / Orders regression) |
| Frontend `enterprise-lms-reports-ui.test.ts` | **6 passed** |
| Frontend Authorized Results UX regression | **passed** (paired run earlier) |
| AuthService `EnterpriseLmsReportsPermissionTests` + allowlist | **3 passed** (alternate output path while AuthService process locked default bin) |

---

## 9. Exclusions verified (not implemented)

- Finalize / Release APIs and UI actions  
- PDF / templates / branding / business numbering  
- CanonicalDocument attach  
- Patient Portal / Patient 360 publication  
- SMS / email / WhatsApp  
- Amendments / supersession  
- Pathology migration / dual-write  
- ResultStatus expansion  
- Production role grants  
- Analytics / billing  

---

## 10. Known limitations for Manual UAT

1. Users need JWT permissions `lms.reports.view` / `lms.reports.manage` assigned outside this task (catalogue seeded; **no automatic grants**).  
2. Migration must be applied to the UAT PostgreSQL database.  
3. Finalize / Release / PDF remain future slices (`CONFIGURATION_REQUIRED` for numbering/templates/signatory when those slices start).  
4. AuthService permission unit tests should be re-run when AuthService process is not locking the build output.

---

## 11. PRE-UAT stamp

```text
IMPLEMENTATION_COMPLETE_READY_FOR_PRE_UAT
MANUAL_UAT_NOT_STARTED
ACCEPTANCE_NOT_CLAIMED
```

**STOP** — do not start Manual UAT in this task. Do not claim UAT passed or ACCEPTED.
