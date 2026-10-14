# L-COL-01A — Collection / Specimen Product & Architecture Decision Closure

**Date:** 2026-10-09  
**Slice:** L-COL-01A (product + architecture decision closure only)  
**Mode:** DOCUMENTATION ONLY — no schema, API, UI, permission seed, Pathology, Orders, or Catalogue changes  
**Upstream discovery audit:** [enterprise-lms-collection-specimen-discovery-audit.md](./enterprise-lms-collection-specimen-discovery-audit.md) (`READY_FOR_PRODUCT_DECISIONS`)  
**Downstream implementation:** CollectionTask path authorized as **L-COL-01B ACCEPTED**. Specimen/Receiving PO approvals closed in [enterprise-lms-specimen-receiving-decision-closure.md](./enterprise-lms-specimen-receiving-decision-closure.md) (`PRODUCT_DECISIONS_CLOSED_L_COL_01C_AUTHORIZED` — L-COL-01C authorized for separate implementation; not implemented by that document).

```text
PRD / BRD (FILE GAP — binary not in repo)
  ↓
Collection/Specimen discovery audit
  ↓
PD-COL / AD-COL decisions (this document)  ← workshop baseline
  ↓
L-COL-01B Collection Planning + CollectionTask  ← ACCEPTED
  ↓
Specimen & Receiving PD-COL-SPC-* / AD-COL-SPC-*
  → enterprise-lms-specimen-receiving-decision-closure.md
     PRODUCT_DECISIONS_CLOSED_L_COL_01C_AUTHORIZED
  ↓
L-COL-01C Specimen Foundation ← separate implementation task
```

---

## 1. Decision Gate Summary

| Item | Status |
|---|---|
| L-ORD-01C Manual UAT | **PASSED / ACCEPTED** |
| Discovery audit | Accepted baseline for workshop |
| PD-COL-01 … PD-COL-20 | **PROPOSED / DEFERRED proposals** — see §4–§6 (none newly APPROVED by this document alone) |
| AD-COL-01 … AD-COL-10 | Mostly **PROPOSED**; AD-COL-01 / AD-COL-08 **APPROVED** as reaffirmation of certified LMS architecture |
| Implementation | **NOT AUTHORIZED** |

**Important:** Workshop recommendations from the discovery audit are **not** approved product rules. Only statuses marked **APPROVED** below are already certified elsewhere or reaffirmed as immutable upstream constraints. Everything else requires Product Owner action.

**Gate determination:**

# READY_FOR_PRODUCT_OWNER_APPROVAL

**Not** `READY_FOR_IMPLEMENTATION`.

---

## 2. Upstream Certified Constraints (MUST REMAIN)

These are already approved and **must not be changed** by L-COL-01A:

| # | Constraint | Source |
|---|---|---|
| 1 | Order: `Draft → Submitted → Cancelled`; amend while `Submitted` | PD-ORD-10/11/12; L-ORD-01B |
| 2 | OrderTest starts as `Ordered` | PD-ORD-10; L-ORD-01B |
| 3 | Submit creates Order + OrderVersion + Selections + OrderTests only | L-ORD-01B |
| 4 | Submit must **not** create CollectionTask, Specimen, Accession, Barcode, Label, Requisition, Receiving | **PD-ORD-17 APPROVED** |
| 5 | PD-ORD-17 remains authoritative | L-ORD-01A-PD |
| 6 | LaboratoryApi is LMS service boundary | L-ORD architectural baseline |
| 7 | Pathology isolated — **not** LMS Collection/Specimen SoT | Enterprise LMS boundary (Variant B+) |
| 8 | Platform Patient / Visit / User / Branch authoritative | L-ORD / L0 |
| 9 | Platform `audit_log` is audit SoT | L-ORD / L-CAT |
| 10 | Financial state separate from clinical state; Billing = financial SoT | PD-LAB-BILL / PD-ORD-09 |
| 11 | No payment hard-block at order create; STAT not blocked merely by unpaid | **PD-LAB-PAY-01 APPROVED** |
| 12 | Normal OPD charge at **specimen collection** (commercial principle) | **PD-LAB-BILL-01 APPROVED** |
| 13 | Performing Branch = Operating Branch in L-ORD slice (PD-ORD-04) | L-ORD-01A-PD — Collection site may extend later via PD-COL-05 |
| 14 | Tenant from JWT only; server branch authz | L-ORD baseline |
| 15 | PRD binary still **NOT FOUND** in repo — **PRD FILE GAP** preserved | L-ORD-01A; discovery audit |

---

## 3. Evidence Reviewed

