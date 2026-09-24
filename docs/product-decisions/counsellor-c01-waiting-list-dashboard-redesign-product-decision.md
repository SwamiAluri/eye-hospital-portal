# Counsellor C-01 — Waiting List Dashboard Redesign
## Product Decision — Authorization & Bounded Scope

| Field | Value |
|-------|--------|
| **Document status** | **PRODUCT DECISION — APPROVED** |
| **Product Owner selection** | **RECORDED** |
| **Mode** | **GOVERNANCE RECORDING** — this update records approved selections only; no production code, API, DB, permission, route, ownership, UI, or test modified by this task |
| **Implementation authorized** | **YES — ONLY FOR THE BOUNDED C-01 SCOPE** (subsequent implementation task; **not performed in this task**) |
| **Implementation performed** | **NO** |
| **Phase 3I** | **REMAINS FORMALLY CLOSED** — do not reopen |
| **Slice 14** | **NOT CREATED** |
| **Phase 3J** | **NOT CREATED** |
| **Ownership model** | **UNCHANGED / LOCKED** |

> **Implementation-safety statement:** C-01 is authorized as a standalone bounded Waiting List UX package. This authorization does not reopen Phase 3I, does not create Slice 14, does not create Phase 3J, and does not authorize changes to the certified Counsellor ownership/work-allocation model.

---

## 1. Decision Metadata

| Field | Value |
|-------|--------|
| **Decision ID family** | **PD-C01-01 … PD-C01-06** |
| **Title** | Counsellor C-01 — Waiting List Dashboard Redesign — Authorization & Bounded Scope |
| **Date prepared** | 2026-09-22 |
| **Date Product Owner approved** | 2026-09-22 |
| **Program / module** | Hospital Portal — Counsellor Desk — Waiting List (`C-WL` / C-01) |
| **Route (canonical)** | `/dashboard/counsellors-desk/waiting-list` |
| **Decision type** | **AUTHORIZATION & BOUNDED SCOPE PRODUCT DECISION** |
| **Primary evidence** | `docs/audits/counsellor-c01-waiting-list-redesign-reconciliation-audit.md` |
| **Prior freeze (Phase 3I)** | **PD-S13-J Option A ACCEPTED** — no further Waiting List UX in Slice 13 / Phase 3I Package B (**OUT OF PACKAGE / NO ACTION**). Historical fact preserved. |
| **Phase 3I program closure** | **Option A ACCEPTED** — Phase 3I formally closed (`docs/audits/counsellor-ownership-work-allocation-phase3i-program-product-decision.md`) |
| **Formal C-01 USER ACCEPTED pack (historical)** | Earlier reconciliation: not found. **Superseded 2026-09-22:** formal acceptance/closure recorded in `docs/audits/counsellor-c01-waiting-list-dashboard-redesign-acceptance-closure.md` |
| **Product Owner selection for PD-C01-\*** | **RECORDED / APPROVED** — complete recommended decision set selected |
| **This document selects options?** | **YES** — Product Owner approved the recommended set; selections recorded below |

### Decision status vocabulary (binding for this artifact)

| Term | Meaning |
|------|---------|
| **RECOMMENDED** | Historical governance-prepared preferred option (superseded by SELECTED where PO has chosen) |
| **SELECTED / APPROVED** | Explicit Product Owner choice recorded in this artifact |
| **NOT SELECTED** | Documented alternative not chosen by Product Owner |
| **DEFERRED** | Explicitly postponed; not in authorized C-01 scope |
| **OUT OF SCOPE** | Forbidden unless a separate explicit Product Decision authorizes it |

### Quick selection summary

| Decision | SELECTED / APPROVED |
|----------|---------------------|
| **PD-C01-01** | **OPTION A** — Authorize bounded C-01 UX redesign |
| **PD-C01-02** | **OPTION A** — Keep client-side pagination |
| **PD-C01-03** | **OPTION A** — Keep lightweight Age/Gender |
| **PD-C01-04** | **LOCK** current Pre-Auth membership rule |
| **PD-C01-05** | **LIMITED EXPLICIT URL STATE** |
| **PD-C01-06** | **OPTION A** — Add Patient referral path only |

---

## 2. Background

The Counsellor Waiting List product-acceptance / UX initiative (**C-01** / matrix screen **C-WL**) began as an Aug 2026 acceptance track for `/dashboard/counsellors-desk/waiting-list`. It recorded functional defects (Pre-Auth mapping, soft-success Add Patient, OT race, decorative pagination, and related items) and later spawned a Sep 2026 visual “clinical worklist” redesign (v1 → v2 after visual UAT rejection).

Separately, **Phase 3I — Counsellor Ownership & Work Allocation** certified the Waiting List ownership and lifecycle model (shared queue, PD16 branch authorization, Explicit Assign, Claim-for-lifecycle, Reassign eligibility, owner indicators, open ≠ ownership, CAS/409, Ownership History, ReQueue boundary, Sessions as RR remediation host). Phase 3I is **FORMALLY CLOSED**.

