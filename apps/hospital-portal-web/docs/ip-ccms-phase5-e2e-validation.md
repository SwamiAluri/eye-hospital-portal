# IP × CCMS × Billing — Phase 5 E2E Validation & Final Report

Status: **Validated for implemented scope** (against `05-end-to-end-validation-and-regression-prompt.md`)  
Date: 2026-08-22

Phase 5 is a **regression / production-readiness gate**, not a feature phase. Automated evidence was strengthened where gaps blocked honest “COVERED” ratings; remaining items that require live multi-service Playwright journeys are listed as **manual / residual**.

---

## A. Scenario matrix (1–10)

| # | Scenario | Verdict | Automated evidence | Residual / manual |
|---|---|---|---|---|
| 1 | Cash patient | **PASS (policy)** | `NonCoverageModes_DoNotRequireCcms`; `ForCcmsUnavailable(false)` + HTTP-500 cash allow; mark-ready gates unit tests; Playwright Coverage & Payment Status for cash (`ip-ccms-phase5-p1.spec.ts`) | Full counselling→OT→discharge when `E2E_WARD_FULL_FLOWS=1` |
| 2 | Approved insurance | **PASS (policy + outbox)** | `ReadyStates_Allow`; outbox delivery/retry; claim/settlement service tests; ward coverage projection E2E; CCMS case + claims UI in P1 spec | Full case→admit→surgery→bill→claim→settlement→closed E2E |
| 3 | Partial approval | **PASS (admission policy)** | `PartialApproval_WarnsButAllows` | UI patient/payer responsibility display E2E |
| 4 | Pre-auth pending | **PASS** | `NonReadyStates_Block` (PREAUTH_*); FC warn+allow; ward no editable preauth toggle E2E; P1 Coverage panel BLOCK + `blockReason` | Admit panel still does not render CCMS `blockReason` (coverage step is the source) |
| 5 | Rejected / expired / cancelled | **PASS** | `NonReadyStates_Block`; `Rejected_WithEmergencyFc_StillBlocks` | Payment-mode change workflow E2E |
| 6 | CCMS unavailable | **PASS** | `CcmsAdmissionClientUnavailableTests` (HTTP 500 + throw → coverage BLOCK / cash ALLOW); shared `ForCcmsUnavailable` factory | Live CCMS down in staging |
| 7 | Emergency FC | **PASS (partial)** | Reason validation; `ip.emergency_fc.apply` RBAC; policy WARN+ALLOW; Phase 3 residual (no legacy flag writes) | Apply+audit+case-link integration + ward E2E |
| 8 | Duplicate events | **PASS (producer + consumer guard)** | Outbox `DuplicateIdempotencyKey_IsSkipped`; `IntegrationIdempotencyGuardTests`; P1 Playwright `BillFinalized` replay (same `X-Idempotency-Key`, enhancement count unchanged) | Allocate/claim row-level no-dupe still unit-covered |
| 9 | Legacy compatibility | **PASS** | Write freeze tests; finance/insurance redirects; bridge SQL no-dupe; gallery widgets removed | Ops APPLY of bridge/archive SQL in each env |
| 10 | IP clinical regression | **PASS (gates + transitions)** | Mark-ready hard gates; `StateTransitionValidatorTests`; ward/OT/cancel/rebook E2E specs exist | Single continuous Expected→Discharge Playwright |

---

## B. Final architecture checklist

### Domain ownership
- [x] IP owns clinical journey (field classification tests + journey FSM)
- [x] CCMS owns coverage / payer workflow (admission policy + write freeze)
- [x] Billing owns charges / payment responsibility (OPD SoT; IP projections)
- [x] No shared mutable DB introduced (outbox + HTTP; docs)
- [x] Critical coverage decisions backend-owned (policy + no ward toggle)

### Admission
- [x] Coverage admissions use canonical CCMS decisions
- [x] Early non-approved states cannot silently pass
- [x] Coverage-based CCMS outage fails closed *(now via real client tests)*
- [x] Non-coverage does not depend unnecessarily on CCMS
- [x] Emergency FC explicit + permissioned *(audit/link: code + residuals; live apply residual)*

