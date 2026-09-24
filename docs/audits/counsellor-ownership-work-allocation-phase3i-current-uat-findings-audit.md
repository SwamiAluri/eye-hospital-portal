# Phase 3I — Current UAT Findings Audit

**Program:** Counsellor Ownership & Work Allocation  
**Phase:** Phase 3I  
**Mode:** AUDIT ONLY — no code, schema, API, permission, UI, or configuration changes  
**Date:** 2026-09-19  
**Scope:** Post–Slice 9 UAT findings A (OT Availability), B (Repeat Counselling Admin), C (Subsequent / Second-Eye Surgery)  
**Stop condition:** Audit / product-decision preparation only. Slice 10 NOT started.

---

## 1. Executive Summary

| Finding | Classification | Confirmed Root Cause | Product Decision Required |
|---|---|---|---|
| OT Availability | **[CONFIGURATION / DATA ISSUE]** (+ secondary **[UX TRUTHFULNESS ISSUE]**) | Schedule Surgery loads `GET /api/Counseling/theaters` with no date/time filter. Empty list = no active `ot_theaters` rows for the caller’s authorized branch set (or empty accessible branches). Historical seeds cover Downtown / first branch only — not Banjara Hills. | PD-A: Confirm OT master is mandatory for surgery-scheduling branches; authorize per-branch OT configuration; optionally clarify empty-state copy and whether FE should pass session/selected branch. |
| Repeat Counselling Admin | **[EXPECTED CERTIFIED BEHAVIOR]** (+ Emma visibility = **[EXPECTED CERTIFIED BEHAVIOR]** under branch scope) | Super Admin Start Repeat is blocked by FE counsellor-only gate (`canAssignToMe`) and BE `IsAssignableCounsellorAsync`. Assign/Reassign cannot establish Done/Repeat ownership. Emma’s Banjara sessions are outside Downtown-selected Waiting List filter; no All-Branches WL mode. | PD-B: Whether Admin may explicitly Assign an eligible counsellor on unassigned Repeat (new supervisory path), without silent Admin ownership; whether All-Branches WL is needed. |
| Subsequent / Second-Eye Surgery | **[PRODUCT DECISION REQUIRED]** (mechanically supported via new session) | SurgeryDone seals same-session ReEvaluate/StartRepeat. Second-eye is representable as a **new** `CounselingSession` (Add Patient) with different eye; schema allows it without change. No coded “second-eye episode” rule; ownership does not inherit from prior SurgeryDone session. | PD-C: Confirm new-session model as intended subsequent-surgery path; SessionType; warnings; concurrent Done-before-SurgeryDone policy; ownership on create. |

Do not rank the findings.

---

## 2. Finding A — OT Availability

### Current Behavior

When Emma (counsellor, Hyderabad Eye Clinic - Banjara Hills) opens Counselling → Schedule Surgery:

- Doctor and time fields load.
- Operation Theatre select is disabled/empty.
- Placeholder: **"No operation theatres available for this branch."**
- OT is required → scheduling cannot continue.

### Evidence

| ID | Fact |
|---|---|
| A1 | Exact empty string only in `ScheduleSurgeryModal.tsx` when `!loadingTheaters && !theaterError && theatres.length === 0`. |
| A2 | FE calls `counsellorsDeskApi.getOtTheaters()` **with no arguments** on modal open — independent of date, doctor, time. |
| A3 | API: `GET /api/Counseling/theaters` (`CounselingController.GetTheaters`), permission `counseling_sessions.read` (not `ot.theaters.view`). |
| A4 | Query: `TenantId` + `DeletedAt == null` + `IsActive` + `BranchId ∈ accessibleBranches`. **No** date/time/doctor/`IsOperational`/`MaintenanceMode` filters. |
| A5 | Accessible branches from `FollowupBranchAccessService.ResolveAccessibleBranchesAsync` (`user_branches` active + primary `Users.BranchId`). Optional `branchId` narrows; omitted = all authorized branches. Empty accessible set → `Ok([])`. |
| A6 | Seeds: `module03_05_ot_booking_system.sql` seeds first tenant/first branch only; `seed_counselor_module.sql` seeds Downtown `74c014cf-…` only. AuthService Program has no automatic multi-branch `ot_theaters` seed. |
| A7 | Banjara Hills branch id (from auth UAT docs): `9b2f6670-845c-4603-b75d-b10b776ad22d`. No seed evidence of OTs for that branch. |
| A8 | Distinct 403 UX exists: `"You don't have access to operation theatres for this branch."` — not the Finding A string. |

**Live UAT DB row counts were not queried in this audit.** Classification of “missing OT rows for Banjara” is strongly evidenced by code + seed coverage; final confirmation requires the SQL in §A10 / Recommended Order.

### FE Trace

