# Counsellor Wave 2 — Decision Schedule + Visit Policy UAT Defects

Bounded corrections for two Manual UAT defects on the existing Quote → Decision → Insurance journey. This report does not accept Wave 2.

## 1. Defect A — Schedule Validation

### Observed behavior

Schedule Surgery required Select Date, Operation Theatre, Doctor, and Surgery Start Time. A counselling plan with a date and doctor could not be submitted while theatre and start time were empty.

### Existing contract

Counselling persistence already accepts a surgery plan without a theatre slot.

- `ScheduleData` stores `operationTheatre` and `surgeryStartTime` as strings. Empty strings are valid and are restored from `packageAddonsJson`.
- `validateDecisionPhase` requires date and doctor only when the decision is Date for Surgery. It does not require theatre or start time.
- `saveCounsellingSession` writes `surgeryTentativeDate` from the selected date and writes `surgeryTentativeTimeSlot` only when a start time is present.
- Auth `CounselingSession.SurgeryTentativeDate` is `DateTime?`. `SurgeryTentativeTimeSlot` is `string?`. Update copies them only when the request sends a value.
- `UpsertOtScheduleRequest.TheatreName` and `StartTime` are nullable, and `ot_finalize_schedule.theatre_name` / `start_time` are nullable.
- That nullability does **not** mean an OT upsert is harmless. `OtFinalizeService.UpsertFromCounsellorAsync` inserts or updates an `OtFinalizeSchedule` in `NotConfirmed` whenever it is called. A date-only `startTime` string (`yyyy-MM-dd`) binds as a clock time of midnight.

### Root cause

Required markers and `validate()` in `ScheduleSurgeryModal` rejected an empty theatre and an empty start time before local schedule state was updated.

The save path then treated any scheduled date on Interested or Date for Surgery as an OT handoff. A pre-fix run of the new save tests showed `upsertOtSchedule` called with `theaterName: ""` and `startTime: "2026-09-20"`. That would create a Finalize Surgery row and a fake start time.

### Fields currently required at:

- UI: Select Date and Doctor. Operation Theatre, Surgery Start Time, Avoid Time From, and Avoid Time To are optional.
- counselling validation: payment type, decision, insurer when the payment type requires one, and for Date for Surgery a date plus doctor. Doctor remains required. Theatre and start time are not decision-phase requirements.
- API: counselling save accepts a missing time slot. Azure `schedule` sends the date only. OT upsert is called only when both theatre and start time are present.
- backend: session date and time slot columns are nullable. No schema change.
- persistence: date and doctor name remain on the counselling session blob. A complete theatre plus start time still uses the existing OT upsert or slot edit. An incomplete slot does not write `ot_finalize_schedule`.

### Decision

The persistence contract already supports Date + Doctor without theatre or start time. No backend, database, or FSM change.

### Fix

- `validateScheduleSurgerySubmission` requires only a date and a doctor.
- Schedule Surgery labels mark only Select Date and Doctor as required.
- `hasCompleteCounsellingOtSlot` gates the existing OT upsert and slot edit. Both theatre and start time must be non-blank. No default time and no default theatre are generated.
- When the slot is incomplete, counselling save and session completion continue. OT failure handling for a complete slot is unchanged.
- The decision schedule line joins only non-empty theatre and doctor values so an empty theatre is not shown as a blank prefix.

### Tests

`schedule-surgery-validation.test.ts`: A1, A2, A3, A4, A5, A6.

`save-counselling-session.fs01.test.ts`:

- A1 / A10 — date, doctor, OT, and 09:00 still upsert `theaterName: OT-1` and `startTime: 2026-09-20T09:00:00`, and the session payload keeps that time slot.
- A2 / A7 / A8 / A9 — date and doctor with empty theatre and start time save `surgeryTentativeDate`, omit `surgeryTentativeTimeSlot`, store the empty fields in the counselling blob, and do not call `upsertOtSchedule` or `editOtScheduleSlot`.
- Theatre without start time, and start time without theatre, also skip both OT writes.

## 2. Defect B — Visit Policy Refresh

### Observed behavior

After a successful Save Draft, the Visit Policies rail could still show “No policies on visit”. Leaving the Insurance surface and returning showed the same policy as Primary.

### Persistence trace

Save Draft calls `CoveragePreauthPanel.persistDraft`, which calls `updateCoverageCase` (`PATCH` coverage draft). It does not call `createPolicy` or `updatePolicy`.

`CoverageCaseService.PatchDraftAsync` already upserts `ccms_visit_insurance_policies` when `PolicyNumber` is present:

- same policy number: update that row, and mark it primary when no other active primary exists
- no matching number and no primary: insert one row with `IsPrimary = true`
- different number with an existing primary: update that primary row
- blank policy number: no visit-policy write; the coverage draft still saves

Primary is the existing backend flag. This change does not select a primary in the browser.

### Query/read trace

`VisitPolicyList` reads `useCcmsCasePolicies` (`ccmsKeys.policies(caseId)`, stale for 2 minutes; the app query client also disables refetch on window focus).

`persistDraft` already called `getPoliciesByCase` after the patch to hydrate the form. That GET was not written back to `ccmsKeys.policies`, so the rail kept the empty list fetched when the case opened. A later mount or a stale refetch showed the row the server had already saved.

