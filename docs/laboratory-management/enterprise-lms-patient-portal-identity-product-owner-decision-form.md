# L-PORTAL-01 — Patient Portal Identity Linkage  
# Product Owner Decision Form (Detail Resolutions Recorded)

**Date:** 2026-10-14 (updated — final mandatory detail approvals recorded; see Product Decision Closure)  
**Mode:** DOCUMENTATION / DECISION GOVERNANCE ONLY — not implementation authorization  
**Slice:** `L-PORTAL-01` — Patient Portal Authenticated Identity ↔ Patient Linkage  

**Authoritative companions:**

| Document | Role |
| --- | --- |
| [enterprise-lms-patient-portal-identity-product-decision-closure.md](./enterprise-lms-patient-portal-identity-product-decision-closure.md) | **Authoritative** formal Product Decision Closure |
| [enterprise-lms-patient-portal-identity-implementation-readiness.md](./enterprise-lms-patient-portal-identity-implementation-readiness.md) | Audit contract ratification + next gate |
| [enterprise-lms-patient-portal-identity-decision-package.md](./enterprise-lms-patient-portal-identity-decision-package.md) | Full PD-ID-01…12 register + evidence + configurability model |
| [enterprise-lms-patient-portal-identity-product-decision-review.md](./enterprise-lms-patient-portal-identity-product-decision-review.md) | Gate status |
| [enterprise-lms-patient-portal-identity-prerequisite-specification.md](./enterprise-lms-patient-portal-identity-prerequisite-specification.md) | Conditional spec |
| [enterprise-lms-patient-portal-identity-readiness-audit.md](./enterprise-lms-patient-portal-identity-readiness-audit.md) | Repository evidence baseline |

```text
PRODUCT_DECISIONS_CLOSED_L_PORTAL_01 = PRESERVED
L_PORTAL_01_IMPLEMENTATION_AUTHORIZATION = GRANTED
AUDIT_EVENT_CONTRACT = RATIFIED_APPROVE_WITH_EDITS
PORTAL_AUTH_LOGIN_SUCCESS_FAILURE_AUDIT = BEST_EFFORT
RUNTIME_IMPLEMENTATION = NOT_STARTED
MANDATORY_PRODUCT_OWNER_BLOCKERS = NONE
BLOCKER-PP-IDENTITY-01 = OPEN
L_REP_04_IMPLEMENTATION = NOT_AUTHORIZED
BOUNDED_IMPLEMENTATION_PLAN = RECORDED_AWAITING_EXPLICIT_APPROVAL
NEXT_GATE = EXPLICIT_APPROVAL_OF_BOUNDED_IMPLEMENTATION_PLAN
```

### Status vocabulary (this form)

| Status | Meaning |
| --- | --- |
| `PRODUCT_OWNER_APPROVED` | Explicit PO product-policy decision recorded; no mandatory business question remains for this D-item |
| `APPROVED_DIRECTION_TECHNICAL_DETAIL_PENDING` | Product policy approved; exact technical strings/codes/wiring await proposal + later PO ratification or engineering design |
| `ENGINEERING_VALIDATION_REQUIRED` | Capability or binding to infra must be validated at implementation design — not a substitute for missing PO policy |
| `BLOCKED_PENDING_EXPLICIT_PRODUCT_OWNER_DECISION` | Mandatory business/policy value unresolved; **blocks formal Product Decision Closure** |

**Provenance (2026-10-14):** Product Owner explicitly approved the detail directions in the project conversation for this slice, including the requirement that invitation, verification, expiry, recovery, and identity-remediation workflows be **configurable within hospital-approved policy and platform-enforced security safeguards**. No separate repository signature artifact found.

---

## 1. Purpose

Record Product Owner resolutions for PD-ID-03/04/06/07/08/11 detail items, distinguish approved policy from technical residuals, and list **only** the remaining mandatory blockers that prevent formal Product Decision Closure.

Do **not** reapprove PD-ID-01…12 directional approvals. Do **not** reopen PD-PP-01…12.

---

## 2. Already closed (do not reopen)

| ID | Status | Notes |
| --- | --- | --- |
| PD-ID-01, PD-ID-02, PD-ID-05, PD-ID-09, PD-ID-10, PD-ID-12 | `APPROVED_DIRECTION` | Packaging, slice ID, AuthService ownership, first-slice boundary, no self-reg, L-REP-04 hard gate |
| PD-PP-01…12 (L-REP-04) | `APPROVED` / closed | Including PD-PP-11 — **must not reopen** |
| Directional cores of PD-ID-03/04/06/07/08/11 | `APPROVED_DIRECTION` | Preserved |

