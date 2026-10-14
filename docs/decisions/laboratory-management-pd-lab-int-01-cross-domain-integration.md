# PD-LAB-INT-01 — Cross-Domain Reflection & Integration

**Date:** 2026-10-08  
**Decision group:** 14 — Cross-Domain Reflection & Integration  
**Type:** PRODUCT / ARCHITECTURE DECISION RECORD  
**Mode:** READ-ONLY — **NO IMPLEMENTATION**  
**Status:** PRINCIPLES APPROVED WHERE STATED; TIMING/PAYLOAD DETAILS PHASE-GATED  

**Parents / companions:**
- [laboratory-management-product-definition-v3.md](./laboratory-management-product-definition-v3.md)
- [laboratory-management-e2e-gap-analysis.md](./laboratory-management-e2e-gap-analysis.md)
- [laboratory-management-roadmap-rebaseline.md](./laboratory-management-roadmap-rebaseline.md)
- Slice 4 laboratory documents (CERTIFIED EXISTING)

```text
PD-LAB-INT-01 DECISION RECORD COMPLETE
NO CODE CHANGES
NO SCHEMA CHANGES
L2 ACCEPTANCE NOT CLAIMED
L3 IMPLEMENTATION NOT STARTED
```

Legend for every cell / rule:  
**APPROVED** · **PRODUCT DECISION REQUIRED** · **EXISTING CERTIFIED** · **RECOMMENDED** · **FUTURE**

---

## 0. Binding principles (PD-LAB-INT-01)

| # | Principle | Status |
|---|---|---|
| P1 | Laboratory is SoT for laboratory clinical/operational records (`LabReport` root + approved children) | **APPROVED** |
| P2 | Other domains remain SoT for their own concerns (Billing, CCMS, Documents platform, MPI, Communications orchestration) | **APPROVED** |
| P3 | Laboratory-generated information must be reflected where operationally required | **APPROVED** |
| P4 | Do not duplicate domain ownership | **APPROVED** |
| P5 | Do not create Laboratory-owned Billing / Insurance / Claims | **APPROVED** |
| P6 | Patient 360 is projection/discovery — not a Laboratory ops workbench | **APPROVED** (EXISTING CERTIFIED boundary) |
| P7 | Billing and CCMS UIs are not Laboratory ops workbenches | **APPROVED** |
| P8 | External projections must not mutate Laboratory state unless an explicit integration contract permits it | **APPROVED** |
| P9 | Prefer existing Hospital Portal APIs, outbox, projections, orchestration — do not invent a second event bus | **APPROVED** |
| P10 | Status vocabulary remains `ordered` / `sample_collected` / `in_progress` / `completed` / `cancelled` / `on_hold` — no silent new statuses | **APPROVED** (preserve) |

**Existing platform mechanisms to prefer (do not invent alternatives):**

| Mechanism | Use for Lab | Status |
|---|---|---|
| AuthService REST APIs (`lab-reports`, catalog, billing, patients) | Sync command/query | **EXISTING CERTIFIED** pattern |
| `IAuditService` | Mutation / access audit | **EXISTING CERTIFIED** pattern / Lab writes **RECOMMENDED** progressive |
| Canonical Documents (Slice 4) | Lab report files | **EXISTING CERTIFIED** |
| Patient 360 clinical + documents loaders | Read projections | **EXISTING CERTIFIED** |
| `NotificationHub` + NotificationService | In-app / channel send | **EXISTING CERTIFIED** |
| CCMS `CommunicationDispatchService` style | Orchestrated intents + audit | **EXISTING CERTIFIED** pattern — Lab intents **RECOMMENDED** |
| `billing_ccms_outbox` | Billing↔CCMS reliability | **EXISTING CERTIFIED** for Billing/CCMS — Lab must not own a parallel ledger outbox |
| IP HL7 ADT outbox pattern | Future ORM/ORU shape only | **RECOMMENDED** pattern / Lab messages **FUTURE** (L11) |
| SignalR operational hubs (queue/capacity) | Not Lab SoT | Do not misuse as Lab clinical bus |

