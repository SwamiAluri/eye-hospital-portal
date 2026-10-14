# Laboratory Management — Product Owner Decision Matrix

**Date:** 2026-10-08  
**Type:** READ-ONLY PRODUCT / ARCHITECTURE DECISION WORKSHOP  
**Audience:** Product Owner (approve / reject / defer)  
**Mode:** NO IMPLEMENTATION · NO CODE · NO SCHEMA · NO API · NO UI · NO PERMISSIONS · NO L3 SLICE AUTHORIZATION  

**Basis documents:**
1. [laboratory-management-product-definition-v3.md](./laboratory-management-product-definition-v3.md)
2. [laboratory-management-e2e-gap-analysis.md](./laboratory-management-e2e-gap-analysis.md)
3. [laboratory-management-roadmap-rebaseline.md](./laboratory-management-roadmap-rebaseline.md)
4. [laboratory-management-pd-lab-int-01-cross-domain-integration.md](./laboratory-management-pd-lab-int-01-cross-domain-integration.md)
5. [laboratory-management-l3-product-decisions.md](./laboratory-management-l3-product-decisions.md)
6. [laboratory-management-l2-order-composer-ux-correction-implementation.md](./laboratory-management-l2-order-composer-ux-correction-implementation.md)

```text
PRODUCT OWNER DECISION MATRIX COMPLETE
READ-ONLY WORKSHOP
NO IMPLEMENTATION PERFORMED
NO CODE CHANGES
L2 ACCEPTANCE NOT CLAIMED
L3 IMPLEMENTATION NOT STARTED
L3-COM-01 NOT AUTHORIZED
READY FOR PRODUCT OWNER APPROVAL
```

**PO Decision column values (use these only):** `PENDING` · `APPROVED` · `REJECTED` · `DEFERRED`

**Recommendation label:** Every recommended option is **RECOMMENDED — NOT YET APPROVED** until the PO column changes from `PENDING`.

---

## 1. Executive summary

This matrix converts remaining **PRODUCT DECISION REQUIRED** items into explicit Product Owner choices. It does **not** authorize L3 coding and does **not** claim L2 acceptance.

| Already established (do not re-open without formal change) | Status |
|---|---|
| Lab owns clinical/operational LabReport tree | **APPROVED** (INT-01 / V3) |
| Billing owns money; CCMS owns insurance/claims | **APPROVED** |
| P360 / Docs / Notifications are not Lab workbenches | **APPROVED** |
| No LaboratoryBill / Lab ledger / Lab claims engine | **APPROVED** |
| Option C hybrid: LTD clinical · ServiceVariant commercial | **APPROVED** |
| Price SoT = `variant_prices` + Billing resolver | **APPROVED** |
| Six statuses; soft-delete ≠ cancelled; no silent Manual; no `partially_completed` without PD | **APPROVED** |
| Slice 4 documents | **EXISTING CERTIFIED** |

| Still blocking L3 commercial/lifecycle slices | Status |
|---|---|
| COM-01 / COM-02 (mapping & non-chargeable) | **PRODUCT DECISION REQUIRED** → PO table |
| BILL-01/02/04/05/06, PAY-01, FIN-VIS, UX-SUM, INS, MULTI, ORD-*, NOTIF, TAT, PKG | **PRODUCT DECISION REQUIRED** → PO table |

**L3-COM-01 remains NOT AUTHORIZED** until PO **APPROVES** COM-01 and COM-02 (and L2 acceptance / explicit waiver as program policy).

---

## 2. Current status

| Gate | State |
|---|---|
| L2 Order Composer + catalog | Implemented |
| FE laboratory tests | 69 passed |
| BE laboratory regression | 53 passed (baseline) |
| L2 Manual UAT | **Acceptance gate — NOT claimed** |
| L3 implementation | **NOT started** |
| L3-COM-01 | **NOT authorized** |
| This document | Decision choices for PO — no code |

---

## 3. Approved architecture already established

See INT-01 P1–P10 and L3-PD §5. Summary:

```text
Patient → LabReport → Items → Specimen/Accession → Observations
  → Verification → Release → Documents / P360

Lab clinical SoT ──reflect──► Billing (charges) ──► CCMS (claims)
                         └──► Notifications / Analytics / Audit
```

