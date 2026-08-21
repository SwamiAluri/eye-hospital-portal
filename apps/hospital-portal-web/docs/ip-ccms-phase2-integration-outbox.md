# IP × CCMS Phase 2 — Integration Outbox & Domain Consolidation

Status: **Complete after cross-check** (validated against `02-phase-2-integration-outbox-and-domain-consolidation.md` §1–§11)

---

## 1. Lifecycle integration analysis

| Flow | Pattern (before) | Pattern (after Phase 2) |
|---|---|---|
| Counselling → CCMS case create | Auth fire-and-forget HTTP | Unchanged (sync counselling path; not IP lifecycle) |
| IP Admit → CCMS validate | Sync HTTP gate (Phase 1) | Unchanged (must stay sync) |
| IP Admit → CCMS link + ADMIT | Missing / unreliable | **Outbox** `JourneyAdmitted` |
| IP SurgeryCompleted → CCMS | Fire-and-forget `Task.Run` | **Outbox** `SurgeryCompleted` |
| IP Discharged → CCMS | Fire-and-forget `Task.Run` | **Outbox** `PatientClinicallyDischarged` |
| Bill finalized → CCMS | Fire-and-forget HTTP (external) | **Outbox** from IP when `FinancialState=Settled` + CCMS consumer idempotent |

Lost-event risk mitigated by transactional enqueue + retries + `Dead` observability. Duplicate delivery safe via `X-Idempotency-Key` + unique outbox key.

---

## 2–3. Outbox + event contracts (payloadVersion = 1)

| Event | Producer | Consumer | Idempotency key | Failure |
|---|---|---|---|---|
| `JourneyAdmitted` | IP Admit | `journey-admitted` | `JourneyAdmitted:{journeyId}` | Retry → Dead |
| `SurgeryCompleted` | IP clinical | `surgery-completed` | `SurgeryCompleted:{journeyId}` | Retry → Dead |
| `PatientClinicallyDischarged` | IP clinical | `patient-discharged` | `PatientClinicallyDischarged:{journeyId}` | Retry → Dead |
| `BillFinalized` | IP FinancialState Settled (bridge) / external Billing | `bill-finalized` | `BillFinalized:{journeyId}` | Retry → Dead |

Payload fields: `payloadVersion`, `tenantId`, `journeyId`, `sessionId`/`counsellingSessionId`, `patientId`, `coverageCaseId?`, `actorUserId`, `correlationId`, `occurredAt`.

Delivery auth: `X-Internal-Key` + `X-Tenant-ID` + `X-Idempotency-Key`.

---

## 4. JourneyId

- Link at admit via `LinkJourneyIdAsync` (session match; refuse overwrite).
- Backfill: `database_migrations/schema/ccms_journeyid_backfill_phase2.sql`.
- Outpatient / pre-admit cases may keep null JourneyId.

---

## 5. Billing ownership decisions

| Artifact | Classification | Notes |
|---|---|---|
| Hospital charges / finalized bill | **Billing SoT** | Not rewritten in Phase 2 |
| CCMS allocation / claim / settlement | **CCMS SoT** | |
| `IpBillingTransaction` | Ward **projection** (advances/receipts) | Not competing charge engine |
| `FinancialState` | **Compatibility / clinical workflow** | Settled emits BillFinalized bridge event |
| `IsBillingLocked` | **Still clinically relevant** | OT / mutation guard |
| `TotalPaid` | **Projection** | Display / bridge payload only |

---

## 6. Document ownership

| Class | Canonical owner | Phase 2 action |
|---|---|---|
| Payer / pre-auth / claim / TPA docs | **CCMS** | Legacy Auth uploads frozen |
| Clinical pre-op / consent / labs / PAC | **IP** | Unchanged |
| Patient policy card (`patient_insurance`) | Auth bridge (read/sync) | CCMS sync retained |
| Widget mock docs | Mock/demo | Do not treat as SoT |

---

## 7. Legacy insurance dependency inventory

