# L-REP-03 CUT D-B — Manual UAT Evidence Review and Acceptance Decision

**Date:** 2026-10-13  
**Slice:** L-REP-03 CUT D-B — Patient Directory → Patient 360 → Documents current LMS Official PDF  
**Mode:** DOCUMENTATION / EVIDENCE RECONCILIATION / ACCEPTANCE REVIEW ONLY — no application code, API, schema, permission, or UI changes  

**Review revision:** Product Owner-attested Manual UAT reconciliation for the six previously outstanding criteria (2026-10-13)

### Reconciliation revision note (2026-10-13) — Product Owner-attested Manual UAT

The Product Owner has **explicitly confirmed** that the remaining D-B Manual UAT checks were **tested manually through the UI** and are **looking good**.

That statement is recorded as **Product Owner attestation** for the six previously outstanding criteria. It is distinct from the earlier checklist-only selection (which supplied no functional attestation and was correctly held as `RESULT_UNVERIFIED`).

**Evidence discipline retained:**

- These six results are labeled **Product Owner-attested Manual UAT**.
- This review does **not** claim independent verification of browser network traces, server logs, fixture IDs, or runtime security tests.
- Report IDs, Report Numbers, branches, patient identifiers, and test outputs were **not supplied** and are **not invented**.
- Automated test evidence remains historical (prior verified run) and is kept distinct from Manual UAT.

---

## 1. Purpose

Classify every D-B Manual UAT criterion using **only** available evidence. Keep evidence categories distinct:

| Status | Meaning |
| --- | --- |
| `PASS — PRODUCT OWNER ATTESTED (LIVE UI)` | Explicit Product Owner functional attestation and/or PO-supplied screenshots of live Patient Directory UI behavior |
| `PASS — PRODUCT OWNER-ATTESTED MANUAL UAT` | Explicit Product Owner confirmation that the criterion was tested manually in the UI and looked good |
| `PASS — AUTOMATED TEST EVIDENCE` | Covered by verified automated suite results (prior focused re-run; not re-executed in this reconciliation) |
| `NOT TESTED` | No explicit PO confirmation for that action/criterion, and no applicable verified automated evidence for that exact claim |
| `FAIL` | Explicit failure (none recorded) |
| `BLOCKED` | Cannot execute (none recorded) |

**Acceptance rule applied:** Stamp `ACCEPTED_L_REP_03_CUT_D_B` when every mandatory D-B acceptance criterion has sufficient evidence (explicit Product Owner confirmation **or** actual verified evidence for that criterion). Do **not** invent product decisions. Do **not** invent fixture identifiers or network captures.

---

## 2. Documents inspected

| Document | Role |
| --- | --- |
| [enterprise-lms-report-preview-patient360-db-implementation-report.md](./enterprise-lms-report-preview-patient360-db-implementation-report.md) | D-B implementation + Manual UAT handoff §11 |
| [enterprise-lms-report-preview-db-patient360-visibility-fix-report.md](./enterprise-lms-report-preview-db-patient360-visibility-fix-report.md) | Visibility-gap fix + checklist §12 + prior automated counts |
| This document | D-B UAT evidence / acceptance review — PO-attested reconciliation |
| [enterprise-lms-report-preview-patient360-product-decision-closure.md](./enterprise-lms-report-preview-patient360-product-decision-closure.md) | Binding PD-D-* (Option B, current pointer, Pathology/Portal out of scope) |
| [enterprise-lms-report-preview-patient360-readiness-audit.md](./enterprise-lms-report-preview-patient360-readiness-audit.md) | Readiness / future Manual UAT matrix reference |
| [enterprise-lms-report-preview-da-acceptance-closure.md](./enterprise-lms-report-preview-da-acceptance-closure.md) | `ACCEPTED_L_REP_03_CUT_D_A` — preserved; not reopened |
| [enterprise-lms-report-staff-download-acceptance-closure.md](./enterprise-lms-report-staff-download-acceptance-closure.md) | `ACCEPTED_L_REP_03_CUT_C` — frozen |
| [enterprise-lms-report-preview-db-acceptance-closure.md](./enterprise-lms-report-preview-db-acceptance-closure.md) | Formal D-B acceptance closure (created after this reconciliation) |

