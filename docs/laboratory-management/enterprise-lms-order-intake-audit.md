# L-ORD-01A — Enterprise LMS Order Intake — Pre-Implementation Audit

**Date:** 2026-10-09  
**Slice:** L-ORD-01A (audit only)  
**Mode:** READ-ONLY — no schema, API, UI, permission, or data changes  
**Branch / commit (workspace):** `feat/counsellor-workspace-recording-ux` @ `006ec7ab`  
**PRD SoT (named):** `enterprise_laboratory_management_system_prd_brd.docx`  
**PRD availability in repo:** **NOT FOUND** as a binary/document under the workspace; functional requirements below are taken from (a) the L-ORD-01A audit brief (explicit PRD workflow), (b) prior LMS docs citing PRD/BRD v1.0 | 08 October 2026, and (c) certified Hospital Portal / L-CAT / PD-LAB decisions. Where the binary PRD cannot be re-verified line-by-line, gaps are marked **DECISION REQUIRED** or **PRD FILE GAP**.

```text
AUDIT ONLY — NO IMPLEMENTATION
NO order tables / migrations / APIs / UI / permissions / seeds
NO Pathology or /dashboard/laboratory changes
NO second patient / encounter / provider / site master
NO collection / specimen / testing / results / billing engines
```

---

## 1. Executive summary

L-CAT-01B has established a governed LMS Catalogue on **LaboratoryApi** (`lms_catalogue_*`, lifecycle Draft→…→Active, permissions `lms.catalogue.*`, platform audit via AuthService). L0 LMS shell routes under `/dashboard/lms/*` exist; **Orders** and **Work Queue** remain `not_implemented`.

**Authoritative direction validated by repository evidence:**

```text
Hospital Portal Web (/dashboard/lms/*)
        ↓
LaboratoryApi (/api/lms/*)
        ↓
LMS Order Domain (future lms_order* tables)
        │
        ├── AuthService Patient / Visit / Identity (by ID reference)
        ├── LMS Catalogue (same LaboratoryApi boundary)
        ├── Billing / Service Catalog / CCMS (financial SoT — reference only)
        └── Platform audit_log (AuthService InternalAudit)
```

**Pathology** (`/dashboard/laboratory`, AuthService `LabReport` / `laboratory_*` catalogue) is an independent operational track. L-ORD-01 must **not** write to or use it as LMS SoT.

Product decisions in §30 are **closed** by [enterprise-lms-order-product-decision-closure.md](./enterprise-lms-order-product-decision-closure.md) (L-ORD-01A-PD). Architecture ownership remains as audited. **L-ORD-01B is not started** by this audit.

**Audit determination (historical):** `READY_FOR_PRODUCT_DECISIONS`  
**Post-closure gate:** see L-ORD-01A-PD — `PRODUCT DECISION GATE CLOSED` → `READY_FOR_IMPLEMENTATION_REVIEW`

---

## 2. Repository architecture findings

### A. Applications / services

| Asset | Ownership | Reuse for L-ORD-01 |
|---|---|---|
| `apps/hospital-portal-web` | Staff UI (Next.js App Router) | LMS shell + future Order Intake UX under `/dashboard/lms/orders` |
| `microservices/auth-service/AuthService` | Identity, JWT, permissions, patients, visits, Pathology lab, OPD billing, consents, service catalog, platform audit | **Reference APIs** for patient/visit/provider/consent/billing; **not** LMS order persistence |
| `microservices/laboratory-service/LaboratoryApi` | Enterprise LMS domain (Azure Functions :7076, `/api/lms/*`) | **Owner** of future LMS orders |
| CCMS / IP / Inventory / Notification / Counselling | Domain peers on shared PG | Reference only where PD-LAB / PRD require |

### B. LaboratoryApi (accepted)

- Host: Azure Functions; JWT + tenant via `LaboratoryAuthz`
- DB: shared `hospitalportal`; EF `LaboratoryDbContext`; tables `lms_*` only
- Implemented domain: Catalogue (`lms_catalogue_items`, `lms_catalogue_versions`, panel components, branch applicability)
- Audit: `PlatformAuditClient` → AuthService `POST /api/internal/audit` (fail-closed pattern for catalogue mutations)
- Concurrency: integer `RowVersion` concurrency token on catalogue versions
- **No** order tables, order functions, or `lms.orders.*` enforcement yet

### C. LMS web routes

| Route | Status |
|---|---|
| `/dashboard/lms` | L0 placeholder / overview |
| `/dashboard/lms/configuration/test-catalogue` (+ `[id]`, panels) | **Implemented** (L-CAT-01B UI) |
| `/dashboard/lms/orders` | Structural; `not_implemented` capability page |
| `/dashboard/lms/work-queue` | Structural; `not_implemented` |
| Collection / specimens / testing / results / reports / referrals / quality / billing / analytics | Structural placeholders |

Pathology `/dashboard/laboratory` remains separate and must stay unchanged.

### D. AuthService

Owns MPI/patients, visits, users/roles/permissions, Pathology lab orders (`LabReportsController`), laboratory catalog, consents, OPD bills, service catalog admin, internal audit write.

### E–O. Capability summary

See §3 capability map. Highlights: patient lookup + duplicate check exist; visits exist (optional on Pathology catalog-order); provider eligibility today is “active Doctor role” in Pathology path only; billing idempotency exists for payments/items; LMS catalogue has no orderables-only API yet; AOE framework absent; order-source taxonomy absent for LMS.

