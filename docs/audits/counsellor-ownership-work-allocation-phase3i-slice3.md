# Phase 3I Slice 3 — Explicit Assignment (Initial Ownership)

| Field | Value |
|-------|--------|
| **Date** | 2026-09-16 |
| **Slice** | Phase 3I Slice 3 only |
| **Status** | **IMPLEMENTED** + **final UAT/product remediation** — re-UAT |

---

## Statement

**Ownership is established only through explicit Assign.** Waiting List remains shared. Open/view/start do not assign. `CounselorId = NULL` remains valid until Assign.

---

## Explicit UAT / product decisions (confirmed)

1. **Eligibility:** `Pending` **and** `CounselorId == NULL` only (Waiting List Pending = queue `Waiting`).
2. **Actors:** authorized counsellor **or** System Administrator / Admin (with `counseling_sessions.update` + branch access).
3. **Counsellor:** Assign to me + same-branch peer; current user excluded from peer dropdown.
4. **Admin:** Assign to counsellor only; **no** Assign to me unless Admin is independently a counsellor; Admin is actor, selected counsellor is owner.
5. **Open guard:** Pending + Unassigned row click does **not** open the counselling workspace.
6. **Assigned rows:** no initial Assign; open may continue without mutating ownership.
7. Waiting List remains **shared** (no CounselorId visibility filter).

---

## What changed

### Backend
- `POST .../sessions/{id}/assign` — unchanged contract `{ counselorId }`.
- Assign requires queue `Waiting` (Pending) + `CounselorId` null + tenant/branch/target validation.
- Admin may assign (no requirement that actor is a counsellor); owner = target only.
- `GET .../counselors?branchId=` optional same-branch discovery (UX); Assign still validates.
- Waiting List DTO includes `branchId` for picker filtering.

### Frontend
- Assign visibility: capability (counsellor **or** admin) + Pending + unassigned.
- Assign to me: counsellor identity only; immediate assign; peers exclude self.
- Peer/Admin path: branch-scoped counsellor list + Confirm Assign.
- Row click on Pending+Unassigned: opens Assign dialog directly (no toast); no navigation.
- Assign 403: `skipForbiddenRedirect` (stay on Waiting List).

---

## Manual UAT checklist

1. Counsellor: Pending+Unassigned → Assign visible; Assign to me → owner = self  
2. Counsellor: peer same-branch → owner = peer; self not in dropdown  
3. Admin: Pending+Unassigned → Assign visible; no Assign to me; assign counsellor → owner = counsellor, actor = Admin  
4. Pending+Unassigned row click → Assign dialog opens directly (no toast); does not open session  
5. Pending+Assigned → no Assign; row opens without ownership change  
6. Non-Pending unassigned → no Assign  
7. Cross-branch target → toast, stay on list, no `/unauthorized`  
8. Already owned → conflict, no overwrite  
9. Shared Waiting List after assign  
10. Open/Start still do not assign  

**STOP** — do not start Slice 4 until UAT passes.
