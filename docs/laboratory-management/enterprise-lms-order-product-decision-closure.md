# L-ORD-01A-PD — Enterprise LMS Order Intake Product Decision Closure

**Date:** 2026-10-09  
**Slice:** L-ORD-01A-PD (product decision closure only)  
**Mode:** DOCUMENTATION ONLY — no schema, API, UI, permission seed, or Pathology changes  
**Upstream audit:** [enterprise-lms-order-intake-audit.md](./enterprise-lms-order-intake-audit.md) (`READY_FOR_PRODUCT_DECISIONS`)  
**Downstream implementation:** L-ORD-01B — Order Domain Foundation — see [enterprise-lms-order-implementation-report.md](./enterprise-lms-order-implementation-report.md)

```text
PRD / BRD
  ↓
L-ORD-01A audit
  ↓
PD-ORD decisions (this document)  ← GATE CLOSED
  ↓
L-ORD-01B implementation (authorized + implemented — STOP for next review)
```

---

## 1. Gate summary

| Item | Status |
|---|---|
| L-ORD-01A audit | Accepted baseline |
| PD-ORD-01 … PD-ORD-19 | **CLOSED** (see §3) |
| Architectural baseline | **CONFIRMED** (§2) |
| L-ORD-01B | **Implemented** (domain/API) — Manual UI UAT deferred |

**Gate determination:** `L-ORD-01A-PD — PRODUCT DECISION GATE CLOSED`  
**L-ORD-01B:** `IMPLEMENTATION_COMPLETE_STOP_FOR_NEXT_REVIEW`

---

## 2. Architectural baseline (confirmed)

Unless contradicted by a later explicit architecture change, the following are authoritative for L-ORD-01:

| Topic | Decision |
|---|---|
| UI workspace | `/dashboard/lms/orders` |
| Backend owner | **LaboratoryApi** (`/api/lms/*`) |
| Persistence | Shared PostgreSQL `hospitalportal`; LaboratoryApi-owned `lms_*` order tables |
| Microservice | **No** new Order microservice |
| Catalogue SoT | LaboratoryApi LMS Catalogue; orderables resolution **inside** LaboratoryApi |
| Pathology | Separate track (`/dashboard/laboratory`); **no** LMS SoT; **no** write-through sync |
| Platform masters | Reference Patient, Visit, User/provider, Branch by ID — **no** LMS copies |
| Consent SoT | Existing platform consent — **no** LMS consent master |
| Financial SoT | Billing (charges/payments/refunds); CCMS for coverage/authorization where applicable |
| Audit SoT | Platform `audit_log` via `PlatformAuditClient` → AuthService `POST /api/internal/audit` |
| Tenant | From authenticated JWT context only — never trust client `TenantId` |
| Branch authz | Server-enforced; FE filtering is not security |
| LMS order permissions | `lms.orders.view` / `.create` / `.manage` — **not** `laboratory.view` or `patient.update` |
| Charge timing | Preserve PD-LAB-BILL-01 / PAY-01: no payment block at order create; normal OPD charge at specimen collection |

### Catalogue orderable rule (mandatory at submit / orderables API)

Resolve only definitions satisfying **all** of:

1. Version `Status = Active`  
2. Order time within `EffectiveFrom` / `EffectiveTo`  
3. Branch applicable (tenant-wide when no applicability rows; else operating branch explicitly listed)  
4. `Orderable = true`  
5. Parent catalogue item not soft-deleted  

Do **not** use the administrative catalogue list as Order Intake SoT.  
Do **not** use Pathology catalogue APIs.

---

## 3. Decision register (PD-ORD-01 … PD-ORD-19)

### PD-ORD-01 — Visit / encounter

