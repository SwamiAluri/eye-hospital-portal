# Phase 3I Slice 13 — Readiness Audit

| Field | Value |
|-------|--------|
| **Document date** | 2026-09-21 |
| **Mode** | **AUDIT ONLY** — no production code, API, schema, migration, permission, ownership, UI, formula, or test changes |
| **Prior gate** | Phase 3I Slice 12 — Leave / Reassignment Required **COMPLETE / DELIVERY ACCEPTED** (`docs/audits/phase3i-slice12-acceptance.md`) |
| **Prior product SoT** | Phase 3H `docs/audits/counsellor-ownership-work-allocation-phase3h-product-decisions.md`; Phase 3I Slices 1–12 audit / decision / implementation / acceptance records |
| **Slice 13 implementation** | **NOT STARTED** |
| **Product Decision (Slice 13)** | **NOT STARTED** |
| **UX Continuity Reconciliation** | **COMPLETE** (Sections 22–33) — audit artifact only; does **not** select Slice 13 scope |

**Do not implement Slice 13 from this document.**  
**Do not invent a final Slice 13 scope.**  
**Do not reopen certified Slice 1–12 decisions.**  
**Do not assume every UX item becomes Slice 13.**  
**Next gate after this audit: PRODUCT DECISION (separate prompt).**

---

## 1. Audit Status

Audit-only.

| Metric | Status |
|--------|--------|
| Slice 13 readiness audit (ownership) | **COMPLETE** |
| Counsellor UX / workflow continuity reconciliation | **COMPLETE** |
| Product Decision | **NOT STARTED** |
| Implementation | **NOT STARTED** |
| Manual UAT | **NOT STARTED** |
| Acceptance | **NOT STARTED** |
| Production code changed by this task | **NO** |
| Tests changed by this task | **NO** |

### Gate decision

> **READY FOR PRODUCT DECISION**

Repository evidence after Slice 12 is sufficient to confirm the certified ownership baseline, enumerate remaining ownership/work-allocation gaps, reconcile prior Counsellor UX/workflow redesign work against that baseline, and present **candidate** future workstreams. Remaining ambiguity is **product/policy selection among evidence-backed candidates**, not missing discovery of core ownership mechanics.

This document is **not** “READY FOR IMPLEMENTATION.”  
This document does **not** select a final Slice 13 scope.  
This document does **not** convert historical UX ideas into accepted product decisions without repository evidence.

---

## 2. Prior Slice Status

Phase 3I’s original implementation roadmap (`docs/audits/counsellor-ownership-work-allocation-phase3i-implementation-readiness-audit.md`) defined Slices **1 → 12** and **did not title a Slice 13**. Slice 13 exists in delivery docs only as a **next-gate placeholder** after Slice 12 acceptance.

| Slice | Working title (roadmap / delivery) | Status |
|-------|--------------------------------------|--------|
| 1 | Server authorization foundation + Waiting List PD16 | **Certified / complete** |
| 2 | Admin create unassigned + remove silent start stamp | **Certified / complete** |
| 3 | Explicit Assignment (initial) | **Certified / complete** |
| 4 | Owner authorization (mutate ACL) | **Certified / complete** |
| 5 | History + Audit for ownership | **Certified / complete** |
| 6 | Reassignment (Supervisor/Admin) | **Certified / complete** |
| 7 | Concurrency (Version + 409) | **Certified / complete** |
| 8 | ReQueue clears ownership | **Certified / complete** |
| 9 | Finalize / Post-Surgery **boundaries** (assignment deferred) | **Implemented / accepted for boundary honesty** |
| 10 | Follow-up Center honesty | **Accepted / certified** |
| 11 | Analytics / My Work boundary | **ACCEPTED** (`phase3i-slice11-implementation-report.md`) |
| 12 | Leave / Reassignment Required | **COMPLETE / DELIVERY ACCEPTED** |

### Slice 12 confirmation

Authoritative acceptance: `docs/audits/phase3i-slice12-acceptance.md`

| Gate | Status |
|------|--------|
| Audit | ✅ COMPLETE |
| Product Decision (PD-S12-01…19) | ✅ ACCEPTED |
| Implementation | ✅ COMPLETE |
| Automated tests | ✅ PASS |
| Manual UAT | ✅ PASS (2026-09-21) |
| Delivery Acceptance | ✅ **ACCEPTED** |
| Slice 13 | ❌ **NOT STARTED** |

Slice 12 explicitly states: **“No Slice 13 implementation is authorized by this document.”**

This audit does **not** reopen Slice 12 delivery.

---

## 3. Certified Constraints

Slice 13 (whatever Product later selects) **must preserve** unless a later **approved** Product Decision explicitly supersedes:

| Constraint | Source |
|------------|--------|
| Ownership SoT = `CounselingSession.CounselorId` | Hybrid E / Phase 3H PD7; Slices 2–12 |
| `CreatedByUserId` is **not** ownership | Certified |
| Hybrid E: shared operational queues + explicit ownership for active counselling | PD7 |
| Waiting List shared; NULL owner valid | PD-WL-01 / PD-WL-02 |
| Opening / viewing / starting does **not** establish ownership | PD-START-01 / Slices 2–4 |
| Ownership established through explicit Assign / Claim-for-lifecycle / Reassign | Slices 3 / 6 |
| ReQueue → `CounselorId = NULL` | Slice 8 / PD-REQUEUE-01 |
| Version / CAS authoritative for ownership mutations | Slice 7 |
| Ownership history authoritative (audit trail) | Slice 5 |
| PD16 server-side branch authorization | PD16 |
| Analytics My Work = reporting attribution **only** (not operational worklist) | Slice 11 |
| Follow-up Center shared; no My Follow-ups | Slice 10 / PD-FOLLOWUP-01 |
| Finalize Surgery shared; not counsellor ownership SoT | Slice 9 / PD-FS-01 |
| Reassignment Required = **operational condition**, not a new counselling lifecycle `Status` | Slice 12 / PD-LEAVE-01 refined |
| No automatic ownership takeover | Slice 12 PD-S12-10 |
| No automatic `CounselorId` clearing due to unavailability | Slice 12 |
| No automatic ReQueue on leave / deactivate | Slice 12 |
| No new Supervisor role | PD-SUP-01 |
| No new ownership entity / table as default | Phase 3H / Slice 12 |
| No cross-branch authorization bypass | PD-S12-16 |
| No duplicate operational worklist for leave remediation | PD-S12-14 |

---

## 4. Repository Baseline

### 4.1 Slice 12 production artifacts (verified present)

| Area | Evidence |
|------|----------|
| Availability helpers | `microservices/auth-service/AuthService/Services/CounsellorOwnershipAvailability.cs` — open statuses `Scheduled` \| `InProgress`; unavailable `UserStatus` `inactive` \| `suspended` |
| RR list predicate | `CounselingWorkflowService.ApplyReassignmentRequiredFilter` — non-null `CounselorId`, open status, owner missing / soft-deleted / inactive|suspended / not counsellor-eligible / unauthorized for session branch |
| Target gate | `EvaluateOwnershipTargetAvailabilityAsync` on **Assign** and **Reassign** |
| Filter model | `SessionFilters.ReassignmentRequired` in `CounselingWorkflowModels.cs` |
| Picker | `CounselingController.GetCounselors` excludes inactive/suspended (+ soft-delete) |
| FE Sessions filter | `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/sessions/page.tsx` + `lib/counsellors-desk/reassignment-required-filter.ts` + `lib/api/counseling-sessions.api.ts` |
| Tests | `AuthService.Tests/Phase3ISlice12ReassignmentRequiredTests.cs`; `reassignment-required-filter.test.ts` |

### 4.2 Confirmed non-behaviors (Slice 12 / certified)

