# Phase 3I — UAT Decision Gate

**Program:** Counsellor Ownership & Work Allocation  
**Phase:** Phase 3I  
**Mode:** VERIFICATION + PRODUCT-DECISION PREPARATION ONLY  
**Date:** 2026-09-19  
**Source audit:** `docs/audits/counsellor-ownership-work-allocation-phase3i-current-uat-findings-audit.md`  
**Stop condition:** Human must explicitly approve PD-A / PD-B / PD-C before any implementation task.

---

## 1. Current Phase Status

| Item | Status |
|---|---|
| Slices 1–9 | Complete |
| Slice 9 | Implementation complete; manual UAT findings under decision gate |
| Slice 10 | **NOT started** |
| This task | Live OT verification + final PD register only |
| Code / schema / permissions / UI / config / data | **Unchanged** |

Audit classifications (unchanged; live OT evidence strengthens A):

| Finding | Audit classification | Live evidence impact |
|---|---|---|
| A — OT Availability | CONFIGURATION / DATA (+ UX truthfulness) | **Confirmed:** Banjara Hills has **zero** `ot_theaters` rows |
| B — Admin Repeat | EXPECTED CERTIFIED BEHAVIOR | Unchanged |
| C — Second-Eye | PRODUCT DECISION REQUIRED | Unchanged; model still supports new session |

---

## 2. Live OT Verification

### 2.1 Database identity (no secrets)

| Field | Value |
|---|---|
| Source config | `microservices/auth-service/AuthService/appsettings.Development.json` → `ConnectionStrings:DefaultConnection` (same host/db as `appsettings.json`) |
| Host | `hospitalportal-db-server.postgres.database.azure.com` |
| Port | `5432` |
| Database | `hospitalportal` |
| Schema | `public` |
| Access mode | **READ-ONLY** `SELECT` via `psql` |
| Password / full connection string | **Not disclosed** in this report |

### 2.2 Preferred count query result

```sql
SELECT branch_id, COUNT(*) AS active_ot_count
FROM ot_theaters
WHERE deleted_at IS NULL AND is_active = true
GROUP BY branch_id
ORDER BY branch_id;
```

| Branch ID | Active OT Count |
|---|---|
| `74c014cf-9570-4824-bdf9-b369ea11a8f4` | **3** |
| `98fbadae-b76f-4aa1-bfd9-df0eef9e0a5d` | **2** |

All other branches: **0** active OTs (no rows in the grouped result).

### 2.3 Branch names + OT counts

Authoritative branch table: **`branch`** (`Branch` entity → `ToTable("branch")`).

| Branch ID | Branch Name | Active | Inactive | Deleted |
|---|---|---|---|---|
| `74c014cf-9570-4824-bdf9-b369ea11a8f4` | Downtown Hospital | 3 | 0 | 0 |
| `98fbadae-b76f-4aa1-bfd9-df0eef9e0a5d` | CareFirst Bangalore | 2 | 0 | 0 |
| `9b2f6670-845c-4603-b75d-b10b776ad22d` | Hyderabad Eye Clinic - Banjara Hills | **0** | **0** | **0** |
| (19 other active branches) | e.g. AIIMS*, Apollo*, Delhi Eye*, Mumbai Eye*, … | 0 | 0 | 0 |

### 2.4 Banjara Hills verification

| Check | Result |
|---|---|
| Branch exists | **Yes** |
| Name | Hyderabad Eye Clinic - Banjara Hills |
| Status / operational | Active / Operational |
| Active OT count | **0** |
| Inactive OT count | **0** |
| Deleted OT count | **0** |
| Total `ot_theaters` rows for branch | **0** |

### 2.5 Downtown verification

| Check | Result |
|---|---|
| Branch ID | `74c014cf-9570-4824-bdf9-b369ea11a8f4` |
| Name | Downtown Hospital |
| Active OT count | **3** |
| Inactive | 0 |
| Deleted | 0 |

### 2.6 OT detail metadata (safe fields only)

