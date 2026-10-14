# L-PORTAL-01 — Patient Portal Identity Linkage  
# Product Decision Closure

**Date:** 2026-10-14  
**Slice (working ID):** `L-PORTAL-01` — Patient Portal Authenticated Identity ↔ Patient Linkage  
**Mode:** PRODUCT DECISION CLOSURE — documentation / Product Owner approval recording only  

**This task does not implement L-PORTAL-01.**  
No application source, schema, migrations, APIs, DTOs, services, UI, routes, permission seed/grant changes, RolePermission seeders, audit allowlist changes, authentication/session/token issuance, invitation/verification/remediation runtime, Patient Portal behavior, LaboratoryApi publication, Pathology, NotificationHub, Manual UAT, or acceptance claims are authorized **by this document alone**.

Documentation closure does **not** constitute implementation authorization.

---

## 1. Purpose and scope

Formally close Product Owner decisions for **L-PORTAL-01** after:

- Identity readiness audit (`BLOCKER-PP-IDENTITY-01` evidence)
- Decision package + Product Owner decision review for PD-ID-01…12 directional approvals
- Detail direction + configurability model (2026-10-14)
- Final mandatory detail approvals for **PD-ID-03-D3**, **PD-ID-04-D1**, and **PD-ID-11-D2** (2026-10-14)

This closure authorizes **documentation reconciliation** and establishes eligibility for a **separate** Product Owner implementation-authorization gate. It does **not** authorize engineers to modify application code.

Preserve PD-PP-01…12 (L-REP-04). Preserve certified L-REP-03 CUT C/D. Do **not** change Pathology or `/dashboard/laboratory`.

---

## 2. Authoritative source chain

| Document | Role | Relationship |
| --- | --- | --- |
| [enterprise-lms-patient-portal-identity-product-owner-decision-form.md](./enterprise-lms-patient-portal-identity-product-owner-decision-form.md) | Detail D-item stamps | Authoritative for PD-ID-*-D* outcomes |
| [enterprise-lms-patient-portal-identity-decision-package.md](./enterprise-lms-patient-portal-identity-decision-package.md) | PD-ID-01…12 register | Updated for closure status |
| [enterprise-lms-patient-portal-identity-product-decision-review.md](./enterprise-lms-patient-portal-identity-product-decision-review.md) | Review / gates | Updated for closure status |
| [enterprise-lms-patient-portal-identity-prerequisite-specification.md](./enterprise-lms-patient-portal-identity-prerequisite-specification.md) | Conditional spec | Remains conditional until impl auth |
| [enterprise-lms-patient-portal-identity-readiness-audit.md](./enterprise-lms-patient-portal-identity-readiness-audit.md) | Evidence baseline | Gap remains until implementation |
| [enterprise-lms-report-patient-portal-publication-product-decision-closure.md](./enterprise-lms-report-patient-portal-publication-product-decision-closure.md) | L-REP-04 PD-PP-* closed | Preserved; not reopened |
| **This document** | Formal Product Decision Closure | Authoritative for `PRODUCT_DECISIONS_CLOSED_L_PORTAL_01` |

---

## 3. Explicit Product Owner approval statement

Product Owner has **explicitly approved**:

1. **Directional** recommended directions for **PD-ID-01 through PD-ID-12** (prior project conversation).  
2. **Detail direction** including configurable invitation/verification/expiry/recovery/remediation under hospital policy + platform safeguards (2026-10-14).  
3. **Final mandatory details** (2026-10-14 project conversation):

| ID | Approved outcome |
| --- | --- |
| **PD-ID-03-D3** | Invitation lifetime min **1 hour**, max **72 hours**, default **24 hours**; hospital configures allowed range and default within bounds; server-side validation; fail closed on missing/invalid/inconsistent policy. **Not** staff-OTP-derived. |
| **PD-ID-04-D1** | Configurable catalogue: (1) authorized staff verification checklist; (2) in-person identity evidence review; (3) OTP to verified contact + staff confirmation. Demographic-only matching **forbidden**. Capture outcome, actor, evidence metadata under policy. Checklist/document/OTP assurance details **not** invented as approved technical content. Methods **not** claimed implemented. |
| **PD-ID-11-D2** | Retention **2,555 days** as **explicit** PO choice (not merely infra default inheritance). No separate policy document ID provided or invented. |

