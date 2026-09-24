# Phase 3I Slice 12 — Leave / Reassignment Required  
# PRODUCT DECISION RECORD

| Field | Value |
|-------|--------|
| **Document date** | 2026-09-21 |
| **Mode** | **PRODUCT DECISION ACCEPTANCE** — no production code, API, DB, migration, permission, ownership, UI, formula, or queue changes in this task |
| **Source readiness audit** | `docs/audits/counsellor-ownership-work-allocation-phase3i-slice12-readiness-audit.md` |
| **Prior decision sources** | `docs/audits/counsellor-ownership-work-allocation-phase3h-product-decisions.md` (**PD-LEAVE-01**, Hybrid E, PD-WL-01/02, PD-FOLLOWUP-01, PD-SUP-01, PD16); Slice 6–10 Accepted/certified behaviors; Slice 11 Product Decisions + Implementation Report (**ACCEPTED**) |
| **Convention** | Under `docs/audits/` to match Phase 3H / Phase 3I records |
| **Acceptance date** | 2026-09-21 |
| **Sign-off convention** | Explicit product acceptance of PD-S12-01…19 recorded in this document. Named hospital formal signatures remain optional and are not fabricated. |

| Change gate (this task) | Value |
|-------------------------|--------|
| Production code changed | **NO** |
| API changed | **NO** |
| DB / schema changed | **NO** |
| Permission changed | **NO** |
| UI changed | **NO** |
| Implementation started | **NO** |
| Slice 13 started | **NO** |

---

## 1. Status

| Metric | Status |
|--------|--------|
| Slice 12 readiness audit | **COMPLETE** |
| Slice 12 Product Decision Record | **ACCEPTED / READY FOR IMPLEMENTATION** |
| PD-S12-01…19 | **ACCEPTED** (19 / 19) |
| PD-LEAVE-01 | **CONFIRMED + REFINED** (via PD-S12-*) |
| Formal product-owner acceptance | **GRANTED** |
| Implementation | **NOT STARTED** / **NOT YET IMPLEMENTED** |
| Implementation code authorized by this document alone | **NO** — requires **separate explicit implementation prompt** |
| Manual UAT | **NOT STARTED** |
| Slice 12 delivery Acceptance | **NOT STARTED** |
| Slice 13 | **NOT STARTED** |

### Implementation gate (mandatory)

> **PRODUCT DECISION ✅ ACCEPTED / READY FOR IMPLEMENTATION**  
> **IMPLEMENTATION ❌ NOT STARTED**  
>
> Product decisions PD-S12-01…19 are accepted.  
> **Implementation requires a separate explicit implementation prompt.**  
> This acceptance document does **not** itself change production code, APIs, schema, permissions, or UI.

### Gate summary

```text
AUDIT ✅
PRODUCT DECISION ✅ ACCEPTED
IMPLEMENTATION ❌ NOT STARTED
AUTOMATED TESTS ❌
MANUAL UAT ❌
ACCEPTANCE ❌
SLICE 13 ❌
```

---

## Product Acceptance

**Phase 3I Slice 12 — Leave / Reassignment Required**

| Field | Value |
|-------|--------|
| **Status** | **ACCEPTED / READY FOR IMPLEMENTATION** |
| **Implementation status** | **NOT STARTED** |
| **Manual UAT** | **NOT STARTED** |
| **Slice 12 acceptance (delivery)** | **NOT STARTED** |

### Accepted principles

- Explicit human remediation  
- No automatic ownership transfer  
- Reassignment Required is an **operational condition** (not a new counselling lifecycle `Status`)  
- Open operational sessions require remediation  
- Completed sessions remain historical  
- Existing **Reassign** is primary  
- **ReQueue** is fallback  
- Existing ownership history is reused  
- Version / CAS preserved  
- PD16 preserved  
- Unavailable users cannot become new ownership targets  
- Existing **Counselling Sessions** surface is the authoritative remediation surface  
- Analytics My Work remains reporting only  
- Waiting List remains shared  
- Follow-up remains shared  
- No new Supervisor role  
- No new permission  

### Core model (accepted)

- `CounselorId` remains ownership SoT; `CreatedByUserId` never ownership  
- No automatic `CounselorId` mutation on counsellor unavailability  
- Human remediation required  
- Ownership history preserved  
- No automatic cross-branch exception  
- No new ownership table/entity  

---

## 2. Source audit summary (preserved findings)