| Behavior | Current repository |
|----------|-------------------|
| Deactivate clears `CounselorId` | **No** — `UsersController.Deactivate` sets `UserStatus = "inactive"` only |
| Automatic Reassign / ReQueue on unavailability | **No** |
| CreatedBy ownership fallback | **No** |
| Admin deactivate warn / owned-session drill | **Not implemented** (optional in PD-S12-14/15; explicitly out of Slice 12 minimal delivery) |
| New Supervisor role / permission / ownership entity | **Not introduced** |
| JWT revoke on deactivate | **Not implemented** (PD-S12-19 out of scope) |

### 4.3 Pre-existing unrelated working tree

At audit start, the git working tree already contained numerous unrelated modified files (Azurite, AuthService.Tests binaries/sources, etc.). **This audit task must not modify them.** Only this readiness document is authorized.

---

## 5. Ownership Model

| Stage | Behavior (post–Slice 12) |
|-------|--------------------------|
| Create | Counsellor create → `CounselorId = actor`; Admin/non-counsellor → NULL; `CreatedByUserId = actor` (audit only) |
| Assign | NULL → target; `.update`; PD16; Version CAS; target availability gate (Slice 12) |
| Reassign | A → B; `.reassign`; reason; Version CAS; target availability gate (Slice 12) |
| Claim-for-lifecycle | Actor self-claim for ReEvaluate/StartRepeat; Version CAS; **does not** call `EvaluateOwnershipTargetAvailabilityAsync` |
| ReQueue | `CounselorId → NULL`; `OwnershipRequeued` if previously owned |
| Content mutate | `DenyUnlessSessionOwner` on `CounselorId` |
| Complete | Status → Completed; **stamp retained** (historical) |
| Leave / unavailable | Stamp retained; open owned sessions detectable via `reassignmentRequired=true` |

---

## 6. Operational Workflow

```text
Waiting List (shared)
  → Assign / Claim-for-lifecycle (explicit ownership)
  → Counselling Session (owned mutate: Quote / Decision / Insurance / Notes)
  → Finish / Complete (stamp retained)
  → Downstream: Finalize Surgery (shared) / Follow-up Active|Cold (shared + historical Original Counsellor) / Post-Surgery (shared, no counsellor owner stamp) / Analytics (reporting)
```

| Workflow segment | Ownership |
|------------------|-----------|
| Waiting List visibility | Shared |
| Active counselling content | Explicit `CounselorId` |
| Quote / Decision / Insurance / Notes | Session-owned (no separate ownership entity) |
| Finish / Complete | Historical stamp retained |
| Finalize Surgery | Shared; not counsellor ownership SoT |
| Follow-up Active / Cold | Shared list ACL; Original Counsellor historical |
| Post-Surgery | Shared; **no** `CounselorId` on projection; **explicit assign deferred** (PD-POST-01 / D6) |
| Analytics My Work | Reporting attribution only |

---

## 7. User Lifecycle

| Event | Effect on `CounselorId` | Detection / remediation today |
|-------|-------------------------|-------------------------------|
| Activate / login | N/A | Login blocked if inactive/suspended |
| Deactivate | **Unchanged** | RR filter after the fact |
| Soft-delete | **Unchanged** stamp | RR soft-delete / missing-owner path |
| Role eligibility loss | **Unchanged** stamp | RR `ownerNotEligible` |
| Branch access loss | **Unchanged** stamp | RR `ownerUnauthorizedForBranch` |
| Temporary leave **without** IAM signal | **No signal** | **Out of Slice 12 auto-detection** (PD-S12-01) |
| Reassign / ReQueue | Explicit mutation | Existing APIs + history + CAS |

Slice 12 behavior remains **coherent** with certified “no auto mutation; human remediation” policy. Residual gaps are **ops discoverability / remediability UX**, **deferred Post-Surgery ownership**, and **intentionally excluded** HR/JWT topics — not a collapse of the ownership SoT.

---

## 8. Existing Operational Surfaces

| Surface | Route / API | Ownership / work-allocation responsibility |
|---------|-------------|--------------------------------------------|
| **Waiting List** | `/dashboard/counsellors-desk/waiting-list`; `GET …/waiting-list` | Shared queue; Assign / Reassign / claim CTAs; client “My Sessions” filter is convenience only |
| **Counselling Sessions** | `/dashboard/counsellors-desk/sessions`; `GET …/sessions` | List + Slice 12 **Reassignment Required** filter (authoritative **discovery** surface per PD-S12-14); row action **Open** only |
| **Follow-up Center** | `/dashboard/counsellors-desk/surgery-followup` | Shared Active/Cold/Post-Surgery; ReQueue on Active/Cold; no Assign/Reassign; Original Counsellor historical |
| **Analytics** | `/dashboard/counselor/analytics` | My Work / Branch reporting scope; **not** an operational remediation worklist |

**Duplicate worklist check:** No candidate in this audit requires creating a fifth operational queue. Remaining needs map to extending **existing** surfaces (Sessions remediation actions, Admin handoff into Sessions, Wait List Reassign reuse, or a **future product decision** on Post-Surgery assignment SoT — still without inventing a parallel leave queue).

**Nav evidence:** Counsellor sidebar (`sidebar-menu-sections.tsx`) lists Waiting List, Finalize Surgery, Follow-up Center, Analytics — **no** Counselling Sessions / Reassignment Required entry. Sessions is reachable by direct URL / Analytics drilldown (drilldown does **not** set `reassignmentRequired`).

---

## 9. Remaining Ownership / Work-Allocation Findings

Classification key: **A** Already certified/implemented · **B** Intentionally out of scope · **C** Known unresolved product decision · **D** Technical defect / regression candidate · **E** Genuine future ownership/work-allocation gap · **F** Not enough evidence

| # | Finding | Class | Evidence | Notes |
|---|---------|-------|----------|-------|
| F1 | RR detection + inactive target protection shipped | **A** | `CounsellorOwnershipAvailability`, `ApplyReassignmentRequiredFilter`, Assign/Reassign gates, GetCounselors, Slice 12 tests/acceptance | Do not reopen |
| F2 | No auto `CounselorId` clear on deactivate | **A** | `UsersController.Deactivate`; Slice 12 tests/UAT | Certified |
| F3 | Temporary leave without system signal | **B** | PD-S12-01 | Do not invent HR leave integration in a slice without PD |
| F4 | JWT/session invalidation on deactivate | **B** | PD-S12-19 | Separate security decision |
| F5 | Auto-transfer / auto-ReQueue / new Supervisor / new entity / cross-branch exception | **B** | PD-S12-10/16; PD-SUP-01 | Rejected |
| F6 | Sessions RR is discovery-only; no Reassign/ReQueue CTA on Sessions or `[id]` session page | **E** (+ **D** risk vs PD-S12-14 wording) | `sessions/page.tsx` Open only; Reassign only on Waiting List; ReQueue only on Follow-up; `[id]`/session controller have no remedi ate CTAs | PD-S12-14 calls Sessions the authoritative remediation surface; implementation report text “open → existing Reassign UI” is **not** true on the Open path. Common cases still remediable on Waiting List when queue projects Pending/Processed |
| F7 | RR population vs Waiting List Reassign eligibility mismatch | **E** | RR uses session `Status` Scheduled\|InProgress; WL Reassign FE requires Pending\|Processed (`counselling-auth.ts`); WL is queue-backed | RR rows without Waiting/Called/InProgress queue may lack FE Reassign path despite backend Reassign allowing InProgress-session cases |
| F8 | Counselling Sessions / RR not in Counsellor sidebar | **E** | `sidebar-menu-sections.tsx` | Discoverability of the authoritative RR surface |
| F9 | Admin deactivate has no owned-session warn/drill to Sessions RR | **E** (optional in Slice 12 PD) | `admin/users/page.tsx` generic confirm; PD-S12-14 “may warn/drill” | Not a second worklist if implemented as handoff |
| F10 | Post-Surgery explicit assignment (PD-POST-01 / D6) still unimplemented | **C** / **E** | Phase 3H PD-POST-01; Slice 9 PD-S9-05/25 deferred; Follow-up Post-Surgery DTO has no counselor fields | Largest deferred **ownership** item from Phase 3H not closed by Slices 1–12 |
| F11 | Legacy Admin-stamped ownership rows remediation / migration | **C** | Phase 3H § remaining unresolved; DATA MIGRATION REQUIRED if later approved | Do not silent-backfill |
| F12 | Claim-for-lifecycle does not reuse target-availability helper | **D** / **F** | `ClaimSessionForLifecycleAsync` — DeletedAt + eligibility; no inactive `UserStatus` gate | Login blocks inactive; residual risk mainly with unrevoked JWT (tied to F4/B) |
| F13 | Follow-up Active/Cold “Original Counsellor” after leave / complete | **B** / **C** | Slice 10 PD-S10-06 open historically; Slice 12 PD-S12-07/18 preserve Follow-up shared + historical | Not reopen as My Follow-ups |
| F14 | Bulk reassignment API | **F** / **C** | No bulk API found; Slice 12 readiness noted only if product requires | Needs product need evidence |
| F15 | Workload / coverage dashboard | **F** | No counselling workload SoT; Reassign reason strings only | Insufficient product evidence |
| F16 | EF `counselor_id` index on `counseling_sessions` | **F** / performance note | EF snapshot lacks index; legacy SQL script may differ; live DB not probed | Scale consideration — not ownership policy |
| F17 | Formal Phase 3H named hospital sign-off still empty | **C** | Phase 3H sign-off table | Governance, not Slice 13 code scope by default |
| F18 | UAT-adjacent non-ownership items (All-Branches WL, OT config, concurrent OT episode) | **B** relative to ownership slice | `phase3i-uat-decision-gate.md` | Do not absorb into ownership Slice 13 by default |