| Step | Location |
|---|---|
| Modal | `apps/hospital-portal-web/src/components/counsellors-desk/ScheduleSurgeryModal.tsx` |
| Mount | `CounsellingSessionPageContent` (Schedule Surgery open) — no branch props passed |
| Load | `useEffect([isOpen, theaterRetryKey])` → `getOtTheaters()` no args |
| Client | `counsellors-desk.api.ts` → `GET /Counseling/theaters`, `params: {}` when no branchId |
| Empty UI | Placeholder `"No operation theatres available for this branch."` |
| Not used | `/otbooking/theaters`, date/slot availability APIs |

### API Trace

- **Endpoint:** `GET /api/Counseling/theaters?branchId=` (optional)
- **Controller:** `CounselingController.GetTheaters`
- **Authz:** `[RequirePermission("counseling_sessions.read")]`
- **Branch:** server-resolved accessible set; client `branchId` cannot expand beyond it
- **Response:** `{ id, theaterName, theaterCode, branchId }[]` or `[]`

### Service Trace

No separate OT availability service on this path. Direct EF query on `OTTheaters` in the controller. Branch resolution: `FollowupBranchAccessService`.

Contrast (not Schedule Surgery path): `GET /api/OTBooking/theaters` uses `ot.theaters.view` and different filters (`OTBookingSystemService.GetAllTheatersAsync`).

### Database / Configuration Trace

| Artifact | Detail |
|---|---|
| Table | `ot_theaters` (`OTTheater` entity) |
| Branch mapping | Required `branch_id` — theater belongs to exactly one branch |
| Active SoT for counselling list | `is_active = true` AND `deleted_at IS NULL` |
| Not applied on this endpoint | `is_operational`, `maintenance_mode` |
| Mandatory per branch? | **No** schema constraint. Surgery scheduling **UI** requires OT, but branch creation does not create theaters. |

### Tenant / Branch Trace

| Layer | Source of truth |
|---|---|
| Tenant | JWT / `GetTenantId()` |
| OT filter branch set | Server: user authorized branches |
| FE Schedule Surgery | Does **not** send `selectedBranchId` or session `BranchId` |
| Session branch | Exists on `CounselingSession.BranchId` but unused by theaters lookup in current FE call |

### Authorization Trace

- Permission required: `counseling_sessions.read`
- Unauthorized requested `branchId` → 403 with different FE message
- Finding A string = successful **200 with empty array**, not authorization failure

### Root Cause

Primary: **no active OT master rows** (or empty authorized branch set) for the counsellor’s branch context — consistent with seeds that only populate Downtown / first branch, while Emma operates at Banjara Hills.

Ruled out as primary causes for this exact message:

- Date/time unavailability (theaters load without date/time)
- Doctor/OT compatibility filtering (none on this endpoint)
- `ot.theaters.view` permission (different endpoint/permission)

Secondary: empty-state copy says “this branch” while FE does not pass a branch and backend may return union of all authorized branches.

### Classification

**[CONFIGURATION / DATA ISSUE]** — primary  
**[UX TRUTHFULNESS ISSUE]** — secondary (copy implies single-branch unavailability; condition is “zero theaters returned for authorized branch set”)

Not classified as a confirmed application defect in the theaters query filters for date/time (those filters do not exist on this path).

### Product Decision Required

See **PD-A**.

### Implementation Boundary

**Out of scope until PD-A approved:** seeding OTs, schema changes, changing GetTheaters filters, changing Schedule Surgery to pass branchId, copy changes.

**In scope if approved (smallest):** operational OT master configuration for affected branches via existing admin/OT booking theater management; optional FE pass of session/selected `branchId`; optional truthful empty-state copy distinguishing “none configured” vs “none authorized.”

---

## 3. Finding B — Repeat Counselling + Admin

### Current Behavior

Super Administrator (Downtown Hospital branch context) opens Waiting List → Repeat Counselling, sees owned and unassigned rows, clicks **Start Repeat** on an unassigned item → toast:

**"Only a counsellor can take ownership for this action"**

No claim API call occurs (FE pre-gate).

### Evidence

| ID | Fact |
|---|---|
| B1 | Route: `/dashboard/counsellors-desk/waiting-list` |
| B2 | CTA: `resolveWaitingListLifecycleAction` → RepeatCounselling always **Start Repeat** |
| B3 | FE path: `resolveLifecycleOwnershipThenContinue` → `resolveLifecycleOwnershipDecision` → if `!canAssignToMe` → `blocked` → toast (page.tsx) |
| B4 | `canAssignToMe` = `canShowCounsellingAssignToMe` = counsellor identity only (`counselling-auth.ts`) |
| B5 | Claim endpoint: `POST /api/Counseling/sessions/{id}/claim-for-lifecycle` with `intent: StartRepeat`; permission `counseling_sessions.update` |
| B6 | BE: actor must pass `IsAssignableCounsellorAsync` or Forbidden `"Only a counsellor may claim a session for lifecycle work."` |
| B7 | Assign: Pending/Processing + NULL only; Done/Repeat rejected: `"Only unassigned Pending or Processing sessions can be assigned."` |
| B8 | Reassign: owned A→B only; Completed/Repeat rejected; NULL must use Assign |
| B9 | Waiting List always sends selected `branchId`; `BranchSwitcher` has no “All Branches”; Emma @ Banjara not visible under Downtown filter |