The Slice 12 readiness audit established (preserved as pre-implementation baseline):

1. Ownership SoT = `CounselingSession.CounselorId`; `CreatedByUserId` ≠ ownership.  
2. `UsersController.Deactivate` sets `UserStatus = inactive` and does **not** clear/check `CounselorId`.  
3. No runtime **Reassignment Required** signal; no dedicated remediation worklist (pre-implementation).  
4. Assign / Reassign / ReQueue, Version/CAS, and ownership history already exist.  
5. PD16 branch authorization already exists.  
6. Assign/Reassign currently allow **inactive non-deleted** targets; picker does not filter inactive — **to be corrected per PD-S12-17**.  
7. Analytics My Work is **not** an operational worklist (Slice 11 Accepted).  
8. Waiting List and Follow-up Center remain **shared**.  
9. Finalize / Post-Surgery remain outside counsellor ownership personalization.  
10. No automatic leave remediation exists in counselling runtime.

---

## 3. Relationship to PD-LEAVE-01

| Field | Value |
|-------|--------|
| Prior Phase 3H status | WORKING — AGREED FOR IMPLEMENTATION WORKFLOW / NOT FORMALLY SIGNED |
| **Slice 12 status** | **CONFIRMED + REFINED** |
| Supersession | **None** — no automatic transfer; no auto-ReQueue-on-leave; no new Supervisor role |

### Confirmed from PD-LEAVE-01

- No automatic `CounselorId` change on leave / inactive / branch / departure  
- Surface **Reassignment Required** as ops condition ≠ new lifecycle state  
- Explicit human (Supervisor/Admin capability via `.reassign`) remediation  
- Preserve ownership history  
- IAM blocks unavailable-user access  
- Follow-up Center remains branch-shared  

### Refined by PD-S12-01…19

Triggers, operational population, deactivation sequencing (allow then remediate), authoritative surface (Counselling Sessions filter), ReQueue as fallback, inactive-target exclusion, Analytics/WL/Follow-up boundaries.

---

## 4. Existing certified / working constraints (preserved)

| ID / Slice | Rule | Slice 12 stance |
|------------|------|-----------------|
| Ownership SoT | `CounselorId` only | **Preserved** |
| Hybrid E | Shared queues + owned active counselling | **Preserved** |
| PD-WL-01 / 02 | Shared WL; NULL owner valid | **Preserved** |
| Slice 6 | Assign / Reassign + owner ACL | **Reuse** for remediation |
| Slice 7 | Version / CAS | **Preserved** |
| Slice 8 | ReQueue → NULL + `OwnershipRequeued` | **Preserved**; leave-use = fallback (PD-S12-11) |
| Slice 9 | Finalize / Post-Surgery | **Preserved** |
| Slice 10 | Follow-up shared; Original Counsellor historical | **Preserved** |
| Slice 11 Accepted | My Work = Analytics only | **Preserved** |
| PD16 | Server-side branch auth | **Preserved** |
| PD-SUP-01 | No new Supervisor role | **Preserved** — use `counseling_sessions.reassign` |

---

## 5. Formal decisions PD-S12-01 through PD-S12-19 — ACCEPTED

All decisions below: **ACCEPTED** (2026-09-21).

---

### PD-S12-01 — Definition of Unavailable — **ACCEPTED**

A counsellor is **unavailable** for Slice 12 ownership remediation when **any** of:

1. `UserStatus` is inactive, **OR**  
2. User is soft-deleted / `DeletedAt` is set, **OR**  
3. User loses counsellor ownership eligibility / counsellor role required to perform counselling ownership work, **OR**  
4. User loses authorization for the **branch containing the owned session**.

| Rule | Accepted |
|------|----------|
| These conditions are ownership-remediation triggers | Yes |
| Temporary leave **without** a corresponding system signal | **OUT OF SCOPE** for automatic detection in Slice 12 |
| New availability state | **Do not introduce** |
| HR integration | **Do not create** |
| Branch access loss vs `UserStatus` inactive | Separate operational triggers; both may result in Reassignment Required |

---

### PD-S12-02 — Affected Ownership Population — **ACCEPTED**

Operational remediation applies only to **non-deleted** sessions that remain **operationally open** and have `CounselorId = unavailable counsellor`.

| Include in Reassignment Required | Exclude |
|----------------------------------|---------|
| Assigned Waiting / not-started | Completed / terminal (historical + Analytics only) |
| InProgress | NULL `CounselorId` (not leave-remediation) |

