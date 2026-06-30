# Ward & IP Journey — RBAC Audit (Phase 4.1)

**Purpose:** Single reference for JWT permission checks on ip-management ward journey APIs.  
**Backend:** `microservices/ip-management-service` · `IpChecklistAuth.cs`  
**Frontend mirror:** `use-ip-checklist-permissions.ts`

**Audit date:** Phase 4 implementation  
**Status:** Closed — gaps in `JourneyFunctions` patched (ward assignment, OT details, emergency FC, discharge override).

---

## Permission codes

| Code | Typical roles | Frontend hook |
|------|---------------|---------------|
| `ward.checklist.edit` | Ward nurse, IPD nursing | `canEditWardChecklist` |
| `ward.investigation.enter` | Ward nurse, lab entry | `canEnterInvestigation` |
| `ward.investigation.verify` | Senior nurse, doctor | `canVerifyInvestigation` |
| `ot.safety.sign` | OT nurse, anaesthetist, surgeon | `canSignOtSafety` |
| `anaesthesia.pac.edit` | Anaesthetist | `canEditPac` |
| `anaesthesia.monitoring.edit` | Anaesthetist, OT | `canEditMonitoring` |
| `counsellor.outpatient_checklist.edit` | Counsellor | `canEditCounsellorOutpatient` |
| `ot.safety.override` | OT supervisor | `canOverrideWhoTimeout` |
| `ip_management.view` | Read-only IP access | — |

**Composite helpers**

| Helper | Allows |
|--------|--------|
| `RequireClinicalTransition` | `ward.checklist.edit` **or** `ot.safety.sign` **or** `ip_management.view` |
| `RequireInvestigationEnter` | `ward.investigation.enter` **or** `ward.checklist.edit` |
| `RequireInvestigationVerify` | `ward.investigation.verify` **or** `ward.checklist.edit` |

Empty permission list in JWT → checks skipped (dev / legacy tokens).

---

## Journey endpoints (`JourneyFunctions.cs`)

| Method | Route | Permission / check | WF |
|--------|-------|-------------------|-----|
| GET | `/journeys` | JWT only | All |
| GET | `/journeys/{id}` | JWT only | All |
| POST | `/journeys/{id}/admit` | `RequireClinicalTransition` | WF-01 |
| PUT | `/journeys/{id}/ward` | `RequireClinicalTransition` | WF-02 |
| PUT | `/journeys/{id}/ot` | `ot.safety.sign` | WF-04 |
| POST | `/journeys/{id}/clinical-transition` | `RequireClinicalTransition` | WF-03,06,07,08 |
| POST | `/journeys/{id}/cancel-today-surgery` | `RequireClinicalTransition` | WF-10 |
| POST | `/journeys/{id}/accept` | `ot.safety.sign` | WF-04 |
| POST | `/journeys/{id}/start-surgery` | `ot.safety.sign` | WF-05 |
| POST | `/journeys/{id}/emergency-fc` | `RequireClinicalTransition` | WF-01 |
| POST | `/journeys/{id}/discharge-override` | `RequireClinicalTransition` | WF-08 |

**Service-layer role check:** OT return to `ReadyForSurgery` requires OT Nurse / Anaesthetist / Surgeon role (`PatientJourneyService`).

---

## Checklist & clearance endpoints

| Area | Mutations | Permission |
|------|-----------|------------|
| §1 Investigations | enter value, upload | `RequireInvestigationEnter` |
| §1 Investigations | verify | `RequireInvestigationVerify` |
| §2 Pre-op clearance | completions, sections, approve | `ward.checklist.edit` |
| §3 Ward safety checklist | save | `ward.checklist.edit` |
| §4 PAC | save / complete | `anaesthesia.pac.edit` |
| Med log | CRUD | `ward.checklist.edit` |
| Anaesthesia monitoring | CRUD | `anaesthesia.monitoring.edit` |
| OT surgical safety | sign / save | `ot.safety.sign` |
| WHO override | apply | `ot.safety.override` |
| Form 4 post-op | save completions, IOL | `ward.checklist.edit` |
| Counsellor P0 | save | `counsellor.outpatient_checklist.edit` |

---

## UI ↔ API alignment

| UI action | Required permission | Enforced BE |
|-----------|---------------------|-------------|
| Investigation value row | enter or ward edit | Yes |
| Investigation verify button | verify or ward edit | Yes (FE hides if missing) |
| Admit / Send to OT / Mark ready | ward edit | Yes |
| Cancel today | ward edit | Yes |
| Emergency FC row action | ward edit | Yes (fixed Phase 4) |
| OT accept / start surgery | ot.safety.sign | Yes |
| PAC form save | anaesthesia.pac.edit | Yes |
| Post-op Form 4 toggles | ward.checklist.edit | Yes |

---

## Regression tests

| Spec | Coverage |
|------|----------|
| `e2e/ip-checklist-rbac.spec.ts` | Nurse route, investigation verify hidden without permission |
| `e2e/ip-ward-preop-workspace.spec.ts` | Workspace smoke |
| `e2e/ip-ward-cancel-today.spec.ts` | Cancel UI presence |
| `e2e/ip-ward-phase3.spec.ts` | Post-op shell, journey read-only tabs |

Run full ward suite: `npm run test:e2e:ward-journey`

---

## Phase 4 fixes applied

| Endpoint | Before | After |
|----------|--------|-------|
| `PUT .../ward` | JWT only | `RequireClinicalTransition` |
| `PUT .../ot` | JWT only | `ot.safety.sign` |
| `POST .../emergency-fc` | `ot.safety.sign` (wrong for ward) | `RequireClinicalTransition` |
| `POST .../discharge-override` | JWT only | `RequireClinicalTransition` |
