# Enterprise LMS — Collection / Specimen Discovery Audit

**Date:** 2026-10-09  
**Phase:** Post L-ORD-01C acceptance  
**Mode:** Audit / product discovery only  
**Status:** `READY_FOR_PRODUCT_DECISIONS`

---

## 1. Executive Summary

L-ORD-01C Manual UAT has closed. Enterprise LMS now has a certified path:

**L0 foundation → L-CAT-01 catalogue → L-ORD-01B order domain → L-ORD-01C Orders UI**, ending at **Submitted Order + OrderTests (`Ordered`)**.

Submit still does **not** create CollectionTask, Specimen, Accession, Barcode, label, requisition, or receiving records (**PD-ORD-17** remains authoritative).

The Enterprise Hospital Laboratory Management System PRD/BRD (v1.0, 08 October 2026) is **not present as a binary in this repository**. This audit therefore uses **PRD-derived, already-certified LMS decision and architecture documents** (same limitation as L-ORD-01A). Where line-level PRD text cannot be re-verified, items are marked **PRD FILE GAP** or **DECISION REQUIRED**. General LIMS knowledge is **not** used to invent requirements.

**Verdict:** Collection/Specimen is the correct next *clinical operational* domain after Order Intake, but **implementation must not start** until a formal **PD-COL / AD-COL product & architecture decision gate** closes the critical open questions (task model, specimen cardinality, identity vs accession vs barcode, collection vs receiving boundary, ownership, permissions).

**Acceptance gate for this audit:** `READY_FOR_PRODUCT_DECISIONS`  
**Not:** `READY_FOR_IMPLEMENTATION`

---

## 2. L-ORD-01C Closure / Dependency Position

| Certified capability | Status |
|---|---|
| LMS L0 foundation | Accepted |
| L-CAT-01 governed catalogue | Accepted |
| L-ORD-01B order domain/API | Accepted (`IMPLEMENTATION_ACCEPTED_FOR_UI_LATER` then UI-certified) |
| L-ORD-01C Orders UI | Accepted (Manual UAT complete) |
| Draft / orderables / submit / OrderTest / amend / cancel / concurrency / tenant·branch | Accepted |
| No Collection/Specimen leakage from Order Intake | Accepted |

**Upstream dependency for Collection:** Submitted `lms_order_tests` with status `Ordered` (and pinned catalogue versions including opaque specimen/container refs).

**Downstream consumers (not started):** Collection planning → Collection → Specimen identity/custody → Receiving/accession/triage → Testing → Results → Billing charge at collection (PD-LAB-BILL-01).

**Hard boundary (do not change):**

```text
Order: Draft → Submitted → Cancelled
OrderTest: Ordered
Submit creates: Order + OrderVersion + Selections + OrderTests only
```

---

## 3. PRD Traceability

### 3.1 PRD availability

| Source | Availability |
|---|---|
| `enterprise_laboratory_management_system_prd_brd.docx` (named in L-ORD-01A) | **NOT FOUND** in repository |
| PRD/BRD v1.0 cited in `enterprise-lms-existing-laboratory-boundary.md` | Citation only — binary absent |
| PRD-derived LMS docs (L0 IA, L-ORD audits, PD closures, next-slice audit) | **USED** |
| Older LabReport-centric `laboratory-management-product-definition-v3.md` | **YELLOW reference only** — not Enterprise LMS Order SoT |

### 3.2 Traceability table