---

## 3. Configurability model (PO-approved product policy)

Flexibility is **policy configuration under server-enforced safeguards**, not a security bypass.

| Layer | What is configurable | Enforcement |
| --- | --- | --- |
| **Hospital / tenant policy** | Permitted delivery channels (email, SMS, both, staff-delivered single-use token); permitted verification methods (from PO-approved catalogue, PD-ID-04-D1); invitation expiry within **approved bounds** (PD-ID-03-D3: min 1h / max 72h / default 24h; hospital configures allowed range and default within platform bounds); whether periodic re-verification is required (default: **not**, per PD-ID-04-D2); audit retention **2,555 days** (PD-ID-11-D2 explicit PO choice) | Server-side only; fail closed if policy missing, invalid, conflicting, or outside approved bounds |
| **Per invitation / operation** | Selection among **policy-enabled** delivery channels; selection among **policy-enabled** verification methods; expiry within **approved bounds** | Client-supplied PatientId, delivery policy, verification status, permission, or linkage are **never** authoritative |
| **Not configurable by client / not bypassable** | Dedicated invite/remediation permissions; single-use + expiry + revocation/supersession; fail-closed defective links; dual-control wrong-patient correction; staff token ≠ patient identity; demographic-only match forbidden; audit fail-closed for mandatory identity events | Platform-enforced |

**Architectural note (documentation only — not authorized to build now):** A later authorized implementation slice must provide a **server-side policy configuration surface** (settings/store TBD) for the hospital-level controls above. This governance task does **not** introduce a policy engine, UI, table, service, or framework.

**Verified existing capability (adjacent, not portal-complete):** Staff AppUser activation email/SMS OTP (`UsersController` `send-activation`, `user.manage`); NotificationService delivery paths; staff OTP ~48h in code — **not** Portal policy. General `AuditService` / `StageAsync` / LMS fail-closed patterns. **Absent:** portal invite E2E, portal verification workflow, portal link store, portal remediation permissions, portal audit catalogue.

---

## 4. Detail resolution register

### PD-ID-03 — Invitation and account creation

#### PD-ID-03-D1 — Authorized inviter permission

| Field | Content |
| --- | --- |
| **PO decision** | Use a **dedicated least-privilege Portal invitation permission**. Do **not** silently reuse broad `user.manage`. |
| **Status** | `APPROVED_DIRECTION_TECHNICAL_DETAIL_PENDING` |
| **Why not fully closed** | Exact permission **code string** and role-binding design are technical; must be proposed at implementation and must not be seeded/granted in this task |
| **Blocks formal closure?** | **No** (policy principle approved) |
| **Approval** | `☑ PRODUCT_OWNER_APPROVED` (policy: dedicated invite permission; forbid silent `user.manage` reuse) — **2026-10-14** |

#### PD-ID-03-D2 — Invitation delivery channel

| Field | Content |
| --- | --- |
| **PO decision** | Delivery must be **configurable**. Support **email**, **SMS**, **both**, and **staff-delivered single-use tokens** as **policy-enabled** options. Do **not** require one universal delivery method. |
| **Status** | `PRODUCT_OWNER_APPROVED` (+ `ENGINEERING_VALIDATION_REQUIRED` for wiring reuse of staff NotificationService paths — not claimed as portal E2E today) |
| **Repository evidence** | No portal-invite E2E; staff activation delivery exists as adjacent pattern only |
| **Blocks formal closure?** | **No** |
| **Approval** | `☑ PRODUCT_OWNER_APPROVED` — **2026-10-14** |

#### PD-ID-03-D3 — Invitation expiry duration

| Field | Content |
| --- | --- |
| **PO decision** | Explicit platform bounds and default for Patient Portal invitation lifetime: **minimum 1 hour**, **maximum 72 hours**, **default 24 hours**. Policy model: the **hospital configures** its allowed range and default **within** these platform bounds. Configured default must be within configured min and max. Effective lifetime must be validated and enforced **server-side**. Missing, invalid, inconsistent, or conflicting policy must **fail closed**. |
| **Status** | `PRODUCT_OWNER_APPROVED` |
| **Not claimed** | These values were **not** previously existing Portal policy and are **not** derived from staff OTP ~48h implementation |
| **Blocks formal closure?** | **No** |
| **Approval** | `☑ PRODUCT_OWNER_APPROVED` — min **1h** / max **72h** / default **24h** + hospital configures within bounds — **2026-10-14** (project conversation) |

