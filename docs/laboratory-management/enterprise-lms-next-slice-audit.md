# Enterprise LMS — Next Slice Discovery Audit

**Date:** 2026-10-09  
**Mode:** AUDIT ONLY — no schema, API, UI, permission, Pathology, Order, or Catalogue implementation  
**Upstream accepted slices:** LMS L0 · L-CAT-01 · L-ORD-01B (`IMPLEMENTATION_ACCEPTED_FOR_UI_LATER`)  
**PRD SoT (named):** `enterprise_laboratory_management_system_prd_brd.docx` (Enterprise Hospital Laboratory Management System | PRD BRD v1.0 | 08 October 2026)  
**PRD binary in workspace / Downloads scan:** **NOT FOUND** — same **PRD FILE GAP** as L-ORD-01A. Requirements below are reconstructed from (a) prior LMS docs citing PRD/BRD v1.0, (b) L-ORD-01A audit brief workflow, (c) PD-ORD / PD-LAB / L-CAT closures, (d) repository implementation evidence.

```text
AUDIT ONLY — NO IMPLEMENTATION
NO migrations / entities / controllers / APIs / UI / seeds / fake clinical data
NO Collection / Specimens / Testing / Results / Reporting / Referral Ops /
   Billing Execution / Analytics / Work Queue / complete Orders UI in this task
```

---

## 1. Executive Summary

After L-CAT-01 (governed catalogue) and L-ORD-01B (order domain/API foundation), the **canonical PRD laboratory workflow still has an unfinished Order Intake capability**: backend order APIs exist and are technically closed, but **`/dashboard/lms/orders` remains a structural `LmsCapabilityPage` placeholder** with **no FE API client** wired to LaboratoryApi.

**Recommended next bounded slice (single):**

### L-ORD-01C — Enterprise LMS Order Intake UI (complete Orders composer + worklist)

**Not Collection.** Collection/Specimens are the next *clinical operational* domains after intake is usable, but jumping there would:

1. Skip the explicit L-ORD-01B gate (`IMPLEMENTATION_ACCEPTED_FOR_UI_LATER` + deferred Manual UI UAT).  
2. Violate PD-ORD-17 (order submit must not create CollectionTask stubs; Collection is a later stage).  
3. Leave Order Intake untestable by staff and without Manual UAT evidence.  
4. Force Collection product decisions (specimen identity, accession, barcode, task model, multi-test/specimen cardinality) while the intake UI gap remains open.

**Final determination:** `READY_FOR_PRODUCT_DECISIONS`  
(Authorize L-ORD-01C scope + close a small UI/role decision set; do not start Collection without a later dedicated audit/PD gate.)

---

## 2. Current LMS State

Verified against repository implementation (not docs alone).

### 2.1 LMS L0 — Workspace

| Item | Evidence | Status |
|---|---|---|
| Route namespace `/dashboard/lms/*` | `apps/.../src/app/dashboard/lms/**` | Present |
| Isolation from Pathology `/dashboard/laboratory` | Boundary doc + dual nav | Intact |
| Gate permission `lms.view` | `lms-permissions.ts`, ProtectedRoute patterns | Present; role grants deferred |
| Structural capability pages | Orders, Collection, Specimens, Testing, Results, Reports, etc. use `LmsCapabilityPage` | Placeholders |
| Implemented UI domain | Configuration → Test Catalogue (+ panels) | L-CAT UI |

### 2.2 L-CAT-01 — Governed Catalogue

| Item | Evidence | Status |
|---|---|---|
| Owner | LaboratoryApi `/api/lms/catalogue*` | Confirmed |
| Tables | `lms_catalogue_items`, `lms_catalogue_versions`, panel components, branch applicability | Confirmed |
| Lifecycle | Draft → … → Active (+ supersede) | Implemented + Manual UAT accepted (per prior reports) |
| Specimen/logistics refs on catalogue version | `SpecimenTypeRef`, `ContainerRef`, `CollectionTiming`, etc. | **Configuration metadata only** — not Specimen domain |
| Permissions | `lms.catalogue.view\|manage\|approve` definitions; PD-CAT-02 role grants still open | Confirmed |
| Audit | Platform `audit_log` via InternalAudit | Confirmed |

### 2.3 L-ORD-01B — Order Domain Foundation