---

## 10. Candidate Future Gaps

Only **genuine** future ownership/work-allocation candidates (**E**, plus **C** items that are ownership-shaped). **No ranking. No selected Slice 13.**

---

### Candidate

**Reassignment Required remediability & discoverability (Sessions surface completeness)**

### Current behavior

Sessions `reassignmentRequired=true` lists open owned sessions with unavailable owners and offers **Open** only. Reassign UI lives on Waiting List (Pending/Processed). ReQueue UI lives on Follow-up Active/Cold. Counsellor nav does not link Sessions/RR.

### Evidence

- `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/sessions/page.tsx`
- `WaitingListReassignDialog.tsx` / `waiting-list/page.tsx` / `counselling-auth.ts` (`isWaitingListEligibleForReassign`)
- `surgery-followup/page.tsx` (ReQueue)
- `sidebar-menu-sections.tsx`
- PD-S12-14; `phase3i-slice12-implementation-report.md` §5 remediation claim vs code

### Ownership impact

Does not change SoT; concerns **human remediation path** after Slice 12 detection. Risk of RR items that cannot be remedi ated from the authoritative surface / lack WL overlap.

### Operational impact

Supervisors/Admins with `.reassign` may discover work on Sessions but must navigate elsewhere (or fail to find a Reassign CTA) to transfer ownership.

### Existing mechanisms

Reuse Assign/Reassign/ReQueue APIs, Version/CAS, history, Sessions filter — **no new queue**.

### Business-rule dependency

**Yes** — Product must decide whether Sessions must host remedi ate CTAs, nav entry, and/or deeper WL linkage; whether F7 mismatch is in-scope.

### Risk

Medium — can look like reopening Slice 12 UX; must not create a second leave worklist or change certified detection predicates without PD.

### Suggested audit conclusion

**READY FOR PRODUCT DECISION**

---

### Candidate

**Admin Users ↔ Reassignment Required handoff**

### Current behavior

Deactivate is unconditional (status only). Admin UI confirms deactivate with no owned open-session count and no drill to Sessions RR.

### Evidence

- `UsersController.Deactivate`
- `apps/hospital-portal-web/src/app/dashboard/admin/users/page.tsx`
- PD-S12-14/15 optional warn/drill; Slice 12 implementation report §3/§15

### Ownership impact

None on SoT if limited to warn/deep-link; must not become a second authoritative worklist or hard-block without PD (Option A was rejected for Slice 12).

### Operational impact

IAM operators may deactivate without knowing open counselling ownership remains.

### Existing mechanisms

Query by `CounselorId` + open statuses / existing RR filter URL.

### Business-rule dependency

**Yes** — optional vs required warn/drill; still Option B (allow then remediate).

### Risk

Low–medium if scoped as Admin UX handoff only; high if hard-block reintroduced without PD.

### Suggested audit conclusion

**READY FOR PRODUCT DECISION**

---

### Candidate

**Post-Surgery explicit ownership assignment (PD-POST-01 / D6)**

### Current behavior

Post-Surgery Follow-up is a shared `patient_journey` projection **without** counsellor owner fields. Slice 9 intentionally did **not** implement assignment. Phase 3H PD-POST-01 still calls for shared queue + **explicit** Post-Surgery assignment, distinct from counselling `CounselorId`.

### Evidence

- Phase 3H `PD-POST-01`
- `docs/audits/counsellor-ownership-work-allocation-phase3i-slice9-implementation-report.md` (PD-S9-05 / PD-S9-25 deferred; D6 unresolved)
- Follow-up Post-Surgery types / tests (no `counselorId`)

### Ownership impact

Downstream ownership boundary still **intentionally excluded** from counselling SoT; separate assign SoT unresolved (D6).

### Operational impact

Post-Surgery work remains shared without named Post-Surgery owner assignment as agreed in Phase 3H.

### Existing mechanisms

Follow-up Center surface; counselling Assign/Reassign patterns as **reference only** — persistence SoT for Post-Surgery ownership is the open D6 question.

### Business-rule dependency

**Yes** — D6 SoT (where assignment lives); must not invent FollowUps table without PD; must not auto-inherit counselling owner.

### Risk

High architectural / cross-module if SoT chosen poorly; must preserve PD-FOLLOWUP-01 shared list semantics.

### Suggested audit conclusion

**READY FOR PRODUCT DECISION** (may require additional SoT audit focused on D6 before implementation)

---

### Candidate

**Legacy Admin-stamped counselling ownership remediation / migration policy**

### Current behavior

Historical Admin-owned / Downtown legacy stamps remain as data; Phase 3H forbids silent backfill; operational clear/reassign may later need explicit migration decision.

### Evidence

- Phase 3H remaining unresolved / DATA MIGRATION REQUIRED language
- PD-ADM-01 / PD-WL-02 (no backfill)

### Ownership impact

Data hygiene for `CounselorId` stamps that predate Hybrid E / Admin-unassigned create.

### Operational impact

Ops may still see non-counsellor or legacy owners on rows until explicit remediation.

### Existing mechanisms

Existing Reassign / ReQueue / RR detection (if owner unavailable/not eligible).

### Business-rule dependency

**Yes** — migration vs ops-only remedi ate; no silent backfill.

### Risk

High if migration is silent or broad; medium if ops-only using existing Reassign.

### Suggested audit conclusion

**READY FOR PRODUCT DECISION** / possibly **NOT READY — additional audit required** (data inventory)

---

## 11. Existing Certified / Out-of-Scope Areas

**Do not reopen as Slice 13 redesign:**

| Area | Reason |
|------|--------|
| Slice 6 Assign/Reassign ownership model | Certified |
| Slice 7 Version/CAS | Certified |
| Slice 8 ReQueue → NULL | Certified |
| Slice 9 Finalize / Post-Surgery **boundary honesty** | Certified; only **deferred assignment** remains as candidate |
| Slice 10 Follow-up shared model / no My Follow-ups | Certified |
| Slice 11 Analytics My Work boundary | Certified |
| Slice 12 Reassignment Required detection + inactive targets + no auto mutation | Certified / Delivery Accepted |
| PD16 branch authorization | Certified |
| Hybrid E ownership model | Certified |
| HR leave integration / new availability state | Out of scope unless new PD |
| JWT redesign | Out of scope unless new PD |
| New Supervisor role / new ownership entity / duplicate leave queue | Forbidden by certified constraints |
| Turning Analytics or Waiting List into leave worklists | Forbidden |
| UAT OT configuration / All-Branches WL / concurrent OT episode | Adjacent non-ownership (unless Product explicitly expands) |