| Requirement (from PRD-derived sources) | PRD / decision reference | Mandatory / Recommended | Existing implementation | Decision required | Proposed next slice |
|---|---|---|---|---|---|
| End-to-end lab workflow includes specimen stage after order | Boundary doc; L0 IA; L-ORD-01A | Mandatory (enterprise) | Order only | No for existence | Collection/Specimen program |
| Do not collapse Order / Specimen / Test / Report into one status | L-ORD-01A audit (PRD) | Mandatory | Order + OrderTest separate | No | Preserve |
| Order intake precedes collection planning | Next-slice audit; PRD stage sequence | Mandatory sequencing | Orders accepted | No | Collection after Orders |
| Submit does not create CollectionTask stubs | **PD-ORD-17 APPROVED** | Mandatory for L-ORD | Enforced | No | Collection owns tasks |
| Collection tasks / scheduling / labels / requisitions owned by Collection | PD-ORD-17 | Mandatory ownership | None | Task model detail | L-COL PD + implementation |
| Specimen identity & custody as later stage | L-ORD-01A ownership matrix | Mandatory sequencing | None | Identity model | L-SPC / L-COL PD |
| Receiving / triage after collection | Next-slice; L0 IA Specimens | Mandatory sequencing | None | Accession timing | L-RCV after Collection PD |
| Normal OPD charge at **specimen collection** | **PD-LAB-BILL-01 APPROVED** | Mandatory commercial | Not wired | Event that means “collected” | After collection event defined |
| No payment hard-block at order create; STAT not blocked by unpaid | **PD-LAB-PAY-01 APPROVED** | Mandatory | Order create OK | Soft-gate at collection UX | Collection PD follow-up |
| Catalogue specimen/container/timing as configuration | L-CAT version fields; PD-ORD-19 | Recommended metadata | Opaque refs on catalogue | Masters vs free-text | Config PD |
| Multi-test / multi-specimen where clinically required | PD-LAB-MULTI-01 (legacy Lab def); Enterprise LMS cardinality | Recommended | Panel → many OrderTests | **Exact cardinality** | **PD-COL-01** |
| Patient identification at collection | PRD collection stage (derived) | Likely mandatory | Not implemented | How/when verify | **PD-COL-08** |
| Collector identity | Derived ops need | Likely mandatory | Not implemented | Actor model | **PD-COL-09** |
| Collection datetime | Derived ops need | Likely mandatory | Not implemented | Source of truth clock | **PD-COL-10** |
| Collection site vs operating/performing branch | PD-ORD-04 performing=operating today | Open | Performing=Operating | Site model | **PD-COL-05** |
| Accession number | Legacy PD-LAB-BC-01 / e2e gap; Enterprise stage | Open for LMS | None | When/where generated | **PD-COL-03** |
| Barcode / label | Legacy PD-LAB-BC-01; Enterprise Collection | Open | None in LMS | Format + generation time | **PD-COL-04** |
| Rejection / unsuitable specimen | Catalogue `RejectionCriteria` text; e2e gap | Open | Text only | Reason codes + state | **PD-COL-11** |
| Recollection | e2e gap PD-LAB-SPEC-COM-01 | Open | None | Task/specimen/OrderTest effects | **PD-COL-12** |
| Chain of custody | L0 planning entity `SpecimenCustodyEvent` | Open | None | First-class vs events | **PD-COL-13** |
| Aliquots | L0 planning (implied clinical) | Open | None | Required in v1? | **PD-COL-14** |
| Referral specimens enter at receiving | Referral stage in IA | Open | None | Direct receive path | **PD-COL-15** |
| Work queue / ownership for collection | Counsellor ownership patterns; LMS Work Queue placeholder | Open | Shared nav only | Shared vs claim | **PD-COL-16** |
| Permissions `lms.collection.*` / `lms.specimens.*` | FE planned constants only | Open | Not seeded/enforced | Capability set | **PD-COL-17** |
| Audit every mutation | Platform audit pattern (L-CAT/L-ORD) | Mandatory pattern | Pattern exists | Action catalog | Reuse platform |
| Idempotency on create/collect/receive | L-ORD pattern | Recommended | None for COL | Which ops | **AD-COL-05** |
| Notifications on collect/reject | PD-LAB notify optional baseline | Optional | None | Mandatory vs optional | Defer unless PRD forces |

**Invented-from-general-LIMS:** none listed as Mandatory without a decision/PRD-derived citation.

---

## 4. Current Architecture

```text
Hospital Portal Web (/dashboard/lms/*)
        ↓
LaboratoryApi :7076 (/api/lms/*)
        ↓
shared PostgreSQL hospitalportal
        ├── lms_catalogue_*     (L-CAT-01)
        ├── lms_order_*         (L-ORD-01B)
        └── (no lms_collection_*, lms_specimen_*)

AuthService
        ├── JWT + permissions (lms.view, lms.catalogue.*, lms.orders.*)
        ├── Internal LMS validate patient/visit/user
        ├── Internal audit → audit_log
        └── Pathology LabReports / laboratory_*  (ISOLATED — not LMS SoT)

Billing / CCMS
        └── Financial SoT — charge at collection not yet triggered from LMS
```

LMS nav includes Collection / Specimens as **`not_implemented` placeholders** only.

---

## 5. Existing Repository Audit (GREEN / YELLOW / RED)

| Asset | Class | Notes |
|---|---|---|
| LaboratoryApi + `lms_*` order/catalogue | **GREEN** | Continue as service owner |
| JWT tenant, branch context, `ProtectedRoute` | **GREEN** | Reuse |
| Patient / Visit / User internal validate | **GREEN** | Reuse for collection context |
| Platform `audit_log` / PlatformAuditClient | **GREEN** | Reuse; no second ledger |
| LMS shell / nav / design system | **GREEN** | Placeholders become real later |
| OrderTests `Ordered` as work input | **GREEN** | Collection planning input |
| Catalogue `SpecimenTypeRef`, `ContainerRef`, volumes, timing, rejection text | **YELLOW** | Config refs — not Specimen SoT |
| FE `lms.collection.view` / `lms.specimens.view` | **YELLOW** | Constants only; not AuthService-seeded |
| Platform master `lab.specimen_type` widgets | **YELLOW** | Shared vocabulary candidate — not LMS SoT yet |
| Pathology `LabReport.specimen_type`, `sample_collected_*` | **RED** | Must not become LMS Collection SoT |
| Pathology `laboratory_test_specimen_options` | **RED** | Must not become LMS specimen master |
| Product-definition-v3 LabReport-root Specimen child | **RED** for Enterprise LMS SoT | Conflicts with Order-centric LMS; historical track |
| Orphan `/lab/*` clients | **RED** | Do not adopt |
| Imaging/CCMS accession numbers | **GREEN** (unrelated) | Do not overload as lab accession |
| Patient MRN / IOL barcode UX | **YELLOW** pattern only | Not lab accession SoT |