| Field | Content |
|---|---|
| **Decision ID** | PD-ORD-01 |
| **Decision** | LMS Order references platform **Visit** when applicable; no LMS Encounter entity |
| **Status** | **APPROVED** |
| **Approved behavior** | Order may include `VisitId` → existing AuthService Visit. OPD intake uses the active/selected Visit **when applicable**. Do not manufacture a Visit solely to create a lab order. Do not copy Visit rows into LMS. When `VisitId` is supplied, server validates: exists, same tenant, belongs to selected patient, satisfies applicable branch/site policy. |
| **Rationale / boundary** | PRD encounter selection maps to platform Visit for OPD; audit flagged visit binding open; Pathology optional Visit is not the enterprise rule to invent a second encounter master. Non-OPD journey references (e.g. IP) are a **later** product decision — not a new Encounter master in L-ORD-01. |
| **Implementation consequence** | L-ORD-01B stores optional/context-bound `VisitId`; validation against platform Visit APIs/data; FE may omit Visit when no applicable encounter exists. |
| **Out of scope** | New Encounter entity; generic enterprise Encounter abstraction; fabricating visits; IP journey binding rules beyond documenting deferral |
| **Source / evidence** | L-ORD-01A audit §5; `VisitsController`; PD-LAB-BILL-04 Visit/Journey capture guidance; this closure brief |

---

### PD-ORD-02 — Provider eligibility

| Field | Content |
|---|---|
| **Decision ID** | PD-ORD-02 |
| **Decision** | Ordering Provider and Responsible Clinician are distinct platform **User** ID references |
| **Status** | **APPROVED** |
| **Approved behavior** | Store User IDs (not LMS provider master). Validate: user exists, tenant membership, active/eligible per **authoritative platform authorization model available to LMS**. Do **not** adopt Pathology `role.Name.Contains("Doctor")` as the enterprise LMS rule. Do not invent credentials/specialty/license/scope engines in L-ORD-01. Ordering Provider ≠ Responsible Clinician (both may be required fields at submit per UX, both are User refs). |
| **Rationale / boundary** | Avoid hard-coding Pathology doctor-string eligibility; stronger enterprise eligibility engine deferred until platform provides it. |
| **Implementation consequence** | L-ORD-01B validates User IDs server-side (tenant + active + any existing LMS-safe authz check). If no stronger eligibility API exists, validate existence/tenant/active without inventing Doctor-string matching. Display-name snapshots per PD-ORD-05. |
| **Out of scope** | LMS provider master; credential/scope engines; Pathology ordering-clinicians as SoT for LMS rules |
| **Source / evidence** | L-ORD-01A audit §6; Pathology `CreateFromCatalog` doctor check (negative reuse); this closure brief |

---

### PD-ORD-03 — Order source

| Field | Content |
|---|---|
| **Decision ID** | PD-ORD-03 |
| **Decision** | Controlled order-source value set (no free text) |
| **Status** | **APPROVED** |
| **Approved behavior** | Allowed values: `Clinician`, `SelfRequested`, `Referral`, `Imported`, `Integration`. `SelfRequested` requires patient acknowledgement/evidence per PD-ORD-08 consent/policy flow. `Referral` is a first-class **source** only. |
| **Rationale / boundary** | PRD requires order source; no platform LMS taxonomy existed — this closure defines the controlled set. |
| **Implementation consequence** | Persist enum/code on order; reject unknown values server-side; SelfRequested submit fails without required acknowledgement evidence. |
| **Out of scope** | Free-text source; referral shipment/receipt/partner ops; Imported/Integration detailed contracts |
| **Source / evidence** | L-ORD-01A audit §7; this closure brief |

---

### PD-ORD-04 — Operating site / performing site

| Field | Content |
|---|---|
| **Decision ID** | PD-ORD-04 |
| **Decision** | Operating branch = authorized/selected LMS branch; no default cross-site ordering |
| **Status** | **APPROVED** |
| **Approved behavior** | `OperatingBranchId` is the operational context of order creation. Catalogue applicability evaluated against operating branch. Cross-site ordering **not permitted by default**. Performing/service location may differ from operating branch **only** when an explicitly configured and authorized capability exists. If platform cannot safely support distinct performing site, L-ORD-01 keeps performing location **equal** to operating branch. |
| **Rationale / boundary** | Aligns with PD-CAT-03 Branch IDs; avoids inventing site hierarchy or silent cross-site orders. |
| **Implementation consequence** | Server derives/validates operating branch against user authorization; orderables filter by that branch; no new Organization/Site/Section masters. |
| **Out of scope** | New site hierarchy; default cross-site ordering; inventing performing-site when unsupported |
| **Source / evidence** | L-ORD-01A audit §8; PD-CAT-03; this closure brief |