| OT ID | Name | Code | Branch | IsActive | Deleted | IsOperational | MaintenanceMode |
|---|---|---|---|---|---|---|---|
| `aaa00001-0000-0000-0000-000000000001` | Operating Theater 1 | OT-01 | Downtown | true | false | true | false |
| `aaa00001-0000-0000-0000-000000000002` | Operating Theater 2 | OT-02 | Downtown | true | false | true | false |
| `aaa00001-0000-0000-0000-000000000003` | Laser Suite | OT-03 | Downtown | true | false | true | false |
| `d9bc6e28-56f3-4606-acf1-b7a089aa7593` | OT-1 Phaco Suite | OT1 | CareFirst Bangalore | true | false | true | false |
| `e3d3c8bf-a0ad-42c8-be1d-92784be9f7c2` | OT-2 General Suite | OT2 | CareFirst Bangalore | true | false | true | false |

Banjara Hills: **no OT rows to list**.

### 2.7 Emma branch access (supporting)

User matched by FirstName containing Emma (UAT counsellor context):

| Field | Value |
|---|---|
| Primary `BranchId` | `9b2f6670-845c-4603-b75d-b10b776ad22d` (Banjara Hills) |
| `user_branches` | Single **active** row for Banjara Hills only |

Conclusion: Emma’s authorized branch set for `GetTheaters` contains **only** Banjara Hills → query returns `[]`.

### 2.8 Counseling theaters HTTP endpoint

| Check | Result |
|---|---|
| Local AuthService health probe | No listening service on common local ports (`5000/5001/5080/7001/7002/8080`) |
| Authenticated `GET /api/Counseling/theaters` as Emma / Downtown | **Not executed** — no safe running AuthService + no credential use in this task |
| Inference from live DB + certified code path | Emma authorized set = {Banjara} with 0 active OTs → endpoint **must** return `[]` (HTTP 200). Downtown counsellor with Downtown access → up to **3** theaters. |

No code was modified to enable the HTTP call.

### 2.9 Exact OT condition classification

**A. Banjara Hills has zero active OT master records.**

Evidence: live `COUNT` / detail queries; branch exists and is Active/Operational; Emma authorized only to that branch.

Not B/C/D as primary (no OTs to return, hide, or union).

---

## 3. PD-A — OT Availability

### PD-A — OT Master Configuration

**Current live state:**  
Only **2 of 21** non-deleted branches have active OT master data (Downtown: 3, CareFirst Bangalore: 2). Banjara Hills and all other listed surgery-named branches have **zero** OT rows.

**Banjara Hills:**  
`9b2f6670-845c-4603-b75d-b10b776ad22d` — **0** active / inactive / deleted OTs. Branch Active/Operational.

**Downtown:**  
`74c014cf-9570-4824-bdf9-b369ea11a8f4` — **3** active OTs (OT-01, OT-02, OT-03).

**Other surgery-capable branches:**  
CareFirst Bangalore has 2. Multiple eye-hospital named branches (Koramangala, T Nagar, Andheri, etc.) have **0** OTs — same configuration gap pattern as Banjara.

**Root cause classification:**  
**[CONFIGURATION / DATA ISSUE]** — confirmed live.  
Secondary: **[UX TRUTHFULNESS ISSUE]** — message says “this branch” while FE does not pass branchId (union of authorized branches). For Emma, authorized set is only Banjara, so the message is operationally accurate in her case.

**Confirmed live facts (not decisions):**  
- Empty Schedule Surgery OT list for Emma is explained by zero master rows.  
- Downtown has OTs; difference Emma vs Super Admin Downtown is configuration, not date/time filtering.

**Existing certified behavior:**  
`GET /api/Counseling/theaters` returns active, non-deleted theaters for authorized branches; no slot filtering.