---

## 3. Existing capability map

| Concern | Owner | Mechanism | Reusable for LMS Order Intake? |
|---|---|---|---|
| Patient / MPI | AuthService | `PatientsController` lookup / search / check-duplicates | **Yes** — ID reference; do not copy master |
| Encounter / visit | AuthService | `VisitsController` by patient/branch/appointment | **Yes as Visit** — visit ≠ full PRD “encounter” taxonomy; binding policy open |
| Provider / staff | AuthService | Users + roles; Pathology `ordering-clinicians` | **Partial** — reuse user IDs; eligibility rules for LMS open |
| Branch / site | Platform Branch IDs | FE `useBranchContext`; catalogue branch applicability | **Yes** — same Branch IDs as L-CAT PD-CAT-03 |
| LMS Catalogue | LaboratoryApi | `/api/lms/catalogue` | **Yes** — must add orderable resolution rules |
| Pathology catalogue / orders | AuthService | `api/laboratory/catalog`, `api/lab-reports` | **No** as LMS SoT — UX patterns only |
| Consent | AuthService | `ConsentsController`, `PatientConsentsController` | **Partial** — no LMS-specific sensitive-test AOE |
| Payer / authz | Billing + CCMS | Service catalog refs; CCMS coverage (separate) | **Reference** — Billing/CCMS remain financial SoT |
| Notifications | NotificationService / Hub | PD-LAB-NOTIF-01 | Later slices; order-created optional |
| Audit | AuthService `audit_log` | LaboratoryApi `PlatformAuditClient` | **Yes** — extend action vocabulary |
| Permissions | AuthService + FE registry | `lms.view`, `lms.catalogue.*`; planned `lms.orders.view` | **Convention yes**; codes not seeded for orders |
| Idempotency | Billing / outbox patterns | Tenant+key unique indexes; `X-Idempotency-Key` in places | **Pattern reuse** — not yet on LaboratoryApi |
| Worklists | LMS L0 + Pathology lists | LMS work-queue placeholder; LabReports lists | Queue items **not** L-ORD-01 by default |

---

## 4. Patient identity findings

### Authoritative source

**AuthService Patients / MPI** — not LaboratoryApi.

### APIs (representative)

| Capability | Endpoint (AuthService) |
|---|---|
| Paginated demographic / MRN lookup | `GET api/Patients/lookup` (+ export/stats) |
| Search | `GET` search endpoints / `SearchPatients` |
| Duplicate detection | `POST api/Patients/check-duplicates`, `registration/check-duplicates` |
| Detail | Standard patient get-by-id patterns on `PatientsController` |

### Enforcement

- Tenant scoped via JWT / controller tenant helpers  
- Permissions historically `patient.view` / `patient.update` on Pathology order path — **LMS must not reuse Pathology permission as LMS order gate**  
- Branch filtering: lookup supports operational filters; **LMS branch authorization for ordering is DECISION REQUIRED** (catalogue has optional branch applicability; patient master is tenant-scoped)

### LMS order must reference

| Field | Guidance |
|---|---|
| `PatientId` | **Required** FK-by-reference (no LMS patient table) |
| MRN / display name / DOB snapshot | **DECISION REQUIRED** — PRD intake needs identity confirmation at order time; platform historical-snapshot convention for LMS orders not certified. Prefer minimal display snapshot at submit for audit readability **only if** PO approves; never a second master. |

**Rule:** LMS must not become a second patient master. Validate `PatientId` exists in tenant (server-side) on draft/submit.

Frontend reuse candidate: `PatientSearchAutosuggest` / unified patient search (Pathology `LaboratoryOrderDialog` already uses these — UX pattern only).

---

## 5. Encounter findings

### Authoritative source

Platform **Visit** (`VisitsController`: get by id, by patient, by branch, by appointment, check-in, queue). IP journeys / appointments are related but distinct.

### Pathology precedent

`LabReportsController.CreateFromCatalog`: `VisitId` **optional**; if present, must match patient + tenant.

### LMS / plan docs

`enterprise-lms-implementation-plan.md` lists **Visit binding** as an open dependency for L-ORD-01.

### Findings

| Topic | Finding |
|---|---|
| Multiple “encounter” concepts | Visit (OPD operational), Appointment, PatientJourney (IP/billing); counseling session exists as a parallel anchor |
| Mandatory for LMS order? | **DECISION REQUIRED** (PRD lists select encounter; Pathology allows null VisitId; plan flags visit binding) |
| Site/branch | Visits are branch-aware (`by-branch`, queue); Visit carries `BranchId` |
| BE visit types/statuses | Types e.g. `new` / `review` / `follow_up` / `post_op`; statuses e.g. `created` / `checked_in` / `in_progress` / … / `completed` / `cancelled` (AuthService `Visit` model) |
| FE–BE drift | FE `visits.api.ts` type/status unions **do not fully match** BE — **DECISION REQUIRED** which vocabulary LMS UI may display |
| Sufficient API context? | Yes for Visit identity + patient link; inpatient/ward LMS orders may need journey binding — **DECISION REQUIRED** |
| Patient merge | Merge UI/route not live for LMS to call — document only |