---

### PD-ORD-05 — Identity snapshots

| Field | Content |
|---|---|
| **Decision ID** | PD-ORD-05 |
| **Decision** | Platform IDs + immutable historical display snapshots at submit |
| **Status** | **APPROVED** |
| **Approved behavior** | Persist `PatientId` plus `PatientMrnSnapshot`, `PatientNameSnapshot`, `PatientDateOfBirthSnapshot` captured at **submit**. Provider display snapshots may be stored for historical readability. Snapshots are **not** master data and must never update Patient/User masters. Drafts may show live platform data; submit freezes snapshots. |
| **Rationale / boundary** | Audit/readability vs MPI SoT — IDs remain authoritative. |
| **Implementation consequence** | Snapshot columns/fields on submitted order (and versions); draft APIs may omit frozen snapshots until submit. |
| **Out of scope** | Second patient/provider master; using snapshots to “fix” MPI |
| **Source / evidence** | L-ORD-01A audit §4 / PD-ORD-05; this closure brief |

---

### PD-ORD-06 — AOE / clinical questions

| Field | Content |
|---|---|
| **Decision ID** | PD-ORD-06 |
| **Decision** | L-ORD-01 MVP = indication/reason field only |
| **Status** | **APPROVED** |
| **Approved behavior** | Capture clinical indication/reason on the order. Do not build configurable AOE (pregnancy, fasting, isolation, medication interference, specimen-specific questionnaires). Do not treat unimplemented catalogue question/config refs as executable. |
| **Rationale / boundary** | No authoritative AOE framework in repository; PRD AOE deferred to a governed configuration slice. |
| **Implementation consequence** | Single indication/reason (and related free-text notes if already patterned) on order; no AOE answer tables in L-ORD-01. |
| **Out of scope** | Generic AOE engine; catalogue-driven questionnaires |
| **Source / evidence** | L-ORD-01A audit §12; this closure brief |

---

### PD-ORD-07 — Priority

| Field | Content |
|---|---|
| **Decision ID** | PD-ORD-07 |
| **Decision** | Priority vocabulary Routine / Urgent / STAT with reason rules |
| **Status** | **APPROVED** |
| **Approved behavior** | Values: `Routine`, `Urgent`, `STAT`. Routine: no priority reason required. Urgent and STAT: **reason required**. Persist priority + reason for auditability. |
| **Rationale / boundary** | Aligns with existing Pathology value set conceptually; PRD reason requirement closed here. After-hours / STAT worklist deferred. |
| **Implementation consequence** | Server validates reason presence for Urgent/STAT; storage on order (and versions). |
| **Out of scope** | After-hours feasibility engine; STAT monitored work queue; inventing routing policy |
| **Source / evidence** | L-ORD-01A audit §13; `LAB_REPORT_PRIORITIES` precedent (vocabulary only); this closure brief |

---

### PD-ORD-08 — Consent / privacy

| Field | Content |
|---|---|
| **Decision ID** | PD-ORD-08 |
| **Decision** | Platform consent remains SoT; LMS stores references + required acknowledgement only |
| **Status** | **APPROVED** |
| **Approved behavior** | Do not create `LmsConsentMaster`, templates, or duplicate patient consent records. Where consent is required: reference authoritative platform consent record; capture order-level acknowledgement/evidence only when required; preserve consent/template/version reference; audit acknowledgement. Dual existing platform consent stacks must not justify LMS duplication — L-ORD-01B selects the integration adapter by inspecting the authoritative platform endpoint(s). |
| **Rationale / boundary** | Avoid second consent system; adapter choice is implementation inspection, not a new product fork. |
| **Implementation consequence** | Optional consent reference IDs + acknowledgement evidence fields on order; SelfRequested ties to PD-ORD-03. |
| **Out of scope** | New LMS consent ledger/templates; inventing a third consent product |
| **Source / evidence** | L-ORD-01A audit §14; AuthService consents / patient-consents; this closure brief |