**LMS Collection/Specimen tables or APIs today:** none (correct).

---

## 6. Collection Workflow Analysis

### 6.1 Proposed enterprise sequence (conceptual)

```text
Order Submitted (+ OrderTests Ordered)
        ↓
Collection Planning          ← DECISION: auto vs manual vs hybrid
        ↓
CollectionTask(s)            ← DECISION: cardinality & create timing
        ↓
Patient Identification       ← DECISION: required checks
        ↓
Preparation / container check (catalogue-informed)
        ↓
Collection act               ← DECISION: creates Specimen?
        ↓
Label / identity bind        ← DECISION: barcode vs accession timing
        ↓
Custody / transport
        ↓
Receiving / Accession / Triage  ← DECISION: boundary vs Collection
        ↓
Testing
```

### 6.2 Transition matrix (candidate — not approved)

| From → To | Actor (candidate) | Permission (candidate) | Required data | Validation | Audit | Failure | Concurrency |
|---|---|---|---|---|---|---|---|
| Submitted → Planning visible | System / planner | view | OrderTests Ordered | Order not Cancelled | Optional | — | — |
| Planning → Task created | System or planner | manage | Order/OrderTest set | Catalogue logistics present if required | Yes | Block if policy | Idempotent create |
| Task unassigned → assigned/claimed | Collector / lead | manage/claim | User id | Active user; branch scope | Yes | Conflict if claimed | Optimistic / claim |
| Task → in progress | Collector | collect | Task id | Ownership if required | Yes | Stale task | Expected version |
| In progress → collected | Collector | collect | Datetime, site, collector, specimen link | Patient ID rules; container | Yes | Reject incomplete | Idempotent complete |
| Collected → in transit / handed off | Collector | collect | Custody event | — | Yes | — | Append-only event |
| Collected → received | Receiver | receive | Receiving datetime, accession? | Specimen exists | Yes | Reject | Idempotent receive |
| Any → failed / cancelled / deferred | Authorized | manage | Reason | Reason required | Yes | — | Versioned |
| Collected → rejected | Receiver / tech | receive/reject | Reason | Immutable specimen history | Yes | — | — |
| Rejected → recollection task | System / planner | manage | Link to original | Policy | Yes | — | Idempotent |

All rows above are **candidates pending PD-COL**. Do not implement.

---

## 7. Specimen Workflow Analysis

Specimen is a **first-class planning entity** in L0 IA (`Specimen`, `SpecimenContainer`, `SpecimenCustodyEvent`) but **not persisted**.

Open questions (all **DECISION REQUIRED** unless noted):

| Question | Evidence |
|---|---|
| When is Specimen created? | PD-ORD-17 implies not at order submit; Collection vs Receiving birth = open |
| Is Specimen child of Order, OrderTest, or CollectionTask? | Not defined for Enterprise LMS |
| Are containers separate entities? | L0 lists `SpecimenContainer` |
| Are custody events append-only? | Pattern matches audit culture; not certified |
| Immutability after collect | Legacy PD-LAB note: after sample_collected core identity immutable — **YELLOW** for LMS |

---

## 8. CollectionTask Analysis

| Question | Finding |
|---|---|
| Required as distinct object? | **DECISION REQUIRED** — strongly suggested by PD-ORD-17 (“Collection owns tasks”) and L-ORD-01A ownership matrix |
| One per Order / OrderTest / required specimen / collection event? | **DECISION REQUIRED** (**PD-COL-02**) |
| Created at submit? | **No** — PD-ORD-17 APPROVED |
| Created at planning / collect / other? | **DECISION REQUIRED** |
| States | Only document with evidence: none certified. Candidates (unassigned, assigned, claimed, in progress, collected, failed, cancelled, deferred) = **DECISION REQUIRED** — do not assume Counsellor claim model |

---

## 9. Specimen Cardinality — Critical

**Do not assume** `1 Order = 1 Specimen` or `1 OrderTest = 1 Specimen`.

