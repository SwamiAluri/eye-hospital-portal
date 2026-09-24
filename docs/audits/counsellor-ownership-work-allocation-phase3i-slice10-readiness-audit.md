# Phase 3I Slice 10 — Follow-up Ownership / Lifecycle Honesty  
# READINESS AUDIT (POST–SLICE 9)

**Date:** 2026-09-20  
**Mode:** AUDIT ONLY — no code, schema, permission, ownership, or UI changes  
**Slice 10 status:** NOT started  
**Prior certified gate:** Slices 1–9 complete; Finalize Surgery UAT confirmed good  

**Do not implement Slice 10 from this document.**  
**Wait for explicit product decisions before implementation.**

---

## 1. Executive Summary

Counsellor **Follow-up Center** is **not** a separate Follow-up aggregate. Active and Cold worklists are **branch-scoped projections of the same `CounselingSession` rows**, filtered by `PatientIntention` allowlists. Post-Surgery is a **separate discharged `patient_journey` projection** with **no `CounselorId`**.

**Current ownership model (evidence):**

| Population | Queue type | Owner field | ACL for Center list/actions |
|------------|------------|-------------|-----------------------------|
| Active | Shared branch operational queue | Session `CounselorId` (displayed as “Owner”) | **No** owner filter; **no** original-owner ACL on Center mutations that use comm-log / ReQueue paths |
| Cold | Shared branch operational queue | Same | Same |
| Post-Surgery | Shared branch operational queue | **ABSENT** | N/A |

Finish/Complete **does not create** a Follow-up row and **does not clear** `CounselorId`. Active/Cold membership is **intention-driven**, not finish-driven. Session `CounselorId` therefore **continues** on Completed sessions that remain in Active/Cold by intention — displayed as Owner, but **not** used as Follow-up Center list ACL.

Documented working product rule **PD-FOLLOWUP-01** (Phase 3H; status WORKING / not formally signed) already states: branch-shared Center; no “My Follow-ups”; original `CounselorId` is not Center ACL. Slice 10 scope in the Phase 3I readiness audit is **label honesty + actor attribution confirmation**, not a redesign of ownership SoT.

**Verdict:** **READY FOR PRODUCT DECISION** — architecture and behavior are sufficiently mapped; remaining items are product/sign-off choices, not missing discovery.

---

## 2. Architecture

### 2.1 Authoritative sources of Follow-up work items

| Tab | Authoritative SoT | How membership is determined |
|-----|-------------------|------------------------------|
| **Active** | `counseling_sessions` (`CounselingSession`) | `PatientIntention` ∈ Active allowlist; tenant; authorized branches; not soft-deleted |
| **Cold** | Same | `PatientIntention` ∈ `{Declined, ReferredElsewhere}` |
| **Post-Surgery** | `patient_journey` (discharged) + discharge summary / pending visits | Discharged journeys in authorized branches; **no** session join for ownership |

**There is no `FollowUps` table for Counsellor Center.** Handoff from counselling is **implicit projection**, not an insert.

### 2.2 Frontend entry points

| Role | Path |
|------|------|
| Canonical Follow-up Center | `/dashboard/counsellors-desk/surgery-followup` |
| Open session from Center | `/dashboard/counsellors-desk/{sessionId}?from=follow-up` |
| Close origin return | `counselling-session-origin.ts` → surgery-followup |
| Analytics drill to Center | `buildFollowupCenterHref()` → same path (unscoped) |
| **Unrelated** mock | `/dashboard/follow-ups` (local mock; not Counsellor Center) |

Sidebar: Counsellor → Follow-up Center (`counseling_sessions.read`).

### 2.3 Backend entry points

| Endpoint | Permission | Service |
|----------|------------|---------|
| `GET /Counseling/followups/active` | `counseling_sessions.read` | `FollowupListService` |
| `GET /Counseling/followups/cold-leads` | `counseling_sessions.read` | same |
| `GET /Counseling/followups/post-surgery` | `counseling_sessions.read` | same |
| `GET /Counseling/followups/stats` | `counseling_sessions.read` | same |
| `POST …/sessions/{id}/communication-logs` | `counseling_sessions.update` | `CounselorCommunicationService` |
| `POST …/sessions/{id}/callbacks` | `counseling_sessions.update` | same |
| `POST …/patients/{id}/reminders` | `counseling_sessions.update` | reminders path |
| `POST …/sessions/{id}/re-queue` | `counseling_sessions.update` | `CounselingWorkflowService.ReQueueSessionAsync` |

