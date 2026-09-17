# Phase 3H Counsellor Ownership & Work Allocation
## Product Decisions — Final Working Specification

| Field | Value |
|-------|--------|
| **Document date** | 2026-09-16 |
| **Consolidation date** | 2026-09-16 |
| **Phase type** | **PRODUCT DECISION CONSOLIDATION** — no production code, API, DB, migration, seed, permission, UI, or lifecycle changes in this task |
| **Diagnosis input** | `docs/audits/counsellor-ownership-work-allocation-phase3h-audit.md` |
| **Prior decision SoT** | Phase 2W product decisions / workshop pack / final gate; Phase 2V–2Z audits; Phase 2X Slice 1/2; Phase 2Y honesty; Phase 2Z Analytics; Phase 3F/3G session docs; **PD-WL-01**; **PD7**; **PD16**; **PD13 / PD14 / PD15**; **PD4** |
| **Sign-off rule** | **SIGNED / APPROVED** only when named product stakeholders complete the formal sign-off table. Workshop agreement ≠ named formal signature. No fabricated names/signatures. |
| **This consolidation** | Decisions below were **explicitly agreed** in the Phase 3H workshop for implementation workflow. Status: **WORKING — AGREED FOR IMPLEMENTATION WORKFLOW / NOT FORMALLY SIGNED** |

---

## 1. Decision status

| Metric | Status |
|--------|--------|
| Phase 3H diagnosis | **COMPLETE** |
| Phase 3H workshop decisions for ownership/work-allocation scope | **CONSOLIDATED** (this document) |
| Formally **SIGNED / APPROVED** (named stakeholders) | **0** |
| Decision status for agreed IDs below | **WORKING — AGREED FOR IMPLEMENTATION WORKFLOW / NOT FORMALLY SIGNED** |
| Phase 3H product-decision consolidation for listed scope | **COMPLETE** |
| Production code changed by this task | **NO** |
| Phase 3I implementation | **MAY PREPARE / IMPLEMENT** against these working decisions — **not** started in this task |

### Sign-off status convention

| Status | Meaning |
|--------|---------|
| **SIGNED / APPROVED** | Named product stakeholder completed formal fields (name/role/date/signature) |
| **WORKING — AGREED FOR IMPLEMENTATION WORKFLOW / NOT FORMALLY SIGNED** | Explicitly agreed in workshop; may drive Phase 3I planning/implementation; **not** named formal hospital sign-off |
| **WORKING — NOT SIGNED** | Prior Phase 2W capture only; not reconfirmed in Phase 3H |
| **PRODUCT DECISION REQUIRED** | Still unresolved |

### Field distinctions (mandatory — do not collapse)

| Concept | Meaning | Must not become |
|---------|---------|-----------------|
| `CounselorId` | Operational owner of **active counselling work** (when assigned) | Owner of every downstream workflow; Waiting List visibility filter; Finalize Surgery owner; automatic Post-Surgery owner; Follow-up Center ACL |
| `CreatedByUserId` | Audit creator | Ownership |
| Actor (`ActorUserId` / logged-in user) | Who performed an action (e.g. assignment) | Automatic owner |
| `TenantId` | Tenant security boundary | Optional |
| `BranchId` | Operational/security scope per **PD16** | Client-granted access |

**Do not:** treat `CreatedByUserId` as ownership; infer ownership from who created a patient; infer ownership from opening/viewing a Waiting List row; silently claim on Start/open.

### Formal sign-off table (empty — no fabricated signatures)

| Role | Name | Decision IDs covered | Date | Signature |
|------|------|----------------------|------|-----------|
| Counselling Operations Lead | *(pending)* | | | |
| Clinical / Patient-flow Lead | *(pending)* | | | |
| Hospital IT / Platform Owner | *(pending)* | | | |
| Product Owner | *(pending)* | | | |

---

## 2. Existing authoritative contracts

| Contract / decision | Status after Phase 3H consolidation | Relationship |
|---------------------|-------------------------------------|--------------|
| **PD-WL-01** (shared Waiting List; no CounselorId/CreatedByUserId filter properties) | **Confirmed and refined** by **PD-WL-01** (Phase 3H B+D) | Visibility remains shared; mutation of owned active counselling is separately restricted |
| **PD7** Phase 2W working **A** (CounselorId = follow-up owner) | **Superseded for Follow-up Center** by **PD-FOLLOWUP-01**; **reframed** for counselling by **PD7** Hybrid **E** | CounselorId is active counselling ownership — **not** Follow-up ACL; **not** every downstream workflow |
| **PD16** working **D** (server-side branch auth) | **Unchanged / reaffirmed** | Client `branchId` never establishes authorization |
| **PD13 / PD14 / PD15** | **Unchanged** | No formula/destination changes for ownership |
| **PD4** working **A** (Post-Surgery remains in Centre; Ward/clinical authoritative) | **Unchanged** for responsibility type; **ownership** specified by **PD-POST-01** | Post-Surgery ownership is explicit assignment; not automatic pre-surgery inheritance |
| Phase 2W check 9 (ownership ≠ sole authorization; permissions remain) | **Unchanged / reaffirmed** | Owner ACL is **additional** to permissions + tenant + branch |
| Permissions baseline `counseling_sessions.*` | **Unchanged** in this document | Supervisory capability may need **minimum permission dependency** in Phase 3I if existing codes cannot express reassignment (**PD-SUP-01**) |

### Diagnosis baseline (pre-consolidation production facts — superseded as *policy*)

Historical code behavior recorded for migration planning only (not approved ongoing policy):

- Waiting List / Follow-up / Finalize shared; `CounselorId` stamped but not ACL  
- Admin create coalesced owner to creator  
- Requeue did not clear `CounselorId`  
- Analytics defaulted to All  
- Last-write-wins concurrent mutations  

**Agreed working decisions below supersede these as target policy for Phase 3I.**

---

## 3. PD7 — Core ownership model

### Decision ID: **PD7**

| Field | Value |
|-------|--------|
| **Question** | What is the operational meaning of `CounselorId`? |
| **Options** | A Personal · B Shared attribution · C Shared + claim · D Shared + supervisor assign · E Hybrid |
| **Selected option** | **E — Hybrid** |
| **Final business rule** | Shared operational queues remain shared, while active counselling work has explicit ownership. `CounselorId` represents the counsellor responsible for **active counselling work**. Do **not** interpret `CounselorId` as ownership of every downstream hospital workflow. |
| **Affected surfaces** | Waiting List (visibility shared; ownership via assignment); Counselling Session (owned when assigned); Follow-up (branch-shared — not CounselorId ACL); Finalize Surgery (shared — not CounselorId owner); Post-Surgery (explicit assignment, separate from counselling owner); Analytics (scope selector, not entitlement) |
| **Owner** | TBD — formal sign-off pending |
| **Effective date** | TBD — formal sign-off pending; **agreed for Phase 3I implementation workflow** |
| **Exceptions / conditions** | Downstream workflows have **explicit** surface rules (see matrix §20). Hybrid semantics are **not** left implicit. |
| **Notes** | Supersedes Phase 2W PD7 working Option A where that option implied Follow-up personal ownership / “assigned can see/act” as list ACL. Phase 3H Hybrid E + surface decisions are authoritative for implementation workflow. |
| **Sign-off status** | **WORKING — AGREED FOR IMPLEMENTATION WORKFLOW / NOT FORMALLY SIGNED** |

