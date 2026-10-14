# L-COL-01D — Specimen Receiving & Accession  
# Discovery Audit + Product / Architecture Decision Closure Package

**Date:** 2026-10-10  
**Slice:** L-COL-01D (Receiving & Accession — discovery / product decision only)  
**Mode:** DOCUMENTATION ONLY — no application source, schema, migrations, APIs, UI, permissions seeding/grants, Specimen/Collection/Order/Catalogue/Pathology/Billing behavior changes  
**Authoritative prior Specimen/Receiving closure:** [enterprise-lms-specimen-receiving-decision-closure.md](./enterprise-lms-specimen-receiving-decision-closure.md) (`PRODUCT_DECISIONS_CLOSED_L_COL_01C_AUTHORIZED`)  
**PRD/BRD file:** `enterprise_laboratory_management_system_prd_brd.docx` — **not found in repository** at audit time (**PRD FILE GAP**); decisions below cite certified LMS closures and implemented code, not invented PRD clauses

```text
L0 · L-CAT-01B · L-ORD-01B · L-ORD-01C · L-COL-01B ACCEPTED
  → L-COL-01C Specimen Foundation + Complete Collection (UAT / PO gate)
  → THIS DOCUMENT: L-COL-01D Receiving & Accession discovery
  → STOP — await Product Owner decision closure
  → (later) authorized L-COL-01D implementation task — NOT this document
```

---

## 1. Status / gate

| Field | Value |
|---|---|
| **Document status** | `READY_FOR_PRODUCT_OWNER_APPROVAL` |
| **Implementation** | **NO IMPLEMENTATION PERFORMED** |
| **Blocking condition** | Multiple **DECISION_REQUIRED** items (§24) must be closed before L-COL-01D may be authorized for implementation |
| **Next gate** | **STOP — await Product Owner decision closure** |

Do **not** treat PROPOSED recommendations as APPROVED.  
Do **not** revive older workshop **PROPOSED** items as open if the L-COL-01A Specimen/Receiving closure already **APPROVED** or **DEFERRED** them — those are restated as certified constraints below.

---

## 2. Executive summary

Enterprise LMS Specimen SoT today ends at:

```text
CollectionTask Completed  +  Complete Collection  →  Specimen (GUID, Collected)
```

Certified constraints (must not change):

- CollectionTask lifecycle and ownership unchanged  
- Complete Collection does not mutate CollectionTask / Order / OrderTest  
- Specimen identity = immutable GUID; accession / barcode / human business id deferred from L-COL-01C  
- Accession belongs to Receiving (PD-COL-SPC-04 **APPROVED**)  
- LaboratoryApi owns Specimen and Receiving; no Receiving microservice (PD-COL-SPC-17 / AD-COL-SPC-01)  
- `lms.specimens.receive` is **defined only** and unused  
- Pathology `/dashboard/laboratory` is **not** LMS Specimen SoT  

Repository audit confirms: **no** Received/Rejected states, accession/barcode columns, receive APIs, or Specimen worklist. Specimens UI remains an informational landing + read-only detail.

**L-COL-01D cannot be safely implemented** until Product Owner closes receiving eligibility, rejection, receiving site/location, accession uniqueness/numbering, barcode slice boundary, permissions composition, ownership/claim for the receive queue, reversal, and worklist scope.

---

## 3. Source documents reviewed

| Document | Role |
|---|---|
| `enterprise-lms-specimen-receiving-decision-closure.md` | **Authoritative** Specimen/Receiving closure (PD-COL-SPC-* / AD-COL-SPC-*) |
| `enterprise-lms-collection-task-acceptance-closure.md` | L-COL-01B ACCEPTED |
| `enterprise-lms-collection-task-final-uat-audit.md` | L-COL-01B UAT SoT |
| `enterprise-lms-specimen-foundation-implementation-report.md` | L-COL-01C implemented behavior |
| `enterprise-lms-specimen-foundation-authorization-decision.md` | Complete Collection authz C/V2 |
| `enterprise-lms-specimen-foundation-pre-uat-verification.md` | Pre-UAT branch/location |
| `enterprise-lms-specimen-foundation-uat-404-correction-report.md` | Stale host 404 correction |
| `enterprise-lms-specimen-foundation-final-uat-ui-corrections-report.md` | Final UI corrections |
| `enterprise-lms-collection-specimen-decision-closure.md` | Historical workshop (superseded where conflicting) |
| `enterprise-lms-collection-specimen-discovery-audit.md` | Historical discovery (recommendations ≠ approved) |
| `enterprise_laboratory_management_system_prd_brd.docx` | **FILE GAP** — not present in repo at audit |