#### PD-ID-03-D4 — Invitation recovery / re-invite

| Field | Content |
| --- | --- |
| **PO decision** | Re-invitation is **staff-initiated** in initial scope. A replacement invitation must **invalidate** the previous unused invitation. **No** patient self-service invitation creation or re-invitation in this slice. |
| **Status** | `PRODUCT_OWNER_APPROVED` |
| **Safeguards required (policy; not implemented)** | Secure single-use tokens; expiry enforcement; revocation/supersession; protection against token disclosure; appropriate auditability — verify at impl; do not claim present for portal |
| **Blocks formal closure?** | **No** |
| **Approval** | `☑ PRODUCT_OWNER_APPROVED` — **2026-10-14** |

---

### PD-ID-04 — Verification

#### PD-ID-04-D1 — Verification method and evidence

| Field | Content |
| --- | --- |
| **PO decision** | Approved **configurable** verification-method catalogue (only methods permitted by applicable hospital policy may be offered/used): (1) **Authorized staff verification checklist**; (2) **In-person identity evidence review**; (3) **OTP to a verified contact, combined with staff confirmation**. Demographic-only matching must **never** establish or prove identity. Process must capture required verification **outcome**, responsible **actor**, and **evidence metadata** under approved policy. |
| **Status** | `PRODUCT_OWNER_APPROVED` (+ residual `ENGINEERING_VALIDATION_REQUIRED` / impl design for checklist field contents, acceptable identity-document lists, OTP assurance level, and contact-verification procedure — **not invented as approved technical detail**) |
| **Not claimed** | Methods are **not** implemented in repository merely because approved as product direction |
| **Blocks formal closure?** | **No** |
| **Approval** | `☑ PRODUCT_OWNER_APPROVED` — catalogue (1)(2)(3) + demographic-only prohibition — **2026-10-14** (project conversation) |

#### PD-ID-04-D2 — Pending / verified link lifetime

| Field | Content |
| --- | --- |
| **PO decision** | Pending/unverified invitations and links must **not** remain usable beyond the effective invitation/verification policy. Verified links remain valid until **revoked or remediated** unless an explicitly approved policy later requires periodic re-verification. **No** periodic re-verification mandated in this approval. |
| **Status** | `PRODUCT_OWNER_APPROVED` (pending lifetime aligns with PD-ID-03-D3 bounds once configured) |
| **Blocks formal closure?** | **No** |
| **Approval** | `☑ PRODUCT_OWNER_APPROVED` — **2026-10-14** |

---

### PD-ID-06 — Lifecycle

#### PD-ID-06-D1 — Account recovery

| Field | Content |
| --- | --- |
| **PO decision** | Normal credential recovery retains the **same** Portal principal. Principal replacement requires authorized, audited remediation and verification. |
| **Status** | `PRODUCT_OWNER_APPROVED` |
| **Blocks formal closure?** | **No** |
| **Approval** | `☑ PRODUCT_OWNER_APPROVED` — **2026-10-14** |

#### PD-ID-06-D2 — Deceased patient

| Field | Content |
| --- | --- |
| **PO decision** | **Deny** Portal patient access when the authoritative patient record indicates deceased. Do **not** grant proxy/guardian access in this slice. |
| **Status** | `PRODUCT_OWNER_APPROVED` |
| **Evidence** | `Patient.DeceasedDate` exists; portal handling absent (planned) |
| **Blocks formal closure?** | **No** |
| **Approval** | `☑ PRODUCT_OWNER_APPROVED` — **2026-10-14** |

#### PD-ID-06-D3 — MPI merge

| Field | Content |
| --- | --- |
| **PO decision** | Do **not** silently repoint identity links during MPI merge. **Block** affected resolution until authorized remediation establishes exactly one valid verified link to the surviving patient. |
| **Status** | `PRODUCT_OWNER_APPROVED` |
| **Blocks formal closure?** | **No** |
| **Approval** | `☑ PRODUCT_OWNER_APPROVED` — **2026-10-14** |

#### PD-ID-06-D4 — Reassignment