Under **PD-S13-J Option A**, Product explicitly accepted **no further Waiting List UX** within Slice 13 / Phase 3I Package B. That freeze remains authoritative **for Phase 3I**. It does **not** permanently extinguish a future standalone C-01 UX package.

The reconciliation audit classified current state as:

> **A. C-01 READY FOR PRODUCT DECISION**

**This Product Decision creates a new authorization boundary for standalone C-01 work.** It does not rewrite historical audit conclusions: PD-S13-J Option A deferred further Waiting List UX within Phase 3I; Phase 3I remains closed; formal C-01 USER ACCEPTED evidence was not found at reconciliation time.

---

## 3. Current State

Evidence per reconciliation audit and live architecture (summary):

| Area | Current state |
|------|----------------|
| **Route / permission** | `/dashboard/counsellors-desk/waiting-list`; `counseling_sessions.read` via `ProtectedRoute` |
| **Composition** | Summary KPI strip + Filter toolbar + Queue widget + client pagination footer |
| **Data** | `GET /Counseling/waiting-list` (AuthService) → shared queue within PD16 branch scope → client filters → client pagination slice |
| **Historical defects A–C, F, G** | Largely **resolved** in current code |
| **Pagination** | **Functional client-side** (page sizes 10 / 25 / 50); **not** server-side Skip/Take |
| **Ownership / lifecycle** | **Phase 3I certified / LOCKED** |
| **PD-S13-J** | Further WL UX **OUT OF PACKAGE / NO ACTION** for Phase 3I (historical freeze preserved) |
| **Formal C-01 USER ACCEPTED** | **Not found** at reconciliation (historical); future acceptance after UAT |
| **Remaining material scope** | Primarily **bounded operational UX / composition** around the certified model |
| **C-01 Product Decision** | **APPROVED** — implementation authorized for subsequent bounded task only |

C-01 is a **UX / product** initiative around the certified model. It is **not** an ownership redesign.

---

## 4. Problem / Opportunity

### Problem (governance — historical)

1. PD-S13-J Option A deferred further Waiting List UX inside closed Phase 3I.  
2. Formal C-01 delivery acceptance evidence was not found.  
3. Remaining UX opportunities (density, hierarchy, a11y, presentation) required a new Product Decision beyond PD-S13-J.  
4. Technical/domain questions (pagination SoT, demographics enrichment, Pre-Auth rule lock, URL state, referral acceptance scope) required explicit selection.

### Opportunity (now authorized)

A **standalone, bounded C-01 Waiting List UX redesign** that improves operational clarity **without** changing certified ownership, APIs, routes, or domain rules.

### Non-goals of this Product Decision artifact / this recording task

- Implement UI or APIs in this task  
- Create Slice 14 or Phase 3J  
- Reopen Phase 3I  
- Change ownership semantics  

---

## 5. Authoritative Constraints

### Binding prior decisions (unchanged by this document)

| Artifact | Binding effect |
|----------|----------------|
| Phase 3I Program Product Decision — **Option A** | Phase 3I **CLOSED**; no Phase 3I continuation package |
| PD-S13-J — **Option A** | No further WL UX **in Slice 13 / Phase 3I Package B** |
| PD-S13-I — **Option A** | No Counsellor Dashboard (OUT OF PACKAGE / NO ACTION) |
| PD-S13-D (WL Reassign eligibility) | Waiting List Reassign eligibility remains as certified |
| Certified ownership model | `CounselorId` SoT; open ≠ ownership; explicit Assign / Claim / Reassign only |

### Locked certified behavior (must be protected throughout C-01 implementation)

1. Waiting List remains a **shared** operational queue.  
2. Waiting List remains **server-authorized** within branch scope.  
3. **PD16** branch authorization remains authoritative.  
4. **`CounselorId`** remains ownership SoT.  
5. **`CreatedByUserId`** is not ownership.  
6. Opening / viewing / starting does **not** establish ownership.  
7. Ownership is established only through certified explicit mechanisms: **Assign**, **Claim-for-lifecycle** (where supported), **Reassign** (where supported).  
8. Owner mutation ACL remains unchanged.  
9. Version / CAS / **409** remains unchanged.  
10. Ownership History remains authoritative.  
11. **ReQueue** clears `CounselorId` to **NULL**.  
12. ReQueue remains a **Follow-up Center** responsibility.  
13. Do **not** add ReQueue to Waiting List.  
14. Waiting List Reassign eligibility remains unchanged.  
15. **Counselling Sessions** remains the active-work / RR remediation host.  
16. Do **not** create a Counsellor Dashboard.  
17. Do **not** create a “My Waiting List” ownership worklist.  
18. Do **not** create a duplicate operational worklist.  
19. **OT Returned** remains an IP-journey projection.  
20. OT Returned must **not** be converted into a Waiting List lifecycle status.  
21. **Pre-Auth** remains an operational filter (membership **LOCKED** per PD-C01-04).  
22. Follow-up boundaries remain unchanged.  
23. Finalize Surgery boundaries remain unchanged.  
24. Analytics boundaries remain unchanged.  
25. Post-Surgery boundaries remain unchanged.  
26. Existing canonical routes remain unchanged.  
27. Existing AuthService Waiting List / Assign / Claim / Reassign APIs remain unchanged unless a separate explicit decision authorizes a change.