---

## 4. Repository audit findings

### 4.1 LaboratoryApi Specimen foundation (as implemented)

| Area | Finding |
|---|---|
| Tables | `lms_specimens`, `lms_specimen_order_tests`, `lms_specimen_idempotency` |
| Status enum | **`Collected` only** (`SpecimenStatuses`) |
| Identity | Immutable Specimen GUID; **no** accession / barcode / business specimen id columns |
| Uniqueness | Unique `(tenant_id, collection_task_id)` — one Specimen per CollectionTask |
| Link | M:N-capable via `lms_specimen_order_tests`; unique `(specimen_id, order_test_id)` only |
| Mutation | Sole mutation: Complete Collection |
| Reads | `GET /lms/specimens/{id}`, `GET /lms/specimens/by-collection-task/{id}` |
| List/search API | **None** |
| Receive/reject/accession APIs | **None** |

### 4.2 Complete Collection (certified behavior)

1. Auth: `lms.specimens.manage` **AND** `lms.collection.collect`  
2. Patient identity confirmed  
3. Task `Completed`; optional CollectionTask row-version concurrency  
4. Branch: actor authorized for `CollectionTask.CollectionBranchId` via AuthService `validate-user-branch`  
5. Order `Submitted`; OrderTests `Ordered`  
6. Creates Specimen `Collected`; copies branch + `LocationText` from task; server UTC `CollectedAt`  
7. Does **not** change CollectionTask / Order / OrderTest  
8. Specimen-specific idempotency + fail-closed audit (`CREATE_SPECIMEN`, `COMPLETE_COLLECTION`)

### 4.3 CollectionTask / Orders

| Domain | Relevant fact |
|---|---|
| CollectionTask | `Planned → Ready → InProgress → Completed` (+ Cancelled); Completed terminal; no Specimen |
| Order | `Draft / Submitted / Cancelled` |
| OrderTest | **`Ordered` only** in runtime; Complete Collection forbids non-Ordered tests |

### 4.4 Catalogue logistics

Opaque / free-text on catalogue versions: `SpecimenTypeRef`, `ContainerRef`, `RejectionCriteria`, storage/transport notes. **No** governed rejection-reason master. **AD-COL-SPC-09 APPROVED:** remain opaque until logistics master approved.

### 4.5 Frontend Specimens

| Surface | State |
|---|---|
| `/dashboard/lms/specimens` | Informational landing (L-COL-01C honest copy) — **must remain unchanged by this audit** |
| `/dashboard/lms/specimens/[id]` | Read-only detail |
| Nav | Specimens item under Laboratory Management |
| Worklist | **None** |

### 4.6 Pathology / legacy search

Pathology `/dashboard/laboratory`, AuthService laboratory catalog specimen **options**, LabReport specimen type strings: **RED** — separate SoT; not LMS Receiving.

### 4.7 Keyword search (LMS paths)

Hits for receive/accession/barcode are permission constants, exclusion copy, and tests asserting absence. **No** executable LMS Receiving workflow.

---

## 5. Existing implementation inventory

| Component | Path (representative) | Role for L-COL-01D |
|---|---|---|
| `LmsSpecimen` | `LaboratoryApi/Domain/LmsSpecimen.cs` | Extend state / receive fields later |
| `SpecimenService` | `LaboratoryApi/Services/SpecimenService.cs` | Pattern host for receive mutation |
| `SpecimenFunctions` | `LaboratoryApi/Functions/SpecimenFunctions.cs` | Route host |
| `LaboratoryAuthz.SpecimensReceive` | `LaboratoryAuthz.cs` | Unused gate candidate |
| Idempotency store | `lms_specimen_idempotency` | Reuse pattern (new operation names) |
| Branch validate | `PlatformReferenceClient.ValidateUserBranchAsync` | Reuse |
| Permission catalog | `EnterpriseLmsSpecimenPermissionCatalog` | `receive` definition exists |
| Audit allowlist | `InternalAuditController` | Needs future receive/reject/accession actions |
| Collection workbench | `CollectionWorkbench.tsx` + list APIs | **Template** for future Specimen queue |
| Specimens landing | `app/dashboard/lms/specimens/page.tsx` | Unchanged until authorized UI slice |