**Do not invent** a new LMS encounter entity. Capture `VisitId` (and/or journey id per PD-LAB-BILL-04) only as platform references.

---

## 6. Provider findings

### Authoritative source

AuthService **Users** (+ roles). Pathology ordering clinician check: active user, tenant, role name contains `"Doctor"`, via catalog `ordering-clinicians` and `CreateFromCatalog`.

### LMS

No LMS provider master. Ordering provider / responsible clinician should store **platform User IDs** (+ optional display-name snapshot — **DECISION REQUIRED** same as patient).

| Topic | Finding |
|---|---|
| Eligibility for LMS | **DECISION REQUIRED** — Pathology “Doctor” string match is not certified as enterprise LMS policy |
| Responsible clinician ≠ ordering provider | PRD distinguishes both; schema/API fields not designed yet |
| Credentials / scope of practice | No authoritative LMS eligibility engine found |

---

## 7. Order source findings

Searched for order source / ordering channel / referral source masters suitable for LMS.

| Finding | Detail |
|---|---|
| LMS / Pathology lab order | No dedicated `OrderSource` enum on `LabReport` create path reviewed |
| Document `SourceSystem` | Exists in document-sharing models — **not** lab order intake taxonomy |
| PRD requirement | Select order source at intake |

**Conclusion:** No platform LMS order-source taxonomy to reuse. **DECISION REQUIRED** — inventing a taxonomy is a product/configuration decision, not an audit invention.

Self-requested tests + patient acknowledgement: **DECISION REQUIRED** (policy + storage).

---

## 8. Site / branch findings

### Accepted hierarchy (L-CAT / PD-CAT-03)

- **TenantId required**  
- Optional **Branch** applicability using existing platform Branch IDs  
- No new organization/site hierarchy for LMS  

### Active site establishment

- FE: `useBranchContext` / `branchId` (Pathology order dialog already reads it); branch names from `/user-branches/me` — existing Lab guidance: **do not** `GET /branches/{id}` for name resolution (known 403 loop risk)  
- Catalogue list can filter by `BranchId` (tenant-wide if no applicability rows, else explicit match)  
- LaboratoryApi JWT tenant enforcement; branch on catalogue is data filter, not a separate authz framework  
- Tenant: JWT + `X-Tenant-ID` resolution on AuthService; LaboratoryApi tenant from JWT claims

### Open for Order Intake

| Question | Status |
|---|---|
| Must order location equal active UI branch? | **DECISION REQUIRED** |
| Cross-site ordering? | **DECISION REQUIRED** |
| Service location ≠ operating site? | **DECISION REQUIRED** (catalogue has `PerformingSiteRef` as nullable config ref only) |
| Branch authorization vs permission codes | Permissions are capability codes; branch scope is additional — **must be server-enforced**; exact rules open |

---

## 9. Catalogue integration findings

### APIs today

| Method | Route | Permission | Purpose |
|---|---|---|---|
| GET | `/api/lms/catalogue` | `lms.catalogue.view` | Admin/config list (latest version join) |
| GET | `/api/lms/catalogue/{id}` | view | Detail |
| GET | `/api/lms/catalogue/{id}/versions` | view | History |
| POST/PUT/lifecycle | draft / submit / approve / activate / … | manage / approve | Governance |

**Gap:** There is **no** dedicated **orderables** endpoint that enforces Active + calendar-effective + branch-applicable + `Orderable=true`. Current list joins **LatestVersion**, not necessarily `CurrentActiveVersion`, and status is an optional filter — unsuitable as Order Intake SoT without a new resolution path **inside LaboratoryApi**.

### Fields available on `LmsCatalogueVersion` (relevant to PRD pre-select display)

| Need | Field / mechanism |
|---|---|
| Item / type | `LmsCatalogueItem` + `CatalogueType` TEST \| PANEL \| REFERRAL_TEST |
| Active version | `CurrentActiveVersionId` |
| Version number | `VersionNumber` |
| Codes / names / synonyms | `InternalOrderCode`, `DisplayName`, `Synonyms` |
| Orderability | `Orderable` |
| Discipline / classification | `Discipline`, `Classification` LOCAL \| REFERRAL |
| Branch applicability | `lms_catalogue_branch_applicability` |
| Effective dates | `EffectiveFrom`, `EffectiveTo` |
| Preparation / specimen / TAT | `PreparationInstruction`, `PatientPreparation`, specimen refs, `ExpectedTatConfigRef` |
| Restriction | `AgeSexRestrictionConfigRef` (ref only) |
| Referral | `ReferralPartnerRef` + REFERRAL classification |
| Commercial | `ServiceCatalogRef`, `PayerMappingRef`, `AuthorizationRequired` |
| Favourites / clinical pathway | **Not modeled** — **DECISION REQUIRED** / later config |
| Consent flag | `ConsentRequired` (nullable bool) |

### Orderable resolution rule (required for L-ORD-01)

Order Intake must resolve definitions that are **all** of:

1. Version `Status == Active` (never Draft / Review / Approved / Retired / Superseded)  
2. Calendar-effective at order time (`EffectiveFrom`/`EffectiveTo`)  
3. Branch applicable (tenant-wide empty set **or** includes order branch)  
4. `Orderable == true`  
5. Parent item not soft-deleted  