---

## A. Cross-domain event matrix

For each lifecycle event: Lab source → external effects. Financial/insurance timing cells that depend on unresolved commercial PDs are marked **PRODUCT DECISION REQUIRED**.

| Event | Lab source record | External domain | Data / projection required | Owning domain (effect) | Ext may mutate Lab? | Notification | Financial effect | Insurance effect | P360 effect | Audit | Analytics | Idempotency / retry | Security boundary | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Order created | `LabReport` (+ `LabReportItem`s) | P360, Audit, Analytics, (Billing/CCMS if charge at order) | Order id, patient, tests/codes, status=`ordered`, priority, clinician, indication summary | Lab SoT; Billing if charge posted | **No** | Order-created intent **RECOMMENDED** (staff); patient **PRODUCT DECISION REQUIRED** | Per **PD-LAB-BILL-01** | Per **PD-LAB-INS-01** | Show order row/status | Lab create audit **RECOMMENDED** | `lab.order.created` count | Idempotent create key if charge posted (**PD-LAB-BILL-05**) | Lab create ACL; no finance in Lab without FIN-VIS | Mixed |
| Order confirmed / routing set | `LabReport` + PerformingLaboratory **FUTURE** L3 | P360, Analytics | Route internal/external, performing lab | Lab | **No** | Optional staff **RECOMMENDED** | Usually none unless PD ties charge to confirm | Optional eligibility refresh **PRODUCT DECISION REQUIRED** | Update status/meta | Yes | `lab.order.routed` | Retry-safe update | Lab route ACL | **RECOMMENDED** / L3 |
| On hold / resume | `LabReport.Status` | P360, Analytics, (Billing hold **PD**) | Status | Lab | **No** | Staff **RECOMMENDED** | **PRODUCT DECISION REQUIRED** | **PRODUCT DECISION REQUIRED** | Status chip | Yes | hold duration | Transition idempotent | Lab lifecycle ACL (**PD-LAB-ORD-***) | **PRODUCT DECISION REQUIRED** |
| Order / item cancelled | `LabReport` (item cancel **PD-LAB-MULTI-02**) | Billing, CCMS, P360, Analytics | Cancel reason, scope (order vs item) | Lab clinical cancel; Billing owns reversal | **No** (Billing may not set Lab cancelled) | Staff + optional patient **PD** | Reversal/refund per **PD-LAB-BILL-02** | Adjust coverage lines **PD** | Status cancelled / hide unpaid drafts **PD** | Yes | cancel rate | Billing reversal idempotency key | Cancel ACL ≠ soft-delete | **PRODUCT DECISION REQUIRED** |
| Specimen collected | Specimen **FUTURE** L4 / today `SampleCollectedAt` | P360, Analytics | Collect time, collector, type | Lab | **No** | Phlebotomy/lab **RECOMMENDED** | Per **PD-LAB-BILL-01** if charge-at-collect | Usually none | Status → sample_collected | Yes | collect TAT start | Collect once / correct | Collect ACL | L4 **RECOMMENDED** |
| Specimen received / accepted | Specimen L4 | Lab ops, Analytics | Receive time | Lab | **No** | Lab bench **RECOMMENDED** | None typical | None | Optional | Yes | receive lag | Idempotent receive | Lab receive ACL | **FUTURE** L4 |
| Specimen rejected | Specimen L4 | P360, Analytics, Notifications, (Billing **PD-LAB-SPEC-COM-01**) | Reject reason | Lab | **No** | Ordering clinician + lab **RECOMMENDED** | Recollect charge **PD** | **PD** | Status/notes projection | Yes | reject rate | Reject once with reason code | Lab reject ACL | **PRODUCT DECISION REQUIRED** / L4 |
| Recollection ordered | Linked Lab/Specimen L4 | Billing, P360 | Link to prior reject | Lab | **No** | Staff **RECOMMENDED** | **PD-LAB-SPEC-COM-01** | **PD** | New/updated order visibility | Yes | recollect count | New clinical id + finance key | Lab + Billing | **PRODUCT DECISION REQUIRED** |
| Accession assigned | Accession L4 | Analytics, barcode print | Accession number / barcode value | Lab | **No** | None typical | None | None | Optional accession display **PD** | Yes | accession volume | Unique accession per policy **PD** | Lab accession ACL | **FUTURE** L4 |
| Processing started | Status `in_progress` | P360, Analytics | Status | Lab | **No** | Optional | None unless PD | None | Status | Yes | WIP count | Transition idempotent | Process ACL | **RECOMMENDED** |
| External referral dispatched | Referral L12 | Ext lab partner, Analytics, Billing **PD-LAB-EXT-COM-01** | Partner, dispatch time | Lab owns referral; partner owns external accession | Partner result ingest may update Lab **only via Lab ingest API** | Lab + partner ops **RECOMMENDED** | Send-out cost **PD** | **PD** | External badge | Yes | send-out volume | Dispatch idempotency | Ext ACL | **FUTURE** L12 |
| External result received | Lab ingest + docs | Lab, Documents, P360 | Result payload / PDF | Lab clinical; Documents file | Ingest is Lab-owned API | Lab review queue **RECOMMENDED** | Reconciliation **PD** | **PD** | Pending review vs released **PD** | Yes | external TAT | Ingest idempotent by external accession | Integration principal | **FUTURE** L12 |
| Results entered / imported | Observations L5 / flat today | Lab only until verify | Values, flags | Lab | **No** | None until release (avoid noise) **RECOMMENDED** | None | None | **Do not** show unreleased values to patient **PRODUCT DECISION REQUIRED** | Yes | entry backlog | Draft save idempotent | Result entry ACL | L5 **RECOMMENDED** |
| Technically validated | Observation/validate L5–6 | Lab | Validation stamp | Lab | **No** | Optional verifier queue | None | None | Staff P360 only if policy | Yes | validate lag | Once | Validator ACL | **FUTURE** L6 |
| Clinically verified | Verification L6 | Lab | Verifier id/time | Lab | **No** | Verifier complete → release queue | None | None | Staff | Yes | verify backlog | Once | **PD-LAB-VER-02** | **PRODUCT DECISION REQUIRED** |
| Critical result detected | CriticalResultEvent L7 | Notifications, Audit, Analytics, clinician views | Crit analyte, value, ack SLA | Lab event; Comms orchestration | Ack may update Lab critical-event state **via Lab API only** | **Required** escalate path **PD-LAB-CRIT-02** | None | None | Crit badge for authorized staff; patient **PD** | Mandatory | time-to-ack | Event id unique; retry notify | Crit ACL | **PRODUCT DECISION REQUIRED** / L7 |
| Result released (`completed`) | `LabReport` + Observations + Diagnostic envelope | P360, Documents, Notifications, Analytics, clinician views | Released values, interpretation, report meta | Lab SoT for clinical release | **No** | Result-ready clinician + patient prefs **RECOMMENDED** / **PD-LAB-NOTIF-01** | None (unless PD ties) | None | Show released results + docs | Mandatory | release TAT | Release once; amend via L9 | Release ACL (**PD-LAB-VER-02**) | Mixed APPROVED intent / PD detail |
| Document attached | Canonical assoc Slice 4 | Documents, P360 Documents | File meta, domain=lab | Documents platform + Lab association | Document platform supersede **must not** flip Lab clinical status (EXISTING CERTIFIED attach≠complete) | Optional | None | None | Documents tab | Yes | attach count | Canonical identity dedup | Attach ACL | **EXISTING CERTIFIED** |
| Amendment released | ResultVersion L9 | P360, Documents, Notifications, Audit | Current vs historical versions | Lab clinical versions; Docs supersede PDF | **No** (amend via Lab API) | Clinician + audit notify **RECOMMENDED** | None | None | Current projection only; history authorized | Mandatory | amend rate | Version number monotonic | Amend ACL | **FUTURE** L9 |
| Charge posted / reversed | Billing `OpdBill` line (+ Lab ref) | Billing, CCMS, Finance, Analytics | Amounts, SourceRef→LabReport/Item | **Billing** | Billing **must not** mutate Lab status; may store Lab ref | Payment/receipt via Billing/Cashier | Charge/reverse | Claim line feed **via Billing/CCMS contracts** | Billing status chip only if FIN-VIS | Billing + Lab correlation audit | revenue / outstanding | Outbox + idempotency keys (**EXISTING CERTIFIED** Billing patterns) | Billing permissions | **PRODUCT DECISION REQUIRED** timing; pattern **APPROVED** |
| Payment collected / failed | Billing payment | Billing, Notifications, (Lab hold **PD-LAB-PAY-01**) | Paid/unpaid | Billing | Lab hold only if Lab API invoked under PD | Payment notify Billing-owned | Payment | May unlock claim | Optional payable status | Billing audit | collection | Payment idempotency | Cashier | **PRODUCT DECISION REQUIRED** for Lab gate |
| TAT breach | Derived from Lab timestamps | Notifications, Analytics | Breach metric | Lab detects; Comms sends | **No** | Ops + clinician **PD-LAB-TAT-01** | None | None | Optional SLA badge | Yes | breach count | Deduped breach alerts | Ops ACL | **PRODUCT DECISION REQUIRED** |

