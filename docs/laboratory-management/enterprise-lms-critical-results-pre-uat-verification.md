# L-CRT-01 — Critical Results  
# PRE-UAT Environment & Evidence Verification

**Date:** 2026-10-12  
**Authorization stamp:** `PRODUCT_DECISIONS_CLOSED_L_CRT_01_AUTHORIZED`  
**Implementation report:** [enterprise-lms-critical-results-implementation.md](./enterprise-lms-critical-results-implementation.md)  
**Decision closure:** [enterprise-lms-critical-results-decision-closure.md](./enterprise-lms-critical-results-decision-closure.md)

**PRE-UAT status:** `PRE_UAT_READY_FOR_MANUAL_UAT`

**MANUAL UAT NOT EXECUTED.**

---

## Final status rationale

All automated Critical / idempotency / PostgreSQL concurrency / audit / notification / permission / regression evidence below **passed**, and runtime services were brought current.

**Draft Result UAT prerequisite resolved (2026-10-12):** one legitimate Draft was created via `ResultService.CreateDraftAsync` (L-TST-01A path) against an existing Received Specimen / Ordered OrderTest with Active Numeric catalogue. No Critical classify/ack/notification. See §10.

Do **not** treat this document as Acceptance.

---

## 1. Product decision authorization

| Check | Result | Evidence |
|---|---|---|
| Product decision authorization verified | **PASS** | Closure stamp `PRODUCT_DECISIONS_CLOSED_L_CRT_01_AUTHORIZED` present in decision-closure + implementation docs. L-TST-01A / L-VER-01 / L-AUTH-01 product decisions not reopened. |

---

## 2. Implementation scope boundary

| In scope (authorized) | Verified present |
|---|---|
| CriticalResultEvent + ResultVersion binding | Yes — `LmsCriticalResultEvent`, unique `(tenant_id, result_id, result_version_number)` |
| Manual Critical classification | Yes — `CriticalResultService.CreateAsync` |
| Critical work queue + detail | Yes — `ListWorkQueueAsync` / `ListForResultAsync` + FE CriticalWorkbench / CriticalResultPanel |
| Acknowledgement + mandatory evidence | Yes |
| In-app notification intent | Yes — `PlatformNotificationClient` → AuthService `api/notifications/internal/push-tenant` |
| Audit + permissions + tenant/branch + idempotency + RowVersion | Yes |
| Automated tests | Yes |

| Out of scope (must NOT be implemented) | Result |
|---|---|
| Critical ResultStatus | **PASS** — no Critical status; `lms_results` has no critical column; UI/tests assert ResultStatus ≠ Critical |
| Automated thresholds / Critical Rule engine / escalation / on-call | **PASS** — no engine; catalogue `CriticalThresholdConfigRef` is a pre-existing nullable config *reference* field only (not L-CRT-01 rules) |
| Reporting / Final / Released / Published / PDF | **PASS** — not in Critical slice |
| Patient Critical alerts / SMS / email | **PASS** — LaboratoryApi has no Twilio/WhatsApp/SMTP/SendGrid; notification is in-app intent only |
| Amendments / Instrument/Runs/QC / Referral / Billing / Pathology SoT / analytics KPIs | **PASS** — not introduced |
| Production role grants | **PASS** — `critical_role_grants = 0` |

**Unauthorized capability found:** none.

---

## 3. Migration / database evidence

| Check | Result | Evidence |
|---|---|---|
| Migration applied | **PASS** | `__EFMigrationsHistory` contains `20261012130000_AddLmsCriticalResultEvents` (with L-TST / L-VER / L-AUTH migrations) |
| Table `lms_critical_result_events` | **PASS** | 18 columns including `row_version`, notification intent fields, acknowledgement fields |
| FK to `lms_results` | **PASS** | `FK_lms_critical_result_events_lms_results_result_id` |
| Unique protection | **PASS** | `IX_lms_critical_result_events_tenant_id_result_id_result_versio` UNIQUE on `(tenant_id, result_id, result_version_number)` |
| No Critical ResultStatus column | **PASS** | `information_schema` — zero `lms_results` columns matching `%critical%` |
| No fake Critical events for UAT | **PASS** | After cleanup: `COUNT(*) = 0` on `lms_critical_result_events` (orphan ephemeral PRE-UAT rows from a failed first concurrency cleanup were deleted; not UAT seed data) |

