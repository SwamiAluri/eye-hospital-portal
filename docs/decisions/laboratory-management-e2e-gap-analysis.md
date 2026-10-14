# Laboratory Management — L2 → L3 E2E Re-Baseline Gap Analysis

**Date:** 2026-10-08  
**Type:** READ-ONLY AUDIT + PRODUCT ARCHITECTURE RE-BASELINE  
**Mode:** NO CODE / NO SCHEMA / NO API / NO UI CHANGES  
**Parent architecture:** [laboratory-management-product-definition-v3.md](./laboratory-management-product-definition-v3.md)  
**Companion roadmap:** [laboratory-management-roadmap-rebaseline.md](./laboratory-management-roadmap-rebaseline.md)  
**Supersedes (as current-state companion):** outdated rows in [laboratory-management-v3-gap-analysis.md](./laboratory-management-v3-gap-analysis.md) where L1/L2 have since shipped — V3 architecture decisions remain in force

```text
LABORATORY E2E AUDIT COMPLETE
ROADMAP RE-BASELINE COMPLETE
NO CODE CHANGES
L2 ACCEPTANCE NOT CLAIMED
L3 IMPLEMENTATION NOT STARTED
READY FOR PRODUCT DECISION
```

Legend: **GREEN** production/certified/reusable · **YELLOW** partial/reusable with gap · **ORANGE** exists but unsafe/incomplete · **RED** absent / must be designed

---

## 1. Executive summary

Laboratory Management now has a **usable L2 clinical catalog + multi-test Order Composer** under the authoritative **`LabReport`** root (one order → N `LabReportItem`s). That foundation is **not** yet a hospital-grade end-to-end laboratory product.

| Layer | Verdict |
|---|---|
| Clinical catalog (Option C hybrid shell) | **YELLOW** — definitions/panels APIs exist; ServiceVariant links **unpopulated** (0 linked at last bootstrap evidence) |
| Order composition UX | **YELLOW / GREEN-ish** — scalable table + footer fix; Manual UAT in progress |
| Commercial / pricing / billing | **RED** for Laboratory path — Billing SoT exists; Lab does not resolve or post charges |
| Insurance / CCMS | **RED** for Laboratory path — platform exists; no Lab contract |
| Specimen / accession / results / verify / QC | **RED** — still future phases |
| Documents (Slice 4) / P360 projection | **GREEN** — preserve |
| Comms / analytics / least-privilege ACL | **YELLOW** patterns / **RED** Lab intents |

**Critical commercial finding:** Hybrid Option C is **APPROVED**, but L2 bootstrap set `ServiceVariantId = null` for imported tests. Authoritative prices live in Billing (`variant_prices` + `IChargeCatalogResolver`). Laboratory order create **does not** call the charge resolver or `OpdBill` posting. **Charge timing, insurance timing, and payment gating are PRODUCT DECISION REQUIRED** — do not invent.

**Next gate:** Product Decision workshop → approval → then first implementation slice (see roadmap companion).  
**Do not** start L3 coding from this audit alone.  
**Do not** claim L2 acceptance here.

---

## 2. Current L2 status

| Item | Evidence |
|---|---|
| Clinical catalog entities/APIs | Implemented (L2) |
| Multi-test `items[]` → one LabReport + N items | Implemented |
| Order Composer compact table + scroll/footer hardening | Implemented |
| Frontend laboratory suite | **69 passed** (source/layout + API contracts) |
| Backend laboratory regression baseline | **53 passed** (prior; no BE change in hardening) |
| Manual UAT | **In progress** — 3-test case observed usable; 10+/short-viewport cases remain |
| L2 acceptance | **NOT formally claimed** |
| L3 | **NOT started** |

L2 Order Composer must not be regressively redesigned by this audit.

---

## 3. Complete Laboratory capability map (target)

```text
Patient / Encounter / Visit (when known)
  → Laboratory Order (LabReport)
  → Commercial / Pricing resolution (ServiceVariant + variant_prices)
  → Billing / Insurance (OpdBill / coverage — Billing & CCMS own)
  → Routing (PerformingLaboratory internal | external)
  → Specimen → Accession → Collection → Receipt/Accept|Reject
  → Processing → Structured Observations / Results
  → Validation → Verification → Release (completed)
  → Diagnostic Report envelope + Slice 4 Documents
  → P360 projection + Notifications (orchestration)
  → Analytics / Audit / Interop (FHIR/HL7/LIS/Analyzer)
```

**Preserved root rule:** `LabReport` remains SoT. Do not revive SQL `lab_order` / `lab_order_item` or orphan `lab.api.ts` as Laboratory SoT. Counsellor `counselor_lab_order*` remains a **separate** SoT until L16 bridge decision.