---

## B. Source-of-truth matrix

| Concern | Authoritative SoT | Must not become SoT | Status |
|---|---|---|---|
| Laboratory order / status / items / specimen / results / verification / critical / QC | **Laboratory** (`LabReport` tree) | P360, Billing, CCMS, Documents meta alone | **APPROVED** |
| Patient identity / MPI | Patient / MPI | Lab denorm names only | **APPROVED** |
| Visit / encounter identity | Visit / Encounter services | Lab `VisitId` is reference | **APPROVED** |
| Commercial SKU / price / branch / payer tariff | Service Catalog + `variant_prices` + Billing resolver | LaboratoryTestDefinition price fields | **APPROVED** |
| Bill / payment / receipt / refund / discount | Billing ledger (`OpdBill` / IP bill patterns) | LaboratoryBill* | **APPROVED** |
| Eligibility / coverage / claim / settlement | Insurance / CCMS | Lab estimate UI | **APPROVED** |
| Canonical file bytes / document identity | Documents platform (Slice 4) | Lab `ReportUrl` alone as long-term SoT | **EXISTING CERTIFIED** |
| In-app / SMS / WhatsApp / email delivery | NotificationService + orchestration | Hard-wired Lab channel clients | **APPROVED** (PD-LAB-COM-01) |
| Audit trail of Lab mutations | Lab audit + `IAuditService` | Client logs | **RECOMMENDED** progressive |
| Analytics aggregates | Analytics store derived from events | Editing Lab from dashboards | **RECOMMENDED** |
| Counsellor investigation orders | Counsellor SoT until L16 bridge | LabReport auto-create | **APPROVED** (PD-LAB-14) |

