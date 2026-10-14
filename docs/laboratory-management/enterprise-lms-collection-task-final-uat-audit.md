# L-COL-01B — Final Manual UAT / Acceptance Audit

**Date:** 2026-10-09  
**Slice:** L-COL-01B (CollectionTask foundation + search/ownership follow-up + invalid-GUID Assign fix)  
**Mode:** READ-ONLY VERIFICATION / UAT EVIDENCE + PRODUCT OWNER WAIVER CLOSURE — no application code, schema, API, permission, role-grant, UI, Orders, Catalogue, Pathology, Specimen, Receiving, or Billing changes  
**Prior gate:** `IMPLEMENTATION_COMPLETE_READY_FOR_TARGETED_UAT`  
**Acceptance record:** [enterprise-lms-collection-task-acceptance-closure.md](./enterprise-lms-collection-task-acceptance-closure.md)  
**L-COL-01B acceptance stamp:** **ACCEPTED** (2026-10-09) after Product Owner waiver

---

## FINAL ACCEPTANCE RECOMMENDATION

# READY_FOR_ACCEPTANCE

# L-COL-01B ACCEPTED

All mandatory acceptance requirements are satisfied by live evidence and/or automated server-side coverage under the explicit Product Owner waiver below for environment-dependent live multi-actor and related non-verifiable live probes.

---

## Product Owner Waiver

| Field | Content |
|---|---|
| **Decision** | **APPROVED — WAIVE LIVE SECOND-ACTOR UAT REQUIREMENT** (and related environment-dependent live probes listed below) |
| **Date** | 2026-10-09 |
| **Authority** | Product Owner explicit decision in acceptance-closure request |
| **Scope** | Live multi-actor execution evidence **only**, plus N1 / N2 / B5 live probes where automated equivalents exist |
| **Does not waive** | Underlying Claim / Assign / Release / assignee / concurrency / cancel / audit-fail-closed **business rules** — those remain in force unchanged |

### Rationale

The current UAT environment has only one authenticated user with the required Collection permissions (`admin@test.com` / Admin `*`).

The available second authenticated user `labtech1@hospital.com` can authenticate but receives **403** because it does not have:

- `lms.collection.view`
- `lms.collection.collect`

No temporary role grants are to be created solely to satisfy this UAT requirement.

The waiver accepts the existing automated server-side tests as sufficient evidence for the multi-actor ownership matrix and for the other environment-dependent live probes that have equivalent automated coverage.

### Exact waived live evidence

| ID | Waived live evidence | Status |
|---|---|---|
| B1 | Assigned A + Unclaimed → B Claims → 409 | **WAIVED_BY_PRODUCT_OWNER** |
| B2 | Unassigned + Claimed A → B Assign → 409 | **WAIVED_BY_PRODUCT_OWNER** |
| B3 | Non-claimer Release → 403 | **WAIVED_BY_PRODUCT_OWNER** |
| B4 | Live two-actor concurrent ownership race | **WAIVED_BY_PRODUCT_OWNER** |
| B5 | Live inactive-user assignment rejection | **WAIVED_BY_PRODUCT_OWNER** |
| N1 | Live successful Cancel + CANCEL audit | **WAIVED_BY_PRODUCT_OWNER** |
| N2 | Live audit fail-closed outage simulation | **WAIVED_BY_PRODUCT_OWNER** |

### Evidence substituted (not claimed as live)

| ID | Substituted evidence |
|---|---|
| B1 | `CollectionServiceTests` ownership matrix — Assigned-to-other → Claim → `claim_conflict` |
| B2 | `CollectionServiceTests` — Assign while claimed by other → `assign_conflict` |
| B3 | `CollectionServiceTests` — non-claimer Release → `release_forbidden` (403) |
| B4 | Automated concurrent / stale claim conflict + live single-actor stale RowVersion → 409 `concurrency_conflict` |
| B5 | `Assign_Rejects_Ineligible_Inactive_SoftDeleted_And_CrossTenant_Assignees` → `user_inactive` |
| N1 | `Cancel_From_Planned_Requires_Reason` (cancel success + reason); cancel audit action on same audited `TransitionAsync` path as other mutations; live invalid cancel / terminal rejection already PASS |
| N2 | `Audit_Fail_Closed_Rolls_Back_Create` → `audit_unavailable` (503), no CollectionTask persisted |

