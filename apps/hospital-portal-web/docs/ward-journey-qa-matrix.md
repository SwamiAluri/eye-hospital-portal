# Ward & IP Journey — QA Verification Matrix

**Purpose:** Structured UAT / regression checklist for each clinical workflow (WF-01…WF-10).  
**Related docs:** [ward-journey-user-workflows.md](./ward-journey-user-workflows.md), [ward-ip-journey-deployment-runbook.md](./ward-ip-journey-deployment-runbook.md)

**How to use:** Execute in order where dependencies exist. Mark **Pass / Fail / N/A / Blocked**. Record environment, tester, and date in the sign-off table at the bottom.

**Legend**

- **Phase:** Minimum implementation phase before workflow is fully testable
- **Gate:** Expected behavior — warn-only unless noted

---

## WF-01 — Expected (pre-admit)

**Phase required:** 1+ (full criteria); partial testing OK on current build  
**Primary UI:** `/dashboard/ip-management/ward` → Ward Pre-Op Workspace → AdmitModal  
**Roles:** Ward nurse, front desk

| # | Step | Expected result | Pass |
|---|------|-----------------|------|
| 1.1 | Open ward dashboard; filter **Expected** | Patients listed with surgery date, OT state `NotSent` | ☐ |
| 1.2 | Row shows P0 chip when counsellor checklist incomplete | Amber `P0 N%` badge visible | ☐ |
| 1.3 | Click row → workspace opens | Phase progress strip P0–P4 visible | ☐ |
| 1.4 | §1 Investigations: enter result value, Save | Row shows Entered; value persisted on refresh | ☐ |
| 1.5 | §1: Verify result (if permitted) | Status Verified with timestamp | ☐ |
| 1.6 | §1: Optional upload report | Document linked or preview available | ☐ |
| 1.7 | §2: Complete Compliance/Consent/Financial item (non-Evaluation) | Item saved | ☐ |
| 1.8 | §2: Evaluation + Anaesthesia **locked** at Expected (Phase 1.2) | Locked message; no edit until admit | ☐ |
| 1.9 | §4 PAC view-only | Banner: admit to continue; no save | ☐ |
| 1.10 | Care tabs hidden until Admitted (Phase 1.5) | Vitals/Med/Nurse/Remark not shown or collapsed | ☐ |
| 1.11 | Footer **Admit Patient** → AdmitModal | Modal opens with admission fields | ☐ |
| 1.12 | Admit with incomplete P0/P1 — gate warnings | Warn-only list; acknowledge → admit succeeds | ☐ |
| 1.13 | CCMS pre-auth block (G11) if applicable | Hard block unless financial bypass + reason | ☐ |
| 1.14 | Emergency FC row action | FC applied with reason | ☐ |
| 1.15 | Case Sheet row action | Read-only snapshot opens | ☐ |

**APIs:** `GET /ip-management/journeys`, §1 PUT/POST, `POST .../admit`

---

## WF-02 — Admitted

**Phase required:** 1+  
**Primary UI:** Ward Pre-Op Workspace  
**Roles:** Ward nurse, anaesthetist, doctor

| # | Step | Expected result | Pass |
|---|------|-----------------|------|
| 2.1 | Patient shows **Admitted** tab after admit | Ward/bed/admitted time populated on list | ☐ |
| 2.2 | §2 Evaluation + Anaesthesia **unlocked** | Sections editable | ☐ |
| 2.3 | Vitals tab visible and editable | Add BP, pulse, etc. | ☐ |
| 2.4 | Medication Log: add drug + record dose | Dose saved; dilatation prompts Form 2 hint if applicable | ☐ |
| 2.5 | Nurse Records: add entry | Record saved on Mark Ready or immediately | ☐ |
| 2.6 | §4 PAC: complete assessment | PAC Completed; §1 summary visible in PAC | ☐ |
| 2.7 | PAC complete with unverified critical lab | Warn dialog; can still complete | ☐ |
| 2.8 | **Save & Mark Ready for Surgery** with incomplete PAC | Gate warn; confirm → state ReadyForSurgery | ☐ |
| 2.9 | Mark Ready with pending vitals in queue | Vitals flushed and saved | ☐ |

**APIs:** PAC, vitals, med log, `POST .../clinical-transition` → `ReadyForSurgery`

---

## WF-03 — ReadyForSurgery

**Phase required:** 1+  
**Primary UI:** Ward Pre-Op Workspace + SendToOTModal  
**Roles:** Ward nurse

| # | Step | Expected result | Pass |
|---|------|-----------------|------|
| 3.1 | Patient on **Ready for Surgery** tab | Status badge correct | ☐ |
| 3.2 | §1–§3 still editable | Changes save | ☐ |
| 3.3 | Footer **Send to OT** (no inline row →OT after Phase 2.9) | SendToOTModal opens | ☐ |
| 3.4 | Send with empty med log | Gate warn; acknowledge → SentToOT | ☐ |
| 3.5 | After send: `clinicalState=SentToOT`, `otState=SentToOT` | OT column updated | ☐ |
| 3.6 | Returned from OT badge if applicable | `otReturnReason` shown on row | ☐ |