---

### PD-ORD-09 — Payer / authorization / financial disposition

| Field | Content |
|---|---|
| **Decision ID** | PD-ORD-09 |
| **Decision** | LMS may reference payer/authorization/financial disposition; Billing/CCMS remain SoT |
| **Status** | **APPROVED** |
| **Approved behavior** | Order may store/reference payer context, service catalog ref, authorization ref, financial disposition/ref. Order creation **not** blocked solely because payment has not occurred. **No** charge posting at order creation. Normal OPD lab charging remains at specimen collection (PD-LAB-BILL-01). CCMS = coverage/authorization SoT where applicable. Billing = charge/payment/refund/reversal SoT. Financial state must never overwrite clinical order state. |
| **Rationale / boundary** | Certified PD-LAB-PAY-01 / BILL-01 / BILL-02 ownership. |
| **Implementation consequence** | Reference fields only in L-ORD-01; no OpdBill/charge create from LMS order submit. |
| **Out of scope** | Laboratory financial ledger; payments; refunds; claim creation; overwriting clinical status from finance |
| **Source / evidence** | L-ORD-01A audit §15–16; `laboratory-management-product-owner-decision-closure.md` PAY/BILL; this closure brief |

---

### PD-ORD-10 — Order and OrderTest status

| Field | Content |
|---|---|
| **Decision ID** | PD-ORD-10 |
| **Decision** | Smallest intake state model |
| **Status** | **APPROVED** |
| **Approved behavior** | **Order:** `Draft` → `Submitted` → `Cancelled`. Draft editable; Submitted immutable except via amendment (PD-ORD-11); Cancelled terminal. No client-arbitrary status; no Submitted→Draft; no Cancelled→Submitted; no silent mutation of Submitted; **no** normal `Amended` status (amendment is versioning). **OrderTest** initial state: `Ordered` only in L-ORD-01. |
| **Rationale / boundary** | Distinct Order vs Test semantics; later stages own Collected/Received/etc. |
| **Implementation consequence** | Server-owned transitions only; OrderTest remains `Ordered` until later slices. |
| **Out of scope** | `Collected`, `Received`, `InProgress`, `Verified`, `Authorized`, `OnHold` in L-ORD-01 |
| **Source / evidence** | L-ORD-01A audit §18; this closure brief |

---

### PD-ORD-11 — Amendment model

| Field | Content |
|---|---|
| **Decision ID** | PD-ORD-11 |
| **Decision** | Version-chain amendment model |
| **Status** | **APPROVED** |
| **Approved behavior** | Submitted orders are not silently edited. Amendment produces a new submitted version (e.g. v1 → v2), preserving previous version, new version, reason, actor, timestamp, affected fields/lines, catalogue version references. Optimistic concurrency required. Physical table shape may be finalized in L-ORD-01B if this semantic contract is preserved. |
| **Rationale / boundary** | PRD immutability + amendment; catalogue version-chain analogue. |
| **Implementation consequence** | Amend API + version records; RowVersion checks; audit `AMEND_ORDER` (or equivalent). |
| **Out of scope** | Silent in-place rewrite of submitted content; `Amended` as primary lifecycle state |
| **Source / evidence** | L-ORD-01A audit §17/§19; this closure brief |

---

### PD-ORD-12 — Cancellation

| Field | Content |
|---|---|
| **Decision ID** | PD-ORD-12 |
| **Decision** | Server-side cancel action; terminal; no delete |
| **Status** | **APPROVED** |
| **Approved behavior** | Conceptual `POST /api/lms/orders/{id}/cancel` requiring reason, actor, timestamp, expected RowVersion, audit event. Does not delete the order. Terminal. No reactivation in L-ORD-01. Controlled reason mechanism may follow repository configuration conventions; do not invent a large clinical cancel-reason master. |
| **Rationale / boundary** | Aligns with PD-LAB-ORD-CXL spirit (explicit, auditable, not soft-delete) for LMS vocabulary. |
| **Implementation consequence** | Cancel endpoint + transition to `Cancelled` + audit. |
| **Out of scope** | Reactivation; hard delete; large invented reason taxonomy |
| **Source / evidence** | L-ORD-01A audit §18; PD-LAB-ORD-CXL; this closure brief |