| Item | Evidence | Status |
|---|---|---|
| Owner | LaboratoryApi `OrderFunctions` `/api/lms/orders*` + orderables | Confirmed |
| DB | Shared PostgreSQL `hospitalportal`; LaboratoryApi-owned `lms_orders`, `lms_order_versions`, `lms_order_selections`, `lms_order_tests`, `lms_order_number_sequences`, `lms_order_idempotency` | Confirmed in `LaboratoryDbContext` |
| Lifecycle | Order: Draft → Submitted → Cancelled; amend = version chain; OrderTest initial `Ordered` | Confirmed |
| Panel explosion + catalogue pin | Submit/amend pins `CatalogueItemId` + `CatalogueVersionId` | Confirmed |
| Platform adapters | AuthService `POST /api/internal/lms/validate-{patient,visit,user}` | Confirmed |
| Branch | Operating = Performing (PD-ORD-04); visit branch match | Confirmed |
| Audit fail-closed | CREATE/UPDATE/SUBMIT/AMEND/CANCEL | Confirmed (closure pass) |
| Idempotency | Claim-first unique `(tenant_id, idempotency_key)` | Confirmed |
| Optimistic concurrency | `ExpectedRowVersion` + EF concurrency token on `row_version` | Confirmed |
| Permissions | `lms.orders.view\|create\|manage` definitions only; no auto role grants | Confirmed |
| FE | `/dashboard/lms/orders` = `LmsCapabilityPage`; **no** orders client in `laboratory-service.api.ts` | **Gap** |
| Pathology coexistence | No write-through; distinct permissions | Confirmed |

### 2.4 Pathology coexistence boundary

| Track | Route | SoT | LMS reuse |
|---|---|---|---|
| Pathology | `/dashboard/laboratory` | AuthService `LabReport` / `laboratory_*` | **RED** as LMS SoT |
| Enterprise LMS | `/dashboard/lms` | LaboratoryApi `lms_*` | Authoritative for new enterprise workflow |

---

## 3. PRD Workflow Position

### 3.1 Canonical end-to-end workflow (from LMS IA + L-ORD audits citing PRD)

```text
Access / context
  → Patient / order intake
  → Collection planning
  → Collection / custody
  → Receipt / triage
  → Examination
  → Technical verification
  → Clinical authorization
  → Reporting / delivery / closure
(+ Quality, Billing handoff, Analytics, Referrals as cross-cuts)
```

### 3.2 Current position

| Stage | LMS status |
|---|---|
| Access / context | L0 complete (shell) |
| Catalogue (configuration prerequisite) | L-CAT-01 complete |
| Patient / order intake — **domain/API** | L-ORD-01B complete |
| Patient / order intake — **staff UI + Manual UAT** | **Incomplete** ← workflow bottleneck |
| Collection planning → … → Reporting | Not started (structural nav only) |

### 3.3 Why Order Intake UI precedes Collection

- PRD sequence places **order intake before collection planning**.  
- PD-ORD-17: submit creates **order + OrderTests only**; Collection owns tasks/labels/specimens.  
- PD-LAB-BILL-01 / PD-ORD-09: normal OPD charge at **specimen collection** — Collection/Billing slices depend on later specimen events, not on skipping intake UI.  
- Without Orders UI, Manual UAT for L-ORD cannot close; Collection UAT would rely on API-only seeding or Pathology (forbidden as LMS SoT).

---

## 4. Candidate Domain Comparison