| Document / asset | Role |
|---|---|
| `enterprise-lms-collection-specimen-discovery-audit.md` | Primary workshop recommendations |
| `enterprise-lms-order-product-decision-closure.md` | PD-ORD-01…19; PD-ORD-17; BILL/PAY carry-forward |
| `enterprise-lms-order-domain-architecture.md` | LaboratoryApi ownership; out-of-scope Collection |
| `enterprise-lms-order-state-machine.md` | Order / OrderTest `Ordered` |
| `enterprise-lms-order-implementation-report.md` | Certified L-ORD-01B boundary |
| `enterprise-lms-order-ui-implementation-report.md` | L-ORD-01C scope / no Collection leakage |
| `enterprise-lms-next-slice-audit.md` | Sequencing; deferred PD-COL-* |
| `enterprise-lms-existing-laboratory-boundary.md` | Pathology isolation |
| `enterprise-lms-information-architecture.md` | Nav placeholders; planning entities |
| `enterprise-lms-catalogue-*` / L-CAT fields | Opaque `SpecimenTypeRef` / `ContainerRef` / logistics |
| `laboratory-management-product-owner-decision-closure.md` | PD-LAB-BILL-01 / PAY-01 |
| LaboratoryApi DbContext / Functions | No collection/specimen APIs/tables |
| FE `lms.collection.view` / `lms.specimens.view` | Planned constants only — not seeded |

**Not used as LMS SoT:** Pathology LabReport specimen fields; LabReport-root product-definition-v3 Specimen child model; general LIMS inventiveness.

---

## 4. Product Decisions — PD-COL-01 through PD-COL-20

Status legend:

| Status | Meaning |
|---|---|
| **APPROVED** | Explicitly certified in an existing decision (or immutable reaffirmation thereof) |
| **PROPOSED** | Discovery recommendation — **requires Product Owner approval** |
| **DEFERRED** | Explicitly proposed to defer from first Collection program — still needs PO confirmation of deferral |
| **REJECTED** | Explicitly rejected (none in this closure) |
| **DECISION_REQUIRED** | No safe recommendation without further PO/clinical input (used where codes/vocab missing) |

---

### PD-COL-01 — Specimen ↔ OrderTest cardinality

| Field | Content |
|---|---|
| **ID** | PD-COL-01 |
| **Title** | Specimen / OrderTest cardinality |
| **Existing evidence** | Panel → many OrderTests (PD-ORD panel explosion); do not collapse statuses (PRD-derived); PD-LAB-MULTI-01 is **legacy LabReport-track** — not Enterprise LMS cardinality approval; **PRD FILE GAP** on exact model |
| **Options** | (A) Strict 1:1 OrderTest↔Specimen (B) M:N via link entity (C) Hybrid by specimen type |
| **Discovery recommendation** | **(B) M:N** via dedicated link (supports shared draw + multi-specimen tests) |
| **Repository compatibility** | Compatible with LaboratoryApi `lms_*` style; no existing Specimen tables to conflict |
| **Risk** | Choosing 1:1 blocks shared EDTA draws; choosing M:N without link table invites denormalized corruption |
| **Final status** | **PROPOSED** |

---

### PD-COL-02 — CollectionTask grain

| Field | Content |
|---|---|
| **ID** | PD-COL-02 |
| **Title** | CollectionTask grain & create timing |
| **Existing evidence** | PD-ORD-17: Collection owns tasks; submit does not create stubs. Catalogue has opaque `SpecimenTypeRef` / `ContainerRef` / timing — **not** a certified draw-planning engine |
| **Options** | (A) Per Order (B) Per OrderTest (C) Per required specimen type / draw plan (D) Per collection event only |
| **Discovery recommendation** | **(C)** task ≈ required specimen type / collection requirement grouping, **not** blind 1:1 OrderTest |
| **Catalogue sufficiency** | **Insufficient for automatic safe derivation today.** Refs are free-text/opaque; no controlled specimen-type master, no certified “same draw group” key, no blocking logistics policy (see PD-COL-06). First slice must either: (i) PO-approved manual grouping, (ii) simple heuristic with explicit PO acceptance of limits, or (iii) wait for config masters |
| **Create timing** | **Not at submit** (PD-ORD-17). Create at planning / plan API — **PROPOSED** |
| **Risk** | Over-automating planning from opaque refs creates wrong tasks |
| **Final status** | **PROPOSED** (grain + create timing); planning algorithm detail remains **DECISION_REQUIRED** until PO accepts heuristic vs manual |

---

### PD-COL-03 — Accession timing

| Field | Content |
|---|---|
| **ID** | PD-COL-03 |
| **Title** | When accession number is assigned |
| **Existing evidence** | No LMS accession; receiving stage in IA/next-slice; legacy BC-01 is not Enterprise LMS closure |
| **Options** | (A) At collection (B) At laboratory receiving (C) Accession = specimen business number |
| **Discovery recommendation** | **(B) At receiving.** Collection uses provisional Specimen GUID (+ optional barcode/business id per PD-COL-04) — **not** accession |
| **Provisional identity before receiving** | System Specimen GUID (required if Specimen exists); optional barcode value; optional tenant business specimen number — **formats not invented here** |
| **Risk** | Accession-at-collect conflates Collection with Receiving and blocks referral receive-direct later |
| **Final status** | **PROPOSED** |