---

## 6. C-01 Authorization Decision

**Governance framing:** C-01 is authorized as a **new bounded UX package outside closed Phase 3I**. It does **not** reopen Phase 3I, does **not** create Slice 14, and does **not** create Phase 3J.

**Implementation framing:** Bounded C-01 implementation is **authorized for a subsequent implementation task**. **Implementation is not being performed in this recording task.**

> C-01 is authorized as a standalone bounded Waiting List UX package. This authorization does not reopen Phase 3I, does not create Slice 14, does not create Phase 3J, and does not authorize changes to the certified Counsellor ownership/work-allocation model.

---

## 7. PD-C01-01 — Authorize C-01 Beyond PD-S13-J

| Field | Content |
|-------|---------|
| **Decision ID** | **PD-C01-01** |
| **Question** | Does Product authorize a **new** C-01 Waiting List Dashboard UX package **outside** the now-closed Phase 3I / PD-S13-J scope? |
| **Why required** | PD-S13-J Option A deferred further WL UX for Phase 3I; Phase 3I is closed; C-01 cannot lawfully implement without new authorization |
| **Affected UI** | Entire Waiting List shell (presentation) |
| **Affected API** | None if presentation-only |
| **Ownership impact** | **None** |

### OPTION A — AUTHORIZE BOUNDED C-01 UX REDESIGN

**Status:** **SELECTED / APPROVED**

C-01 is authorized as a standalone Waiting List UX redesign outside the closed Phase 3I / PD-S13-J Package B scope.

This authorization is:

- **NOT** a reopening of Phase 3I  
- **NOT** Slice 14  
- **NOT** Phase 3J  
- **NOT** an ownership redesign  
- **NOT** a new operational worklist  
- **NOT** a Counsellor Dashboard  
- **NOT** a My Waiting List ownership worklist  

Authorized UX areas:

- Waiting List page composition  
- visual hierarchy  
- information density  
- KPI / summary composition  
- queue readability  
- row information hierarchy  
- filter / search presentation  
- loading / empty / error presentation  
- responsive behavior  
- accessibility hardening  
- patient detail presentation  
- operational clarity  

All certified behavior remains protected.

### OPTION B — DO NOT AUTHORIZE

**Status:** **NOT SELECTED**

### OPTION C — AUTHORIZE A DIFFERENT BOUNDED SCOPE

**Status:** **NOT SELECTED**

### Product Owner decision record — PD-C01-01

| Field | Value |
|-------|--------|
| **SELECTED / APPROVED** | **OPTION A** — Authorize bounded C-01 UX redesign |
| **Decision date** | 2026-09-22 |
| **Alternatives** | Option B / Option C — **NOT SELECTED** |

---

## 8. PD-C01-02 — Pagination

| Field | Content |
|-------|---------|
| **Decision ID** | **PD-C01-02** |
| **Question** | Should Waiting List remain client-side paginated or move to server-side pagination? |
| **Current state** | `GET /Counseling/waiting-list` returns the authorized list; frontend performs client-side slicing; page sizes **10 / 25 / 50**; pagination is functional; not server-side |

### OPTION A — KEEP CLIENT-SIDE PAGINATION

**Status:** **SELECTED / APPROVED**

Current functional client-side pagination remains the C-01 behavior.

Current page sizes:

- 10  
- 25  
- 50  

C-01 may improve pagination **presentation** only.

**DO NOT** introduce as part of C-01:

- server-side Skip/Take  
- TotalCount API contract  
- server pagination  
- hybrid pagination  

**Server-side pagination is OUT OF SCOPE for C-01.** If future scale/performance evidence requires it, that requires a **separate** Product Decision.

### OPTION B — Introduce server-side pagination

**Status:** **NOT SELECTED** — **OUT OF SCOPE for C-01**

### OPTION C — Hybrid strategy

**Status:** **NOT SELECTED** — **OUT OF SCOPE for C-01**

### Product Owner decision record — PD-C01-02

| Field | Value |
|-------|--------|
| **SELECTED / APPROVED** | **OPTION A** — Keep client-side pagination |
| **Decision date** | 2026-09-22 |
| **Server-side pagination** | **OUT OF SCOPE for C-01** |

---

## 9. PD-C01-03 — Demographics

| Field | Content |
|-------|---------|
| **Decision ID** | **PD-C01-03** |
| **Question** | Should Waiting List Patient Detail expose additional demographic information such as DOB and blood group? |
| **Current state** | Age / Gender available; DOB used for age computation; Waiting List DTO does not project DOB / blood group; Patient Detail Sheet supports optional fields but they are not populated from WL API |

### OPTION A — KEEP WAITING LIST LIGHTWEIGHT