---

## 4. Current-state architecture (evidence)

| Asset | Class | Evidence |
|---|---|---|
| `LabReport` / `lab_reports` | **GREEN** | Authoritative root; `VisitId` nullable; status string vocabulary |
| `LabReportItem` / `lab_report_items` | **YELLOW** | Lines exist; **no per-item status**; catalog FKs |
| `LaboratoryTestDefinition` (+ optional `ServiceVariantId`) | **YELLOW** | Clinical SoT; commercial FK optional; **links = 0** at bootstrap |
| `LaboratoryPanel` / analytes / specimen requirements | **YELLOW** | Model/API present; panels/analytes sparsely populated |
| `LabReportsController` + `lab-reports.api.ts` | **YELLOW** | List/create/createFromCatalog/complete/attach; **no transition engine** |
| `LaboratoryOrderDialog` | **YELLOW** | L2 composer; no commercial summary |
| `ChargeCatalogResolver` / `variant_prices` | **GREEN** (Billing) | ResolveVariant / payer-aware; **unused by Lab order** |
| `OpdBill` / `opd_bill_items` / investigation item type | **GREEN** (Billing) | Can carry `ServiceVariantId`; **Lab does not post** |
| Slice 4 canonical lab documents | **GREEN** | CERTIFIED EXISTING |
| P360 lab widgets | **GREEN** | Projection only |
| Specimen / Accession / Observation / PerformingLaboratory / QC / Critical / Amendment | **RED** | Absent as Lab domain entities |
| Orphan `lab.api.ts` | **RED** — do not use | Still present as file; workbench tests forbid adoption |
| Status history / Lab audit trail | **RED** | No dedicated LabReport status history |

---

## 5. Target-state architecture (approved V3 + commercial clarification)

Preserve V3 conceptual stack:

```text
Patient → LabReport → Items (LaboratoryTestDefinition/Panel)
  → Specimen → Accession → Observation → Verification → Release
  → Diagnostic Report → P360 / Documents
```

**Commercial clarification (architecture intent — not implementation):**

```text
LaboratoryTestDefinition  --optional--> ServiceVariant
ServiceVariant + variant_prices (+ payer) --> ChargeCatalogResolver
ChargeCatalogResolver + OpdBill APIs --> Billing ledger (SoT)
Insurance/CCMS --> coverage / patient-payer share (SoT outside Lab)
```

Laboratory **must not** own `LaboratoryBill` / `LaboratoryPayment` / `LaboratoryReceipt` / `LaboratoryLedger` unless a later architecture gate proves otherwise (**RECOMMENDED: never**).

---

## 6. Billing / commercial gap analysis

### 6.1 Evidence answers (questions 1–30)