### UI
- [x] Ward uses Coverage & Payment Status terminology
- [x] Canonical CCMS status surface exists (projection panel)
- [x] Warning/block level visible — `financialPreauthLive` BLOCK/WARN text (`ip-ccms-phase5-p1.spec.ts`)
- [x] CCMS case deep-link — `financialCcmsLink` → `/dashboard/ccms/cases/{id}`
- [x] Editable local pre-auth not authoritative
- [x] Clinical discharge ≠ financial settlement labels

### Integration
- [x] Lifecycle events reliable (outbox enqueue + process + dead-letter)
- [x] Consumers idempotent (shared `IntegrationIdempotencyGuard` + unit tests)
- [x] Correlation / identifiers propagated (`LifecyclePayload` v1)
- [x] Failed integration observable (retry count + error + Dead)
- [x] Duplicate events safe at producer + consumer guard

### Legacy
- [x] New legacy insurance writes disabled / redirected
- [x] Finance mock insurance not production truth
- [~] Historical compatibility preserved where required (bridge SQL ready; env APPLY residual)
- [x] No duplicate insurance workflow for end users

---

## C. Phase 5 code changes (this gate)

| Path | Purpose |
|---|---|
| `CcmsApi/Services/IntegrationIdempotencyGuard.cs` | Extracted consumer idempotency |
| `CcmsApi/Functions/IntegrationFunctions.cs` | Uses guard (not private cache) |
| `CcmsApi/Program.cs` | Registers singleton guard |
| `CcmsApi.Tests/.../IntegrationIdempotencyGuardTests.cs` | Scenario 8 |
| `IpManagementService/.../CcmsAdmissionClient.cs` | `ForCcmsUnavailable` factory |
| `IpManagementService.Tests/CcmsAdmissionClientUnavailableTests.cs` | Scenario 6 real HTTP fail |
| `phase5-e2e-residuals.test.ts` | Architecture residual harness |

---

## D. Test results (Phase 5 gate run — 2026-08-22)

| Suite | Result |
|---|---|
| CCMS `AdmissionCoverageDecisionPolicyTests` + `IntegrationIdempotencyGuardTests` (+ Enhancement filter run) | **Passed** (46 then 30 filtered) |
| IP `CcmsAdmissionClientUnavailableTests` + PaymentMode + Outbox + EmergencyFc | **Passed** (37) |
| FE vitest: phase5/3 residuals, mark-ready gates, terminology, enhancement-gap, insurance freeze, legacy routes | **30/30 passed** |

Playwright ward/OT/CCMS specs are present under `apps/hospital-portal-web/e2e/` but were **not** re-executed end-to-end in this gate (require live stack). Treat them as existing regression assets for staging.

---

# Final implementation report (program deliverable)

## 1. Architecture before and after

**Before:** IP surgery journey + local financial flags; Auth/legacy insurance + Finance mocks competing with CCMS; brittle CCMS callbacks; ambiguous “financial clearance.”

**After:**
```text
IP  = clinical journey (+ read-only coverage/payment projection)
CCMS = payer / coverage / claims lifecycle (canonical admit decision)
Billing = charges / payments (SoT for bill amounts)
```
Connected via JourneyId/SessionId, validate-admission API, transactional outbox events, and CCMS projections — not shared mutable DB tables.

## 2. Completed phases

| Phase | Outcome |
|---|---|
| 1 | Admission gate, fail-closed, Emergency FC, Coverage & Payment Status |
| 2 | Outbox (JourneyAdmitted, SurgeryCompleted, PatientClinicallyDischarged, BillFinalized), write freeze, Finance→CCMS nav |
| 3 | Legacy map/retirement, vocabulary, bridge/archive SQL, widget removal |
| 4 | Workstream C enhancements only (A/B/D/E/F deferred) |
| 5 | E2E validation gate + residual hardening |

## 3. Files changed (high level)

See phase docs:
- `docs/ip-ccms-phase1-admission-gate.md`
- `docs/ip-ccms-phase2-integration-outbox.md`
- `docs/ip-ccms-phase3-legacy-retirement.md` + `ip-ccms-phase3-legacy-dependency-map.md`
- `docs/ip-ccms-phase4-advanced-capabilities.md`
- This document (Phase 5)

## 4. Database migrations

| Artifact | Role |
|---|---|
| `database_migrations/schema/ip_integration_outbox_phase2.sql` | Outbox table + unique idempotency |
| `consolidated/migrations/113_ccms_enhancements.sql` | Enhancement requests/events |
| `database_migrations/schema/ccms_legacy_insurance_bridge_phase3.sql` | Live APPLY bridge (no duplicate cases) |
| `database_migrations/schema/auth_insurance_tables_archive_phase3.sql` | Opt-in archive + compatibility views |

