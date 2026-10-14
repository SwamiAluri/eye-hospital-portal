# L-REP-04 — Patient Portal LMS Official PDF Publication  
# Product Decision Closure

**Date:** 2026-10-13  
**Slice (working ID):** `L-REP-04` — Patient Portal Official PDF Publication  
**Mode:** PRODUCT DECISION CLOSURE — documentation / Product Owner approval recording only  

**This task does not implement L-REP-04.**  
No application source, schema, migrations, APIs, DTOs, services, UI, routes, permission seed/grant changes, RolePermission seeders, audit allowlist changes, Blob/SAS endpoints, CanonicalDocument model changes, Report / ReportVersion / Report Number / Release / Result / Authorization changes, Pathology, Patient Portal runtime behavior, NotificationHub, Amendments, Unrelease, Manual UAT, or acceptance claims are authorized **by this document alone**.

Documentation closure does **not** constitute implementation authorization.

---

## 1. Purpose and scope

Formally close Product Owner decisions **PD-PP-01 through PD-PP-12** for **Patient Portal access to Enterprise LMS Official PDFs** after:

- L-REP-03 CUT D accepted (`ACCEPTED_L_REP_03_CUT_D`) — staff Preview / Patient 360 current LMS Official PDF
- Post–CUT D next-concept readiness audit recommending Portal publication
- Product Decision Review package prepared
- Product Owner **explicitly approved** the recommended directions for PD-PP-01…12, including the conservative patient-identity and proxy/guardian baseline for PD-PP-11

This closure authorizes **documentation reconciliation**, a **bounded Implementation Readiness Audit**, and (where evidence allows) an **Implementation Specification**. It does **not** authorize Cursor or any engineer to modify application code.

Preserve certified L-REP-02B, L-REP-03 CUT A/B/C/D. Do **not** reopen CUT C/D contracts. Do **not** change Pathology or `/dashboard/laboratory`.

---

## 2. Authoritative source chain

| Document | Role | Relationship |
| --- | --- | --- |
| [enterprise-lms-report-patient-portal-publication-decision-package.md](./enterprise-lms-report-patient-portal-publication-decision-package.md) | Decision Review package | **Updated** for approval status; detailed review history retained; **this** closure is authoritative for stamped PD-PP-* approval state |
| [enterprise-lms-post-cut-d-next-concept-readiness-audit.md](./enterprise-lms-post-cut-d-next-concept-readiness-audit.md) | Originating next-concept readiness audit | Recommendation source; linked from this closure |
| [enterprise-lms-report-preview-patient360-acceptance-closure.md](./enterprise-lms-report-preview-patient360-acceptance-closure.md) | Accepted CUT D | Frozen — Patient Portal was OUT of CUT D (`PD-D-14`) |
| [enterprise-lms-report-staff-download-acceptance-closure.md](./enterprise-lms-report-staff-download-acceptance-closure.md) | Accepted CUT C | Frozen |
| [enterprise-lms-post-release-report-lifecycle-discovery.md](./enterprise-lms-post-release-report-lifecycle-discovery.md) | Post-Release discovery (P5) | Sequencing evidence only |

---

## 3. Explicit Product Owner approval statement

Product Owner has **explicitly approved** the recommended directions for **PD-PP-01 through PD-PP-12** in the project conversation for this closure work, including the **conservative patient-identity and proxy/guardian baseline** for PD-PP-11.

| Class | Meaning |
| --- | --- |
| **APPROVED** | Product Owner stamped for L-REP-04 product direction |
| **CARRIED FORWARD** | Upstream certified principle preserved (not reopened) |
| **OUT_OF_SCOPE** | Explicitly outside L-REP-04 |
| **RESIDUAL / TECHNICAL** | Detail deferred to Implementation Readiness Audit or blocked pending verified repository capability |

No formal repository sign-off timestamp, signature block, or separate approval artifact was found. Approval is attributed to the Product Owner’s explicit conversational approval. Unresolved technical/policy details are **not** silently marked approved.

---

## 4. Status stamps

```text
PRODUCT_DECISION_REVIEW_PACKAGE_PREPARED
PRODUCT_OWNER_DECISIONS_APPROVED_PD-PP-01_THROUGH_PD-PP-12
PRODUCT_DECISION_CLOSURE_COMPLETE
PRODUCT_DECISIONS_CLOSED_L_REP_04_AUTHORIZED
L_REP_04_IMPLEMENTATION_NOT_STARTED
MANUAL_UAT_NOT_STARTED
ACCEPTANCE_NOT_CLAIMED
DOCUMENTATION_CLOSURE_DOES_NOT_AUTHORIZE_IMPLEMENTATION
NEXT_GATE = IMPLEMENTATION_READINESS_AUDIT_AND_PO_REVIEW_OF_BLOCKERS
```