| Candidate | PRD need | Depends on Orders API | Depends on Catalogue | Repo support | Missing domain | Suitable as **next** bounded slice? |
|---|---|---|---|---|---|---|
| **A. Collection / Collection Planning** | Stage after intake | Submitted OrderTests | SpecimenType/Container/Timing refs | Nav placeholder; catalogue refs only | Tasks, scheduling, labels, collection events | **No** — premature; PD gaps large; intake UI unfinished |
| **B. Specimen Management** | Identity/custody after/with collection | OrderTests linkage | Specimen type/container config | Pathology specimen strings on LabReport (**RED**); LMS none | Specimen, aliquot, rejection, recollection | **No** — needs Collection policy first |
| **C. Receiving / Triage** | Post-collection receipt | Specimens + OrderTests | Config | None in LMS | Accession, triage, reject | **No** |
| **D. Testing / Examination** | Bench work | Received specimens / work items | Methods/analytes | None in LMS | Runs, instruments | **No** |
| **E. Results / Verification** | Technical verify | Testing outputs | Ref intervals etc. | Pathology completed reports (**RED**) | Result versions | **No** |
| **F. Authorization** | Clinical release gate | Verified results | Authz rules | None in LMS | Authorizer matrix | **No** |
| **G. Reporting** | Delivery/closure | Authorized results | Report templates | Lab report docs (**YELLOW**/Pathology) | LMS report aggregate | **No** |
| **H. Referral Operations** | Send-out lifecycle | OrderTest referral class | Partner config | Config placeholder partners page | Shipment/receipt | **No** |
| **I. Quality** | QC/CAPA cross-cut | Later operational volume | Equipment/reagents config | Placeholder pages | QC domain | **No** |
| **J. Billing** | Charge handoff | Specimen collection event (PD-LAB-BILL-01) | Commercial mapping | OPD Billing (**GREEN** financial SoT); LMS billing page placeholder | LMS→Billing trigger at collection | **No** for next — wrong stage |
| **K. Work Queue / Operations** | Cross-stage ops | Events from many domains | — | Placeholder | Ownership/assignment PD | **No** — deferred in plan |
| **L. Order Intake UI (L-ORD-01C)** | Completes PRD stage 2 | **Uses L-ORD-01B APIs** | Orderables API | Shell route; catalogue UI patterns (**GREEN** patterns) | FE client + composer/worklist/detail | **YES — recommended** |

### Per-candidate notes (summary)

**A. Collection** — High PRD value but blocked on: CollectionTask model, planning vs execution split, label/barcode, soft payment gates, site of collection vs operating branch (**many DECISION REQUIRED**). Not next.

**B–G** — Strictly downstream of specimens/tests/results. Unsuitable.

**H–K** — Cross-cut or later; Work Queue ownership deferred; Billing must not own clinical SoT and charges at collection.

**L. Orders UI** — Bounded to FE (+ thin API client). Reuses closed PD-ORD-01…19 and closed order APIs. Enables Manual UAT and real order production for subsequent Collection audit/PD.

---

## 5. Existing Repository Reuse Audit

| Asset | Classification | Notes |
|---|---|---|
| LaboratoryApi + `lms_*` + JWT/`LaboratoryAuthz` | **GREEN** | Order/Catalogue SoT |
| Platform Patient / Visit / User validate adapters | **GREEN** | Already used by OrderService |
| Platform Branch IDs + FE branch context | **GREEN** | Same as catalogue/orders |
| Platform `audit_log` / InternalAudit | **GREEN** | Orders already fail-closed |
| LMS catalogue UI patterns / Counsellor density patterns | **GREEN** (patterns) | For Orders composer polish |
| shadcn / ProtectedRoute / PermissionGate | **GREEN** | Staff UI stack |
| OPD Billing / CCMS | **GREEN** (financial SoT) | Reference only until Collection charge event |
| Pathology `LabReportsController` / catalog-order / specimenType on LabReport | **RED** | Must not become LMS Orders/Collection SoT |
| Pathology `laboratory_test_specimen_options` | **RED** as LMS master | UX reference only |
| FE `lab-reports.api.ts` / LaboratoryWorkbench | **RED / YELLOW** | Do not mount under LMS |
| Planned FE codes `lms.collection.view` etc. | **YELLOW** | Constants only; not seeded as LMS Collection authz yet |
| Catalogue `SpecimenTypeRef` / `ContainerRef` | **YELLOW** | Config refs for future Collection — not Specimen entities |

---

## 6. Order Integration Audit

How a *future* Collection/Specimen domain would consume orders (context for sequencing — **not** in L-ORD-01C scope):