No formal repository sign-off timestamp or signature block was found. Approval is attributed to the Product Owner’s explicit conversational approval.

---

## 4. Closure eligibility checklist (verified)

| # | Criterion | Result | Evidence |
| --- | --- | --- | --- |
| 1 | All mandatory PO decisions for L-PORTAL-01 have explicit outcomes | **Met** | PD-ID-01…12 directions + all blocking D-items stamped on decision form; former blockers D3/D1/D2 now `PRODUCT_OWNER_APPROVED` |
| 2 | PD-ID-03-D3, PD-ID-04-D1, PD-ID-11-D2 recorded in authoritative records | **Met** | Decision form §4; this closure §3; package/review reconciled |
| 3 | No mandatory product/security/privacy/identity-assurance/retention/audit-governance PO blocker remains | **Met** | Form §5: `BLOCKED_PENDING_EXPLICIT_PRODUCT_OWNER_DECISION = NONE` |
| 4 | Required approval provenance present | **Met** | Conversational PO approval recorded; no fabricated signature artifact |
| 5 | Engineering residuals correctly classified (not concealed PO blockers) | **Met** | Permission codes, audit strings, checklist field contents = technical / engineering validation |
| 6 | Decision package, review, form, spec, readiness audit consistent | **Met** | Cross-updated in same governance task |
| 7 | L-REP-04 / PD-PP-* and identity runtime gap accurately represented | **Met** | PD-PP preserved; `BLOCKER-PP-IDENTITY-01` remains **OPEN** (no runtime linkage) |

**Eligibility verdict:** `ELIGIBLE_AND_CLOSED`

---

## 5. Status stamps

```text
PRODUCT_DECISION_REVIEW_PACKAGE_PREPARED
PRODUCT_OWNER_DIRECTIONAL_APPROVALS_RECORDED_PD-ID-01_THROUGH_PD-ID-12
PRODUCT_OWNER_DETAIL_DIRECTION_RECORDED_2026-10-14
FINAL_MANDATORY_DETAIL_APPROVALS_RECORDED_PD-ID-03-D3_04-D1_11-D2
PRODUCT_DECISION_CLOSURE_COMPLETE
PRODUCT_DECISIONS_CLOSED_L_PORTAL_01 = PRESERVED
DOCUMENTATION_CLOSURE_DOES_NOT_AUTHORIZE_IMPLEMENTATION
L_PORTAL_01_IMPLEMENTATION_AUTHORIZATION = GRANTED
AUDIT_EVENT_CONTRACT = RATIFIED_APPROVE_WITH_EDITS
PORTAL_AUTH_LOGIN_SUCCESS_FAILURE_AUDIT = BEST_EFFORT
RUNTIME_IMPLEMENTATION = NOT_STARTED
L_REP_04_IMPLEMENTATION = NOT_AUTHORIZED
BLOCKER-PP-IDENTITY-01 = OPEN
MANUAL_UAT_NOT_STARTED
ACCEPTANCE_NOT_CLAIMED
PD-PP-01…12 = PRESERVED
ACCEPTED_L_REP_03_CUT_C = PRESERVED
ACCEPTED_L_REP_03_CUT_D = PRESERVED
LEGACY_PATHOLOGY = UNCHANGED
APPLICATION_RUNTIME_UNCHANGED
NO_APPLICATION_TESTS_EXECUTED
BOUNDED_IMPLEMENTATION_PLAN = RECORDED_AWAITING_EXPLICIT_APPROVAL
NEXT_GATE = EXPLICIT_APPROVAL_OF_BOUNDED_IMPLEMENTATION_PLAN
```

