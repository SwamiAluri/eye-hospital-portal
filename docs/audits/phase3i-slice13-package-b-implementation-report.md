# Phase 3I Slice 13 Package B — Implementation Report

| Field | Value |
|-------|--------|
| **Document date** | 2026-09-21 |
| **Package** | **PACKAGE B — RR + COUNSELLOR NAVIGATION** |
| **Product Decision SoT** | `docs/audits/counsellor-ownership-work-allocation-phase3i-slice13-product-decisions.md` (**ACCEPTED**) |
| **Readiness audit** | `docs/audits/counsellor-ownership-work-allocation-phase3i-slice13-readiness-audit.md` |
| **Implemented decisions** | **PD-S13-A = C** · **PD-S13-B = B** · **PD-S13-D = C** |
| **Backend business-rule change** | **NO** — existing certified Reassign API reused |
| **Manual UAT** | **PASS** (2026-09-22) — Product Owner; see Package B acceptance |
| **Delivery Acceptance** | **DELIVERY ACCEPTED** — `docs/audits/phase3i-slice13-package-b-acceptance.md` |

---

## 1. Scope

**PACKAGE B — RR + COUNSELLOR NAVIGATION**

Implemented:

- **PD-S13-A = OPTION C** — Add Reassign only to Sessions; preserve ReQueue on Follow-up  
- **PD-S13-B = OPTION B** — Add Counselling Sessions navigation entry to existing Counsellor sidebar  
- **PD-S13-D = OPTION C** — Sessions is primary RR remediation host; Waiting List Reassign eligibility unchanged  

---

## 2. Pre-Implementation Audit

### Existing Sessions surface

| Item | Path / evidence |
|------|-----------------|
| Route | `/dashboard/counsellors-desk/sessions` |
| Page | `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/sessions/page.tsx` |
| Data hook | `useCounselingSessions` → `counseling-sessions.api` |
| Pre-change actions | **Open only** |
| List DTO fields (backend) | `CounselingSessionDto` includes `CounselorId`, `CounselorName`, `BranchId`, `Version` |

### Existing RR implementation

| Item | Evidence |
|------|----------|
| FE filter | `reassignment-required-filter.ts` + Sessions chip → `?reassignmentRequired=true` |
| Backend | `ApplyReassignmentRequiredFilter` / Slice 12 availability helpers |
| Semantics | Operational condition; open owned sessions with unavailable owner |
| Authorization | Existing Sessions list PD16 / tenant path |

### Existing Reassign implementation

| Item | Evidence |
|------|----------|
| API | `POST /Counseling/sessions/{id}/reassign` |
| FE client | `counsellorsDeskApi.reassignSession` |
| Permission | `counseling_sessions.reassign` |
| Dialog | `WaitingListReassignDialog.tsx` (target picker, reason, CAS `version`, 409 handling) |
| History | Existing ownership mutation → Ownership History (no FE history write) |
| Inactive targets | Slice 12 Assign/Reassign gate + GetCounselors exclusion |

### Existing Navigation

| Item | Evidence |
|------|----------|
| Config | `sidebar-menu-sections.tsx` Counsellor section |
| Pre-change items | Waiting List, Finalize Surgery, Follow-up Center, Analytics |
| Sessions | Route existed; **not** in sidebar |

### Existing Waiting List / Follow-up boundaries

| Item | Evidence |
|------|----------|
| WL Reassign eligibility | `isWaitingListEligibleForReassign` — Pending\|Processed + owned only |
| Follow-up ReQueue | `surgery-followup/page.tsx` + ReQueue modal |

### Existing tests (pre-change)

- Backend: Phase3I Slice 6 Reassign / Slice 12 RR suites (untouched)  
- FE: `WaitingListReassignDialog.test.tsx`, `counselling-reassign-capability.test.ts`, `reassignment-required-filter.test.ts`  

### Risk assessment