Also supporting: live single-actor Claim / Assign / Release / permission enforcement (`user_lacks_permission`, `assignee_invalid`).

### Explicit non-claim

> Live multi-actor execution was not performed; the Product Owner waived the environment-dependent live evidence requirement based on automated server-side coverage and existing live authorization evidence.

No Auth outage or destructive live test was induced to obtain N2 evidence.

---

## Acceptance scope (ACCEPTED)

- CollectionTask foundation
- Collection planning
- Collection queue
- Planned → Ready → InProgress → Completed
- Cancel rules
- Case-insensitive TaskNumber search
- Claim
- Assign
- Release
- Ownership matrix
- Assignee capability enforcement
- Malformed GUID handling
- Optimistic concurrency
- Platform audit
- Tenant / branch controls
- Order / OrderTest boundary
- Explicit non-creation of Specimen / Receiving
- Pathology regression

## Deferred / out of scope (unchanged)

- Specimen
- Receiving
- Accession
- Barcode
- Label
- Custody
- Aliquots
- Force reassign (PD-COL-OWN-04)
- Staff picker (PD-COL-UX-01)
- Production role grants

---

## 1. Scope

Audit acceptance readiness of L-COL-01B only (see Acceptance scope above).

**Out of scope / not started:** Specimen, accession, barcode, label, Receiving, custody, aliquots, force-reassign (PD-COL-OWN-04), staff picker (PD-COL-UX-01).

---

## 2. Documents reviewed

| Document | Role |
|---|---|
| `enterprise-lms-collection-task-implementation-report.md` | Foundation implementation report |
| `enterprise-lms-collection-search-ownership-decision-closure.md` | PD-COL-OWN-* / SEARCH-01 decisions |
| `enterprise-lms-collection-search-ownership-implementation-report.md` | Ownership/search implementation |
| `enterprise-lms-collection-assign-invalid-guid-fix-report.md` | Malformed GUID → 400 fix |
| `enterprise-lms-collection-specimen-decision-closure.md` | L-COL-01A / PD-COL-16 baseline |
| `enterprise-lms-order-implementation-report.md` | L-ORD-01B Order boundary |
| `enterprise-lms-order-ui-implementation-report.md` | L-ORD-01C UI boundary |
| Related Collection diagnostics / fix reports | Historical UAT evidence |
| This document + Product Owner waiver (above) | Acceptance closure |

---

## 3. Runtime environment

| Component | Evidence |
|---|---|
| Frontend | `http://localhost:3000` listening; Collection UI at `/dashboard/lms/collection` |
| LaboratoryApi | `http://localhost:7076` — admin/functions **200**; **30** functions including all 8 `LmsCollection*` endpoints |
| AuthService | `http://localhost:5073` listening |
| LaboratoryApi host | `func` PID **3076**, started **2026-10-09 21:25:56** local |
| Loaded artifact markers | `bin/output/LaboratoryApi.dll` contains `assignee_invalid` and `claim_conflict` (UTF-16 string scan) |
| Database | Azure PostgreSQL `hospitalportal` (read-only queries for this audit) |
| UAT actor (session) | `admin@test.com` / user id `dddddddd-dddd-dddd-dddd-dddddddddddd`, tenant `155fe198-6ae5-4a01-9254-ead5b427247e`, Admin |
| Second user probed | `labtech1@hospital.com` — login succeeds; Collection list returns **403** missing `lms.collection.view` |

No Specimen / Receiving / accession / barcode / aliquot / custody LMS tables exist (`lms_(specimen|receiving|accession|barcode|aliquot|custody|label)` count = **0**). Collection tables present: `lms_collection_tasks`, `lms_collection_task_order_tests`, `lms_collection_idempotency`, `lms_collection_task_number_sequences`.

---

## 4. Automated regression results (fresh this audit)