**Decision required:**  
1. Confirm OT master is **mandatory** for every branch that schedules surgery from counselling.  
2. Authorize **ops/admin** to create/activate OTs for Banjara Hills (and other surgery branches) via existing OT theater administration — **not** a code seed in this gate.  
3. Optional later: FE pass session/selected `branchId` + clearer empty copy (“none configured” vs authorization).

**Recommended decision:**  
**Approve ops configuration of active OTs for Banjara Hills (and other surgery-scheduling branches lacking master data).** Treat optional UX copy/`branchId` as a separate small follow-up if desired. Do **not** treat this as an application filter defect.

**Implementation required:**  
**None for the primary fix** (configuration only). Optional small FE honesty change only if separately approved.

**Configuration required:**  
Create/activate ≥1 `ot_theaters` row for Banjara Hills (`branch_id = 9b2f6670-…`, `is_active = true`, `deleted_at IS NULL`), via authorized operational process. Repeat for other surgery branches as product requires.

**UX improvement (optional, separate):**  
Distinguish “no theatres configured for authorized branch(es)” from error/403; optionally pass `branchId`.

**Out of scope:**  
Seeding in this task; new availability engine; date/time/doctor filters; GetTheaters redesign; ownership/Slice 10.

**Implementation Ready?**  
**YES** for **configuration action** after human approval (no code).  
**NO** for code changes until optional UX PD is separately approved.

---

## 4. PD-B — Administrative Repeat Counselling

### PD-B — Administrative Assignment of Unassigned Repeat

**Current certified behavior:**  
- Claim-for-lifecycle is **counsellor-only** (`IsAssignableCounsellorAsync`).  
- Start Repeat uses claim-for-lifecycle (`intent: StartRepeat`).  
- Admin does **not** silently become owner by opening/starting.  
- Assign: unassigned Pending/Processing only; **rejects** Done/Repeat.  
- Reassign: rejects Completed/Repeat; NULL must use Assign.  
- Waiting List filters by selected branch; **no All Branches**.  
- Emma not visible under Downtown is **expected** branch isolation.

**Observed UAT:**  
Super Admin Start Repeat on unassigned Repeat → toast *"Only a counsellor can take ownership for this action"* — **correct under current rules**.

**Proposed decision (for explicit human approval):**  

> For an **UNASSIGNED** Repeat Counselling item, Admin/Super Admin may **explicitly Assign** the session to an **eligible counsellor** within the session’s authorized branch.  
> Flow: Repeat → Unassigned → Assign Counsellor → picker → explicit `CounselorId` → selected counsellor starts Repeat via **existing** lifecycle claim/start.  
> Admin must **NOT** become owner unless independently an eligible counsellor under existing identity rules.

**Why this does not silently change ownership:**  
Ownership changes only through explicit Assign to a validated counsellor target. Claim remains counsellor-only. Start Repeat still requires the assigned counsellor (or claim-as-self if Admin is also a counsellor).

**Existing capabilities reusable:**  
- Assign endpoint + ownership history/audit + Version/409  
- Counsellor eligibility + branch authorization  
- Claim-for-lifecycle StartRepeat (unchanged, counsellor-only)  
- Counsellor picker (`GET /Counseling/counselors?branchId=`)

**Expected implementation surface if approved:**  
- Extend Assign eligibility to: queue Completed + not agreed (Repeat) + `CounselorId` NULL (+ keep SurgeryDone rejected)  
- FE: Assign Counsellor CTA for Admin on unassigned Repeat (not Start-as-Admin)  
- Tests: Assign allow/deny matrix; Claim still counsellor-only; Admin cannot silent-own  
- **Do not** broaden Claim to Admin

**Explicitly unchanged:**  
Claim-for-lifecycle counsellor-only; Version/409; branch auth; ownership history/audit; Admin ≠ automatic owner; Slice 8 Requeue; Slice 9 SurgeryDone seal.

**Separate future decisions:**  
- Owned Repeat administrative handoff (e.g. Olivia owned + Admin Start) — **not** part of PD-B  
- **All-Branches Waiting List for Super Admin is a separate access/product decision and is not part of PD-B.**