No duplicate event bus. Prefer existing APIs, outbox, Hub, orchestration, Slice 4, P360 loaders.

---

## 4. Repository evidence (verified)

| Finding | Evidence | Class |
|---|---|---|
| LTD optional `ServiceVariantId`; bootstrap null; 0 links | Catalog model + L2 population report | Schema ready / population empty |
| `variant_prices` branch + payer + effective | `ServiceCatalogV2.VariantPrice` | **EXISTING CERTIFIED** |
| Resolver kinds Mapped/Unmapped/NonChargeable/Unpriced | `IChargeCatalogResolver` | **EXISTING** |
| Branch override not applied in `ResolveVariantAsync` pick | Uses `Pick(payer,null)` then `Pick(null,null)` only | **Implementation finding** (not a silent rule change) |
| NonChargeable via `ServiceVariantItemMaps` | Inventory/item maps — **not** LTD | Cannot auto-assume as Lab rule |
| `BillChargeSource` no Laboratory; unknown → Manual | `BillChargeSource.cs` | **EXISTING CERTIFIED** gap for Lab |
| OpdBill SourceRef + IdempotencyKey; IP journey bills | Billing services | **EXISTING CERTIFIED** |
| Package explosion ≠ clinical panel | `OpdBillService.PackageExplosion` | **EXISTING CERTIFIED** |
| Finance perms `bill.view`, `opd_bill.*`, `ip.billing.*`, `ccms.billing.read` | Permission catalogs | **EXISTING CERTIFIED** |
| Lab API mutate via `patient.*`; nav `laboratory.view` | Controllers / sidebar | Interim |
| No Lab charge post / unpaid gate / item status / Lab intent catalog | Controllers + models | Absent → PDR |
| Slice 4 + P360 lab projection | Certified docs + loaders | **EXISTING CERTIFIED** |

---

## 5. Product decision matrix (Part 1 audit + Part 2 choices)

### Register of remaining decisions

| ID | Topic | Evidence | Current state | Why required | Blocks | Dependencies |
|---|---|---|---|---|---|---|
| PD-LAB-COM-01 | Mapping / chargeability | FK null; 0 links | **PDR** | Honest commerce | **L3-COM-01** | INT-01, CAT-01 |
| PD-LAB-COM-02 | Non-chargeable LTD | Item-map IsChargeable ≠ LTD | **PDR** | Distinguish unmapped vs free | L3-COM-01 | COM-01 |
| PD-LAB-COM-03 | Price chain | Architecture approved; branch gap in ResolveVariantAsync | Arch **APPROVED**; branch API **PDR**/finding | Correct preview/post | UX / COM-02 | COM-01 |
| PD-LAB-BILL-01 | Charge timing | No Lab post today | **PDR** | When money moves | **L3-COM-02** | COM, BILL-04/05/06 |
| PD-LAB-BILL-02 | Cancel/reversal | Billing refund exists; Lab matrix absent | **PDR** | Deterministic finance | WF + COM-02 | BILL-01, MULTI |
| PD-LAB-BILL-04 | OPD/IP association | VisitId?; IP journey Ensure | **PDR** | Correct bill | COM-02 | BILL-01 |
| PD-LAB-BILL-05 | Idempotency key | Billing IdempotencyKey patterns | **PDR** (exact shape) | No double charge | COM-02 | BILL-01 |
| PD-LAB-BILL-06 | BillChargeSource | No Lab value | **PDR** | Traceability | COM-02 | — |
| PD-LAB-PAY-01 | Unpaid gates | No Lab gate | **PDR** | Safety vs finance | Coupled L3+ | BILL-01 |
| PD-LAB-FIN-VIS-01 | Who sees money | Billing perms exist; Lab policy absent | **PDR** | ACL | L3-UX-01 | — |
| PD-LAB-UX-SUM-01 | Order Summary Sheet | Counselling Sheet patterns | **PDR** | UX | L3-UX-01 | FIN-VIS, COM |
| PD-LAB-INS-01/02 | Insurance timing/display | CCMS + outbox; estimatedLab only | **PDR** | No dual claims | Ins display | BILL path |
| PD-LAB-MULTI-02 | Multi-item lifecycle | Items have no Status | **PDR** | Determinism | L3-WF | ORD, BILL-02 |
| PD-LAB-ORD-EDIT/CXL/HOLD | Edit/cancel/hold | Soft-delete ≠ cancel approved | Policy **PDR** | Ops ACL | L3-WF-01 | MULTI, BILL-02 |
| PD-LAB-NOTIF-01 | Notification catalog | Stub `lab_results` only | **PDR** | Comms | L3-NOTIF | INT-01 |
| PD-LAB-TAT-01 | TAT/SLA | TurnaroundHours only | **PDR** | Breach metrics | Later analytics | Timestamps |
| PD-LAB-PKG-01 | Panel vs package | Billing packages ≠ Lab panels | **PDR** | Commercial truth | Panel go-live | COM, BILL |
| PD-LAB-EXT-COM-01 | External lab commercials | No send-out entity | **FUTURE**/PDR | L12 | L12 | ROUTE |

