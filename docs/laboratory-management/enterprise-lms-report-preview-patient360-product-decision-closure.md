# L-REP-03 CUT D — Official PDF Preview + Patient 360 Laboratory Integration  
# Product Decision Closure

**Date:** 2026-10-13  
**Slice:** L-REP-03 CUT D — Report Detail Preview + Patient 360 Current LMS Official PDF Discovery  
**Mode:** PRODUCT DECISION CLOSURE — documentation / Product Owner approval only  

**This task does not implement CUT D.**  
No application source, schema, migrations, APIs, DTOs, services, repositories, UI, routes, permission seed/grant changes, RolePermission seeders, audit allowlist changes, Blob/SAS/download endpoints, CanonicalDocument model changes, Blob storage changes, Report / ReportVersion / Report Number / Release / Result / Authorization changes, Pathology, Patient Portal, NotificationHub, retention, historical artifact APIs, Official PDF generation, CUT C download behavior, Implementation Readiness Audit execution, D-A / D-B / D-C / D-D / D-E coding, Manual UAT, or acceptance claims are authorized **in this task**.

---

## 1. Closure purpose

Formally close Product Owner decisions for **CUT D — Report Detail Preview + Patient 360 Current LMS Official PDF Discovery** after:

- metadata Release accepted (`ACCEPTED_L_REP_02B`)
- Report Number Foundation accepted (`ACCEPTED_L_REP_03_CUT_A`)
- Official PDF Artifact Foundation accepted (`ACCEPTED_L_REP_03_CUT_B`)
- Official PDF Staff Download accepted (`ACCEPTED_L_REP_03_CUT_C`)
- CUT D discovery completed (`DISCOVERY_COMPLETE`)
- Product Decision Review package completed (`PRODUCT_DECISION_REVIEW_COMPLETE`)
- Product Owner **explicitly approved** all recommended CUT D Product Decisions, with **PD-D-BRANCH = Option B**

Authorize a **future separate** implementation readiness audit for CUT D only, under the stamped rules herein.

Explicitly preserve certified L-REP-02B, L-REP-03 CUT A, CUT B, and CUT C.  
**Do not** reopen CUT C.  
**Do not** implement Preview, Patient 360 LMS projection, or any application change in this task.

---

## 2. Authoritative source

| Document | Role | Relationship to this closure |
| --- | --- | --- |
| [enterprise-lms-report-preview-patient360-product-decision-package.md](./enterprise-lms-report-preview-patient360-product-decision-package.md) | Product Decision Review / Decision Package | **Retained unchanged** as the detailed record of reviewed recommendations; superseded for stamped PD-D-* **approval state** by **this** closure |
| [enterprise-lms-report-preview-patient360-discovery-audit.md](./enterprise-lms-report-preview-patient360-discovery-audit.md) | Discovery / architecture audit | Evidence baseline (`DISCOVERY_COMPLETE`) |
| [enterprise-lms-report-staff-download-acceptance-closure.md](./enterprise-lms-report-staff-download-acceptance-closure.md) | Accepted CUT C | Frozen — not reopened |
| [enterprise-lms-report-official-pdf-acceptance-closure.md](./enterprise-lms-report-official-pdf-acceptance-closure.md) | Accepted CUT B | Frozen — not reopened |
| [enterprise-lms-report-number-foundation-acceptance-closure.md](./enterprise-lms-report-number-foundation-acceptance-closure.md) | Accepted CUT A | Frozen — not reopened |
| [enterprise-lms-report-release-acceptance-closure.md](./enterprise-lms-report-release-acceptance-closure.md) | Accepted L-REP-02B | Frozen — not reopened |

The Decision Package is **not** rewritten or replaced by this closure.

---

## 3. Explicit Product Owner approval statement

Product Owner has **explicitly approved**:

> Approve all CUT D Product Decisions as recommended, with  
> PD-D-BRANCH = Option B.

**Meaning:** The recommended decisions in the Product Decision Package are now **authoritative** for CUT D.  
**PD-D-BRANCH** is closed as **Option B** (server resolves Report `OperatingBranchId` and verifies the authenticated user is authorized for that branch).

| Class | Meaning |
| --- | --- |
| **APPROVED** | Product Owner stamped for CUT D |
| **CARRIED FORWARD** | Upstream certified principle preserved (not reopened) |
| **OUT_OF_SCOPE** | Explicitly outside CUT D |
| **TECHNICAL / READINESS** | Exact HTTP mapping, DTO shape, or wiring deferred to Implementation Readiness Audit |