If issues appear inside certified areas, treat as **Existing certified behavior / regression candidate (D)**, not automatic Slice 13 scope.

---

## 12. Permission / ACL Findings

| Finding | Status |
|---------|--------|
| Supervisory remedi ate via `counseling_sessions.reassign` | Exists (Slice 6); PD-SUP-01 |
| Assign via `counseling_sessions.update` | Exists |
| Owner content ACL via `CounselorId` | Exists |
| PD16 on list / Assign / Reassign / ReQueue / Claim | Exists |
| New permission required for residual candidates? | **Not evidenced as mandatory** — remediability/Admin handoff can reuse existing codes |
| New role required? | **No** evidence; PD forbids new Supervisor role |
| Post-Surgery assign | **Product Decision Required** if a distinct permission is needed (unknown until D6) |
| Cross-branch exception | **Not** proposed |

Any new permission/role/ACL change for a future slice must be recorded as **PRODUCT DECISION REQUIRED**, not implemented from this audit.

---

## 13. Data Model Findings

| Need | Representable with existing model? |
|------|--------------------------------------|
| Open unavailable-owner detection | **Yes** — query-time condition on `CounselingSession` + `User` (+ branches) |
| Ownership transfer / release | **Yes** — Reassign / ReQueue + history + Version |
| Admin handoff | **Yes** — no schema required for warn/deep-link |
| Sessions remedi ate CTAs | **Yes** — FE reuse of existing APIs |
| Post-Surgery explicit owner | **Unresolved SoT (D6)** — may need product choice before any schema; **do not** assume new ownership table |
| Temporary leave without IAM signal | **Cannot** detect without new signal — PD said out of scope |

**PRODUCT DECISION REQUIRED** before proposing new ownership tables/entities/lifecycle statuses. Current evidence does **not** mandate them for residual counselling leave remediability.

---

## 14. Performance Findings

| Topic | Evidence | Class |
|-------|----------|-------|
| RR filter joins Users / eligibility / branch pairs | `ApplyReassignmentRequiredFilter` | Correctness first; scale depends on tenant volume |
| Composite `(tenant_id, counselor_id)` / Analytics indexes | Slice 11 readiness noted gaps; EF snapshot lacks `CounselorId` index on `counseling_sessions`; legacy SQL may define `idx_counseling_sessions_counselor` | **F** — live DB not probed; do not add speculative indexes in a product slice without evidence |
| Pagination on Sessions list | Existing list patterns | Preserve |
| N+1 in RR path | Single composed query (join/let) | Acceptable pattern; monitor under load |

No performance defect is asserted as Slice 13 scope without measurement.

---

## 15. Security Findings

| Check | Result |
|-------|--------|
| Tenant boundaries on ownership mutations | Present |
| PD16 branch boundaries | Present; cross-branch still Forbidden |
| Assign/Reassign permissions | Present |
| Unavailable target protection | Present on Assign/Reassign (Slice 12) |
| GetCounselors inactive exclusion | Present |
| Client cannot bind `AccessibleBranchIds` | Preserved (Slice 12 report) |
| Claim actor inactive `UserStatus` | **Not** aligned with Assign/Reassign helper (**D/F**; mitigated by login gate) |
| Deactivate token revoke | Out of scope (**B**) |

No security change is authorized by this audit.

---

## 16. Test Coverage Findings

### Covered (representative)

| Area | Suite |
|------|-------|
| Slice 12 RR include/exclude, inactive targets, deactivate retain stamp | `Phase3ISlice12ReassignmentRequiredTests` |
| FE RR filter helpers | `reassignment-required-filter.test.ts` |
| Assign / Reassign / ReQueue / ACL / History / CAS / Finalize boundary / Analytics | Phase3I Slice 3–11 test suites |
| Follow-up shared / no Assign|Reassign | `surgery-followup/page.test.tsx`, `followup-presentation.test.ts` |

### Gaps / regression risks (audit only — do not add tests now)

| Gap | Notes |
|-----|-------|
| End-to-end remedi ate path from Sessions RR → Reassign CTA | Not covered as UI integration; UAT used existing Reassign dialog elsewhere |
| RR row without Pending/Processed WL projection | No automated mismatch test found |
| Admin deactivate → RR handoff | Not implemented; no tests expected |
| Claim + inactive actor | No Slice 12 alignment test |
| Post-Surgery assign | Intentionally absent |

---

## 17. Product Decisions Required

List only — **do not resolve** in this audit.

Ownership-shaped decisions (original readiness set):

1. **Whether Slice 13 (or another vehicle) must complete Sessions RR remediability** (CTAs on Sessions/`[id]`, nav discoverability, and/or explicit WL linkage) vs accepting multi-surface workaround.  
2. **Whether Admin deactivate warn/drill to Sessions RR is now required** (still not a second worklist).  
3. **Whether Post-Surgery explicit assignment (PD-POST-01) is the next ownership slice**, including **D6 persistence SoT**.  
4. **Whether legacy Admin-stamped row remediation** is ops-only vs DATA MIGRATION (no silent backfill).  
5. **Whether Claim-for-lifecycle must align with PD-S12-17 availability** (defect fix vs separate PD).  
6. **Whether bulk remedi ate** is required for leave events (evidence currently weak).  
7. **Whether temporary leave without IAM signal** remains permanently out of counselling ownership scope.  
8. **Whether JWT revoke on deactivate** remains a separate security track.

UX continuity expands and classifies these further in **Section 33** (A certified / B deferred / C new UX / D business-behavior). Do not treat Section 33 as answering the questions.

---

## 18. Candidate Slice 13 Scope

Evidence supports **multiple** candidate areas (Section 10). The original Phase 3I roadmap **ended at Slice 12** and did **not** pre-title Slice 13.

**Neutral statement:** Slice 13 Product Decision should choose among evidence-backed residual ownership/work-allocation gaps — most materially: (a) RR remediability/discoverability on existing Sessions surface, (b) Admin→RR handoff, (c) Post-Surgery explicit assignment SoT (PD-POST-01/D6), (d) legacy stamp remediation policy — **without** selecting one in this audit.

**Do not implement.**

---

## 19. Acceptance Criteria Candidates

*Audit-level candidates only — not implementation requirements.*

| Candidate criterion | Depends on Product Decision |
|---------------------|-----------------------------|
| Preserve CounselorId SoT, CAS, history, PD16, Hybrid E | Always |
| Preserve no auto ownership mutation on leave/deactivate | Always |
| Preserve Analytics / WL / Follow-up shared boundaries | Always |
| If remediability selected: RR items remediable via existing Reassign (and permitted ReQueue) without a new queue | PD on Sessions CTAs / path |
| If Admin handoff selected: deactivate operators can discover open owned sessions via Sessions RR without second worklist | PD on warn/drill |
| If Post-Surgery selected: explicit assign semantics without auto-inherit counselling owner; D6 SoT decided | PD-POST-01 / D6 |
| If legacy remediation selected: no silent backfill; history preserved | Phase 3H migration PD |
| Automated + Manual UAT gates for the chosen scope only | After implementation prompt |

---

## 20. Out of Scope

This audit explicitly excludes:

- Implementation  
- Product Decision acceptance  
- UI / API / DB / migration / permission / role changes  
- New ownership entities  
- New counselling lifecycle statuses  
- New Supervisor role  
- HR leave integration  
- JWT/session invalidation redesign  
- Duplicate operational worklists  
- Slice 14+  
- Reopening certified Slices 1–12 as redesign  
- Creating a Product Decision Record in this task  
- Creating an implementation prompt in this task  