Do **not** modify historical ownership merely because a counsellor becomes unavailable.

---

### PD-S12-03 — Deactivation Sequencing — **ACCEPTED (Option B)**

**Allow** user deactivation and **require post-deactivation** ownership remediation.

**Sequence:**

1. Identify affected operationally open owned sessions.  
2. Allow/complete user deactivation per existing Admin Users lifecycle.  
3. Surface affected sessions as Reassignment Required.  
4. Authorized actor explicitly Reassigns or, where permitted, ReQueues.

| Forbidden | |
|-----------|--|
| Block account deactivation on counselling remediation completion | |
| Automatic ownership transfer | |

---

### PD-S12-04 — Assigned but Not Started — **ACCEPTED**

- Require remediation.  
- `CounselorId` **not** automatically cleared.  
- Appear on Reassignment Required surface.  
- Primary: explicit Reassign.  
- ReQueue only per PD-S12-11.

---

### PD-S12-05 — InProgress — **ACCEPTED**

- Require remediation.  
- `CounselorId` unchanged until explicit remediation.  
- Appear on Reassignment Required surface.  
- Primary: explicit Reassign.  
- ReQueue only per PD-S12-11.  
- No automatic transfer.

---

### PD-S12-06 — Completed — **ACCEPTED**

- Do **not** require leave remediation.  
- Retain `CounselorId`.  
- Historical ownership / Analytics attribution.  
- Do **not** appear in Reassignment Required.  
- No automatic `CounselorId` mutation.

---

### PD-S12-07 — Follow-up — **ACCEPTED**

- Leave remediation affects **counselling session ownership only**.  
- Follow-up Center remains **shared**.  
- Original Counsellor remains **historical**.  
- No My Follow-ups.  
- No Follow-up ownership redesign.  
- No leave-triggered Follow-up reassignment.

---

### PD-S12-08 — Branch Access Loss — **ACCEPTED**

- Loss of branch authorization for a counsellor who owns operationally open sessions → **Reassignment Required**.  
- Ownership retained until explicit remediation.  
- Owner cannot continue unauthorized ops (existing PD16 / action-time auth).  
- No automatic ownership clearing.  
- No cross-branch authorization exception.

---

### PD-S12-09 — Remediation Authority — **ACCEPTED**

- Primary capability: existing **`counseling_sessions.reassign`**.  
- **No** new Supervisor role.  
- **No** new permission.  
- Leave remediation subject to existing branch authorization and ownership ACL.  
- ReQueue uses existing authorization only where PD-S12-11 permits.  
- Inactive owner cannot self-remediate after deactivation (no system access).

---

### PD-S12-10 — Automatic Reassignment — **ACCEPTED**

- **NO** automatic ownership transfer.  
- **NO** automatic `CounselorId` mutation.  
- **NO** automatic ReQueue.  
- Leave/unavailability only creates Reassignment Required.  
- Authorized human must explicitly Reassign or permitted ReQueue.  
- Future automatic transfer = **CERTIFIED BEHAVIOR CHANGE** requiring explicit approval.

---

### PD-S12-11 — ReQueue as Leave Remediation — **ACCEPTED**

| Role | Mechanism |
|------|-----------|
| **Primary** | A → B via **Reassign** |
| **Fallback** | A → NULL via existing **ReQueue** |

- Use ReQueue when releasing to shared branch-authorized Waiting List rather than immediately selecting another counsellor.  
- Existing ReQueue reason required.  
- Existing `OwnershipRequeued` authoritative; no new leave-specific ReQueue event.  
- No automatic ReQueue on deactivation.  
- Preserve Version/CAS.

---

### PD-S12-12 — Audit / History — **ACCEPTED**

Reuse existing ownership history:

| Operation | Event |
|-----------|--------|
| Reassign | `OwnershipReassigned` |
| ReQueue | `OwnershipRequeued` |

Preserve: previous owner, remediation actor / `ChangedByUserId`, `ChangedAt`, reason, operation type.

Existing reason field sufficient for v1.  
**No** new ownership history table.  
**No** new structured leave-source field for Slice 12 v1.

---

### PD-S12-13 — Concurrency — **ACCEPTED**

Preserve Slice 7 Version/CAS:

| Scenario | Behavior |
|----------|----------|
| Stale version | Existing 409 conflict |
| Owner changed while remediation UI open | Conflict |
| Remediation already completed | Refresh / current state |
| Already ReQueued / `CounselorId` NULL | Do not perform ownership-transfer incorrectly |
| Deleted session | Not remediable |

Do **not** alter existing CAS implementation.

---

### PD-S12-14 — Reassignment Required Operational Surface — **ACCEPTED**

**Authoritative surface (ONE):** existing **Counselling Sessions** operational surface with a scoped **Reassignment Required** filter.

- Identify operationally open sessions whose `CounselorId` belongs to an unavailable counsellor.  
- Support existing Reassign workflow.  
- Support ReQueue only where PD-S12-11 permits.  
- **Do not** create a new operational queue/entity for v1.

| Excluded | |
|----------|--|
| Analytics My Work as remediation queue | |
| Private / personalized Waiting List | |
| Follow-up Center as remediation queue | |

Admin Users deactivation may warn / drill into Counselling Sessions, but is **not** a second authoritative worklist.

---

### PD-S12-15 — Deactivation Sequencing — **ACCEPTED**

Deactivation follows existing Admin Users lifecycle.

After / because the user becomes unavailable:

1. Affected operational sessions detected  
2. Reassignment Required surfaced  
3. Authorized actor remediates  

| Forbidden | |
|-----------|--|
| Block deactivation waiting for reassignment | |
| Automatic Reassign | |
| Automatic ReQueue | |

---

### PD-S12-16 — Cross-Branch Reassignment — **ACCEPTED**

- No cross-branch exception.  
- PD16 remains authoritative for actor and target.  
- Cross-branch reassignment **not** introduced by Slice 12.  
- Future exception = **CERTIFIED BEHAVIOR CHANGE**.

---

### PD-S12-17 — Inactive / Unavailable Assignment Targets — **ACCEPTED**

Unavailable counsellors must **NOT** be eligible as new ownership targets:

- Inactive users cannot be **Assign** targets  
- Inactive users cannot be **Reassign** targets  
- Unavailable users excluded from counsellor ownership-target pickers  
- Soft-deleted users remain excluded  

Eligibility aligns with PD-S12-01 unavailable definition.

**Explicitly accepted Slice 12 behavior change** vs current repository (inactive non-deleted currently allowed as targets).  
Do not silently expand eligibility beyond PD-S12-01.

---

### PD-S12-18 — Analytics Boundary — **ACCEPTED**

Slice 11 Analytics boundary unchanged.

| My Work is | My Work is not |
|------------|----------------|
| Reporting attribution | Reassignment Required |
| Strict `CounselorId` | Operational remediation queue |
| Historical / windowed ownership attribution | Personal leave task queue |

Until Reassign/ReQueue: existing `CounselorId` remains attribution.  
After Reassign: attribution moves.  
After ReQueue: NULL → exits previous owner's My Work.

No Analytics implementation change authorized merely because of Slice 12.

---

### PD-S12-19 — Session / JWT Invalidation — **ACCEPTED**

- Immediate JWT/session revocation **OUT OF SCOPE** for Slice 12.  
- Use existing auth lifecycle (inactive cannot authenticate/refresh).  
- Future immediate revocation = separate security decision.  
- Do **not** redesign authentication.

---

## 6. Accepted cross-decision matrix

| Scenario | Trigger | CounselorId | Reassignment Required | Surface | Actor | History | Branch |
|----------|---------|-------------|------------------------|---------|-------|---------|--------|
| Active counsellor | None | Retained | No | Normal operations | Existing ACL | Existing | PD16 |
| Temporary leave without system signal | None available | Retained | No automatic detection | None | N/A | Existing | PD16 |
| UserStatus inactive | Unavailable | Retained until remediation | Yes for open operational sessions | Counselling Sessions → Reassignment Required | `.reassign` | Existing | PD16 |
| Soft deleted | Unavailable | Retained historically / until remediation | Yes for open operational sessions | Reassignment Required | `.reassign` | Existing | PD16 |
| Counsellor eligibility/role removed | Unavailable | Retained | Yes for open operational sessions | Reassignment Required | `.reassign` | Existing | PD16 |
| Branch access removed | Unavailable for session branch | Retained | Yes for open operational sessions | Reassignment Required | `.reassign` | Existing | PD16 |
| Assigned Waiting | Owner unavailable | Retained | Yes | Reassignment Required | `.reassign` / permitted ReQueue | Existing | PD16 |
| InProgress | Owner unavailable | Retained | Yes | Reassignment Required | `.reassign` / permitted ReQueue | Existing | PD16 |
| Completed | Owner unavailable | Retained | No operational remediation | Analytics/history only | N/A | Historical | N/A |
| ReQueued | Previous remediation | NULL | No | Shared Waiting List | Existing assignment flow | `OwnershipRequeued` | PD16 |
| NULL owner | Unassigned | NULL | No leave remediation | Shared Waiting List | Assign | N/A | PD16 |
| Inactive target | Assign/Reassign attempt | Must not be assigned | N/A | Ownership picker | Existing authorized actor | N/A | PD16 |
| Cross-branch target | Reassign attempt | Unchanged if denied | N/A | Reassign UX | `.reassign` | No success trail | PD16 |
| Already reassigned | Concurrent refresh | New owner | No duplicate remediation | Current state | N/A | Existing trail | PD16 |
| Concurrent mutation | Stale version | Unchanged on failure | Retry after refresh | Remediation UI | Authorized actor | No success event on conflict | PD16 |