**Status:** **SELECTED / APPROVED**

Waiting List Patient Detail remains lightweight.

Use currently available information such as:

- Age  
- Gender  

Preserve omit-empty behavior.

**Do NOT add** to C-01:

- DOB  
- blood group  
- additional MPI fields  
- new Patient DTO projections  

**DTO enrichment is OUT OF SCOPE.** If a future operational requirement requires additional demographics, that must be handled by a **separate** explicit Product Decision.

### OPTION B — Enrich Waiting List DTO

**Status:** **NOT SELECTED** — **OUT OF SCOPE for C-01**

### OPTION C — Direct users to Patient Details (as primary posture)

**Status:** **NOT SELECTED** (Option A selected; Patient Details navigation remains available as existing product behavior where already present)

### Product Owner decision record — PD-C01-03

| Field | Value |
|-------|--------|
| **SELECTED / APPROVED** | **OPTION A** — Keep Waiting List lightweight (Age/Gender; omit empty) |
| **Decision date** | 2026-09-22 |
| **DTO enrichment** | **OUT OF SCOPE for C-01** |

---

## 10. PD-C01-04 — Pre-Auth Membership Rule

| Field | Content |
|-------|---------|
| **Decision ID** | **PD-C01-04** |
| **Question** | Should the current Pre-Auth membership rule be locked as the C-01 product rule? |
| **Current implementation** | Coverage-eligible `patientType` **+** CCMS awaiting condition (`waiting-list-preauth.ts` / related helpers) |

### SELECTED — LOCK THE CURRENT PRE-AUTH MEMBERSHIP RULE

**Status:** **SELECTED / APPROVED**

The current Pre-Auth membership behavior remains authoritative.

C-01 may improve presentation only:

- labels  
- badges  
- visual hierarchy  
- CTA presentation  
- attention treatment  

C-01 must **NOT** change:

- Pre-Auth membership criteria  
- CCMS semantics  
- lifecycle status semantics  
- queue membership logic  

Pre-Auth remains an **operational filter**. It is **NOT** converted into a lifecycle Status enum.

Any future change to Pre-Auth membership requires a **separate** domain Product Decision.

### Alternatives

| Alternative | Status |
|-------------|--------|
| Change membership criteria | **NOT SELECTED** — **OUT OF SCOPE for C-01** |

### Product Owner decision record — PD-C01-04

| Field | Value |
|-------|--------|
| **SELECTED / APPROVED** | **LOCK** current Pre-Auth membership rule; presentation refinement only |
| **Decision date** | 2026-09-22 |
| **Membership rule change** | **OUT OF SCOPE** unless a separate domain PD authorizes it |

---

## 11. PD-C01-05 — URL State

| Field | Content |
|-------|---------|
| **Decision ID** | **PD-C01-05** |
| **Question** | Should Waiting List filters and page state be represented in the URL? |
| **Current state** | Ephemeral React state (contrast: Sessions uses URL page / RR helpers) |

### SELECTED — LIMITED EXPLICIT URL STATE

**Status:** **SELECTED / APPROVED**

Authorize a bounded URL-state model for operationally useful Waiting List navigation state.

**Purpose:**

- Back / Forward behavior  
- refresh persistence  
- operational deep linking  
- shareable filtered views where appropriate  

URL state must **NOT**:

- establish ownership  
- mutate ownership  
- claim a session  
- assign a `CounselorId`  
- reassign a counselor  
- perform any ownership mutation  

Approved URL state **may** include:

- tab  
- type  
- owner  
- search  
- page  

Page size may be included only if needed by the existing pagination behavior.

**Before implementation**, the implementation task must define and document:

- exact parameter names  
- defaults  
- invalid-value behavior  
- Back behavior  
- filter-reset behavior  
- page-reset behavior  

Do **not** invent additional query parameters. Do **not** encode unnecessary state. Do **not** put PHI into URLs. Do **not** encode ownership claims or mutation commands in URLs.

### Alternative — No URL persistence

**Status:** **NOT SELECTED**

### Product Owner decision record — PD-C01-05

| Field | Value |
|-------|--------|
| **SELECTED / APPROVED** | **LIMITED EXPLICIT URL STATE** (no ownership mutation via URL) |
| **Decision date** | 2026-09-22 |
| **Parameter contract** | **Must be defined in the subsequent implementation task** before coding URL sync |
| **PHI in URLs** | **FORBIDDEN** |
| **Ownership mutation via URL** | **FORBIDDEN** |

---

## 12. PD-C01-06 — Referral Path

| Field | Content |
|-------|---------|
| **Decision ID** | **PD-C01-06** |
| **Question** | What referral entry paths are included in C-01 acceptance? |
| **Current evidence** | `ReferredByDoctorId` supported; doctor display supported; Add Patient accepts `referredByDoctorId`; full clinical referral-path coverage was not proven by reconciliation audit |

### OPTION A — ADD PATIENT REFERRAL PATH ONLY

**Status:** **SELECTED / APPROVED**