---

### PD-LAB-COM-01 — Commercial mapping / chargeability

| Question | Options / notes |
|---|---|
| Which LTDs chargeable? | **PO:** All active clinical LTDs with SV link = chargeable; OR explicit chargeable set. Null SV ≠ non-chargeable (see COM-02). |
| Who owns LTD→SV mapping? | **RECOMMENDED — NOT YET APPROVED:** Lab catalog steward + Billing master-data co-own; changes via catalog admin, not ad-hoc clinical bypass. |
| Mapping mandatory before financially actionable? | **RECOMMENDED — NOT YET APPROVED:** Yes for charge post / priced estimate. Clinical order may still be allowed (see below). |
| Unmapped chargeable LTD? | **RECOMMENDED — NOT YET APPROVED:** No silent price; Order Summary shows Unmapped; no Manual fallback. |
| Inactive ServiceVariant? | Resolver already Unmapped if inactive — treat as not financially actionable until remapped. |
| Who create/change mappings? | Reuse catalog admin path + existing admin/Billing catalog permissions; **no new permission invented here** (Security Decision if needed). |
| Audit mapping changes? | **RECOMMENDED — NOT YET APPROVED:** Yes via `IAuditService` / catalog audit. |
| Clinical bypass missing mapping? | **RECOMMENDED — NOT YET APPROVED:** Allow clinical order create; **block** financial post & priced estimate until mapped — OR block create (PO choose). |

**Consequences if recommended path adopted:** Governance ↑, no silent billing; clinical care can proceed without commercial data; finance delayed until mapped.

---

### PD-LAB-COM-02 — Non-chargeable representation

**Why `ServiceVariantItemMaps.IsChargeable` is not the Lab rule:** That flag gates **inventory/item → variant** maps in Billing charge resolution. Laboratory clinical identity is `LaboratoryTestDefinition`, which has **no** IsChargeable column. Null `ServiceVariantId` today means **unmapped**, not “free test.”

| Option | Description | Pros | Cons |
|---|---|---|---|
| **A** | Explicit LTD/catalog non-billable flag | Clear Lab semantics | New field/schema → Security/product gate |
| **B** | Designated non-billable ServiceVariant | Reuses SC | Needs SC convention; risk of misuse |
| **C** | Controlled admin list of local codes | No schema | Weak SoT; ops burden |
| **D** | Other certified mechanism | Only if evidenced | None found for LTD |

**RECOMMENDED — NOT YET APPROVED:** **Option A** (explicit non-billable on clinical catalog) *or* **B** if Billing already has a certified non-billable variant convention the PO can name. Do not treat null SV as non-chargeable.

---

### PD-LAB-COM-03 — Price resolution

| Item | Status |
|---|---|
| Chain LTD → SV → `variant_prices` → resolver → Billing/OpdBill | **APPROVED** architecture |
| Price SoT | Billing / `variant_prices` — never LTD |
| Branch / payer / effective dating | Supported on `variant_prices` table |
| Unmapped / Unpriced / NonChargeable | No invented UI amounts — **APPROVED** |
| Branch override in `ResolveVariantAsync` | **Implementation finding:** current code does **not** pick `branch_id` override (payer-global then global only). Future Order Summary must use a branch-aware Billing API or extend resolver in a later **implementation** slice after PO confirms requirement — **not** silently changed here. |