**Per-surface ownership rules (Hybrid E — mandatory explicit matrix):**

| Surface | Ownership / visibility rule |
|---------|----------------------------|
| Waiting List | Shared branch-authorized queue; ownership via **explicit assignment** only |
| Counselling Session (active) | `CounselorId` = owner when assigned; owner-level mutate restricted |
| Finalize Surgery | Shared operational; **does not** inherit counselling `CounselorId` as OT owner |
| Follow-up Active / Cold | Branch-shared; **no** original-session owner ACL |
| Post-Surgery | Shared queue entry; ownership via **explicit assignment**; no auto-inherit |
| Analytics | My Work / Branch scope; filter ≠ entitlement |

---

## 4. Waiting List decision

### Decision ID: **PD-WL-01**

| Field | Value |
|-------|--------|
| **Question** | Who should see Waiting List records? |
| **Options** | A All authorized · B Assigned only · C Unassigned + mine · D Supervisor-specific · E Other — **selected: B + D as refined below** |
| **Selected option** | **B + D** (interpreted with final rule — **not** “assigned-only visibility”) |
| **Final business rule** | Waiting List remains a **shared operational queue**. Authorized counsellors can see/work patients within their **server-authorized branch scope**. Client-supplied `branchId` is convenience/filtering only and **never** establishes authorization. Ownership is established through **explicit assignment**. Shared Waiting List visibility does **not** imply unrestricted mutation of another counsellor’s owned active counselling session. |
| **Affected surfaces** | Waiting List API/UI; Add Patient; assignment CTA |
| **Owner** | TBD — formal sign-off pending |
| **Effective date** | TBD — agreed for Phase 3I workflow |
| **Exceptions / conditions** | Cross-branch visibility prohibited unless multi-branch authorization permits. Mutation of owned active sessions follows **PD-AUTH-01** / **PD-REASSIGN-01**. |
| **Notes** | Confirms shared-queue contract of prior PD-WL-01 (no CounselorId population filter). Clarifies: visibility shared ≠ mutate-any. Does **not** introduce Waiting List filter-by-CounselorId. |
| **Sign-off status** | **WORKING — AGREED FOR IMPLEMENTATION WORKFLOW / NOT FORMALLY SIGNED** |

**Confirmation (agreed):**

- [x] Waiting List is a shared operational queue and `CounselorId` does **not** control Waiting List **visibility**.  
- [x] Shared visibility does **not** grant unrestricted mutation of another counsellor’s owned active session.

---

## 5. Unassigned-state decision

### Decision ID: **PD-WL-02**

| Field | Value |
|-------|--------|
| **Question** | May `CounselorId = NULL` be an intentional operational state? |
| **Options** | A Yes · B No · C Intake only · D Other |
| **Selected option** | **A — Allow unassigned sessions** |
| **Final business rule** | `CounselingSession.CounselorId` may be **NULL** while unassigned. Unassigned sessions remain visible in the shared, branch-authorized Waiting List. No automatic ownership backfill. `CreatedByUserId` must **not** be treated as ownership. |
| **Affected surfaces** | Create; Waiting List; Assignment; Analytics attribution (display only — not SoT owner) |
| **Owner** | TBD |
| **Effective date** | TBD — agreed for Phase 3I workflow |
| **Exceptions / conditions** | Legacy NULL rows: **do not backfill**. Historical Admin-owned rows: **do not backfill** (see PD-ADM-01). |
| **Notes** | Who sees: authorized branch Waiting List. Who may assign: **PD-ASSIGN-01**. May remain unassigned until explicitly assigned. |
| **Sign-off status** | **WORKING — AGREED FOR IMPLEMENTATION WORKFLOW / NOT FORMALLY SIGNED** |

| Sub-rule | Agreed answer |
|----------|---------------|
| Who sees unassigned | Shared Waiting List within server-authorized branch scope |
| Who may assign (initial) | Authorized counsellor per **PD-ASSIGN-01** |
| May remain unassigned? | Yes until explicit assignment |
| Admin-created → unassigned? | Yes (**PD-ADM-01**) |
| Legacy NULL / Admin-stamped treatment | **Do not backfill**; future policy may flag for ops review without silent mutation |

---

## 6. Admin-create decision

### Decision ID: **PD-ADM-01**

| Field | Value |
|-------|--------|
| **Question** | When Admin/front desk creates a counselling session, what happens to ownership? |
| **Options** | A Unassigned · B Admin owner · C Explicit select · D Assign on start/claim · E Other |
| **Selected option** | **A — Create as Unassigned** |
| **Final business rule** | When Admin/authorized non-counsellor creates a counselling session: `CounselorId = NULL` unless an explicit, authorized assignment is performed through the approved assignment workflow. Do **not** automatically set `CounselorId` to the Admin/creator. Do **not** use `CreatedByUserId` as owner. Do **not** backfill historical Admin-created sessions. |
| **Affected surfaces** | Create session; Waiting List Add Patient; Admin → counsellor intake |
| **Owner** | TBD |
| **Effective date** | TBD — agreed for Phase 3I workflow |
| **Exceptions / conditions** | Explicit authorized assignment at create time is allowed **only** via approved assignment workflow (not silent coalesce to creator). |
| **Notes** | Supersedes current code coalesce `request.CounselorId ?? currentUserId` for Admin/non-counsellor create path (implementation in Phase 3I). |
| **Sign-off status** | **WORKING — AGREED FOR IMPLEMENTATION WORKFLOW / NOT FORMALLY SIGNED** |

**Exact rule:**

> When Admin/authorized non-counsellor creates a counselling session without an approved assignment action: `CounselorId = NULL`. Visibility: shared Waiting List (branch-authorized). Mutation of counselling content: after assignment, per **PD-AUTH-01**.

---

## 7. Start / assignment decisions

### Decision ID: **PD-START-01** — Initial assignment

| Field | Value |
|-------|--------|
| **Question** | What establishes ownership when working from Waiting List? |
| **Selected option** | **Explicit assignment establishes ownership** (not open/view/start alone) |
| **Final business rule** | Selecting/opening a patient from the Waiting List does **not** by itself establish ownership. The UI must provide an **explicit assignment action**. User may: (1) Assign to myself, or (2) Assign to another counsellor. Selected counsellor becomes `CounselorId`. Opening/viewing and assigning are separate. Do **not** make patient viewing silently claim ownership. |
| **Affected surfaces** | Waiting List; Session open; Assignment UX |
| **Owner** | TBD |
| **Effective date** | TBD — agreed for Phase 3I workflow |
| **Exceptions / conditions** | Does not replace Supervisor/Admin **reassignment** of already-owned sessions (**PD-REASSIGN-01**). |
| **Notes** | “Claim” as a separate product word is replaced by **explicit assignment**. Start-if-null auto-stamp is **not** the approved ownership establishment path. |
| **Sign-off status** | **WORKING — AGREED FOR IMPLEMENTATION WORKFLOW / NOT FORMALLY SIGNED** |

