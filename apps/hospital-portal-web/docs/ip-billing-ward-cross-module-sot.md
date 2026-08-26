# IP Management + Billing + Ward/Inpatient + Cross-Module Integration

**Status:** Master source of truth for all subsequent phases of this work.  
Phase docs (`ip-ccms-phase*.md`, `ip-ccms-waves-3-to-7.md`, ward specs) remain historical implementation records. If they conflict with this document on ownership or process, **this document wins**.

This is an existing production-oriented real-time Eye Hospital Management System. **Do not treat this as a greenfield project.**

---

## Important instruction for all phases

Before changing anything:

- Inspect the existing codebase.
- Reuse existing architecture, patterns, services, components, database conventions, authentication, authorization, SignalR/`NotificationHub`, outbox, API clients, validation, and testing infrastructure wherever appropriate.
- Do not create duplicate implementations when an existing mechanism can be extended.
- Do not introduce a second architecture/framework unnecessarily.
- Do not remove existing functionality unless this prompt explicitly requires it or the existing implementation is demonstrably incorrect.
- Preserve backward compatibility where practical.
- Do not make assumptions about APIs or database structures. Verify them from the codebase.
- Trace every change across FE → API → BE → DB → integrations.
- Every business-critical state transition must be validated server-side.
- Every financial operation must be auditable.
- Do not use frontend state as the source of truth for clinical or financial state.
- Do not treat IP Management financial snapshots as accounting records.
- Do not silently overwrite financial totals.
- Do not implement only the UI. Every required change must be completed across frontend, backend, database, APIs, integrations, and tests.
- After each phase, run the appropriate build, lint, type-check, migration validation, unit tests, integration tests, and existing test suite.
- Fix issues introduced by your changes before completing the phase.

At the end of each phase, provide:

- files changed
- database changes
- APIs changed/added
- integrations changed
- tests added/updated
- remaining risks
- exact commands used for validation

---

## Target architecture

```
Clinical / Operational
        ↓
IP Management / PatientJourney
        ↓
Clinical + OT + Post-Op + Admission lifecycle

Financial
        ↓
Billing / OpdBill
        ↓
Charges + Advances + Payments + Refunds + Receipts + Settlement

Coverage / Insurance
        ↓
CCMS
        ↓
Coverage + Claims + Payer responsibility

Bed Occupancy
        ↓
Auth / Bed Management

Notifications / Realtime
        ↓
Existing NotificationHub / SignalR

Integration
        ↓
Existing Integration Outbox / Events
```

---

## Ownership principle (non-negotiable)

| Domain | Source of truth |
|---|---|
| Clinical / operational | **IP Management** |
| Financial | **Billing** |
| Coverage / claim / payer settlement | **CCMS** |
| Bed occupancy | **Auth Bed Service** |

Preserve:

- IP Management = Clinical / Operational Source of Truth
- Billing = Financial Source of Truth
- CCMS = Coverage / Claim / Payer Settlement Source of Truth
- Auth Bed Service = Bed Occupancy Source of Truth

---

## Existing homes (extend these; do not fork)

| Concern | Canonical implementation |
|---|---|
| Patient journey, ward, OT, pre-op, post-op, admit/discharge | `microservices/ip-management-service` (`PatientJourney`, `PatientJourneyService`, `StateTransitionValidator`) |
| Hospital charges / payments / finalize | Auth `OpdBill` / `OpdBillService` |
| IP financial field classification (projection vs owner) | `IpFinancialFieldClassification` (BE) and `ip-financial-field-classification.ts` (FE) |
| Implant / IOL usage | `journey_implant_usage` via `ImplantUsageService.RecordAsync`. Charge follows `ImplantUsed` outbox → Auth OpdBill. Inventory follows the same event. Classify leftover flags via `IpImplantFieldClassification`. |
| Ward receipts/advances on the journey | `IpBillingTransaction` — Billing **projection**, not the charge engine |
| Coverage, pre-auth, claims, settlement | `microservices/ccms-service` |
| Biometry measurements | Auth `biometry_records`. CCMS may attach a pointer `biometry://record/{id}` on `ccms_documents` (`documentType=biometry_record`). Do not copy AL/Ks into CCMS. |
| Bed master + lifecycle | Auth `bed_inventory`; IP stores `patient_journey.assigned_bed_id` only. Internal API: `POST /api/internal/ip-beds/lifecycle` (`BedLifecyclePolicy`) |
| Realtime notifications | Auth `NotificationHub` + `/api/notifications/internal/push-dept` |
| Cross-module lifecycle events | IP `IntegrationOutboxService` / `IntegrationOutboxProcessorJob` (`JourneyAdmitted`, `SurgeryCompleted`, `PatientClinicallyDischarged`, `BillFinalized`, `EmergencyFcApplied`). Billing → CCMS HTTP: `PaymentReceived`, `PaymentReversed`, `PatientObligationChanged`. CCMS ack routes also accept `ClaimStatusChanged`. |
| Frontend IP / ward / CCMS clients | `apps/hospital-portal-web/src/lib/api/ip-management.api.ts`, `lib/api/ccms/*` |