C-01 acceptance includes the directly supported path:

```text
Add Patient → referredByDoctorId → Waiting List
```

C-01 does **NOT** expand into a full hospital-wide referral matrix.

Broader clinical referral-path certification is **OUT OF SCOPE**.

Referral must **NOT** automatically establish `CounselorId` ownership. Referral remains independent of ownership assignment.

### OPTION B — Full refer-to-counsellor clinical referral matrix

**Status:** **NOT SELECTED** — **OUT OF SCOPE for C-01**

### OPTION C — Defer broader referral certification

**Status:** Broader certification remains **DEFERRED / OUT OF SCOPE**; Option A selected for C-01 acceptance boundary

### Product Owner decision record — PD-C01-06

| Field | Value |
|-------|--------|
| **SELECTED / APPROVED** | **OPTION A** — Add Patient referral path only |
| **Decision date** | 2026-09-22 |
| **Broader clinical referral matrix** | **OUT OF SCOPE for C-01** |
| **Ownership rule** | Referral must **not** auto-assign ownership |

---

## 13. Consolidated Decision Table

| Decision | Question | Selected / Approved | Scope | Explicitly Out of Scope |
|----------|----------|---------------------|-------|-------------------------|
| **PD-C01-01** | Authorize new C-01 UX package beyond PD-S13-J? | **OPTION A** — Authorize bounded C-01 UX redesign | Presentation-focused Waiting List UX around certified model | Ownership redesign; Phase 3I reopen; Slice 14; Phase 3J; Dashboard; My Queue |
| **PD-C01-02** | Client vs server pagination? | **OPTION A** — Keep client-side pagination | Pagination presentation polish only; page sizes 10/25/50 | Server Skip/Take; TotalCount API; server/hybrid pagination |
| **PD-C01-03** | Enrich demographics (DOB / blood / MPI)? | **OPTION A** — Keep lightweight Age/Gender | Detail presentation of currently available fields; omit-empty | DTO enrichment; DOB/blood/MPI projections |
| **PD-C01-04** | Lock Pre-Auth membership rule? | **LOCK** current Pre-Auth membership rule | Labels / badges / hierarchy / CTA / attention | Membership criteria; CCMS semantics; lifecycle status semantics |
| **PD-C01-05** | URL state for filters / page? | **LIMITED EXPLICIT URL STATE** | tab / type / owner / search / page (+ page size if needed); parameter contract in impl task | Ownership claims/mutation via URL; PHI in URLs; unnecessary params |
| **PD-C01-06** | Referral acceptance paths? | **OPTION A** — Add Patient referral path only | Add Patient → referredByDoctorId → Waiting List | Full hospital referral matrix; auto-ownership on referral |

**Governance clarity (binding):**

- C-01 is an **APPROVED** new bounded UX package.  
- It does **NOT** reopen Phase 3I.  
- It does **NOT** create Slice 14.  
- It does **NOT** create Phase 3J.  
- It does **NOT** modify certified ownership semantics.

---

## 14. Authorized Scope

### APPROVED C-01 IMPLEMENTATION SCOPE

The following is the **APPROVED** C-01 implementation scope. Implementation itself is **authorized for a subsequent task** and is **not performed in this recording task**.

### A. Waiting List page composition

Authorized:

- page hierarchy  
- summary / KPI composition  
- queue hierarchy  
- operational density  
- whitespace balance  
- information grouping  

### B. Search and filters

Authorized:

- search presentation  
- filter grouping  
- filter clarity  
- Apply / reset presentation  
- owner filter presentation  
- status / type presentation  

Preserve existing filter **semantics**.

### C. Worklist rows

Authorized:

- patient information hierarchy  
- visit / procedure hierarchy  
- owner visibility presentation  
- payment / Pre-Auth presentation  
- status presentation  
- action presentation  
- spacing  
- readability  

Do **not** change action semantics.

### D. Patient detail

Authorized:

- improve presentation of currently available data  
- improve hierarchy  
- improve readability  

Not authorized:

- DTO enrichment  
- new demographic fields  
- new patient data source  

### E. Pre-Auth

Authorized:

- visual clarity  
- badge / label treatment  
- attention hierarchy  
- CTA presentation  

Not authorized:

- membership rule changes  
- CCMS rule changes  
- lifecycle semantics changes  

### F. OT Returned

Authorized:

- visual clarity  
- operational separation  
- distinction from Auth Waiting List rows  

Not authorized:

- changing IP data source  
- changing OT ownership  
- converting OT Returned to WL lifecycle status  

### G. Pagination

Authorized:

- pagination presentation  
- page-size control presentation  
- current-page feedback  
- empty-page handling  

Not authorized:

- server pagination  
- API pagination contract  
- TotalCount changes  

### H. Loading / empty / error

Authorized:

- visual presentation  
- concise copy  
- honest state communication  
- existing behavior preservation  

### I. Responsive

Authorized:

- workstation  
- laptop  
- narrower supported widths  
- layout adaptation  