---

## 21. Final Gate

```text
AUDIT (ownership)                 ✅ COMPLETE / READY FOR PRODUCT DECISION
UX CONTINUITY RECONCILIATION      ✅ COMPLETE (see Sections 22–35)

PRODUCT DECISION                  ❌ NOT STARTED

IMPLEMENTATION                    ❌ NOT STARTED

AUTOMATED TESTS                   ❌ NOT STARTED

MANUAL UAT                        ❌ NOT STARTED

DELIVERY ACCEPTANCE               ❌ NOT STARTED

SLICE 13 IMPLEMENTATION           ❌ NOT STARTED
```

### Next gate (mandatory)

```text
AUDIT + UX CONTINUITY RECONCILIATION COMPLETE ✅
→ PRODUCT DECISION  (separate explicit prompt / record)
→ IMPLEMENTATION    (only after Product Decision accepted + separate implementation prompt)
```

**Do not start Slice 13 implementation from this audit alone.**

---

# Counsellor UX / Workflow Continuity Reconciliation

**Mode:** AUDIT / RECONCILIATION ONLY  
**Date:** 2026-09-21  
**Rule:** Extend this readiness audit; do **not** silently replace Sections 1–21.  
**Rule:** Do **not** implement. Do **not** resolve product decisions. Do **not** reopen certified ownership.

---

## 22. Reconciliation purpose

Answer:

> After the certified Phase 3I ownership work, what previously planned Counsellor UX/workflow redesign work is still pending, partially implemented, already certified, or requires a Product Decision?

Traceability only. Not every UX idea becomes Slice 13. Slice 13 need not contain all UX work.

### Historical reference rule

Where a prior UX idea is mentioned only in project context / archive marketing-style docs / mock-era guides, and live repository evidence does not support it as an accepted decision:

> **Historical reference mentioned in project context; repository evidence not located.**

That status is **not** an accepted product decision.

---

## 23. UX classification model

| Code | Meaning |
|------|---------|
| **A** | Already implemented / accepted (or delivery-accepted ownership UX) |
| **B** | Certified behavior; UX pending / incomplete presentation |
| **C** | Product decision required |
| **D** | Technical defect / regression candidate |
| **E** | Genuine future UX/workflow gap (evidence-backed) |
| **F** | Historical reference only / insufficient repository evidence |

---

## 24. Certified ownership baseline (do not reopen)

Explicitly **certified / preserved** — UX redesign must not accidentally reverse:

| Constraint | Status |
|------------|--------|
| Hybrid E (shared queues + explicit ownership for active counselling) | Certified |
| Ownership SoT = `CounselingSession.CounselorId` | Certified |
| `CreatedByUserId` ≠ ownership | Certified |
| Shared Waiting List; NULL owner valid | Certified |
| Opening / viewing ≠ ownership | Certified |
| Explicit Assign / Claim-for-lifecycle / Reassign | Certified |
| ReQueue → `CounselorId = NULL` | Certified |
| Version / CAS authoritative | Certified |
| Ownership history authoritative | Certified |
| PD16 server-side branch authorization | Certified |
| Follow-up Center shared; no My Follow-ups | Certified |
| Analytics My Work = reporting only (≠ operational worklist) | Certified |
| Finalize Surgery shared; not counsellor ownership SoT | Certified |
| Reassignment Required = operational condition (not lifecycle Status) | Certified |
| No automatic ownership takeover / auto clear / auto ReQueue on leave | Certified |
| No new Supervisor role / no new ownership entity / no cross-branch bypass | Certified |
| No duplicate leave-remediation queue | Certified |

---

## 25. Source material inspected (UX continuity)

### Phase 3I ownership + UX-adjacent audits / reports

| Artifact | Role |
|----------|------|
| This document Sections 1–21 | Ownership residual findings F1–F18 |
| `…-lifecycle-entry-ux.md` | Waiting List owner-aware CTA matrix — **IMPLEMENTED** |
| `…-lifecycle-ownership-claim.md` | Claim-for-lifecycle + Attention column removal intent — **IMPLEMENTED** |
| `…-lifecycle-action-ownership-stop.md` | Historical STOP before claim API existed |
| `…-slice3-final-ux-lifecycle-audit.md` | Row-click Assign + lifecycle matrix audit |
| `…-session-ux-correction.md` | Clinical Recommendations / Patient Details / Notes spacing — **IMPLEMENTED** |
| `…-workflow-corrections.md` | Add-Patient ownership + Finish grey-gate fix — **IMPLEMENTED** |
| `counsellor-session-requeue-notes-to-history-ux-report.md` | ReQueue out of Notes → History — **READY FOR MANUAL UAT / Not Accepted** |
| Phase 3H / 3I Slice 1–12 readiness, PD, implementation, acceptance docs | Certified ownership SoT |
| Phase 2V–2Z Follow-up / Analytics audits + Phase 2W PDs | Downstream Follow-up/Analytics product context |

### Live FE evidence

| Area | Evidence |
|------|----------|
| Nav / landing | `sidebar-menu-sections.tsx`; `DashboardRouter.tsx` → Waiting List; `/dashboard/counselor` redirect |
| Waiting List | `waiting-list/page.tsx`, `WaitingListWorkRow.tsx`, `waiting-list-lifecycle-action.ts`, Assign/Reassign dialogs, `WaitingListSummaryWidget.tsx` |
| Sessions / RR | `sessions/page.tsx`, `reassignment-required-filter.ts` |
| Session workspace | `[id]/page.tsx`, `SessionPageHeader.tsx`, journey rail / Quote / Decision / Notes tokens & Wave 2 e2e |
| History | `SessionHistoryModal.tsx`, `load-counselling-session-history.ts` |
| Clinical Recommendations | `ClinicalRecommendationsSheet.tsx`, `clinical-recommendations-placeholder.ts` |
| Follow-up / Finalize / Analytics | `surgery-followup/page.tsx`, `finalize-surgery/page.tsx`, `counselor/analytics/page.tsx` |

### Wave 2 session UX (code + e2e; thin formal docs/)

Playwright UAT harnesses under `apps/hospital-portal-web/e2e/counselling-wave2*.spec.ts` (2C, 2D-2…2D-5, 2E-1…2E-5 / 2E-2R / 2E-4R) plus token comments in `counselling-session-tokens.ts`. **No** dedicated Wave 2 plan/acceptance pack located under `docs/audits/`.

### Historical / archive (not accepted Product Decisions)

| Artifact | Classification |
|----------|----------------|
| `archive/docs/counselor-history/COUNSELOR_PERSONALIZED_UX_COMPLETE.md` | Historical “My Assigned Patients” / mock stats dashboard — **conflicts** with certified shared Waiting List (PD-WL-01). **F** |
| `archive/sql/.../seed_counsellor_desk_redesign.sql` | Lab catalog seed — not Waiting List UX redesign. **F** |
| `apps/hospital-portal-web/docs/counselling-counsellor-guide.md` | Older 3-phase guide; partially superseded by Wave 2 journey staging. **F** as redesign SoT |

---

## 26. Counsellor UX / Workflow Continuity Matrix