**Resolution location:** **A — inside LaboratoryApi** (internal service method / dedicated orderables query). Do **not** create a separate Catalogue microservice. Do **not** call Pathology catalog APIs for LMS SoT.

Config refs (TAT, restrictions, operating hours) are **references**, not executable engines yet — displaying unresolved refs vs blocking order is **DECISION REQUIRED**.

---

## 10. Panel findings

### L-CAT-01B model

`LmsCataloguePanelComponent`:

- `PanelVersionId` → panel catalogue version  
- `ComponentCatalogueItemId` + **`ComponentVersionId`** (pins specific component version)  
- `SortOrder`, `IsRequired`  
- Activation requires ≥1 component for PANEL type  

### Unresolved / required model notes

| Topic | Finding |
|---|---|
| Inactive / non-Active components on Active panel | Activation does not appear to re-validate component versions Active+Orderable at activate time beyond count — **DECISION REQUIRED** for order-time validation |
| Ordering a panel → individual test work items | PRD: panel is ordered container; Pathology expands panel to `LabReportItem`s — LMS should keep **panel identity** on order line **and** explode to test work items — exact explosion timing **DECISION REQUIRED** (submit vs later) |
| Traceability | Preserve panel catalogue item/version IDs on order; components via `ComponentVersionId` |

---

## 11. Referral-test findings

| Topic | Finding |
|---|---|
| Catalogue type | `REFERRAL_TEST` |
| Activation rule | Classification must be `REFERRAL` |
| Stored ops data | `ReferralPartnerRef` (string ref); no shipment/partner messaging tables |
| Order Intake must preserve | Catalogue item/version IDs, classification, partner ref snapshot/ref, commercial refs as applicable |
| Out of scope | Referral shipment, receipt, partner comms, external result intake |

---

## 12. AOE / clinical question findings

| Search | Result |
|---|---|
| AOE / Ask-at-order framework in LMS | **None** |
| Pathology catalog-order | Single required `ClinicalIndication` string — not configurable AOE |
| Catalogue fields | No AOE question definitions on L-CAT-01B versions |
| Pregnancy / fasting / isolation / medication interference masters | No reusable LMS AOE framework found |

**DECISION REQUIRED:**

- Configuration ownership (catalogue-version vs tenant questionnaire vs order-level free text)  
- Mandatory vs optional per test  
- Answer storage (order vs order-test)  
- Whether L-ORD-01 ships with indication-only MVP pending AOE framework  

Do **not** invent a new AOE platform in L-ORD-01 without PO approval.

---

## 13. Priority findings

### Pathology / platform vocabulary (existing)

`routine` | `urgent` | `stat` (`LAB_REPORT_PRIORITIES`; LabReports API validates the same).

### PRD vs repository

| PRD | Repository |
|---|---|
| STAT / urgent with **reason** | Reason field **not** found on Pathology create path |
| Monitored worklist routing | LMS work-queue **not_implemented**; Pathology list filter by priority only |
| After-hours feasibility | Catalogue `OperatingHoursConfigRef` exists as **nullable ref**; no runtime after-hours engine in LaboratoryApi |

**Gaps:** priority reason, after-hours policy engine, STAT worklist routing — document as product/config gaps; do not invent operational policy.

LMS may **reuse value set** `{routine, urgent, stat}` if PO confirms alignment with PRD; reason + after-hours remain **DECISION REQUIRED**.

---

## 14. Consent / privacy findings

| Mechanism | Owner | Notes |
|---|---|---|
| Counseling consent stack | AuthService `ConsentsController` (`api/consents`) | Templates / render / sign / revoke; often `[Authorize]` without fine-grained `RequirePermission` |
| Patient consent records | AuthService `PatientConsentsController` (`api/patient-consents`) | `patient.view` / `patient.update` |
| PHI access logging | AuthService | `POST /patients/{id}/phi-access` — relevant if LMS intake surfaces PHI |
| Catalogue `ConsentRequired` | LaboratoryApi | Flag/ref only — no capture workflow |
| Privacy preferences / communication prefs | Partial platform patterns; not LMS-order-bound | |

**Dual-stack risk:** counseling `consents` vs `patient-consents` — which gates LMS orders is **DECISION REQUIRED** (already in §30 PD-ORD-08).

**Order creation capture:** PRD requires confirm consent / privacy preferences — **what is mandatory on LMS submit is DECISION REQUIRED**. Prefer referencing platform consent records by ID + capturing acknowledgement evidence version — do **not** create a second consent system.

Self-requested acknowledgement: tied to order-source / self-request policy (**DECISION REQUIRED**).

---

## 15. Payer / authorization findings

| Concern | Owner |
|---|---|
| Price / service catalog | AuthService Service Catalog (Billing commercial SoT); charge resolve via `ChargeCatalogResolver` |
| Patient insurance display | AuthService `PatientInsuranceController` — not claim SoT |
| LMS commercial refs | `ServiceCatalogRef`, `PayerMappingRef`, `AuthorizationRequired` on catalogue version |
| Coverage / preauth / claims | **CCMS** (`CoverageCase` / `Authorization` / `Eligibility` functions) — reference by ID only |
| Pathology order-summary | Estimate only; does **not** create insurance claims — precedent for LMS intake |
| Charge posting | Billing / OpdBill — PD-LAB-BILL-* |

### Certified policy (PD-LAB)