| # | Question | Finding | Class | Decision |
|---|---|---|---|---|
| 1 | Every chargeable LTD has ServiceVariant? | **No.** Bootstrap sets `ServiceVariantId = null`; population report: **Linked ServiceVariant = 0** | **RED** | Map policy **PD-LAB-COM-01** |
| 2 | Which tests non-chargeable? | `ChargeResolveKind.NonChargeable` exists in Billing resolver; **no Lab catalog flag** | **ORANGE** | **PD-LAB-COM-02** |
| 3 | Authoritative Laboratory price? | **`variant_prices` via ServiceVariant** (Billing), not LTD | **GREEN** SoT / **RED** Lab wiring | Closed SoT; wiring open |
| 4 | Branch price? | `variant_prices.branch_id` overrides exist | **GREEN** Billing | — |
| 5 | Payer/insurance tariff? | Resolver accepts `payerId`; payer rows on `variant_prices` | **GREEN** Billing | Lab use **PD-LAB-INS-01** |
| 6 | Price resolver support Lab services? | Supports **any** ServiceVariant; Lab must supply variant id | **YELLOW** | Need mapping |
| 7 | Self-pay pricing? | Existing Billing catalog + OpdBill rules | **GREEN** Billing | Lab attach **PD-LAB-BILL-01** |
| 8 | Insurance-covered lab? | CCMS/coverage patterns exist for counselling/OPD; **not Lab-bound** | **RED** Lab | **PD-LAB-INS-01** |
| 9–10 | Patient / payer share? | Billing/CCMS ownership; not Lab | **YELLOW** reuse | **PD-LAB-INS-02** |
| 11–12 | When is charge created? | **No Lab rule.** Order create does not post bill items | **RED** | **PD-LAB-BILL-01** charge timing |
| 13 | Order cancel financial effect? | No Lab cancel workflow; Billing cancel/reversal patterns exist elsewhere | **RED** Lab | **PD-LAB-BILL-02** |
| 14 | One item cancel in multi-test? | Items have **no status**; parent status only | **RED** | **PD-LAB-MULTI-02** |
| 15–16 | Specimen fail / recollect commercial? | Specimen domain absent | **RED** | **PD-LAB-SPEC-COM-01** |
| 17 | External lab commercial? | PerformingLaboratory absent; no referral billing | **RED** | **PD-LAB-EXT-COM-01** |
| 18–19 | Refunds / discounts? | Billing owns; Lab must not invent | **GREEN** Billing / **RED** Lab hook | **PD-LAB-BILL-03** |
| 20 | Which Billing API to reuse? | `IChargeCatalogResolver`, OpdBill item staging (`AddBillItemRequest` / charge items), existing permissioned Billing controllers | **YELLOW** reuse | Confirm in **PD-LAB-BILL-01** |
| 21–25 | Financial permissions / who collects | Lab today: `laboratory.view` + `patient.view`/`patient.update`; Billing/cashier permissions separate | **ORANGE** | **PD-LAB-PERM-02** / **PD-LAB-FIN-VIS-01** |
| 26–28 | OPD vs IP bill ownership / attach | LabReport has `VisitId?` only; no bill FK; OPD vs IP bill attachment **not defined for Lab** | **RED** | **PD-LAB-BILL-04** |
| 29–30 | Duplicate charge / idempotency? | Billing charge exceptions + idempotency keys exist for other sources; **no Lab idempotency key** | **YELLOW** Billing / **RED** Lab | **PD-LAB-BILL-05** |
| 31 | OPD `SourceType` for lab lines? | `BillChargeSource` today = Package / PackageDiscount / Implant / Consumable / Room / Procedure / Manual — **no Lab / Investigation / Diagnostic**. Unknown types normalize to **Manual**. | **ORANGE** | **PD-LAB-BILL-06** |
| 32 | Counsellor investigation charges? | Counsellor `investigations` + `counselor_lab_order_items` can snapshot `Price`; **not** LabReport and **not** automatic OPD post from Lab workbench | **YELLOW** (separate SoT) | Bridge = L16 / PD-LAB-14-DETAIL |
| 33 | CCMS `estimatedLab`? | Coverage draft estimate field only — **not** LabReport claim posting | **YELLOW** → **RED** for claims | **PD-LAB-INS-01** |

### 6.2 Billing ownership rule (reaffirmed)

| Forbidden (unless later architecture gate) | Prefer |
|---|---|
| LaboratoryBill / LaboratoryPayment / LaboratoryReceipt / LaboratoryLedger | Canonical Billing ledger (`OpdBill` / IP bill patterns as applicable) |

Laboratory initiates or consumes **Billing contracts**; Billing remains financial SoT.

---

## 7. Insurance gap analysis

| Capability | Current | Gap |
|---|---|---|
| Eligibility / coverage / preauth | Platform CCMS / insurance modules exist for other journeys | **RED** Lab binding |
| Patient share / payer share on Lab order | Not shown in Order Composer | **RED** |
| Claim / rejection / reconciliation for Lab lines | Not Lab-owned | **PRODUCT DECISION** whether Lab surfaces status-only vs deep claim UI |
| Timing vs order | Unknown | **PD-LAB-INS-01** |

Do not invent insurance rules inside Laboratory services.

---

## 8. Specimen / accession gap analysis

| Capability | Current | Class |
|---|---|---|
| SpecimenType string + SampleCollectedAt on LabReport | Present | **YELLOW** (thin) |
| First-class Specimen 1:N | Absent | **RED** (L4) |
| Accession / barcode value | Absent | **RED** (L4/L14) |
| Collect / receive / accept / reject / recollect | Absent | **RED** |
| Collector user attribution | Absent | **RED** |

---

## 9. Results / verification gap analysis

| Capability | Current | Class |
|---|---|---|
| Flat ResultValue / unit / range / interpretation | Present on LabReport | **YELLOW** |
| Observation children / analyte results | Absent | **RED** (L5) |
| Complete endpoint → `completed` | Present; Update still broadly mutable | **ORANGE** |
| Verification role gate before release | `VerifiedByName` string only | **RED** (L6; **PD-LAB-VER-02**) |
| Amendment / versioning | Absent | **RED** (L9) |
| Critical-result workflow | Interpretation string only | **RED** (L7; **PD-LAB-CRIT-02**) |

---

## 10. Notification / communication gap analysis

| Capability | Current | Class |
|---|---|---|
| Lab UI toasts (`react-hot-toast`) | Present | **YELLOW** (not orchestration) |
| NotificationService / NotificationHub | Platform **GREEN** | Reuse |
| CCMS CommunicationDispatchService pattern | **GREEN** pattern | Reuse for Lab intents |
| Lab CommunicationIntent catalog (order/specimen/result/critical/TAT) | Absent | **RED** |
| Channel hard-wiring in Lab | Forbidden (PD-LAB-COM-01) | Preserve |

