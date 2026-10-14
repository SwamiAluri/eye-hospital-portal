# L-REP-03 CUT D-C — Currentness / Regeneration Correctness  
# Readiness Audit

**Date:** 2026-10-13  
**Slice:** L-REP-03 CUT D-C — Current-artifact / regeneration projection correctness  
**Mode:** READINESS AUDIT — precedes bounded D-C validation implementation  
**Prerequisite:** `ACCEPTED_L_REP_03_CUT_D_B` recorded in [enterprise-lms-report-preview-db-acceptance-closure.md](./enterprise-lms-report-preview-db-acceptance-closure.md)

---

## 1. Purpose

Confirm that D-C scope is implementable under approved Product Decisions **PD-D-08…12** (and related currentness rules), identify existing authoritative behavior, and list only genuine validation gaps — without inventing new product requirements.

---

## 2. Authoritative sources

| Document | Role |
| --- | --- |
| [enterprise-lms-report-preview-patient360-product-decision-closure.md](./enterprise-lms-report-preview-patient360-product-decision-closure.md) | Binding PD-D-* |
| [enterprise-lms-report-preview-patient360-product-decision-package.md](./enterprise-lms-report-preview-patient360-product-decision-package.md) | D-C packaging = current-artifact / regeneration projection correctness |
| [enterprise-lms-report-preview-patient360-readiness-audit.md](./enterprise-lms-report-preview-patient360-readiness-audit.md) | Prior readiness (D-C Correctness checklist §12) |
| [enterprise-lms-report-preview-db-acceptance-closure.md](./enterprise-lms-report-preview-db-acceptance-closure.md) | `ACCEPTED_L_REP_03_CUT_D_B` |
| `OfficialPdfService` / `ReportService` / FE eligibility | Current implementation SoT |

Upstream stamps preserved: `ACCEPTED_L_REP_02B`, `ACCEPTED_L_REP_03_CUT_A`, `ACCEPTED_L_REP_03_CUT_B`, `ACCEPTED_L_REP_03_CUT_C`, `ACCEPTED_L_REP_03_CUT_D_A`, `ACCEPTED_L_REP_03_CUT_D_B`.

---

## 3. Approved D-C scope (PD-D-08…12)

| Decision | Approved requirement |
| --- | --- |
| PD-D-08 | `LmsReport.CurrentOfficialArtifactId` is MODEL A currentness SoT |
| PD-D-09 | Prior successful artifacts retained internally; not historical Patient 360 docs |
| PD-D-10 | Successful regeneration moves pointer; failed regeneration must not displace prior current |
| PD-D-11 | No physical Blob overwrite/delete on regeneration |
| PD-D-12 | Patient 360 exposes current LMS Official PDF only |
| PD-D-HASH-REUSE | ContentHash does not determine currentness/visibility |

**Out of D-C:** new schema/migrations, CUT C contract changes, Pathology, Patient Portal, Report Number / Finalize / Release / retention policy changes, historical artifact browser, new permissions, D-D/D-E as separate coding slices beyond validation tests + Manual UAT handoff.

---

## 4. Authoritative behavior verified in code

| Behavior | Evidence | Status |
| --- | --- | --- |
| Current pointer SoT | `OfficialPdfService` generation sets `report.CurrentOfficialArtifactId`; Download / Patient projection resolve only that id | **Present** |
| Successful generation advances pointer | Process job success path updates pointer to new artifact | **Present** |
| Prior artifacts retained | Multiple `LmsReportOfficialPdfArtifact` rows after regeneration; Blobs not deleted by regeneration path | **Present** |
| Failed regeneration restores / preserves prior | Failure path restores `previousCurrentArtifact`; pointer unchanged | **Present** |
| No current / non-Succeeded → not downloadable | `Download_Without_Current_Artifact_Denied`, `Download_Failed_Artifact_Denied` | **Present** |
| Patient 360 current-only | `ListPatientCurrentOfficialPdfsAsync` filters by pointer + Succeeded + CanonicalDocument | **Present** |
| Preview/Download/Print FE gate | `isLmsOfficialPdfPreviewEligible` requires Succeeded current artifact | **Present** |
| Worklist eligibility | `OfficialPdfDownloadEligible` uses current pointer + Succeeded + CanonicalDocument | **Present** |
| Branch / tenant / audit / CUT C | Option B omit, tenant filter, fail-closed audit, Download contract unchanged | **Present** (accepted D-B / CUT C) |