| If `CounselorId = Admin` (legacy data) | Agreed treatment |
|----------------------------------------|------------------|
| New creates | Admin create → NULL (**PD-ADM-01**); no new Admin-as-owner |
| Legacy Admin-stamped rows | **Do not backfill**; treat as requiring operational assignment/reassignment policy in Phase 3I (may need Supervisor clear/reassign — **DATA MIGRATION REQUIRED** only if later signed) |

### Decision ID: **PD-ASSIGN-01** — Initial assignment authority

| Field | Value |
|-------|--------|
| **Question** | Who may perform initial assignment of an unassigned session? |
| **Selected option** | **C** (authorized counsellor may assign unassigned to self or same-branch peer; no supervisor approval for initial assignment) |
| **Final business rule** | An authorized counsellor may assign an **UNASSIGNED** session to themselves or to another authorized counsellor within the **same branch**. Initial assignment does **not** require Supervisor/Admin approval. Changing an already-owned session is **REASSIGNMENT**, not initial assignment. Cross-branch assignment is prohibited unless an explicitly authorized multi-branch rule permits it. Server independently validates: authentication, tenant, branch authorization, counsellor authorization, session state, assignment state, requested target counsellor. Client-supplied `CounselorId` must **never** be trusted without server validation. |
| **Affected surfaces** | Assignment API/workflow; Waiting List |
| **Owner** | TBD |
| **Effective date** | TBD — agreed for Phase 3I workflow |
| **Exceptions / conditions** | Multi-branch exception only if separately authorized. Concurrent assignment: **PD-CONC-01** / **PD-ADM-02**. |
| **Notes** | Actor ≠ Owner when assigning to another counsellor. |
| **Sign-off status** | **WORKING — AGREED FOR IMPLEMENTATION WORKFLOW / NOT FORMALLY SIGNED** |

### Decision ID: **PD-REASSIGN-01** — Reassignment

| Field | Value |
|-------|--------|
| **Question** | Who may change ownership of an already-owned session? |
| **Selected option** | **Supervisor/Admin controlled reassignment** |
| **Final business rule** | Supervisor/Admin may reassign an active counselling session to another authorized counsellor within their permitted branch scope. On success: Previous `CounselorId` → New `CounselorId` immediately. Previous counsellor loses owner-level mutation rights immediately; retains read/history visibility otherwise permitted. Capture: acting user, previous owner, new owner, session, branch, timestamp, reason, correlation/request ID where supported. |
| **Affected surfaces** | Reassignment workflow; owner ACL; History/Audit |
| **Owner** | TBD |
| **Effective date** | TBD — agreed for Phase 3I workflow |
| **Exceptions / conditions** | Supervisory ops remain subject to existing permissions + branch + tenant (**PD-SUP-01**). No implicit “Admin can do everything.” |
| **Notes** | Distinct from **PD-ASSIGN-01**. Do not invent IAM role solely for Phase 3H; permission gap = implementation dependency. |
| **Sign-off status** | **WORKING — AGREED FOR IMPLEMENTATION WORKFLOW / NOT FORMALLY SIGNED** |

| Concept | Rule |
|---------|------|
| Assignment | Unassigned → set `CounselorId`; counsellor-authorized (**PD-ASSIGN-01**) |
| Reassignment | Owned → new owner; Supervisor/Admin (**PD-REASSIGN-01**) |
| Unassignment | Via **requeue** → NULL (**PD-REQUEUE-01**); not informal clear |
| Handoff | Modelled as reassignment (Supervisor/Admin) unless later decision adds owner self-handoff |
| Audit / History | Required (**§ History + Audit**) |
| Reason | Required for reassignment; capture where applicable for assignment/requeue |
| Same-branch target | Required unless multi-branch rule permits |
| Leave / unavailable | **PD-LEAVE-01** — no auto transfer |

---

## History + Audit requirement (cross-cutting)

| Field | Value |
|-------|--------|
| **Decision** | Every ownership **assignment / reassignment / requeue** must be represented in **both** Operational History and Immutable Audit Trail |
| **Status** | **WORKING — AGREED FOR IMPLEMENTATION WORKFLOW / NOT FORMALLY SIGNED** |

**Rules:**

1. Do not treat audit as optional logging.  
2. Human-readable History explains the operational event.  
3. Audit preserves structured accountability.  
4. **Actor ≠ Owner** — never collapse (e.g. ActorUserId = Amelia, NewCounselorId = Ravi).  
5. Use **existing** hospital History/Audit infrastructure; do **not** invent a parallel audit system.  
6. Ownership mutation and required audit/history consistency must have an **explicit transactional consistency strategy** (Phase 3I).  

**Examples:**

| Event | History narrative (illustrative) |
|-------|----------------------------------|
| Assignment | Unassigned → Counsellor B; Assigned by: Counsellor A |
| Reassignment | Counsellor A → Counsellor B; Reassigned by: Supervisor |
| Requeue | Counsellor A → Unassigned; Requeued by: Actor |

Minimum structured fields (assignment/reassignment/requeue as applicable): previous owner, new owner, actor, timestamp, reason, branch, session, source/action, correlation/request ID where supported.

---

## 8. Owner authorization decision

### Decision ID: **PD-AUTH-01**

| Field | Value |
|-------|--------|
| **Question** | If `CounselorId = A`, may counsellor B mutate the session? |
| **Selected option** | **Owner-level mutation restricted to current CounselorId** (with Supervisor/Admin exceptions per PD-REASSIGN-01 / PD-SUP-01) |
| **Final business rule** | Authorized counsellors may retain appropriate **read/history** visibility for operational continuity. Current session owner may perform owner-level counselling mutations permitted by existing permissions. Other counsellors may view appropriate information/history but **may not** perform owner-level mutations on another counsellor’s owned active session. Supervisor/Admin may perform explicitly authorized supervisory operations (including reassignment and approved supervisory mutations), subject to existing permissions and branch authorization. Do **not** implement “Admin can do everything” as an implicit bypass. Server-side authorization is mandatory. Frontend may hide/disable controls; backend is authoritative. |
| **Affected surfaces** | Start (owner-level content mutation); Update; Save Draft; Complete; other owner-level counselling writes |
| **Owner** | TBD |
| **Effective date** | TBD — agreed for Phase 3I workflow |
| **Exceptions / conditions** | Unassigned sessions: initial assignment per **PD-ASSIGN-01**. Follow-up Center mutations are **not** gated by original counselling `CounselorId` (**PD-FOLLOWUP-01**). Finalize Surgery uses its own permissions (**PD-FS-01**). |
| **Notes** | Separate READ from MUTATE. |
| **Sign-off status** | **WORKING — AGREED FOR IMPLEMENTATION WORKFLOW / NOT FORMALLY SIGNED** |

| Operation | Owner-restricted mutate? | Read |
|-----------|--------------------------|------|
| View / open (read) | No (appropriate visibility retained) | Yes if otherwise permitted |
| Explicit Assign (unassigned) | N/A — assignment authority **PD-ASSIGN-01** | — |
| Start / counselling content mutate | **Yes — current owner** (or supervisory exception) | — |
| Update / Save Draft | **Yes — current owner** | — |
| Complete Session | **Yes — current owner** | — |
| Requeue | Actor must be authorized; clears ownership (**PD-REQUEUE-01**) — Phase 3I must enforce who may requeue (owner and/or supervisor) consistently with this matrix |
| Finalize Surgery | **No — not CounselorId-owned** (**PD-FS-01**) | — |
| Follow-up Contact / Reminder / Callback | **No — Follow-up branch-shared** (**PD-FOLLOWUP-01**); actor attribution required | — |
| Reassign | Supervisor/Admin only (**PD-REASSIGN-01**) | — |