---

### PD-ORD-13 — Panel explosion

| Field | Content |
|---|---|
| **Decision ID** | PD-ORD-13 |
| **Decision** | Preserve panel identity; explode components to OrderTests at submit; validate components |
| **Status** | **APPROVED** |
| **Approved behavior** | On panel submit: keep panel as ordered catalogue identity; create individual OrderTest work items for components; preserve panel and component catalogue item/version IDs; pin exact versions at submission; maintain panel→test traceability. Component versions must be Active + Orderable at submit; inactive/non-orderable component → **fail submit** (no silent invalid order). |
| **Rationale / boundary** | PRD panel-as-container; closes inactive-component gap from audit. |
| **Implementation consequence** | Submit-time panel expansion + validation inside LaboratoryApi. |
| **Out of scope** | Specimen/testing/result behavior for components |
| **Source / evidence** | L-ORD-01A audit §10; L-CAT panel components; this closure brief |

---

### PD-ORD-14 — Human-readable order number

| Field | Content |
|---|---|
| **Decision ID** | PD-ORD-14 |
| **Decision** | Format `LAB-YYYYMMDD-NNNNNN` |
| **Status** | **APPROVED** |
| **Approved behavior** | Example: `LAB-20261009-000001`. Generated server-side; never client-supplied; immutable after creation; unique within tenant; concurrency-safe sequence; GUID remains technical PK; order number is human-facing business id. Do not reuse Pathology LabReport identifiers. Prefer existing enterprise sequential-number mechanism if it satisfies this contract; otherwise smallest LaboratoryApi-owned mechanism in L-ORD-01B. |
| **Rationale / boundary** | Stable operational identifier without PK coupling. |
| **Implementation consequence** | Sequence generation in LaboratoryApi (or reused platform sequencer); unique index (tenant, order number). |
| **Out of scope** | Client-assigned numbers; LabReport ID reuse; order number as PK |
| **Source / evidence** | This closure brief; L-ORD-01A audit PD-ORD-14 |

---

### PD-ORD-15 — Permissions

| Field | Content |
|---|---|
| **Decision ID** | PD-ORD-15 |
| **Decision** | Capability codes `lms.orders.view` / `.create` / `.manage` |
| **Status** | **APPROVED** |
| **Approved behavior** | `view` = read/search; `create` = create and submit; `manage` = amend/cancel/manage lifecycle. Do not use `laboratory.view` or `patient.update` as LMS order gates. Do **not** auto-grant to production roles. Role mapping deferred (consistent with PD-CAT-02). Admin wildcard may support controlled UAT if existing authz allows. |
| **Rationale / boundary** | Matches L0 planned codes; separates Pathology permissions. |
| **Implementation consequence** | Seed **definitions** only when L-ORD-01B is authorized; enforce in `LaboratoryAuthz` + FE; **no** role grants in this closure. |
| **Out of scope** | Automatic production role grants; Pathology permission reuse |
| **Source / evidence** | `lms-permissions.ts` planned codes; PD-CAT-02 pattern; this closure brief |

---

### PD-ORD-16 — Orderables permission

| Field | Content |
|---|---|
| **Decision ID** | PD-ORD-16 |
| **Decision** | `lms.orders.create` may resolve orderables; no catalogue admin required to order |
| **Status** | **APPROVED** |
| **Approved behavior** | Purpose-specific `GET /api/lms/catalogue/orderables` enforcing tenant, branch, Active, effective, Orderable=true, non-deleted parent. Internal permission mapping may use `lms.orders.create`. Must not expose catalogue administration capabilities. |
| **Rationale / boundary** | Separates order composition from catalogue governance (`lms.catalogue.manage` / `.approve`). |
| **Implementation consequence** | Dedicated orderables endpoint in LaboratoryApi during L-ORD-01B (or adjacent foundation slice). |
| **Out of scope** | Using admin catalogue list as SoT; granting manage via orderables |
| **Source / evidence** | L-ORD-01A audit §9 / §22; this closure brief |

