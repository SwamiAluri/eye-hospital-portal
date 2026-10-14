# L-TST-01A — Testing Work Queue + Manual Result Draft  
# Implementation Report

**Date:** 2026-10-11  
**Authorization:** `PRODUCT_DECISIONS_CLOSED_L_COL_01F_AUTHORIZED`  
**Slice:** L-TST-01A only  
**Decision closure:** [enterprise-lms-testing-decision-closure.md](./enterprise-lms-testing-decision-closure.md)  
**Step 0 audit:** [enterprise-lms-testing-implementation-audit.md](./enterprise-lms-testing-implementation-audit.md)

---

## 1. Implementation summary

Implemented LMS Testing Work Queue and Manual Result Draft in LaboratoryApi + LMS FE.

- New `lms_results` / `lms_result_versions` / `lms_result_idempotency` tables  
- Eligibility: Submitted Order · Ordered OrderTest · Received Specimen · local catalogue · operating branch  
- Result status **Draft only**  
- OrderTest **remains Ordered** (no Testing transition)  
- Manual numeric / qualitative / comment entry driven by catalogue datatype  
- No abnormal/critical flags, verification, authorization, instrument, billing, or Pathology reuse  
- Permission catalog `lms.testing.view|manage|result` seeded **without role grants**  
- Audit actions `CREATE_RESULT_DRAFT` / `UPDATE_RESULT_DRAFT` allowlisted  

---

## 2. Files changed (primary)

**Backend LaboratoryApi**

- `Domain/ResultEnums.cs`, `LmsResult.cs`, `LmsResultVersion.cs`, `LmsResultIdempotencyRecord.cs`  
- `Services/ResultDtos.cs`, `ResultService.cs`  
- `Functions/TestingFunctions.cs`  
- `Data/LaboratoryDbContext.cs`  
- `Services/LaboratoryAuthz.cs`, `Program.cs`  
- `Migrations/20261011161033_AddLmsResultDraftTesting.cs` (+ Designer / Snapshot)

**AuthService**

- `SeedData/EnterpriseLmsTestingPermissionCatalog.cs`  
- `SeedData/PermissionSeeder.cs` (+ seed call in `Program.cs`)  
- `Controllers/InternalAuditController.cs` allowlist  
- Tests: `EnterpriseLmsTestingPermissionTests.cs`, `InternalAuditControllerTests.cs` (allowlist coverage)

**Frontend**

- `lib/lms/lms-testing.api.ts`, `lms-permissions.ts`, `lms-capability-registry.ts`  
- `components/lms/testing/TestingWorkbench.tsx`, `ResultDraftEntry.tsx`  
- Routes: `testing/page.tsx`, `testing/workbench/page.tsx`, `testing/manual-results/page.tsx`  
- `testing/enterprise-lms-testing-ui.test.ts`

**Docs**

- Implementation audit, this report, PRE-UAT verification  

---

## 3. Schema / migration

Migration: `20261011161033_AddLmsResultDraftTesting`

| Table | Purpose |
|---|---|
| `lms_results` | Result aggregate (OrderTest + Specimen + tenant + branch); Draft status; RowVersion |
| `lms_result_versions` | Append-only draft versions |
| `lms_result_idempotency` | CREATE/UPDATE idempotency |

**Uniqueness:** `(tenant_id, order_test_id, specimen_id)`  
**Concurrency:** `row_version` concurrency token  
**No OrderTest columns added.**

---

## 4. API endpoints

| Method | Route | Permission |
|---|---|---|
| GET | `/api/lms/testing/work-queue` | `lms.testing.view` \| `manage` \| `result` |
| GET | `/api/lms/testing/work-items?orderTestId&specimenId&operatingBranchId` | view \| manage \| result |
| GET | `/api/lms/testing/results/{id}` | view \| manage \| result |
| POST | `/api/lms/testing/results` | `lms.testing.result` |
| PUT | `/api/lms/testing/results/{id}` | `lms.testing.result` |

---

## 5. Frontend surfaces

- `/dashboard/lms/testing` — Work Queue  
- `/dashboard/lms/testing/workbench` — same workbench  
- `/dashboard/lms/testing/manual-results?...` — Manual Result Draft entry  

Honest empty/error/unauthorized; no fake KPIs or clinical rows; no verification/authorization/release controls.

---

## 6. Permissions

| Code | Seeded | Role grants |
|---|---|---|
| `lms.testing.view` | Yes (catalog) | **None** |
| `lms.testing.manage` | Yes (catalog) | **None** |
| `lms.testing.result` | Yes (catalog) | **None** |

---

## 7. Audit actions

| Action | Resource |
|---|---|
| `CREATE_RESULT_DRAFT` | `LmsResult` |
| `UPDATE_RESULT_DRAFT` | `LmsResult` |

Fail-closed: audit failure reverts create / update (including restore of prior Result aggregate + removal of the new ResultVersion on UPDATE).

---

## 8. Idempotency

Operations: `create_result_draft`, `update_result_draft`  
Same key + same hash → replay  
Same key + different hash → `409 idempotency_conflict`  
Store: `lms_result_idempotency`

---

## 9. Concurrency

`ExpectedRowVersion` on update; mismatch → `409 concurrency_conflict`.

---

## 10–12. Tests executed / results

Re-executed for PRE-UAT evidence gate (2026-10-11). Exact counts in [enterprise-lms-testing-pre-uat-verification.md](./enterprise-lms-testing-pre-uat-verification.md).

| Suite | Passed | Failed | Total |
|---|---:|---:|---:|
| `ResultServiceTests` | 25 | 0 | 25 |
| `SpecimenBarcodeServiceTests` | 28 | 0 | 28 |
| `SpecimenReceivingServiceTests` | 19 | 0 | 19 |
| Collection suites | 33 | 0 | 33 |
| `SpecimenServiceTests` | 19 | 0 | 19 |
| Combined LMS regression + Result filter | 116 | 0 | 116 |
| Auth `EnterpriseLmsTestingPermissionTests` | 2 | 0 | 2 |
| Auth Result audit allowlist | 1 | 0 | 1 |
| FE `enterprise-lms-testing-ui.test.ts` | 4 | 0 | 4 |

---

## 13. Known limitations

- Catalogue `ResultDatatype` is Numeric/Qualitative only; free-text comment is ancillary (not a new catalogue datatype). Unsupported/missing datatype fails honestly.  
- Panel components are expected as exploded OrderTests (TEST); PANEL OrderTests remain eligible if local.  
- Manual UAT not executed.  
- Operator must apply migration and restart LaboratoryApi/AuthService before Manual UAT.

---

## 14. Explicit out-of-scope confirmation

Not implemented: Technical Verification, Clinical Authorization, Final/Release, Critical, Amendments, Instrument/Runs/QC, Referral inbound, Billing, Pathology migration, OrderTest/Specimen/Collection/Receiving/Barcode lifecycle changes, production role grants.

---

## 15. PRE-UAT status

See [enterprise-lms-testing-pre-uat-verification.md](./enterprise-lms-testing-pre-uat-verification.md).

**Final status:** `PRE_UAT_VERIFICATION_PASSED`  
Manual UAT not executed; L-TST-01A not yet accepted.