### FE Trace

```
Waiting List Repeat tab
  → Start Repeat CTA
  → resolveLifecycleOwnershipThenContinue(..., 'start-repeat')
  → resolveLifecycleOwnershipDecision({ canAssignToMe })
       current owner → continue (navigate ?lifecycle=start-repeat)
       !canAssignToMe → blocked toast (Finding B)
       NULL/other + counsellor → confirm → claimSessionForLifecycle
  → POST claim-for-lifecycle { intent: 'StartRepeat', expectedCounselorId, version }
  → session page Start Repeat → startSession (owner-only)
```

### API Trace

| Operation | Endpoint | Permission |
|---|---|---|
| Waiting list | `GET /api/Counseling/waiting-list` | `counseling_sessions.read` |
| Claim lifecycle | `POST .../sessions/{id}/claim-for-lifecycle` | `counseling_sessions.update` |
| Assign | `POST .../sessions/{id}/assign` | `counseling_sessions.update` |
| Reassign | `POST .../sessions/{id}/reassign` | `counseling_sessions.reassign` |

### Claim Trace

- Intents: `ReEvaluate` | `StartRepeat` only
- Target owner: always **actor** (no peer target)
- Counsellor eligibility: role `COUNSEL` / userType / designation containing `"counsel"`
- Admin with `.update` but without counsellor identity: **Forbidden**
- SurgeryDone: claim rejected
- StartRepeat requires not-agreed (Repeat Counselling)
- Branch: session branch must be in actor accessible set
- Version/409: existing optimistic concurrency applies on claim

### Assign Trace

- NULL → target counsellor only; already owned → 409
- Queue: Waiting | InProgress | Called only
- Done/Repeat: rejected (certified: use claim)
- Actor: counsellor **or** Admin with `.update` + branch
- Target must be assignable counsellor on session branch
- Admin self-assign: fails unless Admin independently matches counsellor heuristic
- FE Assign-to-me: counsellor only; Admin sees peer picker for eligible Pending/Processing

### Reassign Trace

- Owned A → B; reason + expectedCounselorId + version
- NULL rejected (use Assign)
- Completed/Repeat rejected (use lifecycle claim)
- SurgeryDone rejected
- Permission: `counseling_sessions.reassign`

### Permission Trace

| Code | Role in Finding B |
|---|---|
| `counseling_sessions.read` | See Waiting List / Repeat |
| `counseling_sessions.update` | Assign, Claim, Start — **insufficient alone for Claim** |
| `counseling_sessions.reassign` | General Reassign only |

Admin ≠ counsellor. Claim ≠ Reassign. Branch access ≠ ownership.

### Branch Scope Trace

| Question | Answer |
|---|---|
| Super Admin Downtown selected | WL API filtered to Downtown `branchId` |
| Emma Banjara Repeat rows visible? | **No** — outside selected branch |
| All Branches mode on Waiting List? | **Does not exist** |
| If API omits branchId | Server returns all **authorized** branches (not tenant-wide bypass) |
| FE normal path | Always sends selected branch when context resolved |

### Why "Only a counsellor..." Appears

1. Super Admin is not counsellor-identified → `canAssignToMe === false`.
2. Unassigned Repeat → ownership relation `unassigned` → decision path `blocked`.
3. Toast fires **before** any claim POST.
4. Even if FE called claim, BE would return 403 with counsellor-only message (slightly different wording).

### Emma Visibility Analysis

| Observation | Explanation |
|---|---|
| Emma works at Banjara Hills | Auth UAT docs: branch `9b2f6670-…` |
| Super Admin screenshot: Downtown | Selected branch scope |
| Four Downtown Repeat rows | Expected under single-branch filter |
| Emma not in list | **Branch scope**, not missing-record bug |
| Emma not in Downtown Assign picker | Counselors filtered by session/selected branch |

### Root Cause

1. **Start Repeat blocked for Admin:** Expected certified Claim-for-lifecycle counsellor-only rule (FE + BE).
2. **Emma not visible:** Expected Waiting List branch isolation; no All-Branches mode.

### Classification

**[EXPECTED CERTIFIED BEHAVIOR]** — Admin Start Repeat block  
**[EXPECTED CERTIFIED BEHAVIOR]** — Emma hidden under Downtown branch scope  

UAT expectation that Admin should Assign / Assign-to-self on Repeat is **not** a defect; it is a **new product request**.

### Product Decision Required

See **PD-B**.

### Proposed UX Boundary

**Hypothesis only (not approved):**

For **unassigned** Repeat Counselling:

1. Admin opens Assign Counsellor (peer picker of eligible counsellors for **session branch**).
2. Explicit Assign establishes ownership (requires **product approval** to extend Assign eligibility to Done/Repeat NULL, or a new supervisory lifecycle-assign that reuses ownership trail/Version — not silent claim-as-Admin).
3. Selected counsellor performs Start Repeat via existing claim/start path.