**APIs:** `POST .../clinical-transition` → `SentToOT`

---

## WF-04 — SentToOT (OT accept)

**Phase required:** Existing (OT page)  
**Primary UI:** `/dashboard/ip-management/operation-theatre`  
**Roles:** OT nurse, anaesthetist

| # | Step | Expected result | Pass |
|---|------|-----------------|------|
| 4.1 | Patient appears on OT page Awaiting Acceptance | Not required on ward filtered tabs (by design) | ☐ |
| 4.2 | Fill OT Details (anaesthetist, theatre, anaesthesia type) | Details saved; start enabled when Accepted | ☐ |
| 4.3 | Accept in OT with incomplete Before Anaesthesia checklist | Warn; can accept | ☐ |
| 4.4 | After accept: `otState=Accepted` | OT page status updated | ☐ |
| 4.5 | Return to ward (if needed before surgery) | → ReadyForSurgery; otReturnReason set | ☐ |

**APIs:** `POST .../accept`, `PUT .../ot`, return transition

---

## WF-05 — InOT (start / end surgery)

**Phase required:** Existing  
**Primary UI:** OT page  
**Roles:** Surgeon, anaesthetist, OT nurse

| # | Step | Expected result | Pass |
|---|------|-----------------|------|
| 5.1 | Start surgery with incomplete WHO timeout | Warn; acknowledge → InOT | ☐ |
| 5.2 | Ward **In OT** tab shows patient | Amber highlight optional | ☐ |
| 5.3 | Intra-op notes saved | Persist on journey | ☐ |
| 5.4 | End surgery | `clinicalState=SurgeryCompleted` | ☐ |

**APIs:** `POST .../start-surgery`, `clinical-transition` → `SurgeryCompleted`

---

## WF-06 — SurgeryCompleted → PostOp

**Phase required:** Existing (+ Phase 3 notification optional)  
**Primary UI:** OT page  
**Roles:** OT staff

| # | Step | Expected result | Pass |
|---|------|-----------------|------|
| 6.1 | Complete OT After Surgery checklist | Items saved | ☐ |
| 6.2 | **Move to Post-Op Ward** on OT page (G10) | State → PostOp; ward can see Post-Op tab | ☐ |
| 6.3 | Move with incomplete After Surgery checklist | Gate warn; can proceed | ☐ |
| 6.4 | Ward notified of PostOp transition (Phase 3.3) | Notification or list refresh | ☐ |

**APIs:** `clinical-transition` → `PostOp`

---

## WF-07 — PostOp

**Phase required:** 3.2 for unified shell; partial on current PostOpWardModal  
**Primary UI:** PostOpWardModal  
**Roles:** Ward nurse, surgeon

| # | Step | Expected result | Pass |
|---|------|-----------------|------|
| 7.1 | Click PostOp row → modal opens | Form 4 checklist visible | ☐ |
| 7.2 | Complete mandatory post-op items (IPD) | Items ticked | ☐ |
| 7.3 | IOL barcode verify if applicable | Valid/invalid feedback | ☐ |
| 7.4 | **Mark Ready for Discharge** with incomplete mandatory items | Gate warn; acknowledge → ReadyForDischarge | ☐ |

**APIs:** post-op checklist save, transition → `ReadyForDischarge`

---

## WF-08 — ReadyForDischarge

**Phase required:** Existing  
**Primary UI:** WardDischargeSummaryModal  
**Roles:** Doctor, nurse, anaesthetist

| # | Step | Expected result | Pass |
|---|------|-----------------|------|
| 8.1 | Open Ready for D/C row → discharge modal | Summary fields editable | ☐ |
| 8.2 | Save draft summary | Persists | ☐ |
| 8.3 | Finalize summary | Editing locked | ☐ |
| 8.4 | Discharge without finalize | Blocked with message | ☐ |
| 8.5 | Discharge with missing anaesthesia clearance / nurse summary issued | Gate warn; override with reason if permitted | ☐ |
| 8.6 | Successful discharge | `Discharged`; journey locked | ☐ |

**APIs:** discharge summary save/finalize, `clinical-transition` → `Discharged`

---

## WF-09 — Discharged (read-only)

**Phase required:** Existing  
**Primary UI:** Journey Modal  
**Roles:** Any (read-only)

| # | Step | Expected result | Pass |
|---|------|-----------------|------|
| 9.1 | Enable **Show Discharged** on ward list | Discharged patients visible | ☐ |
| 9.2 | Click discharged row → Journey Modal | No edit actions | ☐ |
| 9.3 | Attempt workspace open on discharged | Blocked or read-only | ☐ |