| Suite | Command / filter | Result | vs baseline |
|---|---|---|---|
| Full `LaboratoryApi.Tests` | `dotnet test …LaboratoryApi.Tests.csproj` | **113 passed**, 0 failed | Matches fix-report baseline (113) |
| Collection tests | filter `FullyQualifiedName~Collection` | **33 passed** | Matches baseline (33) |
| FE Collection UI | `enterprise-lms-collection-ui.test.ts` | **11 passed** | Matches baseline (11) |
| Auth LMS/Internal/Audit | filter `EnterpriseLms\|InternalLms\|InternalAudit` (alt `-o` output) | **31 passed** | Matches baseline (31) |
| Pathology FE workbench | `laboratory-l1-workbench.test.tsx` | **20 passed** | Regression green |

---

## 5. UAT evidence matrix (post-waiver)

| Acceptance Item | Result | Evidence |
|---|---|---|
| Collection queue loads | **PASS** | Live UI `/dashboard/lms/collection` shows worklist; API clear list returns 2 tasks |
| Planning / CREATE | **PASS** | Prior Manual UAT + DB/audit `CREATE_COLLECTION_TASK` for `COL-20261009-000003` and `COL-20261009-000004` |
| Lifecycle Planned→Ready→InProgress→Completed | **PASS** | Live transitions on `COL-20261009-000004` (2026-10-09 ~16:19Z) + prior UAT on `000003`; three `TRANSITION_COLLECTION_TASK` audits per task |
| Invalid transitions rejected server-side | **PASS** | Completed→Ready → **400** `terminal_state`; Planned→Completed jump → **400** `status_invalid`; Cancelled without reason → **400** `status_invalid` |
| Cancel success path (non-terminal → Cancelled) | **WAIVED_BY_PRODUCT_OWNER** (live) / **PASS** (automated) | Not executed live. `Cancel_From_Planned_Requires_Reason` proves cancel + reason. Business rule not waived |
| Search exact `COL-20261009-000003` | **PASS** | API + prior UI UAT |
| Search lowercase `col-20261009-000003` | **PASS** | API 200 → same TaskNumber; UI screenshot shows single matching row |
| Search mixed `CoL-20261009-000003` | **PASS** | API 200 → `COL-20261009-000003` |
| Clear search restores queue | **PASS** | API empty search → count **2** (`000004`, `000003`) |
| Dual Assigned / Claimed display | **PASS** | UI ownership column shows independent Assigned + Claimed lines |
| Claim (Unassigned + Unclaimed → A) | **PASS** (prior UAT + tests) | Prior Manual UAT; `CollectionServiceTests` matrix |
| Claim (Assigned A + Unclaimed → A) | **PASS** | Live: Claim **200**, claimedBy = admin |
| Claim does not modify AssignedToUserId | **PASS** | Live: `claimPreservedAssign=true` |
| Assign does not clear ClaimedByUserId | **PASS** | Live: Assign self while claimed → claim retained |
| Assigned A + Claimed A valid | **PASS** | Live Assign self while Claimed by same actor → **200** |
| Release clears claim only | **PASS** | Live Release **200**; Claimed null; Assigned preserved |
| Release preserves assignment | **PASS** | Live afterRelease.assigned = admin GUID |
| Assigned A + Unclaimed → B Claims → 409 | **WAIVED_BY_PRODUCT_OWNER** | Automated `claim_conflict`. Live multi-actor not performed |
| Unassigned + Claimed A → B Assign → 409 | **WAIVED_BY_PRODUCT_OWNER** | Automated `assign_conflict`. Live multi-actor not performed |
| Non-claimer Release rejected | **WAIVED_BY_PRODUCT_OWNER** | Automated `release_forbidden`. Live multi-actor not performed |
| Eligible assignee (`lms.collection.collect` / Admin `*`) | **PASS** | Live Assign admin GUID → **200** |
| Ineligible active same-tenant (no collect) | **PASS** | Live Assign `labtech1` → **400** `user_lacks_permission` |
| Inactive user assignment rejected | **WAIVED_BY_PRODUCT_OWNER** (live) / **PASS** (automated) | `user_inactive` in `Assign_Rejects_Ineligible_…`. Live probe not available |
| Cross-tenant assignee rejected | **PASS** | Live → **400** `platform_not_found` |
| Unknown GUID rejected | **PASS** | Live → **400** `platform_not_found` |
| Malformed GUID `ram` / `reddy` | **PASS** | Live → **400** `assignee_invalid`; RowVersion unchanged |
| Optimistic concurrency (single-actor stale RV) | **PASS** | Live stale Claim → **409** `concurrency_conflict` |
| Impossible state Assigned A + Claimed B via APIs | **PASS** (rules + tests) | Matrix enforcement prevents via APIs |
| Live two-actor concurrent ownership race | **WAIVED_BY_PRODUCT_OWNER** | Automated concurrency / conflict tests + live single-actor 409 |
| Audit CREATE / TRANSITION / CLAIM / ASSIGN / RELEASE | **PASS** | Live `audit_log` rows with actor, tenant, resource type/id, action, timestamp, status |
| Audit CANCEL | **WAIVED_BY_PRODUCT_OWNER** (live) | Cancel audited on same `TransitionAsync` fail-closed path; cancel success covered by automated test |
| Failed validation/conflict → no success mutation audit | **PASS** | Malformed / ineligible Assign produced no success ASSIGN audit |
| Audit fail-closed | **WAIVED_BY_PRODUCT_OWNER** (live) / **PASS** (automated) | `Audit_Fail_Closed_Rolls_Back_Create`. Live outage not induced |
| Order remains Submitted | **PASS** | `LAB-20261009-000005` **Submitted** |
| OrderTest remains Ordered | **PASS** | Linked OrderTest **Ordered** |
| CollectionTask independent lifecycle | **PASS** | Task Completed while Order still Submitted |
| No Specimen created | **PASS** | Zero LMS Specimen tables; detail API has no specimenish keys |
| No Receiving / accession / barcode / label / aliquot / custody | **PASS** | Schema scan + no Specimen/Receiving API functions |
| Pathology regression | **PASS** | `/dashboard/laboratory` loads; FE workbench **20** tests pass |
| Tenant isolation | **PASS** (tests + runtime scope) | Cross-tenant create/list in tests; live tenant-scoped data |
| Branch authorization / scope | **PASS** (partial live + tests) | Branch on tasks; create requires branch (tests) |
| Automated tests baseline | **PASS** | 113 / 33 / 11 / 31 (+ Pathology 20) |