Do **not** allow: Admin clicks Start → `CounselorId = Admin` unless Admin independently is an eligible counsellor (existing heuristic already covers that identity case for claim).

For **owned** Repeat (e.g. Olivia): current model = owner starts; Admin must not silently start. Administrative handoff would need explicit reassignment path — currently Reassign is **forbidden** for Completed/Repeat → separate product decision if Admin must hand off owned Repeat.

### Implementation Boundary

**Do not** remove counsellor-only Claim restriction without PD-B.  
**Do not** use General Reassign as substitute for lifecycle claim.  
**Do not** bypass branch isolation for Emma visibility.  
**Do not** invent a second ownership writer.

---

## 4. Finding C — Subsequent / Second-Eye Surgery

### Current Behavior

Patient with one eye completed → counselling/OT reaches **SurgeryDone**. Same session:

- Waiting List CTA: **View** only
- Assign / Claim / Reassign / ReQueue: rejected (Slice 9 seal)
- `CounselorId` retained as historical attribution
- ReEvaluate / StartRepeat on that session: **not available**

No coded rule for “return in 15–20 days for other eye.”

### Existing Patient/Session Model

- One `PatientId` → many `counseling_sessions` (no unique constraint on patient)
- `CreateSessionAsync` inserts new row; no “existing session for patient” block
- `GET /Counseling/patients/{patientId}/sessions` returns history (page size 50)

### Repeat Counselling Model

| Attribute | Fact |
|---|---|
| Creates new session? | **No** — same `sessionId` |
| Mechanism | Claim `StartRepeat` → `StartSession` (Completed → InProgress) |
| Eligibility | Queue Completed + **not** agreed; **not** SurgeryDone |
| Intent | Resume non-agreement counselling episode |

**Repeat Counselling ≠ second-eye / new surgical episode.**

### Re-Evaluate Model

| Attribute | Fact |
|---|---|
| Creates new session? | **No** — same `sessionId` |
| Mechanism | Claim `ReEvaluate` → StartSession; clears agreement flags |
| Eligibility | Agreed Done; **not** SurgeryDone |

**ReEvaluate ≠ second-eye episode.**

### SurgeryDone Model

| Attribute | Fact |
|---|---|
| Transition | IP/OT sync → `OtFinalizeService.MarkSurgeryDoneAsync` sets OT status only |
| CounselingSession | Status/eye/procedures/`CounselorId` **not** cleared/mutated by MarkSurgeryDone |
| Ownership | Mutations sealed; historical `CounselorId` retained (PD-S9-07/19) |
| Reopen OT | Does not undo SurgeryDone for counselling lifecycle |

### Eye/Procedure Model

| Store | Field |
|---|---|
| Session | `SurgeryTentativeEye` (`RE` \| `LE` \| `BE`) |
| Session | `RecommendedProcedures` JSONB (per-eye entries) |
| OT | `ot_finalize_schedule.eye` |
| FE Add Patient | Required eye + surgery type/name |

Laterality is **session-scoped** (and OT-row-scoped), not patient-scoped.

Same-day single-eye OT guard excludes SurgeryDone/Cancelled — does not block ~15–20 days later.

### Multiple Session Analysis

| Question | Answer |
|---|---|
| Multiple sessions per patient? | **Yes** (supported) |
| New session after SurgeryDone? | **Yes** via Add Patient |
| FE duplicate guard blocks SurgeryDone? | **No** — only Pending / Processed / AddOnSurgery |
| OT active uniqueness | `ux_ot_finalize_patient_active` excludes SurgeryDone/Cancelled → new OT INSERT allowed after SurgeryDone |
| While prior episode still active Done (not SurgeryDone)? | FE allows Add Patient; OT upsert is **patient-scoped** and may UPDATE existing active row — **risk / product gap** |

### Ownership Analysis

New session `CreateSessionAsync`:

- Ignores client `CounselorId`
- If actor is assignable counsellor → owner = actor
- Else → `CounselorId = NULL` (Assign later)
- Does **not** inherit Olivia from Session A

### Duplicate Prevention Analysis

| Layer | Rule |
|---|---|
| FE | `findActiveWaitingListDuplicate` — active statuses only |
| BE Create | No patient uniqueness |
| OT DB | One active (non-Cancelled/non-SurgeryDone) OT row per patient |

### Root Cause / Blocking Point

There is **no code defect** blocking representation of second-eye as a new counselling session after SurgeryDone.

**Blocking points are product/UX honesty gaps:**

1. No explicit documented subsequent-surgery workflow (operators may incorrectly try Repeat / reopen SurgeryDone).
2. No UI warning that patient already has SurgeryDone / prior eye.
3. Concurrent active episodes before SurgeryDone are weakly guarded (OT patient-scoped upsert).
4. Ownership / SessionType for second-eye episode not product-certified.

### Classification

**[PRODUCT DECISION REQUIRED]**

Mechanically: **supported via new session** without schema change.  
Clinically/product: **not certified** as a named second-eye workflow.

### Product Decision Required

