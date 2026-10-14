# L-PORTAL-01 — Patient Portal Identity Linkage  
# Product Decision Package (Directional Approvals + Detail Resolutions)

**Date:** 2026-10-14 (updated — formal Product Decision Closure; prior history retained)  
**Mode:** DOCUMENTATION / DECISION GOVERNANCE ONLY — no implementation  
**Formal closure:** [enterprise-lms-patient-portal-identity-product-decision-closure.md](./enterprise-lms-patient-portal-identity-product-decision-closure.md) — **authoritative** for `PRODUCT_DECISIONS_CLOSED_L_PORTAL_01`  
**Implementation readiness:** [enterprise-lms-patient-portal-identity-implementation-readiness.md](./enterprise-lms-patient-portal-identity-implementation-readiness.md) — audit contract **RATIFIED_APPROVE_WITH_EDITS**  
**Evidence baseline:** [enterprise-lms-patient-portal-identity-readiness-audit.md](./enterprise-lms-patient-portal-identity-readiness-audit.md)  
**Product Owner decision review:** [enterprise-lms-patient-portal-identity-product-decision-review.md](./enterprise-lms-patient-portal-identity-product-decision-review.md)  
**Detail decision form:** [enterprise-lms-patient-portal-identity-product-owner-decision-form.md](./enterprise-lms-patient-portal-identity-product-owner-decision-form.md)  
**Conditional spec:** [enterprise-lms-patient-portal-identity-prerequisite-specification.md](./enterprise-lms-patient-portal-identity-prerequisite-specification.md)  
**Downstream:** L-REP-04 — `PRODUCT_DECISIONS_CLOSED_L_REP_04_AUTHORIZED`; patient path blocked by `BLOCKER-PP-IDENTITY-01` (**OPEN**) until identity implemented/accepted

```text
PRODUCT_DECISIONS_CLOSED_L_PORTAL_01 = PRESERVED
L_PORTAL_01_IMPLEMENTATION_AUTHORIZATION = GRANTED
AUDIT_EVENT_CONTRACT = RATIFIED_APPROVE_WITH_EDITS
PORTAL_AUTH_LOGIN_SUCCESS_FAILURE_AUDIT = BEST_EFFORT
RUNTIME_IMPLEMENTATION = NOT_STARTED
L_REP_04_IMPLEMENTATION = NOT_AUTHORIZED
BLOCKER-PP-IDENTITY-01 = OPEN
PD-PP-01…12 = PRESERVED
BOUNDED_IMPLEMENTATION_PLAN = RECORDED_AWAITING_EXPLICIT_APPROVAL
NEXT_GATE = EXPLICIT_APPROVAL_OF_BOUNDED_IMPLEMENTATION_PLAN
```

### Status discipline (this package)

| Class | Meaning |
| --- | --- |
| `APPROVED_DIRECTION` | Product Owner approved the recommended **direction** (PD-ID-01…12) |
| `PRODUCT_OWNER_APPROVED` | Explicit detail-level product policy stamped on the decision form |
| `APPROVED_DIRECTION_TECHNICAL_DETAIL_PENDING` | Product policy approved; exact codes/strings/wiring await later design + ratification |
| `ENGINEERING_VALIDATION_REQUIRED` | Infra binding must be validated at impl design — not a substitute for missing PO policy |
| `BLOCKED_PENDING_EXPLICIT_PRODUCT_OWNER_DECISION` | Mandatory business/policy value unresolved; **blocks formal closure** |
| `PROPOSED_RECOMMENDATION` | Historical layer (superseded where form now records PO stamps) |
| Formal Product Decision Closure | **Complete** — [closure document](./enterprise-lms-patient-portal-identity-product-decision-closure.md) |
| Implementation authorization | **Not granted** by this package or by closure documentation |

**Slice status:** `L-PORTAL-01` = **PRODUCT DECISIONS CLOSED — IMPLEMENTATION NOT AUTHORIZED**.

**2026-10-14 final detail note:** PD-ID-03-D3 (1h/72h/24h), PD-ID-04-D1 (three-method catalogue), and PD-ID-11-D2 (2,555-day retention) are `PRODUCT_OWNER_APPROVED`. Formal closure recorded. Technical residuals (permission codes, audit strings, checklist field contents) remain non-blocking for product-decision closure.

Do **not** treat documentation closure as implementation authorization.

Carried-forward from L-REP-04 **PD-PP-11** (**APPROVED** — do not reopen):