---

### PD-COL-04 — Barcode / label

| Field | Content |
|---|---|
| **ID** | PD-COL-04 |
| **Title** | Barcode generation timing; relation to accession |
| **Existing evidence** | No LMS barcode; Patient/IOL barcode UX is **YELLOW pattern only**; **PRD FILE GAP** on format |
| **Options** | (A) Pre-print (B) At collection/label print (C) At receiving (D) Same as accession |
| **Discovery recommendation** | Barcode **distinct from accession**; generatable at **label print / collection** for labeling; **format/sequence/prefix/check-digit/printer protocol = PO/config owned — not invented** |
| **Risk** | Collapsing barcode with accession; inventing GS1/lab formats without PO |
| **Final status** | **PROPOSED** (separation + timing); format = **DECISION_REQUIRED** / configuration |

---

### PD-COL-05 — Collection site

| Field | Content |
|---|---|
| **ID** | PD-COL-05 |
| **Title** | Collection site model |
| **Existing evidence** | Branch via `useBranchContext` / order OperatingBranch; PD-ORD-04 Performing=Operating; no room hierarchy in LMS |
| **Options** | (A) = Operating Branch only (B) Branch + optional location text (C) Room hierarchy (D) External/home as first-class sites |
| **Discovery recommendation** | **(B) existing Branch ID + optional free-text location** — no new org hierarchy |
| **First-slice sufficiency** | **Yes**, if PO accepts no room/bed master in L-COL-01B |
| **Risk** | Building department/room tree without platform ownership |
| **Final status** | **PROPOSED** |

---

### PD-COL-06 — Catalogue logistics (inform vs block)

| Field | Content |
|---|---|
| **ID** | PD-COL-06 |
| **Title** | Which catalogue logistics fields block collection |
| **Existing evidence** | PD-ORD-19: do not invent clinical blocking engines; L-CAT opaque refs |
| **Candidate fields** | SpecimenTypeRef, ContainerRef, RequiredVolume, PatientPreparation, CollectionTiming, StabilityNotes, temperature/light, storage, transport, RejectionCriteria |
| **Discovery recommendation** | **Informational in first Collection program**; block only if PO explicitly lists fields |
| **Risk** | Blocking on empty opaque refs freezes Collection UAT |
| **Final status** | **PROPOSED** |

---

### PD-COL-07 — Specimen birth

| Field | Content |
|---|---|
| **ID** | PD-COL-07 |
| **Title** | When Specimen row is created |
| **Existing evidence** | PD-ORD-17 forbids birth at submit; L0 IA lists Specimen as later entity |
| **Options** | (A) At task planning (B) At collection completion (C) At receiving |
| **Discovery recommendation** | **(B) At successful collection completion** → Specimen in Collected (not Received) → Receiving later |
| **Boundary with Receiving** | Clean if PD-COL-03 = accession at receive and AD-COL-02 = Specimen lifecycle owns receive transition |
| **L-COL-01B implication** | Task-only foundation **or** complete-collection creates Specimen **only if this PD is APPROVED** |
| **Final status** | **PROPOSED** |

---

### PD-COL-08 — Patient identification at collection

| Field | Content |
|---|---|
| **ID** | PD-COL-08 |
| **Title** | Minimum patient identification at collection |
| **Existing evidence** | Platform Patient validate; order snapshots; no LMS bedside scan |
| **Options** | (A) Display only (B) Confirm MRN/name/DOB vs order (C) Mandate wristband/barcode scan |
| **Discovery recommendation** | **(B) Confirm patient against order (MRN/name/DOB)**; scanning **deferred** unless PO mandates |
| **Risk** | Over-scoping mobile scanning; under-scoping identity safety |
| **Final status** | **PROPOSED** |

---

### PD-COL-09 — Collector identity

| Field | Content |
|---|---|
| **ID** | PD-COL-09 |
| **Title** | Who is recorded as collector |
| **Existing evidence** | JWT user; AuthService User validate; no LMS user master |
| **Options** | (A) Authenticated user only (B) Authenticated + optional witnessed-by (C) Free-text collector name |
| **Discovery recommendation** | **(A)** authenticated user is collector; **(B) optional witnessed-by only if PO justifies** — no new user master; no free-text as SoT |
| **Final status** | **PROPOSED** |

---

### PD-COL-10 — Collection timestamp

| Field | Content |
|---|---|
| **ID** | PD-COL-10 |
| **Title** | Authoritative collection time |
| **Existing evidence** | Server UTC used across LMS orders/catalogue |
| **Options** | (A) Client clock as SoT (B) Server UTC as SoT (C) Server UTC + optional client-observed |
| **Discovery recommendation** | **(B/C) Server UTC authoritative**; optional client-observed only if PO requires — **never client as clinical SoT** |
| **Final status** | **PROPOSED** |