| # | Area | Historical requirement | Current implementation | Certified backend dependency | UX gap | Product decision required | Candidate future scope | Class | Evidence |
|---|------|------------------------|------------------------|------------------------------|--------|---------------------------|------------------------|-------|----------|
| 1 | Counsellor Dashboard | Operational home with work/waiting/ownership/next-action hierarchy (prompt-level) | **No** dedicated Counsellor Dashboard route; role lands on Waiting List; `WaitingListSummaryWidget` only | Hybrid E; Analytics boundary (Slice 11) | No evidence-backed dashboard redesign SoT | Yes — only if Product wants a dashboard beyond WL landing | Workstream A / F15 | **F** (+ partial summary widget **A**) | F15; `DashboardRouter`; no `/counsellors-desk` home page |
| 2 | Waiting List | Shared queue + explicit Assign; lifecycle CTAs; reduced clutter | Shared WL live; owner filter convenience; lifecycle CTAs; Assign/Reassign dialogs; Attention **column** removed (inline Pre-Auth attention labels remain) | PD-WL-01/02; PD-START-01; Slices 1–4 / 6 / 8 / PD16 | Broad visual redesign plan not evidenced; Re-eval Auth sync deferred | Only if Product expands beyond certified CTA matrix | Workstream A | **A** (lifecycle/ownership) / **E** (visual polish) / **F** (full redesign plan) | `lifecycle-entry-ux.md`; `waiting-list-lifecycle-action.ts`; Slice docs “WL redesign out of scope” |
| 3 | Waiting List lifecycle actions | Assign / Open / View / Continue / Re-evaluate / Start Repeat / Pre-Auth by state+owner | Implemented via `resolveWaitingListLifecycleAction` + claim confirm (“Continue as me”) | Claim-for-lifecycle; Assign; PD-START-01 | Deferred Re-evaluate Auth dual-store sync | Re-eval Auth sync if Product requires mandatory Auth reopen | Workstream A | **A** / deferred sync **C** or **E** | `lifecycle-entry-ux.md`; `lifecycle-ownership-claim.md` |
| 4 | Counselling Sessions | List / analytics drilldown; RR discovery | Sessions list + RR filter; **Open-only** row CTA | Slice 12 RR filter; PD-S12-14 | Remediation CTAs absent; nav discoverability | Yes — Sessions CTA host / nav (see F6/F8) | Workstream C / D | **B** / **E** / **D**-risk | `sessions/page.tsx`; F6–F8 |
| 5 | Reassignment Required | Authoritative discovery (+ remediation intent in PD-S12-14 wording) | Filter + Open; remediations elsewhere (WL Reassign / Follow-up ReQueue) | Slice 12 detection; PD-S12-14 | Discoverability + remediability mismatch | Yes — where remediation is hosted | Workstream C | **B** / **E** / **D**-risk | F6–F8; Slice 12 acceptance |
| 6 | Session detail / workspace | Quote→Decision→Insurance→Notes→Finish; ownership-aware read-only | Wave 2 shell/journey; non-owner mutation lock; no Assign/Reassign/ReQueue on `[id]` | Slices 4 / 7; PD-START-01 | RR remediation from detail; residual polish | Sessions detail remediation CTAs | Workstream B / C | **A** (Wave 2 + ownership lock) / **E** (RR CTAs) | Wave 2 e2e; `SessionPageHeader`; F6 |
| 7 | Session navigation | Single primary journey rail | Wave 2E-2R journey stages quote/decision/insurance/notes/close | None beyond existing session tabs | Older 3-phase guide stale vs journey | No — unless Product changes IA | Workstream B | **A** / guide **F** | `counselling-wave2e2r-uat.spec.ts`; counsellor guide |
| 8 | Quote | Density / estimate / documents | Wave 2C / 2E quote workspace shipped | Owner mutate ACL | Formal Wave acceptance pack in docs/ thin | No ownership PD | Workstream B | **A** / docs **F** | wave2c / tokens |
| 9 | Decision | Decision workspace redesign | Wave 2D-4 Decision UAT harness + UI | Owner mutate ACL | Same docs thinness | No ownership PD | Workstream B | **A** / docs **F** | wave2d4 |
| 10 | Insurance | Flat insurance widgets in journey | Coverage / insurance stage in journey; CCMS visit policy flat pattern | Coverage / CCMS ownership separate | Remaining insurance polish not owned by Phase 3I | Out of ownership Slice 13 by default | Workstream B | **A** (partial) / **E** | Wave 2E-INS comments; journey rail |
| 11 | Notes | Documentation focus; ReQueue not in Notes | Wave 2E-5 Notes; ReQueue cards removed → History path | Slice 5 history; Slice 8 ReQueue | ReQueue→History UAT **not Accepted** | Confirm UAT acceptance of Notes/History split | Workstream B | **A** / UAT pending | `requeue-notes-to-history-ux-report.md` |
| 12 | Finish | Complete / terminal Finish honesty | Finish grey-gate removed; auto-open Finish for terminal | Complete retains stamp | — | No | Workstream B | **A** | `workflow-corrections.md` |
| 13 | Counsellor History | Ownership changes, actors, reasons readable | `SessionHistoryModal` ownership labels incl. Re-queued | Slice 5; Slice 8 OwnershipRequeued | Marker-fallback actor blank by design; UAT not Accepted for ReQueue presentation | Confirm History presentation acceptance | Workstream B | **A** / UAT pending | Slice 5; History modal; ReQueue UX report |
| 14 | Assign | Explicit Assign dialog; Assign to me / peer | Waiting List Assign dialog + states | Slices 3 / 7 / 12 target availability | Not on Sessions | Hosting Assign on Sessions = PD | Workstream A / C | **A** | `WaitingListAssignDialog.tsx` |
| 15 | Reassign | Supervisor/Admin transfer UX | Waiting List Reassign dialog only; FE Pending\|Processed | Slice 6 / 7 / 12 | Sessions RR lacks Reassign; F7 eligibility mismatch | Where Reassign may be hosted; F7 | Workstream C | **A** (WL) / **E** (Sessions) | `WaitingListReassignDialog.tsx`; F6/F7 |
| 16 | ReQueue | Clear ownership; reason in History | Follow-up Active/Cold ReQueue; History presentation | Slice 8 / 10 | Sessions RR lacks ReQueue CTA | Whether Sessions may ReQueue | Workstream C | **A** (Follow-up) / **E** (Sessions) | Follow-up page; F6 |
| 17 | Counsellor sidebar / IA | Discoverable counsellor surfaces | WL, Finalize, Follow-up, Analytics only — **no Sessions/RR** | None | RR discoverability | Yes — add Sessions/RR nav? | Workstream D | **E** / **C** | `sidebar-menu-sections.tsx`; F8 |
| 18 | Patient Header | Compact identity + contextual actions | `SessionPageHeader` identity + History / Clinical Recs / Patient Details | Opening ≠ ownership | — | No | Workstream E | **A** | `session-ux-correction.md`; header tests |
| 19 | Clinical Recommendations | Contextual Sheet; Doctor + Optometrist | Sheet implemented; Doctor from session; Optometrist **static placeholder** | Not clinical SoT | Optometrist source integration | Clinical SoT integration if Product wants real data | Workstream E | **A** (UX shell) / **E** (placeholder content) | `clinical-recommendations-placeholder.ts` |
| 20 | Patient Details | Contextual Sheet; no duplication noise | Session uses `PatientDemographicsSheet`; WL has `WaitingListPatientDetailSheet` | — | Two contextual sheets by surface (by design) | No ownership PD | Workstream E | **A** | session-ux-correction; WL sheet |
| 21 | Follow-up Center | Shared; Original Counsellor historical; ReQueue | Shared Active/Cold/Post-Surgery; ReQueue; no Assign/Reassign | Slice 10 | Phase 2W unsigned ops rules remain historically open | Do not reopen My Follow-ups | Workstream F (ops only if Product expands) | **A** (ownership honesty) / Phase 2W residual **C** | Slice 10; Phase 2W |
| 22 | Finalize Surgery | Shared finalize ops | Shared finalize page; not CounsellorId SoT | Slice 9 boundary | Non-ownership UX fixes already separate | No ownership PD | Out of ownership UX by default | **A** | Slice 9 |
| 23 | Post-Surgery | Shared + explicit assign deferred | Shared tab; no counselor owner fields | Slice 9; PD-POST-01 / D6 | Ownership SoT unresolved | **Yes** — D6 / PD-POST-01 | Workstream F | **C** / **E** | F10 |
| 24 | Analytics / My Work | Reporting attribution; drilldowns | My Work vs Branch scope; drills to Sessions (not RR) | Slice 11 | Must not become worklist | Preserve boundary | Out of operational UX | **A** | Slice 11 |
| 25 | End-to-end Counsellor workflow | Continuous journey Dashboard→…→Analytics | Landing = WL; session journey Wave 2; downstream shared | Hybrid E full matrix | Dashboard missing as formal stage; RR IA gap; Post-Surgery ownership | Multiple (see §31) | Multiple workstreams | Mix **A/B/C/E/F** | §29 end-to-end map |