---

### PD-LAB-BILL-01 — Charge timing

| Option | Patient UX | Cancel / no-show | Reject / recollect | Billing integrity | Refund complexity | Insurance | Ops simplicity |
|---|---|---|---|---|---|---|---|
| **A** Order create | Early liability | High cancel load | Charge before draw | Strong capture | High | Early claim risk | Simple trigger; noisy |
| **B** Order confirm | Clear intent | Needs confirm step (absent today) | Better than A | Clean | Medium | Cleaner | Needs new UX event |
| **C** Specimen collect | Charge at draw | No charge if never drawn | Aligns with reject/recollect | Good for OP lab | Medium | Aligns with service delivery | Needs collect workflow (L4) |
| **D** Processing start | Late | Misses no-shows | Late | Under-bill risk | Lower cancel | Late | Weak |
| **E** Other (e.g. journey package) | Context-specific | IP package patterns exist | Not Lab-specific | Existing IP | Existing | Existing | Not Lab SoT |

**RECOMMENDED — NOT YET APPROVED:** **C — charge at specimen collection** for OPD self-pay/routine lab (matches delivered service; reduces no-show charges). **IP** may attach to journey bill under BILL-04 (hybrid). **STAT/emergency** may allow clinical collect before payment (PAY-01).  
**Main trade-off:** Requires reliable collect event (L4 maturity); until then interim staging may be needed — PO must confirm.

---

### PD-LAB-BILL-02 — Cancellation / reversal / refund matrix

**APPROVED:** Lab never mutates the financial ledger; Billing owns reverse/refund/credit.

| Clinical state when cancel/stop | Clinical cancel allowed? | Financial effect | Owner |
|---|---|---|---|
| `ordered` (no charge yet) | **PDR** (recommend yes if no specimen) | None if no charge | Lab clinical; Billing N/A |
| `ordered` (charge already posted — if timing ≠ C) | **PDR** | Reverse/void line per Billing | Billing |
| `sample_collected` | **PDR** | Usually reverse if not resulted | Billing |
| `in_progress` | **PDR** (often restricted) | Reverse/adjust **PDR** | Billing |
| `completed` / released | **PDR** (usually no ordinary cancel; amend path) | Refund rare / finance approval | Billing + refund authorize perms |
| `on_hold` | Resume or cancel **PDR** | Depends if charged | Billing if charged |
| `cancelled` | Terminal | — | — |
| Soft-delete | **NOT** cancellation (**APPROVED**) | Must not imply finance cancel | — |

Item-level cancel finance → couples **MULTI-02**. Full cell-by-cell accounting rules remain **PRODUCT DECISION REQUIRED** where Billing hospital policy is not Lab-encoded.

---

### PD-LAB-BILL-04 — OPD / IP / encounter association

| Model | Notes |
|---|---|
| A OPD bill | `CreateBillAsync` / OpdBill items |
| B IP bill | `EnsureIpBillForJourneyAsync` + `PatientJourneyId` |
| C Encounter-specific | Lab has `VisitId?` only today |
| D Journey-based | Existing IP pattern |
| E Hybrid | OPD vs IP by patient context |

**RECOMMENDED — NOT YET APPROVED:** **E — Hybrid:** OPD outpatient lab → OpdBill (create or attach open bill per Billing rules); IP admitted → ensure IP journey bill. Capture `VisitId`/journey when known (V3). Lab never creates a parallel bill type. Cross-branch: follow existing Billing branch protection.

---

### PD-LAB-BILL-05 — Idempotency key

| Layer | Shape |
|---|---|
| **Conceptual product identity** | `tenantId + labReportId + labReportItemId + chargeReason [+ chargeKind]` |
| **Code-level** | Align with existing `IdempotencyKey` string conventions (e.g. package keys); exact format **PRODUCT DECISION REQUIRED** / implementer design after PO accepts concept |

**RECOMMENDED — NOT YET APPROVED:** Accept conceptual identity above; final string format in L3-COM-02 design, unique per tenant like charge exceptions.

---