---

### PD-COL-11 — Failure / rejection reasons

| Field | Content |
|---|---|
| **ID** | PD-COL-11 |
| **Title** | Reason model for unable-to-collect / reject |
| **Existing evidence** | Catalogue `RejectionCriteria` text only; **no** LMS reason-code catalogue; **PRD FILE GAP** |
| **Options** | (A) Free text only (B) Coded list only (C) Coded + optional free text |
| **Discovery recommendation** | **(C) coded + optional free text** |
| **Actual clinical codes** | **Not invented in this document** |
| **Final status** | **PROPOSED** (model); code list = **DECISION_REQUIRED / CONFIGURATION REQUIRED** |

---

### PD-COL-12 — Recollection

| Field | Content |
|---|---|
| **ID** | PD-COL-12 |
| **Title** | Recollection mechanics |
| **Existing evidence** | No Specimen domain; OrderTest remains `Ordered`; PD-LAB-SPEC-COM-01 commercial effects historically open |
| **Options** | (A) New task only (B) New Specimen only (C) New task + new Specimen; retain rejected (D) Mutate original Specimen |
| **Discovery recommendation** | **(C)** rejected Specimen **immutable**; new CollectionTask + new Specimen; explicit link to prior specimen/event |
| **OrderTest state** | Must **not** invent vocabulary here — see PD-COL-19 (**PROPOSED** future states only). Until approved, OrderTest may remain `Ordered` with recollection tracked on Collection/Specimen side |
| **Final status** | **PROPOSED** (mechanics); OrderTest transition = depends on PD-COL-19 |

---

### PD-COL-13 — Custody

| Field | Content |
|---|---|
| **ID** | PD-COL-13 |
| **Title** | Custody / specimen history model |
| **Existing evidence** | L0 planning entity `SpecimenCustodyEvent`; no implementation |
| **Options** | (A) Status fields only (B) Append-only SpecimenEvent/CustodyEvent (C) Defer history to later slice |
| **Discovery recommendation** | **(B) append-only events** as target architecture; **first Collection slice may defer full custody graph** if PO accepts status + audit_log only for L-COL-01B |
| **Final status** | **PROPOSED** (target); first-slice inclusion vs deferral = **PO choice** |

---

### PD-COL-14 — Aliquots

| Field | Content |
|---|---|
| **ID** | PD-COL-14 |
| **Title** | Aliquots in first Collection program |
| **Existing evidence** | None in LMS; not required for Order Intake |
| **Options** | (A) Include in v1 (B) Defer |
| **Discovery recommendation** | **(B) Defer** — no aliquot schema/API in first Collection program |
| **Final status** | **PROPOSED** as **DEFERRED** from first Collection program (PO must confirm deferral) |

---

### PD-COL-15 — Referral / external specimens

| Field | Content |
|---|---|
| **ID** | PD-COL-15 |
| **Title** | Receive-direct / referral specimen intake |
| **Existing evidence** | Referrals nav placeholder; no LMS referral receiving |
| **Options** | (A) Require prior CollectionTask always (B) Future receive-direct path (C) Build receive-direct in first slice |
| **Discovery recommendation** | **(B) Allow future receive-direct; exclude from first Collection implementation** |
| **Final status** | **PROPOSED** as **DEFERRED** from L-COL-01B |

---

### PD-COL-16 — Ownership / work queue

| Field | Content |
|---|---|
| **ID** | PD-COL-16 |
| **Title** | Shared queue vs individual ownership |
| **Existing evidence** | LMS Work Queue placeholder; Counsellor ownership is **pattern reference only** — must not be auto-copied; L-ORD did not introduce claim for orders |
| **Options** | (A) Shared branch-scoped queue only (B) Explicit assignment (C) Claim/release (D) Hybrid shared + optional claim/assign |
| **Discovery recommendation** | **(D) Shared branch-scoped Collection queue with optional claim/assignment** — **only if PO approves** |
| **Distinction** | **Queue visibility** (who can see tasks) ≠ **individual ownership** (who is accountable / may complete) |
| **Leave/reassignment** | **Out of first slice** unless PO explicitly approves |
| **Risk** | Premature Counsellor-style claim complexity |
| **Final status** | **PROPOSED** — **blocking** for L-COL-01B worklist semantics |

**Post–L-COL-01B refinement (discoverability):** Product Owner closed Claim/Assign interaction, Release, assignee eligibility, and related search defect rules as **PD-COL-OWN-01…05**, **PD-COL-SEARCH-01**, **PD-COL-UX-01** in  
[enterprise-lms-collection-search-ownership-decision-closure.md](./enterprise-lms-collection-search-ownership-decision-closure.md)  
(`PRODUCT_DECISIONS_CLOSED_IMPLEMENTATION_READY`). Those decisions refine PD-COL-16 for enforceable ownership semantics; they do **not** reopen Specimen/Receiving scope and do **not** by themselves accept L-COL-01B.