---

## C. Projection matrix

| Consumer | What is projected | Projection type | Mutates Lab? | Status |
|---|---|---|---|---|
| Patient Directory / hub lists | Optional lab activity indicators **RECOMMENDED** later | Read model / badge | No | **RECOMMENDED** / **FUTURE** |
| Patient 360 Clinical | Orders, status, released results, interpretation | API read (`labReports` by patient) | No | **EXISTING CERTIFIED** (expand carefully) |
| Patient 360 Documents | Lab canonical files | Documents filter `laboratory` | Attach via Lab/Doc APIs only | **EXISTING CERTIFIED** |
| Billing workbench | Charge lines with `SourceRef` → LabReport/Item | Billing items | No Lab mutation | **RECOMMENDED** after COM |
| CCMS / Insurance | Covered lab lines / status from Billing + coverage case | Claim/coverage projection | No Lab mutation | **PRODUCT DECISION REQUIRED** depth |
| Clinician downstream views | Released results / crit alerts | Read | No | **RECOMMENDED** |
| Notifications inbox | Intent payloads (order/result/crit) | Message | Ack via Lab API for crit only | **RECOMMENDED** |
| Analytics dashboards | Counts, TAT, rejects, backlog | Aggregates | No | **FUTURE** / embed hooks earlier |
| FHIR/HL7 adapters | Mapped resources/messages | Adapter export | Import only via Lab ingest APIs | **FUTURE** L10–L11 |