---

## 9. Assign / reassign — see PD-ASSIGN-01 / PD-REASSIGN-01

(Recorded in §7.)

---

## 10. Supervisor decision

### Decision ID: **PD-SUP-01**

| Field | Value |
|-------|--------|
| **Question** | How is supervisory ownership authority expressed? |
| **Selected option** | **Permission-based supervisory authorization using existing RBAC** |
| **Final business rule** | Do **not** create a hard-coded new “Supervisor” role solely for Phase 3H. Use existing Hospital Portal RBAC/permission model. If existing permissions cannot express required supervisory capability, identify the **minimum required permission change** as an implementation dependency. Supervisor/Admin ownership-management authority must be: server-enforced, branch-scoped, tenant-scoped, operation-specific. Do **not** use role-name-only checks as a substitute for authorization. |
| **Affected surfaces** | Reassignment; leave handling; Analytics branch default; supervisory mutations |
| **Owner** | TBD |
| **Effective date** | TBD — agreed for Phase 3I workflow |
| **Exceptions / conditions** | Permission gap → Phase 3I dependency (do not invent codes in this document beyond identifying need). |
| **Notes** | Answers Phase 2W “which roles are supervisors?” as: **capability via permissions**, not a new role name. |
| **Sign-off status** | **WORKING — AGREED FOR IMPLEMENTATION WORKFLOW / NOT FORMALLY SIGNED** |

| # | Sub-question | Agreed answer |
|---|--------------|---------------|
| 1 | Which existing roles are supervisors? | Those whose **existing permissions** grant supervisory ownership ops — map in Phase 3I; no new hard-coded role |
| 2 | Determined by role? | **No** — by permission capability (roles may grant permissions) |
| 3 | Branch-specific? | **Yes** — branch-scoped |
| 4 | See all authorized branch work? | Per existing list/read permissions + PD16 scope |
| 5 | Can reassign? | **Yes**, if permission grants reassignment |
| 6 | Take over / supervisory mutate? | Only **explicitly authorized** supervisory operations |
| 7 | Override owner restrictions? | Only via authorized supervisory operations — not implicit bypass |
| 8 | Audit required? | **Yes** — History + Audit |

---

## 11. Finalize Surgery decision

### Decision ID: **PD-FS-01**

| Field | Value |
|-------|--------|
| **Question** | Should Finalize Surgery be shared or counsellor-owned? |
| **Selected option** | **A — Shared operational workflow** |
| **Final business rule** | Finalize Surgery remains a shared, branch-authorized operational workflow. It does **not** inherit `CounselorId` ownership from counselling. `CounselorId` remains counselling ownership/attribution only and does **not** become the OT/finalization owner. Continue existing operation-specific permissions and server-side branch authorization. Do **not** automatically propagate counselling ownership into OT/Finalize. Do **not** rewrite `CounselorId` because another staff member finalized surgery. History/audit must distinguish: counselling owner, staff who finalized, action, timestamp, applicable reason/notes. |
| **Affected surfaces** | OT Finalize list / finalize action |
| **Owner** | TBD |
| **Effective date** | TBD — agreed for Phase 3I workflow |
| **Exceptions / conditions** | None that merge counselling ownership into OT. |
| **Notes** | Ownership follows CounselingSession.CounselorId? **No** for finalize ACL. Separate finalize owner field? **Not required** by this decision. |
| **Sign-off status** | **WORKING — AGREED FOR IMPLEMENTATION WORKFLOW / NOT FORMALLY SIGNED** |

---

## 12. Post-Surgery decision

### Decision ID: **PD-POST-01**

| Field | Value |
|-------|--------|
| **Question** | Who owns Post-Surgery follow-up? |
| **Selected option** | **Hybrid ownership with explicit assignment** |
| **Final business rule** | Post-Surgery Follow-up enters the authorized branch’s **shared** Post-Surgery operational queue. It does **not** automatically inherit the pre-surgery counsellor as permanent owner. May initially be **unassigned**. An authorized counsellor may explicitly assign follow-up responsibility. Supervisor/Admin may reassign per approved ownership rules. Original counselling `CounselorId` may be displayed as historical/contextual attribution but does **not** automatically establish Post-Surgery ownership. Follow-up responsibility remains operationally distinct from original counselling ownership. |
| **Affected surfaces** | Follow-up Center Post-Surgery |
| **Owner** | TBD |
| **Effective date** | TBD — agreed for Phase 3I workflow |
| **Exceptions / conditions** | PD4 responsibility type (non-clinical coordination in Centre; Ward/clinical authoritative) remains. No new FollowUps table. |
| **Notes** | Completes ownership gap left open under PD4. |
| **Sign-off status** | **WORKING — AGREED FOR IMPLEMENTATION WORKFLOW / NOT FORMALLY SIGNED** |

| Item | Agreed |
|------|--------|
| Responsibility | Explicit assignment into Post-Surgery ops; distinct from counselling owner |
| Reassignment | Supervisor/Admin per ownership rules |
| Completion | Still governed by PD4 / lifecycle rules — **not** redefined here |
| Handoff | Via reassignment / explicit assignment |
| Original counsellor leaves | No auto-inherit; reassign Post-Surgery if assigned; history preserved |

---

## 13. Requeue decision

### Decision ID: **PD-REQUEUE-01**

| Field | Value |
|-------|--------|
| **Question** | When requeued, what happens to `CounselorId`? |
| **Selected option** | **A — Become Unassigned** |
| **Final business rule** | When an owned counselling session is requeued into the Waiting List: `CounselorId → NULL`. Session returns to shared, branch-authorized Waiting List. Ownership must be explicitly established again through assignment. Previous ownership is **not** lost historically. History and Audit must preserve: previous owner, requeue actor, timestamp, reason where applicable, transition to unassigned. Do **not** retain previous `CounselorId` as current ownership after requeue. Do **not** automatically assign to the next counsellor. |
| **Affected surfaces** | Requeue; Waiting List; ownership ACL |
| **Owner** | TBD |
| **Effective date** | TBD — agreed for Phase 3I workflow |
| **Exceptions / conditions** | None that retain current ownership after requeue. |
| **Notes** | Supersedes current code behavior that leaves `CounselorId` unchanged on requeue. |
| **Sign-off status** | **WORKING — AGREED FOR IMPLEMENTATION WORKFLOW / NOT FORMALLY SIGNED** |

---

## 14. Analytics scope decision

### Decision ID: **PD-ANALYTICS-01**