---

## 6. Ownership verification (detail)

### Live single-actor matrix (admin session on `COL-20261009-000004`)

| Step | Result |
|---|---|
| Before | Planned; Assigned=admin; Claimed=null; RowVersion=11 |
| Claim | **200**; Claimed=admin; Assigned unchanged |
| Assign `ram` | **400** `assignee_invalid`; RowVersion unchanged |
| Assign `reddy` | **400** `assignee_invalid`; RowVersion unchanged |
| Assign self | **200**; Claim retained |
| Release | **200**; Claim cleared; Assigned retained |
| Stale Claim (old RV) | **409** `concurrency_conflict` |

### Multi-actor rows (waived for live execution)

| Matrix row | Live status | Substituted evidence |
|---|---|---|
| Assigned A + Unclaimed → B Claims → 409 | **WAIVED_BY_PRODUCT_OWNER** | Automated `claim_conflict` |
| Unassigned + Claimed A → B Assign → 409 | **WAIVED_BY_PRODUCT_OWNER** | Automated `assign_conflict` |
| Non-claimer Release → 403 | **WAIVED_BY_PRODUCT_OWNER** | Automated `release_forbidden` |
| Live concurrent Claim race | **WAIVED_BY_PRODUCT_OWNER** | Automated concurrency + live single-actor 409 |

> Live multi-actor execution was not performed; the Product Owner waived the environment-dependent live evidence requirement based on automated server-side coverage and existing live authorization evidence.

---

## 7. Audit verification

Observed successful platform audit actions for CollectionTask (live):

- `CREATE_COLLECTION_TASK`
- `TRANSITION_COLLECTION_TASK`
- `CLAIM_COLLECTION_TASK`
- `ASSIGN_COLLECTION_TASK`
- `RELEASE_COLLECTION_TASK`

Each inspected row included: actor (`user_id`), `tenant_id`, `resource_type` = `LmsCollectionTask`, `resource_id`, `action`, `created_at`, `status` = `active`.