---

## 11. Documents / P360 gap analysis

| Capability | Current | Class |
|---|---|---|
| Slice 4 canonical Lab documents | CERTIFIED | **GREEN** |
| Attach ≠ clinical completion | Preserved | **GREEN** |
| P360 lab orders/results/docs | Projection | **GREEN** |
| P360 as ops workbench | Must not happen | Boundary closed |
| Dedup / supersede | Document platform | **GREEN** / extend carefully |

---

## 12. Analytics gap analysis

| Metric family | Current Lab | Class |
|---|---|---|
| Volume / TAT / pending / rejection / verification backlog | No Lab ops analytics workspace | **RED** |
| Revenue / outstanding / payer mix | Billing analytics (if any) not Lab-bound | **YELLOW** reuse / **RED** Lab |
| QC metrics | QC absent | **RED** |
| Critical response times | Critical workflow absent | **RED** |

Recommend analytics as **cross-cutting embedded** into L3–L9 (events/timestamps first), not a big-bang BI phase.

---

## 13. Security / permission gap analysis

| Persona need | Existing codes (evidence) | Gap |
|---|---|---|
| View Lab workbench | `laboratory.view` | Interim OK |
| Order / update patient context | `patient.view`, `patient.update` | Over-broad for Lab ops |
| Ordering clinician search | `patient.view` on ordering-clinicians endpoint | Least-privilege intentional for L2 |
| Catalog admin | Controllers use Lab/admin patterns — confirm per endpoint | **ORANGE** matrix |
| See prices / collect payment / refund | Billing/cashier permissions — **not Lab-scoped** | **PD-LAB-FIN-VIS-01** |
| Verify / release | No dedicated Lab verify permission | **PD-LAB-VER-02**, **PD-LAB-PERM-02** |
| External lab user | Absent | Future |
| Integration service | IP LIS webhook auth pattern only | Adapter later |

**Do not invent permission codes** without Security Decision.

---

## 14. Integration map

| Integration | Existing API/event/service | Lab current | Gap | Future contract | PD? |
|---|---|---|---|---|---|
| Patient/MPI | Patient search / MPI | Used in Order Composer | Low | Keep | No |
| Appointment | Appointment APIs | Not bound | Visit when known | Soft bind | PD-LAB-VISIT-01 (approved capture) |
| Visit/Encounter | `LabReport.VisitId` | Nullable; UI weak | Capture UX | L3 | Closed capture rule |
| Billing | ChargeCatalogResolver, OpdBill | **Not called** | Critical | Lab→Billing contract | **Yes** |
| Insurance/CCMS | Coverage/claim services | **Not called** | Critical | Status + share display | **Yes** |
| Notifications | Hub + NotificationService + CCMS dispatch | Toasts only | High | CommunicationIntent | Pattern closed |
| Documents | Slice 4 | Attached | Low | Preserve | No |
| P360 | Widgets | Projection | Boundary | Keep read-only | No |
| Analytics | Various | None Lab | Medium | Event timestamps | Embed |
| Audit | `IAuditService` | Weak Lab writes | Critical | Status history | Progressive |
| External lab / LIS / Analyzer / FHIR / HL7 / Barcode HW | Patterns only | Absent | High | Adapters L10–L14 | Per-iface |

---

## 15. State-machine analysis

### 15.1 Authoritative vocabulary (PRESERVE — do not add statuses automatically)

`ordered` · `sample_collected` · `in_progress` · `completed` · `cancelled` · `on_hold`

### 15.2 Current enforcement

| Aspect | Current |
|---|---|
| Allowed transitions | **Not server-enforced** (free string + Complete shortcut) |
| Forbidden transitions | **Not coded** |
| Complete API | Sets `completed` + result fields; **no prior-status guard** (can complete from any status) |
| Cancel vs soft-delete | Soft-delete (`DeletedAt`) ≠ vocabulary `cancelled`; no dedicated cancel endpoint |
| API authz | LabReports/Catalog mutate via **`patient.view` / `patient.update`** — **not** `laboratory.view` (nav/page only) |
| Who may transition | Broad patient.update / lab access — no role matrix |
| Billing side effects | **None** |
| Specimen side effects | Timestamp fields only |
| Notifications | Local toast on create; preference stub `lab_results`; **no** LabReport lifecycle hub events |
| P360 | Reflects status string; canonical docs projected |
| Documents | Attach independent of status (Slice 4 rule); FHIR DiagnosticReport entity **absent** |

### 15.3 Multi-item parent/child