No additional product decisions were invented. Recommendations were not silently altered (except recording the explicit Option B selection for PD-D-BRANCH).

---

## 4. Status

```text
PRODUCT_DECISION_REVIEW_COMPLETE
PRODUCT_OWNER_DECISIONS_APPROVED
PRODUCT_DECISION_CLOSURE_COMPLETE
PRODUCT_DECISIONS_CLOSED_L_REP_03_CUT_D_AUTHORIZED
CUT_D_IMPLEMENTATION_NOT_STARTED
MANUAL_UAT_NOT_STARTED
ACCEPTANCE_NOT_CLAIMED
NEXT_GATE = IMPLEMENTATION_READINESS_AUDIT
```

| Field | Value |
| --- | --- |
| Mode | PRODUCT DECISION CLOSURE |
| Closure stamp | `PRODUCT_DECISIONS_CLOSED_L_REP_03_CUT_D_AUTHORIZED` |
| Implementation | `CUT_D_IMPLEMENTATION_NOT_STARTED` |
| Manual UAT | `MANUAL_UAT_NOT_STARTED` |
| Acceptance | `ACCEPTANCE_NOT_CLAIMED` — do **not** claim `ACCEPTED_L_REP_03_CUT_D` |
| Next gate | `IMPLEMENTATION_READINESS_AUDIT` |

This stamp does **not** mean `CUT_D_IMPLEMENTATION_COMPLETE`, `MANUAL_UAT_PASSED`, `ACCEPTANCE_COMPLETE`, or `ACCEPTED_L_REP_03_CUT_D`.

**This document authorizes Product Decisions and a future separate implementation readiness audit; it does not itself authorize Cursor to modify application code in this task.**

---

## 5. Upstream baselines (preserved)

| Slice | Stamp | This closure |
| --- | --- | --- |
| L-REP-02B Report Release | `ACCEPTED_L_REP_02B` | **Remains accepted — not reopened** |
| L-REP-03 CUT A Report Number | `ACCEPTED_L_REP_03_CUT_A` | **Remains accepted — not reopened** |
| L-REP-03 CUT B Official PDF | `ACCEPTED_L_REP_03_CUT_B` | **Remains accepted — not reopened** |
| L-REP-03 CUT C Staff Download | `ACCEPTED_L_REP_03_CUT_C` | **Remains accepted — not reopened** |

```text
ACCEPTED_L_REP_02B
  ↓
ACCEPTED_L_REP_03_CUT_A
  ↓
ACCEPTED_L_REP_03_CUT_B
  ↓
ACCEPTED_L_REP_03_CUT_C  ← UNCHANGED / FROZEN
  ↓
CUT D discovery + Product Decision Review
  ↓
PD-D-* (THIS DOCUMENT) ← PRODUCT OWNER APPROVED
  ↓
L-REP-03 CUT D — AUTHORIZED FOR SEPARATE FUTURE IMPLEMENTATION READINESS AUDIT
  ← NOT IMPLEMENTED BY THIS DOCUMENT
```

---

## 6. Decision closure matrix

