# L-COL-01B — CollectionTask Acceptance Closure

**Date:** 2026-10-09  
**Slice:** L-COL-01B  
**Mode:** DOCUMENTATION / ACCEPTANCE CLOSURE ONLY — no application code, schema, API, UI, permission, role-grant, Orders, Catalogue, Pathology, Specimen, Receiving, or Billing changes  
**Authoritative UAT audit:** [enterprise-lms-collection-task-final-uat-audit.md](./enterprise-lms-collection-task-final-uat-audit.md)

---

## FINAL STATUS

# L-COL-01B ACCEPTED

**Gate:** `READY_FOR_ACCEPTANCE` → **ACCEPTED**

---

## 1. Decision

| Field | Content |
|---|---|
| **Product decision** | Accept L-COL-01B CollectionTask foundation + search/ownership follow-up + invalid-GUID Assign handling |
| **UAT audit prior status** | `ACCEPTANCE_BLOCKED` (environment-dependent live multi-actor evidence) |
| **Product Owner waiver** | **APPROVED — WAIVE LIVE SECOND-ACTOR UAT REQUIREMENT** (and N1/N2/B5 live probes with automated equivalents) |
| **Post-waiver recommendation** | `READY_FOR_ACCEPTANCE` |
| **Acceptance stamp** | **L-COL-01B ACCEPTED** (2026-10-09) |

---

## 2. Product Owner Waiver (summary)

**APPROVED — WAIVE LIVE SECOND-ACTOR UAT REQUIREMENT**

Reason: only one Collection-capable authenticated UAT user; `labtech1@hospital.com` authenticates but lacks `lms.collection.view` / `lms.collection.collect`; no temporary role grants solely for UAT.

Waived live IDs: **B1, B2, B3, B4, B5, N1, N2** → **WAIVED_BY_PRODUCT_OWNER** with automated substitution.

> Live multi-actor execution was not performed; the Product Owner waived the environment-dependent live evidence requirement based on automated server-side coverage and existing live authorization evidence.

Business rules are **not** waived.

Full waiver text and evidence mapping: see **Product Owner Waiver** in the final UAT audit.

---

## 3. Acceptance scope

**Accepted:**

- CollectionTask foundation
- Collection planning
- Collection queue
- Planned → Ready → InProgress → Completed
- Cancel rules
- Case-insensitive TaskNumber search
- Claim / Assign / Release
- Ownership matrix
- Assignee capability enforcement (`lms.collection.collect`)
- Malformed GUID handling (`assignee_invalid`)
- Optimistic concurrency
- Platform audit
- Tenant / branch controls
- Order / OrderTest boundary (Order remains Submitted; OrderTest remains Ordered)
- Explicit non-creation of Specimen / Receiving
- Pathology regression

**Deferred / out of scope:**

- Specimen
- Receiving
- Accession
- Barcode
- Label
- Custody
- Aliquots
- Force reassign (PD-COL-OWN-04)
- Staff picker (PD-COL-UX-01)
- Production role grants

---

## 4. Evidence baselines (at acceptance)

| Suite | Result |
|---|---|
| `LaboratoryApi.Tests` | **113** passed |
| Collection tests | **33** passed |
| FE Collection UI | **11** passed |
| Auth LMS/Internal/Audit filtered | **31** passed |
| Pathology FE workbench | **20** passed |

Live single-actor search, lifecycle, Claim/Assign/Release, malformed GUID, ineligible assignee, concurrency 409, audit CREATE/TRANSITION/CLAIM/ASSIGN/RELEASE, Order boundary, and Specimen/Receiving non-creation: **PASS** per final UAT audit.

---

## 5. Traceability

| Document | Relationship |
|---|---|
| `enterprise-lms-collection-task-implementation-report.md` | Foundation implementation |
| `enterprise-lms-collection-search-ownership-decision-closure.md` | PD-COL-OWN-* / SEARCH-01 |
| `enterprise-lms-collection-search-ownership-implementation-report.md` | Ownership/search implementation |
| `enterprise-lms-collection-assign-invalid-guid-fix-report.md` | Invalid GUID Assign fix |
| `enterprise-lms-collection-task-final-uat-audit.md` | Authoritative UAT + waiver |
| This document | Acceptance stamp |

---

## 6. Next slice constraint

L-COL-01B remains **ACCEPTED** and unchanged.

Specimen & Receiving product/architecture decisions are closed with Product Owner approval in [enterprise-lms-specimen-receiving-decision-closure.md](./enterprise-lms-specimen-receiving-decision-closure.md) (`PRODUCT_DECISIONS_CLOSED_L_COL_01C_AUTHORIZED`).

**L-COL-01C Specimen Foundation** is **AUTHORIZED FOR A SEPARATE IMPLEMENTATION TASK** (additive **Complete Collection** on eligible Completed CollectionTasks — does **not** rewrite CollectionTask `Completed` semantics). Receiving remains deferred.

Do **not** start Receiving until a separately authorized Receiving slice.

---

## FINAL STATUS (repeat)

**L-COL-01B ACCEPTED**

**STOP.**
