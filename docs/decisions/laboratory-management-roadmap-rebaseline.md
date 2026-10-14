# Laboratory Management — Roadmap Re-Baseline (L2 → L3+)

**Date:** 2026-10-08  
**Type:** READ-ONLY ROADMAP RECONCILIATION  
**Mode:** NO IMPLEMENTATION  
**Companion gap analysis:** [laboratory-management-e2e-gap-analysis.md](./laboratory-management-e2e-gap-analysis.md)  
**Parent architecture:** [laboratory-management-product-definition-v3.md](./laboratory-management-product-definition-v3.md)  
**Cross-domain integration:** [PD-LAB-INT-01](./laboratory-management-pd-lab-int-01-cross-domain-integration.md)  
**L3 product decisions workshop:** [laboratory-management-l3-product-decisions.md](./laboratory-management-l3-product-decisions.md) — **L3-COM-01 NOT AUTHORIZED** until COM-01/02 Product Owner approval  
**PO decision matrix:** [laboratory-management-product-owner-decision-matrix.md](./laboratory-management-product-owner-decision-matrix.md)  
**PO decision closure (APPROVED baseline):** [laboratory-management-product-owner-decision-closure.md](./laboratory-management-product-owner-decision-closure.md) — **L3-COM-01 gated by L2 acceptance / program waiver**

```text
ROADMAP RE-BASELINE COMPLETE
NO CODE CHANGES
L2 ACCEPTANCE NOT CLAIMED
L3 IMPLEMENTATION NOT STARTED
READY FOR PRODUCT DECISION
```

---

## 1. Purpose

Reconcile the approved V3 phase roadmap (L1–L17) with post-L2 reality and the Product Owner’s requirement for a **complete hospital-grade laboratory capability**, including commercial/billing, insurance, notifications, analytics, and security — **without deleting approved phases** and **without inventing clinical/financial rules**.

---

## 2. Current phase reality (2026-10-08)

| Phase | V3 intent | Current reality |
|---|---|---|
| L1 Workbench Stabilization | GET list + runtime discipline | **Substantially complete** (worklist + tests) |
| L2 Clinical Catalog Core | Hybrid catalog + order from catalog | **Implementation substantially complete**; Manual UAT in progress; **acceptance NOT claimed** |
| L3 Order & Routing | Visit, PerformingLaboratory, routing | **NOT started** |
| L4–L17 | Specimen → interop | **NOT started** |

**Commercial / Billing / Insurance** were under-specified as explicit roadmap work in V3 (catalog hybrid approved; charge timing not decided). This re-baseline places them as **cross-cutting workstreams** with explicit product decisions **before** charge posting.

---

## 3. Approved phase list (PRESERVED)

Do **not** delete:

| Phase | Name |
|---|---|
| L1 | Workbench Stabilization |
| L2 | Clinical Catalog Core |
| L3 | Order & Routing |
| L4 | Specimen & Accession |
| L5 | Structured Results |
| L6 | Verification & Release |
| L7 | Critical Results |
| L8 | QC / Quality |
| L9 | Amendment / Versioning |
| L10 | FHIR |
| L11 | HL7 v2 |
| L12 | External Laboratory |
| L13 | LIS / Analyzer Gateway |
| L14 | Barcode Hardware |
| L15 | Laboratory Documents |
| L16 | Counsellor Bridge |
| L17 | Imaging/PACS/DICOM (out of Lab SoT) |

L18 Historical Migration remains **not required** (PD-LAB-MIG-01).

---

## 4. Cross-cutting workstreams — evaluation