---

## 5. Existing automated coverage vs required scenarios

| # | Required scenario | Existing coverage | Gap? |
| --- | --- | --- | --- |
| 1 | Successful regeneration → new artifact current | `Regeneration_Increments_Artifact_Version`, `PatientProjection_Successful_Regeneration_Exposes_Only_New_Current` | **Covered** |
| 2 | Previous artifact retained, not projected as current | `PatientProjection_Excludes_Historical_Artifacts` (+ version count) | **Covered** |
| 3 | Failed regeneration → last successful remains current | `Failed_Generation_Preserves_Previous_Current_And_Invariants`, `PatientProjection_Failed_Regeneration_Keeps_Prior_Current` | **Covered** |
| 4 | No successful current → no working Preview/Download/Print | BE: `Download_Without_Current_Artifact_Denied`; FE: eligibility false without current / non-Succeeded | **Covered** |
| 5 | Patient 360 projects only current | Historical exclusion + successful regen tests | **Covered** |
| 6 | Reports worklist, Report Detail, Patient 360 resolve same current | Partial: Detail after first gen; Patient 360 after regen; **no single cross-surface assertion after regeneration** | **Gap — add test** |
| 7 | CUT C Download regression | `PatientProjection_CutC_Download_Behavior_Unchanged` + Download suite | **Covered** |
| 8 | Isolation / branch authz | Patient projection other-patient / Option B / bypass tests | **Covered** |
| 9 | Fail-closed audit | `Download_Audit_Failure_*` | **Covered** |
| 10 | Idempotency / concurrency | `Idempotency_Replay_And_Hash_Conflict`, `Active_Job_Returned_Without_Second_Job`, concurrency suite | **Covered** (no new D-C gap) |
| — | ContentHash does not override pointer | Hash asserted present; **no explicit “hash cannot displace pointer” assertion** | **Gap — add test** |

---

## 6. Product decision gaps

| Item | Status |
| --- | --- |
| Unapproved D-C requirement requiring Product Owner decision | **None** |
| Architecture / schema / API contract change required for D-C | **None** — validation-only under existing MODEL A |

**Conclusion:** D-C is **implementable** as bounded validation (tests + documentation + Manual UAT handoff). No new services, schema, permissions, or CUT C contract changes are authorized or required.

---

## 7. Bounded D-C implementation plan

1. Add backend tests for:
   - Cross-surface currentness consistency after successful regeneration (Report Detail `CurrentOfficialArtifact`, Patient 360 projection `ArtifactId`, Download opens current pointer).
   - ContentHash does not determine currentness (pointer wins over shared/copied hash on superseded artifact).
2. Confirm FE eligibility suite already covers unavailable current artifact (no duplicate FE feature work).
3. Re-run Official PDF / Patient 360 / Preview / Reports focused automated suites.
4. Produce D-C implementation report with Manual UAT checklist.
5. **STOP** for Product Owner Manual UAT — do not claim D-C acceptance.

---

## 8. Readiness decision

```text
D_B_ACCEPTANCE_RECORDED
D_C_SCOPE = PD-D-08…12 CURRENTNESS_AND_REGENERATION_VALIDATION
D_C_PRODUCT_DECISIONS = CLOSED_SUFFICIENT
D_C_SCHEMA_API_PERMISSION_CHANGES = NOT_REQUIRED
D_C_IMPLEMENTATION_AUTHORIZED = BOUNDED_VALIDATION_ONLY
NEXT_GATE = D_C_BOUNDED_IMPLEMENTATION
```

**No RED blockers. No unresolved product decisions.**