---

## WF-10 — Cancel today's surgery (Phase 2)

**Phase required:** 2  
**Primary UI:** Ward cancel modal  
**Roles:** Ward nurse; counselling for rebook

| # | Step | Expected result | Pass |
|---|------|-----------------|------|
| 10.1 | Cancel from **Admitted** with reason | → Expected; bed cleared; annotation badge | ☐ |
| 10.2 | Cancel from **ReadyForSurgery** | → Expected; OT slot released if scheduled | ☐ |
| 10.3 | Cancel from **SentToOT** (not Accepted) | → Expected; OT slot released | ☐ |
| 10.4 | Cancel from **SentToOT** when OT Accepted | Blocked; message to OT-return first | ☐ |
| 10.5 | Cancel from **InOT** | Blocked | ☐ |
| 10.6 | Pre-op §1/§2 data retained after cancel | Values still present on reopen | ☐ |
| 10.7 | Counselling rebook clears `pendingRebook` badge (Phase 3.4) | Badge removed after new date | ☐ |
| 10.8 | Merged/superseded MR: cancel blocked (G5) | Error + link to canonical MR | ☐ |

**APIs:** `POST .../cancel-today-surgery`

---

## Cross-cutting regression

| # | Area | Check | Pass |
|---|------|-------|------|
| X.1 | Gate P-label alignment (G4) | AdmitModal warnings match progress strip counts | ☐ |
| X.2 | §2 display status badges (G3) | Each §2 section shows computed status | ☐ |
| X.3 | Same-day single-eye block (G6) | Second OD/OS journey same date rejected at counselling | ☐ |
| X.4 | BE both-eyes same day | One BE journey allowed same date | ☐ |
| X.5 | RBAC: nurse without PAC permission | PAC read-only | ☐ |
| X.6 | E2E automated | `npm run test:e2e:ward-journey` (smoke without `E2E_WARD_FULL_FLOWS`; full flows with env + `npm run resolve:e2e:ward`) | ☐ |

---

## E2E spec mapping

| Workflow | Automated spec |
|----------|----------------|
| WF-01 partial | `e2e/ip-ward-preop-workspace.spec.ts` flow 1 |
| WF-02 partial | flow 2 |
| WF-03 partial | flow 3 |
| WF-04 partial | `e2e/ip-ot-journey.spec.ts` (accept → start → end; smoke without `E2E_WARD_FULL_FLOWS`) |
| WF-05 partial | `e2e/ip-ot-journey.spec.ts` (start/end surgery) |
| WF-06 partial | `e2e/ip-ot-journey.spec.ts` (move to PostOp); Phase 3 OT→PostOp notification |
| WF-07 partial | `e2e/ip-checklist-closure.spec.ts`, `e2e/ip-ward-phase3.spec.ts` |
| WF-10 | `e2e/ip-ward-cancel-today.spec.ts` (modal smoke + full cancel with `E2E_WARD_FULL_FLOWS=1`) |
| WF-10.7 | `e2e/ip-ward-rebook.spec.ts` (`E2E_INTERNAL_API_KEY` + full flows) |
| G6 scheduling guard | `JourneySchedulingGuardServiceTests` (ip-management), `OtFinalizeSchedulingGuardTests` (AuthService), `e2e/ip-ward-scheduling-guard.spec.ts` |
| Closure | `e2e/ip-ward-program-closure.spec.ts` (Phase 5) |
| RBAC | `e2e/ip-checklist-rbac.spec.ts` |
| **Full suite** | `npm run test:e2e:ward-journey` |

---

## Sign-off

**Phase R2 note:** Automated coverage is in the E2E spec mapping table above. Full-flow tests (`E2E_WARD_FULL_FLOWS=1`, `npm run resolve:e2e:ward`, `E2E_INTERNAL_API_KEY` for rebook) require live Auth + ip-management + Next.js. Staging UAT (WF-01…WF-10 step checkboxes) remains manual — mark ☐ → ☑ only after execution in staging.

| Workflow | Env | Tester | Date | Pass/Fail | Notes |
|----------|-----|--------|------|-----------|-------|
| WF-01 | | | | | |
| WF-02 | | | | | |
| WF-03 | | | | | |
| WF-04 | | | | | |
| WF-05 | | | | | |
| WF-06 | | | | | |
| WF-07 | | | | | |
| WF-08 | | | | | |
| WF-09 | | | | | |
| WF-10 | | | | | |
| Cross-cutting | | | | | |

**Release approval:** _________________________ Date: __________

---

## Changelog

| Date | Change |
|------|--------|
| 2026-06-25 | G6 E2E `ip-ward-scheduling-guard.spec.ts`; Phase 4.3 `wardUpdation` alias removed |
| 2026-06-24 | Phase 0.4 — initial QA matrix WF-01…WF-10 + cross-cutting checks |