**Naming note:** Repository D-B UAT evidence file is this `…-db-patient360-uat-evidence-and-acceptance-review.md` path. No prior D-B acceptance closure existed before this reconciliation.

---

## 3. Product Owner-attested live UI results (2026-10-13)

**Class:** Product Owner Manual UAT — live Patient Directory UI, same patient used in LMS Reports.  
**Evidence form:** Three Product Owner-supplied screenshots + explicit statement that screenshots were obtained by manually testing the UI and that Laboratory-related UI behavior is working as expected.

### 3.1 Explicitly attested / demonstrated (preserved)

| Observation | Evidence class | Result |
| --- | --- | --- |
| Patient 360 → Documents → **Laboratory** shows LMS Official PDF rows alongside the existing Pathology row | Product Owner-attested live UI + screenshots | **PASS** |
| LMS rows show report-number-based PDF filename, Type `LMS Official PDF`, Source `Enterprise LMS Laboratory`, Released status, and Preview / Download / Print actions | Product Owner-attested live UI + screenshots | **PASS** |
| Preview opens a document viewer showing the Official Laboratory Report and its report number | Product Owner-attested live UI + screenshots | **PASS** |
| Print opens the browser print interface for the displayed PDF | Product Owner-attested live UI + screenshots | **PASS** |
| Existing Pathology **Attach Report** remains available separately | Product Owner-attested live UI + screenshots | **PASS** |

### 3.2 Six outstanding criteria — Product Owner-attested Manual UAT (2026-10-13)

| Criterion | Product Owner attestation | Evidence classification | Result |
| --- | --- | --- | --- |
| Downloaded PDF matches the PDF shown in Preview | Tested manually through the UI; looking good | **Product Owner-attested Manual UAT** | **PASS** |
| The All tab contains the LMS document only once | Tested manually through the UI; looking good | **Product Owner-attested Manual UAT** | **PASS** |
| Patient isolation is correct | Tested manually through the UI; looking good | **Product Owner-attested Manual UAT** | **PASS** |
| Unauthorized-branch denial works | Tested manually through the UI; looking good | **Product Owner-attested Manual UAT** | **PASS** |
| No public or SAS Blob URL is exposed | Tested manually through the UI; looking good | **Product Owner-attested Manual UAT** | **PASS** |
| Patient Portal remains unchanged | Tested manually through the UI; looking good | **Product Owner-attested Manual UAT** | **PASS** |

**Limitation acknowledged:** Criterion-specific observation narratives, browser Network captures, server logs, and non-PHI fixture identifiers were **not supplied** and are **not invented**. Acceptance proceeds on explicit Product Owner confirmation that these checks were tested manually in the UI and looked good — the same attestation class used for D-A closure when fixture IDs were not supplied.

### 3.3 Fixture identifiers

| Item | Status |
| --- | --- |
| Patient ID / MRN / Report ID / Artifact ID / Branch ID from Product Owner | **Not supplied** — **not invented** |
| Non-PHI local DB sample identifiers already documented in visibility-fix report §3 | Available for ops reference only; **not** claimed as the PO UI fixture |

### 3.4 Historical note — prior checklist-only selection

Earlier on 2026-10-13, the six items were marked checked without functional attestation and were correctly held as `RESULT_UNVERIFIED — OBSERVATION DETAILS NOT SUPPLIED`. That classification is **superseded** by the Product Owner's explicit Manual UAT confirmation recorded in §3.2.

---

## 4. Preserved product decisions and upstream stamps (not reopened)

| Decision | Status |
| --- | --- |
| `PD-D-BRANCH = OPTION_B_APPROVED` | Binding |
| Current artifact = `LmsReport.CurrentOfficialArtifactId` | Binding |
| Failed regeneration must not replace prior successful current | Binding |
| No second CanonicalDocument for Patient 360 LMS projection | Binding |
| Legacy Pathology unchanged | Binding |
| Patient Portal out of scope | Binding |
| CUT C Download unchanged | Binding |
| No new permissions / role grants / unrelated work | Binding |

Upstream stamps preserved: `ACCEPTED_L_REP_02B`, `ACCEPTED_L_REP_03_CUT_A`, `ACCEPTED_L_REP_03_CUT_B`, `ACCEPTED_L_REP_03_CUT_C`, `ACCEPTED_L_REP_03_CUT_D_A`.

---

## 5. Automated test evidence (preserved — prior verified run)

