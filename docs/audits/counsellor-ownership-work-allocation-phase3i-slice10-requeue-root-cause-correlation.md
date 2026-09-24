# Phase 3I — ReQueue UAT Failure  
# EXACT FAILURE CORRELATION (READ-ONLY)

**Date:** 2026-09-21  
**Mode:** Read-only root-cause investigation — **FIX NOT IMPLEMENTED**  
**Network evidence:** definitive (manual UAT)

---

## Confirmed from browser (given)

| Field | Value |
|-------|--------|
| Endpoint | `POST http://localhost:5073/api/Counseling/sessions/bb000001-2222-2222-2222-000000000007/re-queue` |
| HTTP status | **400 Bad Request** |
| Payload | `{ "version": 1, "expectedCounselorId": null, "reason": "Test", "sessionType": "FOLLOW_UP" }` |
| Response | `{ "message": "Error re-queuing patient" }` |

---

## 1. SessionId

`bb000001-2222-2222-2222-000000000007`

---

## 2–4. HTTP / payload / response

Confirmed as above. Request reached AuthService; generic ReQueue exception remap invoked.

---

## 5. Session database snapshot (READ-ONLY)

| Column | Value |
|--------|--------|
| Id | `bb000001-2222-2222-2222-000000000007` |
| TenantId | `155fe198-6ae5-4a01-9254-ead5b427247e` |
| BranchId | `74c014cf-9570-4824-bdf9-b369ea11a8f4` (**not null**) |
| CounselorId | **NULL** |
| Version | **1** |
| Status | `Completed` |
| PatientIntention | `ReferredElsewhere` (Cold population) |
| SessionType (current) | `Initial` |
| DeletedAt | NULL |
| CreatedAt | `2026-04-01 16:13:10.330572+00` |
| UpdatedAt | `2026-05-06 15:01:48.177376+00` |

**expectedCounselorId = null:** **VALID** for this row (`CounselorId` is NULL). Matches UI “Original Counsellor: Unassigned”. Not a CAS mismatch (would return `Session ownership changed.` / 409).

---

## 6. Queue snapshot (READ-ONLY)

| Field | Value |
|-------|--------|
| Queue Id | `cc000001-3333-3333-3333-000000000007` |
| SessionId | matches |
| TenantId | matches session |
| BranchId | `74c014cf-9570-4824-bdf9-b369ea11a8f4` |
| Status | `Completed` |
| QueueType | `Counseling` |
| TokenNumber | `TKN-107` |
| DeletedAt | NULL |

One non-deleted Completed queue row. ReQueue would soft-delete non-Waiting actives and create/reuse a Waiting row — **not** the first failure point for this payload (failure occurs earlier on session `session_type` write).

---

## 7. Ownership history snapshot (READ-ONLY)

Table: `counseling_session_audit_log`

Existing events (sample): `PatientTypeChanged`, `FieldChanged` (payment/decision/schedule). **No** `OwnershipAssigned` / `OwnershipReassigned` / `OwnershipRequeued` rows found for this session.

With `CounselorId` NULL → `ownershipChanged = false` → **`StageOwnershipTrailAsync` is not called**. Audit-null throw path is **not** implicated for this failure.

---

## 8. Branch state (READ-ONLY)

| Field | Value |
|-------|--------|
| Branch Id | `74c014cf-9570-4824-bdf9-b369ea11a8f4` |
| Name | Downtown Hospital |
| DeletedAt | NULL |

Branch exists. `Guid.Empty` BranchId fallback is **not** applicable here.

OT row: `ot_finalize_schedule` id `f2250edc-…` status **`Finalised`** (not `SurgeryDone`) → SurgeryDone seal path would **not** block ReQueue with the SurgeryDone message.

---

## 9. Audit service state

- DI registers `IAuditService` → `AuditService` in `Program.cs`.
- For this session, ownership trail staging is **skipped** because owner is NULL.
- **Not the failure path for this request.**

---

## 10–12. Actual exception (logs vs proven mechanism)

### AuthService log correlation

Search of Cursor terminals and available AuthService `*.log` files for:

- `Error re-queuing counseling session bb000001-2222-2222-2222-000000000007`
- SessionId string  