| Workstream | Embed in L3–L9? | Separate program? | Recommendation |
|---|---|---|---|
| A. Commercial / Pricing | **Yes** — mapping + estimate in L3; maintain with catalog | No separate forever-phase | **Embed** as **L3-COM** sub-slices; mapping may start immediately after PD |
| B. Billing integration | **Yes** — post after PD-LAB-BILL-01 | Do not create Lab billing subsystem | **Embed**; Billing owns ledger |
| C. Insurance / Payer | **Yes** — with Billing handoff | CCMS remains SoT | **Embed** status/share display; deep claim stays CCMS |
| D. Communication / Notifications | **Yes** — intents from L3+; critical in L7 | No Lab SMS service | **Embed** using platform orchestration |
| E. Audit / Compliance | **Yes** — progressive every phase | — | **Embed** status history early (L3) |
| F. Analytics | **Yes** — event/timestamp first | Optional later BI pack | **Embed** metrics hooks; dashboard later |
| G. Security / RBAC | **Yes** — matrix before L6 cutover | Security Decision if new codes | **Embed**; no silent codes |
| H. Patient 360 projection | Ongoing boundary | — | **Embed** release/visibility rules |
| I. Documents | Slice 4 preserve | L15 only if reopen | **Preserve / optional L15** |
| J. Integration / Eventing | L10–L14 + outbox patterns | — | **Keep phased external** |

**Do not** automatically add parallel “L18 Billing” that competes with Billing domain ownership.

---

## 5. Where Commercial / Billing / Insurance / Notifications / Analytics belong

| Concern | Primary home | Lab phase touchpoints |
|---|---|---|
| ServiceVariant mapping | Catalog + Billing master data | **L3-COM-01** (after PD-LAB-COM-01) |
| Price resolution | Billing `IChargeCatalogResolver` | Order Summary read path |
| Charge posting | Billing `OpdBill` / IP patterns | **After PD-LAB-BILL-01** — likely L3-COM-02 or post-confirm slice |
| Insurance share / eligibility | CCMS / Insurance | Order Summary + handoff; **PD-LAB-INS-*** |
| Payment / receipt / refund | Billing / Cashier | Handoff only from Lab |
| Notifications | Platform orchestration | Order created (L3), specimen (L4), result/critical (L6–L7), TAT |
| Analytics | Ops metrics on Lab events | Timestamps L3+; dashboards when volume justifies |

---

## 6. Expanded phase cards (re-baseline)

### L1 — Workbench Stabilization

| | |
|---|---|
| Status | Substantially **done** |
| Residual | Ops restart discipline (`dotnet run` without stale `--no-build`) |
| Billing | None |
| UAT | Worklist loads |

### L2 — Clinical Catalog Core

| | |
|---|---|
| Status | Implementation substantially **done**; **Manual UAT gate open** |
| Residual UAT | 10+ tests, short viewport, Additional Notes clearance, create order |
| Commercial | FK exists; **0 links** — mapping deferred to L3-COM after PD |
| Acceptance | **NOT claimed** |
| Out of scope still | Charge posting, Order Summary Sheet, routing entity |

### L3 — Order & Routing (**expanded**)

**Objective:** Complete order operationalization: visit binding when known, PerformingLaboratory, internal/external routing, order lifecycle product decisions, **commercial mapping + read-only estimate**, audit hooks — **without** specimen/results.

**Recommended sub-slices (dependency order):**

| Slice ID | Objective | Preconditions |
|---|---|---|
| **L3-PD** | Product Decision workshop (commercial, multi-item, cancel/hold, Order Summary, pay gate) | This audit accepted |
| **L3-COM-01** | Map chargeable LTD→ServiceVariant; admin UX; resolver smoke | PD-LAB-COM-01/02 |
| **L3-UX-01** | Order Summary / Estimate Sheet (read-only prices; no Lab ledger) | PD-LAB-UX-SUM-01, PD-LAB-FIN-VIS-01, L3-COM-01 |
| **L3-ROUTE-01** | PerformingLaboratory + routing fields on LabReport | PD-LAB-ORG-01 (approved) |
| **L3-WF-01** | Transition matrix scaffolding (ordered↔on_hold/cancelled per PD) — **no new statuses** | PD-LAB-ORD-*, PD-LAB-MULTI-02 |
| **L3-COM-02** | Charge create/attach per PD-LAB-BILL-01 (Billing APIs only; typed `SourceType` per PD-LAB-BILL-06) | PD-LAB-BILL-01/04/05/06 |
| **L3-AUD-01** | LabReport status/mutation audit trail start | — |
| **L3-NOTIF-01** | Order-created CommunicationIntent (orchestration) | PD-LAB-NOTIF-01 |