**Implementation Ready?**  
**YES** — evidence sufficient, decision explicit, scope bounded (Assign eligibility + FE CTA only), claim rule preserved — **after human approval**.

---

## 5. PD-C — Subsequent / Second-Eye Surgery

### PD-C — Subsequent / Second-Eye Surgery

**Current certified behavior:**  
- One Patient → many CounselingSession records.  
- SurgeryDone: historical OT status; counselling ownership sealed; `CounselorId` retained; same session cannot Claim ReEvaluate/StartRepeat.  
- Repeat: same session, non-agreement resume.  
- ReEvaluate: same session, agreed Done (not SurgeryDone).

**Confirmed mechanical capability:**  
Session A (Eye A, SurgeryDone) + Session B (Eye B, new counselling) is representable **without schema change**. FE duplicate guard ignores SurgeryDone. OT unique index excludes SurgeryDone → new OT INSERT allowed after prior SurgeryDone.

**Proposed core decision (for explicit human approval):**  

> A subsequent/second-eye surgical episode for an existing patient is represented by a **NEW CounselingSession**.  
> The previous SurgeryDone session remains historical and is **NOT** reopened merely to represent the second eye.

**Why SurgeryDone must remain historical:**  
Preserves Slice 9 seal, historical ownership attribution, and OT audit integrity. Reopening to change eye would collapse episodes and violate certified ownership mutation guards.

**Repeat Counselling distinction:**  
Same `sessionId` / non-agreement lifecycle — **not** a new surgical episode / other eye.

**ReEvaluate distinction:**  
Same `sessionId` / agreed Done reopen — **not** SurgeryDone and **not** a new episode.

**SessionType finding:**  
Existing DB-allowed values: `Initial | Followup | Recheck | Urgent` (see `counsellor-master-maps.ts`).  
Add Patient default for new: **`INITIAL` → `Initial`**.  
Repeat/requeue default: **`FOLLOW_UP` → `Followup`**.  
No dedicated “second-eye” / “subsequent surgery” SessionType exists.  
**Which existing value to require for subsequent-eye Add Patient:** **PRODUCT DECISION REQUIRED** (candidates: keep default `Initial`, or require `Followup`). **Do not create a new enum/value.**

**Ownership behavior:**  
Unchanged unless separately approved: counsellor create → self-own; Admin/non-counsellor create → NULL; **no** inherit from prior SurgeryDone session.

**Prior-surgery UX finding:**  
`AddPatientModal` does **not** surface prior SurgeryDone / completed eye / remaining eye. Operators can create Session B but lack in-flow awareness. Improvement would be useful; **not** implementing now.

**Concurrent episode finding:**  
**PRODUCT DECISION REQUIRED (separate).**  
If Session A is Done (scheduled) but **not** SurgeryDone, FE allows Add Patient; `OtFinalizeService` upsert finds the first active non-Cancelled/non-SurgeryDone row **per patient** and **UPDATE**s it (can rebind `CounsellingSessionId` / eye). This does **not** guarantee independent concurrent episodes. Report only — do not fix in this gate.

**Clinical timing rule:**  
**No coded clinical timing rule was found.** Do not introduce 15-/20-day rules.

**Schema requirement:**  
**None** for the core new-session model.

**Implementation scope if approved:**  
1. Document + UAT the new-session subsequent-eye workflow.  
2. Optional: Add Patient prior-surgery awareness (separate small UX PD).  
3. Automated tests: SurgeryDone cannot ReEvaluate/StartRepeat; new session for same Patient with different eye; Session A unchanged.  
4. Concurrent-episode protection: **out of PD-C core** until separate approval.

**Out of scope:**  
Reopen SurgeryDone; collapse into Repeat; new episode table/ID; new SessionType enum; clinical wait periods; ownership inheritance change; Slice 10.

**Implementation Ready?**  
**YES** for core decision (document + UAT + regression tests) after approval.  
**NO** for SessionType specialization, prior-surgery UI, and concurrent-episode protection until those sub-decisions are approved.