| Field | Value |
| --- | --- |
| Closure stamp | `PRODUCT_DECISIONS_CLOSED_L_REP_04_AUTHORIZED` |
| Working slice ID | `L-REP-04` (PD-PP-12) |
| Implementation | `NOT_STARTED` / **not authorized by this document** |
| Manual UAT | `NOT_STARTED` |
| Acceptance | `ACCEPTANCE_NOT_CLAIMED` |

---

## 5. Decision register — PD-PP-01 through PD-PP-12

### PD-PP-01 — Next concept

| Field | Content |
| --- | --- |
| **Approved direction** | Proceed with Patient Portal access to Enterprise LMS Official PDFs as the next Report-domain concept. Working slice identifier: `L-REP-04`. |
| **Approval status** | **APPROVED** — Product Owner conversational approval |
| **Evidence** | Post–CUT D readiness recommendation; decision package Option A |
| **Affected surfaces** | Future LaboratoryApi publication APIs; Patient Portal results/documents UI; Auth content/audit; permission catalogue |
| **Implementation constraints** | Separate from accepted CUT D; requires readiness audit + explicit implementation authorization |
| **Residual** | None for concept selection |

### PD-PP-02 — Publication trigger

| Field | Content |
| --- | --- |
| **Approved direction** | Publication requires an **explicit staff Publish** action after the report is **Released** and a **successfully generated current Official PDF** exists. **Release alone must never** make a report visible in the Patient Portal. Enforce eligibility **on the server**. |
| **Approval status** | **APPROVED** |
| **Affected surfaces** | LaboratoryApi publish endpoint/service; staff Reports UI Publish affordance |
| **Implementation constraints** | UI-only checks forbidden; eligibility must re-validate Released + Succeeded current artifact at publish time |
| **Residual** | Exact HTTP route/DTO — technical (readiness/spec) |

### PD-PP-03 — Published version

| Field | Content |
| --- | --- |
| **Approved direction** | Expose only the report’s **current** Official PDF. No Official PDF history browser in this slice. Use `LmsReport.CurrentOfficialArtifactId` as the authoritative current-artifact pointer. Do not create a competing SoT. |
| **Approval status** | **APPROVED** |
| **Affected surfaces** | Portal list/open; LaboratoryApi publication eligibility |
| **Implementation constraints** | MODEL A currentness preserved; do not use timestamps/hash as currentness |
| **Residual** | Consistency rule when regeneration moves the pointer while published — technical invariant for readiness (must not invent conflicting SoT) |

### PD-PP-04 — Withdrawal

| Field | Content |
| --- | --- |
| **Approved direction** | Explicit staff unpublish/withdraw with audit. After withdrawal, report must not be discoverable or accessible through the authorized Patient Portal publication flow. Withdrawal **cannot** revoke copies already downloaded by a patient. No amendment, unrelease, revocation, or version-history workflows. |
| **Approval status** | **APPROVED** |
| **Affected surfaces** | LaboratoryApi withdraw endpoint; staff UI; Portal discovery/open deny after withdraw |
| **Implementation constraints** | Document honest limitation on prior downloads; do not imply remote wipe |
| **Residual** | Exact persistence model for publication state — technical |

### PD-PP-05 — Permission boundary

| Field | Content |
| --- | --- |
| **Approved direction** | Distinct capability `lms.reports.publish` (subject to repository naming conventions + compatibility check). Do **not** silently grant to Admin, Lab Technician, or other roles. Definition, seeding, and role grants are **separate** concerns. |
| **Approval status** | **APPROVED** (capability name + no silent grants) |
| **Affected surfaces** | `EnterpriseLmsReportsPermissionCatalog`; `LaboratoryAuthz`; FE `LMS_REPORTS_PERMISSIONS`; RolePermission grants (**ops/PO separate**) |
| **Implementation constraints** | Current evidence: code is **not** seeded; FE test asserts absence; catalogue comment excludes publish |
| **Residual** | **Which roles receive grants in which environments** remains a separate grant decision (same pattern as other `lms.reports.*` catalogue-only permissions). Not silently resolved here. |

### PD-PP-06 — Patient content access

| Field | Content |
| --- | --- |
| **Approved direction** | Authenticated Patient Portal access to **private** content. No SAS URLs, public Blob URLs, anonymous endpoints, or browser-side Blob credentials. |
| **Approval status** | **APPROVED** |
| **Affected surfaces** | Patient session content path; Auth CanonicalDocument/Blob internal open patterns |
| **Implementation constraints** | Preserve private Blob + authenticated content boundary from CUT C/D |
| **Residual** | Exact patient-facing service/route — verify in readiness; propose only |