| ID | APPROVED decision (summary) | Status |
| --- | --- | --- |
| PD-D-01 | Report Detail Preview for current Official PDF (staff; reuse existing preview UX) | **APPROVED / CLOSED** |
| PD-D-02 | Preview current successful artifact only | **APPROVED / CLOSED** |
| PD-D-03 | Same authenticated content resolution boundary as Download | **APPROVED / CLOSED** |
| PD-D-04 | Staff Patient 360 Laboratory includes current LMS Official PDF projection | **APPROVED / CLOSED** |
| PD-D-05 | Distinct from legacy Pathology | **APPROVED / CLOSED** |
| PD-D-06 | `CanonicalDocument.PatientId = LmsReport.PatientId` (not sufficient authz alone) | **APPROVED / CLOSED** |
| PD-D-07 | Reuse `enterprise_lms` / `LmsReportOfficialPdfArtifact` / ArtifactId | **APPROVED / CLOSED** |
| PD-D-08 | MODEL A — `CurrentOfficialArtifactId` is currentness SoT | **APPROVED / CLOSED** |
| PD-D-09 | Retain prior successful artifacts internally | **APPROVED / CLOSED** |
| PD-D-10 | Regeneration moves visible current via pointer | **APPROVED / CLOSED** |
| PD-D-11 | No physical Blob overwrite/delete on regeneration | **APPROVED / CLOSED** |
| PD-D-12 | No historical Patient 360 LMS artifact visibility | **APPROVED / CLOSED** |
| PD-D-13 | No LMS authz bypass via `patient.view` / generic P360 | **APPROVED / CLOSED** |
| PD-D-14 | Patient Portal OUT OF SCOPE | **APPROVED / CLOSED** |
| PD-D-15 | No public/SAS/unauthenticated content URLs | **APPROVED / CLOSED** |
| PD-D-16 | No Pathology `lab`/`LabReport` association reuse | **APPROVED / CLOSED** |
| PD-D-17 | Prefer reuse existing LMS permissions; no new permission unless readiness proves required; no role grants | **APPROVED / CLOSED** |
| PD-D-18 | Report Detail Preview staff-only with LMS authz + branch boundary | **APPROVED / CLOSED** |
| PD-D-19 | Patient 360 remains discovery/projection — LMS remains SoT | **APPROVED / CLOSED** |
| PD-D-20 | Single CanonicalDocument — no second copy for Patient 360 | **APPROVED / CLOSED** |
| PD-D-BRANCH | **OPTION_B_APPROVED** — server resolves Report OperatingBranchId; verify user authorized for that branch | **APPROVED / CLOSED** |
| PD-D-PREVIEW-AUDIT | Reuse `DOWNLOAD_OFFICIAL_PDF` audit semantics unless later compliance requires distinct action | **APPROVED / CLOSED** |
| PD-D-CONTENT-DISPOSITION | Authenticated private content; object-URL after server authz; no public/SAS/direct Blob | **APPROVED / CLOSED** |
| PD-D-HASH-REUSE | ContentHash does not determine currentness/visibility; pointer lineage does | **APPROVED / CLOSED** |

**Total closed:** 24 decision items.

---

## 7. PD-D-01 through PD-D-20 (APPROVED)

### PD-D-01 — Report Detail Preview

| Field | Value |
| --- | --- |
| **APPROVED** | Report Detail **SHALL** provide a Preview action for the current successful Official PDF |
| Access | Staff-only |
| UX | Reuse existing Hospital Portal document preview UX/pattern; do **not** create a new PDF viewer |
| Status | **APPROVED / CLOSED** |

### PD-D-02 — Current successful artifact

| Field | Value |
| --- | --- |
| **APPROVED** | Preview **SHALL** resolve only the current successful Official PDF artifact |
| Authoritative lineage | `LmsReport` → `CurrentOfficialArtifactId` → `LmsReportOfficialPdfArtifact` → `CanonicalDocument` → private Blob |
| Failed artifacts | Never previewable as the current artifact |
| Status | **APPROVED / CLOSED** |

### PD-D-03 — Preview content resolution

| Field | Value |
| --- | --- |
| **APPROVED** | Preview **SHALL** use the same authenticated content resolution boundary as Official PDF Download |
| Forbidden | Separate public content path; SAS URLs; direct Blob exposure |
| Status | **APPROVED / CLOSED** |

### PD-D-04 — Patient 360 Laboratory projection

| Field | Value |
| --- | --- |
| **APPROVED** | Patient 360 → Documents → Laboratory **SHALL** include the current LMS Official PDF as a **staff** discovery/projection surface |
| Boundary | Additional LMS projection — **not** a replacement for legacy Pathology Laboratory documents |
| Status | **APPROVED / CLOSED** |

### PD-D-05 — Distinct from legacy Pathology

| Field | Value |
| --- | --- |
| **APPROVED** | LMS Official PDF documents **SHALL** remain distinct from legacy Pathology documents |
| Forbidden | Reuse of `lab` / `LabReport` for LMS Official PDF identity or association |
| Pathology | Behavior remains unchanged |
| Status | **APPROVED / CLOSED** |

### PD-D-06 — Patient identity

| Field | Value |
| --- | --- |
| **APPROVED** | LMS Official PDF CanonicalDocument **SHALL** use `CanonicalDocument.PatientId = LmsReport.PatientId` |
| Security | PatientId alone **MUST NOT** be treated as sufficient authorization |
| Remaining gates | Tenant, report, artifact, association, lifecycle, permission, branch authorization |
| Status | **APPROVED / CLOSED** |

### PD-D-07 — Existing LMS CanonicalDocument association