---

### PD-COL-17 — Permissions

| Field | Content |
|---|---|
| **ID** | PD-COL-17 |
| **Title** | Collection/Specimen permission codes |
| **Existing evidence** | FE planned `lms.collection.view`, `lms.specimens.view` only; LaboratoryAuthz has no collection codes; L-ORD pattern: define codes, **grants separate** |
| **Candidate capabilities** | `lms.collection.view`, `lms.collection.manage`, `lms.collection.collect`, `lms.specimens.view`, `lms.specimens.manage`, `lms.specimens.receive` |
| **Discovery recommendation** | Smallest server-enforced set: **view / manage / collect** for CollectionTask; **view / manage / receive** for Specimen (receive may wait until Receiving slice). **Do not seed or grant in L-COL-01A** |
| **Role mapping** | **Separate decision** (same as L-ORD) |
| **Final status** | **PROPOSED** — **blocking** for any Collection API authz |

---

### PD-COL-18 — Billing trigger semantic

| Field | Content |
|---|---|
| **ID** | PD-COL-18 |
| **Title** | Clinical event that may trigger OPD Billing handoff |
| **Existing evidence** | **PD-LAB-BILL-01 APPROVED**: normal OPD charge at specimen collection. Billing remains financial SoT. No LMS Billing integration yet |
| **Options** | (A) On collection completed (B) On receiving (C) On OrderTest state change only |
| **Discovery recommendation** | Future clinical event **`COLLECTION_COMPLETED`** (or equivalent) as the LMS signal aligned to BILL-01; **do not implement Billing**; **no payment hard block** |
| **What is already APPROVED** | Commercial principle “charge at specimen collection” (BILL-01) |
| **What remains PROPOSED** | Exact LMS event name, payload, outbox vs sync (AD-COL-07), and Finance confirmation of collect vs receive |
| **Final status** | Commercial principle **APPROVED** (BILL-01); LMS event/wiring detail **PROPOSED** |

---

### PD-COL-19 — Future OrderTest states

| Field | Content |
|---|---|
| **ID** | PD-COL-19 |
| **Title** | OrderTest vocabulary after `Ordered` |
| **Existing evidence** | Certified now: **`Ordered` only**. State machine doc lists later slices as owners of Collected/Received/… |
| **Constraint** | **Must not modify** L-ORD-01B/01C `Ordered` behavior in this gate |
| **Candidate future states (examples — not approved)** | `PendingCollection`, `Collected`, `Received`, `Rejected`, `RecollectRequested`, `InTesting` |
| **Proposed machine for PO review** | See §4.1 below |
| **Final status** | **PROPOSED** vocabulary — **not APPROVED** |

#### 4.1 Proposed OrderTest state machine (for PO review only)

```text
Ordered
  → PendingCollection     (optional; if planning creates explicit wait state)
  → Collected             (when linked Specimen reaches Collected — if PD-COL-07)
  → Received              (when Specimen received — later slice)
  → Rejected              (specimen rejected; recollection may follow)
  → RecollectRequested    (optional explicit state vs remain Rejected + new task)
  → InTesting             (Testing slice)

Invalid (examples):
  Received → Ordered
  Cancelled Order does not silently delete OrderTest history
```

**None of the above transitions are authorized for implementation.**

---

### PD-COL-20 — Payment gate at collection

| Field | Content |
|---|---|
| **ID** | PD-COL-20 |
| **Title** | Soft payment gate at collection |
| **Existing evidence** | **PD-LAB-PAY-01 APPROVED** baseline: no hard-block at order create; STAT/emergency must not be blocked merely because unpaid; collection soft-gate historically marked follow-up |
| **Options** | (A) No UX at collection (B) Warn on routine unpaid (C) Hard-block routine unpaid (D) Hard-block all including STAT |
| **Discovery recommendation** | **(B) Warn routine unpaid; never hard-block STAT**; no Billing implementation in Collection slice |
| **Final status** | PAY-01 baseline **APPROVED**; collection soft-gate UX detail **PROPOSED** |

---

## 5. Architecture Decisions — AD-COL-01 through AD-COL-10

### AD-COL-01 — Service ownership

| Field | Content |
|---|---|
| **ID** | AD-COL-01 |
| **Title** | Service owner for Collection/Specimen |
| **Options** | LaboratoryApi vs new microservice |
| **Discovery recommendation** | LaboratoryApi |
| **Repository compatibility** | Matches L-ORD/L-CAT certified ownership |
| **Final status** | **APPROVED** (reaffirmation of certified LMS architectural baseline — Collection remains in LaboratoryApi unless a later AD overturns it) |

---

### AD-COL-02 — Collection vs Receiving aggregate

