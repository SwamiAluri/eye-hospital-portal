# Counseling Follow-up Center API — Phase 2B contract

**Scope:** Backend Follow-up list/search/pagination/stats only.  
**Not in scope:** due-date formulas, FollowUps table, migrations/indexes, Schedule Visit, reminder delivery, Analytics endpoints, frontend changes.

**Owner:** `AuthService` → `CounselingController` + `FollowupListService`  
**Permission:** `counseling_sessions.read` on all endpoints below.

Active Follow-up Center populations are **PatientIntention-based**.  
Analytics Aging / `PendingDecision` is a **different** population and must not be merged.

---

## Shared pagination

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `page` | int | 1 | Clamped to ≥ 1 |
| `pageSize` | int | 20 | Clamped to 1–100 |

Response envelope (camelCase JSON):

```json
{
  "total": 0,
  "page": 1,
  "pageSize": 20,
  "items": []
}
```

- `total` = count **after** population + branch + intention (when applicable) + `q`.
- `items.length <= total` always.
- `total` is **not** derived from the current page.

---

## Search (`q`)

Optional string. Trimmed; matched **case-insensitively** via `ToLower().Contains(...)`.

### Active / Cold (counseling sessions)

| Field | Source |
|-------|--------|
| Patient name | `patients.first_name + ' ' + patients.last_name` |
| UHID / MRN | `patients.medical_record_number` |
| Phone | `patients.contact_number` |
| Procedure | `counseling_sessions.recommended_surgery` |

Search is applied in the **database query** (join to patients) **before** `Count` / `Skip` / `Take`.

### Post-surgery (`patient_journey`)

| Field | Source |
|-------|--------|
| Patient name | patient first/last |
| UHID / MRN | journey `uhid` **or** patient MRN |
| Phone | patient contact number |
| Procedure | journey `procedure_name` |

Empty / whitespace `q` is ignored (no search filter).

---

## GET `/api/Counseling/followups/active`

### Population (unchanged)

`TenantId` match, `DeletedAt == null`, and `PatientIntention` ∈:

- WillingWeek, WillingMonth, WillingQuarter, WillingCallToConfirm  
- Undecided, WaitingFinancial, WaitingFear  

**Not included** (orphans / cold / other): WillingNow, WillingTwoWeeks, WillingSixMonths, SecondOpinion, Declined, ReferredElsewhere.

### Query params

| Param | Notes |
|-------|--------|
| `branchId` | Optional Guid; `session.BranchId` |
| `intention` | Optional exact `PatientIntention` |
| `q` | Optional search (above) |
| `page`, `pageSize` | Pagination |

### Ordering

1. `LastContactDate == null` first  
2. Then ascending `LastContactDate`  
3. Then `Id` (deterministic tie-break)

### Item fields

`sessionId`, `patientId`, `patientName`, `uhid`, `phone`, `branchId`, `recommendedSurgery`, `patientIntention`, `sessionDate`, `lastContactDate`, `contactAttemptCount`, `lastContactOutcome`, `escalationStatus`, `overdueSinceDate`, `alertLevel`

`alertLevel` (existing semantics, no due-date):

| Condition | Level |
|-----------|-------|
| EscalationStatus = SupervisorAlert | Critical |
| EscalationStatus = Escalated | High |
| EscalationStatus = Overdue | Medium |
| LastContactDate null | Medium |
| else | Normal |

**No** `dueDate` / `followUpDueDate` / `nextDueDate` fields.

---

## GET `/api/Counseling/followups/cold-leads`

### Population (unchanged)

`TenantId`, `DeletedAt == null`, `PatientIntention` ∈ { Declined, ReferredElsewhere }.

### Query params

`branchId?`, `q?`, `page`, `pageSize`  
(No intention filter — population already fixed.)

### Ordering

`UpdatedAt ?? CreatedAt` descending, then `Id`.

### Item fields

Same contact/session projection as before, plus `additionalNotes`. No alertLevel / due date.

---

## GET `/api/Counseling/followups/post-surgery`

### Population (unchanged)

`patient_journey`: `TenantId`, `IsDischarged == true`, `DeletedAt == null`, optional `branchId`.

### Query params

`branchId?`, `q?`, `page`, `pageSize`

### Ordering

`DischargedAt` descending, then `Id`.

### Item fields

`journeyId`, `patientId`, `patientName`, `uhid`, `phone`, `branchId`, `sessionId` (latest counseling session for patient, nullable), `surgeryType`, `dischargedAt`, `daysSinceDischarge` (computed from `DischargedAt` at read time — **not** a due date), `conditionAtDischarge`, `dischargeDate`, `pendingPostOpVisits`.

---

## GET `/api/Counseling/followups/stats`

Server-authoritative aggregates. **Scope is always the filtered population** (`filters.scope = "filtered"`), never the current list page.

### Query params

| Param | Applies to |
|-------|------------|
| `branchId` | Active, Cold, PostSurgery |
| `intention` | **Active only** (Cold/Post ignore it) |
| `q` | Active, Cold, PostSurgery (same search semantics as lists) |

### Response

```json
{
  "filters": {
    "branchId": null,
    "intention": null,
    "q": null,
    "scope": "filtered"
  },
  "active": {
    "total": 0,
    "urgentHigh": 0,
    "neverContacted": 0,
    "averageAttempts": null
  },
  "cold": {
    "total": 0,
    "declined": 0,
    "referredElsewhere": 0,
    "averageAttempts": null
  },
  "postSurgery": {
    "total": 0,
    "over30Days": 0,
    "pendingPostOpVisits": 0,
    "averageDaysSinceDischarge": null
  }
}
```

### Metric definitions

| Metric | Formula / source |
|--------|------------------|
| `active.total` | Count of Active population under filters (= list `total`) |
| `active.urgentHigh` | Same set where `EscalationStatus` ∈ { SupervisorAlert, Escalated } |
| `active.neverContacted` | Same set where `LastContactDate == null` |
| `active.averageAttempts` | Average of `ContactAttemptCount`; **null** if total = 0 |
| `cold.total` | Cold population count under filters |
| `cold.declined` / `referredElsewhere` | Counts by intention within filtered cold set |
| `cold.averageAttempts` | Average attempts; null if empty |
| `postSurgery.total` | Discharged journey count under filters |
| `postSurgery.over30Days` | `DischargedAt <= UtcNow - 30 days` |
| `postSurgery.pendingPostOpVisits` | Count of incomplete (`Completed == false`) post-op visits for patients in the filtered journey set |
| `postSurgery.averageDaysSinceDischarge` | Average `(UtcNow - DischargedAt).TotalDays` where DischargedAt set; null if none |

Nullable averages: empty set → `null` (not `0`).

---

## Explicit non-goals (Phase 2B)

- No due-date business rules (Active +7 / Cold +30 / Post +14 remain frontend heuristics until a business decision).
- No `FollowUps` table, columns, indexes, or migrations.
- Analytics summary / trends / aging unchanged.
- Schedule Visit / reminder delivery unchanged.

---

## Implementation files

- `Services/FollowupQueryContracts.cs`
- `Services/FollowupListService.cs`
- `Models/Counselor/FollowupListModels.cs`
- `Controllers/CounselingController.cs` (delegates to service)
- Tests: `AuthService.Tests/FollowupListServiceTests.cs`, `FollowupQueryContractsTests.cs`
