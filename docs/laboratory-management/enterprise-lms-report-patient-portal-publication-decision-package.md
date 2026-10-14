# L-REP-04 — Patient Portal LMS Official PDF Publication  
# Product Decision Review Package

**Date:** 2026-10-13  
**Mode:** PRODUCT DECISION REVIEW RECORD — retained; approval state superseded by Product Decision Closure  
**Prerequisite recommendation:** [enterprise-lms-post-cut-d-next-concept-readiness-audit.md](./enterprise-lms-post-cut-d-next-concept-readiness-audit.md)  
**Authoritative closure:** [enterprise-lms-report-patient-portal-publication-product-decision-closure.md](./enterprise-lms-report-patient-portal-publication-product-decision-closure.md)  
**Readiness audit:** [enterprise-lms-report-patient-portal-publication-readiness-audit.md](./enterprise-lms-report-patient-portal-publication-readiness-audit.md)  
**Upstream frozen:** `ACCEPTED_L_REP_03_CUT_D`, `ACCEPTED_L_REP_03_CUT_C`, `ACCEPTED_L_REP_02B`, and earlier Report slices  

```text
POST_CUT_D_NEXT_CONCEPT_READINESS_AUDIT_COMPLETE
  ↓
THIS PACKAGE — Product Decision Review (history retained)
  ↓
PRODUCT_DECISIONS_CLOSED_L_REP_04_AUTHORIZED  (closure document)
  ↓
IMPLEMENTATION_READINESS_AUDIT
  ↓
IMPLEMENTATION_NOT_AUTHORIZED until PO clears blockers + authorizes
```

**Status of PD-PP-01…12:** `APPROVED` by Product Owner (project conversation). Authoritative detail lives in the **Product Decision Closure**. This package retains the original questions/options for audit trail.

---

## 1. Purpose

Prepare and record Product Owner decisions for **Patient Portal LMS Official PDF Publication** (`L-REP-04`) after staff Official PDF Preview / Download / Patient 360 discovery were accepted in CUT D.

CUT D explicitly stamped **Patient Portal OUT OF SCOPE** (`PD-D-14`). Portal publication is a **separate prospective slice**, not part of accepted CUT D. This package does **not** authorize implementation.

---

## 2. Problem statement

Staff can generate, download, preview, and discover the current LMS Official PDF. Patients using Patient Portal do **not** yet have a governed LMS Official PDF publication path (Portal results remain non-LMS / mock per repository evidence). Release metadata alone must not imply patient visibility.

---

## 3. Evidence baseline (do not reopen)

| Item | Status |
| --- | --- |
| Currentness SoT | `LmsReport.CurrentOfficialArtifactId` (MODEL A) |
| Staff Download | CUT C accepted — frozen |
| Staff Preview / Patient 360 staff discovery | CUT D accepted — frozen |
| Pathology | Separate SoT — unchanged |
| Patient Portal LMS publish API / permission wired | **Absent** |
| `lms.reports.publish` | **Approved to introduce** (PD-PP-05); not seeded today; no role grants authorized by this package |
| Product Decision Closure | [enterprise-lms-report-patient-portal-publication-product-decision-closure.md](./enterprise-lms-report-patient-portal-publication-product-decision-closure.md) |

---

## 4. Decision register (PD-PP-*) — approved summary

Full fields, constraints, and residuals: see Product Decision Closure §5.

| ID | Approved direction (summary) | Status |
| --- | --- | --- |
| PD-PP-01 | Proceed with Patient Portal LMS Official PDF publication; slice `L-REP-04` | **APPROVED** |
| PD-PP-02 | Explicit staff Publish after Released + Succeeded current Official PDF; Release ≠ publish; server enforce | **APPROVED** |
| PD-PP-03 | Current Official PDF only via `CurrentOfficialArtifactId`; no history browser | **APPROVED** |
| PD-PP-04 | Explicit withdraw/unpublish + audit; no Portal access after withdraw; prior downloads not revocable | **APPROVED** |
| PD-PP-05 | Distinct `lms.reports.publish`; no silent role grants; seed ≠ grants | **APPROVED** |
| PD-PP-06 | Authenticated private content; no SAS/public/anonymous | **APPROVED** |
| PD-PP-07 | LaboratoryApi owns publication state/eligibility; content service enforces patient-session authz before bytes | **APPROVED** |
| PD-PP-08 | LMS ≠ Pathology; no LabReport SoT reuse; label sources; leave `/dashboard/laboratory` alone | **APPROVED** |
| PD-PP-09 | Distinct audit for publish / withdraw / patient open; fail-closed | **APPROVED** |
| PD-PP-10 | No notifications in this slice | **APPROVED** |
| PD-PP-11 | Conservative identity: exact linked patient only; branch alone insufficient; no new proxy system; deny proxy unless verified existing authz | **APPROVED** |
| PD-PP-12 | Working ID `L-REP-04` | **APPROVED** |

### Original review options (audit trail — not reopened)