See **PD-C**.

### Proposed Workflow Boundary

**Audit hypothesis (not approved):**

```
Patient P
  ├── Session A — Eye A → … → SurgeryDone (historical, View-only)
  └── Session B — Eye B → Add Patient → new counselling → schedule → new OT row
```

Do **not** default to reopening SurgeryDone and changing eye on the same session.

### Implementation Boundary

No schema change required for the dual-session representation.  
Do not invent clinical timing rules.  
Do not collapse second-eye into Repeat Counselling without explicit product approval.  
Do not start Slice 10 under this finding.

---

## 5. Cross-Cutting Architecture Findings

| Layer | Authoritative source | Incorrect assumption to avoid |
|---|---|---|
| Tenant | JWT / login tenant | Tenant access ≠ all branch access |
| Network Hospital | Tenant presentation at login | Not the same as operational Branch |
| Branch | `user_branches` + primary `Users.BranchId`; WL selected branch | Login branch ≠ session branch; selected branch ≠ all authorized |
| User | Identity + roles + permissions | Admin ≠ counsellor |
| Counsellor eligibility | `IsAssignableCounsellorAsync` / FE `isCounsellorIdentity` | Permission alone ≠ claim authority |
| Ownership | `CounselingSession.CounselorId` writers: Create, Assign, Claim, Reassign, ReQueue | Owner ≠ actor always; Admin must not silently become owner |
| Session | `counseling_sessions` + queue status + OT overlay | SurgeryDone ≠ editable counselling session |
| Patient | MPI `PatientId` | Patient branch ≠ session branch automatically |
| Procedure / Eye | Session + OT fields | Repeat ≠ new surgical episode |
| OT master | `ot_theaters.branch_id` | OT ≠ branch-independent |
| Worklists | Waiting List, Repeat, Finalize, Post-Surgery, Follow-up Center | Do not invent Second Eye / Admin Counselling worklists without approval |
| History / Audit | Ownership trail + AuditLog on ownership writers; OT finalize audit separate | Reuse existing events; do not duplicate |
| Concurrency | `CounselingSession.Version` / 409 on ownership + session mutations | Any future Assign/Claim/lifecycle change must preserve Version |

### History / Audit (for future changes)

| Future change | Existing trail |
|---|---|
| Admin Assign on Repeat (if approved) | Reuse Assign ownership history/audit — do not invent parallel trail |
| New Session B for second eye | Create already writes ownership trail when counsellor creates |
| OT master seed/config | OT booking / theater admin audit if any; not counselling ownership trail |
| Claim StartRepeat | Existing claim ownership trail |

### Concurrency

Any mutation of `CounselorId`, lifecycle status, or session content must continue to honor `Version` / 409. Do not bypass for Admin convenience.

### Existing Worklists

| Need | Use existing |
|---|---|
| Unassigned / assigned counselling | Waiting List |
| Non-agreement resume | Repeat Counselling tab (same WL) |
| Post-OT shared ops | Finalize Surgery / Post-Surgery (no counsellor owner — Slice 9) |
| Second-eye new episode | Waiting List **Add Patient** (if PD-C confirms) — not a new worklist |

---

## 6. Product Decision Register

### PD-A — OT Availability

**Current finding:**  
Schedule Surgery shows no OTs for Emma at Banjara Hills with message “No operation theatres available for this branch.”

**Evidence:**  
`GET /Counseling/theaters` returns authorized-branch active theaters only; FE sends no branch/date; seeds historically Downtown/first-branch only; empty 200 drives the exact UAT string.

**Current certified behavior:**  
Counselling theaters lookup is branch-authorized master-data read, not slot availability.

**Decision required:**  
1. Is OT master mandatory for every branch that schedules surgery from counselling?  
2. Who configures OTs (ops vs engineering seed)?  
3. Should Schedule Surgery pass session/selected `branchId`?  
4. Should empty-state distinguish “none configured” vs “none for date/time” (latter does not apply today)?

**Options identified:**  
1. Configure/activate `ot_theaters` for each surgery-capable branch (ops/config) — no code.  
2. FE pass `branchId` + truthful empty copy (small UX honesty change).  
3. Auto-seed OTs on branch create (product + implementation; out of current audit).  

**Recommended option based on existing architecture:**  
**Option 1 first** (confirm with UAT SQL), then optional **Option 2** for honesty. Avoid inventing availability filtering on this endpoint without a separate scheduling product decision.

**Why:**  
Matches current SoT (`ot_theaters` per branch). Finding is empty master data for the counsellor’s branch set, not a broken date filter.

**Implementation scope if approved:**  
Ops configuration of theaters; optional FE `branchId` + copy; automated regression that Schedule Surgery uses `/Counseling/theaters`.

**Out of scope:**  
Changing Claim/Assign/ownership; OT booking redesign; seeding without ops approval; Slice 10.

---

### PD-B — Administrative Handling of Repeat Counselling

**Current finding:**  
Super Admin cannot Start Repeat on unassigned Repeat; toast blocks. Emma not visible under Downtown.