IP `FinancialState` is a **clinical workflow / compatibility** field. `Paid` / `Settled` terminals are owned by Billing and CCMS, not independently written by IP. See Phase 2 billing ownership in `ip-ccms-phase2-integration-outbox.md` §5.

---

## What this document is not

- Not a license to rewrite Billing, CCMS, bed inventory, or notifications.
- Not a license to treat counselling estimates, journey `PackageAmount` / `TotalPaid`, or ward receipts as the hospital ledger.
- Not a replacement for verified schema, APIs, or RBAC in code.

---

## Phase 5 — Coverage & Claims (CCMS)

CCMS is the owner of coverage, claims, payer responsibility, patient share, and settlement state. IP does not store a second coverage machine. `InsurancePreauthSubmitted` / `GovernmentApprovalSubmitted` are deprecated compatibility flags, not authorization truth.

Obligation chain (do not mutate IP `FinancialState` from CCMS/Billing as books):

```
Total bill (Billing OpdBill)
  → Payer responsibility (CCMS allocation → Billing InsuranceClaimAmount projection)
  → Patient responsibility (CCMS patient share)
  → Patient paid (Billing collections)
  → Patient balance (PatientObligationCalculator)
```

Coverage UI statuses (`CoverageStatusClassifier`): CoverageApproved, CoveragePending, CoverageRejected, CoverageChanged. Admit: REJECTED still **blocks** even with Emergency FC. Discharge: patient obligation holds the bed; TPA settlement does not.

Emergency FC: permission `ip.emergency_fc.apply` only (not `ward.checklist.edit`); reason + journey audit + outbox `EmergencyFcApplied` + CCMS mirror. Assign the permission to privileged roles (`assign_ccms_and_emergency_fc_to_admin_roles.sql`); do not auto-attach it to every CCMS role.

---

## Phase 6 — Real-time IP, Billing, and cross-module updates

Reuse Auth `NotificationHub` only (no second SignalR stack).

| Surface | Hub events (identity payload only) | Client behaviour |
|---|---|---|
| IP dashboard / OT list | `PatientAdmitted`, `BedChanged`, `PatientSentToOT`, `PatientAcceptedInOT`, `SurgeryStarted`, `SurgeryCompleted`, `PostOpUpdated`, `PatientReadyForDischarge`, `PatientDischarged`, `PatientCancelled`, plus existing `WardJourneyChanged` | Invalidate React Query (or OT list reload) then GET journeys |
| Billing dashboard | `PaymentReceived`, `PaymentReversed`, `BillCreated`, `BillFinalized`, `RefundCreated`, `PatientObligationChanged`, `ClaimStatusChanged` | Invalidate then GET `/opdbills/ip-dashboard` |

IP service still pushes `WardJourneyChanged` to `IPD_NURSING` and **also** tenant-broadcasts the mapped operational type via `POST /api/notifications/internal/push-tenant`. Billing `OpdBillService` tenant-notifies after save; amounts stay in the API, not in SignalR details.

Reliability: keep Ward’s ~45s quiet poll; IP journeys and billing dashboard use the same interval as `refetchInterval` / OT `setInterval` if the hub is down.

Multi-user convergence: User A admit / B IP list / C send-to-OT / D billing / E payment all refetch the same APIs after events, so UI converges on server truth.

---

## Phase 8 — Integration hardening (complete)

Ownership is unchanged: IP `PatientJourney` (clinical), Auth `OpdBill` (ledger), CCMS (coverage), Auth beds, `NotificationHub`, existing outboxes.

Hardening in place:

