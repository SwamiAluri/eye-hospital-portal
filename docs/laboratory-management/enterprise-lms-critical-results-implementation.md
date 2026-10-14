# L-CRT-01 — Critical Results  
# Implementation Report

**Date:** 2026-10-12  
**Authorization stamp:** `PRODUCT_DECISIONS_CLOSED_L_CRT_01_AUTHORIZED`  
**Closure:** [enterprise-lms-critical-results-decision-closure.md](./enterprise-lms-critical-results-decision-closure.md)  
**Mode:** Bounded first-slice engineering implementation  

**Status:** `IMPLEMENTATION_COMPLETE_READY_FOR_PRE_UAT`  
(see companion PRE-UAT verification for evidence)

---

## 1. Scope implemented

| Capability | Delivered |
|---|---|
| Orthogonal `CriticalResultEvent` | Yes — does not change `ResultStatus` |
| Exact ResultVersion binding | Yes — immutable per event |
| Manual Critical classification | Yes — explicit mutation |
| Critical staff work queue | Yes — `/dashboard/lms/results/critical` |
| Result Detail Critical panel | Yes — `CriticalResultPanel` |
| In-app notification intent | Yes — AuthService `push-tenant` |
| LaboratoryApi acknowledgement | Yes — mandatory evidence |
| Critical audit (fail-closed) | Yes — `CREATE_CRITICAL_EVENT` / `ACKNOWLEDGE_CRITICAL_EVENT` |
| Dedicated permission catalog | Yes — view/manage/acknowledge; **no role grants** |
| Tenant + branch authorization | Yes |
| Idempotency + RowVersion concurrency | Yes |
| Automated tests | Yes (BE / FE / AuthService) |

---

## 2. Architecture

```text
LmsResult (ResultStatus unchanged)
   └── LmsCriticalResultEvent
         ResultId + ResultVersionNumber (unique per tenant)
         Status: Open | Acknowledged
         NotificationIntentStatus: NotAttempted | Emitted | Failed | Unavailable

LaboratoryApi
  → PlatformAuditClient → AuthService internal audit
  → PlatformNotificationClient → AuthService push-tenant (in-app intent only)
```

Critical acknowledgement does **not** modify ResultStatus, OrderTest, Specimen, Collection, Receiving, or Barcode.

---

## 3. Schema

**Migration:** `20261012130000_AddLmsCriticalResultEvents`

**Table:** `lms_critical_result_events`

Unique index: `(tenant_id, result_id, result_version_number)`  
FK: `result_id` → `lms_results.id` (Restrict)  
Concurrency: `row_version` token  

Idempotency reuses `lms_result_idempotency` with operations:
- `create_critical_event`
- `acknowledge_critical_event`

---

## 4. API

| Method | Route | Permission |
|---|---|---|
| GET | `/api/lms/testing/critical-work-queue` | critical.view \| manage \| acknowledge |
| GET | `/api/lms/testing/results/{id}/critical?operatingBranchId=` | critical.view \| manage \| acknowledge |
| POST | `/api/lms/testing/results/{id}/critical` | `lms.results.critical.manage` |
| POST | `/api/lms/testing/results/{id}/critical/{criticalEventId}/acknowledge` | `lms.results.critical.acknowledge` |

Server owns tenant, actor, timestamps, ResultVersion, Critical status.

---

## 5. Permissions (catalog only)

| Code | Purpose |
|---|---|
| `lms.results.critical.view` | Queue / detail read |
| `lms.results.critical.manage` | Manual classification |
| `lms.results.critical.acknowledge` | Acknowledgement |

Seeded via `EnterpriseLmsTestingPermissionCatalog` + existing seeder. **No production role grants.**

---

## 6. Audit

| Action | Resource |
|---|---|
| `CREATE_CRITICAL_EVENT` | `LmsCriticalResultEvent` |
| `ACKNOWLEDGE_CRITICAL_EVENT` | `LmsCriticalResultEvent` |

Allowlisted in `InternalAuditController`. Fail-closed: audit failure reverts create/ack.

---

## 7. Notification boundary

- Intent type: `lab.result.critical`
- Channel: in-app tenant push only
- LaboratoryApi does **not** call Twilio/SMS/WhatsApp/SMTP
- Notification failure → event remains Open; `NotificationIntentStatus=Unavailable|Failed`; not acknowledgement

---

## 8. Idempotency / concurrency

- Same Idempotency-Key + hash → replay
- Same key + different hash → `409 idempotency_conflict`
- Stale Critical `RowVersion` on ack → `409 concurrency_conflict`
- Duplicate open/create per ResultVersion → `409 already_critical`

---

## 9. UI

| Surface | Change |
|---|---|
| `/dashboard/lms/results/critical` | Real `CriticalWorkbench` (event-backed) |
| Result Detail | `CriticalResultPanel` for TV/CA results |
| Capability registry | `results-critical` → `implemented` |

Honesty copy: Critical ≠ Result status / Final / Released / patient-visible. No fake KPIs.

---

## 10. Tests (automated)

| Suite | Result |
|---|---|
| `CriticalResultServiceTests` + route contract + Result Auth/Verify filter | **50 passed** |
| AuthService permission + Critical audit allowlist (alt `-o`) | **7 passed** |
| Vitest Critical + Testing UI contracts | **10 passed** |

---

## 11. Explicit out-of-scope (unchanged)

Automated thresholds · Critical Rule masters · escalation timers/on-call · Reporting/Final/Released/PDF · patient Critical alerts · Amendments · Instrument/Runs/QC · Referral · Billing · Pathology bridge · analytics KPIs · production role grants · Critical ResultStatus · L-TST/L-VER/L-AUTH lifecycle changes

---

## 12. Known limitations

1. Permission catalog is seeded; **UAT requires temporary grants** or Admin wildcard — no production role grants from this slice.  
2. In-app intent delivery depends on AuthService NotificationHub connectivity; unavailable intent is recorded honestly without closing the event.  
3. No escalation SLA / multi-channel clinical delivery.  
4. Manual UAT not performed in this task.

---

## 13. Next gate

**PRE-UAT verification** → Manual UAT (separate) → Acceptance  

Do not claim UAT passed or production ready from this document.
