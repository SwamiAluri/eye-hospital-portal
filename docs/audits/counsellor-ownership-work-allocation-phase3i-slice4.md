# Phase 3I Slice 4 — Owner Mutation ACL

| Field | Value |
|-------|--------|
| **Date** | 2026-09-17 |
| **Slice** | Phase 3I Slice 4 only |
| **Status** | **IMPLEMENTED** — automated tests passed (61). Awaiting manual UAT. **STOP** before Slice 5/6. |

---

## Statement

**`CounselorId` may change only through explicitly authorized ownership workflows (Assign, lifecycle claim; Reassign deferred to Slice 6).** Owner-level counselling content mutations are restricted to the current `CounselorId`. The frontend is not the security boundary.

---

## Audit summary (pre-impl)

| Path | CounselorId write? | Owner ACL before Slice 4? |
|------|--------------------|---------------------------|
| Create | Forced NULL | N/A (Slice 2) |
| Assign | NULL → target | Assign guards only |
| Claim-for-lifecycle | NULL/expected → actor | Claim guards only |
| UpdateSession | **Free write if client sent CounselorId** | **None** |
| Start / Complete / Cancel / AddOn / Investigations / Advance-stage | No | **None** |
| Follow-up / OT Finalize | No counselling owner ACL | Correctly out of scope |

---

## Locked product / security decisions (Slice 4)

| ID | Decision |
|----|----------|
| **S4-D1** | Ownership mutations allowed **only** via `POST .../assign` and `POST .../claim-for-lifecycle` (Slice 6 Reassign later). |
| **S4-D2** | `UpdateSession` **rejects** any client-supplied `CounselorId` (**400**). Does not ignore silently. |
| **S4-D3** | Owner-level content mutate requires `session.CounselorId == actor`. Else **403**. |
| **S4-D4** | Unassigned (`CounselorId` NULL): owner-level content mutate **403**. Must Assign or claim first. No silent claim on Update/Start. |
| **S4-D5** | **No Admin/Supervisor content bypass** in Slice 4. Admin may still Assign (NULL→target) and read. Reassign / supervisory mutate = Slice 6. |
| **S4-D6** | In-scope mutates: Update, Advance-stage (via Update), Start, Complete, Cancel, MarkAddOnSurgery, SaveInvestigations, StartFromQueue. |
| **S4-D7** | Out of scope: Waiting List read, History/Audit ownership events (Slice 5), Requeue clear (Slice 8), Follow-up callbacks/reminders (**PD-FOLLOWUP-01**), OT Finalize (**PD-FS-01**), notes/documents (separate permission codes; not gated this slice), Analytics. |
| **S4-D8** | HTTP: ownership denial → **403 Forbidden**; CounselorId-on-Update → **400 Bad Request**. |
| **S4-D9** | Permissions remain mandatory (`counseling_sessions.update` etc.). Owner ACL is **additional**. |

Authority: **PD-AUTH-01**, **PD-ASSIGN-01**, **PD-ADM-01** (mutate after assignment), readiness Slice 4 scope.

---

## What changed (implementation)

### Backend
- `SessionOperationResult.FailureKind` for Forbidden / BadRequest / NotFound mapping.
- Shared owner gate on in-scope mutate paths.
- Free `CounselorId` write removed from `UpdateSessionAsync`.
- Controllers map Forbidden → 403.

### Frontend
- No ownership-transfer UI changes. Existing FE owner UX remains non-authoritative.

### Not in this slice
- Slice 5 History/Audit · Slice 6 Reassign · Slice 7 Version · Slice 8 Requeue→NULL

---

## Automated tests

- New: `Phase3ISlice4OwnerMutationAclTests.cs`
- Slice 2 Start tests adjusted for unassigned/non-owner **403**
- Contract: Update rejects CounselorId path covered in Slice 4 suite

---

## Manual UAT checklist

1. Owner: assigned session → Save Draft / Update succeeds; CounselorId unchanged  
2. Non-owner counsellor: Update/Start/Complete → **403**; data unchanged  
3. Unassigned: Update/Start → **403**; still NULL owner  
4. Client PUT with `counselorId` → **400**; ownership unchanged  
5. Assign + claim-for-lifecycle still establish ownership  
6. Admin: cannot mutate owned content without being owner; can still Assign unassigned  
7. Waiting List remains shared (visibility unchanged)  
8. Follow-up / Finalize Surgery still not blocked by counselling owner  

**STOP** — do not start Slice 5 or Slice 6 until UAT passes.