### J. Accessibility

Authorized:

- keyboard navigation  
- focus visibility  
- semantic structure  
- accessible labels  
- dialog / sheet accessibility  
- table / list semantics where appropriate  
- contrast  
- interaction states  
- screen-reader clarity  

### K. Existing design system

Use **ONLY** the existing Hospital Portal design system.

Reuse existing:

- shadcn/ui  
- Radix  
- Tailwind  
- Lucide  
- existing counselling tokens  
- existing Sheet / Dialog patterns  
- existing layout primitives  
- existing shared components  

Do **not** introduce a new design system.

### Technical scope decisions (resolved)

| Item | C-01 status |
|------|-------------|
| Server-side pagination | **OUT OF SCOPE** (PD-C01-02 Option A) |
| DTO demographic enrichment | **OUT OF SCOPE** (PD-C01-03 Option A) |
| URL state persistence | **IN SCOPE** — limited explicit URL state (PD-C01-05); parameter contract required in impl task |
| Broader referral UAT matrix | **OUT OF SCOPE** (PD-C01-06 Option A) |

---

## 15. Explicitly Out of Scope

The C-01 implementation must **NOT** include:

- Counsellor Dashboard  
- My Waiting List  
- new ownership model  
- new ownership entity  
- `CounselorId` semantic changes  
- Assign behavior changes  
- Claim behavior changes  
- Reassign eligibility changes  
- ReQueue changes  
- automatic ownership  
- automatic ownership transfer  
- leave transfer  
- HR integration  
- JWT / session invalidation  
- Claim / JWT security redesign  
- Clinical SoT integration  
- Clinical Recommendations integration  
- Follow-up ownership changes  
- Finalize Surgery ownership changes  
- Post-Surgery ownership changes  
- Analytics ownership changes  
- duplicate worklists  
- OT workflow redesign  
- Billing workflow  
- Insurance workflow redesign  
- server-side pagination  
- DTO demographic enrichment  
- broad historical migration  
- bulk remediation  
- new backend API unless separately approved  
- database migration unless separately approved  
- full clinical referral matrix  
- Phase 3I reopening  
- Slice 14  
- Phase 3J  

Also out of scope for **this recording task**: implementation, UI redesign execution, component creation, tests, and creating an implementation plan artifact.

---

## 16. Certified Phase 3I Behavior Protection

Any C-01 implementation must treat the following as **LOCKED**:

| Protected behavior | Protection |
|--------------------|------------|
| Shared Waiting List queue | **LOCKED** |
| PD16 branch authorization | **LOCKED** |
| `CounselorId` ownership SoT | **LOCKED** |
| `CreatedByUserId` ≠ ownership | **LOCKED** |
| Open / view / start ≠ ownership | **LOCKED** |
| Explicit Assign / Claim-for-lifecycle / Reassign only | **LOCKED** |
| Owner mutation ACL | **LOCKED** |
| Version / CAS / 409 | **LOCKED** |
| Ownership History | **LOCKED** |
| ReQueue → `CounselorId` NULL on Follow-up | **LOCKED** |
| No duplicate ReQueue on Waiting List | **LOCKED** |
| WL Reassign eligibility as certified | **LOCKED** |
| Sessions as RR / active-work remediation host | **LOCKED** |
| No Counsellor Dashboard / My Waiting List / duplicate worklist | **LOCKED** |
| OT Returned = IP projection | **LOCKED** |
| Pre-Auth = operational filter (not lifecycle Status); membership **LOCKED** (PD-C01-04) | **LOCKED** |
| Follow-up / Finalize / Analytics / Post-Surgery boundaries | **LOCKED** |
| Canonical routes / AuthService WL ownership APIs | **LOCKED** unless separate PD |

**Acknowledgement required before implementation:** Phase 3I certified ownership/lifecycle model remains authoritative and **untouched** by C-01 UX work.

---

## 17. Acceptance Criteria

Future implementation acceptance must cover:

### UX ACCEPTANCE

- hierarchy  
- density  
- KPI composition  
- row hierarchy  
- filters / search  
- patient detail presentation  
- Pre-Auth presentation  
- OT Returned presentation  
- pagination presentation  
- loading / empty / error  
- responsive behavior  
- accessibility  
- URL state  

### FUNCTIONAL REGRESSION ACCEPTANCE (mandatory)

Verify existing behavior remains unchanged:

- shared queue  
- PD16  
- `CounselorId`  
- Assign  
- Claim  
- Reassign  
- open ≠ ownership  
- CAS / 409  
- History  
- ReQueue boundary  
- Sessions relationship  
- OT boundary  
- Pre-Auth membership  
- Add Patient referral path  

### DATA / API ACCEPTANCE

**No API/data contract change** for C-01 under the approved decision set (client-side pagination retained; no DTO enrichment).

### UAT

Manual UAT is **mandatory** after implementation. Screenshots, automated tests, and implementation reports are **not** substitutes for manual UAT.