---

## 6. GREEN / YELLOW / RED reuse classification

| Asset | Class | Notes |
|---|---|---|
| LaboratoryApi ownership of Specimen | **GREEN** | AD-COL-SPC-01 |
| Specimen idempotency Claim→mutate→Complete pattern | **GREEN** | New operation keys for receive |
| Optimistic `RowVersion` on Specimen | **GREEN** | AD-COL-SPC-06 |
| Fail-closed platform `audit_log` | **GREEN** | New actions later |
| `validate-user-branch` | **GREEN** | Receiving branch rule still **DECISION_REQUIRED** |
| `HasAll` / `ForbidUnlessAllAsync` | **GREEN** | For multi-permission receive gates if PO requires |
| Collection worklist FE/BE patterns | **GREEN** | UX/API template only |
| Seeded `lms.specimens.receive` code | **YELLOW** | Defined; unused; no role grants |
| Catalogue `RejectionCriteria` text | **YELLOW** | Guidance only — not reason-code SoT |
| OrderTest remains `Ordered` after collect | **YELLOW** | Whether receive may change OT = **DECISION_REQUIRED** |
| Pathology specimen options / LabReport / `/dashboard/laboratory` | **RED** | Must remain separate |
| Invented accession formats / reject codes | **RED** | Forbidden without PO / configuration SoT |
| Separate Receiving microservice | **RED** | Explicitly rejected (AD-COL-SPC-11) |

---

## 7. Certified upstream constraints (must not change)

| ID / source | Constraint |
|---|---|
| L-COL-01B | CollectionTask lifecycle & ownership unchanged |
| L-COL-01C | Complete Collection → Specimen Collected only |
| PD-COL-SPC-02 | Specimen birth only via Complete Collection on eligible Completed task |
| PD-COL-SPC-03 | GUID ≠ business id ≠ barcode ≠ accession |
| PD-COL-SPC-04 | Accession at Receiving, not collection |
| PD-COL-SPC-05 | Barcode ≠ accession; barcode/labels deferred from 01C |
| PD-COL-SPC-11 | Specimens immutable; recollection = new task + new Specimen |
| PD-COL-SPC-15 | No Specimen Claim/Assign in 01C; custody later |
| PD-COL-SPC-16 | Permission **definitions** only; no role grants in decision tasks |
| PD-COL-SPC-17 / AD-COL-SPC-01 | LaboratoryApi owns Receiving |
| PD-COL-SPC-18 | Received / Rejected deferred until Receiving slice |
| PD-COL-SPC-22 / PD-LAB-BILL-01 | Charge principle = specimen collection; no Billing in Specimen slices unless separately approved |
| AD-COL-SPC-08 | Pathology not LMS Specimen SoT |
| Authz C/V2 | Complete Collection manage∧collect; read view∨manage; receive **not** used for collect |

---

## 8. Receiving boundary

### 8.1 Meanings (certified + proposed)

| Term | Meaning | Status |
|---|---|---|
| **Collected** | Physical sample recorded via Complete Collection; Specimen GUID exists; **not** laboratory-accepted | **APPROVED** (L-COL-01C / PD-COL-SPC-18) |
| **Received** | Laboratory acknowledges physical custody / intake of an existing Collected Specimen | **PROPOSED** for L-COL-01D (state not yet in code) |
| **Accession** | Human/business laboratory identifier assigned at Receiving | **APPROVED** timing (PD-COL-SPC-04); format **DECISION_REQUIRED** |

### 8.2 Boundary questions

