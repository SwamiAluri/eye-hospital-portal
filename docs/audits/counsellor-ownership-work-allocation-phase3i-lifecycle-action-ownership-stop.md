# Phase 3I — Lifecycle Entry UX Correction
## STOPPED — Ownership-transfer backend gap

| Field | Value |
|-------|--------|
| **Date** | 2026-09-16 |
| **Status** | **STOPPED** before unsafe implementation |
| **Trigger** | Prompt §0 / §24 — Done/Repeat + other owner → explicit Assign to me |

---

## Verdict

**Cannot safely implement the full requested matrix.**

| Path | Backend support today | Action |
|------|----------------------|--------|
| Done/Repeat + **current owner** | N/A (no ownership change) | Implementable (UX only) |
| Done/Repeat + **NULL** | `POST .../assign` (assign-if-null) | Implementable |
| Done/Repeat + **other owner** | **No approved transfer API** | **BLOCKED** |
| Pending + NULL Assign | Slice 3 Assign | Intact |
| Client `CounselorId` write via Update | Exists but forbidden as ownership SoT | **Must not use** |

Per §24: do **not** invent Reassign, do **not** overwrite via assign-if-null, do **not** silently absorb Slice 6.

---

## A. Existing behavior discovered

### Assign (Slice 3) — `POST /api/Counseling/sessions/{id}/assign`

- Body: `{ counselorId }` only  
- Semantics: **atomic NULL → target only**  
- Already owned → **409 Conflict** (`Session is already assigned.`)  
- Eligibility (current): Waiting **or** Completed (not SurgeryDone) + NULL  
- Does **not** reassign  

Evidence: `CounselingWorkflowService.AssignSessionAsync`, `ICounselingWorkflowService` comment: *“Does not reassign already-owned sessions.”*

### Reassign API

- **None.** Phase 3I readiness + Phase 3H list Reassign as future Slice 6.  
- **PD-REASSIGN-01**: already-owned changes = **Supervisor/Admin only**, with reason + History/Audit — **not** peer counsellor self-claim.

### Informal bypass (must not use)

- `UpdateSessionAsync` still accepts `request.CounselorId` — last-write-wins ownership write.  
- Using this from FE for “Assign to me” would **weaken** the certified Assign boundary and preempt Slice 4/6.

### Current FE (Lifecycle Entry UX already shipped)

- Done/Repeat + NULL → grid shows **Assign** (not Re-evaluate/Start Repeat)  
- Done/Repeat + other → **View** only (no Assign to me)  
- Attention column still present  
- Done/Repeat workspace banners still present  

---

## B–C. Requested vs blocked

### Lifecycle action matrix (requested)

| State | CTA | Current | NULL | Other |
|-------|-----|---------|------|-------|
| Pending | Assign / Open / View | Open | Assign | View |
| Processed | Continue / View | Continue | View | View |
| Done | **always Re-evaluate** | immediate Re-eval | Assign to me → Re-eval | Assign to me → transfer → Re-eval |
| Repeat | **always Start Repeat** | immediate Start | Assign to me → Start | Assign to me → transfer → Start |

### Ownership decision for Re-evaluate / Start Repeat

| CounselorId | Required server capability | Status |
|-------------|---------------------------|--------|
| == current user | Continue existing flow | OK |
| NULL | Assign-if-null (existing) | OK |
| != current user | **Ownership transfer** (new) | **MISSING** |

---

## Minimum backend contract required (do not invent in this task)

To unlock Done/Repeat + other → Assign to me without hacking:

**Option recommended for product confirmation:**

```http
POST /api/Counseling/sessions/{id}/claim-for-lifecycle
Authorization: counseling_sessions.update (+ counsellor identity)
Body: { "expectedCounselorId": "<current-owner-guid>", "intent": "ReEvaluate" | "StartRepeat" }
```

Or extend a dedicated **Reassign-to-self** / Slice 6 subset:

```http
POST /api/Counseling/sessions/{id}/reassign
Body: { "counselorId": "<self>", "expectedCounselorId": "<previous>", "reason": "Lifecycle Re-evaluate" }
```

**Server must:**

1. Reject if `CounselorId` is null → use Assign instead  
2. Reject if `CounselorId != expectedCounselorId` → **409** (stale / concurrent)  
3. Allow only **actor == target** (Assign to me), same-branch, same-tenant  
4. Atomic update owned → self (optimistic concurrency)  
5. **Not** reuse assign-if-null  
6. Decide vs **PD-REASSIGN-01**: peer self-claim for Done/Repeat is a **new** product rule (Phase 3H said Supervisor/Admin only). Explicit sign-off required.  
7. History/Audit: Slice 5 dependency — at minimum do not ship transfer without a decision on audit  

---

## Product conflict (must resolve before coding other-owner)

| Source | Rule |
|--------|------|
| **This prompt** | Peer counsellor may explicit **Assign to me** on Done/Repeat owned by another |
| **PD-REASSIGN-01** | Already-owned → Supervisor/Admin reassignment only |
| **Prompt §24** | Do not silently implement Slice 6 |

**Decision needed:** Is peer lifecycle take-over an approved exception to PD-REASSIGN-01, or must other-owner stay View-only until Slice 6?

---

## What can proceed **after** approval (without transfer API)

Safe to implement in a follow-up prompt **excluding other-owner transfer**:

1. Grid: Done → always **Re-evaluate**; Repeat → always **Start Repeat**; Assign **only** Pending+NULL  
2. Remove Attention column (presentation only)  
3. Remove large Done / Repeat primary banners  
4. Done/Repeat + **current** → immediate existing flows  
5. Done/Repeat + **NULL** → lightweight Assign to me → then existing flows (existing Assign API)  
6. Done/Repeat + **other** → keep View/read-only **until** transfer API + product sign-off  
7. Direct URL safety (no auto Re-eval / Start / Assign)  

**Not** started in this response (STOP).

---

## D–F. Files / BE / FE

**Production code modified by this stop report:** none.

---

## G. Read-only audit (current state — not changed)

Existing FE `isReadOnly` + ownership overlay covers estimate/quote/decision/notes/save/finish; other-owner View already seals. Full mutation-surface checklist remains valid for the next implementation pass.

---

## H. Automated tests

Not run for new work (no implementation). Prior Lifecycle Entry suite remains the last green baseline.

---

## I. Security

- Assign-if-null cannot overwrite owners (409) — **preserve**  
- No client `CounselorId` mutation for transfer  
- Branch/tenant still server-derived on Assign  
- Concurrent other-owner take-over **needs** expected-owner / version check on any future transfer API  

---

## J. Scope

**Ownership-transfer capability required for full prompt:** **YES**  
**Safely available today:** **NO**  
**Result:** **STOPPED — backend/product decision required.**

---

## K. Deferred (unchanged)

Slice 4 owner ACL · Slice 5 History/Audit · Slice 6 Reassign (or explicit peer lifecycle claim exception) · Slice 7 Version · Slice 8 Requeue NULL · Slices 9–12 · Re-evaluate Auth sync · OT cancel-ot  

---

## Next step (for you)

Choose one:

1. **Approve peer lifecycle claim API** (exception to PD-REASSIGN-01) → implement BE + FE in a dedicated prompt.  
2. **Keep PD-REASSIGN-01** → other-owner Done/Repeat stay View; implement NULL + current + grid UX only.  
3. **Wait for full Slice 6** → no peer take-over until Supervisor/Admin Reassign exists.

Until then: **no further Phase 3I slice auto-start.**