### PD-LAB-BILL-06 — BillChargeSource

| Option | Traceability | Risk |
|---|---|---|
| **A** Typed `Laboratory` (or Investigation) source | High | Billing schema/Security Decision |
| **B** Manual + Lab SourceRef | Works today | Misleading classification; reporting pollution — **must not be silent default** |
| **C** Other existing source | None fits Lab semantics | — |

**RECOMMENDED — NOT YET APPROVED:** **A — introduce typed Laboratory source** (+ SourceRef → LabReport/Item). Until approved, **do not post** Lab charges as Manual.

---

### PD-LAB-PAY-01 — Unpaid clinical gates

| Gate | RECOMMENDED — NOT YET APPROVED |
|---|---|
| Order creation | **Do not block** on payment (clinical order allowed) |
| Specimen collection | **Do not hard-block** STAT/emergency; OPD routine self-pay **may warn** or soft-gate — **PO choose** |
| Processing / verify | **Do not block** on unpaid (patient safety / result integrity) |
| Result **release** to patient | **May** hold patient-facing release if unpaid — staff still see per policy — **PO choose** |

**Rationale:** Unpaid ≠ unsafe to process clinically; financial controls belong in Billing; emergency/STAT must not wait on cashier.  
**Trade-off:** Revenue leakage risk if release never gated.

---

### PD-LAB-FIN-VIS-01 — Financial visibility

| Audience | List/payer price | Patient responsibility / paid / outstanding | Ins status / bill # |
|---|---|---|---|
| Lab technician | **Hide** (rec.) | Hide | Hide |
| Lab manager | Optional summary (rec. limited) | Optional | Optional |
| Ordering clinician | Optional estimate (rec. limited) | Optional | Status chip only |
| Front office | Via Billing/FO tools | Via Billing | Via Billing |
| Billing / Cashier / Finance | Full via `bill.view` / `opd_bill.*` / `ip.billing.*` | Full | Full — **EXISTING CERTIFIED** |
| CCMS | via `ccms.billing.read` etc. | Allocation views | CCMS |
| Patient | Portal/billing rules — not Lab workbench | Billing portal | **PDR** |

**RECOMMENDED — NOT YET APPROVED:** Lab workbench default **clinical-first**; money only for roles that already have Billing view perms, or explicit FO/manager grant — **reuse existing codes**, invent none.

---

### PD-LAB-UX-SUM-01 — Order Summary Sheet

| Question | RECOMMENDED — NOT YET APPROVED |
|---|---|
| Pattern | Right-side Sheet (Counselling quote/sheet patterns) |
| When opens | During composition + before submit (read-only estimate when mapped) |
| After create | Optional status summary; payment in Billing |
| Read-only vs actionable | Clinical confirm in Lab; **no** cashier workflow inside Sheet |
| Clinical content | Patient, clinician, tests, codes, specimen, TAT, priority |
| Financial | Prices/payable **only if FIN-VIS**; else “Price unavailable / see Billing” |
| Insurance | Status chips only if INS-02 + FIN-VIS |
| Actions | Confirm order / open Billing handoff deep-link — not full claim UI |
| Must NOT become | Second Billing or CCMS workbench; must not redesign L2 table |

---

### PD-LAB-INS-01 / INS-02 — Insurance

| Topic | RECOMMENDED — NOT YET APPROVED |
|---|---|
| Claims submission | **Never** from Lab directly — Billing → CCMS |
| Eligibility authoritative | CCMS |
| When resolved | At Billing/coverage allocation; Lab may show **read-only** snapshot if authorized |
| Unavailable insurance | Proceed clinical; commercial as self-pay path per Billing |
| Lab display | Eligible/auth **status** maybe; amounts only with FIN-VIS; claim rejection detail **CCMS-only** (rec.) |

---

### PD-LAB-MULTI-02 — Multi-item lifecycle

| Question | RECOMMENDED — NOT YET APPROVED |
|---|---|
| Authoritative status | **Parent LabReport status** remains vocabulary SoT initially; item-level status **FUTURE** only if PO requires model change |
| Different completion times | Clinically yes; express without new status via item result readiness + parent stays `in_progress` until all released items done |
| One item cancelled | Parent stays active if others remain; **no** `partially_completed` |
| Parent completed | All billable/reportable items released or cancelled; none pending |
| Billing | Charge/reverse **per LabReportItem** (line grain) |
| Patient-visible release | Per released item/result; parent completed when policy met |