---

## D. Mutation boundary matrix

| Actor / system | Allowed Lab mutations | Forbidden | Status |
|---|---|---|---|
| Laboratory UI / Lab APIs | Full Lab lifecycle per ACL | Billing ledger writes | **APPROVED** |
| Billing / Cashier | None on Lab status/results | Setting `completed`/`cancelled` from bill pay | **APPROVED** |
| CCMS / Claims | None on Lab clinical state | Closing Lab from claim settle | **APPROVED** |
| Patient 360 UI | None (read + authorized doc preview); attach only via existing Lab attach contract | Editing results/status | **APPROVED** |
| Notification delivery | None (except user ack of critical via **Lab** ack API) | Auto-release on notify | **APPROVED** |
| Documents platform | Supersede/replace file association per Slice 4 rules | Changing Lab clinical Status/results | **EXISTING CERTIFIED** |
| Integration / LIS / Analyzer | Only through Lab gateway ingest contracts | Direct table writes | **RECOMMENDED** / **FUTURE** |
| Counsellor Desk | No auto LabReport until L16 bridge decision | Silent dual-write | **APPROVED** |

---

## E. Integration / API / event requirements

| Integration | Required contract | Mechanism preference | Status |
|---|---|---|---|
| Lab → P360 | Continue patient-scoped LabReport + canonical reads | Existing REST loaders | **EXISTING CERTIFIED**; enrich **RECOMMENDED** |
| Lab → Billing | Command: resolve price; post/reverse charge with Lab `SourceRef` + idempotency | Existing `IChargeCatalogResolver` + OpdBill item APIs; **PD-LAB-BILL-06** SourceType | **PRODUCT DECISION REQUIRED** timing; APIs **EXISTING** |
| Billing → CCMS | Existing bill finalized / coverage outbox | `billing_ccms_outbox` | **EXISTING CERTIFIED** — Lab does not own |
| Lab → CCMS (direct) | Avoid duplicate; prefer Billing-mediated claim lines | — | **RECOMMENDED** |
| Lab → Communications | Publish CommunicationIntent (order/specimen/result/crit/TAT) | CCMS-style dispatch + NotificationService/Hub | **RECOMMENDED**; intent catalog **PD-LAB-NOTIF-01** |
| Lab → Audit | Write on create/transition/release/amend/crit | `IAuditService` + Lab status history | **RECOMMENDED** |
| Lab → Analytics | Emit metric points / query timestamps | Prefer query of Lab tables + optional event log; no new bus required initially | **RECOMMENDED** |
| Lab → Documents | Attach/list/download via Slice 4 | Existing LabReport canonical service | **EXISTING CERTIFIED** |
| External → Lab | Result/referral ingest API | Dedicated Lab ingest (L12/L13) | **FUTURE** |

**Do not** introduce Socket.IO or a second global event bus for Lab.

---

## F. Idempotency requirements