- **PD-LAB-PAY-01:** Order creation **no** payment block; clinical workflow must not be unsafe solely due to unpaid status; collection soft-gates for routine OPD = follow-up  
- **PD-LAB-BILL-01:** Normal OPD charge at **specimen collection** (not at order create)  
- **PD-LAB-BILL-02:** Lab owns clinical status; Billing owns financial reversal  

**Order Intake must capture (conceptually):** financial disposition / payer context references as PO defines — **not** execute charge ledger in L-ORD-01. Blocking rules beyond PAY-01 = **DECISION REQUIRED**.

---

## 16. Billing boundary

| Clinical SoT | Financial SoT |
|---|---|
| LMS Order / OrderTest lifecycle in LaboratoryApi | OPD/IP bills, payments, reservations, refunds in Billing |
| Catalogue clinical definition + orderability | Service Catalog price / payer mapping |
| Clinical cancel / amend | Financial reverse / refund / credit (Finance cells still open) |

**Rules:**

- Frontend never authoritative for money  
- Do not create `LaboratoryBill` / LMS ledger  
- Do not let financial state overwrite clinical order state  
- L-ORD-01 may store **references** (`ServiceCatalogRef`, disposition enum/refs) and optionally call read APIs for display — charge **execution** later (collection-aligned per BILL-01)

---

## 17. Proposed conceptual order domain (audit only)

Ownership: **LaboratoryApi**, tables `lms_*`, shared DB `hospitalportal`.

### LmsOrder (recommended)

| Aspect | Proposal |
|---|---|
| Purpose | Header for patient/order intake; immutable identity after submit |
| Identity | `Id` (GUID), human-readable order number (**DECISION REQUIRED** format) |
| Patient | `PatientId` required; optional approved snapshots |
| Tenant / branch | `TenantId` required; `BranchId` / service location per PD |
| Encounter | `VisitId` optional/required per PD |
| Providers | Ordering provider + responsible clinician user IDs |
| Order source | Per taxonomy PD |
| Priority | Per vocabulary PD |
| Lifecycle | See §18 |
| Catalogue | Lines point at catalogue version IDs resolved at submit |
| Auditability | Platform audit + domain timestamps/actors |
| Immutability | Submitted body not silently rewritten — amend/cancel only |
| Downstream | Spawns OrderTests; later collection/billing via other slices |

### LmsOrderTest (recommended)

| Aspect | Proposal |
|---|---|
| Purpose | Individual test work item (panel explosion / single tests / referral tests) |
| Identity | Own GUID; FK to order; catalogue item + **version** IDs |
| Panel | Optional parent panel line identity for traceability |
| Lifecycle | Distinct from order header (§18) |
| AOE answers | If stored per-test — PD |
| Downstream | Collection / testing / results attach later — not L-ORD-01 execution |

### Evaluate (not required to implement in first cut without PD)

| Entity | Verdict |
|---|---|
| `LmsOrderAmendment` | **Likely needed** for versioned post-submit changes (PRD) — may be rows or version chain; design open |
| `LmsOrderClinicalQuestion` | Only if AOE framework approved; else indication fields on order/test |
| `LmsOrderConsent` | Prefer platform consent ID refs + acknowledgement record; local table only if PD requires order-bound evidence |
| `LmsOrderFinancialDisposition` | Lightweight disposition/ref on order vs separate entity — **DECISION REQUIRED** |
| `LmsOrderAuditReference` | **Not recommended** as local audit table; use platform `audit_log` correlation |

---

## 18. Proposed order / test state semantics

Do **not** collapse Order / Specimen / Test / Report into one status (PRD).

### Pathology precedent (do not copy as LMS SoT)

LabReport statuses include `ordered`, `sample_collected`, `in_progress`, `completed`, `cancelled`, `on_hold`, etc. (D-LAB-11 / PD-LAB-*).

### Smallest Order Intake state machine (proposed for PO confirmation)

**ORDER**

| State | Meaning |
|---|---|
| `Draft` | Pre-submit editable composition |
| `Submitted` | Immutable clinical header/lines except via amend/cancel |
| `Amended` | Or version pointer on amendment — **DECISION REQUIRED** vocabulary |
| `Cancelled` | Terminal clinical cancel |

Invalid: silent rewrite of Submitted; client-supplied arbitrary status; skipping submit.

**TEST WORK ITEM**

| State | Meaning |
|---|---|
| `Ordered` / `PendingCollection` | Created at submit (name **DECISION REQUIRED**) |
| Later slices | Collected, received, in process, verified, etc. — **out of L-ORD-01** |

Hold semantics (PD-LAB-ORD-HOLD) exist for Pathology; whether LMS Order Intake includes `OnHold` at header = **DECISION REQUIRED**.

All transitions server-enforced in LaboratoryApi.

---

## 19. Immutability / amendment findings

| Pattern | Location | Reuse |
|---|---|---|
| Immutable Active catalogue definitions | L-CAT-01B | Conceptual analogue for submitted orders |
| `RowVersion` optimistic concurrency | Catalogue versions | **Reuse pattern** on order aggregates |
| Pathology edit/cancel policies | PD-LAB-ORD-EDIT / CXL / HOLD | Policy baseline; LMS vocabulary still PD |
| Versioned catalogue supersede | CREATE_VERSION / SUPERSEDE audits | Amendment design analogue |

