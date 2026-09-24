# Phase 3I — Targeted Slice 8 ReQueue Fix  
# SessionType Master → DB Mapping  
# IMPLEMENTATION REPORT

**Date:** 2026-09-21  
**Status:** **READY FOR TARGETED REQUEUE MANUAL UAT**  
**Slice 10:** unchanged (not reopened)  
**Slice 11 / 12:** not started  

---

## 1. Root cause addressed

ReQueue UI/master code `FOLLOW_UP` was written directly into `counseling_sessions.session_type`.  
Postgres CHECK `counseling_sessions_session_type_check` only allows `Initial | Followup | Recheck | Urgent`.

**Fix:** Before `ExecuteUpdateAsync` / in-memory session mutation, ReQueue now calls:

`CounselingSessionTypeContracts.TryNormalizeWritableSessionType`

so:

`FOLLOW_UP` → **`Followup`**

Unknown values fail closed with an explicit BadRequest **before** persistence (no generic `"Error re-queuing patient"` remap for this case).

Frontend also sends `sessionTypeCodeToDb(sessionType)` so the request body is already DB vocabulary when the modal uses the default Follow-Up selection.

---

## 2. Authoritative mapper

| Layer | Mapper |
|-------|--------|
| Frontend (existing) | `sessionTypeCodeToDb` in `counsellor-master-maps.ts` (reused) |
| Backend (new, parity) | `CounselingSessionTypeContracts` — mirrors FE `SESSION_TYPE_CODE_TO_DB` + Postgres allowlist |

No second independent vocabulary invented. Backend mapper required because none existed in C#; FE mapper cannot be the sole trust boundary.

---

## 3. Files changed

| File | Reason |
|------|--------|
| `AuthService/Services/CounselingSessionTypeContracts.cs` | **New** — normalize/validate session types |
| `AuthService/Services/CounselingWorkflowService.cs` | ReQueue uses normalize before persist |
| `AuthService.Tests/CounselingSessionTypeContractsTests.cs` | **New** — mapping/validation unit tests |
| `AuthService.Tests/Phase3ISlice8RequeueOwnershipTests.cs` | Correct FOLLOW_UP→Followup; add regression cases |
| `surgery-followup/page.tsx` | ReQueueModal sends `sessionTypeCodeToDb(...)` |
| `surgery-followup/requeue-slice8.test.tsx` | FE contract expects mapped `Followup` |
| `docs/audits/...-slice8-requeue-sessiontype-fix-report.md` | This report |

---

## 4. Backend changes

In `ReQueueSessionAsync`, after intention normalize and **before** the ownership transaction:

1. `TryNormalizeWritableSessionType(sessionType, …)`
2. Blank → keep existing `SessionType`
3. Failure → `AssignSessionFailureKind.BadRequest` + explicit message (no DB write)
4. Success → persist `normalizedSessionType` via `ExecuteUpdateAsync` / tracked update

Ownership CAS, Version, branch auth, queue, OwnershipRequeued, SurgeryDone seal: **unchanged**.

---

## 5. Frontend changes

`ReQueueModal` payload:

```ts
sessionType: sessionType ? sessionTypeCodeToDb(sessionType) : undefined
```

Default UI code remains `FOLLOW_UP`; wire value becomes `Followup`. No modal UX redesign.

---

## 6. Tests

### Backend

| Command | Result |
|---------|--------|
| `dotnet test …AuthService.Tests.csproj --filter "…CounselingSessionTypeContractsTests\|…Phase3ISlice8RequeueOwnershipTests"` (isolated OutputPath; AuthService.exe lock workaround) | **Passed: 44, Failed: 0** |

### Frontend

| Command | Result |
|---------|--------|
| `vitest run requeue-slice8.test.tsx counsellor-master-maps.test.ts` | **19 passed** |
| `vitest run surgery-followup/page.test.tsx` | **6 passed** |

### PostgreSQL-aware persistence

**Not executed against live Postgres in this pass.**  
In-memory EF does not enforce `counseling_sessions_session_type_check`. Coverage is:

- Contract unit tests matching the live CHECK allowlist  
- ReQueue ownership tests asserting persisted value **`Followup`**, not `FOLLOW_UP`  

Restart AuthService so UAT hits the new binary (process was locking `bin\Debug\net8.0\AuthService.dll` during build).

---

## 7. Regression verification

| Concern | Status |
|---------|--------|
| CounselorId → NULL | Unchanged; tests still pass |
| expectedCounselorId NULL when unassigned | Explicit regression test added/passes |
| Version / 409 | Existing ownership tests pass |
| Branch authorization | Existing cross-branch deny tests pass |
| Queue soft-delete / Waiting reuse | Existing ownership tests pass |
| OwnershipRequeued | Existing trail tests pass |
| Tenant isolation | Unchanged path |
| Session lifecycle / intention | Unchanged except sessionType normalize |

---

## 8. Scope confirmation

- Slice 10 presentation **unchanged**  
- Slice 11 **not started**  
- Slice 12 **not started**  
- No ownership redesign / no permission redesign  
- No Post-Surgery / Analytics changes  
- No CHECK constraint migration  

---

## Manual UAT (required)

1. **Restart AuthService** on port 5073 (pick up new DLL).  
2. Follow-up Center → Cold Leads → Re-queue → Follow-Up → Reason `Test` → Re-queue.  
3. Expect: success (no `"Error re-queuing patient"`); `CounselorId` NULL; Waiting List row per certified behavior; Original Counsellor: Unassigned; history/Version/branch intact.

---

**READY FOR TARGETED REQUEUE MANUAL UAT**