| Question | Finding | Status |
|---|---|---|
| Is Receiving a transition on existing Specimen? | Preferred by AD-COL-SPC (Specimen lifecycle owns receive); workshop AD-COL-02 → closed as LaboratoryApi Specimen ownership | **PROPOSED** confirm: mutation on `LmsSpecimen`, not new microservice |
| May receive only Collected? | Logical eligibility for first receive | **PROPOSED** — Collected → Received only |
| Specimen-level vs task-level? | One Specimen per CollectionTask today; receive should be **specimen-level** | **PROPOSED** |
| Batch receive multiple specimens? | No certified rule | **DECISION_REQUIRED** |
| Receive at branch ≠ collection branch? | No certified rule | **DECISION_REQUIRED** |
| Receiving location required? | Collection has optional `LocationText`; receiving location unknown | **DECISION_REQUIRED** |
| Receiver identity | Mirror collector: authenticated platform user | **PROPOSED** |
| Server timestamp | Server UTC authoritative (mirror PD-COL-SPC-09) | **PROPOSED** |
| Patient identity at receive | Collection requires confirmation; receive re-confirm? | **DECISION_REQUIRED** |
| Order / OrderTest validation | Collect requires Submitted + Ordered; receive re-validate? OT state change? | **DECISION_REQUIRED** |
| Unacceptable specimens | Rejection path / codes | **DECISION_REQUIRED** / **CONFIGURATION_REQUIRED** — **do not invent codes** |

```text
Collection (Complete Collection)
    → Specimen Collected
        → Receiving (laboratory intake)   ← L-COL-01D candidate
            → Accession (on successful receive — timing APPROVED at Receiving)
                → Testing (later)
```

---

## 9. Accession boundary

| Topic | Evidence | Status |
|---|---|---|
| Generated at successful receipt? | PD-COL-SPC-04: accession at Receiving | **APPROVED** (timing) |
| Before vs after validation? | Not specified | **DECISION_REQUIRED** — propose: only after successful receive validation |
| Globally unique vs scoped? | Not specified; PRD FILE GAP | **DECISION_REQUIRED** |
| Uniqueness boundary | Tenant? site? branch? day? section? | **DECISION_REQUIRED** |
| Immutable after creation? | Identity separation implies yes once issued | **PROPOSED** |
| Separate from GUID / barcode | AD-COL-SPC-03 **APPROVED** | **APPROVED** |
| Configurable sequence / format / prefix / check digit | Explicitly not invented in 01C | **DECISION_REQUIRED** / **CONFIGURATION_REQUIRED** |
| Numbering per tenant/site/branch/year/day/section | No certified config | **DECISION_REQUIRED** |

**Engineering must not choose an accession format** without PO approval or an existing certified configuration source.

---

## 10. Barcode / label boundary

| Topic | Recommendation | Status |
|---|---|---|
| barcode ≠ accession | Already **APPROVED** (PD-COL-SPC-05 / AD-COL-SPC-03) | **APPROVED** |
| Identity / printing / reprint / printers / templates / symbology / check digits / duplicate / replacement | No LMS implementation; PRD FILE GAP | **DEFERRED** from L-COL-01D |

### Slice recommendation

| Option | Recommendation |
|---|---|
| A. Part of L-COL-01D | **Not recommended** — expands identity, hardware, and print ops beyond Receiving/Accession core |
| **B. Separate L-COL-01E** | **Recommended** — keep Receiving + accession decision closed first; barcode/labels as bounded follow-on |
| C. Configurable future capability | Acceptable packaging of B |

**Rationale:** Certified closure already deferred barcode/labels from Specimen foundation; accession is the Receiving identity; barcode is a separate physical labeling concern with printer/template/symbology decisions that must not block laboratory receive/accession.

---

## 11. Receiving state machine proposal

### 11.1 Minimum analysis

```text
Collected  →  Received     (successful laboratory receive)
Collected  →  Rejected     (if rejection approved for L-COL-01D)
```

| Topic | Proposal | Status |
|---|---|---|
| Received non-terminal toward Testing | Later Testing owns further states | **PROPOSED** |
| Rejected terminal for that Specimen | Aligns with Specimen immutability + new Specimen for recollection (PD-COL-SPC-11) | **PROPOSED** if Rejected included |
| Received reversible? | No certified rule | **DECISION_REQUIRED** |
| Rejected reprocess same Specimen? | Prefer no — recollection creates new Specimen | **PROPOSED** (mechanics already APPROVED for recollection) |
| Reason/evidence on reject | Required if Rejected exists | **DECISION_REQUIRED** + reason catalogue **CONFIGURATION_REQUIRED** |
| Include Rejected in L-COL-01D? | Workshop listed it; codes missing | **DECISION_REQUIRED** — option: success-path Received only first (mirror PD-COL-SPC-10 pattern) |

**Do not invent transitions unsupported by sources.** Minimum safe proposal for PO:

- **Must have:** Collected → Received (server-enforced)  
- **Optional in same slice:** Collected → Rejected (only if PO approves + configuration source for reasons)