Focused suites were **re-run** on 2026-10-13 in a prior reconciliation revision. **This Product Owner Manual UAT reconciliation did not re-execute those suites.** The recorded results below remain the last verified automated evidence and are **preserved unchanged**, including their stated limitations.

### 5.1 Backend

```text
dotnet test "microservices/laboratory-service/LaboratoryApi.Tests/LaboratoryApi.Tests.csproj" --filter "FullyQualifiedName~OfficialPdfServiceTests"
```

**Result:** Passed — **Failed: 0, Passed: 34, Skipped: 0**

Verified projection / integrity coverage includes (non-exhaustive):

| Concern | Representative test |
| --- | --- |
| Current-artifact projection | `PatientProjection_Eligible_Current_Official_Pdf_Is_Projected` |
| Historical / previous artifact exclusion | `PatientProjection_Excludes_Historical_Artifacts` |
| Successful regeneration → only new current | `PatientProjection_Successful_Regeneration_Exposes_Only_New_Current` |
| Failed regeneration preserves prior current | `PatientProjection_Failed_Regeneration_Keeps_Prior_Current` |
| Other-patient isolation | `PatientProjection_Other_Patient_Report_Not_Returned` |
| Unauthorized-branch omit (Option B) | `PatientProjection_Unauthorized_Branch_Excluded_Option_B` |
| No client-branch list bypass + CUT C branch equality | `PatientProjection_Does_Not_Accept_Client_Branch_Bypass` |
| CUT C Download regression after projection | `PatientProjection_CutC_Download_Behavior_Unchanged` |

### 5.2 Frontend

```text
npx vitest run src/lib/patients/patient-360-lms-official-pdf.test.ts `
  src/components/patients/record/Patient360Documents.test.tsx `
  src/lib/lms/enterprise-lms-reports-ui.test.ts `
  src/lib/lms/lms-official-pdf-preview-eligibility.test.ts `
  src/components/lms/reports/ReportOfficialPdfPreview.test.tsx `
  src/lib/patients/patient-360-document-identity.test.ts