**Recommendation:** Submitted order = immutable snapshot of resolved catalogue version IDs + clinical fields; changes via **amendment** (new version / amendment record) or **cancel** action with reason; `ExpectedRowVersion` on mutating APIs.

---

## 20. Idempotency / concurrency findings

| Pattern | Where |
|---|---|
| Payment / bill item idempotency keys | OPD billing unique indexes |
| `X-Idempotency-Key` | Counselling → billing style calls |
| CCMS / integration outbox keys | Billing/CCMS |
| Catalogue `RowVersion` | LaboratoryApi |
| Pathology `catalog-order` | **No** idempotency key observed on create |

**Recommendation for L-ORD-01:**

- Adopt **tenant-scoped Idempotency-Key** on `POST` draft/submit (Billing-like), store on order create  
- `RowVersion` on order header for amend/cancel  
- FE: disable double-submit; treat timeout+retry as idempotent replay  

Do not invent a second global idempotency framework.

---

## 21. Audit findings

### Accepted path

```text
LaboratoryApi mutation
  → PlatformAuditClient
  → AuthService POST /api/internal/audit
  → audit_log
```

Catalogue actions today: `CREATE_DRAFT`, `UPDATE_DRAFT`, `SUBMIT_REVIEW`, `RETURN_TO_DRAFT`, `APPROVE`, `ACTIVATE`, `RETIRE`, `SUPERSEDE`, `CREATE_VERSION`.

**InternalAudit allowlist today:** catalogue actions + resource type **`LmsCatalogueVersion` only**. L-ORD-01 implementation must expand the AuthService internal-audit allowlist for order resource types/actions (same AD-CAT-AUDIT pattern; fail-closed). LaboratoryApi still must **not** own a local audit table. LaboratoryApi has **no** `Idempotency-Key` store today — order create must introduce one or reuse a Billing-like pattern (§20).

### Proposed order events (names to align at implementation; not finalized)

| Candidate | When |
|---|---|
| `CREATE_DRAFT` / `CREATE_ORDER` | Draft created |
| `UPDATE_DRAFT` | Pre-submit edits |
| `SUBMIT_ORDER` | Submit |
| `AMEND_ORDER` | Post-submit amendment |
| `CANCEL_ORDER` | Cancellation |

### Required fields (platform model)

Actor (userId), tenant, resource type (e.g. `LmsOrder`), resource id, action, old/new values, reason, timestamp, outcome/description, session/IP/UA when available, correlation.

**Do not** create a local LMS audit table.

---

## 22. Permission findings

### Existing LMS

| Code | Status |
|---|---|
| `lms.view` | Workspace gate (seeded for L0) |
| `lms.catalogue.view` / `.manage` / `.approve` | Catalogue (PD-CAT-02 role mapping still open) |
| `lms.orders.view` | **Planned** in `LMS_PLANNED_PERMISSIONS` only — not an API gate yet |

### Proposed for Order Intake (do **not** seed in this audit)

| Code | Capability | APIs | UI | Endpoint required? |
|---|---|---|---|---|
| `lms.orders.view` | Read orders / search | GET order/list | Orders workspace | Yes |
| `lms.orders.create` | Draft + submit | POST draft/submit | Intake UX | Yes |
| `lms.orders.manage` | Amend / cancel / manage queue ops in scope | POST amend/cancel | Order detail actions | Yes |

**Notes:**

- Do not use `laboratory.view` or `patient.update` as LMS order authorization  
- PD-CAT-02 style: **no automatic production role grants** without PO  
- Branch/site authorization is **separate** from capability codes and must be enforced server-side  
- Catalogue search during intake may need `lms.catalogue.view` **or** a narrower orderables read granted with create — **DECISION REQUIRED**

---

## 23. Work queue boundary

| Asset | State |
|---|---|
| `/dashboard/lms/work-queue` | Structural `not_implemented` |
| Pathology lab lists | Operational for Pathology only |
| STAT monitored worklist (PRD) | No LMS implementation |

**Recommendation:** L-ORD-01 **does not** own a second operational worklist platform. Optionally emit domain events / status that a **later Work Queue slice** consumes. Collection tasks belong to **Collection Planning** (stage 3), not Order Intake — unless PO explicitly requires create-time task stubs (**DECISION REQUIRED**; default = later).

---

## 24. Downstream object ownership

| Object | L-ORD-01 | Later slice |
|---|---|---|
| Order header | **In** | |
| Order tests / work items (clinical lines) | **In** (identity + ordered state) | Testing lifecycle expansion |
| Order submit / amend / cancel | **In** | |
| Order audit | **In** (platform) | |
| Collection tasks | | Collection |
| Labels / requisition print | | Collection / ops |
| Specimen records | | Specimens |
| Receiving / triage | | Specimens / receiving |
| Examination / instruments / QC | | Testing / quality |
| Results / verification / auth | | Results |
| Reports | | Reporting |
| Referral execution | | Referrals |
| Charge posting / payment | | Billing (BILL-01 at collection) |
| Outbound integration messages | | Integrations (optional notify on create per NOTIF-01) |

PRD “submission creates …” is an **end-state enterprise** description; slice boundary above prevents scope leakage.

---

## 25. Proposed API contracts (conceptual — do not implement)

Convention: LaboratoryApi `/api/lms/orders…`; JWT; tenant from token (never trust client tenant); branch rules per PD; permissions as §22.

