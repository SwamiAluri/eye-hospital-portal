# IP × CCMS Phase 1 — Admission Gate & Coverage Projection

Status: **Implemented** (cross-checked against `01-phase-1-admission-gate-and-coverage-projection.md`)

## Domain rules

| Owner | Responsibility |
|---|---|
| **CCMS** | Canonical coverage authorization / admission decision |
| **IP** | Clinical journey; displays read-only coverage projection |
| **Billing** | Charges / payments (unchanged in Phase 1) |

## Coverage-based payment modes

`PaymentModeCoveragePolicy` treats these as requiring CCMS (fail-closed on outage):

`Insurance`, `TPA`, `CoPay`, `CGHS`, `SGHS`, `GovernmentScheme`, `ESH`, `Arograshree`, `Railway`, `ESI`

Non-coverage (Cash / Card / UPI / Camp / empty) do **not** block on CCMS unavailability.

## CCMS state → admission decision

| Decision | States |
|---|---|
| **ALLOW** | `APPROVED`, `ADMISSION_READY`, post-admit CCMS lifecycle states |
| **WARN** (still allow) | `PARTIAL_APPROVAL`; pending states **only with Emergency FC** |
| **BLOCK** | Early workflow (`DRAFT`…`AUTHORIZATION_REQUIRED`), `PREAUTH_*`, `WAITING_APPROVAL`, `CLARIFICATION_REQUIRED`, `RESUBMITTED` (without Emergency FC), `REJECTED`, `EXPIRED`, `CANCELLED`, `ABORTED` |

Source of truth: `AdmissionCoverageDecisionPolicy` in CCMS. Frontend must not reimplement this matrix.

## APIs

- `GET /ccms/integration/validate-admission` — enriched decision body
- `POST /ccms/integration/emergency-fc` — mirror Emergency FC onto coverage case
- `GET /ip-management/journeys/{id}/financial/preauth-status` — ward projection
- `POST /ip-management/journeys/{id}/emergency-fc` — requires `ip.emergency_fc.apply` **or** `ward.checklist.edit` (not view-only)

## Deprecated / non-authoritative

| Field | Status |
|---|---|
| `insurance_preauth_approved` checklist completion | **Deprecated as truth**. Synced as `system_derived` from CCMS for display/rollup only. Ward writes rejected. |
| Global `CcmsService:FailClosedOnValidationError` | Superseded by payment-mode-aware fail-closed |

## Ward UI

Step label: **Coverage & Payment Status** (key remains `financial`).  
Shows payment mode, CCMS state/decision, Emergency FC, last updated, deep-link `/dashboard/ccms/cases/{caseId}` when `caseId` is present (CCMS route enforces its own access).

## Intentionally deferred

- Lifecycle outbox / JourneyId backfill → Phase 2
- Legacy insurance write freeze / Finance mock retirement → Phase 3
- Full end-to-end regression suite → Phase 5 / doc `05`