---

## 12. Worklist / UI product analysis

Current `/dashboard/lms/specimens` landing is **acceptable for L-COL-01C** and **unchanged by this audit**.

### Future Specimen workspace (once Receiving authorized)

| Capability | Classification | Basis |
|---|---|---|
| Specimen worklist (authoritative receive queue) | **REQUIRED** (for operational Receiving) | Specimens nav exists; Collection worklist pattern; receive needs queue |
| Search (specimen GUID) | **REQUIRED** | Immutable identity exists |
| Accession search | **REQUIRED** after accession exists | PD-COL-SPC-04 |
| Status filter (Collected / Received / …) | **REQUIRED** | State machine |
| Branch/site filter | **SHOULD** | Branch-scoped ops elsewhere |
| Patient search (MRN/name via snapshots) | **SHOULD** | Operational find |
| Order search (order number) | **SHOULD** | Operational find |
| Collection datetime filter | **SHOULD** | Ops triage |
| Receiving status / location columns | **SHOULD** if receive location approved | Depends PD-COL-REC-07 |
| Age/TAT indicators | **DEFERRED** | Do not invent KPIs |
| Detail panel/page | **REQUIRED** | Existing detail route — extend |
| Receiving action from worklist/detail | **REQUIRED** for L-COL-01D UI | Product slice |
| Barcode scan column | **DEFERRED** | L-COL-01E |

**Authoritative receive queue:** **PROPOSED** — future Specimens worklist becomes the operational queue for Collected awaiting receive (Collection workbench remains CollectionTask planning/collect ownership, not Receiving).

---

## 13. Ownership analysis

| Concept | CollectionTask (certified) | Specimen Receiving |
|---|---|---|
| Visibility | Branch-scoped list | **DECISION_REQUIRED** |
| Operational permission | collect / manage | `lms.specimens.receive` (+?) |
| Ownership (claim/assign) | PD-COL-OWN-* | **No** Specimen Claim/Assign in 01C (PD-COL-SPC-15) |
| Custody responsibility | N/A | **DEFERRED** (PD-COL-SPC-12) |

| Option | Status |
|---|---|
| Shared queue only (no claim) | **PROPOSED** default for first Receiving UI |
| Claim / assignment / section ownership | **DECISION_REQUIRED** — do not invent Counsellor-style claim |
| Custody graph | **DEFERRED** (already) |

---

## 14. Permission analysis

| Code | Today | Receiving use |
|---|---|---|
| `lms.specimens.view` | Read | View worklist/detail |
| `lms.specimens.manage` | Complete Collection (with collect) | **DECISION_REQUIRED** whether manage may receive |
| `lms.specimens.receive` | Defined, unused | Primary receive candidate |
| `lms.collection.*` | Unchanged | Must not be redefined for Receiving |

| Question | Status |
|---|---|
| Who can view? | view ∨ manage (**APPROVED** V2 pattern for read) — confirm for worklist |
| Who can receive? | **DECISION_REQUIRED** — propose `lms.specimens.receive` alone **or** receive∧manage |
| Who can reject? | **DECISION_REQUIRED** (may equal receive or stricter) |
| Who can reverse/correct? | **DECISION_REQUIRED** |
| Who generates accession? | Implicit with successful receive if accession-at-receive — **PROPOSED** |
| Reprint labels | **DEFERRED** (L-COL-01E) |
| Branch authorization required? | **PROPOSED** yes — which branch ID **DECISION_REQUIRED** |
| Combine with another capability? | Mirror Complete Collection AND pattern? **DECISION_REQUIRED** |

**No role grants / seeding in this task.** Additional codes (e.g. `lms.specimens.reject`) only as **implementation candidates** if PO requires separation.

---

## 15. Tenant / branch authorization analysis

| Rule | Status |
|---|---|
| JWT tenant isolation | **APPROVED** pattern — retain |
| Empty branch rejected | Retain pattern |
| Validate actor against **collection** branch at receive | **PROPOSED** option A |
| Validate against **receiving** branch (possibly different) | **PROPOSED** option B — needs PD-COL-REC-06 |
| Cross-branch receive allowed? | **DECISION_REQUIRED** |

---

## 16. Idempotency / concurrency analysis

Reuse LMS Specimen patterns (**APPROVED** PD-COL-SPC-19/20):

