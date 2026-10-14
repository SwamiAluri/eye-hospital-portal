# L-REP-03 CUT D-C — Currentness / Regeneration Validation  
# Implementation Report

**Date:** 2026-10-13  
**Slice:** L-REP-03 CUT D-C — Current-artifact / regeneration projection correctness  
**Mode:** BOUNDED VALIDATION IMPLEMENTATION — tests + documentation; no schema/API/permission/CUT C contract changes  

**Authoritative references:**

| Document | Role |
| --- | --- |
| [enterprise-lms-report-preview-dc-currentness-readiness-audit.md](./enterprise-lms-report-preview-dc-currentness-readiness-audit.md) | D-C readiness audit |
| [enterprise-lms-report-preview-db-acceptance-closure.md](./enterprise-lms-report-preview-db-acceptance-closure.md) | `ACCEPTED_L_REP_03_CUT_D_B` |
| [enterprise-lms-report-preview-patient360-product-decision-closure.md](./enterprise-lms-report-preview-patient360-product-decision-closure.md) | PD-D-08…12 binding |
| [enterprise-lms-report-staff-download-acceptance-closure.md](./enterprise-lms-report-staff-download-acceptance-closure.md) | `ACCEPTED_L_REP_03_CUT_C` frozen |

---

## 1. Scope implemented

D-C validates MODEL A currentness / regeneration correctness under approved PD-D-08…12:

- `LmsReport.CurrentOfficialArtifactId` remains the sole currentness SoT  
- Successful regeneration advances the pointer; prior successful artifacts remain retained  
- Failed regeneration does not displace the last successful current  
- Patient 360 / Report Detail / Reports worklist / Download resolve the same current artifact  
- ContentHash does not override the current pointer  
- Unavailable current artifact does not enable Preview/Download/Print affordances  

**Not implemented (out of scope):** schema/migrations, new services, CUT C contract changes, Pathology, Patient Portal, Report Number / Finalize / Release / retention policy, historical artifact UI, new permissions, D-D/D-E beyond this validation + Manual UAT handoff, D-C acceptance claim.

---

## 2. Files changed

| File | Change |
| --- | --- |
| `microservices/laboratory-service/LaboratoryApi.Tests/OfficialPdfServiceTests.cs` | Added D-C cross-surface currentness + ContentHash pointer tests |
| `apps/hospital-portal-web/src/lib/lms/lms-official-pdf-preview-eligibility.test.ts` | Added unavailable-metadata eligibility case |
| `docs/laboratory-management/enterprise-lms-report-preview-db-patient360-uat-evidence-and-acceptance-review.md` | D-B PO-attested Manual UAT reconciliation |
| `docs/laboratory-management/enterprise-lms-report-preview-db-acceptance-closure.md` | Formal D-B acceptance closure |
| `docs/laboratory-management/enterprise-lms-report-preview-dc-currentness-readiness-audit.md` | D-C readiness audit |
| `docs/laboratory-management/enterprise-lms-report-preview-dc-currentness-implementation-report.md` | This report |

**Application runtime source (services/UI/APIs):** **unchanged** — existing Official PDF / Patient 360 / Preview behavior already satisfied approved D-C product decisions; D-C filled automated validation gaps only.

---

## 3. API / database / permission impact

| Area | Impact |
| --- | --- |
| APIs / DTOs / Download contract | **None** |
| Database / schema / migrations | **None** |
| Permissions / role grants | **None** |
| Blob / SAS / public URLs | **None** — private authenticated path preserved |
| CanonicalDocument uniqueness | **None** — no second document created |
| Pathology / Patient Portal | **None** |
| Report lifecycle / Report Number / Finalize / Release | **None** |
| CUT C audit semantics | **None** |

---

## 4. Tests executed and actual results

### 4.1 Backend

```text
dotnet test "microservices/laboratory-service/LaboratoryApi.Tests/LaboratoryApi.Tests.csproj" --filter "FullyQualifiedName~OfficialPdfServiceTests"
```

**Result:** Passed — **Failed: 0, Passed: 36, Skipped: 0**

New D-C tests:

| Test | Scenario |
| --- | --- |
| `Currentness_ReportDetail_Worklist_Patient360_And_Download_Resolve_Same_Current_After_Regeneration` | After successful regen, Detail / worklist eligibility / Patient 360 / Download resolve the same current pointer; prior artifact retained |
| `Currentness_ContentHash_Does_Not_Override_Current_Pointer` | Shared ContentHash + later timestamp on superseded artifact does not displace pointer projection |

Preserved coverage (non-exhaustive): successful/failed regeneration, historical exclusion, no-current download denial, Option B branch omit, CUT C download regression, fail-closed audit, idempotency.

### 4.2 Frontend