Formal historical **C-01 USER ACCEPTED** evidence was not found; any future acceptance must be newly recorded after UAT.

---

## 18. Future Implementation Gate

### Product Decision gate — SATISFIED

```text
PRODUCT DECISION GATE:                    SATISFIED
PRODUCT OWNER SELECTIONS:                 RECORDED (PD-C01-01 … PD-C01-06)
API / DATA DECISIONS:                     RESOLVED (no server pagination; no DTO enrichment)
OUT-OF-SCOPE BOUNDARIES:                  DOCUMENTED
PHASE 3I BEHAVIOR PROTECTION:             ACKNOWLEDGED / LOCKED
```

### Next required gate

```text
NEXT GATE = BOUNDED IMPLEMENTATION PLAN / IMPLEMENTATION TASK
```

The subsequent implementation task must still require:

1. Exact files / components to inspect.  
2. Existing design-system reuse.  
3. No ownership changes.  
4. No API / DB changes (none authorized under this PD set).  
5. Automated tests.  
6. Regression protection.  
7. Manual UAT.  
8. Acceptance artifact.  
9. Hard stop after UAT if defects are found.  
10. URL-state parameter contract documented before coding URL sync (PD-C01-05).  

The implementation task must **NOT** silently expand scope.

### Delivery sequence

```text
AUDIT / PD (COMPLETE — APPROVED)
  → BOUNDED IMPLEMENTATION PLAN / IMPLEMENTATION TASK
  → AUTOMATED TESTS
  → MANUAL UAT
  → ACCEPTANCE
```

Do **not** skip the UAT gate.

### Naming

Future work is **C-01 UX package** — not Slice 14, not Phase 3J, not Phase 3I continuation.

**Do not create implementation slices in this Product Decision recording task.**

---

## 19. Automated Test Expectations

This Product Decision **does not add or modify tests**. Future implementation must cover:

### Frontend

- Waiting List render  
- filter behavior  
- search  
- pagination  
- Pre-Auth  
- Add Patient  
- row actions  
- owner display  
- URL state  
- responsive behavior  
- accessibility  

### Regression

- Assign  
- Claim  
- Reassign  
- ownership ACL  
- branch authorization  
- CAS / 409  
- lifecycle actions  
- OT Returned  
- Pre-Auth membership  

### Referral

Test:

```text
Add Patient → referredByDoctorId → Waiting List
```

Do **not** expand into the full clinical referral matrix.

---

## 20. Manual UAT Gate

| Gate | Requirement |
|------|-------------|
| **When** | After implementation + automated tests |
| **Who** | Product / operational UAT per hospital process |
| **Cannot substitute** | Screenshots alone; automated tests alone; implementation reports alone |
| **Must include** | UX acceptance items + functional regression checklist (§17) |
| **Outcome artifact** | Explicit C-01 acceptance record (historical USER ACCEPTED pack was **not found**) |

---

## 21. Final Product Decision

### Approved decision set

| Topic | SELECTED / APPROVED |
|-------|---------------------|
| **C-01 authorization** | **PD-C01-01 OPTION A** — Authorize standalone bounded C-01 Waiting List UX redesign |
| **Pagination** | **PD-C01-02 OPTION A** — Keep functional client-side pagination (10/25/50); presentation only |
| **Demographics** | **PD-C01-03 OPTION A** — Keep Waiting List lightweight; no DTO enrichment |
| **Pre-Auth** | **PD-C01-04 LOCK** — Lock existing membership rule; presentation only |
| **URL state** | **PD-C01-05** — Limited explicit URL state; no ownership mutation; parameter contract in impl task |
| **Referral** | **PD-C01-06 OPTION A** — Add Patient referral path only |
| **Ownership** | **NO CHANGE / LOCKED** |
| **Phase 3I** | **REMAINS CLOSED** |
| **Slice 14** | **DO NOT CREATE** |
| **Phase 3J** | **DO NOT CREATE** |

### Binding status of this artifact

```text
C-01 PRODUCT DECISION:                    APPROVED

PD-C01-01:                                SELECTED — OPTION A
PD-C01-02:                                SELECTED — OPTION A
PD-C01-03:                                SELECTED — OPTION A
PD-C01-04:                                SELECTED — LOCK CURRENT PRE-AUTH RULE
PD-C01-05:                                SELECTED — LIMITED EXPLICIT URL STATE
PD-C01-06:                                SELECTED — OPTION A

C-01 IMPLEMENTATION:                      AUTHORIZED FOR SUBSEQUENT TASK
IMPLEMENTATION PERFORMED:                 NO

PHASE 3I:                                 FORMALLY CLOSED
SLICE 14:                                 NOT CREATED
PHASE 3J:                                 NOT CREATED
OWNERSHIP MODEL:                          UNCHANGED / LOCKED
```

> C-01 is authorized as a standalone bounded Waiting List UX package. This authorization does not reopen Phase 3I, does not create Slice 14, does not create Phase 3J, and does not authorize changes to the certified Counsellor ownership/work-allocation model.

---

## 22. Evidence / Source Index