| Field | Content |
|---|---|
| **ID** | AD-COL-02 |
| **Title** | Receiving ownership model |
| **Options** | (A) Separate Receiving microservice/aggregate (B) Specimen lifecycle includes receive transition (C) Separate ReceivingRecord in LaboratoryApi |
| **Discovery recommendation** | **(B)** Specimen owns collection→receiving lifecycle; **no** Receiving microservice |
| **Final status** | **PROPOSED** |

---

### AD-COL-03 — Identity model

| Field | Content |
|---|---|
| **ID** | AD-COL-03 |
| **Title** | Specimen GUID / business id / barcode / accession separation |
| **Discovery recommendation** | Keep **separate concepts**: Specimen GUID (PK); optional tenant business specimen id; barcode value; accession (timing per PD-COL-03). **Do not collapse without approval.** **Do not invent formats.** |
| **Final status** | **PROPOSED** |

---

### AD-COL-04 — Cardinality persistence

| Field | Content |
|---|---|
| **ID** | AD-COL-04 |
| **Title** | Persist Specimen↔OrderTest M:N |
| **Discovery recommendation** | Link table (e.g. conceptual `lms_specimen_order_tests`) **if PD-COL-01 APPROVED** |
| **Dependency** | Blocked on PD-COL-01 |
| **Final status** | **PROPOSED** (contingent) |

---

### AD-COL-05 — Idempotency

| Field | Content |
|---|---|
| **ID** | AD-COL-05 |
| **Title** | Idempotency for Collection mutations |
| **Discovery recommendation** | Operation-specific idempotency (plan/claim/complete/fail/receive/reject); dedicated store or prefixed shared LMS idempotency — pattern from L-ORD, not blind table reuse |
| **Final status** | **PROPOSED** |

---

### AD-COL-06 — Optimistic concurrency

| Field | Content |
|---|---|
| **ID** | AD-COL-06 |
| **Title** | Concurrency on mutable aggregates |
| **Discovery recommendation** | RowVersion (or equivalent) on CollectionTask and Specimen (and Receiving mutations) |
| **Final status** | **PROPOSED** |

---

### AD-COL-07 — Outbox / Billing handoff

| Field | Content |
|---|---|
| **ID** | AD-COL-07 |
| **Title** | Integration handoff for Billing |
| **Discovery recommendation** | Prefer outbox/domain event for `COLLECTION_COMPLETED` → Billing; sync only if platform mandates. **No Billing implementation in L-COL-01A/01B** |
| **Final status** | **PROPOSED** |

---

### AD-COL-08 — Pathology reuse

| Field | Content |
|---|---|
| **ID** | AD-COL-08 |
| **Title** | Pathology specimen fields as LMS SoT |
| **Discovery recommendation** | **Forbidden** |
| **Final status** | **APPROVED** (reaffirmation of Enterprise LMS ↔ Pathology boundary Variant B+) |

---

### AD-COL-09 — Specimen/container masters

| Field | Content |
|---|---|
| **ID** | AD-COL-09 |
| **Title** | Catalogue refs vs new LMS masters |
| **Discovery recommendation** | Start with governed catalogue opaque refs; add controlled vocab/master **only if PO approves a real gap** (ties to PD-COL-02/06) |
| **Final status** | **PROPOSED** |

---

### AD-COL-10 — Staged implementation

| Field | Content |
|---|---|
| **ID** | AD-COL-10 |
| **Title** | Implementation staging |
| **Discovery recommendation** | (1) Collection Planning / CollectionTask → (2) Collection / Specimen → (3) Receiving / Accession → (4) Testing. **Do not combine all stages.** |
| **Final status** | **PROPOSED** |

---

## 6. Final Decision Matrix