- Exact linked patient only; fail closed on missing/ambiguous/invalid linkage  
- Branch membership alone insufficient  
- Proxy/guardian denied unless verified existing mechanism (none found → deny; **no new proxy model**)  
- No browser-supplied `patientId` as sole proof  

---

## 1. Purpose

Record Product Owner **directional** approvals for **PD-ID-01…12**, record **proposed recommendations** for blocking detail areas (with source-verified evidence), and point to the Product Owner decision form required before formal Product Decision Closure and any identity implementation authorization.

---

## 2. Provenance of approvals

| Layer | Provenance | Scope |
| --- | --- | --- |
| Directional PD-ID-01…12 | Product Owner explicit approval of recommended directions (project conversation, 2026-10-13) | Direction only |
| Detail recommendations | Product Owner approved **overall recommended direction** for detail resolution (project conversation, 2026-10-14) | Elevates recommendations to `PROPOSED_RECOMMENDATION` — **not** detail-level `APPROVED` |
| Detail stamps | **Awaiting** completion of [decision form](./enterprise-lms-patient-portal-identity-product-owner-decision-form.md) | Required for formal closure |

No separate repository signature artifact was found; do not fabricate timestamps or sign-off IDs.

---

## 3. Evidence matrix — six blocking detail areas (source-verified 2026-10-14)

Direct repository inspection (not prior Cursor reports as sole evidence):

| Area | Confirmed in source | Absent / stub | Safe to claim as portal-identity reusable? |
| --- | --- | --- | --- |
| **PD-ID-03 Invitation** | Staff AppUser activation OTP email/SMS: `UsersController` `POST {id}/send-activation` (`user.manage`); NotificationService delivery for **staff** users; expiry/used patterns in **other** domains (staff OTP ~48h; counselling `PatientUploadLink`) | AuthService `/portal/*` controllers; portal invite E2E; portal inviter permission; `PortalAccessTab.tsx` Phase 5 stub; `patients-enhanced.api.ts` portal-registration client with **no** backend; settings `portal_invitation` simulated | **No** portal-invite E2E. Staff activation delivery is **adjacent pattern only** |
| **PD-ID-04 Verification** | — | No staff portal-link verification workflow; portal login OTP **simulated** (`patient/login/page.tsx`) | **No** verified portal-link activation workflow |
| **PD-ID-06 Lifecycle** | MPI `Patient.DeceasedDate`; `AppUser.UserType` comment includes Patient | No `AppUser.PatientId`; no `portal_patient_links`; no portal merge/reassign/recovery; `/patient/forgot-password` orphan | **No** portal link lifecycle |
| **PD-ID-07 Remediation** | General `AuditService` | No portal remediation permission in `PermissionSeeder`; no remediation API | **No** portal remediation authz |
| **PD-ID-08 Principals** | Staff JWT without `patientId` (`JwtService`); mock portal login; layout hardcodes `PAT-001` | Distinct patient-principal token issuance | Staff JWT **cannot** establish patient identity today (gap, not a feature) |
| **PD-ID-11 Audit** | `AuditService` `LogAsync`/`StageAsync`; hash chain; default `RetentionDays = 2555` on writes; `InternalAuditController` 500 on write failure; LMS allowlist pattern | Portal identity action names; portal allowlist entries; portal fail-closed wiring | **General** audit infra **yes**; portal identity audit contract **no**. Retention default ≠ PO-approved portal policy |

---

## 4. Authoritative decision records (PD-ID-01…12)

### PD-ID-01 — Packaging

| Field | Content |
| --- | --- |
| **Question** | Separate prerequisite vs defer vs fold into L-REP-04? |
| **Approved direction** | **Separate prerequisite slice**, independent of L-REP-04 |
| **PO response** | `APPROVE` (recommended Option A) |
| **Status** | `APPROVED_DIRECTION` |
| **PENDING_DETAIL** | None for packaging principle |
| **Blocks formal closure?** | No |

### PD-ID-02 — Slice identifier

| Field | Content |
| --- | --- |
| **Question** | Confirm working slice ID? |
| **Approved direction** | Working identifier **`L-PORTAL-01`** |
| **PO response** | `APPROVE` |
| **Status** | `APPROVED_DIRECTION` |
| **PENDING_DETAIL** | None |
| **Blocks formal closure?** | No |

### PD-ID-03 — Account creation / invitation