| Risk | Mitigation |
|------|------------|
| Second Reassign API | Reused `WaitingListReassignDialog` + existing API |
| Frontend-only RR predicate | Reassign CTA only when RR filter is on (list = server RR population) |
| Broaden WL eligibility | `isWaitingListEligibleForReassign` not modified |
| Add ReQueue to Sessions | Not implemented |
| New route / worklist | Nav links existing Sessions route only |

**No certified-rule conflict requiring STOP.**

---

## 3. Implementation

| File | Change |
|------|--------|
| `sessions/page.tsx` | Wire Reassign CTA + reuse `WaitingListReassignDialog`; gate via `canShowSessionsRrReassign`; Open retained |
| `sessions-rr-reassign.ts` | Package B gating helper (RR filter + permission + owner) |
| `sessions-rr-reassign.test.ts` | Unit tests for gating + WL eligibility regression |
| `sessions-package-b.contract.test.ts` | Contract: dialog reuse, no ReQueue, sidebar Sessions entry |
| `sidebar-menu-sections.tsx` | Add **Counselling Sessions** → `/dashboard/counsellors-desk/sessions` |
| `counseling-sessions.api.ts` | Document `counselorId` / `counselorName` on `CounselingSession` type |

---

## 4. API / Backend Changes

**Existing certified Reassign API/service path reused; no backend business-rule change required.**

| Check | Result |
|-------|--------|
| New endpoint | **No** |
| RR detection change | **No** |
| Permission change | **No** — reuse `counseling_sessions.reassign` |
| CAS / 409 | **Preserved** via existing dialog → API `version` |
| Ownership History | **Preserved** via existing Reassign mutation path |
| PD16 | **Preserved** (server-side) |

---

## 5. Frontend Changes

### Sessions Reassign (PD-S13-A = C)

- When `reassignmentRequired=true` (server-filtered RR list) and user has `.reassign` and row has `CounselorId`, row shows **Reassign** + **Open**.  
- Reassign opens existing `WaitingListReassignDialog` with owner, branch, and `version`.  
- Success / 409 conflict → refetch Sessions list.  
- **ReQueue is not exposed** on Sessions.

### Navigation (PD-S13-B = B)

- Counsellor sidebar adds **Counselling Sessions** linking to existing `/dashboard/counsellors-desk/sessions`.  
- Does **not** force `?reassignmentRequired=true`.  
- No new route / alias / second worklist.

### Waiting List (PD-S13-D = C)

- `isWaitingListEligibleForReassign` **unchanged**.  
- No new Waiting List CTAs.

---

## 6. Tests

### Commands

```text
npx vitest run \
  src/lib/counsellors-desk/sessions-rr-reassign.test.ts \
  src/lib/counsellors-desk/sessions-package-b.contract.test.ts \
  src/lib/counsellors-desk/counselling-reassign-capability.test.ts \
  src/lib/counsellors-desk/reassignment-required-filter.test.ts \
  src/components/counsellors-desk/waiting-list/WaitingListReassignDialog.test.tsx
```

(from `apps/hospital-portal-web`)

### Results

| Suite | Result |
|-------|--------|
| `sessions-rr-reassign.test.ts` | **5 passed** |
| `sessions-package-b.contract.test.ts` | **5 passed** |
| `counselling-reassign-capability.test.ts` | **5 passed** |
| `reassignment-required-filter.test.ts` | **4 passed** |
| `WaitingListReassignDialog.test.tsx` | **8 passed** |
| **Total this run** | **27 passed / 0 failed** |

Playwright E2E was **not** executed in this task (no counselling fixture run). Manual UAT covers E2E paths.

---

## 7. Certified Behavior Regression Check