| ID | Decision | Recommendation | Status | Blocking for L-COL-01B? |
|---|---|---|---|---|
| PD-COL-01 | Specimen↔OrderTest cardinality | M:N link | **PROPOSED** | **Yes** (if Specimen in same/early slice) |
| PD-COL-02 | CollectionTask grain | Per specimen-type/draw plan; not at submit | **PROPOSED** | **Yes** |
| PD-COL-03 | Accession timing | At receiving | **PROPOSED** | Yes for identity UX; Receiving later |
| PD-COL-04 | Barcode vs accession | Separate; generate at label/collect; format PO-owned | **PROPOSED** | Format **DECISION_REQUIRED** if labels in early slice |
| PD-COL-05 | Collection site | Branch + optional location text | **PROPOSED** | **Yes** |
| PD-COL-06 | Catalogue logistics | Informational first | **PROPOSED** | Soft |
| PD-COL-07 | Specimen birth | At collection complete | **PROPOSED** | **Yes** if complete creates Specimen |
| PD-COL-08 | Patient ID | Confirm MRN/name/DOB; scan deferred | **PROPOSED** | **Yes** for complete |
| PD-COL-09 | Collector | Authenticated user | **PROPOSED** | **Yes** for complete |
| PD-COL-10 | Collection time | Server UTC SoT | **PROPOSED** | **Yes** for complete |
| PD-COL-11 | Reasons | Coded + free text; codes not invented | **PROPOSED** / codes **DECISION_REQUIRED** | Soft for fail; hard for reject |
| PD-COL-12 | Recollection | New task + new Specimen; old immutable | **PROPOSED** | Can defer past L-COL-01B |
| PD-COL-13 | Custody | Append-only target; first-slice optional | **PROPOSED** | Soft |
| PD-COL-14 | Aliquots | Defer | **PROPOSED (defer)** | No (out of scope) |
| PD-COL-15 | Referral receive-direct | Defer | **PROPOSED (defer)** | No (out of scope) |
| PD-COL-16 | Ownership | Shared queue + optional claim | **PROPOSED** | **Yes** |
| PD-COL-17 | Permissions | view/manage/collect (+ specimens.*) | **PROPOSED** | **Yes** |
| PD-COL-18 | Billing trigger | `COLLECTION_COMPLETED` signal | Principle **APPROVED** (BILL-01); event wiring **PROPOSED** | Soft for L-COL-01B |
| PD-COL-19 | OrderTest future states | Vocabulary for PO | **PROPOSED** | Soft if tasks only |
| PD-COL-20 | Payment gate at collection | Warn routine; never hard-block STAT | Baseline **APPROVED** (PAY-01); UX **PROPOSED** | Soft |
| AD-COL-01 | Service owner | LaboratoryApi | **APPROVED** (reaffirm) | — |
| AD-COL-02 | Receiving aggregate | Specimen lifecycle | **PROPOSED** | Soft for L-COL-01B |
| AD-COL-03 | Identity separation | GUID / business / barcode / accession | **PROPOSED** | **Yes** if Specimen |
| AD-COL-04 | Link table | If PD-COL-01 approved | **PROPOSED** | Contingent |
| AD-COL-05 | Idempotency | Operation-specific | **PROPOSED** | **Yes** |
| AD-COL-06 | Concurrency | RowVersion on mutables | **PROPOSED** | **Yes** |
| AD-COL-07 | Outbox/Billing | Prefer event/outbox | **PROPOSED** | Soft |
| AD-COL-08 | Pathology SoT | Forbidden | **APPROVED** (reaffirm) | — |
| AD-COL-09 | Masters | Catalogue refs first | **PROPOSED** | Soft |
| AD-COL-10 | Staging | Task → Specimen → Receiving → Testing | **PROPOSED** | **Yes** (scope control) |

**Legend reminder:** A recommendation in the “Recommendation” column is **not** an approved rule unless Status = **APPROVED**.

---

## 7. Blocking Decisions (must close before Collection implementation)

Minimum set before **any** Collection schema/API/UI:

1. **PD-COL-02** — CollectionTask grain & create timing (and planning sufficiency)  
2. **PD-COL-05** — Collection site  
3. **PD-COL-16** — Queue vs ownership  
4. **PD-COL-17** — Permission codes (not grants)  
5. **AD-COL-05** — Idempotency approach  
6. **AD-COL-06** — Concurrency approach  
7. **AD-COL-10** — Confirm staged scope for L-COL-01B  

Additionally, before Specimen creation / collection-complete:

8. **PD-COL-01** + **AD-COL-04** — Cardinality  
9. **PD-COL-07** — Specimen birth  
10. **PD-COL-03** / **PD-COL-04** / **AD-COL-03** — Identity model (at least: accession not at collect; barcode vs accession)  
11. **PD-COL-08 / 09 / 10** — Patient ID, collector, timestamp  

Already closed (do not re-open):

- **AD-COL-01**, **AD-COL-08**, **PD-ORD-17**, **PD-LAB-BILL-01**, **PD-LAB-PAY-01** baseline  

---

## 8. Deferred Decisions / Scope

| Item | Treatment |
|---|---|
| PD-COL-14 Aliquots | Proposed defer from first Collection program |
| PD-COL-15 Referral receive-direct | Proposed defer from L-COL-01B |
| Full custody event graph (PD-COL-13) | May defer if PO accepts audit_log + status for L-COL-01B |
| Recollection (PD-COL-12) | May follow first collect UAT |
| Barcode format / printers | Configuration after PD-COL-04 timing approved |
| Reason-code catalogue (PD-COL-11) | Configuration / clinical ownership |
| Production role grants | Separate decision (L-ORD pattern) |
| Billing integration code | After PD-COL-18 event wiring approved |
| OrderTest state rename/expansion | After PD-COL-19 approved — **Ordered remains until then** |

---

## 9. Impact on Future Data Model (Conceptual Only)

**No migrations. No tables created by this document.**

If PO approves the recommendations, eventual LaboratoryApi-owned candidates may include:

| Conceptual entity | Depends on |
|---|---|
| `CollectionTask` | PD-COL-02, 05, 16, 17; AD-COL-01, 05, 06 |
| `Specimen` | PD-COL-07, 03, 04; AD-COL-03 |
| `SpecimenOrderTest` (link) | PD-COL-01; AD-COL-04 |
| `SpecimenEvent` / custody | PD-COL-13 |
| Idempotency store | AD-COL-05 |

**Must not appear at Order submit** (PD-ORD-17).

---

## 10. Impact on Future API (Proposal Only)

Future LaboratoryApi routes under `/api/lms/collection/*` and `/api/lms/specimens/*` as sketched in the discovery audit — **not authorized**. Permissions per PD-COL-17. Idempotency/concurrency per AD-COL-05/06.

---

## 11. Impact on Future UX (Proposal Only)

| Surface | After approvals |
|---|---|
| `/dashboard/lms/collection` | Worklist + task detail (replace placeholder) |
| Patient confirm step | PD-COL-08 |
| Claim/assign controls | Only if PD-COL-16 approves |
| Specimens / Receiving | Later stages per AD-COL-10 |
| Orders UI | Read-only status links later — **no L-ORD rewrite now** |

---

## 12. Future Implementation Sequence

| Step | Slice | Status |
|---|---|---|
| 0 | **L-COL-01A** Decision closure (this document) | **AWAITING PO APPROVAL** |
| 1 | **L-COL-01B** Collection Planning + CollectionTask foundation | **NOT AUTHORIZED** |
| 2 | Collection complete ± Specimen (if PD-COL-07 approved) | Later |
| 3 | Receiving / Accession | Later |
| 4 | Testing | Later |

### L-COL-01B candidate scope (after PO gate — still not authorized)

- Input: Submitted OrderTests (`Ordered`)  
- Collection planning + CollectionTask create (not at Order submit)  
- Branch-scoped worklist  
- Task detail + task state machine  
- Claim/assignment **only if PD-COL-16 APPROVED**  
- Audit, idempotency, optimistic concurrency  
- Specimen at complete **only if PD-COL-07 APPROVED**  
- **No** Receiving, accession assignment, aliquots, referral receive-direct, Billing posting, Pathology  

---

## 13. Risks

| Risk | Mitigation |
|---|---|
| Treating this document’s recommendations as approved | Status column; gate = PO approval |
| Implementing before blocking PDs close | Explicit blocking list §7 |
| Pathology as SoT | AD-COL-08 APPROVED reaffirmation |
| Inventing barcode/reason codes | Explicitly forbidden; DECISION_REQUIRED |
| Catalogue opaque refs used as automatic planner | PD-COL-02 insufficiency called out |
| Scope explosion | AD-COL-10 staging |
| Changing OrderTest/`Ordered` early | PD-COL-19 PROPOSED only |

---

## 14. Explicit Out-of-Scope (This Gate)

- Collection / Specimen / Receiving / Accession / Barcode / Label / Custody / Recollection / Aliquot / Referral receiving implementation  
- Database tables, migrations, APIs, frontend  
- Permission seeding, role grants  
- Billing integration  
- Testing / Results / Reporting / QC  
- Pathology changes or sync  
- Orders / Catalogue certified behavior changes  
- Invented clinical reason codes or barcode formats  

---

## 15. Approval Gate

### Final gate status

# READY_FOR_PRODUCT_OWNER_APPROVAL

**Not** `READY_FOR_IMPLEMENTATION`.

**Product Owner must:**

1. Approve, modify, defer, or reject each **PROPOSED** PD-COL / AD-COL item.  
2. Close the **blocking** set in §7 before authorizing L-COL-01B.  
3. Confirm deferrals (PD-COL-14, PD-COL-15, and any first-slice custody deferral).  
4. Own barcode format and rejection reason-code configuration (not invented by engineering).  

Until that closure is recorded, **no Collection/Specimen implementation is permitted**.

---

## 16. Implementation Discipline Confirmation

| Check | Confirmed |
|---|---|
| Only this decision-closure document was added | **Yes** |
| No source code changed | **Yes** |
| No database schema changed | **Yes** |
| No migration created | **Yes** |
| No API created | **Yes** |
| No frontend changed | **Yes** |
| No permission definitions seeded | **Yes** |
| No role grants changed | **Yes** |
| No Pathology changed | **Yes** |
| No Orders changed | **Yes** |
| No Catalogue changed | **Yes** |
| No Collection implemented | **Yes** |
| No Specimen implemented | **Yes** |
| No Receiving implemented | **Yes** |
| Recommendations not auto-marked APPROVED | **Yes** |
| L-ORD-01B remains authoritative | **Yes** |
| L-ORD-01C remains accepted | **Yes** |

---

**STOP.** Await Product Owner decision closure before any L-COL-01B authorization.