---

### PD-ORD-17 — Collection task stubs

| Field | Content |
|---|---|
| **Decision ID** | PD-ORD-17 |
| **Decision** | L-ORD-01 does **not** create CollectionTask records |
| **Status** | **APPROVED** |
| **Approved behavior** | Submit creates order + OrderTest work items only. Collection Planning/Collection owns tasks, scheduling, labels, requisitions, specimen collection. |
| **Rationale / boundary** | PRD stage boundary (intake vs collection planning). |
| **Implementation consequence** | No collection tables/stubs in L-ORD-01B. |
| **Out of scope** | Placeholder collection entities |
| **Source / evidence** | L-ORD-01A audit §23–24; this closure brief |

---

### PD-ORD-18 — Favourites / clinical pathways

| Field | Content |
|---|---|
| **Decision ID** | PD-ORD-18 |
| **Decision** | Defer favourites and clinical pathways from L-ORD-01 MVP |
| **Status** | **APPROVED / DEFERRED** |
| **Approved behavior** | Initial orderable search uses governed catalogue fields already available (display name, internal order code, synonyms, type, discipline, classification, orderability, branch applicability) as appropriate. No favourite/pathway data model in L-ORD-01. |
| **Rationale / boundary** | Not modeled in L-CAT-01B; PRD search facets deferred without blocking intake MVP. |
| **Implementation consequence** | Search filters limited to existing catalogue attributes. |
| **Out of scope** | Favourites engine; clinical pathway engine/model |
| **Source / evidence** | L-ORD-01A audit §9 / PD-ORD-18; this closure brief |

---

### PD-ORD-19 — Unresolved catalogue configuration references

| Field | Content |
|---|---|
| **Decision ID** | PD-ORD-19 |
| **Decision** | Safety-oriented block-vs-informational rule for config refs |
| **Status** | **APPROVED** |
| **Approved behavior** | If a configuration is **required for safe execution of the current stage**, **block** the affected action. If **informational only**, may display “Not configured” and continue. L-ORD-01 must **not** invent clinical blocking for TAT, operating hours, age/sex restrictions, reference intervals, critical values, delta checks, autoverification, or specimen rules when no execution engine exists. Unresolved informational nullable refs must not block ordinary composition. Config required for order creation must block submit until resolved. Config belonging to Collection/Testing is deferred to those stages — do not block order creation without approved policy. |
| **Rationale / boundary** | Catalogue stores many nullable `*ConfigRef` fields without engines; pretending enforcement is unsafe. |
| **Implementation consequence** | Orderables/submit validate only L-ORD-01-required invariants (IDs, Active/effective/applicable/orderable, indication, priority rules, etc.); display unresolved informational refs honestly. |
| **Out of scope** | Inventing TAT/hours/restriction engines; silent fake enforcement |
| **Source / evidence** | L-ORD-01A audit §9 / §33; this closure brief |

---

## 4. Cross-cutting non-negotiable rules

| Rule | Requirement |
|---|---|
| Tenant | Every order has exactly one `TenantId` from authenticated context; never trust client tenant |
| Branch | Branch/service-location authorization is server-side |
| Patient | Validate `PatientId` against authoritative Patient service; no LMS patient master |
| Visit | If supplied, validate tenant + patient + applicable branch/context |
| Catalogue | At submit, resolve/pin exact catalogue versions; never silently replace after submission |
| Panel | Component versions valid for ordering at submit (PD-ORD-13) |
| Submitted order | No silent mutation (PD-ORD-10/11) |
| Cancellation | No deletion (PD-ORD-12) |
| Audit | Every order lifecycle mutation writes platform audit (expand InternalAudit allowlist for order resources) |
| Idempotency | Create/submit support tenant-scoped idempotency; reuse existing safe pattern; no second global framework |
| Concurrency | Optimistic concurrency equivalent to catalogue `RowVersion` |
| Financial | Clinical and financial state remain separate (PD-ORD-09) |