| Field | Content |
| --- | --- |
| **Question** | How does a Portal account come into existence? |
| **Approved direction** | **Staff-initiated** account creation/invitation against an **existing authoritative MPI Patient** record. **No** unrestricted self-registration. **No** demographic-only identity matching. |
| **PO response** | `APPROVE` (recommended Option A) |
| **Status** | `APPROVED_DIRECTION` + D2/D3/D4 `PRODUCT_OWNER_APPROVED`; D1 technical pending |
| **Detail direction (2026-10-14)** | Dedicated invite permission (not `user.manage`); configurable delivery; **expiry min 1h / max 72h / default 24h** (hospital configures within bounds; server-enforce; fail closed); staff re-invite invalidates prior unused invite |
| **PENDING_DETAIL (blocking)** | None |
| **Blocks formal closure?** | **No** |

### PD-ID-04 — Link verification

| Field | Content |
| --- | --- |
| **Question** | What makes a link verified/active? |
| **Approved direction** | A **defined, explicit verification process is mandatory** before a Portal account is linked to a patient. Demographic match alone is forbidden as sole proof (aligns PD-PP-11). |
| **PO response** | `APPROVE` (direction only) |
| **Status** | `APPROVED_DIRECTION` + D1/D2 `PRODUCT_OWNER_APPROVED` |
| **Detail direction (2026-10-14)** | Catalogue: staff checklist; in-person evidence review; OTP to verified contact + staff confirmation; demographic-only forbidden; pending expire; verified until revoke/remediate |
| **PENDING_DETAIL (blocking)** | None (checklist/document/OTP assurance field contents = engineering residual) |
| **Blocks formal closure?** | **No** |

### PD-ID-05 — Service ownership

| Field | Content |
| --- | --- |
| **Question** | Who owns Portal identity and patient-account linkage SoT? |
| **Approved direction** | **AuthService** owns Portal identity and patient-account linkage (subject to architecture evidence: MPI Patient + Identity in AuthService). **Do not** duplicate patient-identity ownership in LaboratoryApi. |
| **PO response** | `APPROVE` (recommended Option A) |
| **Status** | `APPROVED_DIRECTION` |
| **PENDING_DETAIL** | Cross-service trust contract for future consumers (technical at impl design; not a competing ownership SoT) |
| **Blocks formal closure?** | No (ownership direction closed) |

### PD-ID-06 — Link cardinality and lifecycle

| Field | Content |
| --- | --- |
| **Question** | Cardinality of Portal principal ↔ Patient? |
| **Approved direction** | Conservative first-slice rule: **one active verified Portal principal per Patient** and **one active Patient link per Portal principal**. **No** shared-family or proxy/guardian access in this slice. Does **not** permanently forbid future separately authorized access models. |
| **PO response** | `APPROVE` (precise 1:1 active links) |
| **Status** | `APPROVED_DIRECTION` + D1…D4 `PRODUCT_OWNER_APPROVED` |
| **Detail direction (2026-10-14)** | Same-principal credential recovery; deny on deceased (no proxy); no silent merge repoint — block until remediation; controlled audited reassignment only |
| **PENDING_DETAIL (blocking)** | None for PD-ID-06 |
| **Blocks formal closure?** | **No** |

### PD-ID-07 — Link conflicts and correction

| Field | Content |
| --- | --- |
| **Question** | Defective links and remediation? |
| **Approved direction** | **Fail closed** for missing, ambiguous, invalid, stale, or conflicting links. **Authorized, audited staff remediation** — **not** patient self-service relinking in first slice. |
| **PO response** | `APPROVE` |
| **Status** | `APPROVED_DIRECTION` + D2/D3 `PRODUCT_OWNER_APPROVED`; D1 technical pending (exact permission code) |
| **Detail direction (2026-10-14)** | Dedicated remediation permission (not `user.manage`); reason capture for revoke/correct/mark-unverified; dual control for wrong-patient; deny+revoke+re-verify+audit+hospital ops notification process |
| **PENDING_DETAIL (blocking)** | None for product policy (exact permission string = technical) |
| **Blocks formal closure?** | **No** |

### PD-ID-08 — Principal separation

| Field | Content |
| --- | --- |
| **Question** | Staff vs patient principal separation? |
| **Approved direction** | **Distinct** patient-Portal authentication and authorization gates; distinct Portal token audience/principal context **where supported** by existing auth architecture. Staff auth and staff LMS authz remain separate. **Do not** infer patient authority from staff token, role, branch membership, browser-supplied PatientId, or demographics. |
| **PO response** | `APPROVE` |
| **Status** | `APPROVED_DIRECTION` + D1 `PRODUCT_OWNER_APPROVED` |
| **Detail direction (2026-10-14)** | Dual separate accounts permitted; independently authenticated; staff token never establishes patient identity; no silent context switch |
| **PENDING_DETAIL (blocking)** | None |
| **Blocks formal closure?** | **No** |