---

## 6. Cross-Cutting Safety Constraints

| Constraint | Gate stance |
|---|---|
| Branch isolation | Preserved; All-Branches not part of PD-B |
| Admin ≠ counsellor | Preserved; Claim stays counsellor-only |
| Owner ≠ actor | Explicit Assign only |
| SurgeryDone historical | Preserved |
| Repeat ≠ second-eye | Explicit in PD-C |
| OT master ≠ slot availability | Confirmed live |
| Version/409 | Must be preserved if PD-B Assign extended |
| Ownership history/audit | Reuse Assign trail; no duplicate trail |
| Worklists | No new Second Eye / Admin Counselling worklist |
| Clinical timing | Not invented |

---

## 7. Decision Matrix

| Decision | Current State | Evidence Status | Proposed Decision | Implementation Ready? |
|---|---|---|---|---|
| PD-A OT | Banjara: 0 OTs; Downtown: 3; Emma authorized to Banjara only | **Live DB confirmed** | Ops configure active OTs for Banjara (+ other surgery branches as needed); optional UX later | **YES** (config); code optional = separate |
| PD-B Admin Repeat | Admin Start Repeat correctly blocked; Assign rejects Repeat | Code/audit certified | Extend Assign to unassigned Repeat only; Claim unchanged; counsellor starts | **YES** after approval |
| PD-C Second Eye | New session mechanically supported; SurgeryDone sealed | Code/model confirmed; no live patient mutation | New CounselingSession for subsequent/second-eye; SurgeryDone stays historical | **YES** (docs/UAT/tests); SessionType/UX/concurrent = **NO** until sub-PDs |

---

## 8. Future Implementation Boundaries

### PD-A potential future implementation

**Possible:**  
- Operational OT configuration for Banjara Hills / other surgery branches  
- Optional `branchId` on Schedule Surgery theaters call  
- Truthful empty-state copy  

**Not automatically:**  
- New availability engine  
- Date/time filtering  
- Doctor/OT compatibility  
- New OT architecture  

### PD-B potential future implementation

**If approved:**  
- Extend Assign eligibility to Completed/Repeat + `CounselorId` NULL  
- Preserve target counsellor eligibility, branch auth, Version/409, History/Audit  
- Preserve counsellor-only Claim  
- Admin-visible Assign action on unassigned Repeat  
- Selected counsellor subsequently starts Repeat  

**Do NOT implement now.**

### PD-C potential future implementation

**If approved:**  
- Document new-session subsequent-eye workflow  
- Optionally improve Add Patient prior-surgery awareness  
- Test Session B after Session A SurgeryDone  

**Separate future decision:**  
- Concurrent active episode protection (patient-scoped OT upsert gap)  

**Do NOT implement now.**

---

## 9. Required Automated Tests

### PD-A

- Theater lookup contract (`/Counseling/theaters`, `counseling_sessions.read`)  
- Branch authorization / empty vs 403 behavior  
- (Optional) FE empty-state copy contract if UX change approved  

### PD-B

- Admin Assign unassigned Repeat → success for eligible counsellor  
- Reject Assign when already owned / SurgeryDone / wrong branch / non-counsellor target  
- Version/409  
- Ownership History + Audit on Assign  
- Claim remains counsellor-only (Admin 403)  
- Admin cannot silently own via Start Repeat  

### PD-C

- SurgeryDone cannot ReEvaluate / StartRepeat / Assign / Reassign / ReQueue  
- New session can be created for same PatientId  
- New eye stored on Session B  
- Session A remains SurgeryDone; Session A `CounselorId` unchanged  
- Session B ownership follows existing Create rules  

---

## 10. Required Manual UAT

### PD-A

1. After ops configures Banjara OTs: Emma Schedule Surgery → OT list non-empty  
2. Downtown Schedule Surgery still works  
3. Branch with zero OTs still shows truthful empty state  
4. Do not seed during UAT without ops approval  

