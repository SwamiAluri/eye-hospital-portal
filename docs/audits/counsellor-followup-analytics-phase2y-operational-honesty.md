# Phase2Y — Follow-up Center operational honesty (PD5 / PD6)

| Field | Value |
|-------|--------|
| **Phase** | Phase2Y |
| **Date** | 2026-09-12 |
| **Status** | Implemented — honesty corrections only; awaiting manual UAT |

This document records what Phase2Y **did** and what remains **deferred**. It does not invent product rules.

---

## PD5 — Due Date

**Approved rule (Option C):** No generic Follow-up Center DueDate / invented SLA / +7/+14/+30 due heuristics.

**Implemented:**

- Center continues to have **no** `DueDate` field, DTO property, or DB column.
- Active population remains intention-allowlist only (unchanged from Phase2X).
- `GET /Counseling/followups/overdue` and legacy `/api/FollowUps` were **not** wired into the Center.
- Next Action / Next Action Date remain distinct concepts (comm-log history only).

**Deferred (unchanged):**

- Authoritative “current Next Action” projection onto Active worklist rows — **BLOCKED — PRODUCT SOT REQUIRED**
- ContactLogModal Next Action capture
- Mandatory Next Action enforcement

---

## PD6 — Priority / Escalation

**Approved rule (Option A):** No formal hospital-approved priority model.

**Implemented:**

- Removed Follow-up Center **“High Priority”** KPI presentation.
- Removed derived **AlertLevel** Critical/High/Medium/Normal pills and AlertLevel-based urgency borders from Active rows.
- `MapAlertLevel` no longer treats `LastContactDate == null` as Medium (never-contacted is factual, not priority).
- Removed unused AlertLevel presentation helpers from `followup-presentation.ts`.

**Wire residual (not Center priority):**

- `active.urgentHigh` remains on `/followups/stats` as an EscalationStatus count for API compatibility only — **not** shown as High Priority in the Center.
- `AlertLevel` may still appear on Active DTO as a residual EscalationStatus echo — **not** presented as priority in the Center UI.

**Deferred:**

- Hospital-approved priority / escalation writers and de-escalation policy

---

## Post-Surgery aging

- KPI label: **“Over 30 Days” → “Discharged ≥30 days”** (factual aging from `DischargedAt`).
- Rows show **“{n}d since discharge”** with neutral styling.
- Not due / SLA / overdue / priority.

---

## Explicitly out of scope (not started)

- Phase2Z / Next Action projection / Schedule Visit / Reminder redesign / Callback redesign / Analytics formula changes
- New FollowUps table
- Database migration

---

## Related

- Phase2X Slice 2 blockers: `counsellor-followup-analytics-phase2x-slice2-lifecycle-blockers.md` (SurgeryCompleted exit and Next Action SoT remain blocked)