#### PD-PP-01 — Include Patient Portal publication as the next slice?

| Field | Content |
| --- | --- |
| Options reviewed | **A)** Proceed · **B)** Notification first · **C)** Amendments first · **D)** Other / defer |
| Recommendation | **A** |
| Outcome | **APPROVED A** |

#### PD-PP-02 — Publish trigger

| Field | Content |
| --- | --- |
| Options reviewed | **A)** Explicit Publish after Released + Succeeded PDF · **B)** Auto on PDF · **C)** Auto on Release (discouraged) · **D)** Other |
| Outcome | **APPROVED A** |

#### PD-PP-03 — Current-only vs historical

| Field | Content |
| --- | --- |
| Options reviewed | **A)** Current only · **B)** Current + history · **C)** Other |
| Outcome | **APPROVED A** |

#### PD-PP-04 — Withdrawal

| Field | Content |
| --- | --- |
| Options reviewed | **A)** Staff unpublish + audit · **B)** No withdrawal in first slice · **C)** Other |
| Outcome | **APPROVED A** (with honesty on prior downloads) |

#### PD-PP-05 — Permission model

| Field | Content |
| --- | --- |
| Options reviewed | **A)** New `lms.reports.publish` · **B)** Reuse manage/release · **C)** Other |
| Outcome | **APPROVED A** (no silent grants; grants separate) |

#### PD-PP-06 — Content resolution

| Field | Content |
| --- | --- |
| Options reviewed | **A)** Authenticated private · **B)** SAS/public (discouraged) · **C)** Other |
| Outcome | **APPROVED A** |

#### PD-PP-07 — Service ownership

| Field | Content |
| --- | --- |
| Options reviewed | **A)** LaboratoryApi publish + Auth/Portal patient content · **B)** Auth owns publish flags · **C)** Other |
| Outcome | **APPROVED A** (exact wire contracts = readiness) |

#### PD-PP-08 — Pathology coexistence

| Field | Content |
| --- | --- |
| Options reviewed | **A)** Distinct labels/sources · **B)** LMS only first slice · **C)** Other |
| Outcome | **APPROVED A** |

#### PD-PP-09 — Audit

| Field | Content |
| --- | --- |
| Options reviewed | **A)** Distinct actions; fail-closed · **B)** Reuse staff DOWNLOAD for patient · **C)** Other |
| Outcome | **APPROVED A** |

#### PD-PP-10 — Notification coupling

| Field | Content |
| --- | --- |
| Options reviewed | **A)** Publication only · **B)** Bundle notify-on-publish · **C)** Other |
| Outcome | **APPROVED A** |

#### PD-PP-11 — Branch / tenant / patient identity

| Field | Content |
| --- | --- |
| Outcome | **APPROVED conservative baseline** (exact linked patient; branch alone insufficient; no new proxy system; fail closed / identify blockers) |

#### PD-PP-12 — Slice packaging ID

| Field | Content |
| --- | --- |
| Outcome | **APPROVED `L-REP-04`** |

---

## 5. Explicit exclusions (preserved)

- Changing CUT C Download or CUT D Preview/P360 contracts  
- Equating metadata Release with patient visibility  
- Pathology dual-write or LabReport association reuse for LMS  
- SAS / public Blob URLs  
- Amendments / Unrelease / Revoke  
- Auto NotificationHub delivery as Report SoT  
- Production RolePermission grant campaigns without a grants decision  
- New proxy/guardian authorization system as implicit L-REP-04 scope  

---

## 6. Acceptance / UAT (future — after readiness + implementation authorization)

Not executable from this package alone. Future gates:

1. Product Decision Closure — **done** (`PRODUCT_DECISIONS_CLOSED_L_REP_04_AUTHORIZED`)  
2. Implementation Readiness Audit — see companion readiness document  
3. Product Owner clearance of readiness blockers + **implementation authorization**  
4. Bounded implementation  
5. Automated tests  
6. Manual UAT  
7. Acceptance closure  

---

## 7. Status stamps

```text
PRODUCT_DECISION_REVIEW_PACKAGE_PREPARED
PRODUCT_OWNER_APPROVAL = APPROVED_PD-PP-01_THROUGH_PD-PP-12
PRODUCT_DECISION_CLOSURE = CREATED
PRODUCT_DECISIONS_CLOSED_L_REP_04_AUTHORIZED
IMPLEMENTATION_NOT_AUTHORIZED
ACCEPTED_L_REP_03_CUT_D = PRESERVED
CUT_C_UNCHANGED
LEGACY_PATHOLOGY_UNCHANGED
PATIENT_PORTAL_UNCHANGED_BY_THIS_PACKAGE
NEXT_GATE = IMPLEMENTATION_READINESS_AUDIT_AND_PO_REVIEW_OF_BLOCKERS
```

---

## 8. Mandatory stop

**STOP.** Product Decisions are closed in the closure document.  
Do **not** implement Portal publication until readiness blockers are cleared and Product Owner issues explicit implementation authorization.