| Method | Route (proposed) | Authz | Purpose | Concurrency / idempotency |
|---|---|---|---|---|
| GET | Platform patient APIs | patient.* (existing) | Search / detail / duplicates | N/A |
| GET | Platform visits / providers | existing | Encounter / clinician pickers | N/A |
| GET | `/api/lms/catalogue/orderables` *(new)* | orders.create and/or catalogue.view (PD) | Active+effective+applicable+orderable search | Read |
| POST | `/api/lms/orders` or `/drafts` | create | Create draft | Idempotency-Key |
| GET | `/api/lms/orders/{id}` | view | Fetch order | N/A |
| POST | `/api/lms/orders/{id}/submit` | create | Submit → immutable | Idempotency-Key + RowVersion |
| POST | `/api/lms/orders/{id}/amend` | manage | Versioned amendment | RowVersion + reason |
| POST | `/api/lms/orders/{id}/cancel` | manage | Cancel | RowVersion + reason |

Patient/encounter/provider IDs in body are **hints** validated server-side against AuthService/platform data within tenant (and branch rules).

---

## 26. Frontend UX findings

### Existing patterns

| Pattern | Where | Fit |
|---|---|---|
| Pathology order **dialog** composer | `LaboratoryOrderDialog` | Dense workstation pattern; uses patient autosuggest, doctor search, catalog picker, summary, priority — **Pathology-bound**; reuse **interaction ideas**, not APIs/permissions |
| LMS catalogue **dedicated pages** | `/dashboard/lms/configuration/test-catalogue` | Full-page governed workflow with ProtectedRoute |
| LMS capability placeholder | `LmsCapabilityPage` for orders | Current stub |
| Counsellor UI quality bar | Workspace / multi-pane staff UX | Benchmark for polish |

### Recommendation (evidence-based)

Prefer a **dedicated LMS Orders workspace page** (route already reserved) with a **multi-step / stepper intake** (patient → context → catalogue → questions/priority/consent/payer → review → submit), optionally opening from patient context later.

Avoid modal-only for enterprise PRD depth (AOE, consent, payer, review). Do not use Pathology dialog as the production LMS surface. Match Counsellor density/accessibility without copying Pathology permissions or catalog.

---

## 27. Security findings

| Control | Status |
|---|---|
| JWT authentication | Established on LaboratoryApi |
| Tenant isolation | JWT tenant; DB tenant columns on `lms_*` |
| Branch/site authorization | Catalogue filter exists; order rules **PD** |
| Endpoint permission checks | `LaboratoryAuthz` pattern — extend for orders |
| Patient authorization | Validate patient in tenant; do not trust client alone |
| Client-trusted tenant/branch | Forbidden — server derives tenant; branch validated |
| Internal audit API | Key + tenant headers; fail-closed catalogue precedent |
| PHI | No PHI in logs/URLs; audit details must be minimized |
| Concurrency / idempotency | Patterns exist; must apply to order writes |
| Pathology permission bleed | Risk if FE mistakenly gates on `laboratory.view` — must not |

No code changes in this audit. No **BLOCKED_PENDING_SECURITY_GAP** for architecture — implementation must preserve the above.

---

## 28. Legacy Pathology boundary

| Must NOT use for LMS Order SoT | Evidence |
|---|---|
| `api/lab-reports`, `catalog-order` | Pathology operational orders |
| `laboratory_*` / `LabReport` tables | AuthService |
| `api/laboratory/catalog` as LMS catalogue | Separate Pathology catalog |
| `laboratory.view` as LMS order permission | Explicit L0 separation |

**Accidental coupling risks to watch (document only):**

- Shared FE patient/doctor components (OK if API targets remain LMS)  
- Shared Branch IDs (OK)  
- Developers pointing LMS intake at `lab-reports.api.ts` (forbid)  
- Role grants that mix Pathology + LMS without PD  

No write-through sync between Pathology and LMS.

---

## 29. Test strategy (future — not written now)

### Backend

Authorization; tenant isolation; branch scope; catalogue Active/effective/applicable/orderable filtering; reject non-Active versions; patient/visit/provider validation; draft create; submit; immutability; amend; cancel; concurrency; idempotency; audit emission; invalid lifecycle transitions; panel explosion rules (once PD); referral-test field preservation.

### Frontend

Patient selection; duplicate warning UX (if PD); catalogue orderables search; composition; validation; permission visibility; submit / double-submit; error/empty/loading; responsive desktop workstation layout.

### Regression

LMS catalogue lifecycle; Pathology `/dashboard/laboratory` unchanged; patient lookup workflows unchanged.

---

## 30. PRODUCT DECISIONS REQUIRED BEFORE L-ORD-01 IMPLEMENTATION

**CLOSED** — authoritative register:

→ [enterprise-lms-order-product-decision-closure.md](./enterprise-lms-order-product-decision-closure.md)

| ID | Closure status |
|---|---|
| PD-ORD-01 … PD-ORD-17, PD-ORD-19 | **APPROVED** |
| PD-ORD-18 | **APPROVED / DEFERRED** |

Role grants for `lms.orders.*` remain deferred (PD-CAT-02-style authorization/UAT step), not an open intake business-rule gap.