### PD-PP-07 — Service ownership

| Field | Content |
| --- | --- |
| **Approved direction** | **LaboratoryApi** owns publication eligibility and publication state. The appropriate authenticated content-access service must enforce **patient-session authorization** before returning PDF bytes. |
| **Approval status** | **APPROVED** (ownership principle) |
| **Affected surfaces** | LaboratoryApi; AuthService internal LMS content path (staff pattern today); future patient content gateway |
| **Implementation constraints** | Do not assume exact route/DTO until readiness confirms; content service must not trust caller-supplied “published” assertions alone |
| **Residual** | Exact trust-boundary contract between LaboratoryApi and content service — technical design |

### PD-PP-08 — Pathology separation

| Field | Content |
| --- | --- |
| **Approved direction** | Keep Enterprise LMS and legacy Pathology distinct. No migrate/redirect/dual-write/reuse of Pathology `LabReport` as LMS publication SoT. Clear source identification in any future Patient Portal UI. Do not change `/dashboard/laboratory` or certified Pathology behavior. |
| **Approval status** | **APPROVED** |
| **Affected surfaces** | Portal labeling; association domains (`enterprise_lms` vs Pathology) |
| **Implementation constraints** | Preserve PD-D-05 / PD-D-16 boundaries |
| **Residual** | None for separation principle |

### PD-PP-09 — Audit

| Field | Content |
| --- | --- |
| **Approved direction** | Distinct audit actions for publication, withdrawal, and patient-content access. Preserve AuthService internal audit + **fail-closed** before serving protected content when required audit fails. |
| **Approval status** | **APPROVED** (principle) |
| **Affected surfaces** | `ReportAuditActions`; `InternalAuditController.AllowedActions`; LaboratoryApi publish/withdraw/patient-open paths |
| **Implementation constraints** | Current allowlist includes staff `DOWNLOAD_OFFICIAL_PDF` etc.; **no** publish/withdraw/patient-open actions exist yet — names to be proposed in readiness/spec and allowlisted at implementation time |
| **Residual** | Exact action string names — technical (must not invent as already existing) |

### PD-PP-10 — Notifications

| Field | Content |
| --- | --- |
| **Approved direction** | Slice covers publication state + authenticated Patient Portal access only. Notification delivery, NotificationHub, email/SMS, retry orchestration, and preferences are **out of scope**. Notifications are not publication SoT. |
| **Approval status** | **APPROVED** |
| **Affected surfaces** | None in this slice |
| **Implementation constraints** | Do not couple publish to NotificationHub |
| **Residual** | None |

### PD-PP-11 — Patient identity and visibility (conservative baseline)

| Field | Content |
| --- | --- |
| **Approved direction** | **Conservative baseline:** (1) Only an authenticated Patient Portal identity **linked to the exact patient record** may access its publication. (2) Branch membership alone does not grant access. (3) Do not assume multi-branch visibility rules without repository evidence + explicit policy. (4) Proxy/guardian access allowed **only if** an existing verified authorization mechanism is found and explicitly in scope. (5) Do **not** create a new proxy/guardian system as an implicit part of L-REP-04. (6) If identity-linkage / cross-branch / proxy rules cannot establish safe access, identify the precise blocker — do not guess. |
| **Approval status** | **APPROVED** (baseline policy) |
| **Affected surfaces** | Patient Portal auth; patient↔user linkage; Portal list/open APIs |
| **Implementation constraints** | Fail closed on missing/ambiguous/invalid linkage; deny proxy unless verified mechanism proven |
| **Residual / blocker class** | `BLOCKER-PP-IDENTITY-01` remains **OPEN** (runtime). Follow-up: [identity closure](./enterprise-lms-patient-portal-identity-product-decision-closure.md); [bounded plan](./enterprise-lms-patient-portal-identity-bounded-implementation-plan.md) **recorded**, awaiting explicit approval; runtime **NOT_STARTED**. L-REP-04 **implementation not authorized** until identity is implemented, tested, UAT’d, accepted, then separate L-REP-04 auth. PD-PP-01…12 are **not** reopened. |

### PD-PP-12 — Slice identifier

| Field | Content |
| --- | --- |
| **Approved direction** | Use `L-REP-04` as the working slice identifier, subject to repository naming/governance conventions. |
| **Approval status** | **APPROVED** |
| **Affected surfaces** | Documentation stamps; future commit/PR titles |
| **Residual** | None |

---

## 6. In scope / out of scope

### In scope (authorized for future implementation design under this closure)