Cancel audit and live fail-closed outage: **WAIVED_BY_PRODUCT_OWNER** with automated equivalents (see Product Owner Waiver).

No internal audit keys / hashes disclosed in this report.

---

## 8. Order boundary verification

For CollectionTask `COL-20261009-000003` / Order `LAB-20261009-000005`:

| Entity | Status after Collection lifecycle/ownership work |
|---|---|
| Order | **Submitted** |
| OrderTest | **Ordered** |
| CollectionTask | **Completed** (independent) |

No evidence that Claim/Assign/Release/Transition mutated Order or OrderTest status.

---

## 9. Specimen / Receiving boundary verification

| Check | Result |
|---|---|
| LMS Specimen / Receiving / accession / barcode / aliquot / custody / label tables | **Absent** |
| LaboratoryApi admin functions for Specimen/Receiving | **None** among 30 functions |
| Completed task detail payload specimenish fields | **None** |
| UI subtitle | Explicit “no Specimen in this slice” |
| Pathology `laboratory_test_specimen_options` | Pre-existing Pathology/catalogue table — not LMS Collection Specimen birth |

**Critical acceptance condition met for non-creation of Specimen/Receiving by L-COL-01B.**

---

## 10. Security verification

| Area | Result | Notes |
|---|---|---|
| Tenant from JWT / tenant-scoped queries | **PASS** (tests + live tenant-scoped data) | |
| Cross-tenant assignee | **PASS** (live reject) | |
| Branch required on create / filter | **PASS** (tests + live branch ids) | Fine-grained branch ACL on JWT still known limitation |
| Assignee capability `lms.collection.collect` | **PASS** (live `user_lacks_permission`) | |
| No role grants added by this audit / waiver | Confirmed | |
| Permission definitions present | `lms.collection.view` / `manage` / `collect` | |

---

## 11. Known limitations (accepted with slice)

1. UAT / ops may still rely on Admin `*` or temporary grants; production role seeding was never part of L-COL-01B.
2. Live multi-actor ownership matrix not executed — waived by Product Owner (automated coverage retained as SoT for those rows).
3. Ownership UI still shows truncated GUIDs (PD-COL-UX-01 deferred).
4. Force reassign deferred (PD-COL-OWN-04).
5. PRD binary FILE GAP preserved where applicable.
6. Fine-grained JWT branch ACL list still a documented platform limitation (same class as Orders).

---

## 12. Waived / formerly blocked tests (summary)

| ID | Item | Status |
|---|---|---|
| B1 | Assigned A + Unclaimed → B Claims → 409 | **WAIVED_BY_PRODUCT_OWNER** |
| B2 | Unassigned + Claimed A → B Assign → 409 | **WAIVED_BY_PRODUCT_OWNER** |
| B3 | Non-claimer Release → 403 | **WAIVED_BY_PRODUCT_OWNER** |
| B4 | Live two-actor concurrent ownership race | **WAIVED_BY_PRODUCT_OWNER** |
| B5 | Live inactive-user Assign rejection | **WAIVED_BY_PRODUCT_OWNER** |
| N1 | Live Cancel success + CANCEL audit | **WAIVED_BY_PRODUCT_OWNER** |
| N2 | Live audit fail-closed outage | **WAIVED_BY_PRODUCT_OWNER** |

---

## 13. Acceptance decision path

1. Final UAT audit initially returned **ACCEPTANCE_BLOCKED** due to environment-only multi-actor gaps.  
2. Product Owner approved waiver of live second-actor (and related) evidence requirements with automated substitution.  
3. Matrix re-evaluated: all mandatory requirements **PASS** or **WAIVED_BY_PRODUCT_OWNER** with equivalent automated coverage.  
4. Final recommendation: **READY_FOR_ACCEPTANCE** → **L-COL-01B ACCEPTED**.

---

## 14. Confirmation — closure hygiene

- No application code modified.
- No migrations / schema / API / permission / role-grant / UI changes.
- No Specimen / Receiving implementation started.
- No “fixes” applied for findings.
- Waiver does **not** falsely claim live multi-actor execution.

---

## FINAL STATUS

**READY_FOR_ACCEPTANCE**

**L-COL-01B ACCEPTED**

**STOP.** Do not start Specimen or Receiving.