### PD-ID-09 — First-slice boundary

| Field | Content |
| --- | --- |
| **Question** | What is in the first identity slice? |
| **Approved direction** | Bounded first slice: **real Portal authentication UX**, patient-principal authorization, **verified linkage**, and **server-side resolution** of authenticated principal → authoritative PatientId. **Not** a complete Patient Portal rewrite; **not** wiring unrelated Portal modules in this task/slice. |
| **PO response** | `APPROVE` (A+B direction) |
| **Status** | `APPROVED_DIRECTION` |
| **PENDING_DETAIL** | Staff “Portal Access” admin surface — default **out** (form **PD-ID-09-D1**, minor) |
| **Blocks formal closure?** | Minor — default out of scope unless PO expands |

### PD-ID-10 — Self-registration and linkage UX

| Field | Content |
| --- | --- |
| **Question** | Self-registration / self-linking in first slice? |
| **Approved direction** | **No** automatic self-registration or patient self-linking. Use **staff-mediated** direction (PD-ID-03) subject to verification (PD-ID-04). Do **not** assume invitation UX, Staff Portal Access tab, or new admin workflow is approved unless within agreed first-slice boundary. |
| **PO response** | `APPROVE` (no auto self-serve) |
| **Status** | `APPROVED_DIRECTION` |
| **PENDING_DETAIL** | Tied to PD-ID-03 invite ops details |
| **Blocks formal closure?** | Covered under PD-ID-03 details |

### PD-ID-11 — Audit

| Field | Content |
| --- | --- |
| **Question** | Which identity events require audit? |
| **Approved direction** | Audit relevant **authentication outcomes**, **link creation**, **verification**, **revocation/correction**, and **denied** patient-identity resolution attempts. |
| **PO response** | `APPROVE` (direction) |
| **Status** | `APPROVED_DIRECTION` + D2/D3 `PRODUCT_OWNER_APPROVED`; D1 event contract **RATIFIED_APPROVE_WITH_EDITS** (login BEST_EFFORT) |
| **Detail direction (2026-10-14)** | Named catalogue ratified (see [implementation readiness §5](./enterprise-lms-patient-portal-identity-implementation-readiness.md)); retention **2,555 days**; fail closed on mandatory mutations/resolve denials |
| **PENDING_DETAIL (blocking)** | None |
| **Blocks formal closure?** | **No** |

### PD-ID-12 — L-REP-04 dependency

| Field | Content |
| --- | --- |
| **Question** | Hard gate vs L-REP-04 patient path? |
| **Approved direction** | **Hard dependency:** patient-facing L-REP-04 publication/content access remains **blocked** until identity prerequisite is **implemented, automated-tested, Manual-UAT-tested, and explicitly accepted**, then **separate** L-REP-04 implementation authorization. |
| **PO response** | `APPROVE` |
| **Status** | `APPROVED_DIRECTION` |
| **PENDING_DETAIL** | None for the gate principle |
| **Blocks formal closure?** | No |

---

## 5. Remaining decisions blocking formal closure

**None.** Former blockers resolved:

| ID | Status | Approved outcome |
| --- | --- | --- |
| **PD-ID-03-D3** | `PRODUCT_OWNER_APPROVED` | Min **1h** / max **72h** / default **24h**; hospital configures within bounds; server-enforce; fail closed |
| **PD-ID-04-D1** | `PRODUCT_OWNER_APPROVED` | Catalogue: staff checklist; in-person evidence; OTP+staff confirmation; demographic-only forbidden |
| **PD-ID-11-D2** | `PRODUCT_OWNER_APPROVED` | Retention **2,555 days** (explicit PO choice) |

**Formal Product Decision Closure status:** `COMPLETE` — [enterprise-lms-patient-portal-identity-product-decision-closure.md](./enterprise-lms-patient-portal-identity-product-decision-closure.md) (`PRODUCT_DECISIONS_CLOSED_L_PORTAL_01`).

**Separate implementation-authorization gate:** required — **not** granted by closure documentation.

---

## 6. Dependency matrix (updated)

```text
APPROVED_DIRECTION: PD-ID-01 + PD-ID-02 + PD-ID-05 + PD-ID-09 + PD-ID-10 + PD-ID-12
PD-ID-03…08,11 detail PRODUCT_OWNER_APPROVED (D1 permission/audit codes tech pending where noted)
CONFIGURABLE_POLICY_MODEL_RECORDED
PRODUCT_DECISIONS_CLOSED_L_PORTAL_01
```