---

## 27. Waiting List redesign — dedicated audit

### What was previously planned?

**Evidence-backed:**

1. **Ownership/lifecycle UX** — shared list; explicit Assign; owner-aware CTAs; Pending+NULL row-click opens Assign (not toast); Claim-for-lifecycle for Done/Repeat other-owner; Attention **column** removed so Action owns CTAs (`lifecycle-entry-ux.md`, `lifecycle-ownership-claim.md`, `slice3-final-ux-lifecycle-audit.md`).
2. **Certified rules** — PD-WL-01/02, PD-START-01, Hybrid E (Phase 3H).

**Not evidenced as an accepted redesign SoT:**

- A full visual Waiting List redesign brief (clutter system, status-copy reduction program, “primary lifecycle dashboard” charter) beyond ownership lifecycle UX.
- Multiple Phase 3I slice docs explicitly list **“Waiting List redesign / new CTA kinds”** as **out of scope**.

### What is currently implemented?

| Capability | State |
|------------|-------|
| Shared Waiting List | Live |
| Client Owner filter (All / My Sessions / Unassigned / Peers) | Convenience only — not visibility SoT |
| Lifecycle primary CTAs by status/owner | Live (`waiting-list-lifecycle-action.ts`) |
| Assign / Assign to me / peer | Live |
| Reassign (Pending\|Processed + owned + `.reassign`) | Live on WL |
| Claim-for-lifecycle confirm | Live (“Continue as me”) |
| Owner column / “You” | Live |
| Attention **column** | Removed per lifecycle claim doc; Pre-Auth / CCMS attention **labels** still resolve inline |
| Summary widget | Live (`WaitingListSummaryWidget`) — not a dashboard SoT |
| Re-evaluate Auth dual-store sync | Deferred (known) |

### Certified behavior (must not change from UX alone)

Shared visibility; NULL owner valid; open ≠ claim; Assign/Claim/Reassign/ReQueue semantics; PD16; CAS; no silent ownership.

### Which UX remains?

| Item | Class | Notes |
|------|-------|-------|
| Visual density / redundant status copy reduction | **E** / **F** | No formal brief located; do not invent metrics |
| Re-evaluate Auth sync honesty | **C** / **E** | Deferred dual-store |
| Align Surgery Done → “new counselling session” narrative | **F** | Current certified: SurgeryDone View/read-only historical — do not invent |
| Make next action more obvious | **E** | CTAs exist; Product may ask polish |

### Actions by lifecycle state (current FE)

| State | Current owner | NULL | Other |
|-------|---------------|------|-------|
| Pending | Start Counseling | Assign | View |
| Processed | Continue | Assign (eligibility) / View | View |
| Done | Re-evaluate | Assign then Re-evaluate path | Claim confirm then Re-evaluate |
| RepeatCounselling | Start Repeat | Assign then Start Repeat | Claim confirm then Start Repeat |
| AddOnSurgery / SurgeryDone | View | View | View |
| PreAuthQueue coverage | Pre-Auth | Pre-Auth | Pre-Auth |

Reassign: owned Pending\|Processed only (FE). Backend Reassign may allow broader InProgress-session cases (F7).

### Ownership / assignment appearance

- Owner column + filters on WL.
- Assign/Reassign dialogs show current owner / target.
- Opening still does **not** establish ownership.

### Shared queue semantics

Preserved. “My Sessions” is client filter convenience only.

### Product Decision vs pure UX

| Pure UX (if Product later chooses) | Needs Product Decision |
|------------------------------------|------------------------|
| Density, copy, badge placement, sheet polish | Changing which lifecycle actions appear on which states |
| | Requiring Auth sync for Re-evaluate |
| | Moving primary remediation off/on WL |
| | Treating WL as exclusive “dashboard” replacing Sessions RR |

---

## 28. Counsellor Dashboard redesign — dedicated audit

### Prior plan evidence

| Question | Finding |
|----------|---------|
| Dedicated dashboard structure defined? | **INSUFFICIENT REPOSITORY EVIDENCE** |
| Work summary / operational cards / active counselling / waiting work / next actions specified as SoT? | **INSUFFICIENT REPOSITORY EVIDENCE** |
| Ownership visibility on a dashboard? | Not as a separate surface; ownership appears on WL / Sessions / History |
| My Work relationship? | Analytics My Work is **reporting** (Slice 11) — must not be operational queue |
| Current de facto landing? | Waiting List (`DashboardRouter` Counsellor → WL; legacy `/dashboard/counselor` redirects) |

### What exists today

- `WaitingListSummaryWidget` on Waiting List.
- Analytics page (reporting).
- Archive personalized “CounselorStats” UX (**F** — conflicts with shared queue policy; mock-era).

### F15 mapping

F15 (workload/coverage dashboard) remains **F** — insufficient product evidence. Do not invent dashboard metrics in Product Decision without a new brief.

### Source needed if Product wants a dashboard

A Product Decision Record defining: audience, cards/metrics SoT (API), relationship to Waiting List vs Sessions RR vs Analytics, and explicit non-goals (not a second leave worklist; not My Work operationalization).

---

## 29. End-to-end Counsellor UX map

```text
Dashboard
   │  (formal Counsellor Dashboard SoT: INSUFFICIENT REPOSITORY EVIDENCE)
   │  (de facto landing = Waiting List)
   ↓
Waiting List  [SHARED · explicit Assign/Claim/Reassign · lifecycle CTAs]
   ↓
Counselling Session  [owned mutate · Wave 2 journey · open ≠ ownership]
   ↓
Quote → Decision → Insurance → Notes → Finish
   │                 (owner ACL; History for ownership/ReQueue events)
   ↓
Finalize Surgery     [SHARED · not CounselorId SoT]
Follow-up Center     [SHARED · ReQueue · no My Follow-ups · Original Counsellor historical]
Post-Surgery tab     [SHARED · explicit ownership assignment DEFERRED · PD-POST-01 / D6]
   ↓
Analytics / My Work  [REPORTING ONLY · not operational worklist]

Parallel / adjacent:
Counselling Sessions (+ Reassignment Required filter)
   · discovery of unavailable-owner open sessions (Slice 12)
   · Open-only today; remediation CTAs elsewhere (F6/F7)
   · NOT in Counsellor sidebar (F8)
```

### Ownership semantics along the journey

| Stage | Ownership semantics |
|-------|---------------------|
| Dashboard (if ever built) | Must not invent ownership; must not replace Analytics My Work |
| Waiting List | Shared visibility; ownership via Assign/Claim/Reassign |
| Session open/view | Does **not** establish ownership |
| Quote / Decision / Insurance / Notes | Session-owner mutate (certified ACL) |
| Finish / Complete | Historical stamp retained |
| Finalize | Shared |
| Follow-up | Shared list; ReQueue clears ownership when applicable |
| Post-Surgery | Shared; no counselling owner stamp; assign deferred |
| Analytics | Attribution reporting only |
| Sessions RR | Detection/discovery; remediation path incomplete on-surface |

---

## 30. UX ↔ ownership coupling

