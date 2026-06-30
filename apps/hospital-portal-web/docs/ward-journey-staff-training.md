# Ward & IP Journey — Staff Training Guide (Phase 4.5)

**Audience:** Ward nurses, OT staff, counsellors, anaesthetists  
**Route:** `/dashboard/ip-management/ward` (ward) · `/dashboard/ip-management/operation-theatre` (OT)  
**Full workflows:** [ward-journey-user-workflows.md](./ward-journey-user-workflows.md) · UAT: [ward-journey-qa-matrix.md](./ward-journey-qa-matrix.md)

---

## Ward nurse / IPD nursing

**You own:** Expected → Admitted → ReadyForSurgery → PostOp → ReadyForDischarge

| Stage | What to do | Where |
|-------|------------|-------|
| **Expected** | Enter §1 lab values, partial §2 clearance (not Evaluation/Anaesthesia), then **Admit** | Row click → **Ward Pre-Op Workspace** |
| **Admitted** | Vitals, med log, nurse records, complete §2 + PAC, **Mark Ready for Surgery** | Same workspace; care tabs now visible |
| **Ready for Surgery** | Final checks, **Send to OT** (footer only — no row shortcut) | Workspace → SendToOT modal |
| **Post-Op** | Complete **Form 4** checklist, **Mark Ready for Discharge** | Row click → Post-Op Workspace |
| **Ready for D/C** | Discharge summary + finalize discharge | Discharge modal |
| **Cancel today** | Use **Cancel today's surgery** when case not proceeding; patient returns to Expected | Workspace footer or row action |

**Tips**

- Gate warnings (P0–P4) are **warn-only** on admit and send to OT — read, acknowledge, proceed if clinically appropriate.
- **Insurance pre-auth** can **hard-block** admit (G11) — resolve with billing/CCMS first.
- **Merged patient** rows show strikethrough — ward mutations blocked; use surviving MR.
- **Journey Modal** (SentToOT / InOT / Surgery Done) is **read-only** for pre-op/post-op — use **Open Workspace** links to edit.

---

## OT nurse / OT staff

**You own:** SentToOT → InOT → SurgeryCompleted → handoff to PostOp

| Step | Action | Page |
|------|--------|------|
| 1 | **Accept in OT** after OT details filled | Operation Theatre |
| 2 | Complete surgical safety / WHO checklist | OT workspace |
| 3 | **Start surgery** → **End surgery** | OT workspace |
| 4 | **Move to Post-Op Ward** (clinical transition to PostOp) | OT page — **not** ward |

Ward receives a **notification** when patient moves to PostOp (IPD nursing dept).

**Return to ward:** If patient returns before surgery ends, OT initiates return → `ReadyForSurgery` with reason.

---

## Anaesthetist

| Task | When | Permission |
|------|------|------------|
| §2 **Anaesthesia** clearance | After admit only | `anaesthesia.pac.edit` / ward edit |
| **PAC (§4)** assessment | Admitted | `anaesthesia.pac.edit` |
| OT monitoring forms | In OT | `anaesthesia.monitoring.edit` |
| OT accept / start (if dual role) | SentToOT+ | `ot.safety.sign` |

PAC can complete with unverified critical labs — system shows **warn-only** confirm.

---

## Counsellor

| Task | When | Surface |
|------|------|---------|
| Create journey / P0 checklist | Pre-Expected | Counsellors desk |
| Schedule OT / set surgery date | Done + schedule | Counselling session |
| **Rebook** after cancel today | Expected + `pendingRebook` | Reschedule OT — clears rebook flag automatically |

Same-day **single-eye duplicate** scheduling is blocked (G6) — use bilateral (BE) or different date.

Counselling receives **rebook notification** when ward cancels today's surgery.

---

## Doctor / surgeon

- Review **Journey Modal** for timeline, billing, intra-op note (read-only post-discharge).
- Sign intra-op note on OT page when applicable.
- Discharge summary finalize (ReadyForDischarge) — coordinate with ward.

---

## Quick permission reference

| I need to… | Permission |
|------------|------------|
| Edit ward checklist / admit / send OT | `ward.checklist.edit` |
| Enter lab values | `ward.investigation.enter` |
| Verify lab results | `ward.investigation.verify` |
| Edit PAC | `anaesthesia.pac.edit` |
| OT accept / surgery | `ot.safety.sign` |
| Edit counsellor P0 | `counsellor.outpatient_checklist.edit` |

Contact IT/admin if an action returns **Missing permission** — do not share accounts.

---

## Training sign-off

| Role | Trainer | Date | WF reviewed |
|------|---------|------|-------------|
| Ward nurse lead | | | WF-01,02,03,07,10 |
| OT lead | | | WF-04,05,06 |
| Counselling lead | | | WF-01,10 + schedule |
| Anaesthesia lead | | | WF-02,04,05 |