| Scenario | PRD-derived evidence | Status |
|---|---|---|
| One specimen → many OrderTests (e.g. EDTA serving multiple tests) | Clinically expected; PD-LAB-MULTI-01 legacy; Enterprise exact model open | **DECISION REQUIRED** |
| One OrderTest → many specimens | Possible (e.g. paired samples); not specified | **DECISION REQUIRED** |
| Panel → many OrderTests → multiple specimen types | Panel explosion certified; specimen grouping open | **DECISION REQUIRED** |
| Multiple containers from one collection event | L0 `SpecimenContainer` implies possible | **DECISION REQUIRED** |
| Aliquots from primary | Not specified for LMS v1 | **DECISION REQUIRED** / likely **DEFERRED** |
| Recollection = new Specimen | Implied by immutability of rejected specimen | **DECISION REQUIRED** |
| Referral specimens | Referral stage exists in IA | **DECISION REQUIRED** |

### Illustrative examples (not approved rules)

```text
Example A — shared draw (IF approved):
  Order O1
    OrderTest CBC (EDTA)
    OrderTest HbA1c (EDTA)
  → CollectionTask T1
  → Specimen S1 (EDTA) linked to both OrderTests

Example B — split types (IF approved):
  Order O2
    OrderTest Chemistry (SST)
    OrderTest Coag (Citrate)
  → Task(s) …
  → Specimen S2 + Specimen S3

Example C — recollection (IF approved):
  Specimen S1 Rejected(insufficient)
  → RecollectionTask T2
  → Specimen S4 (new identity); S1 retained immutable
```

---

## 10. Specimen Identity / Accession / Barcode

| Identifier | Separate? | Unique scope | Generated when? | Printed? | Immutable? |
|---|---|---|---|---|---|
| Specimen ID (system GUID) | Likely | Global PK | At Specimen create | No | Yes |
| Business specimen number | **DECISION** | Tenant? | **DECISION** | Maybe | **DECISION** |
| Accession number | **DECISION** if ≠ specimen number | Tenant/site? | Collection vs Receiving (**PD-COL-03**) | Often yes | Usually yes |
| Container ID | **DECISION** | Per specimen | At container create | Label | **DECISION** |
| Barcode value | **DECISION** vs accession | Must be unique in scan domain | Pre-print vs at collect (**PD-COL-04**) | Yes | Replace on damage? **DECISION** |
| Label ID / print job | Likely operational, not clinical SoT | — | Print time | — | — |

**Numbering formats:** **DECISION REQUIRED** — do not invent (`LAB-…` order format must not be casually reused without PO approval).

**Damaged barcode / regenerate:** **DECISION REQUIRED**.  
**Recollected specimen identity:** new Specimen vs reuse number — **DECISION REQUIRED**.

---

## 11. Collection Site Analysis

| Concept | Current LMS | Collection implication |
|---|---|---|
| Operating Branch | Required on order | May remain order context |
| Performing Branch | = Operating (PD-ORD-04) | May diverge later for send-out |
| Collection Site | Not modeled | **PD-COL-05**: operating vs performing vs room vs external vs home |

**Rule:** Do not invent a new org hierarchy. Prefer Branch ID (+ optional free-text location) unless PO approves richer site model.

---

## 12. Specimen / Container Analysis (Catalogue-facing)

Present on `LmsCatalogueVersion` (opaque / free text — **YELLOW**):

| Field | Role today |
|---|---|
| `SpecimenTypeRef` | Display/config ref |
| `ContainerRef` | Display/config ref |
| `RequiredVolume` | Informational |
| `PatientPreparation` | Informational |
| `CollectionTiming` | Entity column; limited API surface |
| `StabilityNotes`, temperature/light, storage, transport | Entity columns |
| `RejectionCriteria` | Text guidance only |

**Not present:** first-class SpecimenType master, ContainerType master, additive taxonomy, anatomical source enum, stability engine, transport SLA engine.

**PD-COL-06:** Which catalogue fields **block** collection vs inform only (align with PD-ORD-19 spirit).

---

## 13. Rejection / Recollection Analysis

| Topic | Evidence | Decision |
|---|---|---|
| Unable to collect / patient unavailable | Ops need; not coded | Reason model **PD-COL-11** |
| Insufficient / wrong container / contaminated / mislabeled / leaked / expired / temperature | Common LIMS; PRD line items **FILE GAP** | Do not invent reason catalog |
| Lost specimen | Traceability need | Custody + state **PD-COL-13** |
| Rejected specimen remains | Immutability principle (legacy note) | Keep record; new recollection specimen **PD-COL-12** |
| OrderTest state on reject | OrderTest still `Ordered` today | Later states **DECISION** |
| Order status on reject | Must not collapse into Order status (PRD) | Order stays Submitted unless cancel policy |
| Notifications | Optional in prior PD-LAB baseline | Not mandatory without PO |
| Commercial effect of recollect | PD-LAB-SPEC-COM-01 still open historically | Finance follow-up after clinical model |

---

## 14. Receiving / Accessioning Boundary

| Question | Status |
|---|---|
| Accession at collection vs laboratory receiving? | **PD-COL-03** |
| Barcode before collection (pre-label) vs at collect vs at receive? | **PD-COL-04** |
| Can “collected but not received” exist? | Almost certainly yes clinically — **must be explicit state** |
| Receiving creates canonical Specimen? | Alternative birth model — **DECISION** |
| Receive without collection event (referral / external)? | **PD-COL-15** |
| Where Collection ends | **AD-COL-02** — must be explicit before schema |