```text
npx vitest run src/lib/lms/lms-official-pdf-preview-eligibility.test.ts `
  src/lib/patients/patient-360-lms-official-pdf.test.ts `
  src/components/patients/record/Patient360Documents.test.tsx `
  src/lib/lms/enterprise-lms-reports-ui.test.ts `
  src/components/lms/reports/ReportOfficialPdfPreview.test.tsx `
  src/lib/patients/patient-360-document-identity.test.ts
```

**Result:** 6 files · **65 passed / 0 failed**

New D-C FE case: Preview eligibility is false when pointer exists but current artifact metadata is unavailable.

---

## 5. Security and regression review

| Concern | Result |
| --- | --- |
| CUT C Download contract | **Unchanged** — regression tests still pass |
| Pathology | **Unchanged** — no Pathology source edits |
| Patient Portal | **Unchanged** / out of scope |
| Permissions | **Unchanged** |
| Schema | **Unchanged** |
| Public/SAS URL exposure | **Not introduced** — no content-path changes |
| Fail-closed audit | **Preserved** |

---

## 6. Remaining risks and limitations

- Live Manual UAT was Product Owner-attested (not agent-executed); fixture IDs were **not supplied** and **not invented**.  
- Whole CUT D acceptance remains **not claimed** pending D-D / D-E and remaining planned gates.

---

## 7. Manual UAT checklist (Product Owner)

**Environment prerequisites**

- Staff user with LMS report view/download permissions and Patient Directory access  
- Operating branch membership for the report’s `OperatingBranchId`  
- Released + numbered LMS report with a successful current Official PDF  
- Ability to regenerate Official PDF (successful path) and to observe a failed regeneration without displacing the prior current (safe UAT method as available in the environment)  
- Non-PHI fixtures only; do not commit PHI  

**Do not invent** report IDs, patient IDs, or branch IDs in the evidence record if not supplied.

| ID | Scenario | Expected |
| --- | --- | --- |
| UAT-DC-01 | Successful regeneration on a Released numbered report | New artifact becomes current; Report Detail shows new version as current |
| UAT-DC-02 | After successful regeneration, open Patient 360 → Documents → Laboratory | Only the new current Official PDF is shown (not the superseded artifact) |
| UAT-DC-03 | Failed regeneration (or controlled failure) after a successful current exists | Prior successful Official PDF remains current and visible; failed artifact is not offered as current |
| UAT-DC-04 | Preview / Download / Print after successful regeneration | All three use the same current Official PDF (report number / content consistent) |
| UAT-DC-05 | Report without a successful current Official PDF | Preview / Download / Print are not offered as working current-PDF actions |
| UAT-DC-06 | Reports worklist vs Report Detail vs Patient 360 | Same current Official PDF eligibility/currentness across surfaces |
| UAT-DC-07 | CUT C regression | Staff Download from Reports / Detail still works with existing authz; no SAS/public Blob URL |
| UAT-DC-08 | Pathology coexistence | Pathology Attach Report / legacy Pathology rows unchanged |
| UAT-DC-09 | Patient Portal spot-check | Patient Portal LMS Official PDF behavior remains unchanged / out of scope |

---

## 8. Status stamps

```text
D_B_ACCEPTANCE_RECORDED
D_C_IMPLEMENTATION_COMPLETE
D_C_AUTOMATED_TESTS_VERIFIED
D_C_MANUAL_UAT_PO_ATTESTED
ACCEPTANCE_COMPLETE_D_C
ACCEPTED_L_REP_03_CUT_D_C
ACCEPTED_L_REP_03_CUT_D_B
ACCEPTED_L_REP_02B
ACCEPTED_L_REP_03_CUT_A
ACCEPTED_L_REP_03_CUT_B
ACCEPTED_L_REP_03_CUT_C
ACCEPTED_L_REP_03_CUT_D_A
ACCEPTED_L_REP_03_CUT_D = FALSE
CUT_C_UNCHANGED
LEGACY_PATHOLOGY_UNCHANGED
PATIENT_PORTAL_OUT_OF_SCOPE
PD-D-BRANCH = OPTION_B_APPROVED
NEXT_GATE = D_D_AUTOMATED_TESTS
```

**Acceptance disposition (2026-10-13):** Formal closure recorded in [enterprise-lms-report-preview-dc-acceptance-closure.md](./enterprise-lms-report-preview-dc-acceptance-closure.md). Product Owner attested UAT-DC-01…09 tested manually, looked good, and all nine passed. Evidence reconciliation: [enterprise-lms-report-preview-dc-uat-evidence-and-acceptance-review.md](./enterprise-lms-report-preview-dc-uat-evidence-and-acceptance-review.md).

---

## 9. Mandatory stop

**STOP after D-C acceptance.**

Do **not** claim `ACCEPTED_L_REP_03_CUT_D` from D-C alone.  
Do **not** begin D-D in the acceptance-closure documentation task; D-D is the next authorized gate only.
