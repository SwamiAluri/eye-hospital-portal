# Counsellor Follow-up Analytics — Phase 2Z Implementation

| Field | Value |
|-------|--------|
| **Phase** | Phase2Z |
| **Date** | 2026-09-12 |
| **Status** | Implemented — awaiting manual UAT |

This document records what Phase2Z **shipped**. It does not rewrite historical Phase2V/2W audit conclusions.

---

## PD13 — Mutually exclusive partition

Classifier: `CounselingAnalyticsOutcomeClassifier`

| Precedence | Classification |
|------------|----------------|
| Agreed + Declined marker (`PatientIntention` Declined/ReferredElsewhere) | Exception |
| Declined marker + PendingDecision | Exception |
| PendingDecision (+ optional Agreed) | PendingDecision |
| Agreed only | Agreed |
| Agreed==false && !Pending | Declined |
| Else | Other / Unclassified |

**Formulas:**

- Eligible = Total − Exception − Other
- Conversion % = Agreed / Eligible × 100 (1 decimal)
- Decision % = (Agreed + Declined) / Eligible × 100

DTO adds: `exceptionCount`, `otherUnclassifiedCount`, `eligibleOutcomeSessions`, `pendingDecisionCount` (mirrors `undecidedCount`).

PendingDecision is **not** Active Follow-up membership.

---

## PD14 — Aging

- Population: PendingDecision only
- Basis: SessionDate; UTC half-open window
- Independent period control: 30 / 90 / 180 / **365 (default)**
- Does not inherit Summary 7/14/30
- Title: **PendingDecision Aging**
- Urgency labels Critical/High/Medium/Normal **removed**
- Buckets: 0–3, 4–7, 8–14, 15+

---

## PD15 — Drill-down

| Metric | Destination |
|--------|-------------|
| Total / Agreed / Declined / Pending / Conversion | `/dashboard/counsellors-desk/sessions` + filters |
| Aging / Aging bucket | Sessions list + `pendingDecision=true` + window/bucket dates |
| Surgery mix | Sessions list + `recommendedSurgery` |
| Follow-up workload | Existing Follow-up Center only |

**PendingDecision NEVER navigates to Active Follow-up Center.**

Thin sessions list reuses `GET /Counseling/sessions` (extended with `PatientAgreedToSurgery`, `RecommendedSurgery`). No new PendingDecision worklist entity.

---

## Branch authorization (PD16 parity)

Analytics summary / trends / aging resolve branches via `FollowupBranchAccessService`:

- Unauthorized `branchId` → **403**
- Omitted → authorized set only (not tenant-wide)
- Tenant from token

---

## Counsellor filter

- API: `counselorId` on summary/trends/aging
- UI: compact picker (`/users?role=Counselor`, soft-fail)
- Propagated to CSV and drill-down URLs
- Filter ≠ entitlement

---

## Not in scope (deferred)

Phase2AA, Schedule Visit, Reminder/Callback redesign, Next Action SoT, DueDate, Priority, FollowUps table, reason taxonomy.

---

## Related docs

- API contract: `apps/hospital-portal-web/docs/counseling-analytics-phase2d-api-contract.md`
- Phase2Y honesty: `counsellor-followup-analytics-phase2y-operational-honesty.md`
- Phase2X Slice 2 blockers: `counsellor-followup-analytics-phase2x-slice2-lifecycle-blockers.md`