**Evidence:**  
FE `canAssignToMe` + BE `IsAssignableCounsellorAsync`; Assign/Reassign exclude Done/Repeat; WL single-branch filter; no All Branches.

**Current certified behavior:**  
Claim-for-lifecycle is counsellor-only; Admin does not silently become owner; Done/Repeat ownership via claim, not Assign/Reassign.

**Decision required:**  
1. For unassigned Repeat, may Admin **explicitly Assign** an eligible counsellor (peer), then counsellor Starts Repeat?  
2. If Admin is independently an eligible counsellor, is claim-as-self already sufficient (yes today)?  
3. For owned Repeat, may Admin force handoff (today Reassign forbidden)?  
4. Is All-Branches Waiting List required for Super Admin?

**Options identified:**  
1. **Preserve certified behavior** — Admin uses Pending Assign only; Repeat claim remains counsellor-only; switch branch to see Emma.  
2. **Extend Assign** to Done/Repeat **NULL only** (Admin/counsellor with `.update`), then counsellor claims/starts — reuse Assign trail; do not auto-start as Admin.  
3. **New supervisory lifecycle-assign endpoint** — only if Option 2 conflicts too hard with certified Assign eligibility comments.  
4. **All-Branches WL** — separate access/product decision; must not bypass branch authorization on mutations.

**Recommended option based on existing architecture:**  
**Option 2** if product wants Admin handling of unassigned Repeat — smallest reuse of Assign + ownership history + Version, without silent Admin ownership. Keep Claim counsellor-only. Treat All-Branches and owned-Repeat handoff as separate PDs.

**Why:**  
Preserves “Admin ≠ silent owner,” reuses existing Assign writer, avoids duplicate claim path. Matches proposed UAT UX (“Assign Counsellor” then counsellor starts).

**Implementation scope if approved:**  
BE Assign eligibility extension for Completed+not-agreed+NULL (+ SurgeryDone still rejected); FE Assign CTA on unassigned Repeat for Admin; tests for Version/history/branch; UAT.  

**Out of scope:**  
Removing counsellor-only Claim; Admin silent Start ownership; Reassign for Repeat without separate PD; All-Branches unless separately approved; Slice 10.

---

### PD-C — Subsequent / Second-Eye Surgery

**Current finding:**  
After one-eye SurgeryDone, unclear path for other-eye surgery ~15–20 days later.

**Evidence:**  
SurgeryDone seals same-session lifecycle; Repeat/ReEvaluate reuse same session and reject SurgeryDone; Add Patient creates new session with eye; OT unique index allows new row after SurgeryDone; ownership does not inherit.

**Current certified behavior:**  
SurgeryDone is historical; ownership sealed; Repeat = non-agreement resume; ReEvaluate = agreed Done reopen.

**Decision required:**  
1. Confirm **new CounselingSession** as the subsequent/second-eye model?  
2. Default `SessionType` (Initial vs Follow-up)?  
3. Warn/block Add Patient when prior SurgeryDone or concurrent active Done exists?  
4. Ownership: self-own on counsellor create vs always unassigned vs inherit prior counsellor?  
5. Tighten OT uniqueness to session/eye if concurrent episodes must be safe?  
6. Any clinical wait-period rule? (none in code today)

**Options identified:**  
1. Document + UAT the existing Add Patient path as subsequent surgery (minimal/no code).  
2. UX: prior-surgery awareness on Add Patient / patient history (small).  
3. Concurrent-episode guard (FE and/or OT upsert session/eye awareness) — larger, needs PD.  
4. Reopen SurgeryDone / change eye on same session — **not recommended**; conflicts with Slice 9 seal.

**Recommended option based on existing architecture:**  
**Option 1 + optional Option 2.** Treat second-eye as new session. Do not use Repeat Counselling. Do not reopen SurgeryDone. Ownership: keep current Create rules unless product explicitly wants inherit.

**Why:**  
Schema already supports Session A + Session B; preserves SurgeryDone historical integrity; avoids inventing clinical fields.

**Implementation scope if approved:**  
Docs/UAT script; optional prior-episode warning UI; tests that SurgeryDone does not block new session create; optional concurrent Done guard if PD requires.

**Out of scope:**  
Schema for “episode id” unless later proven necessary; collapsing into Repeat; Slice 10 Follow-up honesty; inventing 15–20 day clinical rule in code.

---

## 7. Recommended Implementation Order

Do **not** call these Phase 3I Slice 10+.

1. **Prerequisite / configuration investigation (Finding A)**  
   - Run UAT SQL: count active `ot_theaters` per branch (especially Banjara vs Downtown).  
   - Confirm Emma’s authorized branches and `GET /Counseling/theaters` as Emma → `[]` vs Downtown counsellor → non-empty.  
   - Ops configure OTs if missing (no code).

2. **Product decisions**  
   - Approve/reject PD-A / PD-B / PD-C explicitly before any implementation.