| Situation | Current model | Gap |
|---|---|---|
| Item A completed, B pending | Parent single status only; items have **no status** | **PD-LAB-MULTI-02** — do **not** invent `partially_completed` |
| One item cancelled | No item cancel | **PD-LAB-MULTI-02** |
| One specimen rejected | No specimen entity | L4 + PD |
| One item external | No routing | L3/L12 |
| All items complete | Parent → completed via Complete API | Needs verify gate in L6 |

**PRODUCT DECISION REQUIRED** before encoding parent rollup rules.

---

## 16. Persona / ACL matrix (capability view — codes not invented)

| Persona | View | Create order | Modify | Cancel | Collect | Process | Verify | Release | See price | Collect pay | Refund | Ins. | Results | Amend |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Ordering clinician | Y* | Y* | ? | ? | N | N | N | N | ? | N | N | ? | Y* | N |
| Lab technician | Y (`laboratory.view`) | Y* via patient.* | Y* | ? | ? | ? | N | N | ? | N | N | N | Y* | N |
| Lab manager | Y* | Y* | ? | ? | ? | ? | ? | ? | ? | N | N | ? | Y* | ? |
| Pathologist / verifier | ? | N | N | N | N | N | **PD** | **PD** | N | N | N | N | Y | **PD** |
| Billing clerk / cashier | via Billing | N | N | N | N | N | N | N | Y Billing | Y Billing | Y* Billing | Y* | N | N |
| Finance | Billing | N | N | N | N | N | N | N | Y | ? | Y* | Y | N | N |
| Insurance / TPA | CCMS | N | N | N | N | N | N | N | share | N | N | Y | limited | N |
| Front Office | limited | ? | N | N | ? | N | N | N | ? | ? | N | ? | N | N |
| Patient | portal/P360 | N | N | N | N | N | N | N | ? | ? | N | ? | released | N |
| Admin | * / grants | Y | Y | ? | ? | ? | ? | ? | Y | Y | Y | Y | Y | ? |
| External lab user | Absent | — | — | — | — | — | — | — | — | — | — | — | — | — |
| Integration service | webhook patterns | — | — | — | — | — | — | — | — | — | — | — | — | — |

`*` = interim / over-broad patient.* or incomplete. `?` = **PRODUCT DECISION / PD-LAB-PERM-02**.

---

## 17. End-to-end scenario matrix (future — design aid)

| # | Scenario | Billing | Insurance | Specimen | Result | Notify | Doc | P360 | Audit | Failure | Security |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Self-pay OPD order | Charge timing **PD** | N/A or none | L4 | L5–6 | Order/result intents | Slice 4 | Yes | Yes | Unpaid gate **PD** | Fin vis **PD** |
| 2 | Insurance OPD order | + payer price | Eligibility **PD** | L4 | L5–6 | + coverage msgs | Slice 4 | Yes | Yes | Preauth deny **PD** | Ins ACL |
| 3 | IP laboratory order | IP bill attach **PD** | IP coverage **PD** | L4 | L5–6 | Ward + clinician | Slice 4 | Yes | Yes | Wrong encounter | Ward/Lab ACL |
| 4 | Multi-specimen multi-test | Per-line charge? **PD** | Per line | Multi specimen | Per obs | — | — | Yes | Yes | Partial reject | — |
| 5 | STAT / urgent | Same commercial? **PD** | — | Priority collect | Fast track | Escalate | — | Yes | Yes | SLA breach | — |
| 6 | Reject + recollect | Recharge? **PD** | — | Reject reason | Hold | Specimen notify | — | Yes | Yes | Repeat reject | Collect ACL |
| 7 | One item cancelled | Partial reverse **PD** | Adjust **PD** | — | — | — | — | Yes | Yes | Parent status **PD** | Cancel ACL |
| 8 | External send-out | Send-out cost **PD** | — | Referral | Ingest | External result | PDF | Yes | Yes | Lost sample | Ext ACL |
| 9 | Critical result | — | — | — | Flag | Ack/escalate | — | Yes | Yes | No ack | Crit ACL |
| 10 | Verify + release | — | — | — | Immutable | Result ready | Report | Yes | Yes | Verify deny | Verifier |
| 11 | Amendment | — | — | — | Version | Amend notify | Supersede | Current | Yes | Wrong version | Amend ACL |
| 12 | Payment failure / unpaid | Block process? **PD** | — | Maybe hold | — | Payment notify | — | Status | Yes | Retry pay | Cashier |
| 13 | Refund/reversal | Billing OT-020 style | — | — | — | — | — | — | Yes | Double refund | Finance |
| 14 | TAT breach | — | — | — | — | Breach intent | — | — | Yes | Silent miss | Ops |
| 15 | Patient views in P360 | Hide unpaid? **PD** | — | — | Released only | — | Preview | Yes | Access audit | Patient ACL |
| 16 | Clinician notified | — | — | — | Released | Clinician intent | — | Yes | Yes | Wrong recip | Clinician |