Branch resolution for Center lists: `FollowupBranchAccessService` (PD16-style authorized branch set).

### 2.4 Domain split (do not conflate)

| Domain | SoT | Slice 10? |
|--------|-----|-----------|
| **A. Counsellor Follow-up Center** | Session intention projection + post-discharge journey | **Yes** |
| B. Clinical `follow_up_appointments` | `FollowUpsController` / doctor appointments | No |
| C. Legacy counselling-service FollowUpDate/Reason | Separate service | No |
| D. IP `pre_op_follow_up_tasks` | IP management | No |

### 2.5 Data flow (existing)

```
Counselling session (CounselorId set via Assign / claim-for-lifecycle / create self-own)
        │
        ├─ UpdateSession → PatientIntention writable normalize
        │
        ├─ CompleteSession → Status=Completed; CounselorId UNCHANGED; no Follow-up insert
        │
        ▼
GET followups/active|cold-leads
        │  filter: Tenant + Branch ACL + Intention allowlist
        │  project: CounselorId / CounselorName as Owner labels
        │
        ├─ Open session (from=follow-up) → session Owner ACL on Update/Complete/Start-like mutates
        ├─ Log contact / callback / reminder → Version CAS; actor on log; NO DenyUnlessSessionOwner
        └─ ReQueue → Version + expectedCounselorId CAS; clears CounselorId → NULL; branch ACL; NO owner ACL
```

Post-Surgery branch is parallel (journey discharge), not this finish path.

---

## 3. Ownership Model

### Exact current behavior (evidence answers)

| # | Question | Answer | Evidence |
|---|----------|--------|----------|
| 1 | Does Follow-up have `CounselorId`? | **Active/Cold: yes** (session field). **Post-Surgery: no.** | `CounselingSession.CounselorId`; `PostSurgeryFollowupItemDto` has no counselor fields; list forces `SessionId = null` |
| 2 | Where populated? | On **session** create/Assign/claim/reassign — **not** by Follow-up APIs | `CounselingWorkflowService` ownership ops |
| 3 | Inherited from CounselingSession? | Active/Cold **are** the session; no copy step. Finish does not re-stamp owner | `CompleteSessionAsync` does not touch `CounselorId` |
| 4 | Can opening/viewing establish ownership? | **No** (Phase 3I: Start no longer stamps; open is navigation) | Center “Open session” only navigates; Slice 1–4 ownership rules |
| 5 | Can starting/working establish ownership? | **Session Start** does not stamp (certified). **Center contact/reminder** do not set session `CounselorId`. Session Update/Complete require owner | Comm log writes actor on **log**, not session owner |
| 6 | Explicit Assign? | **Session** `/assign` exists; **no** Follow-up-specific Assign UI/API on Center | Waiting List / session APIs; Center page has no Assign |
| 7 | Claim? | **Session** `claim-for-lifecycle` only (ReEvaluate / StartRepeat); **not** on Center | Slice 3/4 scope |
| 8 | Reassign? | **Session** `/reassign` (`counseling_sessions.reassign`); **not** on Center | Same |
| 9 | Optimistic concurrency? | Session `Version` + 409 on ReQueue, comm logs, session mutates; lists are read-only | Slice 7/8; `AddCommLogAsync` Version required |
| 10 | Ownership History/Audit? | Session ownership events (`OwnershipAssigned`, `OwnershipRequeued`, etc.); **no** Follow-up-specific ownership table | Slice 5/8 trails |
| 11 | Can ownership become stale? | **Yes** — Completed sessions can remain Active by intention with historical `CounselorId`; unavailable counsellor not auto-cleared | Complete retains owner; Slice 12 scoped separately for leave/unavailable |
| 12 | Unavailable counsellor remain owner? | **Yes** today — no auto-clear on Follow-up membership | No Follow-up leave engine; Slice 12 deferred |
| 13 | Can follow-up item be reassigned? | Via **session** Reassign/Assign (eligibility rules), or ReQueue → NULL then Assign; **not** via Center-native Reassign UX | Center exposes ReQueue only |
| 14 | What when counselling finishes? | Status → Completed; intention unchanged; **no Follow-up create**; `CounselorId` retained; may still appear in Active/Cold if intention matches | `CompleteSessionAsync` + `FollowupQueryContracts` |

