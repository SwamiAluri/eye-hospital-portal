# Phase2X Slice 2 — Lifecycle blockers (safe subset)

| Field | Value |
|-------|--------|
| **Slice** | Phase2X Slice 2 — Option A (safe subset) |
| **Date** | 2026-09-12 |
| **Status** | Documentation + regression locks only — **no Active EXIT wiring** |

This document records unresolved product/clinical SoT blockers discovered during Phase2X Slice 2 audit.  
It does **not** approve engineering interpretations. Silence ≠ approval.

---

## 1. Surgery completed — clinical signal EXISTS, Follow-up EXIT SoT NOT APPROVED

### Clinical signal present in the platform

IP Management journey records can reach:

- `patient_journey.clinical_state = SurgeryCompleted`
- `patient_journey.surgery_ended_at` (companion timestamp)

These are written by the IP clinical-transition workflow (`PatientJourneyService.TransitionClinicalAsync` / OT board complete path).

### Follow-up Center status

**BLOCKED — PRODUCT / CLINICAL SOT REQUIRED**

Phase2W PD9 working rule states that surgery **COMPLETED** should exit Active Follow-up.  
However, Phase2W does **not** name `clinical_state = SurgeryCompleted` (or any other column) as the Follow-up Center Active EXIT system of record.

**Engineering must NOT** (until Product/Clinical/Patient-flow explicitly authorizes):

- wire `SurgeryCompleted` to Active EXIT
- exclude Active rows at query time because of `SurgeryCompleted`
- treat `patient_journey.CounselingSessionId` as a mandatory join for exit
- infer completion from OT finalize / booking / discharge / billing / counselling `Status`
- invent a replacement completion signal

Slice 2 regression tests assert that Active membership remains **intention-allowlist only** and that clinical journey rows do **not** remove Active sessions.

### Questions that must be answered before any Active EXIT implementation

Mark each as **BLOCKED — PRODUCT / CLINICAL SOT REQUIRED** (not answered here):

1. Is `patient_journey.clinical_state = SurgeryCompleted` the authoritative Follow-up EXIT event?
2. Does exit happen immediately at query time, or through an explicit workflow/event that mutates counselling state?
3. How does the Journey map to a counselling session for exit purposes?
4. What happens when `CounselingSessionId` is null?
5. Can one journey correspond to multiple counselling sessions?
6. Which session(s) should exit when surgery is completed?
7. How do cancelled/aborted surgeries affect the rule?
8. How do rescheduled surgeries affect the rule?
9. How does surgery completed outside the expected counselling workflow affect the rule?
10. What is the destination/lifecycle state after Active EXIT (clear intention / move to Post-Surgery process / other)?

---

## 2. Cold lifecycle — deferred (do not invent)

Cold population remains **Declined** + **ReferredElsewhere** only.

**Deferred / not implemented (no hospital SoT):**

- time-based Cold expiration
- automatic opt-out
- automatic re-engagement
- forced callback / contact-sequence exhaustion
- arbitrary closure periods

Cold exits via explicit closure / approved re-engagement / opt-out remain **BLOCKED — PRODUCT / CLINICAL SOT REQUIRED** until fields and workflows are defined.

---

## 3. Post-Surgery — deferred counsellor completion

Post-Surgery population remains discharged `patient_journey` rows (`IsDischarged == true`).

Counsellor operational completion / EXIT from Post-Surgery is **BLOCKED — PRODUCT / CLINICAL SOT REQUIRED** (PD4 checklist undefined).

Slice 1 SessionId honesty remains in force: no opportunistic latest-session Open Session; no invented Journey → Session relationship for Open Session.

Ward/IP post-op booking is out of scope.

---

## 4. Next Action — source ambiguity deferred

PD2 working rule: every Active patient must have a planned Next Action.

Authoritative storage is **not** uniquely established among:

- latest `counselor_communication_log.NextAction` / `NextActionDate`
- a session-level field (none dedicated today)
- callback schedule date
- other business-event dates

**BLOCKED — PRODUCT SOT REQUIRED** before mandatory Next Action enforcement.

Do **not**: invent a due field; use +7/+14/+30; invent SLA; pick a SoT silently.

Phase2Y completed Follow-up Center **presentation honesty** (no High Priority KPI; no never-contacted→Medium; Post aging relabeled as factual discharge age). Phase2Y did **not** select a Next Action SoT or enforce mandatory Next Action — that remains blocked here.

---

## 5. Follow-up Reason — taxonomy deferred

PD8: structured Follow-up Reason distinct from Intention / Communication Outcome / Delay / Next Action.

Hospital-approved reason code list is **not** present as an approved taxonomy for Follow-up Center.

**BLOCKED — PRODUCT SOT REQUIRED** — do not invent guessed codes.

Existing free-text fields (e.g. `ReasonsForDelay`) must not be falsely treated as an approved Follow-up Reason taxonomy.

---

## 6. Explicit closure / opt-out / contact-sequence exhaustion

**BLOCKED — PRODUCT / CLINICAL SOT REQUIRED**

No authoritative Follow-up Center field/API currently implements these PD9 exit paths. Do not add speculative columns.

---

## Document control

| Item | Value |
|------|--------|
| Related | Phase2W workshop pack / product decisions / final gate; Phase2V G02 |
| Code change in this doc refresh | Documentation only |
| Active EXIT wired to SurgeryCompleted | **NO** |
| Next Phase2X slice / Phase2Y | **NOT** authorized by this document |