---

## 18. Complete gap matrix (A–V condensed)

| Capability area | Current | SoT | API/service | UI | Permission | Phase | Severity | Dependency | PD? | Recommended phase |
|---|---|---|---|---|---|---|---|---|---|---|
| A Ordering (patient/clinician/priority/items/indication) | **YELLOW** | LabReport | lab-reports + catalog | Order Composer | laboratory.view + patient.* | L2 | Med | Catalog | Indication catalog **No** (free text) | L2 UAT → L3 polish |
| B Catalog clinical | **YELLOW** | LTD | LaboratoryCatalog* | Admin + picker | Lab/admin | L2 | Med | — | Mapping **Yes** | L2 + COM map |
| C Commercial / pricing | **RED** Lab | ServiceVariant/prices | ChargeCatalogResolver | None in Lab | Billing | — | **Critical** | Mapping | **Yes** | L3-COM / cross-cut |
| D Billing post/pay/refund | **RED** Lab | OpdBill | OpdBillService* | Billing UI | Billing | — | **Critical** | C | **Yes** | After PD-LAB-BILL-01 |
| E Insurance | **RED** Lab | CCMS | Coverage APIs | CCMS UI | CCMS | — | **Critical** | C/D | **Yes** | Embed w/ Billing |
| F Routing / PerformingLab | **RED** | — | — | LabName string | — | L3 | High | — | Typed lab closed | L3 |
| G Specimen | **RED** | — | — | Strings | — | L4 | Critical | Order | Reject catalog | L4 |
| H Accession / barcode value | **RED** | — | — | — | — | L4/L14 | Critical | Specimen | Uniqueness | L4 |
| I Analytical processing | **RED** | — | — | — | — | L5+ | High | Accession | — | L5 |
| J Results / Observations | **RED**/flat **YELLOW** | LabReport flat | Complete | Thin | patient.* | L5 | Critical | Catalog analytes | — | L5 |
| K Validation/verification | **RED** | — | — | VerifiedByName | — | L6 | Critical | Results | **VER-02** | L6 |
| L Release / immutability | **ORANGE** | Status completed | Complete | — | — | L6 | Critical | Verify | Closed rule; enforce | L6 |
| M Critical results | **RED** | — | — | Interpretation | — | L7 | Critical | Comms | **CRIT-02** | L7 |
| N QC | **RED** | — | — | — | — | L8 | Critical | — | **QC-02** | L8 |
| O Amendment | **RED** | — | — | Doc supersede YELLOW | — | L9 | Critical | Release | Closed req | L9 |
| P External laboratory | **RED** | — | — | — | — | L12 | Critical | Routing | Partner | L12 |
| Q Documents | **GREEN** | Canonical | Slice 4 | P360/Lab attach | existing | L15 opt | Low | — | Preserve | Ongoing |
| R Communication | **YELLOW** platform / **RED** Lab intents | Comms | Hub/Service/CCMS | Toasts | — | L7+ | High | — | Intent catalog | Embed |
| S Patient 360 | **GREEN** | Projection | Widgets | P360 | patient | Ongoing | Low | Release rules | Visibility **PD** | Ongoing |
| T Analytics | **RED** Lab | — | — | — | — | Cross-cut | Med | Events | KPI owners | Embed |
| U Security/audit | **ORANGE** | IAuditService | Weak Lab | — | interim | L6+ | High | Matrix | **PERM-02** | Progressive |
| V Interoperability | **RED** / patterns **YELLOW** | Adapters | ADT/LIS auth | — | — | L10–14 | High | Stable domain | IFACE-* | Later |

---

## 19. Product Decision Register

