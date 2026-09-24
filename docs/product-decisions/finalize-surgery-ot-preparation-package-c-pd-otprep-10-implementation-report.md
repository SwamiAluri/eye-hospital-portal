# Finalize Surgery + OT Preparation
# Package C — PD-OTPREP-10
# FSM / Reopen-First Enforcement
# Engineering Implementation Report

| Field | Value |
|-------|--------|
| **Document type** | **ENGINEERING IMPLEMENTATION REPORT** |
| **Package** | Package C — PD-OTPREP-10 Reopen-First FSM Enforcement |
| **Product Decision** | **PD-OTPREP-10 — OPTION A** |
| **Implementation Authorization** | `docs/product-decisions/finalize-surgery-ot-preparation-package-c-pd-otprep-10-implementation-authorization.md` |
| **Date** | 2026-09-24 |
| **Status** | **IMPLEMENTATION COMPLETE — AUTOMATED TESTS RUN** |
| **Manual UAT** | **REQUIRED — NOT EXECUTED** |
| **Acceptance** | **NOT RECORDED** |
| **Package B** | **UNTOUCHED** |
| **RESP2** | **UNTOUCHED** |
| **Package LA** | **UNTOUCHED** |
| **C-LA-04** | **DEFERRED — UNTOUCHED** |

---

## 1. Product Decision reference

**PD-OTPREP-10 — OPTION A**  
Source: `docs/product-decisions/finalize-surgery-ot-preparation-operational-model-product-decision.md`

Rule implemented:

```text
OTPrepared is locked.
Direct schedule-date / StartTime mutation while OTPrepared must not be permitted.
Reopen is the required recovery/edit path.
```

---

## 2. Implementation Authorization reference

`docs/product-decisions/finalize-surgery-ot-preparation-package-c-pd-otprep-10-implementation-authorization.md`

Status at implementation time: **IMPLEMENTATION AUTHORIZED — PACKAGE C ONLY**

---

## 3. Status

```text
IMPLEMENTATION: COMPLETE
AUTOMATED TESTS: RUN — PASSED (see §17)
MANUAL UAT: REQUIRED — NOT EXECUTED
ACCEPTANCE: NOT RECORDED
PACKAGE C CLOSURE: NOT PERFORMED
```

---

## 4. Exact files changed (Package C attributable)

| File | Change |
|------|--------|
| `microservices/auth-service/AuthService/Services/OtFinalizeService.cs` | Added `GuardLocked(existing)` on Upsert **update** branch after access checks, before field mutation |
| `microservices/auth-service/AuthService/Controllers/CounselingController.cs` | Mapped non-stale `InvalidOperationException` from `UpsertOtSchedule` → **409 Conflict** |
| `AuthService.Tests/Services/OtFinalizeOtPreparedLockGuardTests.cs` | **NEW** — Package C service + controller contract tests |
| `docs/product-decisions/finalize-surgery-ot-preparation-package-c-pd-otprep-10-implementation-report.md` | **NEW** — this report |

**Note:** `OtFinalizeService.cs` and `CounselingController.cs` already had pre-existing dirty working-tree changes unrelated to Package C. Package C added only the GuardLocked Upsert call and the Upsert 409 catch block (comment-tagged `Package C / PD-OTPREP-10`). Pre-existing dirty files were **not** reverted.

**Frontend:** none (authorized — no new UX).

---

## 5. Exact service / method changed

| Service | Method | Change |
|---------|--------|--------|
| `OtFinalizeService` | `UpsertFromCounsellorAsync` | Update branch (`existing != null`): `GuardLocked(existing)` after `EnsureActorCanAccessScheduleAsync`, before any field writes including `StartTime` |

Insert/create branch: **unchanged**.

---

## 6. GuardLocked enforcement details

Reused existing private helper (no second lock implementation):

```csharp
private static void GuardLocked(OtFinalizeSchedule entity)
{
    if (entity.IsLocked)
        throw new InvalidOperationException(
            $"Record is locked (status: {entity.Status}). Use 'Reopen OT Case' to make changes.");
}
```

When `existing.IsLocked == true` (typical OTPrepared after Prepare):

- Upsert update is rejected before mutation
- `StartTime`, `Status`, `IsLocked`, `SequenceNo`, `PreparedAt`, `PreparedBy` remain unchanged

`UpdateDetailsAsync` / `UpdateSlotAsync` already called `GuardLocked` — **not modified**.

---

## 7. Controller 409 mapping details

`CounselingController.UpsertOtSchedule`:

1. Preserve stale/concurrency: `InvalidOperationException when SessionConcurrency.IsStale` → 409  
2. **NEW:** other `InvalidOperationException` (including GuardLocked) → 409 Conflict  
3. Preserve `UnauthorizedAccessException` → 403  
4. Preserve `ArgumentException` → 400  
5. Preserve generic `Exception` → 500  

Consistent with existing `UpdateOtSlot` / `UpdateOtDetails` Conflict mapping.  
**No new endpoint. No DTO change. No new exception type.**

---

## 8. Why no new API was required

Enforcement lives inside the existing Upsert service path and HTTP mapping already used by counselling OT handoff (`POST …/ot-schedule`). Certified edit path remains Finalize modal → `UpdateDetails` after Reopen.

---

## 9. Why no DB change was required

`is_locked` / `IsLocked` already persists lock state. Package C only enforces the existing flag on Upsert.

---

## 10. Why no FSM change was required

No new states. Existing transitions preserved:

```text
OTPrepared → Confirmed via Reopen
```

Upsert can no longer demote locked OTPrepared to NotConfirmed.

---

## 11. Prepare untouched