| Field | Content |
| --- | --- |
| **PO decision** | Permit controlled staff remediation/reassignment only under explicit authorization, reason capture, revocation/supersession of the old link, and audit. Do **not** silently reassign. |
| **Status** | `PRODUCT_OWNER_APPROVED` |
| **Blocks formal closure?** | **No** |
| **Approval** | `☑ PRODUCT_OWNER_APPROVED` — **2026-10-14** |

---

### PD-ID-07 — Remediation

#### PD-ID-07-D1 — Remediation permission

| Field | Content |
| --- | --- |
| **PO decision** | Use a **dedicated least-privilege identity-link remediation permission**. Do **not** silently reuse `user.manage`. |
| **Status** | `APPROVED_DIRECTION_TECHNICAL_DETAIL_PENDING` |
| **Why not fully closed** | Exact permission code string TBD at implementation design; no seed/grant now |
| **Blocks formal closure?** | **No** (policy principle approved) |
| **Approval** | `☑ PRODUCT_OWNER_APPROVED` (policy) — **2026-10-14** |

#### PD-ID-07-D2 — Operations and dual control

| Field | Content |
| --- | --- |
| **PO decision** | Require authorization and reason capture for **revoke**, **correct/reassign**, and **mark-unverified**. Wrong-patient correction must use **dual control**: initiating remediator + **separate** authorized approver; same actor must **not** satisfy both roles. |
| **Status** | `PRODUCT_OWNER_APPROVED` |
| **Blocks formal closure?** | **No** |
| **Approval** | `☑ PRODUCT_OWNER_APPROVED` — **2026-10-14** |

#### PD-ID-07-D3 — Wrong-patient recovery

| Field | Content |
| --- | --- |
| **PO decision** | On suspected or confirmed wrong-patient link: **deny** Portal identity resolution; **revoke** affected link; require **re-verification** before relinking; **audit** the incident; follow the hospital’s **approved** security/operations notification process. |
| **Status** | `PRODUCT_OWNER_APPROVED` (+ `ENGINEERING_VALIDATION_REQUIRED` to bind hospital ops notification process — **do not invent** a channel or claim one exists in-repo) |
| **Blocks formal closure?** | **No** (procedure approved; ops channel mapping is operational binding, not a invented product default) |
| **Approval** | `☑ PRODUCT_OWNER_APPROVED` — **2026-10-14** |

---

### PD-ID-08 — Dual accounts

#### PD-ID-08-D1

| Field | Content |
| --- | --- |
| **PO decision** | Permit the same human to hold **separate** staff and patient Portal accounts when independently authenticated and authorized. A staff token must **never** establish patient identity. Do **not** silently switch identity contexts or reuse staff JWT claims as patient authority. |
| **Status** | `PRODUCT_OWNER_APPROVED` |
| **Blocks formal closure?** | **No** |
| **Approval** | `☑ PRODUCT_OWNER_APPROVED` — **2026-10-14** |

---

### PD-ID-11 — Audit

#### PD-ID-11-D1 — Audit catalogue governance

| Field | Content |
| --- | --- |
| **PO decision** | Named audit-event catalogue covering authentication outcomes, link creation/verification/revocation/correction, invitation/remediation lifecycle, and denied patient-identity resolution. Minimal actor/action/time/outcome + linkage identifiers; never credentials/tokens/unnecessary patient data. |
| **Status** | `PRODUCT_OWNER_APPROVED` — catalogue **ratified** as `APPROVE_WITH_EDITS` |
| **Ratification** | Explicit PO decision **2026-10-14** (project conversation): `PRODUCT_OWNER_AUDIT_EVENT_CONTRACT = APPROVE_WITH_EDITS`; `PORTAL_AUTH_LOGIN_SUCCESS_FAILURE_AUDIT = BEST_EFFORT`; additional conditions `NONE_SUPPLIED`. Authoritative catalogue: [implementation readiness §5](./enterprise-lms-patient-portal-identity-implementation-readiness.md) |
| **Blocks formal closure?** | **No** |
| **Approval** | `☑ PRODUCT_OWNER_APPROVED` (governance) — **2026-10-14**; catalogue ratification **2026-10-14** |

#### PD-ID-11-D2 — Retention

| Field | Content |
| --- | --- |
| **PO decision** | Explicit Product Owner choice: Portal identity audit retention period = **2,555 days**. This is an **explicit PO business decision**, not merely inheritance of AuthService infra default `RetentionDays = 2555`. |
| **Status** | `PRODUCT_OWNER_APPROVED` |
| **Policy identifier** | **Not required** by prior form options (period OR policy reference); no separate hospital policy document ID was provided or invented |
| **Blocks formal closure?** | **No** |
| **Approval** | `☑ PRODUCT_OWNER_APPROVED` — **2,555 days** — **2026-10-14** (project conversation) |