---

## 5. Explicit out of scope for L-ORD-01 / L-ORD-01B

- Collection / collection tasks / scheduling / labels / requisitions  
- Specimen creation / custody / receiving / triage  
- Examination / instruments / QC  
- Results / technical verification / clinical authorization  
- Reporting / report delivery  
- Referral shipment / receipt / external result intake  
- Billing charge posting / payments / refunds / financial ledger  
- Analytics  
- Work queue engine / STAT monitored queue  
- Configurable AOE engine / clinical pathway engine / favourites  
- New consent system / patient master / encounter master / provider master / site hierarchy  
- Pathology migration / synchronization / `/dashboard/laboratory` changes  
- After-hours feasibility routing  
- Automatic production role grants for `lms.orders.*`  

---

## 6. What L-ORD-01B may implement (when separately authorized)

Conceptual foundation only (subject to L-ORD-01B brief):

- `lms_*` order / order-version / order-test tables (or equivalent preserving PD semantics)  
- Orderables resolution API  
- Draft create / get / submit / amend / cancel APIs under `/api/lms/orders*`  
- Platform audit allowlist expansion for order actions/resources  
- Idempotency + RowVersion  
- Permission **definitions** for `lms.orders.*` (not role grants)  
- LMS Orders UI under `/dashboard/lms/orders` consistent with design system  

Must still respect §5 non-scope.

---

## 7. Decision status matrix

| ID | Title | Status |
|---|---|---|
| PD-ORD-01 | Visit / encounter | **APPROVED** |
| PD-ORD-02 | Provider eligibility | **APPROVED** |
| PD-ORD-03 | Order source | **APPROVED** |
| PD-ORD-04 | Operating / performing site | **APPROVED** |
| PD-ORD-05 | Identity snapshots | **APPROVED** |
| PD-ORD-06 | AOE / clinical questions | **APPROVED** |
| PD-ORD-07 | Priority | **APPROVED** |
| PD-ORD-08 | Consent / privacy | **APPROVED** |
| PD-ORD-09 | Payer / authorization / financial disposition | **APPROVED** |
| PD-ORD-10 | Order / OrderTest status | **APPROVED** |
| PD-ORD-11 | Amendment model | **APPROVED** |
| PD-ORD-12 | Cancellation | **APPROVED** |
| PD-ORD-13 | Panel explosion | **APPROVED** |
| PD-ORD-14 | Human-readable order number | **APPROVED** |
| PD-ORD-15 | Permissions | **APPROVED** |
| PD-ORD-16 | Orderables permission | **APPROVED** |
| PD-ORD-17 | Collection task stubs | **APPROVED** |
| PD-ORD-18 | Favourites / clinical pathways | **APPROVED / DEFERRED** |
| PD-ORD-19 | Unresolved catalogue config refs | **APPROVED** |

**Unresolved product decisions blocking L-ORD-01B:** **None** (role mapping for orders remains deferred like PD-CAT-02 — capability codes approved; grants are an authorization/UAT step, not an open intake rule).

---

## 8. Traceability

| Artifact | Role |
|---|---|
| PRD/BRD (named) | Functional source |
| [enterprise-lms-order-intake-audit.md](./enterprise-lms-order-intake-audit.md) | L-ORD-01A audit |
| **This document** | PD-ORD closure |
| L-ORD-01B (future) | Implementation under separate authorization |
| [enterprise-lms-implementation-plan.md](./enterprise-lms-implementation-plan.md) | Plan / matrix update |
| PD-LAB / PD-CAT closures | Financial, catalogue, audit baselines |

---

## 9. Repository change declaration (this task)

| Area | Change |
|---|---|
| Code | **NONE** |
| Schema / migrations | **NONE** |
| Data | **NONE** |
| Permissions / seeds / roles | **NONE** |
| UI | **NONE** |
| Pathology | **NONE** |

Documentation only: this file + audit/plan cross-references.