**Recommendation for decision workshop:** Prefer a model where **Collection produces a Specimen in Collected (not yet Received)** and **Receiving/Accession is a later mutation**, unless PO chooses accession-at-collection. Do **not** treat this recommendation as approved.

---

## 15. State Machines (Candidates — Separate)

### 15.1 Order (certified — do not change)

`Draft → Submitted → Cancelled` (+ amend versions while Submitted).

### 15.2 OrderTest (certified now / future later)

| Now | Later (candidates) |
|---|---|
| `Ordered` | `PendingCollection`, `Collected`, `Received`, `Rejected`, `RecollectRequested`, `InTesting`, … |

Exact names/transitions = **DECISION REQUIRED**. Do not overload Order status.

### 15.3 CollectionTask (candidate)

Initial → terminal matrix **DECISION REQUIRED** (see §8).

### 15.4 Specimen (candidate)

Example only: `Collected → InTransit → Received → Accepted | Rejected → (Aliquoted) → Consumed/Disposed` — **not approved**.

### 15.5 Receiving

May be Specimen transition rather than separate aggregate — **AD-COL-02**.

---

## 16. Ownership / Work Queue

| Pattern | Status |
|---|---|
| Shared Collection worklist by branch/tenant | Likely minimum | **PD-COL-16** |
| Explicit assign / claim / release | Counsellor-like | **DECISION** — do not auto-copy |
| Reassignment when collector leaves | Ops need | **DECISION** |
| LMS Work Queue page | Placeholder | Do not hijack for Collection without PD |

Separate **shared queue visibility** from **individual ownership**.

---

## 17. Permissions

**Do not seed or grant in this audit.**

| Candidate code | Purpose | Justification |
|---|---|---|
| `lms.collection.view` | See tasks/worklist | FE constant exists; not enforced |
| `lms.collection.manage` / `collect` | Plan, assign, complete | Not defined |
| `lms.specimens.view` | View specimen records | FE constant exists |
| `lms.specimens.manage` / `receive` / `reject` | Mutate specimen/receiving | Not defined |

For each eventual code: server enforcement in LaboratoryApi, UI via PermissionGate, audit on mutate. **Production role grants = separate decision** (same pattern as L-ORD).

**PD-COL-17** must approve the final capability list.

---

## 18. Audit / Traceability

Reuse **PlatformAuditClient → AuthService InternalAudit → `audit_log`**.

| Mutation class | Audit required? |
|---|---|
| Create/cancel/reassign CollectionTask | Yes (fail-closed recommended) |
| Complete collection | Yes |
| Create/bind barcode/accession | Yes |
| Custody handoff | Yes (or SpecimenEvent append) |
| Reject / recollect | Yes + reason |
| Receive / accession | Yes |

Specimen clinical history should be **permanent** (no silent delete). Soft-cancel only if PO allows.

---

## 19. Idempotency / Concurrency

| Operation | Idempotency | Optimistic concurrency |
|---|---|---|
| Create CollectionTask(s) from order | Likely yes | Task/order version |
| Complete collection | Yes | Task + Specimen |
| Assign barcode/accession | Yes | Specimen row version |
| Reject / recollect request | Yes | Specimen + OrderTest |
| Receive | Yes | Specimen |

Do not blindly copy Order idempotency keys without defining operation names and request hashes (**AD-COL-05**).

---

## 20. Service Ownership

| Question | Recommendation for decision |
|---|---|
| New microservice? | **No** — unless AD finds concrete scale/security reason |
| Owner | **LaboratoryApi** + `lms_*` tables on shared `hospitalportal` |
| Pathology | Remains isolated |
| Billing trigger | Event/API to Billing SoT at approved “collected” moment — Billing remains financial SoT |

**AD-COL-01:** Confirm LaboratoryApi ownership (recommended).

---

## 21. Data Model Proposal (Conceptual Only — NO MIGRATIONS)

### A. Required (if Collection proceeds) — still PD-gated

| Entity | Purpose | Identity | Key relationships | Lifecycle | Tenant/branch | Audit |
|---|---|---|---|---|---|---|
| **CollectionTask** | Work unit to collect | GUID + optional business no. | Order, OrderVersion?, OrderTest(s)?, Branch, Assignee? | Planning → Collected/Failed/Cancelled | Tenant + branch scope | Yes |
| **Specimen** | Physical sample identity | GUID + business/accession? | Patient, Order, OrderTest M:N?, CollectionTask?, Container(s) | Collected → … → Rejected/Received | Tenant + site/branch | Yes |
| **SpecimenOrderTest** (link) | Cardinality bridge | GUID | Specimen ↔ OrderTest | Created at bind | Tenant | Yes |

### B. Decision required / optional