| Question | Finding |
|---|---|
| How OrderTests become downstream work | Submit/amend create `lms_order_tests` with status `Ordered` (PD-ORD-10). Later slices advance test/specimen states — **not collapsed into Order status**. |
| Specimen creation ownership | **DECISION REQUIRED** — Collection vs Specimen domain boundary (PD-ORD-17 implies Collection stage owns collection acts; Specimen identity may be same or sibling slice). |
| CollectionTask separate object? | **DECISION REQUIRED** for Collection slice; **approved** that L-ORD does **not** create stubs (PD-ORD-17). |
| Collection planning configuration-driven? | Catalogue holds timing/container/specimen refs; engines deferred (PD-ORD-19). Collection slice must define what blocks vs informs. |
| Panel-expanded tests ↔ specimens | Panel → multiple OrderTests; whether one draw covers many tests = **DECISION REQUIRED**. |
| One specimen → many tests | **DECISION REQUIRED** (PRD FILE GAP for exact cardinality). |
| Many specimens → one order | Expected clinically; exact model **DECISION REQUIRED**. |
| Specimen identity generation | **DECISION REQUIRED** (accession vs barcode vs GUID business id). |
| Accessioning belongs where? | Likely Receiving/Triage or Specimen — **DECISION REQUIRED**. |
| Rejected/recollected representation | **DECISION REQUIRED**. |
| Snapshots required | Order already snapshots patient/provider/catalogue at submit; Collection should snapshot collector, site, datetime, container — **DECISION REQUIRED** detail. |

**L-ORD-01C implication:** UI must expose current version OrderTests as read-only after submit (and editable draft selections before submit) without inventing specimen/collection records.

---

## 7. State Machine Audit

Keep aggregates separate (PRD / PD-ORD-10):

| Aggregate | States today | Next-slice impact |
|---|---|---|
| **Order** | Draft / Submitted / Cancelled (+ version chain) | L-ORD-01C **consumes** only — no new states |
| **OrderTest** | `Ordered` | No Collected/Received in L-ORD-01C |
| **Specimen** | *None in LMS* | Out of scope |
| **Report** | *None in LMS* | Out of scope |

### For recommended L-ORD-01C

| Concern | Requirement |
|---|---|
| Required states | Existing only |
| Transitions | Server-enforced via existing APIs |
| Terminal | Cancelled |
| Amendment | Version create via amend API |
| Concurrency | Pass `ExpectedRowVersion` from UI |
| Audit | Existing order audit actions; UI must surface failures (503 audit_unavailable) |

### Future Collection/Specimen (not next) — illustrative open set

Required states/transitions **DECISION REQUIRED** from PRD once binary available; do not invent names in this audit beyond noting Pathology precedents (`sample_collected`, etc.) are **not** LMS SoT.

---

## 8. Multi-Site / Branch Audit

| Concern | Current rule | Next slice (Orders UI) | Later Collection |
|---|---|---|---|
| Operating branch | Required on order; JWT/branch authz server-side | UI must send operating branch; enforce server errors | Collection site may differ — **DECISION REQUIRED** |
| Performing branch | Equals operating (PD-ORD-04) | Display only; no alternate site picker inventing policy | Cross-site movement — **DECISION REQUIRED** |
| Collection / receiving / testing section | Not modeled | Out of scope | New PDs; reuse Branch IDs only — no new org hierarchy |

---

## 9. Permission Audit

### L-ORD-01C (recommended)

| Permission | Use | Status |
|---|---|---|
| `lms.view` | Workspace entry | Exists |
| `lms.orders.view` | Worklist, detail, versions | Definition exists |
| `lms.orders.create` | Draft create/update, submit, orderables | Definition exists |
| `lms.orders.manage` | Amend, cancel | Definition exists |
| `laboratory.view` | **Must not** authorize LMS Orders | Confirmed in tests |
| Role grants for UAT/production | **DECISION REQUIRED** (same class as PD-CAT-02) | Do not auto-grant in slice without PD |

No new permission codes are strictly required for L-ORD-01C if existing three order codes are used. Optional finer UI gates remain deferred.

### Future Collection (not next) — likely codes (illustrative, not approved)

`lms.collection.view` (already planned constant), plus future `create`/`manage`/`collect` — **DECISION REQUIRED** at Collection PD gate. Do not seed now.

---

## 10. Audit Requirements

### L-ORD-01C

| Mutation | Audit (already platform) | Fail-closed |
|---|---|---|
| CREATE_DRAFT | Yes | Yes |
| UPDATE_DRAFT | Yes | Yes |
| SUBMIT_ORDER | Yes | Yes |
| AMEND_ORDER | Yes | Yes |
| CANCEL_ORDER | Yes | Yes |

UI must:

- Not pretend success when API returns audit/platform failure.  
- Not write PHI to console/URL.  
- Preserve actor/tenant from JWT (never client TenantId).