**Already usable without re-decision:** LaboratoryApi ownership; `lms_*` tables; no Pathology bridge; Billing financial SoT; PAY-01 no payment block at order create; BILL-01 charge at collection; platform audit path; catalogue Active-only orderables principle; Branch ID reuse; no second masters.

---

## 31. Recommended L-ORD-01 architecture

1. **Order domain lives in** LaboratoryApi domain layer.  
2. **Data lives in** shared PostgreSQL `hospitalportal` as `lms_order*` (and related) tables owned by LaboratoryApi EF migrations.  
3. **Service owner:** LaboratoryApi only — **no** new Order microservice.  
4. **References:** AuthService Patient, Visit, User; LMS Catalogue (in-process); Billing/Service Catalog/CCMS by ref/read; Notification optional later.  
5. **Does not own:** Patient/encounter/provider/site masters; Pathology tables; financial ledger; specimen/collection/results engines.  
6. **Patient identity:** Validate platform `PatientId` (+ optional approved snapshots).  
7. **Catalogue:** In-process resolution Active+effective+applicable+orderable; pin version IDs on lines.  
8. **Billing:** Reference only in L-ORD-01; charges per Billing ownership / BILL-01.  
9. **Audit:** `PlatformAuditClient` → AuthService internal audit → `audit_log`.  
10. **Permissions:** New `lms.orders.*` checked in `LaboratoryAuthz` + FE gates; no `laboratory.view`.  
11. **Site/branch:** Tenant from JWT; branch/service location per PD-ORD-04; align with catalogue applicability.

```text
Hospital Portal Web
        ↓
LaboratoryApi
        ↓
LMS Order Domain
        ↓
lms_* order tables
        │
        ├── Patient platform (AuthService)
        ├── Encounter/Visit platform
        ├── Identity / Auth / Permissions
        ├── LMS Catalogue (same service)
        └── Billing / CCMS (financial SoT)
```

---

## 32. Explicit scope boundary

| IN SCOPE FOR L-ORD-01 | OUT OF SCOPE FOR L-ORD-01 |
|---|---|
| Order draft / submit / get | Collection planning & execution |
| Order test lines (ordered state) | Specimen identity & custody |
| Catalogue orderables resolution | Receiving / triage |
| Patient/visit/provider **references** | Examination / instruments |
| Priority / indication (per PD) | QC |
| Consent/payer **capture refs** (per PD) | Results / verification / authorization |
| Amend / cancel + audit | Reports / delivery |
| Permissions design (seed gated on PD) | Referral logistics execution |
| Idempotency / RowVersion on orders | Billing charge posting / payments |
| LMS Orders UX under `/dashboard/lms/orders` | Analytics |
| | Pathology changes / sync bridge |
| | New microservice / design system |

---

## 33. Risks / unresolved gaps

| Risk | Severity |
|---|---|
| PRD `.docx` not present in repository — line-level PRD re-verification blocked | Medium (process) — **PRD FILE GAP** |
| No orderables API yet — easy to misuse admin catalogue list | High if implementation skips rule |
| Visit binding unresolved while billing hybrid expects Visit/Journey | High product |
| AOE absent vs PRD richness | Medium — scope MVP vs delay |
| STAT reason / after-hours / worklist not expressible today | Medium |
| Dual consent stacks + insurance stacks (AuthService vs CCMS) | Medium integration |
| Visit FE–BE type/status drift | Medium UX correctness |
| InternalAudit allowlist limited to catalogue resource type | Medium (implementation prerequisite, not architecture blocker) |
| PD-CAT-02 role mapping still open — orders will hit same grant problem | Medium |
| Accidental reuse of Pathology `catalog-order` | High if undisciplined implementation |
| Config refs without engines (hours, TAT, restrictions) | Medium UX/safety |
| Panel component Active integrity at order time | Medium clinical |

---

## 34. Final audit determination

**Historical audit outcome:** `READY_FOR_PRODUCT_DECISIONS`

**Product decision closure:** [enterprise-lms-order-product-decision-closure.md](./enterprise-lms-order-product-decision-closure.md) — **GATE CLOSED**.

Implementation of L-ORD-01B requires separate authorization after implementation review.

```text
L-ORD-01A-PD — PRODUCT DECISION GATE CLOSED
NEXT: L-ORD-01B — Order Domain Foundation (not started)
NO CODE / SCHEMA / PERMISSION / DATA CHANGES IN L-ORD-01A / L-ORD-01A-PD
```

---

## Appendix A — Key evidence paths

| Area | Paths |
|---|---|
| LaboratoryApi catalogue | `microservices/laboratory-service/LaboratoryApi/**` |
| LMS FE | `apps/hospital-portal-web/src/app/dashboard/lms/**`, `src/lib/lms/**` |
| Pathology orders | `LabReportsController.cs`, `LaboratoryOrderDialog.tsx`, `laboratory-constants.ts` |
| Patients / visits | `PatientsController.cs`, `VisitsController.cs` |
| Audit | `PlatformAuditClient.cs`, `InternalAuditController.cs` |
| PO lab policies | `docs/decisions/laboratory-management-product-owner-decision-closure.md` |
| Prior LMS audits | `docs/laboratory-management/enterprise-lms-*.md` |

## Appendix B — Explicit non-actions performed

No migrations, APIs, UI, permissions, seeds, Pathology edits, order tables, collection/specimen/testing/results/billing engines, or L-ORD-01 implementation were started.