**If PO requires true independent item statuses:** explicit model change — mark architecture impact; still no `partially_completed` unless separately approved.

---

### PD-LAB-ORD-EDIT / CXL / HOLD

| Topic | RECOMMENDED — NOT YET APPROVED |
|---|---|
| Editable while `ordered` | Indication, notes, priority, clinician, add/remove tests (with finance rules) |
| Immutable after `sample_collected` | Patient, core test identity of collected lines, specimen type for collected |
| Cancel | Explicit `cancelled` status; ACL lab manager / authorized; soft-delete ≠ cancel |
| Hold | Blocks processing/release; collection **PDR**; free-text reason sufficient initially (no invented vocabulary) |
| Resume | Same ACL as hold or manager |
| Audit | All transitions |

---

### PD-LAB-NOTIF-01 — Notification catalog

| Intent | Staff | Patient | Mandatory? (rec.) | Channel owner |
|---|---|---|---|---|
| order created | Lab queue optional | No | Optional | Orchestration |
| specimen collected | Optional | No | Optional | Orchestration |
| result ready / released | Ordering clinician | Yes (prefs) | **Recommended mandatory** staff | Hub + NotificationService |
| order cancelled | Clinician + lab | Optional | Recommended | Orchestration |
| critical result | On-call / clinician | **PDR** | **Mandatory** + ack via Lab API | Orchestration |
| TAT breach | Ops / clinician | No | Recommended when TAT-01 set | Orchestration |
| payment-related | — | — | Prefer **Billing-owned** | Billing |
| insurance-related | — | — | Prefer **CCMS/Billing** | CCMS |

**APPROVED constraint:** No second notification system; no channel hard-wire in Lab.

---

### PD-LAB-TAT-01 — TAT / SLA

| Topic | Status |
|---|---|
| TurnaroundHours on LTD | Exists |
| Business hours / holidays / weekend engine | **Not in Lab path** — do not invent engine in this workshop |
| Clock start/stop/pause | **PRODUCT DECISION REQUIRED** (rec. start: collect or order — PO; stop: release) |
| Urgent/STAT | Different hours **PDR** |
| Breach notify | Couples NOTIF-01 |
| Later slice | Dedicated TAT analytics/SLA slice if PO requires calendar engine |

**RECOMMENDED — NOT YET APPROVED:** Use elapsed hours from catalog TAT initially; calendar/holiday engine = **separate future slice** if hospital SLA requires it.

---

### PD-LAB-PKG-01 — Panel vs package

| Aspect | Clinical panel | Billing package |
|---|---|---|
| SoT | `LaboratoryPanel` | Billing package templates / explosion |
| **RECOMMENDED — NOT YET APPROVED** | Default **A**: clinical grouping; commercially **one SV or N child SVs per catalog config** — explicit per panel | Do not auto-use IP package explosion for Lab panels |

Cancellation/refund follow BILL-02 per charged lines.

---

## 6. Recommended decisions package