| Field | Value |
|-------|--------|
| **Question** | What should normal Counsellor Analytics default to? |
| **Selected option** | **Scope selector with My Work default for normal counsellors** |
| **Final business rule** | Analytics supports (1) **My Work** and (2) **Authorized Branch**. Normal counsellors default to **My Work**. Supervisors/Admins may default to appropriate branch-level scope according to authorized scope. Counsellor filter/scope must **never** become an entitlement mechanism. Server-side tenant and branch authorization remain authoritative. Continue approved Phase 2Z population/denominator rules. Do **not** create separate formulas for My Work vs Branch — same analytical definitions; different authorized scope. |
| **Affected surfaces** | Analytics Summary / Trends / Aging / scope picker |
| **Owner** | TBD |
| **Effective date** | TBD — agreed for Phase 3I workflow |
| **Exceptions / conditions** | PD13/PD14/PD15 unchanged. |
| **Notes** | “All” reframed as **Authorized Branch** aggregate within PD16 scope — not cross-tenant; not entitlement. |
| **Sign-off status** | **WORKING — AGREED FOR IMPLEMENTATION WORKFLOW / NOT FORMALLY SIGNED** |

| Item | Agreed |
|------|--------|
| Who may use Branch scope | Users with Analytics read + authorized branch (and supervisory default as applicable) |
| Branch-scoped? | **Yes** — server PD16 |
| May normal counsellor view another’s metrics? | Via Branch aggregate / filter only if still within **authorized** scope; filter ≠ entitlement |
| Supervisor status | May default to branch-level scope |

---

## 15. Follow-up Center decision

### Decision ID: **PD-FOLLOWUP-01**

| Field | Value |
|-------|--------|
| **Question** | Should Follow-up Center be shared or owner-filtered? |
| **Selected option** | **Branch-shared operational follow-up** |
| **Final business rule** | Follow-up Center remains a shared operational workspace scoped by server-authorized branch access. Any authorized counsellor within the branch may view and perform follow-up work. A counsellor does **not** need to own the original counselling session to perform follow-up. Do **not** introduce a “My Follow-ups” restriction. Do **not** make original counselling `CounselorId` an access-control boundary for Follow-up Center. Follow-up actions must retain actor attribution. Existing History/Audit/communication-log mechanisms remain authoritative. |
| **Affected surfaces** | Follow-up Active, Cold; Post-Surgery queue visibility (ownership assignment per **PD-POST-01**) |
| **Owner** | TBD |
| **Effective date** | TBD — agreed for Phase 3I workflow |
| **Exceptions / conditions** | Do not merge Active with PendingDecision. Do not change PendingDecision aging. |
| **Notes** | Supersedes Phase 2W PD7 working A for Follow-up list ACL / “assigned can see/act” as Center restriction. |
| **Sign-off status** | **WORKING — AGREED FOR IMPLEMENTATION WORKFLOW / NOT FORMALLY SIGNED** |

| Tab | Rule |
|-----|------|
| Active | Branch-shared; no original CounselorId ACL; actor attribution on actions |
| Cold | Branch-shared; same |
| Post-Surgery | Shared queue entry; **explicit assignment** for ownership (**PD-POST-01**); original counselling owner = historical attribution only |

---

## 16. Branch / tenant / ownership precedence

### Decision ID: **PD7-PRECEDENCE** (reaffirmed)

| Field | Value |
|-------|--------|
| **Selected option** | **Confirmed** |
| **Final business rule** | Precedence: (1) Tenant authorization → (2) Branch authorization (PD16, server-side) → (3) Ownership authorization for owner-level counselling mutations (when assigned) → with **permission checks mandatory at every layer**. Ownership does not replace permissions. Client `branchId` / `counselorId` cannot grant access. |
| **Sign-off status** | **WORKING — AGREED FOR IMPLEMENTATION WORKFLOW / NOT FORMALLY SIGNED** |

**Standing invariants (confirmed):**

- [x] Tenant isolation is mandatory  
- [x] Client `branchId` cannot grant access  
- [x] Client `counselorId` cannot grant access  
- [x] Server must enforce authorization  
- [x] Ownership does not replace permission checks  

---

## 17. Concurrency decision

### Decision ID: **PD-CONC-01**

| Field | Value |
|-------|--------|
| **Question** | Concurrent work on the same session? |
| **Selected option** | **Optimistic concurrency / reject stale writes** |
| **Final business rule** | Multiple authorized users may open/view the same counselling session concurrently. The system must **not** use silent last-write-wins for counselling mutations. Use an appropriate existing/versioned concurrency mechanism where possible. First successful mutation advances the version. Subsequent stale mutation must be rejected with an explicit concurrency conflict. Expected API behavior: **409 Conflict** (or project’s established equivalent if already standardized). UI must tell the user the session was updated by another user and require refresh/review before retry. Do **not** silently overwrite newer data. Do **not** introduce automatic merging of clinical/business fields in this phase. Successful mutations remain auditable. Rejected concurrency attempts must **not** be represented as successful business-history events. |
| **Affected surfaces** | Assignment; counselling mutate; reassignment; requeue |
| **Owner** | TBD |
| **Effective date** | TBD — agreed for Phase 3I workflow |
| **Exceptions / conditions** | Concurrent assignment of same unassigned session: only one succeeds (**PD-ADM-02**). |
| **Notes** | Prefer existing version patterns (e.g. OT soft Version++) where reusable; do not invent a second concurrency bus. |
| **Sign-off status** | **WORKING — AGREED FOR IMPLEMENTATION WORKFLOW / NOT FORMALLY SIGNED** |

| Event | Expected behavior |
|-------|-------------------|
| Counsellor A opens | Allowed (read) |
| Counsellor B opens | Allowed (read) |
| Counsellor A mutates successfully | Version advances; History/Audit for success |
| Counsellor B stale mutate | **409 Conflict** (or established equivalent); UI refresh/review; **no** success history event |
| Two assign same unassigned | One succeeds; other conflict + refresh |

---

## 18. Counsellor leave / unavailable decision

### Decision ID: **PD-LEAVE-01**

| Field | Value |
|-------|--------|
| **Question** | What happens when owner leaves / unavailable / branch change / inactive? |
| **Selected option** | **Supervisor/Admin-controlled reassignment** |
| **Final business rule** | Temporary absence, unavailability, branch transfer, account deactivation, or departure does **not** automatically change `CounselorId`. Existing ownership/history is preserved. If an owner becomes unavailable, surface operational condition **Reassignment Required** — **not** a new counselling lifecycle state. Supervisor/Admin explicitly reassigns affected active sessions to an authorized counsellor within applicable branch scope. On success: previous owner loses owner-level mutate; new owner gains it. If counsellor leaves hospital: preserve historical CounselorId/attribution; deactivate/block via existing identity/RBAC; identify active sessions requiring reassignment; do not delete ownership history. Follow-up Center remains branch-shared. |
| **Affected surfaces** | Active owned sessions; ops surfacing; reassignment |
| **Owner** | TBD |
| **Effective date** | TBD — agreed for Phase 3I workflow |
| **Exceptions / conditions** | No automatic unassignment/queue release on leave. |
| **Notes** | Do not automatically change existing records without Supervisor/Admin reassignment action. |
| **Sign-off status** | **WORKING — AGREED FOR IMPLEMENTATION WORKFLOW / NOT FORMALLY SIGNED** |