| Concern | Proposal | Status |
|---|---|---|
| Operation-specific idempotency | New operations e.g. `receive_specimen`, `reject_specimen` | **PROPOSED** |
| Request hash | Include specimen id, expected row version, outcome, location/branch fields | **PROPOSED** |
| Duplicate receive | Same key+hash → replay; already Received → conflict or idempotent replay | **DECISION_REQUIRED** semantics detail |
| Concurrent receive | Specimen `ExpectedRowVersion` → 409 `concurrency_conflict` | **PROPOSED** |
| Concurrent accession generation | Sequence allocation inside same transaction as receive | **PROPOSED** + uniqueness **DECISION_REQUIRED** |
| 409 codes | Align with existing `concurrency_conflict` / `idempotency_conflict` | **PROPOSED** |

---

## 17. Audit analysis

Platform `audit_log` remains sole SoT (PD-COL-SPC-21). **No allowlist entries in this task.**

| Conceptual action | When | Notes |
|---|---|---|
| `RECEIVE_SPECIMEN` | Successful receive | Actor, tenant, branch, specimen id, accession?, outcome |
| `REJECT_SPECIMEN` | If rejection approved | Reason required |
| `CREATE_ACCESSION` | If accession distinct event vs embedded in receive | **DECISION_REQUIRED** whether separate action |
| Correction/reversal | If permitted | Reason + policy |
| Label generate/reprint | L-COL-01E | Deferred |

Each event should capture: actor, authority, tenant, branch, object, action, reason (when required), policy, source, outcome — fail-closed LMS mutation pattern.

---

## 18. Billing boundary

| Rule | Status |
|---|---|
| PD-LAB-BILL-01 charge principle = specimen collection | **APPROVED** upstream |
| Receiving commercial implications | **None for L-COL-01D implementation** — **PROPOSED** no Finance mutation |
| Future event/outbox | **DEFERRED** documentation only (AD-COL-SPC-12) |

Receiving must not post charges or look commercially successful on Finance failure.

---

## 19. Integration / event analysis

| Integration | Status |
|---|---|
| Testing handoff | Later slice; Received (+ accession) is precondition candidate |
| Pathology sync | **Forbidden** as SoT |
| Billing outbox | **DEFERRED** |
| SignalR receive queue | Optional later; Collection uses existing patterns — **DEFERRED** unless PO requires realtime |

---

## 20. Test strategy for future implementation (matrix only — do not write tests now)

| Case | Coverage |
|---|---|
| Happy path Collected → Received (+ accession if approved) | API + service |
| Invalid state (not Collected) | 4xx |
| Duplicate receive | Idempotent / conflict |
| Concurrent receive | 409 |
| Wrong tenant | 404/403 pattern |
| Wrong branch | 403 `branch_unauthorized` |
| Insufficient permission | 403 |
| Unauthorized receiving location/branch | 403 |
| Identity mismatch (if confirm required) | 400 |
| Rejection path | If approved |
| Accession uniqueness | Concurrent + duplicate |
| Audit failure | 503 fail-closed |
| Idempotency conflict | 409 |
| L-COL-01C regression | Complete Collection unchanged |
| L-COL-01B regression | CollectionTask lifecycle/ownership |
| L-ORD regression | Order/OrderTest states |
| Pathology regression | No LMS coupling |

---

## 21. Product Decision Register (PD-COL-REC-*)

Statuses: **APPROVED** (already certified) · **PROPOSED** · **DEFERRED** · **DECISION_REQUIRED** · **REJECTED**