| Field | Value |
| --- | --- |
| **APPROVED** | Reuse existing LMS-specific association |
| Domain | `enterprise_lms` |
| Entity type | `LmsReportOfficialPdfArtifact` |
| Entity ID | Official Artifact ID |
| Storage | Do **not** create a second CanonicalDocument copy solely for Patient 360 |
| Status | **APPROVED / CLOSED** |

### PD-D-08 — Currentness model (MODEL A)

| Field | Value |
| --- | --- |
| **APPROVED** | **MODEL A** — `LmsReport.CurrentOfficialArtifactId` is the authoritative currentness/visibility pointer |
| Do **not** derive currentness from | `CanonicalDocument.Status`; ContentHash; upload date; artifact version alone; PatientId alone |
| Status | **APPROVED / CLOSED** |

### PD-D-09 — Retain prior successful artifacts

| Field | Value |
| --- | --- |
| **APPROVED** | Prior successful Official PDF artifacts **SHALL** remain retained internally |
| Patient 360 | They **SHALL NOT** automatically become visible as historical documents |
| Status | **APPROVED / CLOSED** |

### PD-D-10 — Regeneration visibility

| Field | Value |
| --- | --- |
| **APPROVED** | Successful regeneration moves `CurrentOfficialArtifactId` to the new artifact; Patient 360 shows the new current only |
| Failure | Prior current remains; failed artifact **MUST NOT** become current |
| Status | **APPROVED / CLOSED** |

### PD-D-11 — No physical Blob overwrite/delete

| Field | Value |
| --- | --- |
| **APPROVED** | Regeneration **SHALL NOT** physically overwrite or delete the previous artifact Blob |
| Status | **APPROVED / CLOSED** |

### PD-D-12 — No historical Patient 360 visibility

| Field | Value |
| --- | --- |
| **APPROVED** | Patient 360 Laboratory projection **SHALL** expose the current LMS Official PDF only |
| History | Complete LMS artifact history remains LMS-owned; not exposed via Patient 360 |
| Status | **APPROVED / CLOSED** |

### PD-D-13 — No LMS authorization bypass

| Field | Value |
| --- | --- |
| **APPROVED** | Patient 360 **SHALL NOT** bypass LMS authorization via `patient.view` or generic Patient 360 visibility alone |
| Authority | LMS authorization boundary remains authoritative |
| Status | **APPROVED / CLOSED** |

### PD-D-14 — Patient Portal out of scope

| Field | Value |
| --- | --- |
| **APPROVED** | CUT D does **not** publish LMS Official PDFs to the Patient Portal |
| Status | **APPROVED / CLOSED** · **OUT_OF_SCOPE** for patient-facing access |

### PD-D-15 — No public/SAS URL

| Field | Value |
| --- | --- |
| **APPROVED** | Content remains private through the authenticated application boundary |
| Forbidden | SAS URLs; public Blob URLs; unauthenticated download/preview |
| Status | **APPROVED / CLOSED** |

### PD-D-16 — No Pathology association reuse

| Field | Value |
| --- | --- |
| **APPROVED** | Do **not** associate LMS Official PDFs through `lab` / `LabReport` |
| Status | **APPROVED / CLOSED** |

### PD-D-17 — Permissions

| Field | Value |
| --- | --- |
| **APPROVED** | Prefer reuse of the existing LMS permission model (catalogue: `lms.reports.download` for content; evaluate `lms.reports.view` for list/projection as readiness specifies) |
| New permission | Do **not** create unless Implementation Readiness later proves required by these approved decisions |
| Role grants | **None** authorized by this closure — no silent role grants |
| Status | **APPROVED / CLOSED** |

### PD-D-18 — Report Detail Preview access

| Field | Value |
| --- | --- |
| **APPROVED** | Report Detail Preview is staff-only |
| Boundary | Same LMS authorization and branch boundary defined for the approved implementation (including PD-D-BRANCH Option B) |
| Status | **APPROVED / CLOSED** |

### PD-D-19 — Patient 360 is a projection

| Field | Value |
| --- | --- |
| **APPROVED** | Patient 360 remains a discovery/projection surface |
| Not SoT for | Report state; Report Version; Official PDF currentness; Artifact history; Authorization; Report lifecycle |
| Authority | LMS (LaboratoryApi) remains authoritative |
| Status | **APPROVED / CLOSED** |

### PD-D-20 — Single CanonicalDocument

| Field | Value |
| --- | --- |
| **APPROVED** | Reuse the existing CanonicalDocument created for the LMS Official PDF artifact |
| Forbidden | Second CanonicalDocument merely for Patient 360 |
| Status | **APPROVED / CLOSED** |