There is no second frontend POST. The write is the coverage-case patch. The list read can happen before that patch; the missing step was publishing the GET that runs after the patch.

### Root cause

Policy persistence on draft save is a CCMS patch side effect. The Visit Policies query cache was not updated from the authoritative post-save read.

### Fix

After `getPoliciesByCase` succeeds, `publishAuthoritativeVisitPolicies` writes that array into `ccmsKeys.policies(caseId)`. `VisitPolicyList` re-renders from that cache. The helper does not create a policy, invent a Primary flag, wait on a timer, or refetch a second time.

If that GET fails, the previous catch path hydrates the form from the existing list and does not overwrite the cache.

### Tests

`visit-policy-list-cache.test.ts`:

- B2 / B3 — published policy appears on the VisitPolicyList query key and in `selectVisitPoliciesForDisplay`
- B4 — a row returned with `isPrimary: true` remains the single primary
- B5 — cache publish does not call a create function
- B9 — duplicate same-number rows in the authoritative list still display as one row
- B1 / B6 / B7 / B8 / B10 — `persistDraft` still calls `updateCoverageCase` and `getPoliciesByCase`, still honors `requirePolicyNumber`, does not call `createPolicy` or `updatePolicy`, and publishes the list cache. Add/Edit still own `createPolicy` / `updatePolicy` in `VisitPolicyForm`.

`coverage-visit-policy-persist-contract.test.ts` and `VisitPolicyList.refresh.test.ts` still pass: draft save does not call `trySyncVisitPolicy`, and explicit Add/Edit still invalidate `ccmsKeys.policies`.

## 3. Business Rules Preserved

- Insurance: payment type, insurer requirement, and coverage draft payload are unchanged.
- Pre-Auth: `notRequiredPreAuth` still hides the coverage workflow. Submit to claims still uses `ensurePrimaryVisitPolicySynced`.
- Visit Policy: creation and update on Save Draft stay inside `PatchDraftAsync`. Explicit Add/Edit remain on `VisitPolicyForm`.
- Primary policy: `IsPrimary` is still set only by the existing CCMS patch and set-primary API. The rail still renders `policy.isPrimary` with the existing uppercase Primary badge.
- Decision: Date for Surgery still requires date and doctor. Doctor was not made optional.
- Schedule: a complete theatre and start time still hand off to Finalize Surgery. An incomplete slot does not.
- Ownership: CounsellorId, assign, reassign, and requeue were not touched. Coverage still owns visit-policy rows.
- FSM: counselling session status transitions and OT status transitions were not changed.
- Permissions: no permission or route changes.
- CCMS contracts: no new endpoint and no change to patch or visit-policy request bodies.

## 4. Files Changed

- `apps/hospital-portal-web/src/lib/counsellors-desk/schedule-surgery-validation.ts`
- `apps/hospital-portal-web/src/lib/counsellors-desk/schedule-surgery-validation.test.ts`
- `apps/hospital-portal-web/src/components/counsellors-desk/ScheduleSurgeryModal.tsx`
- `apps/hospital-portal-web/src/lib/counsellors-desk/save-counselling-session.ts`
- `apps/hospital-portal-web/src/lib/counsellors-desk/save-counselling-session.fs01.test.ts`
- `apps/hospital-portal-web/src/components/counsellors-desk/session/CounsellingWorkflowSections.tsx`
- `apps/hospital-portal-web/src/lib/ccms/visit-policy-list-cache.ts`
- `apps/hospital-portal-web/src/lib/ccms/visit-policy-list-cache.test.ts`
- `apps/hospital-portal-web/src/components/counsellors-desk/coverage/CoveragePreauthPanel.tsx`
- `docs/audits/counsellor-wave2-decision-schedule-and-visit-policy-uat-defects-report.md`

## 5. Automated Tests

Command, from `apps/hospital-portal-web`:

```
npx vitest run src/lib/counsellors-desk/schedule-surgery-validation.test.ts src/lib/ccms/visit-policy-list-cache.test.ts src/lib/counsellors-desk/save-counselling-session.fs01.test.ts src/lib/ccms/coverage-visit-policy-persist-contract.test.ts src/components/ccms/VisitPolicyList.refresh.test.ts src/lib/ccms/ccms-visit-policy-prereq.test.ts src/lib/counsellors-desk/counselling-progress.test.ts
```

Result: 7 files, 94 tests, all passed.

Before the OT gate, the new save tests failed because `upsertOtSchedule` ran with an empty theatre and a date-only start time.

## 6. Browser / Playwright

Portal (`:3000`), Auth (`:5073`), and CCMS (`:7075`) were listening.

```
npx playwright test e2e/counselling-session.spec.ts -g "schedule modal: submit syncs surgery date" --project=chromium
```

Auth setup passed. The schedule-modal case was skipped because `E2E_COUNSELLING_SESSION_ID` is not set (`hasCounsellingFixture()` is false).

No browser tool was available in this session. The combined Decision → Insurance sequence and its network trace were not executed here.

## 7. Manual UAT

MANUAL UAT REQUIRED

Do not mark Wave 2 accepted from this implementation report.
