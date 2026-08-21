# IP × CCMS Phase 4 — Advanced Capabilities (Demand-Driven)

Status: **Complete for justified scope** (against `04-phase-4-advanced-ip-and-ccms-capabilities.md`)

Phase 4 must **not** implement all workstreams automatically. Each capability was evaluated for operational use case, users, ownership, complexity, and value.

---

## Decision matrix

| Workstream | Signal | Decision | Rationale |
|---|---|---|---|
| **A** Real bed inventory / transfers | LOW | **DEFER** | IP is surgery/day-care journey; bed is assignment text. Auth `bed_inventory` not wired to IP. Classic IPD FSM would fight current product. |
| **B** Multi-day IP (rounds, MAR, diet…) | LOW | **DOCUMENT-ONLY** | Ward journey closes same-day surgery path. Do not duplicate EHR. |
| **C** Coverage enhancements | MEDIUM–HIGH | **IMPLEMENTED** | Gap detect → draft → TPA submit → outcome → coverage projection. |
| **D** Claim query state machine | LOW–MEDIUM | **DOCUMENT-ONLY** | Pre-auth clarification already covers TPA Q&A. Expanding claim FSM risks duplication until claim-ops evidence. |
| **E** E2E analytics Expected→Settlement | MEDIUM | **DEFER** | CCMS analytics exists as aggregates only. Build event-fed read model after production KPI pick. |
| **F** Message bus | LOW | **DOCUMENT-ONLY** | Outbox (4 events, single consumer pattern) is sufficient; no volume/latency proof for bus. |

---

## Workstream C — Required Output

### Business problem
Approved coverage can be lower than updated treatment estimate / finalized bill; cashless ops need a controlled enhancement request without assuming payer approval.

### Users
CCMS / TPA desk, ward (notification), billing (bill finalize trigger).

### Current limitation (before Phase 4 C)
Enhancement rows existed but lacked gap evaluation, TPA submit, payer-gated decide, case UI, and decide did not reliably update `CoverageCase.ApprovedAmount`. Bill finalize could leave an invisible coverage gap.

### Target workflow
```text
Eligible amount > ApprovedAmount
        ↓
Evaluate gap (recommendation)
        ↓
Create draft enhancement (active) — COVERAGE_ENHANCEMENT_REQUIRED event
        ↓
Preserve originalApprovedAmount in ReasonJson
        ↓
Submit to TPA (submitted) — ENHANCEMENT_SENT_TO_TPA
        ↓
Record TPA outcome (approved/rejected)
        ↓
On approve: Case.ApprovedAmount = original + additional
        ↓
Ward Coverage & Payment Status projection refreshes via CCMS
```

Hospital override of a **draft** (skip TPA) is allowed only with `HospitalOverride=true` + `OverrideReason` (audited event `*_HOSPITAL_OVERRIDE`).

### Domain owner
**CCMS** (coverage). Billing supplies eligible totals. IP displays projection only.

### Data model
- `CcmsEnhancementRequest` — Status: `active` | `submitted` | `approved` | `rejected`
- `CcmsEnhancementEvent` — append-only audit (`COVERAGE_ENHANCEMENT_REQUIRED`, `ENHANCEMENT_CREATED`, `ENHANCEMENT_SENT_TO_TPA`, `ENHANCEMENT_APPROVED` / `REJECTED` [+ `_HOSPITAL_OVERRIDE`])
- Migration: `consolidated/migrations/113_ccms_enhancements.sql`

### API changes
| Endpoint | Purpose |
|---|---|
| `GET /ccms/enhancements?status=&take=` | Ops queue |
| `GET /ccms/coverage-cases/{id}/enhancement-gap?eligibleAmount=` | Gap evaluation (authz) |
| `GET /ccms/coverage-cases/{id}/enhancements` | List by case (authz) |
| `POST /ccms/coverage-cases/{id}/enhancements` | Create draft (one open/case) |
| `POST /ccms/enhancements/{id}/submit` | Mark sent to payer/TPA |
| `POST /ccms/enhancements/{id}/decide` | Record outcome (+ optional hospital override) |
| Bill finalized integration | Drafts enhancement when `TotalAmount` exceeds approved (`source=bill_finalized`) |

### Integration events
| Event | Where | Meaning |
|---|---|---|
| `COVERAGE_ENHANCEMENT_REQUIRED` | `CcmsEnhancementEvent` + dept notify `ccms.enhancement.required` | Gap/request opened |
| `ENHANCEMENT_SENT_TO_TPA` | Enhancement event + `ccms.enhancement.submitted` | Sent to payer |
| Consume `BillFinalized` | CCMS IntegrationFunctions | Auto-draft when gap |

CCMS has no IP-style outbox publisher; durable truth is enhancement events + department notifications.

### Permissions
`ccms.enhancement.write` (primary), with fall-through `ccms.preauth.process`, `ccms.workflow.admin`, and read aliases on list/gap.

### UI changes
- Ops queue: `/dashboard/ccms/enhancements` — draft → submit → TPA decide / override
- Case Pre-Auth tab: `CaseEnhancementPanel` — gap banner, create, submit, decide

### Migration
Existing `113_ccms_enhancements.sql` — no schema change required for `submitted` status (string column).

### Tests
- `EnhancementServiceTests` — gap, create, conflict, submit, decide-after-submit, override, bill draft provenance
- FE: `enhancement-gap.phase4.test.ts`

### Operational metrics (C-scoped; E deferred)
Track via enhancement events / ops queue filters:
- Open draft aging (active without submit)
- Submit→decide TAT
- Override rate vs TPA path
- Gap amount vs additional approved
- Bill-finalize draft count

### Rollout / rollback
- Rollout: deploy CCMS + FE; bill finalize drafts remain additive; decide requires submit or override.
- Rollback: stop drafting in BillFinalized; submitted/active rows remain decidable; projection updates remain additive.

---

## Deferred workstreams (intentional — not skipped)

### A — Real beds
Re-open when ops requires reservation/occupancy/cleaning FSM beyond surgery bed assignment text.

### B — Multi-day IP
Document-only until EHR boundary is defined; do not build MAR/rounds inside IP ward journey.

### D — Claim query FSM
Keep using pre-auth clarification until claim desk proves distinct query states are needed.

### E — E2E analytics
Catalog retained: Admission readiness delay · Pre-auth TAT · Surgery delay due to coverage · Approval / partial / rejection rates · Clarification / claim / settlement aging · Clinical discharge→settlement · Emergency FC / override frequency · Revenue exposure by payer.  
Consume outbox + CCMS timestamps via reporting read model — not live cross-DB joins.

### F — Message bus
Re-evaluate when outbox volume, consumer count, or latency SLOs exceed current processor.