| ID | Recommended choice | Why | Benefit | Trade-off | Impl consequence |
|---|---|---|---|---|---|
| COM-01 | Governed mapping; no silent Manual; clinical create OK; finance blocked if unmapped | Separates care vs money | Safe commerce | Orders may lack price | L3-COM-01 mapping admin |
| COM-02 | Explicit non-billable (A) or designated SV (B) | Null≠free | Clear catalogs | May need schema | COM-01/02 design |
| COM-03 | Keep chain; fix branch-aware price API later | Evidence of gap | Correct branch price | Extra Billing work | Note in COM-02/UX |
| BILL-01 | Charge at collection (C); IP hybrid | Matches service | Less no-show charge | Needs L4 collect | L3-COM-02 timing |
| BILL-02 | Billing owns reverse; Lab status only | INT-01 | Clean SoT | Matrix must be filled by PO | WF + Billing |
| BILL-04 | Hybrid OPD/IP | Matches existing bills | Reuse | Visit/journey capture | COM-02 |
| BILL-05 | Conceptual key as proposed | Prevents doubles | Integrity | Exact string later | COM-02 |
| BILL-06 | Typed Laboratory source (A) | Semantics | Traceability | Billing change | Security/schema |
| PAY-01 | Don’t block create/process; soft rules on collect/release | Safety | STAT OK | Revenue risk | Soft gates |
| FIN-VIS | Tech hide money; Billing perms for money | Least privilege | Privacy | Managers may want prices | UX gates |
| UX-SUM | Sheet at compose; no cashier inside | Counsellor pattern | Clarity | Limited money | L3-UX-01 |
| INS | Lab→Billing→CCMS; status chips only | No dual claims | Correct ownership | Less Lab insight | After Billing |
| MULTI-02 | Parent status; line billing; no new status | Avoid vocabulary churn | Simple | Less item nuance | May need item status later |
| ORD-* | Edit in ordered; immutable after collect; explicit cancel/hold | Safety | Clear ops | Rigid after draw | L3-WF-01 |
| NOTIF | Release + critical mandatory; payment Billing-owned | Focus | Less noise | Catalog still PO | L3-NOTIF |
| TAT | Elapsed hours first | No fake SLA engine | Honest | Weak holiday handling | Later slice |
| PKG | Clinical panel ≠ Billing package; config per panel | Clarity | Correct $ | Config work | Catalog + Billing |

All rows: **RECOMMENDED — NOT YET APPROVED**.

---

## 7. Cross-domain consistency check

| Integration | SoT | Flow | Mutate Lab? | Idempotency | Audit | Patient visibility | Exists? | Future slice |
|---|---|---|---|---|---|---|---|---|
| Lab clinical | LabReport tree | Internal | Lab APIs | Transitions | Yes | Released only (policy) | Partial L2 | L3–L9 |
| Billing | OpdBill / IP | Lab → Billing command | **No** | Key BILL-05 | Billing + corr. | Via Billing | Patterns yes; Lab wire no | L3-COM-02 |
| CCMS | Claims/coverage | Billing → CCMS outbox | **No** | Outbox | CCMS | Limited | Outbox yes | After Billing |
| Documents | Canonical | Lab attach | Not status | Canonical id | Docs | Released/attached | **CERTIFIED** | Preserve |
| Notifications | Orchestration | Lab intent → send | Ack via Lab API only (crit) | Dedupe | Comms | Prefs | Hub yes; intents no | NOTIF-01 |
| P360 | Projection | Read Lab/Docs | **No** | N/A | Access | Released | **CERTIFIED** | Enrich |
| Analytics | Derived | Query/events | **No** | N/A | — | N/A | Weak | Embed |

---

## 8. Dependency graph

```text
L2 MANUAL UAT
    ↓
L2 ACCEPTANCE  (human gate — NOT claimed)
    ↓
PO APPROVES COM-01 + COM-02
    ↓
L3-COM-01  (mapping only — still NOT authorized until above)
    ↓
PO APPROVES BILL-01, BILL-04, BILL-05, BILL-06, PAY-01, FIN-VIS, UX-SUM
    ↓
L3-UX-01 + L3-COM-02
    ↓
PO APPROVES MULTI-02 + ORD-*
    ↓
L3-WF-01
    ↓
PO APPROVES NOTIF-01 (+ TAT-01 as needed)
    ↓
L3-NOTIF-01 + insurance display (INS-01/02)
    ↓
Later: L4 Specimen … L12 External (EXT-COM)
```

Rationale: Mapping before priced UX/charges; charge policy before posting; lifecycle before notifications that depend on transitions.

---

## 9. Product Owner approval table

> **Closure recorded:** [laboratory-management-product-owner-decision-closure.md](./laboratory-management-product-owner-decision-closure.md)  
> Recommended options that were selected are now **APPROVED** (or **DEFERRED**).  
> Follow-up cells remain **PENDING**.