| Field | Value |
| --- | --- |
| Closure stamp | `PRODUCT_DECISIONS_CLOSED_L_PORTAL_01` |
| Working slice ID | `L-PORTAL-01` |
| Implementation | **NOT authorized by this closure document alone**; PO implementation authorization **GRANTED**; audit contract **RATIFIED_APPROVE_WITH_EDITS**; bounded plan **recorded** — runtime **NOT_STARTED** pending [explicit plan approval](./enterprise-lms-patient-portal-identity-bounded-implementation-plan.md) |
| `BLOCKER-PP-IDENTITY-01` | **OPEN** (runtime identity linkage still absent) |
| Manual UAT | `NOT_STARTED` |
| Acceptance | `ACCEPTANCE_NOT_CLAIMED` |

---

## 6. Decision register summary

| Layer | Status |
| --- | --- |
| PD-ID-01, 02, 05, 09, 10, 12 | `APPROVED_DIRECTION` |
| PD-ID-03 | Direction + D2/D3/D4 `PRODUCT_OWNER_APPROVED`; D1 permission code technical pending |
| PD-ID-04 | Direction + D1/D2 `PRODUCT_OWNER_APPROVED`; method content details engineering |
| PD-ID-06 | Direction + D1…D4 `PRODUCT_OWNER_APPROVED` |
| PD-ID-07 | Direction + D2/D3 `PRODUCT_OWNER_APPROVED`; D1 permission code technical pending |
| PD-ID-08 | Direction + D1 `PRODUCT_OWNER_APPROVED` |
| PD-ID-11 | Direction + D2/D3 `PRODUCT_OWNER_APPROVED`; D1 event strings propose→ratify |

Carried forward from L-REP-04 **PD-PP-11** (not reopened): exact linked patient only; branch insufficient; fail closed; proxy denied unless verified mechanism (none); no browser-supplied `patientId` as sole proof.

---

## 7. What this closure does / does not authorize

### Authorizes (documentation / governance)

- Treating L-PORTAL-01 product decisions as closed  
- Updating companion docs to `PRODUCT_DECISIONS_CLOSED_L_PORTAL_01`  
- Proceeding to request **separate** explicit implementation authorization  

### Does **not** authorize

- Any runtime implementation of Portal auth, linkage, invite, verification, remediation, or audit allowlist changes  
- Permission seeding or role grants  
- L-REP-04 patient publication/content access implementation  
- Claiming Manual UAT or acceptance  
- Closing `BLOCKER-PP-IDENTITY-01` (requires implemented + tested + UAT’d + accepted identity)  

---

## 8. Residual engineering / ops items (non-blocking for this closure)

| Item | Classification |
| --- | --- |
| Exact invite / remediation permission code strings | Technical pending; propose at impl; no silent `user.manage` |
| Exact audit action strings + metadata schema | **Ratified** `APPROVE_WITH_EDITS` (login BEST_EFFORT) — see [implementation readiness §5](./enterprise-lms-patient-portal-identity-implementation-readiness.md) |
| Verification checklist fields, document lists, OTP assurance, contact-verification procedure | Engineering / hospital ops binding; not invented here |
| Server-side policy configuration store/UI | Required at authorized impl; not built in this task |
| Hospital security/ops notification channel for wrong-patient | Bind at ops readiness; do not invent |
| Staff Portal Access admin surface | Default **OUT** (PD-ID-09-D1) |

---

## 9. Next gate (superseded timeline)

Historical next gate at closure time: `EXPLICIT_L_PORTAL_01_IMPLEMENTATION_AUTHORIZATION`.

**Current next gate:**

```text
NEXT_GATE = EXPLICIT_APPROVAL_OF_BOUNDED_IMPLEMENTATION_PLAN
```

Plan: [enterprise-lms-patient-portal-identity-bounded-implementation-plan.md](./enterprise-lms-patient-portal-identity-bounded-implementation-plan.md).  
After explicit plan approval: bounded implementation → automated tests → Manual UAT → identity acceptance → then separate L-REP-04 authorization per PD-ID-12.

---

## 10. Mandatory stop

**STOP.** Product Decision Closure remains documentation authority for closed decisions.  
Runtime work awaits explicit approval of the bounded plan. Do **not** implement L-REP-04.