| ID | Topic | Status | Notes |
|---|---|---|---|
| PD-COL-REC-01 | Receiving trigger | **PROPOSED** | Explicit receive mutation on Specimen; not automatic on Complete Collection |
| PD-COL-REC-02 | Receiving eligibility | **PROPOSED** / details **DECISION_REQUIRED** | At least: status Collected; Order still Submitted?; OT still Ordered? |
| PD-COL-REC-03 | Receiving state | **PROPOSED** | Introduce `Received` |
| PD-COL-REC-04 | Rejection state | **DECISION_REQUIRED** | Include Rejected in 01D vs success-path only |
| PD-COL-REC-05 | Rejection reasons | **DECISION_REQUIRED** / **CONFIGURATION_REQUIRED** | Do not invent codes; catalogue text ≠ SoT |
| PD-COL-REC-06 | Receiving branch/site | **DECISION_REQUIRED** | Same as collection vs selectable receiving branch |
| PD-COL-REC-07 | Receiving location | **DECISION_REQUIRED** | Required free-text / optional / none |
| PD-COL-REC-08 | Receiver identity | **PROPOSED** | Authenticated platform user |
| PD-COL-REC-09 | Patient identity verification | **DECISION_REQUIRED** | Confirm again vs inherit collect confirmation |
| PD-COL-REC-10 | Accession timing | **APPROVED** (PD-COL-SPC-04) | At Receiving; detail before/after validation **DECISION_REQUIRED** |
| PD-COL-REC-11 | Accession uniqueness scope | **DECISION_REQUIRED** | |
| PD-COL-REC-12 | Accession numbering configuration | **DECISION_REQUIRED** | Format/prefix/check digit/period — no invention |
| PD-COL-REC-13 | Barcode boundary | **APPROVED** ≠ accession; impl **DEFERRED** → recommend **L-COL-01E** | |
| PD-COL-REC-14 | Label boundary | **DEFERRED** → **L-COL-01E** | |
| PD-COL-REC-15 | Duplicate receipt | **PROPOSED** pattern / exact UX **DECISION_REQUIRED** | |
| PD-COL-REC-16 | Concurrency | **APPROVED** pattern (RowVersion) | Apply to receive |
| PD-COL-REC-17 | Idempotency | **APPROVED** pattern | New operation names |
| PD-COL-REC-18 | Audit | **APPROVED** pattern | New actions at impl |
| PD-COL-REC-19 | Receiving permissions | **DECISION_REQUIRED** | How to use `lms.specimens.receive` |
| PD-COL-REC-20 | Ownership / claim / assignment | **DECISION_REQUIRED** | Default PROPOSED: shared queue only |
| PD-COL-REC-21 | Reversal/correction | **DECISION_REQUIRED** | |
| PD-COL-REC-22 | Recollection interaction | **APPROVED** mechanics (PD-COL-SPC-11); UX **DEFERRED** | Rejected → new task/specimen |
| PD-COL-REC-23 | Billing boundary | **APPROVED** (no Billing in Receiving) | |
| PD-COL-REC-24 | Specimen worklist | **PROPOSED** as future authoritative receive queue | Columns §12 |

**REJECTED:** Receiving microservice; Pathology as Specimen SoT; inventing accession formats or rejection code catalogues in engineering.

---

## 22. Architecture Decision Register (AD-COL-REC-*)

| ID | Decision | Status | Rationale |
|---|---|---|---|
| AD-COL-REC-01 | LaboratoryApi owns Receiving | **APPROVED** (AD-COL-SPC-01) | No new service |
| AD-COL-REC-02 | PostgreSQL `lms_*` tables | **APPROVED** (AD-COL-SPC-02) | Shared `hospitalportal` |
| AD-COL-REC-03 | Specimen state persistence on `lms_specimens` | **PROPOSED** | Received/Rejected columns/enum when approved |
| AD-COL-REC-04 | Accession sequence persistence | **DECISION_REQUIRED** | Table/config ownership TBD after uniqueness/format |
| AD-COL-REC-05 | Transaction boundary | **PROPOSED** | Receive + accession + audit in one fail-closed unit |
| AD-COL-REC-06 | Idempotency | **APPROVED** pattern | Specimen store / new ops |
| AD-COL-REC-07 | Optimistic concurrency | **APPROVED** pattern | Specimen RowVersion |
| AD-COL-REC-08 | Audit | **APPROVED** pattern | Platform audit_log |
| AD-COL-REC-09 | Branch authorization | **PROPOSED** reuse validate-user-branch | Branch ID rules need PO |
| AD-COL-REC-10 | Configuration ownership | **DECISION_REQUIRED** | Accession + reject reasons config SoT |
| AD-COL-REC-11 | Event/outbox | **DEFERRED** | Billing/Testing later |
| AD-COL-REC-12 | Future Testing integration | **DEFERRED** | Received (+ accession) as precondition candidate |
| AD-COL-REC-13 | No Receiving microservice | **APPROVED** (AD-COL-SPC-11) | |
| AD-COL-REC-14 | AuthService remains permission/audit/branch owner | **APPROVED** pattern | No Auth ownership rewrite |

---

## 23. Explicit deferred items