**Explicit L3 out-of-scope:** Specimen entity, accession, observations, verify/release enforcement, QC, FHIR/HL7/LIS, Counsellor auto-bridge, redesign of L2 compact table.

### L4 — Specimen & Accession

Expand with: collect ACL, reject reasons catalog (**PD**), recollection commercial (**PD-LAB-SPEC-COM-01**), barcode **value**, notifications for reject/recollect. Hardware printers remain L14.

### L5 — Structured Results

Expand with: work queues, manual vs import, abnormal flags, result comments; analytics timestamps for TAT start/stop.

### L6 — Verification & Release

**Blocked by** PD-LAB-VER-02, PD-LAB-PERM-02. Enforce immutability; result-ready notification; P360 released-only rules (**PD** patient visibility).

### L7 — Critical Results

**Blocked by** PD-LAB-CRIT-02. Uses communication orchestration (not channel hard-wire).

### L8 — QC / Quality

**Blocked by** PD-LAB-QC-02. Hospital CAPA ≠ analytical QC.

### L9 — Amendment / Versioning

Preserve Slice 4 supersede for PDFs; clinical ResultVersion is Lab domain.

### L10–L14 — Interop / hardware

Unchanged intent; require stable clinical domain + partner specs (PD-LAB-IFACE-*).

### L12 — External Laboratory

Add commercial reconciliation **PD-LAB-EXT-COM-01**; manual referral before automation.

### L15 — Documents

Default skip if Slice 4 sufficient.

### L16 — Counsellor Bridge

**Blocked by** PD-LAB-14-DETAIL; no auto LabReport.

### L17 — Imaging

Remains Imaging domain — not Lab SoT.

---

## 7. Dependency graph

```text
L2 Manual UAT ──► L2 ACCEPTANCE (human gate)
        │
        ▼
   L3-PD Product Decisions
        │
        ├─► L3-COM-01 (ServiceVariant mapping)
        │         └─► L3-UX-01 (Order Summary read-only)
        │                   └─► L3-COM-02 (charge posting — if PD allows)
        ├─► L3-ROUTE-01 (PerformingLaboratory)
        ├─► L3-WF-01 (lifecycle per PD)
        ├─► L3-AUD-01
        └─► L3-NOTIF-01
                │
                ▼
              L4 Specimen & Accession
                │
                ▼
              L5 Results ──► L6 Verify/Release ──► L7 Critical
                │                 │
                │                 └─► L9 Amendment
                └─► L8 QC (may parallel after L5 instruments context)
                        │
                        ▼
              L10 FHIR / L11 HL7 / L12 External / L13 LIS / L14 Barcode
                        │
                        ▼
              L15 Docs (optional) / L16 Counsellor bridge (PD)
```

Insurance display depends on L3-COM-01 + CCMS contracts. Payment collection remains Billing UI.

---

## 8. Implementation cut plan (future slices — NOT implemented now)

### Slice template

Each slice must define before coding: objective, preconditions (PDs), APIs/services, DB impact, permissions approach, UX, integrations, automated tests, Manual UAT, acceptance, explicit out-of-scope.

---

### First recommended implementation slice

<a id="first-recommended-implementation-slice"></a>

**Immediate next gate is not code — it is `L3-PD` (Product Decision).**

**First implementation slice after Product Decision approval:**

#### `L3-COM-01` — Laboratory commercial mapping (chargeability foundation)