| Entity | Notes |
|---|---|
| **SpecimenContainer** | Separate vs attributes on Specimen |
| **SpecimenEvent / CustodyEvent** | Append-only history vs status-only |
| **Accession** | Separate aggregate vs Specimen field |
| **ReceivingRecord** | Separate vs Specimen.Received* |
| **Rejection** | Event vs status+reason fields |
| **RecollectionRequest** | Separate vs new CollectionTask type |
| **Aliquot** | Likely **DEFERRED** |

### C. Must NOT exist separately (unless PD forces)

| Anti-pattern | Why |
|---|---|
| Duplicate Patient/Specimen master outside platform Patient | Forbidden |
| Pathology LabReport as LMS Specimen | **RED** |
| CollectionTask rows created by Order submit | Violates PD-ORD-17 |
| Client-only “collected” flags without server SoT | Forbidden |

**Immutable candidates:** Specimen system id; collected timestamps once finalized; pinned OrderTest catalogue versions (already immutable post-submit); accession once assigned (if PD says so).

---

## 22. API Surface Proposal (Not Implemented)

| Method | Route (candidate) | Purpose | Permission (candidate) | Transition | Idempotency | Concurrency |
|---|---|---|---|---|---|---|
| GET | `/api/lms/collection/tasks` | Worklist | collection.view | — | — | — |
| GET | `/api/lms/collection/tasks/{id}` | Detail | collection.view | — | — | — |
| POST | `/api/lms/collection/tasks/plan` | Create tasks from order | collection.manage | Planning | Yes | Order/task |
| POST | `/api/lms/collection/tasks/{id}/claim` | Claim | collect | Assign | Yes | Version |
| POST | `/api/lms/collection/tasks/{id}/complete` | Record collection | collect | → Collected | Yes | Version |
| POST | `/api/lms/collection/tasks/{id}/fail` | Unable to collect | collect/manage | → Failed | Yes | Version |
| GET | `/api/lms/specimens/{id}` | Specimen detail | specimens.view | — | — | — |
| POST | `/api/lms/specimens/{id}/receive` | Receiving | specimens.receive | → Received | Yes | Version |
| POST | `/api/lms/specimens/{id}/reject` | Reject | specimens.manage | → Rejected | Yes | Version |
| POST | `/api/lms/specimens/{id}/recollect` | Start recollection | manage | New task/specimen | Yes | Version |

Exact routes/permissions **subject to PD-COL-17 / AD-COL**. Prefer fewer endpoints until PDs close.

---

## 23. UI / UX Discovery

| Surface | Role | Notes |
|---|---|---|
| Collection worklist | Primary ops | Branch-scoped; filters by status/priority/STAT |
| Collection task detail | Execute collect | Patient header reuse; order context; OrderTests list |
| Patient identification step | Safety | Fields TBD (**PD-COL-08**) |
| Specimen / label confirmation | Identity | Barcode display/print TBD |
| Rejection / fail dialog | Safety | Reason required |
| Specimens worklist | Downstream | Receiving entry |
| Receiving dialog | Lab intake | Accession bind if at receive |
| Order detail (Orders UI) | Read-only links | Show collection/specimen status later — **no Orders rewrite now** |

Reuse Hospital Portal design system + LMS shell. Counsellor = quality bar for density/a11y; **do not** copy counselling ownership blindly. Desktop-first staff UX.

---

## 24. Security / Privacy

| Control | Requirement |
|---|---|
| Tenant isolation | JWT tenant only; no client TenantId override |
| Branch isolation | Server-enforced visibility/action scope |
| Patient authorization | Validate patient via existing adapters |
| Specimen PHI | Treat as PHI; no logging of identifiers in console/URLs |
| Barcode payload | Minimize PHI on label (**PD**) |
| Least privilege | Separate view/manage/collect/receive |
| Server-side state | UI never authoritative |
| Replay | Idempotency on mutations |
| Pathology ACL | Must not authorize LMS Collection |

---

## 25. Nonfunctional Requirements

| Area | Carry-forward |
|---|---|
| Idempotency | Yes for create/complete/receive/reject |
| Availability | Soft-gate payment must not brick STAT collection (PAY-01) |
| Performance | Worklist pagination/virtualization when built |
| Observability | Structured logs without PHI; correlate audit ids |
| Audit | Fail-closed for clinical mutations (align L-ORD) |
| Integrity | FK-safe persists (lesson from order create FK defect) |
| Accessibility | Staff UI a11y baseline |
| Backup/recovery | Shared PG — no special Collection DB |

---

## 26. Product Decisions Required