No new audit allowlist work expected unless FE introduces new mutation types (it should not).

---

## 11. Recommended Next Slice

### L-ORD-01C — Enterprise LMS Order Intake UI

**Why this comes next**

1. Completes PRD stage “Patient/order intake” for staff.  
2. Honors L-ORD-01B acceptance status `IMPLEMENTATION_ACCEPTED_FOR_UI_LATER`.  
3. Unblocks Manual UI UAT explicitly deferred until composer exists.  
4. Matches `enterprise-lms-implementation-plan.md` recommended next slice.  
5. Avoids premature Collection/Specimen product invention (PD-ORD-17).  
6. Bounded: primarily FE against stable APIs; independently testable.

**Depends on:** L0, L-CAT-01, L-ORD-01B APIs, platform patient/visit/user, branch context.  
**Enables:** Manual UAT of orders; real Submitted OrderTests for a later Collection discovery/PD/implementation gate.  
**Complexity:** Medium (multi-screen FE, permissions, concurrency/idempotency UX) — **low schema risk**.  
**Major risks:** Role-grant gap blocking non-Admin UAT; over-scoping AOE/favourites; accidental Pathology reuse; building Collection “stubs” into the composer.

---

## 12. Proposed Data Model

**For L-ORD-01C only: no new LMS tables.**

Consume existing:

| Table | Role in UI |
|---|---|
| `lms_orders` | Worklist + header status/number/RowVersion |
| `lms_order_versions` | Draft/submit/amend clinical snapshot |
| `lms_order_selections` | Composer selections |
| `lms_order_tests` | Post-submit work items (read-only in intake) |
| `lms_order_idempotency` | Transparent via Idempotency-Key header/body |
| Catalogue orderables | Search/select (not admin catalogue list) |

Keys already present: GUID PKs, `tenant_id`, `operating_branch_id` / `performing_branch_id`, `row_version`, patient/visit/user IDs, catalogue pins.

**Do not create** collection/specimen/task tables in L-ORD-01C.

---

## 13. Proposed API Surface

**No new LaboratoryApi endpoints required for MVP L-ORD-01C** if existing contracts are sufficient. FE should call:

| Method | Route | Purpose | Permission | Mutating | Concurrency | Audit |
|---|---|---|---|---|---|---|
| GET | `/api/lms/catalogue/orderables` | Orderable search | `lms.orders.create` | Read | — | — |
| GET | `/api/lms/orders` | Worklist | `lms.orders.view` | Read | — | — |
| GET | `/api/lms/orders/{id}` | Detail | `lms.orders.view` | Read | — | — |
| GET | `/api/lms/orders/{id}/versions` | Version history | `lms.orders.view` | Read | — | — |
| POST | `/api/lms/orders` | Create draft | `lms.orders.create` | Yes | Idempotency-Key | CREATE_DRAFT |
| PUT | `/api/lms/orders/{id}/draft` | Update draft | `lms.orders.create` | Yes | ExpectedRowVersion | UPDATE_DRAFT |
| POST | `/api/lms/orders/{id}/submit` | Submit | `lms.orders.create` | Yes | ExpectedRowVersion + Idempotency | SUBMIT_ORDER |
| POST | `/api/lms/orders/{id}/amend` | Amend | `lms.orders.manage` | Yes | ExpectedRowVersion + Idempotency | AMEND_ORDER |
| POST | `/api/lms/orders/{id}/cancel` | Cancel | `lms.orders.manage` | Yes | ExpectedRowVersion + Idempotency | CANCEL_ORDER |

**FE deliverable:** typed client module (e.g. extend `laboratory-service.api.ts` or `lms-orders.api.ts`) — not a new backend service.

Any gap discovered in DTO shape for UI (e.g. list filters) → minimal additive API change only under explicit L-ORD-01C authorization (still not Collection).

---

## 14. UI Boundary

**Do not build in this audit.** Future L-ORD-01C surfaces:

| Surface | Type | Notes |
|---|---|---|
| Orders worklist | Worklist | Search/filter by status/branch/patient/order number |
| Order composer (draft) | Workflow screen | Patient, visit, providers, branch, source, priority, indication, selections |
| Order detail | Detail panel/page | Current version, tests, RowVersion, actions |
| Version history | Detail / secondary | Read-only chain |
| Amend / Cancel dialogs | Workflow modals | Reason + ExpectedRowVersion |
| Orderables picker | Embedded workflow control | From orderables API only |
| Catalogue admin | **Out of scope** | Already under Configuration |
| Collection / label print / specimen | **Out of scope** | Later slices |

Manual UI UAT remains deferred until L-ORD-01C ships. No fake clinical seed data.

---

## 15. Product Decision Register

Decisions for **recommended next slice (L-ORD-01C)** only:

| ID | Decision | Status |
|---|---|---|
| PD-ORD-01…19 | Order domain product rules | **APPROVED** (closed) — do not reopen |
| PD-ORD-UI-01 | UAT/production **role grants** for `lms.orders.*` (and whether Admin `*` only for first UAT) | **DECISION REQUIRED** |
| PD-ORD-UI-02 | L-ORD-01C UI scope: worklist + draft composer + submit + detail + amend + cancel in one slice vs phased | **DECISION REQUIRED** (recommend single slice) |
| PD-ORD-UI-03 | Patient/visit picker: reuse which existing Patient Hub / visit selection patterns | **DECISION REQUIRED** (pattern choice; no new patient master) |
| PD-ORD-UI-04 | Whether non-Admin UAT users are mandated before accepting L-ORD-01C | **DECISION REQUIRED** |
| PD-ORD-18 | Favourites / pathways | **DEFERRED** — keep out of L-ORD-01C |
| AOE engine | Configurable clinical questions | **DEFERRED** — keep out |
| CollectionTask at submit | PD-ORD-17 | **APPROVED** — still **no** in L-ORD-01C |
| PD-COL-* (specimen identity, barcode, accession, cardinality, collection site ≠ operating) | Collection/Specimen | **DEFERRED** — not for L-ORD-01C |

---

## 16. Architecture Decision Register

| ID | Architecture Decision | Status |
|---|---|---|
| AD-LMS-01 | LaboratoryApi owns LMS domain | **APPROVED** (existing) |
| AD-LMS-02 | Shared PG `hospitalportal` + `lms_*` | **APPROVED** (existing) |
| AD-ORD-UI-01 | L-ORD-01C is FE-first against existing `/api/lms/orders*` — **no** new microservice | **Proposed — confirm** |
| AD-ORD-UI-02 | FE API client lives in hospital-portal-web; Auth via existing JWT | **Proposed — confirm** |
| AD-ORD-UI-03 | No new order tables/migrations in L-ORD-01C | **Proposed — confirm** |
| AD-ORD-UI-04 | No SignalR/work-queue bus for Orders UI MVP | **Proposed — confirm** (Work Queue later) |
| Event/outbox for Collection handoff | — | **Deferred** |
| Accession/barcode strategy | — | **Deferred** (Collection/Specimen) |
| Document/label storage | — | **Deferred** |
| Pathology integration/migration | — | **Deferred** / must remain isolated |

---

## 17. PRD Traceability

Focus: recommended next slice only.

| PRD requirement (reconstructed) | Domain capability | Proposed implementation | Proposed test | Unresolved decision |
|---|---|---|---|---|
| Staff can compose lab orders in LMS workspace | Order Intake UI | L-ORD-01C composer at `/dashboard/lms/orders` | FE + API integration tests; Manual UAT checklist | PD-ORD-UI-02 scope |
| Orderables from governed Active catalogue | Orderables | Existing GET orderables | FE picker only shows orderables | — |
| Patient/visit/provider context | Platform refs | Existing validate adapters via APIs | Reject invalid patient/visit/branch in UI error states | PD-ORD-UI-03 picker |
| Draft vs submitted immutability | Order state | Existing draft/submit/amend/cancel APIs | UI disables illegal actions by status | — |
| Auditability of intake mutations | Platform audit | Existing fail-closed APIs | UI surfaces 503; no silent success | — |
| Permissions distinct from Pathology | Authz | `lms.orders.*` gates on pages/actions | Permission denied states; `laboratory.view` insufficient | PD-ORD-UI-01 grants |
| No collection at intake | Stage boundary | No collection UI/API in L-ORD-01C | Scope/regression tests ensure no CollectionTask create | — |

---

## 18. Scope Boundary

### IN SCOPE FOR NEXT SLICE (L-ORD-01C)