3. **Smallest safe implementation (only after approvals)**  
   - A: config (+ optional branchId/copy).  
   - B: Assign eligibility for unassigned Repeat only (if Option 2).  
   - C: documentation/UAT (+ optional Add Patient prior-surgery awareness).

4. **Required automated tests (when implementing)**  
   - A: theaters contract; empty vs 403 messages.  
   - B: Assign Reject/Allow matrix for Repeat NULL; Claim remains counsellor-only; Admin cannot silent-own via Start.  
   - C: Create second session after SurgeryDone; Claim/ReEvaluate still reject SurgeryDone; duplicate guard ignores SurgeryDone.

5. **Required manual UAT**  
   - A: Emma Schedule Surgery after OT config.  
   - B: Super Admin Assign counsellor on unassigned Repeat → counsellor Start Repeat; owned Repeat behavior; branch switch sees Emma.  
   - C: Saraswati-style patient Add Patient other eye → new session → schedule → OT insert; historical Session A remains SurgeryDone/View.

Do not begin implementation in this task.

---

## 8. Files Inspected

| Path | Purpose | Relevant method/component | Finding |
|---|---|---|---|
| `apps/.../ScheduleSurgeryModal.tsx` | Schedule Surgery UI | theaters `useEffect`; empty placeholder | A |
| `apps/.../counsellors-desk.api.ts` | API client | `getOtTheaters`, waiting list, claim | A, B, C |
| `apps/.../schedule-surgery-lookups.ts` | Lookup error copy | 403/401 mapping | A |
| `apps/.../FinalizeOtModal.tsx` | Finalize OT theaters | same `getOtTheaters()` | A |
| `microservices/.../CounselingController.cs` | Counseling API | `GetTheaters`, waiting list, claim/assign routes | A, B, C |
| `microservices/.../FollowupBranchAccessService.cs` | Branch auth | `ResolveAccessibleBranchesAsync` | A, B |
| `microservices/.../Models/.../OTBookingSystem.cs` | OTTheater entity | `ot_theaters` mapping | A |
| `database_migrations/schema/module03_05_ot_booking_system.sql` | OT schema + seed | first branch only | A |
| `archive/sql/seed-old/seed_counselor_module.sql` | Downtown OT seed | branch `74c014cf-…` | A |
| `apps/.../waiting-list/page.tsx` | Waiting List | branch filter; Start Repeat toast | B |
| `apps/.../counselling-ownership.ts` | Lifecycle ownership decision | `blocked` / `claim` / `continue` | B |
| `apps/.../counselling-auth.ts` | Assign/claim FE capability | `canShowCounsellingAssignToMe` | B |
| `apps/.../waiting-list-lifecycle-action.ts` | Primary CTA | Start Repeat / View | B, C |
| `microservices/.../CounselingWorkflowService.cs` | Ownership writers | Assign, Claim, Reassign, ReQueue, Create, `IsAssignableCounsellorAsync` | B, C |
| `apps/.../BranchSwitcher.tsx` | Branch UI | no All Branches | B |
| `apps/.../add-patient-to-waiting-list.ts` | Create payload + duplicate guard | `ACTIVE_WAITING_LIST_STATUSES` | C |
| `apps/.../AddPatientModal.tsx` | Returning patient entry | eye + session create | C |
| `microservices/.../OtFinalizeService.cs` | SurgeryDone / upsert / eye guard | MarkSurgeryDone; unique active patient | C |
| `database_migrations/schema/OT_FINALIZE_SCHEDULE_MIGRATION.sql` | OT unique index | `ux_ot_finalize_patient_active` | C |
| `docs/audits/...-slice9-implementation-report.md` | Slice 9 SoT | SurgeryDone ownership seal | C |
| `docs/audits/authentication-network-hospital-branch-login-fix-report.md` | Emma/Banjara ids | branch GUIDs | A, B |

---

## 9. Tests Inspected

| Test | Establishes |
|---|---|
| `CounselingTheatersLookupContractTests.cs` | GetTheaters on CounselingController; `counseling_sessions.read`; optional branchId; not `ot.theaters.view` |
| `FollowupBranchAccessServiceTheatersTests.cs` | Branch access resolution for theaters |
| `counsellors-desk-theaters-lookup.test.ts` / `schedule-surgery-lookups.test.ts` | FE theaters client + error classification |
| `counselling-ownership.test.ts` | `canAssignToMe: false` → `blocked` / `not-counsellor` |
| `waiting-list-lifecycle-claim.contract.test.ts` | Waiting List uses lifecycle ownership decision |
| `counselling-initial-assign-capability.test.ts` | Assign-to-me counsellor-only; Admin initial assign capability |
| `Phase3ISlice3AssignContractTests.cs` | Assign contracts |
| `Phase3ISlice6Reassign*.cs` | Reassign permission/contracts; Completed/Repeat exclusion certified in service |
| `Phase3ISlice9FinalizeOwnershipBoundaryTests.cs` | SurgeryDone Assign reject; CounselorId retention; Finalize non-ownership |
| `Phase3ISlice9ContractTests.cs` | Slice 9 contract guards |
| `Phase3ISlice7OptimisticConcurrencyTests.cs` | Version/409 on ownership mutations |
| `add-patient-to-waiting-list.test.ts` | Duplicate guard ignores Done / RepeatCounselling / SurgeryDone |