---

## 4. PostgreSQL concurrency evidence

| Check | Result | Evidence |
|---|---|---|
| PostgreSQL concurrency verified | **PASS** | Added + executed `CriticalResultPostgresConcurrencyTests` (real Npgsql via LaboratoryApi `local.settings.json` DefaultConnection) |

Commands:

```text
dotnet test LaboratoryApi.Tests --filter FullyQualifiedName~CriticalResultPostgresConcurrency
→ Passed: 2 / Failed: 0
```

| Test | Expected | Observed |
|---|---|---|
| `PostgreSQL_Concurrent_Classify_Same_Version_Creates_Exactly_One_Event` | 8 concurrent Create against same tenant+result+version → exactly 1 event; others `already_critical` | **PASS** |
| `PostgreSQL_Concurrent_Acknowledge_One_Wins_Others_Conflict` | Concurrent ack same RowVersion → 1 success; others `concurrency_conflict` / `already_acknowledged`; no lost update | **PASS** |

---

## 5. Idempotency evidence

| Scenario | Result | Evidence |
|---|---|---|
| A. Same key + same hash → replay | **PASS** | `Create_Idempotency_Replay_And_Hash_Conflict`, `Acknowledge_Idempotency_Replay_And_Hash_Conflict` |
| B. Same key + different hash → `idempotency_conflict` | **PASS** | Same tests |
| C. Repeated classification → no duplicate | **PASS** | `Duplicate_Classification_Same_Version_Conflicts` + PG unique path |
| D. Repeated acknowledgement → no duplicate mutation | **PASS** | Ack idempotency replay + PG concurrent ack |

---

## 6. Audit evidence

| Check | Result | Evidence |
|---|---|---|
| Audit allowlist | **PASS** | AuthService `InternalAuditController` includes `CREATE_CRITICAL_EVENT`, `ACKNOWLEDGE_CRITICAL_EVENT`; Auth tests `Allowlist_Covers_Lms*` |
| Create fail-closed | **PASS** | `Audit_Failure_On_Create_Reverts_Event` → `audit_unavailable`, event removed |
| Acknowledge fail-closed | **PASS** | `Audit_Failure_On_Acknowledge_Reverts_Mutation` → event remains Open, evidence cleared, RowVersion restored |

---

## 7. Notification evidence

| Check | Result | Evidence |
|---|---|---|
| Boundary LaboratoryApi → PlatformNotificationClient → AuthService push-tenant | **PASS** | `PlatformNotificationClient` posts `api/notifications/internal/push-tenant`, type `lab.result.critical` |
| No Twilio/SMS/WhatsApp/SMTP/email in LaboratoryApi | **PASS** | Source grep — no integrations |
| Success keeps Open until ack | **PASS** | `TechnicalVerified_May_Be_Classified_Critical_With_Version_Binding` |
| Failure/unavailable honesty | **PASS** | `Notification_Unavailable_Preserves_Open_Event_Without_Ack` |

---

## 8. Permission / UAT actor evidence

| Check | Result | Evidence |
|---|---|---|
| Catalog codes present + active | **PASS** | After AuthService restart seed: `lms.results.critical.view|manage|acknowledge` all `IsActive=true` (3 new rows; log: “no role grants”) |
| No production role grants | **PASS** | `critical_role_grants = 0` |
| UAT actor effective permission | **PASS** | Tenant `155fe198-…` user `admin@test.com` (`dddddddd-…`) has `ADMIN` via `app_user_roles` → AuthService wildcard `*` (no Critical role grants required) |

---

## 9. Runtime service evidence