| ID | Topic | Status |
|---|---|---|
| PD-LAB-CAT-01 | Option C hybrid catalog | **APPROVED** |
| PD-LAB-MULTI-01 | Multi-item / multi-specimen architecture | **APPROVED** |
| PD-LAB-IND-01 | Structured indication (implemented as required free text; no invented catalog) | **APPROVED** (free-text practice) / catalog **NOT approved** |
| PD-LAB-WF-01 | Server-enforced transitions (eventually) | **APPROVED** requirement |
| PD-LAB-COM-01 | Which LTDs must map to ServiceVariant; mapping ownership/process | **PRODUCT DECISION REQUIRED** |
| PD-LAB-COM-02 | Non-chargeable laboratory tests identification | **PRODUCT DECISION REQUIRED** |
| PD-LAB-BILL-01 | Charge creation timing (order / confirm / collect / other) + API | **PRODUCT DECISION REQUIRED** |
| PD-LAB-BILL-02 | Cancel order → financial reversal rules | **PRODUCT DECISION REQUIRED** |
| PD-LAB-BILL-03 | Discount / refund initiation from Lab vs Billing-only | **PRODUCT DECISION REQUIRED** |
| PD-LAB-BILL-04 | OPD vs IP bill association / existing bill attach | **PRODUCT DECISION REQUIRED** |
| PD-LAB-BILL-05 | Lab charge idempotency key design | **PRODUCT DECISION REQUIRED** |
| PD-LAB-BILL-06 | OPD `BillChargeSource` / `SourceType` (+ `SourceRefId`) for Laboratory lines — new typed source vs Manual + ServiceVariant | **PRODUCT DECISION REQUIRED** |
| PD-LAB-INS-01 | Insurance timing vs order; Lab display vs claim depth | **PRODUCT DECISION REQUIRED** |
| PD-LAB-INS-02 | Patient/payer share display rules on Order Summary | **PRODUCT DECISION REQUIRED** |
| PD-LAB-FIN-VIS-01 | Who may see prices / payable in Lab UI | **PRODUCT DECISION REQUIRED** |
| PD-LAB-PAY-01 | Whether unpaid blocks specimen/processing | **PRODUCT DECISION REQUIRED** |
| PD-LAB-MULTI-02 | Parent status rollup when items diverge (no new status invented here) | **PRODUCT DECISION REQUIRED** |
| PD-LAB-ORD-EDIT-01 | Edit existing order after create | **PRODUCT DECISION REQUIRED** |
| PD-LAB-ORD-CXL-01 | Cancel / on_hold / resume ACL + effects | **PRODUCT DECISION REQUIRED** |
| PD-LAB-ROUTE-01 | Default internal vs external routing rules | **RECOMMENDED** detail under L3 |
| PD-LAB-SPEC-COM-01 | Reject/recollect commercial effects | **PRODUCT DECISION REQUIRED** |
| PD-LAB-EXT-COM-01 | External lab commercial reconciliation | **PRODUCT DECISION REQUIRED** |
| PD-LAB-UX-SUM-01 | Order Summary / Estimate Sheet adoption & contents | **PRODUCT DECISION REQUIRED** |
| PD-LAB-VER-02 | Verifier role matrix | **PRODUCT DECISION REQUIRED** (phase-gated L6) |
| PD-LAB-PERM-02 | Capability → permission codes | **PRODUCT DECISION REQUIRED** |
| PD-LAB-CRIT-02 | Critical thresholds / escalation | **PRODUCT DECISION REQUIRED** (L7) |
| PD-LAB-QC-02 | QC rule pack | **PRODUCT DECISION REQUIRED** (L8) |
| PD-LAB-14-DETAIL | Counsellor bridge | **PRODUCT DECISION REQUIRED** (L16) |
| PD-LAB-NOTIF-01 | Which Lab intents fire to which personas | **PRODUCT DECISION REQUIRED** |
| PD-LAB-TAT-01 | TAT breach definition & notification | **PRODUCT DECISION REQUIRED** |
| PD-LAB-PKG-01 | Package / panel commercial explosion vs clinical panel | **PRODUCT DECISION REQUIRED** |
| PD-LAB-INT-01 | Cross-domain reflection & integration boundaries (P360, Billing, CCMS, Comms, Analytics, Docs, Audit) | **APPROVED** principles — see [pd-lab-int-01](./laboratory-management-pd-lab-int-01-cross-domain-integration.md); timing/payloads still phase-gated |
| L3-PD workshop | Commercial / billing / pay / insurance / multi-item / notifications | See [l3-product-decisions](./laboratory-management-l3-product-decisions.md) — **L3-COM-01 NOT AUTHORIZED** until COM-01/02 closed |

Legend discipline: **APPROVED** / **EXISTING CERTIFIED** / **PRODUCT DECISION REQUIRED** / **RECOMMENDED** / **FUTURE ARCHITECTURAL NOTE** — recommendations are **not** approved rules.

---

## 20. Commercial UX proposal (Order Summary — design only)

### 20.1 Existing reusable patterns

| Pattern | Path | Reuse note |
|---|---|---|
| Counselling quote panel / bottom sheet | `CounsellingQuotePanel`, `CounsellingQuoteBottomSheet` | Right/side summary chrome; **do not fork counselling domain logic** |
| Coverage preview | `build-coverage-preview.ts` | Insurance share display patterns |
| Estimate builder / print | `CounsellingEstimateBuilderCard`, print dialog | Estimate metaphor only |
| Billing AddBillItem / charge staging | OpdBill charge item services | Server posting — not Lab UI math |
| Price resolve | `IChargeCatalogResolver.ResolveVariantAsync` | Authoritative unit price when mapped |