| Trigger | Treatment |
|---------|-----------|
| Leaves hospital | Preserve history; block access via IAM; flag active sessions Reassignment Required; Supervisor/Admin reassigns |
| Becomes inactive | Same — no auto CounselorId change |
| Changes branch | No auto change; reassign if out of scope |
| Temporarily unavailable | Reassignment Required signal; Supervisor/Admin reassigns if needed |

---

## 19. Ownership audit decision

### Decision ID: **PD7-AUDIT** (absorbed into History + Audit requirement)

| Field | Value |
|-------|--------|
| **Selected option** | **Yes — dedicated ownership events via existing History + Audit infrastructure** |
| **Final business rule** | See **History + Audit requirement**. Assignment, reassignment, and requeue require both Operational History and Immutable Audit. Not optional. Actor ≠ Owner. Transactional consistency strategy required in Phase 3I. |
| **Sign-off status** | **WORKING — AGREED FOR IMPLEMENTATION WORKFLOW / NOT FORMALLY SIGNED** |

| Field | Required |
|-------|----------|
| Previous owner | Yes |
| New owner | Yes |
| Actor | Yes |
| Timestamp | Yes |
| Reason | Yes for reassignment; where applicable for assignment/requeue |
| Branch | Yes |
| Session | Yes |
| Source/action | Yes |
| Correlation/request ID | Where supported |

---

## 20. Surface matrix

| Surface | Visibility | Unassigned | Owner | Claim | Assign | Reassign | Mutate Rule |
|---------|------------|------------|-------|-------|--------|----------|-------------|
| Waiting List | Shared; server-authorized branch (PD-WL-01) | Visible when CounselorId NULL (PD-WL-02) | Not visibility key; set only via explicit assignment | N/A — use **Assign** | Initial: counsellor self/peer same branch (PD-ASSIGN-01) | Supervisor/Admin (PD-REASSIGN-01) | Visibility ≠ mutate owned active session (PD-AUTH-01) |
| Counselling Session | Read/history for authorized users | CounselorId NULL until assign | CounselorId when assigned (PD7 E) | N/A — explicit Assign | PD-ASSIGN-01 | PD-REASSIGN-01 | Owner-level mutate = current CounselorId; Supervisory exceptions explicit (PD-AUTH-01) |
| Finalize Surgery | Shared branch-authorized OT workflow (PD-FS-01) | N/A (not counselling owner) | Not CounselorId | N/A | N/A | N/A | Existing finalize permissions; no counselling-owner ACL; do not rewrite CounselorId |
| Follow-up Active | Branch-shared (PD-FOLLOWUP-01) | N/A for Center ACL | Original CounselorId not ACL | N/A | N/A for Center access | N/A for Center access | Any authorized counsellor in branch; actor attribution |
| Follow-up Cold | Branch-shared (PD-FOLLOWUP-01) | Same | Same | N/A | N/A | N/A | Same as Active |
| Post-Surgery | Shared branch queue (PD-POST-01) | May start unassigned | Explicit Post-Surgery assignment; no auto-inherit | N/A — Assign | Authorized counsellor assign | Supervisor/Admin | Follow-up work branch-shared; Post-Surgery ownership distinct from counselling |
| Analytics | My Work default (normal); Branch scope available (PD-ANALYTICS-01) | Attribution display only; CreatedByUserId ≠ owner | Scope filter ≠ entitlement | N/A | N/A | N/A | Read-only; same Phase 2Z formulas; different authorized scope |

---

## 21. Admin → Amelia scenario

### Decision ID: **PD-ADM-02**

| Field | Value |
|-------|--------|
| **Selected option** | **Authorized counsellor may assign an Admin-created unassigned session** |
| **Final business rule** | See table |
| **Sign-off status** | **WORKING — AGREED FOR IMPLEMENTATION WORKFLOW / NOT FORMALLY SIGNED** |

| Step | Approved working behavior |
|------|---------------------------|
| Admin creates patient/session | Create path: `CounselorId = NULL` (unless explicit approved assignment workflow used) |
| `CounselorId` initially | **NULL** |
| Amelia sees it? | **Yes** — shared authorized Waiting List |
| Amelia can open/view it? | **Yes** — viewing does **not** establish ownership |
| Amelia can start/mutate counselling content? | **Only after** ownership established (or supervisory exception); open ≠ own |
| Amelia becomes owner? | **Only if** she chooses **Assign to myself** |
| Assign to another (Ravi)? | Actor = Amelia; NewCounselorId = Ravi; **Ravi** is owner; Amelia is **not** owner by acting |
| Audit / History? | **Required** — Unassigned → owner; Assigned by actor |
| Admin ownership? | Admin is **not** owner on create |
| Concurrent assign? | One succeeds; other **409 Conflict** (or equivalent) + refresh |
| Already owned reassignment? | Supervisor/Admin only |

---

## 22. Existing 18-record treatment

| Rule | Status |
|------|--------|
| Change these records in Phase 3H consolidation | **FORBIDDEN** (this task) |
| Backfill `CounselorId` | **FORBIDDEN** |
| Assign them to Amelia automatically | **FORBIDDEN** |
| Future policy | Under **PD-ADM-01** / **PD-WL-02**: new creates are unassigned; historical Admin-stamped rows remain as-is until an **explicit** later ops/migration decision |

**Workshop treatment for the 18 (policy intent, no mutation now):**

| Policy | Implication |
|--------|-------------|
| Do not backfill / do not auto-assign Amelia | Confirmed |
| Target steady-state | New Admin creates → NULL; assignment explicit |
| Legacy Admin-as-owner rows | May need ops review / Supervisor clear-or-reassign in Phase 3I+ |

If DB correction is later required:

> **DATA MIGRATION REQUIRED**

**Do not perform migration in Phase 3H.**

---

## 23. Conflict check

### 23.1 Cross-decision consistency (30 checks)

| # | Check | Result |
|---|-------|--------|
| 1 | Shared Waiting List compatible with owned active counselling | **PASS** — PD-WL-01 + PD7 E + PD-AUTH-01 |
| 2 | Unassigned sessions valid | **PASS** — PD-WL-02 |
| 3 | Admin-created unassigned | **PASS** — PD-ADM-01 |
| 4 | CreatedByUserId never ownership | **PASS** — field distinctions + PD-WL-02 |
| 5 | Explicit assignment establishes CounselorId | **PASS** — PD-START-01 |
| 6 | Initial assignment ≠ reassignment | **PASS** — PD-ASSIGN-01 / PD-REASSIGN-01 |
| 7 | Counsellor assign unassigned to self or same-branch peer | **PASS** — PD-ASSIGN-01 |
| 8 | Supervisor/Admin controls already-owned changes | **PASS** — PD-REASSIGN-01 |
| 9 | Owner authz distinct from read visibility | **PASS** — PD-AUTH-01 |
| 10 | Finalize Surgery not owned by CounselorId | **PASS** — PD-FS-01 |
| 11 | Post-Surgery explicit assign; no auto-inherit | **PASS** — PD-POST-01 |
| 12 | Requeue clears CounselorId | **PASS** — PD-REQUEUE-01 |
| 13 | Follow-up branch-shared; no original ownership required | **PASS** — PD-FOLLOWUP-01 |
| 14 | Analytics My Work + Branch; filter ≠ authz | **PASS** — PD-ANALYTICS-01 |
| 15 | Branch authz server-side | **PASS** — PD16 / PD-WL-01 / precedence |
| 16 | Tenant isolation mandatory | **PASS** |
| 17 | Actor ≠ Owner when assigning for another | **PASS** — History/Audit + PD-ADM-02 |
| 18 | Assignment/reassignment/requeue History + Audit | **PASS** |
| 19 | No silent last-write-wins | **PASS** — PD-CONC-01 |
| 20 | Absence does not silently transfer ownership | **PASS** — PD-LEAVE-01 |
| 21 | Historical attribution intact after reassignment | **PASS** — PD-REASSIGN-01 / History |
| 22 | No new FollowUps table for ownership | **PASS** — constraints |
| 23 | No invented due/SLA/priority | **PASS** — out of scope |
| 24 | No Schedule Visit redesign | **PASS** |
| 25 | No Reminder/Callback redesign | **PASS** |
| 26 | No new lifecycle state machine (Reassignment Required ≠ lifecycle state) | **PASS** — PD-LEAVE-01 |
| 27 | Phase 2 approved decisions unchanged unless superseded above | **PASS** — see §2 / §23.2 |
| 28 | PD13 PendingDecision precedence unchanged | **PASS** |
| 29 | PD15 drill-down population-safe | **PASS** |
| 30 | PD16 server-side independent of client branchId | **PASS** |