| Service | Result | Evidence |
|---|---|---|
| AuthService running | **PASS** | Port 5073 LISTENING; swagger `200`; startup seeded Critical permissions |
| LaboratoryApi running with Critical routes | **PASS** | Port 7076 LISTENING; `admin/functions` lists `LmsCriticalWorkQueue`, `LmsResultCriticalCreate`, `LmsResultCriticalList`, `LmsResultCriticalAcknowledge`; unauthenticated queue → **401** (route present; was **404** on stale host before restart) |
| Auth health path | **PASS** (degraded) | `/api/health` returns **400** (known env quirk); swagger proves host up |

---

## 10. Eligible UAT data (no unnecessary PHI)

| Check | Result | Evidence |
|---|---|---|
| Eligible TV/CA Result | **PASS** | Two ClinicallyAuthorized results on UAT tenant/branch (see IDs below) |
| Draft for negative UAT | **PASS** | One Draft via L-TST-01A `ResultService.CreateDraftAsync` (see below) |
| Fake Critical data | **PASS** | Critical event count **0** before and after Draft create |

Eligible Results (no patient names/MRNs):

| Result ID | ResultVersion | ResultStatus | Tenant | Branch |
|---|---|---|---|---|
| `fa2eee59-20cc-4f34-9a02-bb34fe2a9765` | 1 | ClinicallyAuthorized | `155fe198-6ae5-4a01-9254-ead5b427247e` | `74c014cf-9570-4824-bdf9-b369ea11a8f4` |
| `d4ab83db-c155-4df7-91f6-c56e8896d251` | 4 | ClinicallyAuthorized | same | same |
| `64379fb0-9c6d-40ab-aad1-a9cc2f4fbb6a` | 1 | **Draft** | same | `a586ba17-91df-4636-8950-0f0f653b90d5` |

Draft creation context: OrderTest `166bd4b9-…` remains **Ordered**; Specimen `95c097dd-…` remains **Received**; Order `LAB-20261011-000001`; catalogue Active Numeric `UAT-ORD-01C-001` v2. Not verified / not authorized / not Critical.

---

## 11. UI evidence

| Check | Result | Evidence |
|---|---|---|
| `/dashboard/lms/results/critical` loads | **PASS** | HTTP **200**, response length ~20k |
| Queue event-backed / no mock rows / no fake KPIs | **PASS** | CriticalWorkbench honesty copy; FE tests; capability implemented |
| Result Detail Critical panel (code) | **PASS** | `CriticalResultPanel` gated to TV/CA; Draft not eligible; permission-aware Mark/Acknowledge |
| Authenticated Result Detail interaction | **NOT EXECUTED** | Manual UAT only |
| UI shows ResultStatus=Critical | **PASS** — does not | FE test asserts statuses do not include Critical |

---

## 12. Test suite evidence

### LaboratoryApi

| Suite | Result |
|---|---|
| Full `LaboratoryApi.Tests` | **PASSED 266 / FAILED 0** |
| Critical (+ PG concurrency) | **PASSED 19** (filter `~CriticalResult`) |
| Critical + Authz + Verify filter | **PASSED 55** |
| Shell model includes Critical entity | **PASSED** (count updated 25→26 for authorized `LmsCriticalResultEvent`) |

### Frontend

| Suite | Result |
|---|---|
| Critical UI + Testing UI contracts | **PASSED 10 / FAILED 0** |

```text
npx vitest run src/app/dashboard/lms/results/critical/enterprise-lms-critical-ui.test.ts
               src/app/dashboard/lms/testing/enterprise-lms-testing-ui.test.ts
```

### AuthService

| Suite | Result |
|---|---|
| Enterprise LMS testing permissions + LMS audit allowlist | **PASSED 7 / FAILED 0** (`-o …/bin/crt-preuat`) |

### Pathology

| Suite | Result |
|---|---|
| Dedicated Pathology test project | **NOT EXECUTED** — no Pathology `*Tests*.csproj` found in microservices |
| LaboratoryApi Pathology table regression | **PASSED** — `LaboratoryDbContextShellTests.Source_Does_Not_Reference_Legacy_Pathology_Tables` |