| Operation | Idempotency rule | Status |
|---|---|---|
| LabReport create (clinical) | Natural key optional; avoid duplicate posts from double-submit (FE + server) | **RECOMMENDED** |
| Charge post from Lab | Mandatory idempotency key including tenant + LabReport/Item + charge reason (**PD-LAB-BILL-05**) | **PRODUCT DECISION REQUIRED** (key shape) / Billing pattern **EXISTING** |
| Charge reverse | Billing OT-020 style negative line; no silent delete | **EXISTING CERTIFIED** Billing pattern |
| Status transition | Same transition twice = no-op success | **RECOMMENDED** |
| Critical notify | Dedupe by CriticalResultEvent id | **RECOMMENDED** / L7 |
| Document attach | Canonical association uniqueness (Slice 4) | **EXISTING CERTIFIED** |
| External ingest | Keyed by partner + external accession | **FUTURE** |
| Billing↔CCMS outbox | Existing unique idempotency on outbox | **EXISTING CERTIFIED** |

---

## G. Failure / retry behavior

| Failure class | Behavior | Status |
|---|---|---|
| Lab clinical save fails | No partial Billing post; user-visible error | **APPROVED** |
| Billing post fails after Lab order | Lab order remains; Billing exception / retry queue; **do not** fake paid | **APPROVED**; unpaid clinical gate **PD-LAB-PAY-01** |
| Notification send fails | Clinical state unchanged; retry via orchestration; surface failed intent | **RECOMMENDED** |
| CCMS outbox fail | Existing outbox retry/abandon | **EXISTING CERTIFIED** |
| Document attach fails | Clinical status unchanged (attach≠complete) | **EXISTING CERTIFIED** |
| External partner timeout | Lab referral stays dispatched; ops retry | **FUTURE** L12 |
| P360 read fail | Soft empty/error in projection; no Lab write | **APPROVED** |

---

## H. Security boundary

| Boundary | Rule | Status |
|---|---|---|
| Tenant / branch | All Lab + projections tenant-scoped; branch per existing authz | **APPROVED** |
| Clinical Lab ACL | Lab ops permissions (interim `laboratory.view` + `patient.*`; final **PD-LAB-PERM-02**) | **PRODUCT DECISION REQUIRED** cutover |
| Financial visibility in Lab UI | Prices/payable only if **PD-LAB-FIN-VIS-01** | **PRODUCT DECISION REQUIRED** |
| Billing mutations | Billing permissions only | **APPROVED** |
| Insurance mutations | CCMS permissions only | **APPROVED** |
| Patient-visible results | Released-only default; unpaid hide **PD** | **PRODUCT DECISION REQUIRED** |
| PHI in notifications | Minimal necessary; no PHI in URLs/logs | **APPROVED** (platform privacy) |
| Integration principals | Scoped ingest credentials; no wildcard clinical write | **RECOMMENDED** / **FUTURE** |
| Cross-domain reads | Prefer BFF/existing APIs with caller JWT; no shared DB writes | **APPROVED** |

---

## I. Patient 360 visibility rules

| Data | Staff P360 | Patient portal (if any) | Status |
|---|---|---|---|
| Order exists / status (ordered…on_hold) | Yes (authorized) | **PRODUCT DECISION REQUIRED** (often yes for own orders) | Mixed |
| Unreleased results / drafts | Authorized Lab/clinical staff only | **No** | **APPROVED** intent |
| Released results (`completed`) | Yes | Yes if product enables lab portal | **RECOMMENDED** |
| Critical flags | Authorized staff; ack workflow | **PRODUCT DECISION REQUIRED** | **PRODUCT DECISION REQUIRED** |
| Canonical documents | Per document ACL + lab filter | Released/attached only | **EXISTING CERTIFIED** pattern |
| Prices / balances | Only if FIN-VIS + billing permission | Billing portal rules — not Lab | **APPROVED** |
| Ops actions (collect, verify, cancel) | **Forbidden** in P360 | **Forbidden** | **APPROVED** |

---

## J. Billing reflection requirements