### PD-B

1. Super Admin sees unassigned Repeat  
2. Assign Counsellor (not Start-as-Admin)  
3. Eligible counsellors for **session branch** displayed  
4. Assign Olivia  
5. Olivia starts Repeat via existing flow  
6. Super Admin cannot silently start as Olivia  
7. Branch isolation intact (Emma still not visible under Downtown)  

### PD-C

1. Patient with Eye A SurgeryDone  
2. Add Patient → new counselling → Eye B  
3. Session A remains historical / View  
4. Session B normal counselling → schedule → OT  
5. Confirm OT/session relationship for Session B  
6. Confirm Repeat/ReEvaluate not used for second eye  

---

## 11. Explicitly Deferred Items

| Item | Status |
|---|---|
| Slice 10 Follow-up ownership honesty | Deferred |
| Slice 11 Analytics My Work | Deferred |
| Slice 12 Leave/Reassignment Required | Deferred |
| All-Branches Waiting List | Separate access PD — not PD-B |
| Owned Repeat Admin handoff | Separate PD |
| Concurrent Done-before-SurgeryDone episode guard | Separate PD |
| SessionType choice for subsequent-eye | Sub-decision under PD-C |
| Add Patient prior-surgery awareness UI | Optional UX under PD-C |
| Clinical 15–20 day wait rule | Not found; not inventing |
| Seeding/activating OTs in this task | Forbidden; ops after PD-A approval |

---

## 12. Files / Queries Inspected

### Queries (READ-ONLY)

1. Active OT counts by `branch_id`  
2. Branch join: name + active/inactive/deleted OT counts  
3. Banjara Hills / Downtown detail counts  
4. OT metadata for Downtown + CareFirst (+ empty Banjara)  
5. Emma user primary branch + `user_branches`  

### Config / code / docs

| Path | Purpose |
|---|---|
| `AuthService/appsettings.Development.json` | DB host/database identity (secrets not logged) |
| `AuthService/appsettings.json` | Confirms same Azure host/db |
| `AppDbContext.cs` | `branch`, `users`, `ot_theaters` table names |
| `CounselingController.GetTheaters` | Endpoint filter semantics (prior audit) |
| `FollowupBranchAccessService` | Authorized branch set |
| `ScheduleSurgeryModal.tsx` | Empty-state string |
| `CounselingWorkflowService` Assign/Claim | PD-B certified rules |
| `OtFinalizeService` Upsert | Concurrent episode gap |
| `counsellor-master-maps.ts` | SessionType existing values |
| `AddPatientModal` / `add-patient-to-waiting-list.ts` | Prior-surgery UX / duplicate guard |
| Prior UAT findings audit | Source classifications |

---

## 13. No-Implementation Confirmation

Decision Gate complete. No implementation was performed.

### Safety checklist

- [x] Live OT SQL was READ ONLY  
- [x] No database data changed  
- [x] No source code changed  
- [x] No migrations created  
- [x] No permissions changed  
- [x] No roles changed  
- [x] No API contracts changed  
- [x] No UI changed  
- [x] No OT configuration changed  
- [x] No ownership rules changed  
- [x] No SurgeryDone / Repeat / ReEvaluate behavior changed  
- [x] Slice 8 preserved  
- [x] Slice 9 preserved  
- [x] Slice 10 NOT started  
- [x] PD-A / PD-B / PD-C separated from facts  
- [x] No clinical rule invented  
- [x] No branch isolation bypassed  
- [x] No implementation performed  

---

## Explicit approval request

Please approve or reject each decision independently:

1. **PD-A** — Ops configure active OTs for Banjara Hills (and other surgery branches as needed)?  
2. **PD-B** — Extend Assign for unassigned Repeat only; Claim remains counsellor-only?  
3. **PD-C** — Subsequent/second-eye = new CounselingSession; SurgeryDone stays historical?

Do not create an implementation Cursor task until approvals are recorded.