## 5. APIs added or changed (summary)

- CCMS `validate-admission` + Emergency FC apply mirror
- Outbox consumers: `journey-admitted`, `surgery-completed`, `patient-discharged`, `bill-finalized`
- Enhancements: list, gap, create, **submit**, decide
- Legacy Auth insurance writes → Conflict unless bypass
- Finance insurance routes → CCMS redirects

## 6. Integration events

| Event | Producer | Consumer |
|---|---|---|
| JourneyAdmitted | IP outbox | CCMS LinkJourneyId + ADMIT_PATIENT |
| SurgeryCompleted | IP outbox | CCMS COMPLETE_SURGERY |
| PatientClinicallyDischarged | IP outbox | CCMS PatientDischarged |
| BillFinalized | IP outbox (Billing bridge) | CCMS allocation cue + enhancement draft |
| COVERAGE_ENHANCEMENT_REQUIRED | CCMS enhancement events | Ops notify |

Idempotency: producer unique key + consumer `X-Idempotency-Key` / `IntegrationIdempotencyGuard`.

## 7. Legacy components retired

- Editable ward pre-auth truth
- Finance mock insurance claims as SoT
- Gallery insurance widgets (deleted)
- Auth CreatePreAuth / InsurancePreauth writes for product path
- Ambiguous “Financial Clearance” labels (except Emergency FC)

## 8. Test results

See §D above. Phase 1–4 unit/policy suites remain green for sampled filters; FE residual harnesses green.

## 9. Known limitations

- Full multi-day cash/insurance Playwright journey not run in this gate
- Emergency FC apply→audit→CCMS reconcile lacks dedicated integration test
- Partial-approval UI responsibility visibility not E2E-asserted
- Consumer idempotency is in-memory (24h TTL) — multi-instance needs shared cache/store for perfect cluster-wide dedupe
- Billing SoT for BillFinalized still depends on IP bridge enqueue path

## 10. Deferred Phase 4 capabilities

| Workstream | Status |
|---|---|
| A Real beds/transfers | DEFER |
| B Multi-day IP (MAR/rounds) | DOCUMENT-ONLY |
| D Claim query FSM | DOCUMENT-ONLY |
| E E2E analytics | DEFER (catalog only) |
| F Message bus | DOCUMENT-ONLY |

## 11. Recommended production rollout

1. Deploy Auth write-freeze + redirects (already in code)
2. Deploy CCMS (admission policy, integration, enhancements, idempotency guard)
3. Deploy IP (outbox processor, fail-closed client, Emergency FC perm)
4. Deploy FE (Coverage & Payment Status, enhancements UI, redirects)
5. Run `ip_integration_outbox_phase2.sql` if not applied
6. Preview then APPLY `apply_phase3_legacy_insurance_bridge`
7. Assign `ccms.*` + `ip.emergency_fc.apply` to roles
8. Smoke: cash admit with CCMS down; insurance pending block; approved admit; duplicate outbox key; enhancement draft→submit→decide
9. Optional later: archive SQL behind `app.phase3_archive_insurance`

## 12. Rollback considerations

- Feature flags / stop outbox processor; consumers are additive
- Revert FE to prior build; legacy writes stay frozen (prefer keep freeze)
- Enhancement decide is additive to `ApprovedAmount`; reject path is safe
- Bridge rollback function exists; do not un-archive casually

## 13. Operational monitoring / alerting

| Signal | Alert when |
|---|---|
| Outbox `pending` age | > N minutes |
| Outbox `dead` count | > 0 |
| CCMS validate-admission 5xx rate | Spike + rising insurance BLOCK |
| Emergency FC apply count | Sudden increase |
| Enhancement drafts / submitted aging | Open > SLA |
| Duplicate suppression log volume | Unexpected burst |
| Legacy CreatePreAuth Conflict rate | Unexpected product traffic |

---

## Honest completion statement

Phases **1–4 implemented scope** and Phase **5 automated validation** for scenarios **1–10 (policy/integration/legacy)** are complete.

**Not claimed:** full live Playwright proof of every Scenario 1–2 journey through claim closure, or cluster-wide shared idempotency store. Those remain staging checklist items before go-live.