---

## 10. No-Code-Change Confirmation

Audit complete. No code, schema, permissions, configuration, or workflow
changes were made.

### Safety checklist

- [x] No source code changed  
- [x] No migrations created  
- [x] No SQL changed (read/inspect only)  
- [x] No permissions changed  
- [x] No roles changed  
- [x] No API contracts changed  
- [x] No UI changed  
- [x] No database data changed  
- [x] No seed/configuration changed  
- [x] Slice 8 preserved  
- [x] Slice 9 preserved  
- [x] Slice 10 NOT started  
- [x] No new business/clinical/financial rule invented  
- [x] No branch isolation bypass proposed as implementation  
- [x] Existing worklists treated as authoritative  
- [x] Product decisions separated from facts  
- [x] Exact implementation evidence provided  
- [x] Automated tests inspected only  
- [x] Manual UAT remains the gate after any future implementation  

---

## Appendix — Required checklist answers (A1–A14, B1–B20, C1–C18)

### Finding A checklist

| # | Answer |
|---|---|
| A1 | `ScheduleSurgeryModal` via counselling session Schedule Surgery |
| A2 | `GET /api/Counseling/theaters` |
| A3 | Controller EF on `OTTheaters` + `FollowupBranchAccessService` (no separate availability service) |
| A4 | `ot_theaters` / `OTTheater` |
| A5 | Server authorized branches; FE currently sends none |
| A6 | Caller tenant from auth context |
| A7 | `ot_theaters` master per `branch_id` |
| A8 | Tenant + active + not deleted + branch ∈ accessible |
| A9 | `counseling_sessions.read`; unauthorized branchId → 403 |
| A10 | Seeds: Downtown/first-branch; Banjara not in historical counselor OT seed — **confirm live UAT with SQL** |
| A11 | Any branch without active OT rows will show the same empty state for users whose authorized set has no OTs |
| A12 | Configuration/data (+ UX truthfulness secondary) |
| A13 | PD-A |
| A14 | Configure OTs for surgery branches; optional FE branchId + copy |

### Finding B checklist

| # | Answer |
|---|---|
| B1 | `/dashboard/counsellors-desk/waiting-list` |
| B2 | Start Repeat → lifecycle ownership decision → claim or blocked toast |
| B3 | `POST .../claim-for-lifecycle` intent `StartRepeat` |
| B4 | `.update` + counsellor eligibility + branch + Version |
| B5 | `.update` + Pending/Processing NULL + target counsellor + branch |
| B6 | `.reassign` + owned A→B; not Done/Repeat |
| B7 | Selected branch always on WL FE; server authorized set |
| B8 | Role/userType/designation counsel heuristics |
| B9 | Admin: can Assign Pending NULL; cannot Claim Repeat; cannot Assign Done/Repeat |
| B10 | Super Admin: same as Admin for claim; toast blocks Start Repeat |
| B11 | Counsellor: can claim unassigned/other-owner Repeat per rules; owner continues |
| B12 | FE `!canAssignToMe` → blocked toast |
| B13 | **Yes** — certified |
| B14 | Different branch (Banjara vs Downtown) |
| B15 | **Yes** |
| B16 | **No** All Branches on Waiting List |
| B17 | Existing Assign **cannot** today (Done/Repeat rejected) — can if PD extends eligibility |
| B18 | New endpoint **not** necessary if Assign extended carefully; otherwise optional supervisory assign |
| B19 | PD-B |
| B20 | Assign Counsellor → counsellor Start Repeat; no silent Admin owner |

### Finding C checklist

| # | Answer |
|---|---|
| C1 | Scheduled/InProgress/Completed/Cancelled/NoShow + OT SurgeryDone overlay |
| C2 | 1 patient : N sessions |
| C3 | `SurgeryTentativeEye` / OT `eye` RE\|LE\|BE |
| C4 | Recommended surgery/procedures + session category |
| C5 | Same session claim StartRepeat (not-agreed); not SurgeryDone |
| C6 | Same session claim ReEvaluate (agreed Done); not SurgeryDone |
| C7 | OT status SurgeryDone; ownership sealed; CounselorId retained |
| C8 | **Yes** — Add Patient / CreateSession |
| C9 | **Yes** |
| C10 | Multiple sessions yes; concurrent **active** Done+schedule weakly guarded — PD |
| C11 | FE active WL statuses; OT active patient unique index |
| C12 | Create: counsellor self-own or NULL; no inherit |
| C13 | Add Patient on Waiting List; SurgeryDone View-only |
| C14 | **Yes**, via new session + eye — if operators use that path |
| C15 | Product/UX clarity; not schema |
| C16 | **Not required** for dual-session model |
| C17 | PD-C |
| C18 | New Session B for other eye; keep Session A SurgeryDone historical |
