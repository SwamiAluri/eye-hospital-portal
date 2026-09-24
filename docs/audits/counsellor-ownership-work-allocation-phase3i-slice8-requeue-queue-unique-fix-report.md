# Phase 3I — Slice 8 ReQueue Queue-Constraint Fix  
# Soft-Delete + New Waiting Row (Partial Unique Index)  
# IMPLEMENTATION REPORT

**Date:** 2026-09-21  
**Status:** **READY FOR TARGETED REQUEUE MANUAL UAT**  
**Slice 10:** unchanged  
**Slice 11 / 12:** not started  

---

## 1. Root Cause

ReQueue preserves **soft-delete historical queue row → INSERT new Waiting row** for the same `session_id`.

Live PostgreSQL had:

`UNIQUE counselor_queue_session_id_key ON counselor_queue (session_id)`

(unconditional — not filtered on `deleted_at`).

Soft-delete does not free that key, so the new Waiting insert violated uniqueness → `SaveChangesAsync` failed → transaction rolled back → HTTP 400 `"Error re-queuing patient"`.

SessionType mapping (`FOLLOW_UP` → `Followup`) was already fixed and is preserved.

---

## 2. Product Decision

**Option A (approved):** Keep soft-delete + create new Waiting.  
Do **not** mutate Completed → Waiting on the same row.

Database uniqueness corrected to:

`UNIQUE (session_id) WHERE deleted_at IS NULL`

---

## 3. Database Change

| Item | Value |
|------|--------|
| Old | `counselor_queue_session_id_key` UNIQUE `(session_id)` |
| New | `ux_counselor_queue_session_id_active` UNIQUE `(session_id) WHERE deleted_at IS NULL` |
| Migration class | `AuthService.Data.Migrations.CounselorQueueActiveSessionIdUnique` |
| Files | `Data/Migrations/20260921110000_CounselorQueueActiveSessionIdUnique.cs` |
| SQL script | `Database/20260921110000_counselor_queue_active_session_id_unique.sql` |

Reviewed SQL (applied to live Azure DB):

```sql
ALTER TABLE counselor_queue
    DROP CONSTRAINT IF EXISTS counselor_queue_session_id_key;
DROP INDEX IF EXISTS counselor_queue_session_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS ux_counselor_queue_session_id_active
    ON counselor_queue (session_id)
    WHERE deleted_at IS NULL;
```

Note: AuthService applies schema via SQL scripts (`Migrate()` disabled). Script was executed against the UAT PostgreSQL database.

---

## 4. Data Safety

Pre-migration READ-ONLY check:

```sql
SELECT session_id, COUNT(*)
FROM counselor_queue
WHERE deleted_at IS NULL AND session_id IS NOT NULL
GROUP BY session_id
HAVING COUNT(*) > 1;
```

**Result: 0 rows** (no duplicate active non-null SessionIds). Proceeded.

(Four active rows with `session_id IS NULL` exist; PostgreSQL unique semantics allow multiple NULLs — unchanged.)

Historical duplicate sessions (`deleted_at IS NOT NULL`): **0**.

UAT session `bb000001-2222-2222-2222-000000000007` **not mutated** by this work.

---

## 5. Application Changes

| File | Change |
|------|--------|
| `Context/AppDbContext.cs` | Fluent: partial unique index mapping |
| `Migrations/AppDbContextModelSnapshot.cs` | Snapshot aligned to partial unique index |
| `Data/Migrations/20260921110000_CounselorQueueActiveSessionIdUnique.cs` | SQL migration |
| `Database/20260921110000_counselor_queue_active_session_id_unique.sql` | Ops SQL twin |

**ReQueueSessionAsync:** **unchanged** (soft-delete + new Waiting preserved).  
**SessionType contracts / FE mapping:** **unchanged**.  
**Ownership / Version / branch / tenant:** **unchanged**.

---

## 6. Tests

### New

| File | Purpose |
|------|---------|
| `Phase3ISlice8CounselorQueueUniquenessMappingTests.cs` | EF model filter/name |
| `Phase3ISlice8RequeueQueueUniquenessPostgresTests.cs` | Live Postgres: ReQueue soft-delete+insert, reject two actives, allow historical, reuse Waiting, index definition |

Requires `AUTHSERVICE_TEST_CONNECTION` (or `ConnectionStrings__DefaultConnection`). Uses isolated Guids; does not touch the UAT Cold Lead session.

### Command

```text
dotnet test AuthService.Tests.csproj
  --filter "…Phase3ISlice8CounselorQueueUniquenessMappingTests|
            …Phase3ISlice8RequeueQueueUniquenessPostgresTests|
            …CounselingSessionTypeContractsTests|
            …Phase3ISlice8RequeueOwnershipTests"
  -p:OutputPath=C:\Temp\slice8q\ -p:UseAppHost=false
```

(with `AUTHSERVICE_TEST_CONNECTION` set)

### Result

**Passed: 50, Failed: 0**

Includes: mapping (1), Postgres uniqueness/ReQueue (5), sessionType contracts, Slice 8 ownership/branch/concurrency/ownership-null regressions.

---

## 7. Migration Validation

Live `pg_indexes`:

```text
ux_counselor_queue_session_id_active
  UNIQUE (session_id) WHERE (deleted_at IS NULL)
```

Old constraint `counselor_queue_session_id_key`: **absent**.

Postgres tests confirmed: two active rows same SessionId → unique violation; historical duplicates + one active → allowed; ReQueue Completed→soft-delete+Waiting succeeds with `FOLLOW_UP` → stored `Followup`.

---

## 8. Scope Confirmation

- Slice 10 presentation **unchanged**
- Slice 11 **not started**
- Slice 12 **not started**
- No ownership / permission redesign
- No Post-Surgery / Analytics changes
- No ReQueue semantic change (soft-delete + new Waiting retained)

---

## 9. Manual UAT

1. AuthService on `:5073` (DB already has the new index; no app rebuild required for this constraint, but restart optional if desired).  
2. Follow-up Center → Cold Leads → Re-queue → Follow-Up → Reason `Test` → Re-queue.  
3. Expect: HTTP success; no `"Error re-queuing patient"`; SessionType `Followup`; CounselorId NULL; Completed row soft-deleted; new Waiting row; exactly one active queue row; Original Counsellor Unassigned; Version/branch/tenant intact.

---

**READY FOR TARGETED REQUEUE MANUAL UAT**