**Consistency review:** **30 PASS / 0 FAIL**

### 23.2 Conflicts found and superseded

| # | Old / conflicting statement | Conflict | Superseding agreed rule |
|---|----------------------------|----------|-------------------------|
| C1 | Phase 2W PD7 working **A**: CounselorId is follow-up owner; assigned counsellor can see/act | Implied Follow-up personal ownership / list ACL | **PD7 E** + **PD-FOLLOWUP-01**: CounselorId = active counselling ownership; Follow-up is branch-shared without original-owner ACL |
| C2 | Prior capture draft: “do not select”; all NOT SELECTED | Stale workshop-open state | This consolidation: options selected as **WORKING — AGREED FOR IMPLEMENTATION WORKFLOW / NOT FORMALLY SIGNED** |
| C3 | Diagnosis: Admin create stamps Admin as owner | Conflicts with unassigned intake | **PD-ADM-01**: `CounselorId = NULL` |
| C4 | Diagnosis / code: CreatedByUserId Analytics fallback as “effective owner” for filtering | Risk of treating creator as owner | **PD-WL-02** / field distinctions: CreatedByUserId **never** SoT ownership (Analytics may still need display rules in 3I without elevating to owner) |
| C5 | Diagnosis: any `.update` counsellor may mutate any session | Conflicts with owner ACL | **PD-AUTH-01** |
| C6 | Diagnosis: Finalize shared but counselling owner unclear / risk of inheritance | Must not inherit CounselorId as OT owner | **PD-FS-01** |
| C7 | PD4 ownership unresolved / risk of auto-inherit pre-surgery counsellor | Automatic inheritance forbidden | **PD-POST-01** |
| C8 | Diagnosis: Requeue does not change CounselorId | Conflicts with unassigned return | **PD-REQUEUE-01**: clear to NULL |
| C9 | Risk: Follow-up restricted to original counsellor | Conflicts with shared Center | **PD-FOLLOWUP-01** |
| C10 | Diagnosis: Analytics counselor filter usable as if entitlement; default All | Scope vs authz confusion | **PD-ANALYTICS-01**: My Work default; Branch scope; filter ≠ entitlement |
| C11 | Risk: automatic reassignment on leave | Forbidden | **PD-LEAVE-01** |
| C12 | Diagnosis: last-write-wins concurrency | Forbidden | **PD-CONC-01** |
| C13 | Prior draft Option C “claim” language / start-if-null stamp as ownership | Silent claim on open/start | **PD-START-01**: explicit Assign only |
| C14 | Waiting List “B assigned only” literal reading | Would break shared queue | **PD-WL-01** final rule: shared visibility + B+D refinement (not assigned-only list) |
| C15 | “CounselorId informational attribution only” (Model B) | Conflicts with owner-level mutate ACL | **PD7 E** + **PD-AUTH-01**: ownership for active counselling mutate |

**Conflicts identified:** **15**  
**Resolved by agreed working decisions in this consolidation:** **15**  
**Remaining contradictory statements inside this document:** **0** (diagnosis baselines labeled historical only)

### 23.3 Relationship to prior PDs (summary)

| Prior | Flag |
|-------|------|
| PD-WL-01 shared contract | **Clarification / confirmation** (visibility); mutation boundary added |
| PD7 Phase 2W A | **Supersession** for Follow-up ACL; **reframed** as Hybrid E for counselling |
| PD16 | **Unchanged** |
| PD13 / PD14 / PD15 | **Unchanged** |
| PD4 responsibility | **Unchanged**; ownership **clarified** via PD-POST-01 |

---

## 24. Implementation implications

### Phase 3H consolidation status

**Phase 3H product-decision consolidation is complete** for the ownership/work-allocation scope listed in this document.

The next phase (**Phase 3I**) may **prepare/implement** these **WORKING — AGREED FOR IMPLEMENTATION WORKFLOW** decisions.

**This task must not and did not:**

- change production code  
- create DB migrations  
- change API contracts  
- change UI  
- change permissions  

### Phase 3I implementation areas

| ID | Area | Intent (high level) |
|----|------|---------------------|
| A | Waiting List | Keep shared visibility; branch server auth; explicit Assign CTA; no silent own-on-open |
| B | Assignment workflow | Assign to self / assign to peer; concurrency-safe; Actor ≠ Owner |
| C | CounselorId validation | Server validates target counsellor, branch, tenant, state; never trust client CounselorId |
| D | Owner authorization | Restrict owner-level counselling mutate to current CounselorId (+ explicit supervisory ops) |
| E | Supervisor/Admin reassignment | Permission-based; reason + History/Audit; immediate ACL flip |
| F | History / Audit | Dual representation; transactional consistency with ownership mutation |
| G | Requeue | Clear CounselorId → NULL; preserve historical ownership events |
| H | Finalize Surgery ownership boundary | No counselling CounselorId inheritance; distinguish actors in History/Audit |
| I | Post-Surgery assignment | Shared queue; explicit assign; no auto-inherit pre-surgery owner |
| J | Follow-up Center branch scope | Keep branch-shared; no My Follow-ups ACL; actor attribution |
| K | Analytics scope | My Work default; Authorized Branch option; same Phase 2Z formulas |
| L | Concurrency | Versioned optimistic concurrency; 409 (or equivalent); no success history on reject |
| M | Leave / unavailability | Reassignment Required signal; Supervisor/Admin reassign; no auto transfer |
| N | Server-side branch authorization | Enforce PD16 on Waiting List / related paths as required by decisions |
| O | Admin-created session behavior | Create with CounselorId NULL; no creator coalesce; no historical backfill |

### Implementation constraints (preserve)