### Classification (evidence, not prescription)

Follow-up Center is a **hybrid presentation**:

- **Shared operational queue** for list visibility and Center-side contact/ReQueue (branch + permission).
- **Inherited session ownership field** displayed as “Owner” and still enforced on **session content mutations** after Open.
- **Independent of counselling ownership as Center ACL** (no counselor list filter; comm log / ReQueue without `DenyUnlessSessionOwner`).

---

## 4. Lifecycle State Machine

### 4.1 Follow-up Center membership (not a dedicated Follow-up status enum)

**Active intentions (authoritative allowlist):**  
`WillingWeek`, `WillingMonth`, `WillingQuarter`, `WillingCallToConfirm`, `Undecided`, `WaitingFinancial`, `WaitingFear`

**Cold:** `Declined`, `ReferredElsewhere`

**Orphan (not Active/Cold; audit counts only):**  
`WillingNow`, `WillingTwoWeeks`, `WillingSixMonths`, `SecondOpinion`

**Certified non-exits (Phase2X Slice 2 regression):** open/contact/reminder/callback/agreed/booked/OT-adjacent/clinical SurgeryCompleted do **not** exit Active by those signals alone. Soft-delete exits. Active EXIT via clinical surgery-completion remains **product SoT blocked** (Phase2X lifecycle blockers) — adjacent to Slice 10 but not ownership honesty.

### 4.2 Session status (shared counselling)

| Status | Role relative to Follow-up |
|--------|----------------------------|
| Scheduled / InProgress / Completed / Cancelled / NoShow | Session workflow; Active membership ignores Status in favor of intention + deleted null |
| EscalationStatus | `Normal` / `Overdue` / `Escalated` / `SupervisorAlert` / `Closed` — residual; Center UI deliberately omits priority chrome (Phase2Y) |

### 4.3 Transitions from Follow-up Center (FE-initiated)