---

## 7. Certified behavior changes (accepted) vs protected

### Explicitly accepted Slice 12 changes

1. Introduce Reassignment Required operational detection/scope.  
2. Exclude unavailable users from new Assign/Reassign ownership targets (PD-S12-17).  
3. Surface affected open owned sessions through the existing Counselling Sessions operational surface (PD-S12-14).

### Explicitly protected (NOT allowed)

- Automatic ownership transfer  
- Automatic `CounselorId` mutation  
- Automatic ReQueue  
- Cross-branch authorization bypass  
- Analytics My Work becoming an operational queue  
- Waiting List becoming a private/personalized ownership queue  
- Follow-up ownership redesign  
- New Supervisor role  
- New permission  
- New ownership entity/table  

---

## 8. Future implementation impact (authorized only by separate implementation prompt)

### Backend (expected)

- Detection/query for operationally open sessions owned by unavailable counsellor  
- Assign/Reassign target validation + counsellor picker eligibility (PD-S12-17)  
- Reuse Reassign / ReQueue / history / PD16 / Version-CAS  
- Optional Admin deactivate warn/drill (not second worklist)  

### Frontend (expected)

- Counselling Sessions scoped Reassignment Required filter (authoritative surface)  
- Existing Reassign UX; ReQueue where fallback permitted  
- Optional Admin Users affected-session warning → Sessions surface  

### Not to invent without further CERTIFIED BEHAVIOR CHANGE

- Auto-transfer / auto-ReQueue  
- New permission / Supervisor role / ownership table  
- Analytics / WL / Follow-up / Finalize redesign  

---

## 9. Testing expectations (future — do not write tests in this task)

1. Unavailable trigger detection (PD-S12-01)  
2. Deactivation allow + post-remediation (PD-S12-03/15)  
3. Population include Waiting assigned + InProgress; exclude Completed (PD-S12-02/04/05/06)  
4. Inactive/unavailable target rejection (PD-S12-17)  
5. Reassign primary + ReQueue fallback + CAS (PD-S12-11/13)  
6. History events (PD-S12-12)  
7. Branch / no cross-branch (PD-S12-08/16)  
8. No Analytics My Work / WL / Follow-up / Finalize regressions  

---

## 10. Out of scope (this acceptance task)

- Production code / API / DB / migration / permission / role changes  
- Implementation / UI / worklist creation  
- Automatic reassignment or automatic ReQueue  
- Slice 13  

---

## 11. Decision tally

| Category | Count | Status |
|----------|-------|--------|
| PD-S12-01…19 | **19** | **ACCEPTED** |
| PD-LEAVE-01 | — | **CONFIRMED + REFINED** |
| Formal product acceptance | — | **GRANTED** |
| Implementation | — | **NOT STARTED** |

---

## 12. Final gate

```text
AUDIT ✅
PRODUCT DECISION ✅ ACCEPTED
IMPLEMENTATION ❌ NOT STARTED
AUTOMATED TESTS ❌
MANUAL UAT ❌
ACCEPTANCE ❌
SLICE 13 ❌
```

**Implementation requires a separate explicit implementation prompt.**

Do **not** implement Slice 12 from this Product Decision Acceptance alone.

---

**END — SLICE 12 PRODUCT DECISIONS ACCEPTED — STOP (await separate implementation prompt)**