→ **No matching live log line recovered** (stdout not captured; Serilog `logs/` dir absent; existing `auth-*.log` files are older).

### Proven failure mechanism (DB + code + payload)

PostgreSQL constraint on `counseling_sessions`:

```text
counseling_sessions_session_type_check
CHECK (session_type = ANY (ARRAY['Initial','Followup','Recheck','Urgent']))
```

UAT payload sets **`sessionType": "FOLLOW_UP"`** (master UI code).

`ReQueueSessionAsync` (relational path) does:

```csharp
var sessionTypeValue = trimmedSessionType ?? sessionMeta.SessionType;
// ExecuteUpdateAsync → SetProperty(x => x.SessionType, sessionTypeValue)
```

with **no** master→DB mapping (`FOLLOW_UP` → `Followup`).

FE ReQueueModal defaults to `defaultSessionTypeCode('requeue')` → `'FOLLOW_UP'` and sends it **without** `sessionTypeCodeToDb()` (which already documents the DB allowlist).

Therefore Postgres rejects the `ExecuteUpdateAsync` / session update with a **check constraint violation** on `session_type`. That exception is caught by:

```csharp
catch (Exception ex) {
  // LogError...
  Message = "Error re-queuing patient";
  FailureKind = BadRequest; // → HTTP 400
}
```

**Actual exception type/message from server log:** not captured in files.  
**Expected exception class (mechanism-proven):** Npgsql / Postgres check violation on `counseling_sessions_session_type_check` attempting to write `'FOLLOW_UP'`.

---

## 13. Exact throw site

**Primary:** `CounselingWorkflowService.ReQueueSessionAsync` → relational **`ExecuteUpdateAsync`** setting `SessionType` to the unmapped master code **`FOLLOW_UP`** (fails DB CHECK).

Not: ownership CAS, Version CAS, branch auth, SurgeryDone seal, audit staging (skipped), or BranchId `Guid.Empty` queue insert (not reached if update fails first).

---

## 14. Root cause

**Slice 8 ReQueue writes FE master `sessionType` codes into `counseling_sessions.session_type` without mapping to the DB CHECK allowlist (`Initial|Followup|Recheck|Urgent`).**  
Default ReQueue UI value `FOLLOW_UP` violates the constraint → remapped 400 `"Error re-queuing patient"`.

In-memory Slice 8 test `Requeue_PreservesIntentionSessionTypeNotes` asserts `SessionType == "FOLLOW_UP"` and **does not enforce** the Postgres CHECK — false green coverage for this production failure.

---

## 15. Slice 10 contribution

**None.** Presentation/label/JSDoc/tests only. Not on `ReQueueSessionAsync` path.

---

## 16. Slice 8 ReQueue implicated?

**Yes** — backend accepts/persists invalid `sessionType`; FE ReQueue path sends unmapped master code. Certified ownership/CAS/ReQueue→NULL semantics are separate and not disproven by this session’s NULL owner.

---

## 17. Data / config / environment?

**Not primarily.** Session/branch/queue data are coherent. Failure is **code contract mismatch** (master code vs DB CHECK), reproducible for any ReQueue that sends `FOLLOW_UP` against Postgres.

---

## 18. Recommended targeted next action (no fix in this task)

Authorize a **narrow Slice 8 / ReQueue sessionType mapping fix** only after product approval, e.g.:

- Map master → DB via existing `sessionTypeCodeToDb` (or equivalent server-side normalize) before write; **and/or**
- Backend reject unknown `sessionType` with an explicit 400 message (not generic remap); **and**
- Fix/add Postgres-aware test so `FOLLOW_UP` is not asserted as a stored DB value.

Do **not** treat as Slice 10 work. Do not start Slice 11/12.

---

## Classification (exactly one)

**B. Slice 8 ReQueue defect**

---

## Auth log note

**Actual stack trace text: NOT AVAILABLE** in recovered logs. Mechanism is established by: Network payload `FOLLOW_UP` + live CHECK definition + ReQueue write path + null-owner audit skip + Version/CounselorId match.

---

## Final status

**ROOT-CAUSE INVESTIGATION COMPLETE — FIX NOT IMPLEMENTED**