- Existing Hospital Portal design system  
- Existing routes unless change is necessary  
- Existing certified business rules  
- Existing APIs unless change required by an approved decision  
- Existing audit infrastructure  
- Existing history infrastructure  
- Existing RBAC/permissions (minimum new permission only if dependency proven)  
- Tenant isolation  
- Branch authorization (server-side)  
- Phase 2X lifecycle rules  
- Phase 2Z analytics rules  
- No invented clinical/operational policy beyond these decisions  
- No new FollowUps table  
- No duplicate worklists  
- No hidden client-side authorization  
- No browser/device-specific behavior  

### Implementation dependencies / open engineering items (not product blockers for consolidation)

| Dependency | Notes |
|------------|-------|
| Supervisory permission mapping | **PD-SUP-01** — identify minimum permission if existing codes insufficient |
| Transactional History+Audit strategy | Required with ownership mutations |
| Concurrency token on CounselingSession | Prefer existing patterns; introduce only if required |
| Legacy Admin-owned / null rows | No backfill now; may later be **DATA MIGRATION REQUIRED** |
| Who may requeue | Align owner vs supervisor with PD-AUTH-01 in Phase 3I design |
| Post-Surgery assignment persistence SoT | Must reuse existing entities — no FollowUps table |

---

## 25. Explicit out-of-scope items

Still out of scope for Phase 3H (and not authorized by this consolidation alone beyond Phase 3I planning):

- Any production FE/BE/DB/permission/UI change **in this task**  
- Automatic due-date / SLA / priority invention  
- Schedule Visit / Reminder / Callback redesign  
- New lifecycle state machine  
- New FollowUps table  
- PD13/PD14/PD15 formula or drill-down destination changes  
- Silent backfill of the 18 Downtown records  
- Parallel audit system  
- Hard-coded new Supervisor role solely for Phase 3H  

---

## Decision ID index

| ID | Topic | Selected | Status |
|----|-------|----------|--------|
| PD7 | Hybrid ownership model E | E | WORKING — AGREED FOR IMPLEMENTATION WORKFLOW / NOT FORMALLY SIGNED |
| PD-WL-01 | Waiting List visibility | B+D (shared + mutation boundary) | WORKING — AGREED FOR IMPLEMENTATION WORKFLOW / NOT FORMALLY SIGNED |
| PD-WL-02 | Unassigned allowed | A | WORKING — AGREED FOR IMPLEMENTATION WORKFLOW / NOT FORMALLY SIGNED |
| PD-ADM-01 | Admin create unassigned | A | WORKING — AGREED FOR IMPLEMENTATION WORKFLOW / NOT FORMALLY SIGNED |
| PD-START-01 | Explicit assignment | Explicit assign | WORKING — AGREED FOR IMPLEMENTATION WORKFLOW / NOT FORMALLY SIGNED |
| PD-ASSIGN-01 | Initial assignment authority | C | WORKING — AGREED FOR IMPLEMENTATION WORKFLOW / NOT FORMALLY SIGNED |
| PD-REASSIGN-01 | Reassignment | Supervisor/Admin | WORKING — AGREED FOR IMPLEMENTATION WORKFLOW / NOT FORMALLY SIGNED |
| PD-AUTH-01 | Owner authorization | Owner-level mutate restricted | WORKING — AGREED FOR IMPLEMENTATION WORKFLOW / NOT FORMALLY SIGNED |
| PD-SUP-01 | Supervisory RBAC | Permission-based | WORKING — AGREED FOR IMPLEMENTATION WORKFLOW / NOT FORMALLY SIGNED |
| PD-FS-01 | Finalize Surgery | A Shared | WORKING — AGREED FOR IMPLEMENTATION WORKFLOW / NOT FORMALLY SIGNED |
| PD-POST-01 | Post-Surgery ownership | Hybrid + explicit assign | WORKING — AGREED FOR IMPLEMENTATION WORKFLOW / NOT FORMALLY SIGNED |
| PD-REQUEUE-01 | Requeue | A → Unassigned | WORKING — AGREED FOR IMPLEMENTATION WORKFLOW / NOT FORMALLY SIGNED |
| PD-ANALYTICS-01 | Analytics scope | My Work default + Branch | WORKING — AGREED FOR IMPLEMENTATION WORKFLOW / NOT FORMALLY SIGNED |
| PD-FOLLOWUP-01 | Follow-up Center | Branch-shared | WORKING — AGREED FOR IMPLEMENTATION WORKFLOW / NOT FORMALLY SIGNED |
| PD-CONC-01 | Concurrency | Optimistic / reject stale | WORKING — AGREED FOR IMPLEMENTATION WORKFLOW / NOT FORMALLY SIGNED |
| PD-LEAVE-01 | Leave / unavailable | Supervisor reassign | WORKING — AGREED FOR IMPLEMENTATION WORKFLOW / NOT FORMALLY SIGNED |
| PD-ADM-02 | Admin → Amelia | Explicit assign | WORKING — AGREED FOR IMPLEMENTATION WORKFLOW / NOT FORMALLY SIGNED |
| PD7-PRECEDENCE | Authz order | Confirmed | WORKING — AGREED FOR IMPLEMENTATION WORKFLOW / NOT FORMALLY SIGNED |
| History+Audit | Dual trail | Required | WORKING — AGREED FOR IMPLEMENTATION WORKFLOW / NOT FORMALLY SIGNED |

---

## Remaining unresolved product decisions

Within **ownership/work-allocation scope**, workshop decisions above are consolidated.

Still **not** formally SIGNED (named stakeholders). Still open **outside** or **adjacent** to this consolidation (do not invent):

| Item | Status |
|------|--------|
| Named formal hospital sign-off table | **Empty** |
| Exact existing permission code(s) for reassignment | **Phase 3I dependency** (PD-SUP-01) |
| Legacy Admin-owned row remediation / migration | **Deferred** — DATA MIGRATION REQUIRED if later approved |
| Broader Phase 2W items (due date, priority, Schedule Visit, etc.) | **Unchanged / out of Phase 3H ownership scope** |
| PD4 completion criteria detail beyond ownership | **Still under prior PD4 working rules** — not expanded here |

---

## PHASE 3H IMPLEMENTATION GATE

### Status: **CONSOLIDATION COMPLETE — WORKING DECISIONS AGREED FOR PHASE 3I WORKFLOW / NOT FORMALLY SIGNED**

| Gate check | Result |
|------------|--------|
| Ownership/work-allocation decisions selected with final rules | **YES** (working agreement) |
| Surface matrix resolved | **YES** |
| Admin → Amelia deterministic | **YES** (PD-ADM-02) |
| Cross-check 30 consistency items | **30 PASS** |
| Named formal stakeholder signatures | **NO** (0) |
| Production code changed in this task | **NO** |
| Phase 3I may prepare/implement against working decisions | **YES** |
| Phase 3I started in this task | **NO** |

**Do not fabricate stakeholder names or signatures.**

When named stakeholders complete the formal sign-off table, status may be upgraded to **SIGNED / APPROVED** with evidence. Until then, engineering may proceed to Phase 3I against **WORKING — AGREED FOR IMPLEMENTATION WORKFLOW** decisions, without claiming formal hospital sign-off.

---

*End of Phase 3H Product Decisions — Final Working Specification.*  
*NO PRODUCTION CODE CHANGED in this consolidation task. STOP — do not begin Phase 3I implementation in this task.*