| Requirement | Detail | Status |
|---|---|---|
| Ownership | Billing ledger only | **APPROVED** |
| Lab reference | Persist `SourceRef` / correlation to `LabReport` and/or `LabReportItem` | **RECOMMENDED** |
| SourceType | **PD-LAB-BILL-06** (typed Lab vs Manual) | **PRODUCT DECISION REQUIRED** |
| Price | `IChargeCatalogResolver` via mapped `ServiceVariantId` | **APPROVED** SoT |
| Timing | Order / confirm / collect / other | **PD-LAB-BILL-01** **PRODUCT DECISION REQUIRED** |
| Cancel/reject/recollect | Reversal rules | **PD-LAB-BILL-02**, **PD-LAB-SPEC-COM-01** |
| Lab UI | May show billing **status** chips when authorized; payment in Billing/Cashier | **APPROVED** |
| Failure | Lab clinical success ≠ financial success unless PD couples them | **APPROVED** |

---

## K. Insurance / CCMS reflection requirements

| Requirement | Detail | Status |
|---|---|---|
| Ownership | CCMS / Insurance for eligibility, auth, claim, settlement | **APPROVED** |
| Path | Prefer Billing line → CCMS (existing outbox) over Lab→CCMS dual write | **RECOMMENDED** |
| Lab Order Summary | May show coverage **share/status** read-only (**PD-LAB-INS-02**, FIN-VIS) | **PRODUCT DECISION REQUIRED** |
| `estimatedLab` on coverage drafts | Not LabReport SoT | **EXISTING** field / **not** Lab integration |
| Claim packet lab lines | From billed covered services | **FUTURE** / **PRODUCT DECISION REQUIRED** mapping detail |
| CCMS must not | Become Lab workbench or mutate Lab status | **APPROVED** |

---

## L. Notification requirements

| Intent (logical) | Trigger event | Recipients (typical) | Channel ownership | Status |
|---|---|---|---|---|
| `lab.order.created` | Order created | Lab queue / ordering clinician optional | Orchestration | **RECOMMENDED**; catalog **PD-LAB-NOTIF-01** |
| `lab.specimen.rejected` | Reject | Ordering clinician + lab | Orchestration | **RECOMMENDED** L4 |
| `lab.result.ready` | Released | Ordering clinician; patient per prefs | Orchestration + Hub | **RECOMMENDED** L6; prefs stub exists **YELLOW** |
| `lab.result.critical` | Critical detect | On-call / clinician; ack required | Orchestration | **PRODUCT DECISION REQUIRED** (**PD-LAB-CRIT-02**) |
| `lab.tat.breach` | SLA exceeded | Ops / clinician | Orchestration | **PRODUCT DECISION REQUIRED** (**PD-LAB-TAT-01**) |
| `lab.external.received` | Ext result ingest | Lab review | Orchestration | **FUTURE** L12 |
| Payment notices | Payment events | Patient/cashier | **Billing-owned** | **APPROVED** (not Lab) |

UI toasts remain local UX feedback only — not a substitute for orchestration (**APPROVED** distinction).

---

## M. Analytics requirements

| Metric / event | Source | Phase | Status |
|---|---|---|---|
| Orders created / by priority | LabReport | L2+ | **RECOMMENDED** |
| Status dwell / TAT (order→collect→release) | Timestamps | L3–L6 as fields exist | **RECOMMENDED** |
| Rejection / recollection rate | Specimen L4 | L4 | **FUTURE** |
| Verification backlog | Verify queue L6 | L6 | **FUTURE** |
| Critical time-to-ack | Critical events L7 | L7 | **FUTURE** |
| External lab performance | Referral L12 | L12 | **FUTURE** |
| Revenue / outstanding / payer mix | **Billing** aggregates joined by Lab ref | After COM | **RECOMMENDED** (Billing-owned numbers) |
| QC fail rate | QC L8 | L8 | **FUTURE** |

Analytics must not write Lab clinical state (**APPROVED**).

---

## N. Document projection requirements