- Barcode generation, labels, printers, templates, symbology (recommend **L-COL-01E**)  
- Human/business specimen id (if still distinct from accession)  
- Custody graph / chain of custody  
- Aliquots  
- Referral / receive-direct external specimens (PD-COL-SPC-14)  
- Specimen Claim/Assign (unless PO opens PD-COL-REC-20)  
- Testing / Results / Verification / Authorization / Reporting  
- Billing posting / Finance mutations  
- Production role grants  
- KPI/TAT dashboards  
- Pathology migration  
- OrderTest state machine expansion (unless PO explicitly opens it for Receiving)

---

## 24. Explicit unresolved / DECISION_REQUIRED items (blocking)

1. **PD-COL-REC-04/05** — Rejection in L-COL-01D? Reason catalogue source?  
2. **PD-COL-REC-06/07** — Receiving branch vs collection branch; location required?  
3. **PD-COL-REC-09** — Patient identity re-confirmation at receive?  
4. **PD-COL-REC-02** — Order/OrderTest re-validation and whether any OT state change is allowed  
5. **PD-COL-REC-10 detail / 11 / 12** — Accession after validation; uniqueness scope; numbering configuration  
6. **PD-COL-REC-19** — Exact permission composition for receive (and reject)  
7. **PD-COL-REC-20** — Shared queue only vs claim/assign  
8. **PD-COL-REC-21** — Reversal/correction allowed?  
9. **PD-COL-REC-01 batch** — Multi-specimen receive in one operation?  
10. **PRD FILE GAP** — Locate/attach Enterprise LMS PRD/BRD or PO-certify closure without file  

---

## 25. Proposed L-COL-01D implementation boundary (future — not authorized yet)

### Candidate IN SCOPE (after PO closure)

- Specimen state `Received` (and `Rejected` **only if** approved)  
- Explicit Receive Specimen API + UI action  
- Accession generation per closed PD-COL-REC-10…12  
- Specimen worklist for Collected awaiting receive (+ Received filter)  
- Wire `lms.specimens.receive` (definitions already exist)  
- Branch authorization per closed PD-COL-REC-06  
- Idempotency / concurrency / audit for receive  
- Automated tests per §20  

### Still OUT even after typical PO closure

- Barcode / labels / printers (L-COL-01E)  
- Custody, aliquots, referral receive-direct  
- Testing / results / billing / Pathology  
- Role grants unless separately approved  

**This document does not authorize implementation.**

---

## 26. Explicit out-of-scope list (this audit task)

- Receiving / accession / barcode / label implementation  
- Schema / migrations / APIs / UI changes  
- Specimen state changes in code  
- Worklist implementation  
- Specimens landing page changes  
- Collection / Order / OrderTest / Catalogue / Pathology changes  
- Role grants / permission seeding beyond existing definitions  
- Billing / Testing / Results  
- Placeholder Receiving UI  

---

## 27. Traceability

| Source | Trace |
|---|---|
| PD-COL-SPC-04 / 17 / 18 | Accession at Receiving; LaboratoryApi owns Receiving; Received deferred → this slice |
| AD-COL-SPC-01…12 | Architecture baselines retained |
| L-COL-01B / 01C | Upstream immutable behavior |
| PD-LAB-BILL-01 | No Receiving charges |
| Historical workshop PD-COL-03/04 | Superseded by SPC closure where APPROVED; remaining open items re-homed as PD-COL-REC-* |
| PRD/BRD | **FILE GAP** — do not invent PRD requirements |

---

## 28. Final gate

```text
STATUS: READY_FOR_PRODUCT_OWNER_APPROVAL
IMPLEMENTATION: NO IMPLEMENTATION PERFORMED
NEXT GATE: STOP — await Product Owner decision closure.
```

Do **not** generate an implementation prompt in this task.  
Do **not** implement L-COL-01D until a Product Owner stamp closes §24 and authorizes a separate implementation task.

---

## Confirmation — this task

- NO APPLICATION IMPLEMENTATION  
- NO DATABASE / MIGRATION  
- NO API / UI IMPLEMENTATION  
- NO RECEIVING / ACCESSION / BARCODE IMPLEMENTATION  
- NO SPECIMEN STATE CHANGE IN CODE  
- NO ROLE GRANTS  
- NO PATHOLOGY / ORDERS / CATALOGUE / COLLECTION BEHAVIOR CHANGES  
- Specimens landing page **unchanged**