| ID | Decision | Recommended Option | PO Decision | Notes |
|---|---|---|---|---|
| PD-LAB-COM-01 | LTD↔SV mapping & chargeability governance | Governed mapping; no silent Manual; clinical create OK; finance blocked if unmapped | **APPROVED** | See closure §5 |
| PD-LAB-COM-02 | Non-chargeable LTD representation | Explicit catalog non-billable (A); null SV ≠ free | **APPROVED** | Schema not implemented; follow-up |
| PD-LAB-COM-03 | Price resolution chain | Approved chain; branch-aware path as impl finding | **APPROVED** | Branch gap = IMPLEMENTATION DESIGN |
| PD-LAB-BILL-01 | Charge timing | Charge at specimen collection (C); IP hybrid | **APPROVED** | |
| PD-LAB-BILL-02 | Cancel/reversal/refund ownership | Billing owns money; Lab owns status | **APPROVED** | Detailed cells **PENDING** Finance |
| PD-LAB-BILL-04 | OPD/IP bill association | Hybrid OPD OpdBill / IP journey Ensure | **APPROVED** | |
| PD-LAB-BILL-05 | Idempotency identity | Conceptual tenant+report+item+reason[+kind] | **APPROVED** | Exact string **PENDING** design |
| PD-LAB-BILL-06 | BillChargeSource | Typed Laboratory source; no silent Manual | **APPROVED** | Schema change **PENDING** Billing/security |
| PD-LAB-PAY-01 | Unpaid clinical gates | No block create/process/verify; no hard-block STAT collect | **APPROVED** | Soft collect / patient release gate **PENDING** |
| PD-LAB-FIN-VIS-01 | Financial visibility in Lab | Clinical-first; techs hide money; reuse existing Billing/CCMS perms | **APPROVED** | |
| PD-LAB-UX-SUM-01 | Order Summary Sheet | Compose-time Sheet; no cashier/claims UI | **APPROVED** | |
| PD-LAB-INS-01 | Insurance timing | Lab→Billing→CCMS; no Lab claims | **APPROVED** | |
| PD-LAB-INS-02 | Insurance display in Lab | Status chips; amounts need FIN-VIS; claim detail CCMS-only | **APPROVED** | |
| PD-LAB-MULTI-02 | Multi-item lifecycle | Parent status SoT; per-item billing; no partially_completed | **APPROVED** | |
| PD-LAB-ORD-EDIT | Order edit rules | Edit while ordered; immutable after sample_collected for core fields | **APPROVED** | |
| PD-LAB-ORD-CXL | Cancellation | Explicit cancelled; not soft-delete; ACL + audit | **APPROVED** | |
| PD-LAB-ORD-HOLD | Hold/resume | Real state; blocks process/release; auditable | **APPROVED** | Collect-on-hold **PENDING** |
| PD-LAB-NOTIF-01 | Notification catalog | Release/cancel/critical/TAT; payment/insurance not Lab-owned | **APPROVED** | |
| PD-LAB-TAT-01 | TAT/SLA | Elapsed hours from TurnaroundHours; no calendar engine now | **APPROVED** | Clock start/stop stamps **PENDING** |
| PD-LAB-PKG-01 | Panel vs package | Clinical panel ≠ Billing package | **APPROVED** | |
| PD-LAB-EXT-COM-01 | External lab commercials | Defer to L12 | **DEFERRED** | FUTURE L12 |

---

## 10. Explicit implementation gate

| Item | Status |
|---|---|
| L2 acceptance | **NOT CLAIMED** |
| L3 implementation | **NOT STARTED** |
| L3-COM-01 | **GATED BY L2 ACCEPTANCE / PROGRAM WAIVER** (COM-01 + COM-02 are **APPROVED** in closure; coding still requires separate bounded prompt) |
| Other L3 slices | **Not** auto-authorized |
| Implementation performed | **None** |
| Code / schema / migration / API / UI / permission changes | **None** |

---

## 11. Final status

```text
PRODUCT OWNER DECISION MATRIX UPDATED FROM CLOSURE
READ-ONLY WORKSHOP
NO IMPLEMENTATION PERFORMED
NO CODE CHANGES
L2 ACCEPTANCE NOT CLAIMED
L3 IMPLEMENTATION NOT STARTED
L3-COM-01 GATED BY L2 ACCEPTANCE / PROGRAM WAIVER
READY FOR NEXT EXPLICIT IMPLEMENTATION GATE
```