---

## 8. PD-D-BRANCH = OPTION_B_APPROVED

```text
PD-D-BRANCH = OPTION_B_APPROVED
```

| Field | Value |
| --- | --- |
| **APPROVED option** | **Option B** |
| Meaning | The server **SHALL** resolve the Report’s authoritative `OperatingBranchId` from the Report/LMS source of truth and verify that the current authenticated user is authorized for that branch |
| Forbidden | Weakening the existing CUT C authorization model; trusting an arbitrary client-supplied branch ID as the **sole** authorization decision |
| Must preserve | Tenant authorization; report eligibility; current artifact eligibility; LMS permission; operating branch authorization; authenticated user context |
| Authoritative branch | Server-side Report `OperatingBranchId` |
| Status | **APPROVED / CLOSED** |

---

## 9. PD-D-PREVIEW-AUDIT — APPROVED

| Field | Value |
| --- | --- |
| **APPROVED** | Reuse existing `DOWNLOAD_OFFICIAL_PDF` audit semantics for Preview unless a later compliance requirement explicitly requires a distinct audit action |
| Forbidden | Inventing a second audit model without that compliance trigger |
| Requirement | Preview operation must remain auditable; fail-closed audit behavior remains where already required for protected Official PDF content access |
| Status | **APPROVED / CLOSED** |

---

## 10. PD-D-CONTENT-DISPOSITION — APPROVED

| Field | Value |
| --- | --- |
| **APPROVED** | Use authenticated private content resolution |
| Preview delivery | Authenticated object / object-URL style browser delivery **only after** server-side authorization |
| Forbidden | Public URL; SAS; direct Blob access |
| Status | **APPROVED / CLOSED** |

---

## 11. PD-D-HASH-REUSE — APPROVED

| Field | Value |
| --- | --- |
| **APPROVED** | ContentHash **SHALL NOT** determine currentness or Patient 360 visibility |
| Visibility SoT | `LmsReport.CurrentOfficialArtifactId` lineage |
| ContentHash role | Artifact metadata / integrity information only |
| Status | **APPROVED / CLOSED** |

---

## 12. Security invariants

Any future CUT D implementation authorized after readiness audit **must** preserve:

| # | Invariant |
| --- | --- |
| 1 | No arbitrary ReportId authorization without LMS gates |
| 2 | No arbitrary ArtifactId authorization from the browser |
| 3 | No PatientId-only authorization |
| 4 | Tenant boundary enforced |
| 5 | Report lifecycle eligibility enforced (Released + Business Report Number + current Succeeded artifact as applicable) |
| 6 | Current Official Artifact eligibility enforced |
| 7 | Artifact status must be Succeeded for current visibility |
| 8 | LMS CanonicalDocument association validated (`enterprise_lms` / `LmsReportOfficialPdfArtifact`) |
| 9 | Existing LMS permission boundary preserved |
| 10 | Operating branch authorization server-resolved and enforced (PD-D-BRANCH Option B) |
| 11 | No historical artifact access through Patient 360 |
| 12 | No direct Blob access |
| 13 | No SAS / public URLs |
| 14 | No Patient Portal exposure |
| 15 | No legacy Pathology authorization shortcut |
| 16 | No silent role grants |
| 17 | Audit behavior remains fail-closed where already required |

---

## 13. UX boundaries

Preserve the existing Hospital Portal design system.

### Report Detail

- Add Preview during **future** implementation (D-A) — not in this closure  
- Reuse the existing Patient 360 document preview pattern where technically appropriate  
- Do **not** create a new PDF viewer  

### Patient 360

Documents → Laboratory may contain:

1. Existing legacy Pathology documents  
2. Current LMS Official PDF documents  

Sources must remain distinguishable. Do **not** redesign the entire Documents experience. Do **not** modify existing Pathology UI behavior.

Patient 360 All aggregation/deduplication must be handled carefully during implementation so the same CanonicalDocument is not duplicated merely because it is visible through multiple projections.

---

## 14. Regeneration contract

**Authoritative product contract:**

| Phase | Current pointer | Patient 360 Laboratory |
| --- | --- | --- |
| Initial | V1 = successful / current | Shows V1 |
| Regeneration succeeds | V2 = successful / current | Shows V2; V1 retained internally |
| Regeneration fails | V1 remains current | Continues showing V1; failed artifact never current |

**Source of truth for current Official PDF visibility:**

```text
CURRENT OFFICIAL ARTIFACT POINTER
= LmsReport.CurrentOfficialArtifactId
```