- Command auth: IP `JourneyCommandAuthContext` (HTTP bind, fail-closed). Billing `BillingMutationAuth` on `OpdBillService` plus `RequirePermission` on mutating OPD bill routes. Emergency FC remains `ip.emergency_fc.apply` only.
- OT billing gate: Emergency FC, privileged checklist override, or linked `OpdBillId` — never IP `FinancialState.Paid/Settled`.
- `TransitionFinancial` is Billing-owned (IP throws). Default outbox keys `{eventType}:{aggregateId:N}`. Payment / refund / bill-finalize idempotency keys. Unique `ux_opd_bills_patient_journey` and `ux_opd_bill_payments_idempotency`.
- Audit: `journey_audit_log` notes + correlation; Auth `IAuditService` on bill/refund mutations; CCMS `ccms_approval_events.previous_state` / `correlation_id` including claim status.
- Failures: bed occupy compensate on admit; bed transfer rollback occupy; outbox retry; financial audit best-effort.
- Dashboards: IP journey list is paged; IP billing dashboard aggregates `OpdBill` (date/outstanding window), not every journey in memory. Aging/outstanding are as-of AR (all unpaid bills dated before range end), not month-only billed totals.
- Schema: migrations `154_phase8_audit_integrity.sql`, `155_phase8_unique_bill_and_coverage_audit.sql` (dedup then unique indexes).
- Privileged Emergency FC: seed `ip.emergency_fc.apply` and assign only to Admin / IT_ADMIN / HEALTHCARE_ADMINISTRATOR (`assign_ccms_and_emergency_fc_to_admin_roles.sql`). Not attached to every CCMS role.
- Open bed history uniqueness (`ux_journey_bed_assignment_one_open`) is a Postgres filtered unique index. In-memory EF tests do not enforce it.

---

## Phase 9 — End-to-end acceptance

Ownership remains: IP clinical, Billing ledger, CCMS coverage, Auth beds, `NotificationHub`.

Scenario close-outs:

1. Cash path uses clinical graph + OpdBill payment/finalize; IP cannot set Paid/Settled.
2. Insurance discharge uses **patient share**, not TPA `BalanceDue`.
3. `PostOp → ReadyForDischarge` is not money-gated; `ReadyForDischarge → Discharged` is patient-obligation only.
4. Emergency FC is `ip.emergency_fc.apply` fail-closed + journey audit + outbox.
5. Cancel-today closes `journey_bed_assignment` then Auth vacate; rebook returns to Expected.
6. Bed transfer is occupy+history; same-bed rejected; unique open assignment in Postgres.
7. Readmission is a **new** Expected journey with `PriorJourneyId`; discharged episode is not reopened to Admitted.
8. Refunds are **append-only** payment lines; original payment rows stay; `RefundCreated` hub + obligation outbox after complete.

IpBillingTransaction remains a Billing **projection**. Journey `TotalPaid` / `BalanceDue` are compatibility snapshots, not books.

---

## Implant / IOL field ownership (E4 / F6)

| Field | Role |
|---|---|
| `journey_implant_usage` | **Usage SoT.** Record implant writes this row. Charge and stock follow `ImplantUsed`. |
| `patient_journey.iol_power` | Planned power (OPD/counselling). Compared at record; not usage. |
| `patient_journey.iol_issued_from_ip` | OT process tick. Not inventory. |
| `patient_journey.iol_barcode` / `iol_barcode_verified` | Compatibility only. Verify and OT Details **do not** persist scanned barcodes here. Existing values may still feed planned-model lookup. |
| `intra_op_note.implant_used` / `implant_power` | Compatibility only. Save ignores client writes. GET overlays the latest Implanted registry row when present. |

Do not treat OT Details “Implant Used” free-text, barcode-verified ticks, or intra-op note fields as the usage or charge record.

## Slot throughput safety counts

`GET /ip-management/slots/throughput` (page `/dashboard/ip-management/throughput`) includes two audit KPIs on journeys that have a slot in the report window (theatre filter applies when set):

| Field | Audit action | Meaning |
|---|---|---|
| `vitalsOverrideCount` | `VitalsWarningAcknowledged` | Mark Ready proceeded despite `vitals_out_of_range`. Missing vitals (`vitals_not_recorded`) are not counted. |
| `iolMismatchOverrideCount` | `ImplantMismatchOverridden` | Record implant proceeded despite planned/catalog mismatch. |

These are operational safety counts, not a second clinical state and not billing.