| ID | Decision | Evidence | Options | Recommended (for workshop — not approved) | Consequences | Approval before impl? |
|---|---|---|---|---|---|---|
| **PD-COL-01** | Specimen ↔ OrderTest cardinality | Panel explosion; MULTI-01; PRD FILE GAP | 1:1 only; M:N via link; hybrid by specimen type | **M:N link table** | Schema + UI complexity | **Yes** |
| **PD-COL-02** | CollectionTask grain | PD-ORD-17 | Per order; per OrderTest; per required specimen type; per collection event | **Per required specimen type / draw plan** (derived from OrderTests + catalogue) | Planning engine scope | **Yes** |
| **PD-COL-03** | Accession timing & uniqueness | Legacy BC-01; IA receiving | At collect; at receive; = specimen number | **At receiving** (collection uses provisional barcode/specimen id) | Receiving slice coupling | **Yes** |
| **PD-COL-04** | Barcode generation & format | FILE GAP | Pre-print; at collect; at receive; format TBD | **Generate at label print / collect; format PO-owned** | Printer adapters later | **Yes** |
| **PD-COL-05** | Collection site model | PD-ORD-04 | = operating; free-text+branch; room hierarchy | **Branch + optional location text** | Avoid new org tree | **Yes** |
| **PD-COL-06** | Catalogue logistics blocking rules | PD-ORD-19 | Inform only; block if missing type/container | **Inform in v1; block only if PO lists fields** | Safer rollout | **Yes** |
| **PD-COL-07** | When Specimen row is created | Birth boundary | At task create; at collect complete; at receive | **At collect complete** | Aligns custody start | **Yes** |
| **PD-COL-08** | Patient ID at collection | Safety | MRN+name; +DOB; +wristband scan | **Minimum: confirm patient vs order (MRN/name/DOB)**; scanning deferred unless PO mandates | Mobile scope | **Yes** |
| **PD-COL-09** | Collector identity | Ops | Current user only; allow recorded other | **Actor = authenticated user; optional witnessed-by** | Audit clarity | **Yes** |
| **PD-COL-10** | Collection timestamp | Ops | Client clock; server UTC | **Server UTC + optional client observed** | Clock skew | **Yes** |
| **PD-COL-11** | Failure/rejection reason model | FILE GAP | Free text; coded list; both | **Coded list + free text** — codes PO-approved | No invented codes in code | **Yes** |
| **PD-COL-12** | Recollection mechanics | SPEC-COM open | New task only; new specimen; OrderTest state | **New task + new Specimen; retain old Rejected** | Traceability | **Yes** |
| **PD-COL-13** | Custody model | L0 entity | Status only; append-only events | **Append-only SpecimenEvent** | History integrity | **Yes** |
| **PD-COL-14** | Aliquots in first Collection program | None | In v1; defer | **Defer** | Shrink slice | **Yes** |
| **PD-COL-15** | Referral/external intake | IA referrals | Must collect first; receive-direct | **Allow receive-direct path later; not in first slice** | Scope control | **Yes** |
| **PD-COL-16** | Ownership vs shared queue | Counsellor patterns | Shared only; claim/release; assign | **Shared queue + optional claim** | UX/ACL | **Yes** |
| **PD-COL-17** | Permission codes & role grants | FE constants | view/manage/collect/receive split | **Define codes; grants separate like L-ORD** | Security | **Yes** |
| **PD-COL-18** | Billing trigger event | BILL-01 | On collect complete; on receive | **On collect complete** for OPD (confirm with Finance) | Cross-domain | **Yes** |
| **PD-COL-19** | OrderTest status names after Ordered | State machine doc | PendingCollection vs Collected… | **Approve vocabulary before coding** | FE/API contract | **Yes** |
| **PD-COL-20** | Soft payment gate at collection | PAY-01 follow-up | Warn only; block routine; never STAT | **Warn routine; never hard-block STAT** | UX | **Yes** |

---

## 27. Architecture Decisions Required

| ID | Topic | Options | Recommended (workshop) | Approval before impl? |
|---|---|---|---|---|
| **AD-COL-01** | Service ownership | LaboratoryApi vs new service | **LaboratoryApi** | Yes |
| **AD-COL-02** | Collection vs Receiving aggregate boundary | Single Specimen lifecycle vs ReceivingRecord | **Specimen lifecycle + receive transition; no separate Receiving microservice** | Yes |
| **AD-COL-03** | Identity model | SpecimenId / Accession / Barcode relationship | **GUID PK + tenant business number + barcode value field; accession rule per PD-COL-03** | Yes |
| **AD-COL-04** | Cardinality persistence | Denormalize vs link table | **`lms_specimen_order_tests` (or equiv.) M:N** | Yes |
| **AD-COL-05** | Idempotency store | Reuse order table vs new | **New `lms_collection_idempotency` (or shared LMS idempotency with operation prefix)** | Yes |
| **AD-COL-06** | Concurrency token | RowVersion on Task/Specimen | **Yes on mutable aggregates** | Yes |
| **AD-COL-07** | Domain events / outbox | Sync Billing call vs outbox | **Outbox/event for Billing handoff preferred; sync only if platform already mandates** | Yes |
| **AD-COL-08** | Pathology reuse | Bridge LabReport specimen fields | **Forbidden as SoT** | Yes (reaffirm) |
| **AD-COL-09** | Catalogue masters for specimen/container | Opaque refs vs new LMS masters | **Start with refs + optional controlled vocab table if PO requires** | Yes |
| **AD-COL-10** | Migration strategy | One big COL+SPC+RCV migration vs staged | **Staged: Task planning → Collect/Specimen → Receiving** | Yes |