`PrepareOtListAsync` not modified (including Finalised `NewStartTime` handling and SequenceNo persistence). Covered by regression test in Package C suite + existing Prepare date-scope tests.

---

## 12. Reopen untouched

`ReopenAsync` not modified. Regression asserts OTPrepared → Confirmed, unlock, metadata preservation.

---

## 13. SequenceNo untouched

No SequenceNo generation/ordering/persistence changes. Locked Upsert rejection preserves SequenceNo; Reopen preserves SequenceNo.

---

## 14. Ownership / permissions untouched

No changes to branch/tenant ACL helpers, permission attributes, CounselorId, Assign/Reassign/Requeue, My Work, or Supervisor.  
Authz regression: outsider Upsert still throws `UnauthorizedAccessException` (not GuardLocked); controller maps Unauthorized → 403.

---

## 15. RESP2 untouched

No OT Preparation selection / SequenceNo continuation / Prepare UX changes.

---

## 16. Package B / Bulk / Package LA / C-LA-04 untouched

No print, bulk slip, Package LA modal, or cancellation-presentation changes.

---

## 17. Automated test results

### Backend — Package C + OtFinalize regressions

Command (alternate output path to avoid locked running `AuthService.exe`/`AuthService.dll`):

```text
dotnet test AuthService.Tests/AuthService.Tests.csproj
  --filter FullyQualifiedName~OtFinalizeOtPreparedLockGuardTests
         |OtFinalizeOpdCopyTests
         |OtFinalizePrepareOtDateScopeTests
         |OtFinalizeUpdateDetailsPersistenceTests
         |OtFinalizeSchedulingGuardTests
         |CounselingOtAuthorizationContractTests
  -p:UseAppHost=false
  -p:OutputPath=artifacts/pkgc-build/bin/
  -p:IntermediateOutputPath=artifacts/pkgc-obj/
```

**Result:** `Passed! — Failed: 0, Passed: 44, Skipped: 0`

Package C suite (`OtFinalizeOtPreparedLockGuardTests`) covers:

1. Locked Upsert rejects before mutation (StartTime/Status/IsLocked/SequenceNo/PreparedAt/PreparedBy unchanged)  
2. UpdateDetails OTPrepared regression  
3. UpdateSlot OTPrepared regression  
4. Reopen metadata preservation  
5. Post-Reopen UpdateDetails StartTime → NotConfirmed  
6. Unlocked NotConfirmed Upsert remains functional  
7. Prepare Finalised → OTPrepared SequenceNo persistence  
8. Controller locked Upsert → 409 Conflict (not 500)  
9. Stale concurrency Upsert still 409  
10. Unauthorized Upsert → 403 (not GuardLocked 409)  
11. Branch denial before GuardLocked  

### Frontend — counselling OT handoff

```text
npx vitest run src/lib/counsellors-desk/save-counselling-session.fs01.test.ts
```

**Result:** `20 passed (20)` — Done+existing → UpdateSlot; Upsert path remains for unlocked cases.

---

## 18. Playwright results

**NOT RUN for Package C.**

**Reason:** Live AuthService process (PID holding `AuthService.dll`) blocked in-place rebuild of the running binary. Package C validation used an alternate build output. A Playwright run against the live API would exercise the **pre-Package-C** process, not this implementation. Backend service/controller tests are the authoritative enforcement coverage per IA §13.

UI Reopen workflow remains certified for Manual UAT (UAT-C-01…C-03).

---

## 19. Limitations / skipped tests

| Item | Status | Reason |
|------|--------|--------|
| Playwright OTPrepared → Reopen → edit | **NOT RUN** | Live AuthService binary lock / would not exercise Package C build |
| Full AuthService.Tests suite (entire project) | **NOT RUN** | Focused OtFinalize + authorization filter run instead (44 tests) |
| Manual UAT | **NOT EXECUTED** | Governance stop after automated tests + this report |

---

## 20. Working-tree / unrelated-change safety statement

```text
Pre-existing dirty production files were preserved (not reverted).
Package C attributable production edits:
  - OtFinalizeService.UpsertFromCounsellorAsync → GuardLocked(existing)
  - CounselingController.UpsertOtSchedule → non-stale InvalidOperationException → 409
New files:
  - AuthService.Tests/Services/OtFinalizeOtPreparedLockGuardTests.cs
  - this implementation report
No Package B / RESP2 / Package LA / Bulk / C-LA-04 / FSM / DB / permission / ownership files modified for Package C.
```

---

## 21. Manual UAT status

**REQUIRED — NOT EXECUTED**

Recommended scenarios remain those in the IA (UAT-C-01…UAT-C-08), especially:

- Locked Upsert / counselling re-save while OTPrepared → 409; schedule unchanged  
- Reopen → edit surgery date/time → Confirm/Finalise path  

---

## 22. Acceptance status

**NOT RECORDED**

---

## Final governance block

```text
PRODUCT DECISION:
PD-OTPREP-10 — DECIDED (Option A)

IMPLEMENTATION AUTHORIZATION:
RECORDED / USED

IMPLEMENTATION:
COMPLETE

AUTOMATED TESTS:
PASSED (44 backend focused + 20 Vitest handoff)

PLAYWRIGHT:
NOT RUN — live AuthService binary not Package C build

MANUAL UAT:
REQUIRED — NOT EXECUTED

ACCEPTANCE:
NOT RECORDED

PACKAGE B:
UNTOUCHED

RESP2:
UNTOUCHED

PACKAGE LA:
UNTOUCHED

C-LA-04:
DEFERRED

PACKAGE C:
IMPLEMENTATION COMPLETE — AWAITING MANUAL UAT
```

**STOP.** Next gate is Manual UAT only.