#### PD-ID-11-D3 — Fail closed

| Field | Content |
| --- | --- |
| **PO decision** | **Fail closed** if mandatory auditing fails for identity-link creation, verification, revocation, correction, or resolution denials that require an audit record. Do **not** choose best-effort auditing for these operations. |
| **Status** | `PRODUCT_OWNER_APPROVED` (+ `ENGINEERING_VALIDATION_REQUIRED` to select AuthService `StageAsync` / equivalent fail-closed path at impl — patterns exist; portal wiring absent) |
| **Blocks formal closure?** | **No** |
| **Approval** | `☑ PRODUCT_OWNER_APPROVED` — **2026-10-14** |

---

### PD-ID-09-D1 — Staff Portal Access admin surface (minor)

| Field | Content |
| --- | --- |
| **Status** | Unchanged preference: default **OUT** unless invite/remediation UX requires a minimal staff surface tied to approved permissions |
| **PO stamp** | **Not** explicitly decided in 2026-10-14 detail direction |
| **Blocks formal closure?** | **No** (minor; default out) |

---

## 5. Remaining mandatory Product Owner blockers

**None.** PD-ID-03-D3, PD-ID-04-D1, and PD-ID-11-D2 are `PRODUCT_OWNER_APPROVED`.

Residual items that **do not** block product-decision closure (implementation / engineering):

| ID | Classification | Residual |
| --- | --- | --- |
| PD-ID-03-D1 | `APPROVED_DIRECTION_TECHNICAL_DETAIL_PENDING` | Exact invite permission code string (separate seed authorization) |
| PD-ID-07-D1 | `APPROVED_DIRECTION_TECHNICAL_DETAIL_PENDING` | Exact remediation permission code string (separate seed authorization) |
| PD-ID-04-D1 | `ENGINEERING_VALIDATION_REQUIRED` (content detail) | Checklist fields, document lists, OTP assurance, contact-verification procedure — not invented here |
| PD-ID-09-D1 | Minor | Staff Portal Access surface default **OUT** |

**Audit catalogue (PD-ID-11-D1):** ratified — see [implementation readiness §5](./enterprise-lms-patient-portal-identity-implementation-readiness.md).  
**Formal Product Decision Closure:** see [enterprise-lms-patient-portal-identity-product-decision-closure.md](./enterprise-lms-patient-portal-identity-product-decision-closure.md).

---

## 6. Status stamps

```text
PRODUCT_DECISIONS_CLOSED_L_PORTAL_01 = PRESERVED
L_PORTAL_01_IMPLEMENTATION_AUTHORIZATION = GRANTED
AUDIT_EVENT_CONTRACT = RATIFIED_APPROVE_WITH_EDITS
PORTAL_AUTH_LOGIN_SUCCESS_FAILURE_AUDIT = BEST_EFFORT
RUNTIME_IMPLEMENTATION = NOT_STARTED
APPROVED_DIRECTION_TECHNICAL_DETAIL_PENDING = PD-ID-03-D1; PD-ID-07-D1
BLOCKED_PENDING_EXPLICIT_PRODUCT_OWNER_DECISION = NONE
BLOCKER-PP-IDENTITY-01 = OPEN
L_REP_04_IMPLEMENTATION = NOT_AUTHORIZED
PD-PP-01…12 = PRESERVED_NOT_REOPENED
APPLICATION_RUNTIME_UNCHANGED
NO_APPLICATION_TESTS_EXECUTED
BOUNDED_IMPLEMENTATION_PLAN = RECORDED_AWAITING_EXPLICIT_APPROVAL
NEXT_GATE = EXPLICIT_APPROVAL_OF_BOUNDED_IMPLEMENTATION_PLAN
```

---

## 7. Mandatory stop

**STOP.** Product decisions closed; audit contract ratified; bounded plan recorded. Runtime **NOT_STARTED**.  
Do **not** implement `L-PORTAL-01` runtime until the [bounded plan](./enterprise-lms-patient-portal-identity-bounded-implementation-plan.md) is explicitly approved. Do **not** authorize L-REP-04. `BLOCKER-PP-IDENTITY-01` remains **OPEN** until identity is implemented, tested, UAT’d, and accepted.