| Item | Coupling | Notes |
|------|----------|-------|
| Waiting List action model | UX + existing certified backend | CTA matrix implemented; do not reopen eligibility without PD |
| Explicit Start/Claim | UX + existing certified backend | Claim-for-lifecycle certified; F12 availability alignment separate |
| Opening = ownership? | Must remain **false** | PD-START-01 |
| Viewing = started work? | Must remain **false** | Certified |
| Reassign from Sessions RR | UX + Product Decision | APIs exist; hosting CTA on Sessions not decided |
| Unavailable counsellor indicators | UX + existing certified backend | RR filter exists; presentation/discoverability open |
| Ownership indicators on WL/Sessions/History | UX + existing certified backend | Mostly **A** |
| Counsellor History | UX + existing certified backend | Model certified; ReQueue presentation UAT pending |
| Post-Surgery ownership | UX + Product Decision (+ possible backend SoT) | F10 / D6 |
| Admin deactivation handoff | UX + Product Decision | F9; optional in Slice 12 PD |
| Claim availability alignment | Backend gap / defect candidate | F12 — not pure UX |
| Archive “My Assigned Patients” dashboard | Insufficient / superseded | **F** — conflicts with PD-WL-01 |

---

## 31. Mapping ownership findings F6–F15 → UX matrix

| Finding | UX / workflow areas | Coupling |
|---------|---------------------|----------|
| **F6** Sessions RR discovery-only | Reassignment Required; Counselling Sessions; Session detail; Assign/Reassign/ReQueue UX | UX + PD (CTA host) / **D**-risk vs PD-S12-14 wording |
| **F7** RR vs WL remediability mismatch | Waiting List lifecycle/Reassign eligibility; Sessions RR | UX + existing backend + possible PD |
| **F8** Sessions/RR not in sidebar | Counsellor Information Architecture / navigation | UX + PD |
| **F9** Admin deactivate handoff | Admin→Counsellor workflow handoff | UX + PD (optional→required?) |
| **F10** Post-Surgery ownership | Downstream ownership / Post-Surgery | PD + SoT (D6) — not pure visual UX |
| **F11** Legacy Admin-stamped ownership | Legacy remediation (ops vs migration) | PD — not Slice UX polish |
| **F12** Claim availability alignment | Claim UX / backend gate parity | Backend gap / PD vs defect |
| **F14** Bulk remediation | Ops tooling | PD; weak evidence |
| **F15** Workload / coverage dashboard | Counsellor Dashboard | **F** until Product brief exists |

F1–F5 / F13 / F16–F18 remain as in Section 9 (certified / out-of-scope / governance).

---

## 32. Candidate future workstreams (not ranked · not approved)

Candidate groupings only. **Do not** treat as approved Slice 13 scope.

### Workstream A — Counsellor Dashboard / Waiting List UX

Evidence: WL lifecycle **A**; dashboard redesign SoT **F**; visual WL redesign brief **F**/partial **E**; F15.

### Workstream B — Counselling Session / Workspace UX

Evidence: Wave 2 Quote/Decision/Notes/journey largely **A**; Clinical Recs placeholder **E**; ReQueue→History UAT pending; older guide stale.

### Workstream C — Reassignment Required remediation / discoverability

Evidence: F6, F7, F8; certified detection **A**; on-surface remediation **E**/PD; reuse Assign/Reassign/ReQueue APIs — **no new queue**.

### Workstream D — Counsellor Navigation / Information Architecture

Evidence: F8; sidebar omits Sessions/RR; Analytics drill ≠ RR.

### Workstream E — Patient Header / Contextual UX

Evidence: Header/Sheets largely **A**; Optometrist Clinical Recommendations placeholder **E**.

### Workstream F — Downstream ownership / Post-Surgery

Evidence: F10; PD-POST-01 / D6; separate from counselling CounselorId; Follow-up shared preserved.

### Workstream G — Legacy ownership remediation

Evidence: F11; ops Reassign/ReQueue vs DATA MIGRATION; no silent backfill.

---

## 33. Product Decisions Required (consolidated — do not answer here)

### A. Existing accepted / certified decisions (preserve)

Hybrid E; CounselorId SoT; CreatedBy ≠ ownership; shared Waiting List; explicit ownership; ReQueue→NULL; CAS; ownership history; PD16; Follow-up shared; Analytics My Work reporting only; Finalize shared; no automatic leave transfer/ReQueue; no new Supervisor; no duplicate leave queue; RR = operational condition.

### B. Decisions already deferred (still open)

| ID / topic | Notes |
|------------|-------|
| PD-POST-01 / D6 | Post-Surgery explicit assignment SoT |
| Legacy Admin-stamped remediation | Ops vs migration (Phase 3H) |
| Re-evaluate Auth dual-store sync | Deferred since lifecycle UX |
| Temporary leave without IAM signal | Out of Slice 12 (PD-S12-01) |
| JWT revoke on deactivate | PD-S12-19 separate track |
| Phase 2W unsigned Follow-up ops rules | Historical; do not silently reopen as ownership Slice 13 |
| Formal Phase 3H named hospital sign-off | Governance (F17) |

### C. New decisions required for future UX (presentation / IA)

1. Should Counselling Sessions / Reassignment Required appear in the Counsellor sidebar?  
2. Should Waiting List remain the sole Counsellor landing, or is a separate Dashboard required?  
3. Is Wave 2 session workspace considered accepted UX SoT without a formal docs acceptance pack?  
4. Must ReQueue→History Notes presentation complete Manual UAT / Acceptance before further UX slices?  
5. Should Clinical Recommendations Optometrist content remain placeholder or require clinical SoT integration?  
6. Is a workload/coverage dashboard desired (F15), and what is its metric SoT?

### D. Decisions required because UX would change business behavior

1. Should Sessions RR host direct Reassign / ReQueue (and/or Assign) CTAs?  
2. Who is authorized to remediate from Sessions (reuse `.reassign` only, or expand)? — **do not invent**; reuse existing codes unless PD says otherwise.  
3. Should Admin deactivation **require** warn/drill to Sessions RR (optional in Slice 12 → now required?)?  
4. Should Claim-for-lifecycle align with Slice 12 target-availability protection (F12)?  
5. Should FE Reassign eligibility expand beyond Pending\|Processed to match backend/RR population (F7)?  
6. What is Post-Surgery ownership SoT (F10 / D6)?  
7. Legacy Admin ownership: operational remediation only vs migration (F11)?  
8. Bulk remediation required (F14)?  
9. May any future Dashboard / My Work UI become an operational worklist? (**Default certified answer: No** — would require explicit superseding PD.)

---

## 34. Design-system constraints for any future Counsellor UX

Any future Counsellor UX item (whatever Product selects) must preserve:

- Existing Hospital Portal design system (shadcn/Radix/Tailwind/Lucide; counselling tokens)
- Modern healthcare-grade, task-focused, accessible, responsive, desktop-first staff UX
- Consistent Sheets/Dialogs; minimal copy; no redundant status duplication
- **No** new design system / UI framework / theme replacement
- Bounded Counsellor surfaces only — do not redesign the entire application

---

## 35. Reconciliation gate statement

```text
OWNERSHIP READINESS AUDIT     ✅ COMPLETE (Sections 1–21)
UX CONTINUITY RECONCILIATION  ✅ COMPLETE (Sections 22–35)

PRODUCT DECISION              ❌ NOT STARTED
IMPLEMENTATION                ❌ NOT STARTED
SLICE 13                      ❌ NOT STARTED
```

**Neutral statement for Product Decision gate:**

Evidence supports residual **ownership/work-allocation** candidates (F6–F12, F14–F15) **and** separate **UX/workflow continuity** candidates (Waiting List polish, Wave 2 acceptance/UAT closure, navigation IA, Clinical Recommendations placeholder, dashboard SoT absence). Product must choose among evidence-backed candidates without assuming all UX becomes Slice 13 and without reopening certified Hybrid E ownership.

**Do not implement from this reconciliation.**

---

**END — SLICE 13 READINESS AUDIT + UX CONTINUITY RECONCILIATION COMPLETE — STOP**