### Primary

- `docs/audits/counsellor-c01-waiting-list-redesign-reconciliation-audit.md`

### Authoritative prior Product Decisions / closures

- `docs/audits/counsellor-ownership-work-allocation-phase3i-program-product-decision.md` (Phase 3I Option A closed)  
- `docs/audits/counsellor-ownership-work-allocation-phase3i-slice13-product-decisions.md` (**PD-S13-J Option A**)  
- `docs/audits/counsellor-ownership-work-allocation-phase3i-slice13-closure.md`  
- `docs/audits/hospital-portal-post-phase3i-program-transition-audit.md`  
- `docs/audits/counsellor-module-final-completion-audit.md`  
- `docs/audits/phase3i-slice13-package-b-acceptance.md` (Sessions — adjacent; not WL redesign acceptance)

### Historical C-01 / redesign (proposal context — not current authorization)

- `apps/hospital-portal-web/docs/ip-product-ui-ux-e2e-acceptance-matrix-2026-08-27.md` (C-WL)  
- `docs/superpowers/specs/2026-09-05-counsellor-waiting-list-worklist-design.md`  
- `docs/superpowers/plans/2026-09-05-counsellor-waiting-list-worklist.md`  
- `docs/superpowers/specs/2026-09-07-counsellor-waiting-list-worklist-v2.md`  
- `docs/superpowers/plans/2026-09-07-counsellor-waiting-list-worklist-v2.md`  

### Current implementation pointers (evidence only)

- `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/waiting-list/page.tsx`  
- `apps/hospital-portal-web/src/components/counsellors-desk/waiting-list/*`  
- `apps/hospital-portal-web/src/lib/counsellors-desk/waiting-list-*.ts`  
- AuthService `CounselingController` Waiting List endpoint / ownership APIs  

---

## 23. Final Manual UAT Acceptance & Closure (2026-09-22)

> **Governance / documentation only.** This section records Product Owner Manual UAT completion after authorized C-01 implementation and subsequent OT Returned / Waiting List UX cleanup. It does **not** authorize new implementation.

### Historical acceptance status (superseded)

Prior UAT observation artifact recorded:

```text
C-01 ACCEPTED = NO
C-01 CLOSED = NO
Manual UAT = SUBSTANTIALLY COMPLETE — OT RETURNED OUTSTANDING
```

Source (retained as history):  
`docs/audits/counsellor-c01-waiting-list-dashboard-redesign-uat-observations.md`

### Final acceptance status (authoritative)

Canonical closure artifact:  
`docs/audits/counsellor-c01-waiting-list-dashboard-redesign-acceptance-closure.md`

```text
C-01 MANUAL UAT = PASS
C-01 ACCEPTED   = YES
C-01 CLOSED     = YES

PASS areas: 15 / 15
FAIL areas: 0

Phase 3I  = CLOSED
Slice 13  = CLOSED
Slice 14  = DOES NOT EXIST
Phase 3J  = NOT CREATED

CURRENT AUTHORIZED IMPLEMENTATION = NONE
NEXT PROGRAM DECISION = PRODUCT PORTFOLIO / PRODUCT OWNER DECISION
```

### Binding notes

- Entire Counsellor module is **not** claimed COMPLETE by C-01 closure.  
- Remaining Wave 2 / PD-A–C / Finalize / Phase 2Y–2Z / Phase 2W gates remain separate where outstanding.  
- Deferred items remain deferred (Admin→RR, Claim availability, Post-Surgery SoT, Dashboard, Clinical SoT, MaxPageSize, JWT/HR leave, Slice 14 / Phase 3J).

---

## Control Flags

| Flag | Value |
|------|--------|
| PRODUCT DECISION STATUS | **APPROVED** |
| PRODUCT OWNER SELECTION | **RECORDED** |
| C-01 IMPLEMENTATION AUTHORIZED | **YES — subsequent bounded task only** (historical authorization) |
| IMPLEMENTATION PERFORMED | **YES** — completed under subsequent authorized tasks (not by this PD document alone) |
| C-01 MANUAL UAT | **PASS** |
| C-01 ACCEPTED | **YES** |
| C-01 CLOSED | **YES** |
| PRODUCTION CODE MODIFIED BY THIS PD RECORDING | **NO** |
| APIs / DB / PERMISSIONS / ROUTES / BUSINESS RULES MODIFIED BY THIS PD RECORDING | **NO** |
| OWNERSHIP BEHAVIOR MODIFIED | **NO** |
| PHASE 3I REOPENED | **NO** |
| SLICE 14 CREATED | **NO** |
| PHASE 3J CREATED | **NO** |
| ENTIRE COUNSELLOR MODULE ACCEPTED | **NO** |
| ARTIFACT UPDATED | **YES** — §23 Final Manual UAT Acceptance & Closure |

---

**END — COUNSELLOR C-01 WAITING LIST DASHBOARD REDESIGN PRODUCT DECISION — APPROVED — ACCEPTED / CLOSED — STOP**