Do **not** use `CanonicalDocument.Status`, ContentHash, created timestamp, or artifact version alone to determine which LMS PDF is currently visible.

---

## 15. Legacy Pathology boundary

```text
LEGACY PATHOLOGY = UNCHANGED
```

Do **not**:

- modify legacy `LabReport`
- modify legacy lab associations
- dual-write
- migrate Pathology data
- redirect Pathology routes
- merge Pathology and LMS Report aggregates
- reuse legacy LabReport as LMS identity

---

## 16. Patient Portal boundary

```text
PATIENT PORTAL = OUT OF SCOPE
```

No patient-facing LMS Official PDF access is authorized by CUT D.

---

## 17. Implementation packaging (D-A through D-E)

**Future packaging only — not started by this closure:**

| Sub-slice | Scope |
| --- | --- |
| **D-A** | Report Detail Preview |
| **D-B** | Patient 360 current LMS Laboratory projection |
| **D-C** | Currentness / regeneration correctness validation |
| **D-D** | Automated tests |
| **D-E** | Manual UAT |

**Ordering:**

1. **D-A first**  
2. **D-B** only after authorization and branch rules (including PD-D-BRANCH Option B) are implemented and verified  
3. Do **not** combine D-A and D-B into an uncontrolled broad change  
4. Do **not** implement D-A or D-B in this closure  

---

## 18. Explicit out-of-scope items

| Item | Status |
| --- | --- |
| Patient Portal / patient publication | OUT |
| NotificationHub / email / SMS / WhatsApp | OUT |
| SAS / public / raw Blob URLs | OUT |
| Historical Official PDF browser in Patient 360 | OUT |
| Amendments / Unrelease / Revoke | OUT |
| Retention enforcement | OUT |
| Pathology dual-write / association reuse | OUT |
| New PDF viewer package / Documents redesign | OUT |
| Changing CUT C download contract | OUT |
| Production RolePermission seed grants | OUT |
| Application / schema / migration / API / UI coding in this task | OUT |
| Manual UAT / acceptance claim in this task | OUT |

---

## 19. Acceptance / UAT gate

| Gate | Status |
| --- | --- |
| Product Decision Review | **COMPLETE** |
| Product Owner approval | **COMPLETE** |
| Product Decision Closure | **COMPLETE** |
| CUT D implementation | **NOT STARTED** |
| Implementation Readiness Audit | **NEXT GATE** |
| Manual UAT | **NOT STARTED** |
| Acceptance | **NOT CLAIMED** |

**Not stamped (future only):**

- `CUT_D_IMPLEMENTATION_COMPLETE`
- `MANUAL_UAT_PASSED`
- `ACCEPTANCE_COMPLETE`
- `ACCEPTED_L_REP_03_CUT_D`

---

## 20. Final status

```text
PRODUCT_DECISION_REVIEW = COMPLETE
PRODUCT_OWNER_APPROVAL = COMPLETE
PRODUCT_DECISION_CLOSURE = COMPLETE
CUT_D_IMPLEMENTATION = NOT STARTED
IMPLEMENTATION_READINESS_AUDIT = NEXT GATE
MANUAL_UAT = NOT STARTED
ACCEPTANCE = NOT CLAIMED
```

This closure authorizes the **Product Decisions**.  
It does **not** authorize Cursor to begin implementation automatically.  
The next task is **IMPLEMENTATION READINESS AUDIT**.  
Only after that readiness audit should implementation begin.

---

## 21. Final decision stamps

```text
PRODUCT_DECISION_REVIEW_COMPLETE
PRODUCT_OWNER_DECISIONS_APPROVED
PRODUCT_DECISION_CLOSURE_COMPLETE
PRODUCT_DECISIONS_CLOSED_L_REP_03_CUT_D_AUTHORIZED
CUT_D_IMPLEMENTATION_NOT_STARTED
MANUAL_UAT_NOT_STARTED
ACCEPTANCE_NOT_CLAIMED
NEXT_GATE = IMPLEMENTATION_READINESS_AUDIT

ACCEPTED_L_REP_02B
ACCEPTED_L_REP_03_CUT_A
ACCEPTED_L_REP_03_CUT_B
ACCEPTED_L_REP_03_CUT_C

PD-D-BRANCH = OPTION_B_APPROVED
LEGACY_PATHOLOGY = UNCHANGED
PATIENT_PORTAL = OUT_OF_SCOPE
```