| Action | Endpoint | Authz | Ownership mutation | Branch | Tenant |
|--------|----------|-------|--------------------|--------|--------|
| View lists | GET followups/* | `.read` + branch ACL | None | Authorized set | Session/journey tenant |
| Open session | Navigation | Page `.read` | None | — | — |
| Log contact | POST communication-logs | `.update` + Version | **None** on session owner; actor on log | Session branch (implicit via session) | Required |
| Schedule callback | POST callbacks | `.update` | None on session owner | — | Required |
| Send reminder | POST reminders | `.update` | None on session owner | — | Required |
| ReQueue | POST re-queue | `.update` + branch ACL + Version + expectedCounselorId | **Clears `CounselorId` → NULL**; `OwnershipRequeued` | Actor must access session branch | Required |
| Session Update/Complete after open | Session APIs | `.update` + **DenyUnlessSessionOwner** + Version | Owner-gated; Complete does not clear owner | Session branch rules | Required |

### 4.4 Counselling → Follow-up handoff

**There is no Finish → create Follow-up API.**  
Handoff = intention already (or later) in allowlist → appears in list.

---

## 5. Authorization Model

### Permissions

| Surface | Permission |
|---------|------------|
| Center page / lists / stats | `counseling_sessions.read` |
| Contact / Reminder / ReQueue (Center) | `counseling_sessions.update` |
| Session Reassign (not on Center) | `counseling_sessions.reassign` |
| Clinical FollowUps module (separate) | `followup.read\|create\|update\|delete` |

### Branch / tenant

- Center lists: tenant filter + `FollowupBranchAccessService` authorized branches; unauthorized requested branch → 403-shaped failure.
- ReQueue: same branch access check on actor vs session branch.
- Overdue query path historically weaker than Center (optional raw branchId) — adjacent honesty note; not Slice 10 core Active/Cold labels.

### Ownership ACL vs Phase 3I counselling model

| Mechanism | Waiting List / Active counselling | Follow-up Center |
|-----------|-----------------------------------|------------------|
| Explicit Assign | Yes | No Center UI; session API may still apply if eligible |
| Owner ACL (`DenyUnlessSessionOwner`) | Update / Complete / Start-like | **Not** on Center list; **Not** on AddCommLog; **Not** on ReQueue |
| ReQueue → NULL | Yes | Invoked from Center; clears session owner |
| Version / 409 | Yes | Comm log + ReQueue |
| Ownership History | Session trail | Same trail; no Follow-up-specific trail |
| CounselorId list filter | Session list can filter | **ABSENT** on Follow-up lists |

Aligned with documented **PD-FOLLOWUP-01** (working): Center is branch-shared; original `CounselorId` is not Center ACL.

---

## 6. Cross-Module Ownership Boundaries

| Surface | Role | Ownership begins / ends |
|---------|------|-------------------------|
| **Waiting List** | Shared/unassigned + owned active counselling intake | Explicit Assign / claim establishes `CounselorId`; Reassign; ReQueue returns here |
| **Counselling Session** | Owned active clinical/counselling work | Owner ACL on content mutates; Complete retains `CounselorId` |
| **Follow-up Center Active/Cold** | Shared operational follow-up worklist over same sessions | Display historical/current session owner; act without owning; ReQueue clears owner |
| **Follow-up Center Post-Surgery** | Shared downstream post-discharge queue | **No** counselling owner; Slice 9: no CounselorId on DTO; assign SoT = PD-POST-01 (separate) |
| **Finalize Surgery** | Downstream OT finalize; must not rewrite counselling `CounselorId` | Slice 9 boundary certified |
| **Patient Details (WL sheet)** | Shows follow-up date/reason + owner for WL rows | Presentation; not Center SoT |
| **Analytics** | PendingDecision aging ≠ Center Active; can filter by counselorId | Drill to Center is unscoped path; Slice 11 for “My Work” |

**Boundary summary:**

- **Shared operational queue:** Follow-up Center lists (Active/Cold/Post).
- **Owned active work:** Counselling session content mutations while `CounselorId` set.
- **Historical records:** Retained `CounselorId` after Complete; ownership audit trail; Owner label on Center.
- **Downstream workflow:** Finalize / Post-Surgery / OT — not Active/Cold ownership.

---

## 7. Lifecycle Honesty Findings

Concrete mismatches only (not product judgments):

1. **UI label “Owner” on Active/Cold**  
   Backend stores session `CounselorId` and projects name, but Center lists are **not** owner-filtered and Center contact/ReQueue are **not** owner-ACL’d. Label reads like personal ownership; access model is shared.

2. **“Owner: Unassigned / Unresolved”**  
   Accurate for null/unresolved name, but still implies ownership semantics for a shared queue.

3. **Post-Surgery has no Owner line; Active/Cold do**  
   Asymmetric honesty across tabs of the same Center (consistent with Slice 9 Post-Surgery having no owner field).

4. **Open session from Center then mutate**  
   Non-owner can open any listed row; session Update/Complete then enforce owner ACL → possible open-then-read-only / forbidden mutate experience. Contact from Center bypasses that ACL.

5. **Actor attribution vs session owner**  
   Comm log records acting `CounselorId`; session `CounselorId` may remain a different counsellor. UI Owner line does not distinguish “session owner” vs “last actor.”

6. **Complete retains owner while session remains in Active**  
   Finished counselling can still appear under Follow-up with Owner = original counsellor without a Follow-up-specific ownership event.

7. **Phase 2W PD7 working A vs PD-FOLLOWUP-01**  
   Earlier workshop framing (CounselorId = follow-up owner for see/act) was **superseded for Center ACL** by PD-FOLLOWUP-01. Code matches shared Center; residual risk if stakeholders still expect PD7-A personal ownership.

8. **Contract doc lag**  
   Older Phase2B contract snippets omit `counselorId`/`counselorName`; FE types + UI display Owner (Phase2X PD7 projection).

9. **Orphan route `/dashboard/follow-ups`**  
   Mock clinical follow-ups; naming collision with Counsellor Follow-up Center.

10. **Analytics “Follow-up aging / workload” naming**  
    Aging is PendingDecision backlog (disclaimer present); Center link labeled “Follow-up workload” without carrying counselor filter — naming overlap, not Center ACL bug.

11. **No “Assigned to me” / “My Follow-ups” on Center**  
    **ABSENT** in UI (good alignment with PD-FOLLOWUP-01). Not a mismatch — recorded to avoid inventing one.

---

## 8. Existing Test Coverage

### Already certified (relevant)

| Area | Key suites | Confidence |
|------|------------|------------|
| Active/Cold/Post populations, search, pagination, stats parity | `FollowupListServiceTests`, `FollowupQueryContractsTests` | High |
| Branch PD16 + tenant isolation for Center | `Phase2XFollowupSlice1Tests`, branch contract tests | High |
| `CounselorId` **projection** on Active; ownership does not change membership | `Phase2XFollowupSlice1Tests` Ownership_* | High |
| Lifecycle: contact/book/OT signals do not exit Active | `Phase2XSlice2LifecycleRegressionTests` | High |
| No due/priority heuristics in Center | `Phase2YFollowupHonestyTests`, FE `followup-presentation.test.ts` | High |
| Post-Surgery no CounselorId; Finalize does not mutate counselling owner | Slice 9 tests | High |
| ReQueue clears ownership; Completed follow-up can ReQueue | `Phase3ISlice8RequeueOwnershipTests` | High |
| FE Center shell / ReQueue from Center / ContactLog Version | `surgery-followup/page.test.tsx`, `requeue-slice8.test.tsx`, `ContactLogModal.test.tsx` | High |
| E2E smoke Center + Analytics shells | `counsellor-followup-analytics-phase1.spec.ts` | Medium (not ownership ACL) |

### Not certified as Slice 10

- No `Phase3ISlice10*` tests.
- No automated assertion that UI must say “original counselling owner” (vs “Owner”).
- No dedicated test that non-original counsellor **must** be allowed to contact from Center (behavior exists via missing owner check; not labeled Slice 10 acceptance).
- No “My Follow-ups filter must remain absent” UI regression suite tagged Slice 10.

### Docs status

- Slice 10 defined in `phase3i-implementation-readiness-audit.md` § Slice 10.
- UAT gate / Slice 9 reports: **Slice 10 NOT started**.
- **PD-FOLLOWUP-01**: WORKING — AGREED FOR IMPLEMENTATION WORKFLOW / **NOT FORMALLY SIGNED**.

---

## 9. Product Decisions Required

Labeling convention:

- **EXISTING CERTIFIED RULE** — implemented and covered by prior slices/tests or explicit Phase 3I behavior already shipped.
- **PRODUCT DECISION REQUIRED** — not formally closed for Slice 10 implementation, or working-only / unsigned.

### EXISTING CERTIFIED RULE (do not re-decide as if unknown)

| ID / topic | Rule |
|------------|------|
| SoT | Active/Cold = `CounselingSession` intention projection; no FollowUps table for Center |
| List scope | Tenant + authorized branch; **no** CounselorId filter on Center lists |
| Finish | Complete does not create Follow-up; does not clear `CounselorId` |
| ReQueue | Clears `CounselorId` → NULL; Version + expectedCounselorId; from Center allowed under `.update` + branch |
| Session owner ACL | Update/Complete still `DenyUnlessSessionOwner` |
| Comm log | Version required; actor on log; **no** session-owner deny in `AddCommLogAsync` |
| Post-Surgery | No `CounselorId` on DTO; SessionId null (Slice 9) |
| Priority/due chrome | Phase2Y: Center must not invent due/priority KPIs |
| Assign/Claim/Reassign UX | Live on Waiting List / session APIs — not on Follow-up Center today |

### PRODUCT DECISION REQUIRED (for Slice 10)

| ID | Decision | Why unsupported as formally closed |
|----|----------|-------------------------------------|
| **PD-S10-01** | Formal sign-off of **PD-FOLLOWUP-01** (branch-shared; no My Follow-ups; original CounselorId not Center ACL) | Documented WORKING / not formally signed |
| **PD-S10-02** | Exact UI terminology for Active/Cold `CounselorId` (e.g. “Owner” vs “Original counselling owner” vs “Last counselling owner” vs hide) | Slice 10 scope says relabel; current UI still says `Owner:` |
| **PD-S10-03** | Whether Center must show actor attribution inline (contact/reminder/requeue) beyond existing History/comm-log SoT | Slice 10 scope lists actor attribution; placement/depth not certified |
| **PD-S10-04** | Whether Open-session-then-owner-lock is acceptable UX for shared Center, or Center should warn / restrict open | Observed honesty gap; no certified UX rule |
| **PD-S10-05** | Whether session Assign/Reassign should be reachable from Center for Active/Cold (or remain Waiting-List-only) | No Center ownership mutation UX today; product may or may not want it |
| **PD-S10-06** | When (if ever) Active/Cold should clear or freeze displayed ownership after Complete / after ReQueue / after leave | Stale owner possible; Slice 12 leave separate; Active EXIT clinical SoT still blocked (Phase2X) |
| **PD-S10-07** | Confirm Post-Surgery remains **out of Slice 10** (PD-POST-01 / Slice 9) vs any label work | Docs say Active/Cold honesty = Slice 10; reconfirm to avoid scope bleed |
| **PD-S10-08** | Confirm Slice 10 is **honesty/labels/attribution only** — not introduction of My Follow-ups, owner ACL, or new FollowUps entity | Readiness audit scope; still needs explicit go/no-go before coding |

**Not Slice 10 product decisions (explicitly defer):**

- Active EXIT on clinical SurgeryCompleted (Phase2X lifecycle blockers).
- Slice 11 Analytics My Work.
- Slice 12 Leave / Reassignment Required auto-surface.
- Post-Surgery explicit assign SoT implementation (PD-POST-01) if not already closed in Slice 9 product track.

---

## 10. Slice 10 Readiness

### **READY FOR PRODUCT DECISION**

Architecture, SoT, ownership fields, lifecycle membership, authorization, honesty mismatches, and test inventory are mapped with code evidence. No additional discovery audit is required before product can:

1. Formally confirm/sign **PD-FOLLOWUP-01** (or amend it),  
2. Decide **PD-S10-02…08** label/attribution/scope items,  
3. Only then authorize Slice 10 implementation.

### Stop conditions (this task)

- No application code changes  
- No database / migration / permission / ownership / UI changes  
- Slice 10 / 11 / 12 **not** started  

**Next step:** product decisions only. Do not implement until explicitly approved.

---

## Appendix A — Key evidence paths

```
apps/hospital-portal-web/src/app/dashboard/counsellors-desk/surgery-followup/page.tsx
apps/hospital-portal-web/src/lib/api/counsellors-desk.api.ts
apps/hospital-portal-web/src/hooks/use-counsellors-desk-queries.ts
apps/hospital-portal-web/src/lib/counsellors-desk/followup-presentation.ts
microservices/auth-service/AuthService/Controllers/CounselingController.cs
microservices/auth-service/AuthService/Services/FollowupListService.cs
microservices/auth-service/AuthService/Services/FollowupQueryContracts.cs
microservices/auth-service/AuthService/Services/FollowupBranchAccessService.cs
microservices/auth-service/AuthService/Services/CounselingWorkflowService.cs
microservices/auth-service/AuthService/Services/CounselorCommunicationService.cs
microservices/auth-service/AuthService/Models/Domain/CounselingWorkflow.cs
docs/audits/counsellor-ownership-work-allocation-phase3h-product-decisions.md  (PD-FOLLOWUP-01)
docs/audits/counsellor-ownership-work-allocation-phase3i-implementation-readiness-audit.md  (Slice 10 scope)
```

## Appendix B — Ownership Q&A quick index

See §3 table (questions 1–14).

## Appendix C — Related Phase 3I doc status

| Doc | Slice 10 |
|-----|----------|
| UAT decision gate | NOT started / Deferred |
| Slice 9 implementation report | Out of scope; do not start |
| Phase 3H product decisions | PD-FOLLOWUP-01 WORKING unsigned |
| Implementation readiness audit | Scope defined: labels + no My Follow-ups + actor attribution |