| Field | Definition |
|---|---|
| **Slice ID** | L3-COM-01 |
| **Objective** | Establish authoritative LTD ↔ ServiceVariant mapping for chargeable tests; enable resolver-backed unit prices; zero Lab ledger |
| **Preconditions** | L2 acceptance (or explicit Product Owner waiver); **PD-LAB-COM-01**, **PD-LAB-COM-02** closed |
| **APIs/services** | Existing Laboratory catalog APIs (ServiceVariantId); Billing ServiceVariant admin read; `IChargeCatalogResolver.ResolveVariantAsync` for verification |
| **Database** | Prefer populate existing nullable FK; avoid new Lab price tables |
| **Permissions** | Reuse catalog admin + Billing catalog read; **no new codes** without Security Decision |
| **UX** | Catalog admin: link/unlink ServiceVariant; show mapped/unmapped/non-chargeable; **no Order Summary yet** if UX-SUM deferred |
| **Integrations** | Billing catalog read-only; no OpdBill post in this slice |
| **Automated tests** | Mapping validation; resolver returns Mapped/Unpriced/NonChargeable; regression: Lab order create still does not invent prices |
| **Manual UAT** | Map CBC001 (or agreed test) → variant with branch price; unmapped test clearly flagged |
| **Acceptance** | Chargeable sample set mapped; unmapped countable; Lab still does not post charges unless later slice approved |
| **Out of scope** | Charge posting, insurance claim, Order Summary Sheet, specimen, L2 composer redesign, new statuses |

**Why this first:** Without mapping, Order Summary and billing handoff cannot be honest. Routing (L3-ROUTE-01) can proceed in parallel **only if** staffing allows — commercial mapping is the critical path for “what it costs / who pays.”

**If Product Owner prioritizes clinical routing over money:** `L3-ROUTE-01` may be first **code** slice, but **L3-COM-01 remains mandatory before any patient-payable UI or charge posting**.

---

### Subsequent slices (summary)

| Slice ID | Objective | Key PD blockers |
|---|---|---|
| L3-UX-01 | Order Summary & Estimate Sheet (read-only) | UX-SUM-01, FIN-VIS-01 |
| L3-COM-02 | Post/attach charges via Billing | BILL-01/04/05/06, PAY-01 |
| L3-ROUTE-01 | PerformingLaboratory + route | — (ORG-01 approved) |
| L3-WF-01 | Cancel/hold/resume transitions | ORD-*, MULTI-02 |
| L4-* | Specimen/accession | SPEC reject catalog |
| L5-* | Observations | — |
| L6-* | Verify/release | VER-02, PERM-02 |

---

## 9. Product Decision workshop agenda (recommended)

1. Charge timing (PD-LAB-BILL-01)  
2. Unpaid order clinical gate (PD-LAB-PAY-01)  
3. Multi-item lifecycle without new status (PD-LAB-MULTI-02)  
4. Cancel / on_hold / resume vs soft-delete (PD-LAB-ORD-*)  
5. ServiceVariant mapping ownership (PD-LAB-COM-01/02)  
6. Order Summary contents & financial visibility (PD-LAB-UX-SUM-01, FIN-VIS-01)  
7. Insurance timing & display depth (PD-LAB-INS-01/02)  
8. OPD vs IP bill attach (PD-LAB-BILL-04)  
9. OPD `BillChargeSource` / SourceRef for Lab lines (PD-LAB-BILL-06)  

Output: decision log with APPROVED / DEFERRED / REJECTED — then authorize first code slice.

---

## 10. L2 implications

- Do **not** modify the L2 Order Composer for this re-baseline.  
- Frontend baseline **69 passed** must not be regressed by future slices without intentional test updates.  
- Manual UAT remains the L2 acceptance gate.

---

## 11. Explicit out-of-scope (this document)

Implementation of any slice, schema, API, UI, permission, billing post, insurance, notification, or L3 coding.

---

## 12. Final status

```text
ROADMAP RE-BASELINE COMPLETE
NO CODE CHANGES
L2 ACCEPTANCE NOT CLAIMED
L3 IMPLEMENTATION NOT STARTED
READY FOR PRODUCT DECISION

Next: AUDIT → PRODUCT DECISION → APPROVAL → L3-COM-01 (or agreed first slice)
```