| Constraint | Status |
|------------|--------|
| Slice 12 RR detection unchanged | **Yes** |
| CounselorId SoT unchanged | **Yes** |
| CreatedByUserId remains non-ownership | **Yes** |
| Waiting List eligibility unchanged | **Yes** |
| Follow-up ReQueue unchanged | **Yes** (untouched) |
| CAS/409 unchanged | **Yes** (reused dialog/API) |
| Ownership History unchanged | **Yes** |
| PD16 unchanged | **Yes** |
| No automatic transfer / clear / ReQueue | **Yes** |
| No duplicate worklist | **Yes** |

---

## 8. Out-of-Scope Verification

| Decision | Implemented? |
|----------|--------------|
| PD-S13-C Admin handoff | **No** |
| PD-S13-E Claim availability | **No** |
| PD-S13-F Post-Surgery ownership | **No** |
| PD-S13-G Legacy migration | **No** |
| PD-S13-H Bulk remediation | **No** |
| PD-S13-I Dashboard | **No** |
| PD-S13-J Waiting List UX | **No** |
| PD-S13-K Wave 2 redesign | **No** |
| PD-S13-L ReQueue→History redesign | **No** |
| PD-S13-M Clinical SoT | **No** |

---

## 9. Files Changed

### Modified

- `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/sessions/page.tsx`
- `apps/hospital-portal-web/src/lib/navigation/sidebar-menu-sections.tsx`
- `apps/hospital-portal-web/src/lib/api/counseling-sessions.api.ts`

### Created

- `apps/hospital-portal-web/src/lib/counsellors-desk/sessions-rr-reassign.ts`
- `apps/hospital-portal-web/src/lib/counsellors-desk/sessions-rr-reassign.test.ts`
- `apps/hospital-portal-web/src/lib/counsellors-desk/sessions-package-b.contract.test.ts`
- `docs/audits/phase3i-slice13-package-b-implementation-report.md` (this file)

---

## 10. UAT Status

**READY FOR MANUAL UAT**

Do **not** treat this document as UAT Passed or Delivery Accepted.

### Manual UAT checklist

#### Sessions / RR

- [ ] Sessions reachable from Counsellor sidebar  
- [ ] Existing Sessions route opens correctly  
- [ ] RR population remains correct with Reassignment Required filter  
- [ ] Applicable RR session exposes Reassign (filter on + `.reassign` + owner)  
- [ ] Non-applicable sessions do not expose unintended ownership actions  

#### Reassign

- [ ] Existing Reassign workflow opens  
- [ ] Target selection works  
- [ ] Successful reassignment updates ownership  
- [ ] Ownership History is preserved  
- [ ] Unauthorized user cannot perform mutation  
- [ ] Cross-branch target/action is blocked  
- [ ] Stale record produces expected 409 behavior  
- [ ] No automatic ownership by opening/viewing  

#### Boundaries

- [ ] ReQueue is **not** available from Sessions  
- [ ] ReQueue remains available through Follow-up as before  
- [ ] Waiting List Reassign eligibility is unchanged  
- [ ] Waiting List shared behavior is unchanged  
- [ ] No new worklist exists  
- [ ] No duplicate Sessions route exists  

#### Navigation

- [ ] Counselling Sessions appears in Counsellor sidebar  
- [ ] Points to `/dashboard/counsellors-desk/sessions`  
- [ ] Existing sidebar structure remains intact  
- [ ] No unrelated navigation items changed  

#### Responsive / accessibility

- [ ] Desktop staff workflow is clean  
- [ ] Existing responsive behavior remains intact  
- [ ] Keyboard interaction works  
- [ ] Focus behavior is correct  
- [ ] Action labels are accessible  
- [ ] No unnecessary visual clutter  

---

## 11. Acceptance Status

```text
IMPLEMENTATION COMPLETE FOR PACKAGE B
AUTOMATED VALIDATION: PASS
MANUAL UAT: PASS (2026-09-22)
PACKAGE B: DELIVERY ACCEPTED
```

Authoritative Delivery Acceptance:

`docs/audits/phase3i-slice13-package-b-acceptance.md`

---

**END — PACKAGE B IMPLEMENTATION REPORT — DELIVERY ACCEPTED**