### Upstream regression (L-TST / L-VER / L-AUTH)

| Check | Result | Evidence |
|---|---|---|
| Draft / Result create-update unchanged | **PASS** | Included in full 266 suite + Critical fixture asserts OrderTest Ordered / Specimen Received after classify |
| Technical Verification unchanged | **PASS** | ResultVerification filter in 55-test run |
| Clinical Authorization unchanged; no Critical ack required | **PASS** | ResultAuthorization tests + authorize does not call Critical service |
| OrderTest / Collection / Specimen / Receiving / Accession / Barcode / Pathology | **PASS** | Critical service asserts OrderTest Ordered; Pathology SoT not used; barcode/shell regressions in full suite |

---

## 13. PRE-UAT checklist

| # | Item | Result |
|---|---|---|
| 1 | Product decision authorization verified | **PASS** |
| 2 | Implementation scope verified | **PASS** |
| 3 | Migration applied | **PASS** |
| 4 | Database schema verified | **PASS** |
| 5 | Unique Critical event protection verified | **PASS** |
| 6 | PostgreSQL concurrency verified | **PASS** |
| 7 | Idempotency verified | **PASS** |
| 8 | Audit allowlist verified | **PASS** |
| 9 | Audit fail-closed verified | **PASS** |
| 10 | Notification boundary verified | **PASS** |
| 11 | Notification failure verified | **PASS** |
| 12 | Permission catalog verified | **PASS** |
| 13 | No production role grants | **PASS** |
| 14 | UAT actor effective permission verified | **PASS** (`admin@test.com` ADMIN `*`) |
| 15 | AuthService running | **PASS** |
| 16 | LaboratoryApi running | **PASS** (Critical functions registered) |
| 17 | Eligible TechnicalVerified/ClinicallyAuthorized Result exists | **PASS** (2× CA) |
| 18 | Draft Result exists for negative UAT | **PASS** (`64379fb0-…`, Draft v1) |
| 19 | Critical queue loads | **PASS** |
| 20 | Result Detail loads | **PASS** (page/capability; authenticated panel **NOT EXECUTED**) |
| 21 | Upstream regressions pass | **PASS** |
| 22 | Backend tests pass | **PASS** (266/266) |
| 23 | Frontend tests pass | **PASS** (10/10) |
| 24 | AuthService tests pass | **PASS** (7/7) |
| 25 | No fake Critical data | **PASS** |
| 26 | No fake KPIs | **PASS** |
| 27 | No Critical ResultStatus | **PASS** |
| 28 | No patient Critical disclosure | **PASS** |
| 29 | No unauthorized scope detected | **PASS** |

---

## 14. Environment actions taken (verification only)

1. Rebuilt + restarted AuthService → seeded 3 Critical permission catalog rows (no role grants).  
2. Rebuilt + restarted LaboratoryApi `func start --port 7076` → Critical Azure Functions registered (stale host previously returned 404).  
3. Added minimum PG concurrency evidence tests + ack audit/idempotency unit tests.  
4. Updated shell entity-count test for authorized Critical entity.  
5. Removed orphan ephemeral PRE-UAT Critical events / leftover tenants from a failed first cleanup attempt.

No production role grants. No product architecture changes beyond verification evidence.

---

## 15. Blockers

None remaining for PRE-UAT environment readiness.

---

## FINAL PRE-UAT STATUS

**PRE_UAT_READY_FOR_MANUAL_UAT**

**UAT_DRAFT_RESULT_READY** (Draft `64379fb0-9c6d-40ab-aad1-a9cc2f4fbb6a`)

**MANUAL UAT NOT EXECUTED.**

**NEXT GATE:** **Manual UAT** (separate task). Do not start Reporting / Amendments / Automated Critical Rules / Escalation / Billing / Referral / Instrument-Runs-QC / patient communication.