```

**Result:** 6 files · **64 passed / 0 failed**

Verified FE coverage includes (non-exhaustive): LMS Laboratory merge/labeling, Pathology Attach Report coexistence, All-tab LMS CanonicalDocument dedup unit behavior, authenticated `downloadLmsOfficialPdf` wiring (no `patient.view` content authz), D-A Preview regression retained.

### 5.3 What automated evidence does **not** prove

- Independent re-verification of Product Owner live Manual UAT observations  
- Agent-captured browser Network traces or server logs for SAS/public URL absence  
- Live regeneration pointer switch in Patient 360 UI (tracked under D-C Manual UAT)

Those items remain outside agent-independent verification; §3.2 records Product Owner attestation for the six Manual UAT criteria.

---

## 6. D-B UAT matrix (Product Owner-attested reconciliation)

| Criterion | Status | Evidence category | Notes |
| --- | --- | --- | --- |
| Laboratory filter discovery | `PASS` | Product Owner-attested live UI | **Preserved** — Documents → Laboratory shows LMS Official PDF rows with Pathology |
| LMS Official PDF metadata and actions | `PASS` | Product Owner-attested live UI | **Preserved** — Filename/`LMS Official PDF`/`Enterprise LMS Laboratory`/Released + Preview·Download·Print visible |
| Preview renders the expected Official PDF | `PASS` | Product Owner-attested live UI | **Preserved** — Viewer shows Official Laboratory Report + report number |
| Download behavior and comparison with Preview | `PASS` | **Product Owner-attested Manual UAT** | Downloaded PDF matches Preview (PO UI attestation) |
| Print behavior | `PASS` | Product Owner-attested live UI | **Preserved** — Browser print interface for displayed PDF |
| Pathology Attach Report coexistence | `PASS` | Product Owner-attested live UI | **Preserved** — Attach Report remains separately available |
| All-tab CanonicalDocument uniqueness | Live: `PASS` (PO-attested); Automated: `PASS — AUTOMATED` | Product Owner-attested Manual UAT + automated | LMS document appears once on All; FE dedup evidence preserved separately |
| Other-patient isolation | Live: `PASS` (PO-attested); Automated: `PASS — AUTOMATED` | Product Owner-attested Manual UAT + automated | Patient isolation correct; BE exclusion test preserved separately |
| Unauthorized-branch denial | Live: `PASS` (PO-attested); Automated: `PASS — AUTOMATED` | Product Owner-attested Manual UAT + automated | Unauthorized-branch denial works; BE Option B omit preserved separately |
| No public/SAS URL exposure | `PASS` | **Product Owner-attested Manual UAT** | No public/SAS Blob URL exposed (PO UI attestation; no agent Network capture claimed) |
| Patient Portal unchanged | `PASS` | **Product Owner-attested Manual UAT** | Patient Portal remains unchanged; out of scope per PD-D-14 |
| Current-artifact / regeneration behavior | `PASS — AUTOMATED` / live `NOT TESTED` | Automated test evidence | **Preserved** — Successful regen exposes only new current; failed regen keeps prior current; historical excluded. Live UI regen deferred to D-C Manual UAT |
| CUT C Download contract unchanged | `PASS — AUTOMATED` | Automated test evidence | **Preserved** — `PatientProjection_CutC_Download_Behavior_Unchanged` + retained Download suite coverage |

**FAIL / BLOCKED:** none recorded.

---

## 7. Acceptance decision

### DECISION: **ACCEPT** `ACCEPTED_L_REP_03_CUT_D_B`

**Justification:**

1. Earlier Product Owner Manual UAT remains sufficient for Laboratory discovery / metadata / Preview / Print / Pathology coexistence.  
2. Prior verified automated suites remain recorded for projection currentness, regeneration pointer behavior, other-patient exclusion, Option B branch omit, All-tab LMS CanonicalDocument dedup wiring, and CUT C Download regression.  
3. The Product Owner has explicitly confirmed that the six remaining Manual UAT checks were tested manually through the UI and looked good — recorded as **Product Owner-attested Manual UAT PASS**.  
4. No FAIL / BLOCKED criteria and no unresolved Product Decision blockers.

| Item | Result |
| --- | --- |
| D-B acceptance closure document | **Created** — [enterprise-lms-report-preview-db-acceptance-closure.md](./enterprise-lms-report-preview-db-acceptance-closure.md) |
| Stamp `ACCEPTED_L_REP_03_CUT_D_B` | **Applied** (D-B only) |
| Stamp `ACCEPTED_L_REP_03_CUT_D` | **Not applied** |
| Whole CUT D acceptance | **Not claimed** |

---

## 8. Scope confirmation (this documentation task)

| Area | Status |
| --- | --- |
| Application code / APIs / schema / permissions | **Unchanged** (this reconciliation) |
| CUT C Download | **Unchanged** (frozen accepted) |
| Pathology Attach Report | **Unchanged** (PO coexistence confirmed) |
| Patient Portal | **Unchanged** / out of scope |
| Whole CUT D acceptance | **Not claimed** |

---

## 9. Status stamps

```text
PRODUCT_DECISIONS_CLOSED_L_REP_03_CUT_D_AUTHORIZED
ACCEPTED_L_REP_03_CUT_D_A
D_B_VISIBILITY_FIX_IMPLEMENTED
D_B_AUTOMATED_TESTS_VERIFIED_2026_10_13
D_B_MANUAL_UAT_PO_ATTESTED_PARTIAL_LABORATORY_UI
D_B_MANUAL_UAT_PO_ATTESTED_SIX_REMAINING_CHECKS
D_B_MANUAL_UAT_COMPLETE
ACCEPTED_L_REP_03_CUT_D_B
ACCEPTED_L_REP_03_CUT_D = FALSE
CUT_C_UNCHANGED
LEGACY_PATHOLOGY_UNCHANGED
PATIENT_PORTAL_OUT_OF_SCOPE
PD-D-BRANCH = OPTION_B_APPROVED
ACCEPTED_L_REP_02B
ACCEPTED_L_REP_03_CUT_A
ACCEPTED_L_REP_03_CUT_B
ACCEPTED_L_REP_03_CUT_C
NEXT_GATE = D_C_READINESS_AUDIT
```

---

## 10. Next gate

```text
NEXT_GATE = D_C_READINESS_AUDIT
```

D-B is accepted. Whole CUT D remains **not** accepted.  
Proceed to D-C (currentness / regeneration correctness validation) under approved Product Decisions PD-D-08…12.