| Requirement | Detail | Status |
|---|---|---|
| Canonical Lab documents | Slice 4 association `Domain=lab`, `EntityType=LabReport` | **EXISTING CERTIFIED** |
| Attach ≠ clinical completion | Preserve | **EXISTING CERTIFIED** / **APPROVED** |
| P360 Documents | Laboratory filter + preview/download | **EXISTING CERTIFIED** |
| Release PDF | May attach/supersede on release/amend | **RECOMMENDED** L6/L9 |
| Deduplication | Canonical identity rules | **EXISTING CERTIFIED** |
| FHIR DiagnosticReport file ≠ domain SoT | Adapter **FUTURE** L10 | **APPROVED** adapter rule |

---

## O. Acceptance criteria per integration

| Integration | Acceptance criteria (when that slice ships) | Status of criteria |
|---|---|---|
| P360 | Authorized user sees Lab orders/status; sees **released** results/docs; cannot perform Lab ops from P360 | **APPROVED** |
| Billing | Charge/reverse appears only in Billing ledger with Lab correlation; double-submit does not double-charge; Lab UI never invents totals | **APPROVED** intent; timing **PD** |
| CCMS | Covered lab charges flow via approved Billing/CCMS path; CCMS cannot change Lab status | **APPROVED** |
| Notifications | Intents retry without corrupting Lab state; critical requires ack via Lab API | **RECOMMENDED** / crit **PD** |
| Analytics | Dashboards match Lab/Billing source queries within defined lag; no write-back | **RECOMMENDED** |
| Documents | Attach/list/preview works; attach does not mark completed | **EXISTING CERTIFIED** |
| Audit | Create/transition/release/amend/crit produce auditable records without PHI in logs | **RECOMMENDED** |
| Mutation boundary | Automated tests/contracts prove Billing/CCMS/P360 cannot set Lab status | **RECOMMENDED** |
| Idempotency | Documented keys enforced on finance + release + crit notify | **RECOMMENDED** / finance **PD** |
| Security | Financial fields hidden without FIN-VIS; patient cannot read unreleased results | **APPROVED** intent; FIN-VIS **PD** |

---

## Downstream clinical views

| View | Reflection | Mutate Lab? | Status |
|---|---|---|---|
| Ordering clinician chart / desk | Released results + crit alerts | No | **RECOMMENDED** |
| Ward / IP clinical | IP lab orders/status for admitted patient | No | **RECOMMENDED** / encounter bind **PD** detail |
| Counsellor Desk | Separate until bridge; may show linked LabReport after L16 | No auto | **APPROVED** |
| Optometry / other clinical modules | Read released lab relevant to eye care as needed | No | **FUTURE** as requested |

---

## Relationship to commercial PDs

PD-LAB-INT-01 **approves integration boundaries and reflection duties**. It does **not** approve:

- Charge timing (**PD-LAB-BILL-01**)
- SourceType (**PD-LAB-BILL-06**)
- Unpaid clinical gate (**PD-LAB-PAY-01**)
- Insurance display depth (**PD-LAB-INS-01/02**)
- Notification recipient catalog (**PD-LAB-NOTIF-01**)
- Multi-item cancel rollup (**PD-LAB-MULTI-02**)

Those remain **PRODUCT DECISION REQUIRED** and gate implementation slices in the roadmap rebaseline.

---

## Explicit non-goals (this decision)

- Implementing outbox tables, intents, Billing posts, P360 changes, or APIs  
- Inventing LaboratoryBill / Lab claims engine  
- Making P360/Billing/CCMS into Lab workbenches  
- Adding statuses or FHIR resources  
- Claiming L2 acceptance or starting L3 coding  

---

## Final status

```text
PD-LAB-INT-01 DECISION RECORD COMPLETE
CROSS-DOMAIN PRINCIPLES: APPROVED (P1–P10)
DETAILED TIMING/PAYLOADS: PHASE-GATED PRODUCT DECISIONS
NO CODE CHANGES
L2 ACCEPTANCE NOT CLAIMED
L3 IMPLEMENTATION NOT STARTED
READY FOR REMAINING PRODUCT DECISIONS (BILL/INS/NOTIF/MULTI)
```