### 20.2 Proposed future UX (NOT implemented)

```text
LEFT: Order composition (existing composer — keep bounded)
RIGHT: Order Summary & Estimate Sheet
  - Patient, selected tests/codes, specimen, TAT (from LTD)
  - Unit prices (from resolver — never client-invented)
  - Subtotal / discounts (Billing rules)
  - Payer share / patient payable (Insurance + Billing)
  - Billing status / insurance status (status chips only if authorized)
  - Continue / Submit / handoff to payment (per PD-LAB-PAY-01)
```

### 20.3 Ownership split

| Value | Owner |
|---|---|
| Test clinical identity | Laboratory |
| Price / discount / payable | Billing |
| Coverage shares | Insurance/CCMS |
| Display of financials | Lab UI **gated by** PD-LAB-FIN-VIS-01 |
| Payment collection | Billing/Cashier workspace |

**Do not** turn Laboratory into a second Billing system.

---

## 21. UX workspace audit (future)

| Workspace | Form | Notes |
|---|---|---|
| Laboratory Management | Page / worklist | Exists (L1/L2) |
| Order Composer | Modal/dialog | Exists — preserve |
| Order Summary / Estimate | Sheet / side panel | **Missing** — propose reuse of counselling sheet patterns |
| Billing handoff | Existing Billing UI + deep link | Prefer not duplicate cashier |
| Specimen Collection | Page or drawer | L4 |
| Accession | Embedded in specimen | L4 |
| Processing Workbench | Page | L5 |
| Result Entry | Page / panel | L5 |
| Verification | Page / queue | L6 |
| Critical Results | Queue | L7 |
| External Lab | Queue | L12 |
| QC | Workspace | L8 |
| Documents | Existing attach + P360 | Preserve |
| Analytics | Dashboard widgets | Cross-cut after events exist |

Prefer existing Hospital Portal Dialog/Sheet patterns; do not create duplicate worklists.

---

## 22. Risks

| Risk | Mitigation |
|---|---|
| Implementing L3 before commercial PDs | Gate: Product Decision workshop |
| Inventing Lab prices in FE | Resolver-only; no client math as SoT |
| Creating LaboratoryBill | Forbidden unless architecture gate |
| Claiming L2 acceptance from audit | Explicit non-claim |
| Adding `partially_completed` status | Forbidden without vocabulary change decision |
| Hard-wiring SMS/WhatsApp in Lab | PD-LAB-COM-01 / COM orchestration |
| Ignoring unpaid orders clinically | PD-LAB-PAY-01 |
| Redesigning Order Composer during L3 | Scope freeze on L2 composer chrome |

---

## 23. Acceptance / UAT implications

| Gate | Implication |
|---|---|
| L2 Manual UAT | Still required; audit does not pass it |
| Commercial Product Decisions | Block safe L3 commercial UX and charge posting |
| L3 Manual UAT | Must include routing + (if approved) estimate visibility cases |
| Financial UAT | Owned jointly with Billing/Finance; Lab alone cannot certify money |

---

## 24. Explicit out-of-scope (this audit task)

Any implementation of billing, pricing UI, insurance, notifications, specimen, results, verification, payment, refund, Order Summary UI, state transitions, schema, APIs, permissions, or L3 code.

---

## 25. Evidence reconciliation (subagent deep-dives)

Supplementary read-only passes confirmed and sharpened the above (no code changes):

- Commercial/billing: [Lab catalog billing evidence](1febca2e-706c-4c90-8230-e7dbff700e41) — hybrid FK ready; bootstrap null; no OpdBill post; **`BillChargeSource` lacks Lab type** → **PD-LAB-BILL-06**.
- Lifecycle/permissions/UX: [Lab lifecycle permissions UX](5eeb13d8-cc6b-4dfa-a414-d59b7a18ed24) — vocabulary GREEN; transitions ORANGE/RED; API `patient.*` vs nav `laboratory.view`; counselling Sheet/quote patterns reusable for Order Summary; canonical docs GREEN; FHIR DiagnosticReport RED.

## 26. Final status

```text
LABORATORY E2E AUDIT COMPLETE
ROADMAP RE-BASELINE COMPLETE
NO CODE CHANGES
L2 ACCEPTANCE NOT CLAIMED
L3 IMPLEMENTATION NOT STARTED
READY FOR PRODUCT DECISION
```

**Next gate:** `AUDIT → PRODUCT DECISION → APPROVAL → IMPLEMENTATION`  
**First recommended implementation slice** (after decisions): see [roadmap rebaseline §First slice](./laboratory-management-roadmap-rebaseline.md#first-recommended-implementation-slice).