| Path | Classification | Phase 2 action |
|---|---|---|
| `InsuranceController` preauth/docs/TPA/workflow writes | Deprecated | Frozen unless `X-CCMS-Bypass` |
| `InsurancePreauthController` create/status/docs | Deprecated | Frozen unless bypass |
| `InsuranceWorkflowService` | Bridge / compatibility | Reachable only via frozen controller or internal sync |
| `insurance.api.ts` writes | Deprecated client | Throws `CCMS_LEGACY_WRITE_FROZEN` |
| `InsurancePreAuthWidget` / Claim / Govt widgets | Mock/demo + gallery | Not production SoT; gallery only |
| Finance sidebar Insurance | Redirect | → `/dashboard/ccms/cases` |
| Reads (GET pre-auths/docs) | Read-only compatibility | Retained |

---

## 8. RBAC audit (backend)

### IP (enforced)
| Action | Permission |
|---|---|
| Clinical transitions / discharge override | `IpChecklistAuth.RequireClinicalTransition` |
| Emergency FC | `ip.emergency_fc.apply` or `ward.checklist.edit` |
| OT sign / WHO override | `ot.safety.sign` / OT override perm |

### CCMS (Phase 2 hardened)
| Action | Permission (any-of) |
|---|---|
| Clarification write | `ccms.clarification.write` / `ccms.preauth.process` / admin |
| Generate / submit / TPA response | `ccms.preauth.*` / admin |
| Enhancement create/decide | `ccms.enhancement.write` / preauth.process / admin |
| Claim generate | `ccms.claim.submit` / `ccms.claim.write` / admin |
| Workflow admin triggers | Existing `WorkflowTransitionPolicy` |

Empty permission arrays on legacy JWTs still allow (compat); when permissions are present they are enforced.

---

## 9. Clarification / coverage notifications

| Event | Depts notified |
|---|---|
| Clarification raised / answered | CCMS, COUNSELLING |
| Pre-auth approved / partial / rejected | CCMS, WARD |
| Additional documents required | CCMS, COUNSELLING |
| Enhancement required | CCMS, WARD |

Infra: auth-service `/api/notifications/internal/push-dept` (no second platform).

---

## 10. Tests covered

- Outbox enqueue + duplicate key + successful delivery
- Outbox retry → Failed → Dead
- JourneyId link + refuse overwrite
- Phase 1 admission policy regression
- CcmsAuthz deny when permissions present without match
- Legacy FE write freeze throw

---

## Acceptance criteria checklist

1. Critical lifecycle events reliably delivered — **Yes** (outbox + auth headers)
2. Consumers idempotent — **Yes** (`X-Idempotency-Key`)
3. JourneyId consistent where required — **Yes** (link + backfill SQL)
4. Billing/IP/CCMS clearer in code — **Yes** (docs + BillingService + Settled bridge)
5. Coverage docs canonical owner — **Yes** (inventory + freeze)
6. Competing insurance writes frozen/redirected — **Yes** (API + FE + sidebar)
7. Legacy dependencies documented — **Yes** (this file §7)
8. Critical backend RBAC — **Yes** (IP Phase 1 + CCMS Phase 2)
9. Clarification notifications — **Yes** (+ docs/enhancement)
10. No production workflow removed without compatibility — **Yes** (reads + bypass retained)

## Intentionally deferred residuals — **done**

| Residual | Status |
|---|---|
| Mock insurance widgets | Gallery-only (`galleryOnly`); removed from counselor templates |
| Billing SoT for BillFinalized | `OpdBillService.FinalizeBillAsync` → CCMS; IP Settled = bridge only |
| CCMS Phase 2 permission aliases in JWTs | SQL + `PermissionSeeder.SeedPhase2AliasesForAllTenantsAsync` on Auth startup |

Ops:
1. Apply `database_migrations/permissions/seed_ccms_phase2_permission_aliases.sql` (or restart AuthService)
2. Users must re-login to refresh JWT permission claims
3. Gallery still shows deprecated insurance widgets for demos only
