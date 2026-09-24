# Phase 3I — PD-A OT Master Configuration Gap Report

**Program:** Counsellor Ownership & Work Allocation  
**Decision:** PD-A — OT master configuration for all operational/surgery-capable branches  
**Mode:** CONFIGURATION / OPERATIONAL REPORT ONLY — no application seed, migration, or startup insert  
**Date:** 2026-09-19  

---

## 1. Decision reminder

OT master data must be configured for **every** branch that is operational and expected to schedule surgery through the Hospital Portal. This is **not** a Banjara-only fix.

OT master configuration does **not** mean slot availability, doctor/OT compatibility, or that surgery can always be scheduled.

---

## 2. Authoritative operational mechanism

| Layer | Detail |
|---|---|
| Create | `POST /api/OTBooking/theaters` — permission `ot.theaters.create` |
| Update / activate | `PUT /api/OTBooking/theaters/{id}` — permission `ot.theaters.edit` |
| Service | `OTBookingSystemService.CreateTheaterAsync` / `UpdateTheaterAsync` |
| Entity / table | `OTTheater` → `ot_theaters` (`branch_id` required) |
| Counselling lookup | `GET /api/Counseling/theaters` — active, non-deleted, authorized branches only |

**Production portal UI for theater CRUD:** none found. Ops must use the OTBooking APIs (or an authorized DBA process matching the same entity constraints).

**Do not use for production multi-branch configuration:**

- `database_migrations/schema/module03_05_ot_booking_system.sql` seed (first branch only)
- Archive Downtown seeds
- Application startup / EF seed
- Mock `/dashboard/operations/ot` page

---

## 3. Live verification baseline (from UAT Decision Gate)

| Branch | Branch ID | Active OT count |
|---|---|---|
| Downtown Hospital | `74c014cf-9570-4824-bdf9-b369ea11a8f4` | **3** |
| CareFirst Bangalore | `98fbadae-b76f-4aa1-bfd9-df0eef9e0a5d` | **2** |
| Hyderabad Eye Clinic - Banjara Hills | `9b2f6670-845c-4603-b75d-b10b776ad22d` | **0** |
| Other active branches (19+) | (see live `branch` table) | **0** |

Query used:

```sql
SELECT branch_id, COUNT(*) AS active_ot_count
FROM ot_theaters
WHERE deleted_at IS NULL AND is_active = true
GROUP BY branch_id
ORDER BY branch_id;
```

---

## 4. Required operational actions

For **each** branch that is operational **and** surgery-capable (expected to schedule surgery) with zero active OT rows (including Banjara Hills). Do not configure OT solely because a branch row is `active` in MPI/org data:

1. Authenticate as a user with `ot.theaters.create`.
2. `POST /api/OTBooking/theaters` with that branch’s `branchId`, name, code, and operational flags per existing DTO (`CreateTheaterRequest`).
3. Verify with `GET /api/OTBooking/theaters?branchId=<branch>` and as a counsellor via `GET /api/Counseling/theaters`.
4. Confirm Schedule Surgery OT dropdown is non-empty for users authorized to that branch.

**Minimum:** ≥1 active, non-deleted `ot_theaters` row per surgery-scheduling branch.

---

## 5. Already configured vs requires operational verification

### Already configured (active OT master present)

| Branch | Active OT count |
|---|---|
| Downtown Hospital | **3** |
| CareFirst Bangalore | **2** |

### Requires operational verification / configuration

**Do not interpret “all active branches” as automatically requiring an OT.**

The authoritative question for ops is: which active branches are **operational and surgery-capable** (expected to schedule surgery through the Hospital Portal)? Only those require OT master configuration.

| Branch / cohort | Status |
|---|---|
| **Hyderabad Eye Clinic - Banjara Hills** | Definitely included — 0 OT rows; Emma authorized here → empty theatre list until configured |
| Other active branches with 0 OT rows | **Verify surgery-capability first**, then configure ≥1 active non-deleted OT only for branches that schedule surgery |

Re-run the count query after ops work to confirm closure for surgery-capable branches only.

---

## 6. Application code status

**No code changes for PD-A in this implementation.**  
GetTheaters branch authorization and empty-list behavior remain unchanged (truthful empty when no master data).

---

## 7. UAT verification checklist (PD-A)

1. Banjara Hills has ≥1 active OT after ops configuration.
2. Every operational/surgery-capable branch has required OT master configuration.
3. Emma can see valid OT choices for Banjara.
4. Downtown remains functional (3 OTs).
5. A branch intentionally left without OT config still returns empty (truthful).
6. Branch isolation remains intact.