---

## 28. Recommended Next Bounded Slice

### Immediate next work (this gate)

**L-COL-01A — Collection / Specimen Product & Architecture Decision Closure**

Not implementation. Close PD-COL-01…20 and AD-COL-01…10 (or PO-trimmed subset marked blocking).

### First implementation slice *after* decisions (recommendation)

Among A–F:

| Candidate | Fit |
|---|---|
| A. Collection Planning foundation | Strong |
| B. CollectionTask domain | Strong — pairs with A |
| C. Specimen identity foundation alone | Weak without collect event |
| D. Collection + specimen together | Medium — larger but UAT-meaningful if PD-COL-07 = at collect |
| E. Receiving/accession foundation | Premature before collect |
| F. Other | — |

**Recommended first implementation slice (post-PD):**  
**A + B — Collection Planning + CollectionTask domain foundation**

**Why:**

1. PRD/LMS stage order places planning/collection after order intake.  
2. PD-ORD-17 already assigned task ownership to Collection.  
3. Meaningful UAT: Submitted OrderTests → visible tasks → claim/complete (even if Specimen is created in the same thin complete API).  
4. Avoids premature Receiving/accession complexity (**E**).  
5. Avoids Specimen-only slice with no operational actor (**C**).  
6. Lower schema risk than full D+E+aliquots+custody network.  
7. Enables later BILL-01 wiring once “collected” is a real server event.

If PD-COL-07 chooses Specimen-at-collect, the **complete-collection** API may create Specimen in the same slice without opening Receiving — still not L-RCV-01.

---

## 29. Explicit Out of Scope (Now)

- Any Collection/Specimen/Receiving implementation  
- Migrations / tables / APIs / UI / permissions seeds / role grants  
- Pathology changes  
- Order/Catalogue certified behavior changes  
- Testing / Results / Reporting / QC  
- AOE / favourites / pathways  
- Billing charge posting (until PD-COL-18 + integration slice)  
- Aliquots / referral receive-direct (unless PO pulls into PD and first slice)  
- Hardware printer/scanner adapters  

---

## 30. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Implementing before PD-COL closes | Critical | Gate = READY_FOR_PRODUCT_DECISIONS only |
| Assuming 1:1 OrderTest:Specimen | High | PD-COL-01 workshop |
| Using Pathology specimen fields as SoT | Critical | AD-COL-08 / RED list |
| Accession-at-collect vs receive ambiguity | High | PD-COL-03 |
| Collapsing specimen states into Order status | High | Keep state machines separate |
| Scope explosion (custody+aliquot+referral+billing) | High | AD-COL-10 staged slices |
| Permission grants blocking UAT | Medium | Mirror L-ORD Admin/`*` UAT path; grants separate |
| PRD FILE GAP misread as license to invent | High | Mark FILE GAP; require PO |

---

## 31. Acceptance Gate

### Gate result

# READY_FOR_PRODUCT_DECISIONS

**Not** `READY_FOR_IMPLEMENTATION`.

Blocking decisions before any Collection/Specimen code or migration:

1. PD-COL-01 Cardinality  
2. PD-COL-02 CollectionTask grain & create timing  
3. PD-COL-03 Accession timing  
4. PD-COL-04 Barcode policy  
5. PD-COL-05 Collection site  
6. PD-COL-07 Specimen birth event  
7. PD-COL-16 Ownership model  
8. PD-COL-17 Permissions  
9. AD-COL-01 Service ownership  
10. AD-COL-02 Collection/Receiving boundary  
11. AD-COL-04 Link-table cardinality persistence  
12. AD-COL-10 Slice staging  

---

## 32. Implementation Discipline Confirmation

| Check | Confirmed |
|---|---|
| No source code changed except this audit document | **Yes** |
| No database migration created | **Yes** |
| No database schema changed | **Yes** |
| No API implemented | **Yes** |
| No frontend functionality implemented | **Yes** |
| No Pathology functionality changed | **Yes** |
| No Collection functionality implemented | **Yes** |
| No Specimen functionality implemented | **Yes** |
| No permissions seeded | **Yes** |
| No role grants changed | **Yes** |
| No certified LMS behavior changed | **Yes** |
| L-ORD-01B remains authoritative | **Yes** |
| L-ORD-01C remains accepted | **Yes** |

---

## 33. Next Decision Gate

**Authorize:** `L-COL-01A` Product Decision Closure workshop (PD-COL / AD-COL).  

**Do not authorize:** Collection/Specimen schema, APIs, or UI until that closure is accepted.

**STOP.**