- Complete Orders UI under `/dashboard/lms/orders`  
- FE client for existing order + orderables APIs  
- Worklist, draft composer, detail, version history, amend/cancel UX  
- Permission gates using existing `lms.orders.*` (+ `lms.view`)  
- Loading / empty / error / denied / concurrency conflict / idempotent retry UX  
- Automated FE tests + Manual UI UAT after implementation  
- Counsellor-quality staff UX patterns (reuse, not copy counselling domain)

### OUT OF SCOPE

- Collection / CollectionTask / scheduling / labels / requisitions / barcodes  
- Specimen / aliquot / rejection / recollection / accession / custody / receiving / triage  
- Testing / results / verification / authorization / reporting  
- Referral operations, Quality, Analytics, Work Queue engine  
- Billing charge posting / payments  
- AOE engine, favourites, pathways  
- New LMS tables/migrations (unless explicitly tiny DTO additive gap under same authorization)  
- Pathology `/dashboard/laboratory` changes  
- Automatic production role grants without PD-ORD-UI-01  
- Starting L-COL / L-SPC / any downstream slice

Independently testable: FE + existing LaboratoryApi; Admin/`lms.orders.*` holders can exercise full intake without Collection.

---

## 19. Automated Test Strategy

| Area | Tests |
|---|---|
| Domain rules (via API contract from UI) | Create/update/submit validation errors surfaced |
| State transitions | Draft actions hidden when Submitted; Cancelled terminal in UI |
| Tenant isolation | No cross-tenant IDs in client; 404 handling |
| Branch authorization | Visit/branch mismatch errors displayed |
| Concurrency | Stale RowVersion → reload/retry UX; no double-apply |
| Idempotency | Retry create/submit with same key does not duplicate |
| Audit | 503 audit_unavailable does not show success toast |
| Catalogue/order integration | Orderables-only picker; pinned versions visible after submit |
| Invalid input | Priority reason, SelfRequested ack, empty selections |
| Failure/rollback | Network failure; disabled double-submit |
| Pathology regression | Existing Pathology FE/API tests unchanged; LMS pages do not call Pathology order APIs |
| Permissions | `laboratory.view` alone cannot use Orders UI |

Do not execute implementation in this audit.

---

## 20. Risks / Open Questions

| Risk / question | Severity | Mitigation |
|---|---|---|
| PRD binary still missing | Medium | Proceed with secondary sources; re-verify when file available |
| Role grants block non-Admin Manual UAT | High | PD-ORD-UI-01 before/during L-ORD-01C |
| Scope creep into Collection labels/tasks | High | Hard OUT OF SCOPE; PD-ORD-17 |
| Temptation to reuse Pathology order dialog | High | RED classification; Counsellor + LMS catalogue patterns only |
| Building Collection next “because nav exists” | High | Nav ≠ readiness; this audit rejects that path |
| FE discovers API DTO gaps | Low/Med | Allow only additive API under L-ORD-01C auth |
| Parallel Collection domain foundation | Optional later | Only after Orders UI UAT + Collection PD audit |

---

## 21. Recommendation

**Implement next: L-ORD-01C — Enterprise LMS Order Intake UI.**

It is the only candidate that (a) finishes the current PRD stage, (b) matches the accepted L-ORD-01B stop condition, (c) is bounded and low schema risk, and (d) unlocks honest Manual UAT and later Collection work without inventing specimen policy now.

**Do not** select Collection, Specimens, Receiving, Testing, Results, Authorization, Reporting, Referral Ops, Quality, Billing, or Work Queue as the immediate next slice.

---

## 22. Implementation Gate

Before coding L-ORD-01C:

1. Product Owner closes **PD-ORD-UI-01…04** (or explicitly accepts Admin-only first UAT + full composer scope).  
2. Explicit authorization brief for **L-ORD-01C** (UI-only / FE-first).  
3. Confirm **no** Collection/Specimen tables or APIs in that brief.  
4. After L-ORD-01C + Manual UI UAT acceptance → run a **new** Collection/Specimen discovery audit (do not skip PD).

```text
STOP — AUDIT ONLY COMPLETE
Do not start L-ORD-01C, Collection, or any other slice without authorization.
```

### Final status

**READY_FOR_PRODUCT_DECISIONS**
