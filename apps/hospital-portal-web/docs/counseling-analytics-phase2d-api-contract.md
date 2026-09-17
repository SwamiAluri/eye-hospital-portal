# Counseling Analytics API — Phase 2D contract

**Scope:** Backend Analytics only (`summary`, `trends`, `followup-aging`).  
**Not in scope:** Follow-up Center due dates, frontend filters, migrations/indexes, financial KPIs.

**Owner:** `AuthService` → `CounselingController` + `CounselingAnalyticsService`  
**Permission:** `counseling_sessions.read`

---

## Shared date-window semantics

`SessionDate` is a **date** column. All Analytics session windows use **UTC calendar dates**.

### Half-open interval

```
SessionDate >= FromInclusive  AND  SessionDate < ToExclusive
```

| Mode | How resolved | FromInclusive | ToExclusive |
|------|--------------|---------------|-------------|
| **period** (default) | `period` days (default 30, min 1→30, max 366) | `UtcNow.Date.AddDays(-period)` | `UtcNow.Date.AddDays(1)` (through end of today UTC) |
| **custom** | both `from` and `to` supplied | `from.Date` | `to.Date.AddDays(1)` |

### Precedence

1. If **both** `from` and `to` are present → **custom** (ignores `period` for bounds; response `period` is null).
2. Else → **period** mode.

### Validation

- `from` without `to`, or `to` without `from` → **400** `{ message }`
- `from.Date > to.Date` → **400**
- No open-ended custom ranges.

### Summary vs Trends

**Identical** window helper (`CounselingAnalyticsDateWindow.Resolve`).  
They cannot drift: both call the same resolver with the same inputs.

### Callbacks

Callback metrics use the **same** `[FromInclusive, ToExclusive)` on **`CallbackDate`** (existing date semantics), not `SessionDate`.

---

## GET `/api/Counseling/analytics/summary`

### Query

| Param | Required | Notes |
|-------|----------|-------|
| `period` | no (default 30) | Preset days; ignored for bounds when custom range used |
| `branchId` | no | `session.BranchId` / callback `BranchId` |
| `counselorId` | no | `session.CounselorId`; callbacks filtered via related session |
| `from`, `to` | together | Custom range |

### Metrics (PD13 partition — Phase 2Z)

Sessions are classified into **exactly one** mutually exclusive outcome via `CounselingAnalyticsOutcomeClassifier`:

| Partition | Rule (precedence order) |
|-----------|-------------------------|
| Exception | Agreed + Declined intention marker; or Declined marker + PendingDecision |
| PendingDecision | `PendingDecision == true` (includes pending + agreed) |
| Agreed | `PatientAgreedToSurgery == true` (not pending) |
| Declined | `PatientAgreedToSurgery == false` && not pending |
| OtherUnclassified | null agreement without pending |

| Metric | Formula |
|--------|---------|
| `totalSessions` | Count sessions in window + filters |
| `agreedCount` | PD13 Agreed partition count |
| `declinedCount` | PD13 Declined partition count |
| `undecidedCount` | Legacy alias — same as `pendingDecisionCount` |
| `pendingDecisionCount` | PD13 PendingDecision partition count |
| `exceptionCount` | PD13 Exception partition count |
| `otherUnclassifiedCount` | PD13 OtherUnclassified partition count |
| `eligibleOutcomeSessions` | Agreed + Declined + PendingDecision (excludes Exception/Other) |
| `conversionRate` | agreed / **eligibleOutcomeSessions** × 100 (0 if eligible=0) |
| `decisionRate` | (agreed + declined) / **eligibleOutcomeSessions** × 100 (0 if eligible=0) |
| `avgDaysToDecision` | Avg `(DecisionDate - SessionDate).TotalDays` where DecisionDate set; **0** if none |
| `bySurgeryType` | Top 8 by count of non-empty `RecommendedSurgery` |
| `bySessionType` | Group by `SessionType` |
| `callbackTotal` / `callbackCompleted` / `callbackCompletionRate` | Callbacks in window; completed = `CallbackStatus == "Completed"` |

Response also echoes: `windowMode` (`period`|`custom`), `from`, `toExclusive`, `branchId`, `counselorId`, `generatedAt`.

---

## GET `/api/Counseling/analytics/trends`

Same filters/window as Summary.

Daily points:

```json
{ "date": "yyyy-MM-dd", "count": N, "agreedCount": M }
```

Consistency: for the same filters/window,

`sum(trend.count) == summary.totalSessions`  
`sum(trend.agreedCount) == summary.agreedCount`

---

## GET `/api/Counseling/analytics/followup-aging`

### Population (CRITICAL)

**`PendingDecision == true` only.**

This is **NOT** the Follow-up Center Active population (PatientIntention allowlist).

Do not merge these definitions.

### Query

| Param | Notes |
|-------|--------|
| `branchId` | optional |
| `counselorId` | optional (`CounselorId`) |
| `period` | optional; if no custom range and no period → **default 365** (bounds scan; keeps long-pending visible) |
| `from`, `to` | optional custom SessionDate window (same validation) |

Buckets (unchanged boundaries, days since SessionDate vs UTC today):

| Key | Days |
|-----|------|
| `bucket_0_3` | ≤ 3 |
| `bucket_4_7` | 4–7 |
| `bucket_8_14` | 8–14 |
| `bucket_15_plus` | ≥ 15 |

### Response

- `totalPending` — accurate DB count
- `counts` — accurate per-bucket DB counts
- `buckets` — item lists (patient drill-down), **capped at 100 items/bucket**
- `truncated` — true when any bucket list is shorter than its count
- `population`: `"PendingDecision"`

Existing FE that uses `buckets.*.length` remains compatible for small tenants; use `counts` when lists are truncated (frontend wiring later).

---

## Authorization

All three endpoints: `counseling_sessions.read`.

---

## GET `/api/Counseling/sessions` — drill-down filters (Phase 2Z)

Used by `/dashboard/counsellors-desk/sessions` for analytics drill-down.

| Param | Notes |
|-------|--------|
| `branchId`, `counselorId` | optional scope |
| `sessionDateFrom`, `sessionDateTo` | inclusive `SessionDate` bounds (`SessionDateTo` is `<=`) |
| `pendingDecision` | bool |
| `patientAgreedToSurgery` | bool |
| `recommendedSurgery` | exact match |
| `search` | session number |
| `page`, `pageSize` | pagination |

**Drill-down routing (Phase 2Z):**

- PendingDecision aging / funnel Pending → session list with `pendingDecision=true`
- Follow-up workload only → `/dashboard/counsellors-desk/surgery-followup` (Active Follow-up Center)
- PendingDecision **never** routes to surgery-followup

Analytics half-open `[from, toExclusive)` → pass `sessionDateTo = toExclusive - 1 day` (date only).

---

## Explicit non-goals

- Follow-up Center due dates (+7/+30/+14)
- Financial / insurance / OT finalization / claim metrics
- DB migrations or indexes (candidates → Phase 2E)
