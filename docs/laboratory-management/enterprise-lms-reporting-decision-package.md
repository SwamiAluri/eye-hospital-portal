# L-REP-01 — Reporting / Release  
# Product Decision Package (Organizing Only)

**Date:** 2026-10-12  
**Mode:** DOCUMENTATION FOR PRODUCT OWNER GATE — **no decisions approved in this package**  
**Discovery evidence:** [enterprise-lms-reporting-discovery-audit.md](./enterprise-lms-reporting-discovery-audit.md)  
**Upstream acceptance:** `ACCEPTED_L_CRT_01_AND_L_CRT_UX_01`

```text
Discovery Audit COMPLETE
  ↓
THIS PACKAGE (organize PO choices — NOT a closure stamp)
  ↓
Product Owner decisions (outside Cursor)
  ↓
Future Decision Closure document (separate task)
  ↓
Future implementation task (separate — not authorized here)
```

**Status of this package:** `DISCOVERY_COMPLETE_READY_FOR_PRODUCT_OWNER_DECISION`

This package does **not** authorize implementation. Recommendations are not approvals.

---

## 1. Why a decision gate is required

Enterprise LMS Results stop at **ClinicallyAuthorized**. Accepted Critical Results are orthogonal events. There is **no** LaboratoryApi Report aggregate, Final/Released ResultStatus, PDF pipeline, or patient publication path.

Legacy Pathology **LabReport** / `completed` / CanonicalDocument attach exists in AuthService and must not silently become LMS Reporting SoT.

Product Definition V3 still describes a LabReport-rooted release model — coexistence with the accepted LMS Result path must be decided explicitly.

---

## 2. Non-negotiable certified constraints (do not reopen)

| Constraint | Source |
|---|---|
| ResultStatus = Draft → TechnicalVerified → ClinicallyAuthorized only | L-TST / L-VER / L-AUTH / L-CRT acceptance |
| Critical ≠ ResultStatus | L-CRT-01 |
| ClinicallyAuthorized ≠ Final / Released / patient-visible | L-AUTH / L-CRT closures |
| No production role grants in discovery/implementation without PO | LMS program rule |
| Pathology remains separate unless PO approves bridge | LMS architecture |
| Amendments remain future unless PO expands L-REP first slice | L-CRT / L-AUTH |

---

## 3. Decision clusters for Product Owner

### Cluster A — Ownership and coexistence

| ID | Decision required |
|---|---|
| PD-REP-01 | Where does the Report aggregate live? |
| PD-REP-26 | How do LMS Reports coexist with legacy LabReport? |
| AD-REP-01 | Owning service |

### Cluster B — Clinical binding

| ID | Decision required |
|---|---|
| PD-REP-02 | Report ↔ Result cardinality |
| PD-REP-03 | Binding to ResultVersion |
| PD-REP-04 | Snapshot vs live content |
| PD-REP-16 | Multi-test / multi-specimen composition |

### Cluster C — Lifecycle

| ID | Decision required |
|---|---|
| PD-REP-05 | Report states |
| PD-REP-06 | Finalization |
| PD-REP-07 | Release |
| PD-REP-08 | Publication |
| PD-REP-11 | When generation occurs |

### Cluster D — Visibility and delivery

| ID | Decision required |
|---|---|
| PD-REP-09 | Patient visibility |
| PD-REP-10 | Clinician visibility |
| PD-REP-18 | Delivery |
| PD-REP-19 | Notifications (distinct from release) |
| PD-REP-24 / PD-REP-25 | P360 + CanonicalDocument roles |

### Cluster E — Governance and configuration

| ID | Decision required |
|---|---|
| PD-REP-13 / 14 / 15 | Numbering, templates, signatory |
| PD-REP-21 | `lms.reports.*` permission model |
| PD-REP-22 | Tenant/branch/site scope |
| PD-REP-17 | Amendments in or out of first slice |
| PD-REP-20 / 27 / 28 | Audit, idempotency, concurrency |

Full registers with OPEN / RECOMMENDED / CONFIGURATION REQUIRED markings: see Discovery Audit §§17–18.

---

## 4. Suggested first-slice shapes (for PO discussion only)

| Shape | Includes | Explicitly excludes (unless PO expands) |
|---|---|---|
| **Foundation only** | Report + ReportVersion bound to ClinicallyAuthorized ResultVersion; preview | Release, patient visibility, PDF, Amendments |
| **Foundation + document** | Above + PDF/bytes via CanonicalDocument | Patient publication, Amendments |
| **Release-capable** | Foundation + Final/Release semantics + staff download | Patient portal publish, escalation, Amendments |

**Discovery recommendation (not approval):** Start with LaboratoryApi-owned Report foundation bound to ClinicallyAuthorized ResultVersion; CanonicalDocument for bytes only; defer Amendments and patient publication.

---

## 5. Configuration checklist before release-capable slice

- [ ] Report templates / branding  
- [ ] Signatory / release authority  
- [ ] Report numbering  
- [ ] Release policy  
- [ ] Patient visibility policy  
- [ ] Delivery channels (if any)  
- [ ] Retention  
- [ ] Pathology coexistence policy  

---

## 6. Explicit non-authorization

This package does **not**:

- Create a Product Decision Closure stamp  
- Authorize Report tables, APIs, UI, PDF, Final/Released ResultStatus, permissions, or role grants  
- Authorize L-REP-01 implementation  

---

## FINAL PACKAGE STATUS

**DISCOVERY_COMPLETE_READY_FOR_PRODUCT_OWNER_DECISION**

Await Product Owner decisions → separate Decision Closure → separate implementation task.