| Gate | Waiting on |
| --- | --- |
| Formal Product Decision Closure | **Complete** |
| Identity implementation authorization | Explicit separate PO/engineering authorization |
| L-REP-04 patient implementation authorization | PD-ID-12 + identity accepted + separate L-REP-04 auth |

---

## 7. Candidate scope / exclusions (not authorized)

**In (candidate):** Patient Portal authentication + principal separation; explicitly verified linkage to existing MPI Patient; server-side principal→PatientId resolution; fail-closed defective linkage; audited link lifecycle + identity-resolution denials; real Portal login UX (PD-ID-09).

**Out:** L-REP-04 publication/content delivery; proxy/guardian/shared-family; Pathology / LabReport dual-write; CUT C/D changes; public Blob/SAS/anonymous; NotificationHub as report SoT; silent role grants; full Portal rewrite; runtime/migrations/speculative APIs in this task.

---

## 8. Approval register

| ID | Directional status | Detail status | PO response (direction) | PENDING_DETAIL? |
| --- | --- | --- | --- | --- |
| PD-ID-01 | `APPROVED_DIRECTION` | — | `APPROVE` | No |
| PD-ID-02 | `APPROVED_DIRECTION` | — | `APPROVE` | No |
| PD-ID-03 | `APPROVED_DIRECTION` | D2/D3/D4 approved; D1 tech pending | `APPROVE` | No |
| PD-ID-04 | `APPROVED_DIRECTION` | D1/D2 approved | `APPROVE` | No |
| PD-ID-05 | `APPROVED_DIRECTION` | — | `APPROVE` | No |
| PD-ID-06 | `APPROVED_DIRECTION` | D1–D4 `PRODUCT_OWNER_APPROVED` | `APPROVE` | No |
| PD-ID-07 | `APPROVED_DIRECTION` | D2/D3 approved; D1 tech pending | `APPROVE` | No |
| PD-ID-08 | `APPROVED_DIRECTION` | D1 `PRODUCT_OWNER_APPROVED` | `APPROVE` | No |
| PD-ID-09 | `APPROVED_DIRECTION` | minor default out | `APPROVE` | Minor |
| PD-ID-10 | `APPROVED_DIRECTION` | — | `APPROVE` | Via PD-ID-03 |
| PD-ID-11 | `APPROVED_DIRECTION` | D2/D3 approved; D1 **ratified** (`APPROVE_WITH_EDITS`) | `APPROVE` | No |
| PD-ID-12 | `APPROVED_DIRECTION` | — | `APPROVE` | No |

---

## 9. Next Product Owner / program actions

Explicitly approve [bounded implementation plan](./enterprise-lms-patient-portal-identity-bounded-implementation-plan.md) before runtime. Do **not** reopen PD-ID-* or PD-PP-01…12. Permission seed/grant remains separately unauthorized.

---

## 10. Status stamps

```text
PRODUCT_DECISIONS_CLOSED_L_PORTAL_01 = PRESERVED
L_PORTAL_01_IMPLEMENTATION_AUTHORIZATION = GRANTED
AUDIT_EVENT_CONTRACT = RATIFIED_APPROVE_WITH_EDITS
PORTAL_AUTH_LOGIN_SUCCESS_FAILURE_AUDIT = BEST_EFFORT
RUNTIME_IMPLEMENTATION = NOT_STARTED
MANDATORY_PRODUCT_OWNER_BLOCKERS = NONE
BLOCKER-PP-IDENTITY-01 = OPEN
L_REP_04_IMPLEMENTATION = NOT_AUTHORIZED
PD-PP-01…12 = PRESERVED
ACCEPTED_L_REP_03_CUT_C = PRESERVED
ACCEPTED_L_REP_03_CUT_D = PRESERVED
LEGACY_PATHOLOGY = UNCHANGED
APPLICATION_RUNTIME_UNCHANGED
NO_APPLICATION_TESTS_EXECUTED
BOUNDED_IMPLEMENTATION_PLAN = RECORDED_AWAITING_EXPLICIT_APPROVAL
NEXT_GATE = EXPLICIT_APPROVAL_OF_BOUNDED_IMPLEMENTATION_PLAN
```

---

## 11. Mandatory stop

**STOP.** Product decisions closed; audit contract ratified; bounded plan recorded. Runtime not started.  
Do **not** implement `L-PORTAL-01` runtime or L-REP-04 until the bounded plan is explicitly approved.