- Explicit staff Publish / Withdraw of current LMS Official PDF for Patient Portal visibility  
- Server-side eligibility (Released + Succeeded current Official PDF via `CurrentOfficialArtifactId`)  
- Catalogue permission `lms.reports.publish` (definition + seed; **no silent role grants**)  
- Authenticated private content access for the linked patient (when identity linkage exists)  
- Distinct audit actions + fail-closed content gate  
- Portal UI listing/opening published LMS Official PDFs with clear Enterprise LMS source labeling  
- Automated tests + Manual UAT plans as readiness/spec define  

### Out of scope

- Reopening or changing CUT C Download / CUT D Preview / Patient 360 staff contracts  
- Treating Release as patient visibility  
- Pathology dual-write / LabReport association reuse / `/dashboard/laboratory` changes  
- SAS / public Blob / anonymous content  
- Amendments / Unrelease / Revoke / Official PDF history browser  
- NotificationHub / email / SMS delivery as part of this slice  
- Building a new proxy/guardian authorization system (unless separately decided)  
- Silent production RolePermission grant campaigns  

---

## 7. Dependencies and blockers

| Item | Status |
| --- | --- |
| Official PDF + number + `CurrentOfficialArtifactId` | Ready (accepted CUT A/B/C/D) |
| Product Decision Closure PD-PP-* | **This document — closed** |
| Publication state persistence | Absent — proposed in readiness/spec |
| `lms.reports.publish` catalogue | Absent — approved to add (no grants) |
| Authenticated Patient Portal identity ↔ patient linkage | **BLOCKER** — not present (mock Portal) |
| Verified proxy/guardian Portal authz | **Absent** — deny per PD-PP-11 |
| Explicit multi-branch Portal visibility policy | **Absent** — do not invent; branch alone insufficient |
| Role grants for publish | Separate decision / ops (catalogue-only pattern preserved) |

---

## 8. Security and patient-identity boundaries

- Exact linked patient only; fail closed otherwise  
- Branch membership alone insufficient  
- Proxy/guardian denied unless verified existing mechanism proven in-scope (none found → deny)  
- No browser-supplied patient id as sole authority  
- No SAS/public Blob  
- Staff LMS permissions and patient Portal session must remain separated  
- Fail-closed audit before protected PDF bytes  

---

## 9. Acceptance prerequisites (future)

1. Product Decision Closure (this document)  
2. Implementation Readiness Audit completed and Product Owner review of blockers  
3. Explicit **implementation authorization** after blockers cleared  
4. Bounded implementation  
5. Automated tests green (as specified)  
6. Manual UAT by Product Owner / designated UAT (not substitutable by unit tests)  
7. Acceptance closure  

---

## 10. Required automated-test coverage (future implementation)

Must include at least: publish rejected unless Released + current Succeeded Official PDF; Release alone does not publish; publish requires `lms.reports.publish`; unauthorized roles cannot publish/withdraw; no implicit role grants; exact linked patient only; missing/ambiguous linkage denied; branch alone insufficient; proxy denied unless proven in-scope; withdrawn not discoverable/downloadable; stale/superseded artifacts not served as current; regeneration preserves currentness invariant; audit failure blocks content; anonymous and cross-patient denied; no SAS/public URL; Pathology unaffected; Portal vs LMS permission separation; concurrent publish/withdraw/retry per documented contract.

---

## 11. Required Manual UAT scenarios (future)

UAT-PP-01…15 as enumerated in the Implementation Readiness Audit / Specification (publish eligible; deny without PDF; deny unreleased; deny without permission; own patient only; cross-patient deny; no linkage deny; branch alone deny; withdraw removes access; prior downloads honesty; regeneration/currentness; audit fail-closed; no anonymous/SAS; Pathology unchanged; existing Portal non-LMS behavior unchanged).

UAT must be performed by the user after implementation. Do not claim acceptance from this documentation task.

---

## 12. Implementation-readiness status (closure-time)

```text
PRODUCT_DECISIONS_CLOSED_L_REP_04_AUTHORIZED
IMPLEMENTATION_READINESS_AUDIT = REQUIRED_NEXT
READINESS_CLASSIFICATION_AT_CLOSURE = DEFERRED_TO_READINESS_AUDIT
```

Classification after the readiness audit is recorded in  
[enterprise-lms-report-patient-portal-publication-readiness-audit.md](./enterprise-lms-report-patient-portal-publication-readiness-audit.md).

---

## 13. Mandatory stop

**STOP.**  
This document closes Product Decisions only.  
Do **not** implement L-REP-04 until Product Owner reviews the readiness audit blockers and issues **explicit implementation authorization**.
