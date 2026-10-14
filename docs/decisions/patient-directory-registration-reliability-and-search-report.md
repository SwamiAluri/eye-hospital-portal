# Patient Directory — Registration Reliability + Search Slice Report

**Date:** 2026-10-05  
**IMPLEMENTATION STATUS:** REGISTRATION CARD PRINT FIDELITY COMPLETE — AUTOMATED TESTS PASSED — MANUAL UAT REQUIRED / SEARCH SLICE PENDING  
**NEXT GATE:** MANUAL UAT (one-page complete Registration Card print)  
**STOP**

---

## 1. Root cause of the silent registration outcome

Two **proven frontend lifecycle defects** could produce the UAT symptom set (no soft dialog / no success / no error / back on Directory / search empty):

### Defect A — Success UI blank terminal (PROVEN, FIXED)

After a successful create, the wizard set `savedPatient` (hiding Review + nav) but rendered success only when:

```ts
savedPatient?.medicalRecordNumber && !showRegistrationCard
```

If create returned `id` but MRN was missing/unparsed, the shell showed **neither Review nor success** — a silent empty registration dialog. Closing via X returned to Directory with optional handoff, while search for `Sam Badikolu` still returned 0 (identity absent or wrong query).

### Defect B — Soft/hard dialog visibility desync (PROVEN, FIXED)

`AddPatientDialog` used:

```ts
softOpen = open && phase === 'duplicate-review' && softUi.open
showRegistration = open && phase === 'registration'
```

If `softUi.open` / `hardUi.open` and `phase` briefly desynced, registration could be hidden while soft/hard dialogs stayed closed → **blank terminal** with no Possible Duplicate Patient UI and no Review. Operator closes → looks like silent return to Directory.

### Not proven for this UAT (evidence elsewhere)

| Claim | Evidence |
|---|---|
| Claimed Sam Badikolu create 201 | **No DB row** for Sam+Badikolu (prior forensic) |
| Soft pre-check for claimed phone | Live API **200 / isDuplicate=true / 3× PhoneMatch** — FE **must** show soft dialog when lifecycle is correct |
| Search `Sam Badikolu` empty | **Expected current lookup semantics** (`Contains` on full name) — separate product slice |

---

## 2. Exact state transition where behavior failed

```
Confirm & Create
  → validateForCreate
  → check-duplicates
       ├─ soft candidates → phase=duplicate-review + softUi.open
       │     [DEFECT B] phase∧open desync → blank shell
       └─ unique → createPatientFromWizard
            → parse id (+ optional MRN)
            → setSavedPatient
            → [DEFECT A] success gated on MRN only → blank shell
            → onCreated(id) may still fire
  → operator closes empty dialog
  → Directory (handoff may/may not open Preview)
```

Required contract (now enforced in FE):

| Outcome | Terminal UI |
|---|---|
| Soft PhoneMatch/Email/Fuzzy | Possible Duplicate Patient |
| 201 + id | Patient Registered Successfully (+ MRN or “Unavailable”) + Registration Card + Close |
| Hard ≥0.95 | Hard duplicate dialog; no handoff |
| Create/check failure | Toast error; registration remains open; no false success |

---

## 3. Create API contract (unchanged)

| Item | Value |
|---|---|
| Method/URL | `POST /api/patients` |
| Success | **201** `CreatedAtAction` + `PatientResponse` |
| Body identity | `id` (Guid), `medicalRecordNumber` (camelCase JSON) |
| Hard duplicate | **400** `{ error, message, duplicates[] }` |
| Authz | `patient.create`; tenant header + JWT |

Frontend parser: `parseCreatePatientResponse` (`create-patient-response.ts`) — camelCase / PascalCase / `mrn` alias. **API contract not modified.**

---

## 4. Success-state behavior (after fix)

Driven only by create response → `savedPatient`:

- `data-testid="patient-registration-success"`
- Title: Patient Registered Successfully
- MRN display (`Unavailable` if missing) + warning toast if MRN absent
- Print Registration Card → Registration Card from `savedPatient`
- Close → `onRequestClose` → Directory Preview handoff by `patient.id`
- Does **not** wait for lookup/summary/refresh before showing success

`onCreated(patient.id)` fires in dialog mode immediately on parse success.

---

## 5. Failure-state behavior (after fix)

| Failure | UI |
|---|---|
| Duplicate check network/error | `toast.error` fail-closed; **no create** |
| Create 400 (non-hard) / 401 / 403 / 409 / 500 / network | `toast.error(formatPatientCreateError)`; `savedPatient` cleared; dialog stays open |
| Hard duplicate 400 | Hard dialog; phase duplicate-review; **no** onCreated handoff for create |
| Malformed create (no id) | Throw → toast; no success; no onCreated |

Replaced `alert('Failed to create…')` with canonical `react-hot-toast`.

---

## 6. Duplicate pre-check behavior

Unchanged matcher/thresholds/normalization.

Live UAT (this session) for Sam / Badikolu / 1987-08-01 / 8919653433:

| Field | Result |
|---|---|
| HTTP | 200 |
| isDuplicate | true |
| Candidates | **3** |
| MatchType | PhoneMatch ×3 |
| Confidence band | 0.90 soft (server; not in minimized DTO) |

FE: `shouldShowSoftDuplicateReview` → soft dialog. No Create Anyway / merge overrides.

---

## 7. Post-create handoff behavior

Unchanged contract (`PatientHubPage` + `created-patient-preview-handoff.ts`):

1. `onCreated` → store `createdHandoffPatientId` + invalidate lookup  
2. Explicit Close → `openCreatedPatientPreview(id)`  
3. List hit or `GET /patients/{id}/summary`  
4. Preserves q / census / filters / sort / page / branch  

API control create `b79704a8-…` / `MRN-2026-10-A3511`: summary **200**, lookup by MRN **total=1**.

---

## 8. Registration Card behavior

Rendered from `savedPatient` (create response + form demographics). Not Directory lookup. Print + Close available whenever `savedPatient` is set.

---

## 9. Search behavior (NO CODE CHANGE)

| q | totalCount (Downtown) | Notes |
|---|---|---|
| Sam Badikolu | **0** | Full-name substring; does not match `Samuel Badikolu` |
| Badikolu | 2 | Samuel + Sandeep |
| Sam | 14 | Sam/Samuel* |

**TOKENIZED / PREFIX-AWARE NAME SEARCH** is the next bounded slice — **not implemented** (awaits product approval). Proposal:

- Tokenize `q` on whitespace  
- Match when **every** token appears in `(firstName + " " + lastName)` **or** first/last individually (prefix/contains per approved rule)  
- Preserve tenant, branch, deleted, census, permissions, pagination, sort, MRN/phone/email paths  
- No new search service; extend `PatientLookupService.ApplySearchFilter` only  

---

## 10. Exact files changed

| File | Change |
|---|---|
| `apps/hospital-portal-web/src/lib/patients/create-patient-response.ts` | **New** — parse create body + format create errors |
| `apps/hospital-portal-web/src/lib/patients/create-patient-response.test.ts` | **New** — parser/error unit tests |
| `apps/hospital-portal-web/src/components/patients/AddPatientWizard.tsx` | Success on `savedPatient`; toast errors; parse helper |
| `apps/hospital-portal-web/src/components/patients/AddPatientDialog.tsx` | Soft/hard/registration visibility from hosted flags |
| `apps/hospital-portal-web/src/components/patients/AddPatientWizard.dup-c3.test.tsx` | Contract asserts |
| `apps/hospital-portal-web/src/components/patients/AddPatientDialog.test.tsx` | Visibility desync regression |
| `docs/decisions/patient-directory-registration-reliability-and-search-report.md` | This report |

**Unchanged:** matcher, thresholds, APIs, census, branch, Preview component, Patient 360, lookup semantics.

---

## 11. Automated test results

```
npx vitest run \
  src/lib/patients/create-patient-response.test.ts \
  src/components/patients/AddPatientDialog.test.tsx \
  src/components/patients/AddPatientWizard.dup-c3.test.tsx \
  src/lib/patients/created-patient-preview-handoff.test.ts \
  src/lib/patients/canonical-add-patient.test.ts \
  src/lib/patients/registration-duplicate-check.test.ts
```

**Result: 6 files / 47 tests passed.**

Covered: create parse, status error mapping, success gate, toast failures, soft/hard visibility, handoff helpers, soft-review helper, dialog wiring.

---

## 12. Manual UAT evidence (API-controlled this session)

| Scenario | Result |
|---|---|
| Soft pre-check Sam/Badikolu/1987-08-01/8919653433 | **200**, isDuplicate=true, **3 PhoneMatch** |
| Unique patient check | **200**, isDuplicate=false |
| Unique `POST /patients` | **201** `id=b79704a8-…` `MRN-2026-10-A3511` |
| Summary by id | **200** same id/MRN |
| Lookup by MRN | **200** totalCount=1 |
| Hard recreate Samuel Badikolu | **400** Duplicate patient detected |
| Search regression | Sam Badikolu=0; Badikolu=2; Sam=14 |

**Browser soft Continue → success card → Preview** still required as operator manual UAT (Next.js may need refresh to pick FE fix). Do **not** treat API create as UI success-card proof.

Recommended browser script:

1. Hard refresh Directory  
2. Add Patient → fill Sam / Badikolu / 01-08-1987 / 8919653433 → Confirm  
3. Expect Possible Duplicate Patient (3 PhoneMatch) — **stop and verify before Continue**  
4. Continue → expect success + MRN + Registration Card  
5. Close → Preview exact created id  
6. Separate unique-phone patient for clean success path  
7. Force create error (e.g. offline) → toast, dialog stays  

---

## 13. Remaining product decisions

1. **Authorize TOKENIZED/PREFIX-AWARE Directory `q` name search?** (Sam Badikolu → Samuel Badikolu)  
2. **MPI nickname / surname rules?** Still PRODUCT DECISION REQUIRED — not in certified matcher; do not add here.  
3. Missing MRN on 201: warn + show success vs hard-fail create UX — currently warn + success with “Unavailable”.

---

## Explicit non-changes

- No new MatchType / thresholds / phone normalization / fuzzy / surname / DOB rules  
- No Create Anyway / merge  
- No new API / DB / Preview / Patient 360  
- No census / branch broadening / filter clearing  
- No lookup semantic change in this slice  

---

## Soft Duplicate Browser Regression — Empty Personal Information Reset

**Date:** 2026-10-05 (follow-up)  
**Browser UAT symptom:** Confirm & Create with Sam / Badikolu / 01-08-1987 / 8919653433 returned to empty Personal Information instead of Possible Duplicate Patient.

### 1. Exact root cause

Soft-duplicate transition hid the registration **shell** by flipping Dialog visibility/`modal`. Radix then emitted `onOpenChange(false)` on the registration Dialog. That dismiss was propagated to the parent session (`addPatientOpen=false`), which **unmounted** `AddPatientWizard` (`{open ? <Wizard/> : null}`). Remount on the next open (or same-session flicker) reinitialized `currentStepId='PERSONAL'` and empty `formData`. Soft dialog never remained as the terminal state.

The live duplicate API was already correct (200 / 3× PhoneMatch). Matcher/backend were not at fault.

### 2. Exact state transition that caused reset

```
Confirm & Create
  → check-duplicates 200 PhoneMatch×3
  → softUi.open=true + phase=duplicate-review
  → registration shell open/modal → false
  → Radix onOpenChange(false) on registration Dialog
  → parent session open=false   ← DEFECT
  → AddPatientWizard unmount
  → form/step lost
  → remount → empty PERSONAL
```

### 3. Why previous 47 tests did not catch it

Prior suites were mostly **source-contract** asserts (strings / static markup). They did not simulate Radix shell dismiss during soft open, nor assert forceMount keep-alive vs session close. Blank-success and visibility-desync fixes were covered; **session dismiss → remount** was not.

### 4. Files changed (this regression)

| File | Change |
|---|---|
| `registration-dialog-lifecycle.ts` | **New** — shell open / dismiss-ignore helpers |
| `registration-dialog-lifecycle.test.ts` | **New** — soft dismiss ignore regression |
| `AddPatientDialog.tsx` | Shell `open={shellOpen}` + Content `forceMount`; ignore Radix dismiss while soft/hard/phase active; wizard still mounted on session `open` |
| `AddPatientDialog.test.tsx` | forceMount / dismiss-ignore asserts |
| `AddPatientWizard.dup-c3.test.tsx` | Soft path before create + lifecycle asserts |
| `AddPatientWizard.review-confirm.test.tsx` | Updated lifecycle contract |
| `canonical-add-patient.test.ts` | Updated dialog lifecycle contract |
| This report | Section added |

### 5. Lifecycle fix

- Registration **shell** may close for soft/hard; **session** `open` from PatientHubPage stays true.
- `DialogContent forceMount` keeps the wizard DOM subtree available while shell is hidden.
- Wizard mount keys off session `{open ? <AddPatientWizard/> : null}` — not shell open.
- `shouldIgnoreRegistrationShellDismiss` blocks propagating Radix `onOpenChange(false)` during duplicate review.
- Escape / pointer / interact / focus outside on the shell are prevented while duplicate review is active.
- Soft path still returns before `POST /patients`; Continue alone creates.

### 6. Regression tests

- Soft dismiss ignore when `softOpen` / phase duplicate-review
- Soft branch returns before `createPatientFromWizard`
- forceMount + session mount (not shell mount)
- Prior success/failure/create-parse suites retained

### 7. Test result

```
8 files / 57 tests passed
```

(includes lifecycle helper + updated dialog/wizard/canonical suites)

### 8. Manual UAT steps (required — do not claim browser-fixed from unit tests alone)

1. Hard refresh Directory  
2. Add Patient → Sam / Badikolu / 01-08-1987 / 8919653433 → all steps → Review  
3. Confirm & Create → **Possible Duplicate Patient** (3 PhoneMatch); **not** empty PERSONAL; values preserved; no create yet  
4. Continue → success + MRN + Registration Card  
5. Close → Preview by created id; filters preserved  
6. Unique phone control → no soft dialog → success  
7. Failure control → toast; wizard stays; no PERSONAL reset  

### 9. Matcher / backend / search unchanged

Confirmed: no changes to duplicate matcher, thresholds, phone normalization, check-duplicates API, lookup, permissions, census, branch, or search semantics. Tokenized search remains a separate product decision.

### 10. Remaining product decision

TOKENIZED/PREFIX-AWARE Directory name search (`Sam Badikolu` → `Samuel Badikolu`) — **not started**.

---

---

## Confirm & Create Browser Regression — Session Reset

Manual browser UAT **reproduced** empty Personal Information after Confirm & Create **after** the forceMount/shell-open fix. That fix is **not accepted**.

### 1. Actual browser symptom

Review & Confirm showed Sam / Badikolu / 01-08-1987 / 8919653433. Clicking **Confirm & Create Patient** immediately returned to **Register New Patient → Personal Information** with empty/default fields. No Possible Duplicate Patient, no success, no error toast, no Registration Card, no create.

### 2. Was the duplicate API called?

**Forensic conclusion (source + prior live API evidence): OUTCOME C / session teardown after soft path.**

- Live backend for this payload: `POST /api/patients/registration/check-duplicates` → **HTTP 200**, `isDuplicate=true`, **3× PhoneMatch**.
- Wizard Confirm path **does** call `checkDuplicatesForRegistration` before create and returns on soft review (no `POST /patients` in that branch).
- Browser reset to empty PERSONAL is explained by **wizard unmount/remount**, not by matcher failure or skipped pre-check.
- Automated behavioral tests prove: soft host state keeps session/root/wizard mounted; closing session on soft open causes `unmount → mount` and empty form (defect proof).

If Network tab shows **no** check-duplicates call in a future UAT, treat as OUTCOME A (submit path) and re-trace the Confirm button — current code uses `type="button"` + `preventDefault`/`stopPropagation` and a single `handleSubmit`.

### 3. Exact request/response (known UAT payload)

| Item | Value |
|---|---|
| Method/path | `POST /api/patients/registration/check-duplicates` |
| Identity | Sam / Badikolu / 1987-08-01 / 8919653433 |
| Status | 200 |
| Body | `isDuplicate=true`, 3 PhoneMatch candidates |
| Create | Must **not** run until Continue |

### 4. Exact event/state sequence (defect)

```
Confirm & Create
  → validateForCreate
  → check-duplicates 200 PhoneMatch×3
  → softUi.open=true + phase=duplicate-review
  → shell visibility false (hide registration chrome)
  → Dialog Root was bound to shell open (prior fix) OR session closed via dismiss
  → DialogPortal teardown / parent addPatientOpen=false
  → AddPatientWizard unmount
  → remount → empty PERSONAL
```

`forceMount` on `DialogContent` cannot save the wizard if the parent session unmounts `AddPatientDialog` / `AddPatientWizard` or if Root `open={shellVisible}` tears down the Portal.

### 5. Exact close/reset/remount path

| Actor | Mutation | Effect |
|---|---|---|
| Soft transition | shell hide | OK if session stays open |
| **Defect** | Root `open` tied to shell / `onOpenChange(false)` → `setAddPatientOpen(false)` | Session ends |
| PatientHubPage | `addPatientOpen=false` | `{open ? Wizard : null}` false → unmount |
| Remount | new wizard instance | `currentStepId=PERSONAL`, empty `formData` |

### 6. Root cause

**Session vs shell conflation.** Soft duplicate may hide the registration **shell**, but must never close the registration **session**. Binding Radix Dialog Root to shell visibility (or propagating shell dismiss to `addPatientOpen`) unmounts the wizard. forceMount alone is insufficient.

### 7. Files changed (this regression)

| File | Change |
|---|---|
| `registration-dialog-lifecycle.ts` | Session Root helpers, dismiss apply, soft host state, mount gate |
| `registration-dialog-lifecycle.test.ts` | Helper contracts |
| `registration-confirm-lifecycle.behavior.test.ts` | **New** — mount lifetime, soft stop-before-create, dismiss ignore |
| `AddPatientDialog.tsx` | `open={sessionRootOpen}` (session), `modal`/chrome from shell; dismiss via `applyRegistrationShellDismissAttempt`; mount via `shouldMountRegistrationWizard` |
| `DuplicatePatientSoftMatchDialog.tsx` | Block outside/interact dismiss on nested soft dialog |
| `AddPatientWizard.tsx` | Confirm `preventDefault`/`stopPropagation` on click + submit |
| Dialog / dup-c3 / review-confirm / canonical tests | Assert session Root — **not** forceMount-as-fix |
| This report | Section added |

### 8. Final lifecycle architecture

```
PatientHubPage.addPatientOpen     ← sole session owner
  └─ AddPatientDialog open={sessionRootOpen}
       ├─ Dialog Root always session-open for the transaction
       ├─ shellVisible hides chrome only (modal/aria/CSS)
       ├─ AddPatientWizard mounted while session open
       └─ Soft/Hard sibling dialogs overlay; never close session
```

- Soft/hard/phase/shell must **not** call parent close.
- Explicit Close / success Close / user cancel terminate session.
- Continue alone → `POST /patients` → success → Registration Card → Close → Preview by `patient.id`.

### 9. Behavioral regression tests

- Soft transition: mounts=1, unmounts=0, firstName preserved, soft UI visible
- Defect proof: session close on soft → unmount→remount + empty name
- Shell dismiss during soft → session stays open
- Soft PhoneMatch×3 → soft review; create not called
- Confirm path invokes check-duplicates exactly once
- Continue creates once
- Explicit session close unmounts wizard

### 10. Test results

```
8 files / 63 tests passed
```

Suites: `registration-dialog-lifecycle`, `registration-confirm-lifecycle.behavior`, `AddPatientDialog`, `AddPatientWizard.dup-c3`, `AddPatientWizard.review-confirm`, `canonical-add-patient`, `registration-duplicate-check`, `create-patient-response`.

Playwright: `e2e/patient-hub.spec.ts` exists with auth helpers (`e2e/.auth/user.json` / `apiLogin`). No dedicated Confirm & Create → soft-duplicate browser spec was added in this slice (auth/seed environment not exercised here). **Manual UAT remains mandatory.**

### 11. Browser UAT status

**REQUIRED — not claimed fixed from unit tests.**

UAT-1…UAT-5 unchanged: Confirm → Possible Duplicate; Continue → create/success; Close → Preview; unique → create; failure → toast + values preserved.

### 12. Matcher / backend / search untouched

No changes to duplicate matcher, thresholds, phone normalization, check-duplicates API, PatientLookupService, Directory search, census, branch/tenant auth, permissions, Patient 360, Preview API, wizard visuals, or Registration Card design.

### 13. Remaining tokenized-search product decision

TOKENIZED/PREFIX-AWARE Directory name search (`Sam Badikolu` → `Samuel Badikolu`) — **not started**.

---

---

## Confirm & Create Runtime Regression — Final Forensic Investigation

Manual UAT still failed after the session-root fix. Runtime instrumentation + Playwright proved the true transition.

### 1. Browser symptom

Confirm & Create → empty Personal Information; no Possible Duplicate Patient; no create; no toast.

### 2. Running-build verification

| Check | Result |
|---|---|
| Process | Next.js `start-server.js` PID 27392 on **:3000** |
| Workspace | `Hospital Portal` (this repo) |
| Served chunk | `_app-pages-browser_…PatientHubPage_tsx.js` contains `sessionRootOpen` / `resolveRegistrationSessionRootOpen` |
| Runtime marker | `data-runtime-marker=patient-registration-runtime-v2` observed in Playwright |

**Not class A (stale build).** Browser executed current code.

### 3–4. Network evidence (Playwright)

```
POST /api/patients/registration/check-duplicates → 200
isDuplicate=true
matches: PhoneMatch ×3
POST /api/patients → 0 before Continue
```

### 5. Exact sanitized event sequence (proven)

```
CONFIRM_SUBMIT_START (REVIEW)
DUPLICATE_CHECK_START
DUPLICATE_CHECK_RESPONSE { isDuplicate:true, matchCount:3, softReview:true }
SOFT_DUPLICATE_BRANCH { candidateCount:3 }
SOFT_UI_CHANGE { open:true }
PHASE_CHANGE { next:duplicate-review }
SOFT_UI_OPENED_RETURN
CONFIRM_SUBMIT_FINALLY { currentStepId:REVIEW }
WIZARD_UNMOUNT                    ← DEFECT
WIZARD_MOUNT { PERSONAL, empty }  ← DEFECT
SOFT_UI_CHANGE { open:false }     ← remount sync overwrote soft UI
DIALOG_STATE { sessionRootOpen:true, softOpen:true → then softOpen:false }
```

`sessionRootOpen` remained **true**. Parent session did **not** close.

### 6–8. Failure class + exact path

**Class E — WIZARD REMOUNT** (with secondary soft-UI clear)

| Writer | Role |
|---|---|
| `PatientHubPage.setAddPatientOpen` | Only toolbar open + dialog `onOpenChange` — **not** the closer in this failure |
| Soft branch | Correctly set soft UI + phase |
| `modal={shellVisible}` / `hideOverlay={!shellVisible}` | Structural Dialog Content change on soft open → **remounted** `AddPatientWizard` inside Content |
| Wizard sync `useEffect` on remount | Pushed `softUi.open=false`, clearing Possible Duplicate Patient |

Empty PERSONAL = fresh wizard instance (`useState` initial PERSONAL + empty form), not `form.reset()`.

### 9. Final fix

1. Keep `modal={sessionRootOpen}` stable for the whole session (do **not** flip with shell).
2. Keep `hideOverlay={false}`; hide shell with CSS/`aria-hidden` only.
3. Stable hosted soft/hard callbacks (`useCallback`) + ref-based dismiss state.
4. Skip initial soft sync after wizard mount so a remount cannot overwrite parent `softOpen=true`.
5. Wizard soft/hard sync effects must not depend on callback identity (refs).

### 10. Files changed

| File | Change |
|---|---|
| `registration-lifecycle-telemetry.ts` | Sanitized event buffer + runtime marker |
| `AddPatientDialog.tsx` | Stable modal/overlay; refs; telemetry; marker |
| `AddPatientWizard.tsx` | Telemetry; skipInitialSoftSyncRef; sync via refs |
| `PatientHubPage.tsx` | Telemetry on session open/close |
| `e2e/add-patient-confirm-soft-duplicate.forensic.spec.ts` | Browser regression |
| Unit/canonical tests | Assert `modal={sessionRootOpen}`, no `modal={shellVisible}` |
| This report | Section added |

### 11–12. Automated tests

- Vitest registration suites (updated contracts).
- **Playwright forensic: PASSED** — soft dialog visible; no PERSONAL reset; no create before Continue; Continue → create once → success.

### 13. Manual UAT status

**Still required** as acceptance gate (hard refresh UAT-1…UAT-5).

### 14. Matcher / backend / search

Unchanged. Tokenized search not started.

---

**IMPLEMENTATION STATUS:** CONFIRM & CREATE RUNTIME REMOUNT FIX COMPLETE — PLAYWRIGHT FORENSIC PASSED — MANUAL UAT REQUIRED / SEARCH SLICE PENDING  

**NEXT GATE:** MANUAL UAT (UAT-1…UAT-5)  

**STOP**

---

## Soft Duplicate Evidence + Continue Flow

**Date:** 2026-10-05  
**Scope:** Frontend evidence mapping, soft/hard dialog rendering, selected-candidate handoff, Review red highlights, soft Continue acknowledgement.  
**Out of scope:** Matcher, thresholds, MatchType, phone normalization, duplicate/create APIs, search, Patient 360, remount lifecycle (already fixed).

### 1. matchedAttributes mapping

Canonical helpers in `registration-duplicate-check.ts`:

| Server signals | Display |
|---|---|
| FirstName + LastName | Name |
| FirstName only / LastName only | First name / Last name |
| DateOfBirth | Date of birth |
| Phone | Phone number |
| Email | Email |

- Soft cards: `buildMatchedEvidenceRows(matchedAttributes)` — **all** known server signals.
- Hard badges: `resolveMatchedEvidenceLabels(matchedAttributes, matchType)` — attributes preferred; MatchType labels only when attributes absent (legacy).
- Parsers (`parseRegistrationDuplicateCheckResult`, `parseDuplicateHardBlockError`) preserve `matchedAttributes` / `differentAttributes` (no strip).

### 2. Evidence rendering bug (Bug A)

**Root cause (frontend representation):** Hard matched-info used **MatchType-only** presentation (`PhoneMatch` → Phone number alone), dropping co-reported attributes such as `DateOfBirth`. Soft Match review now always renders server `matchedAttributes` rows (not MatchType-only).

**Fix:** Attribute-first mapping; DateOfBirth + Phone both render for PhoneMatch candidates that report both.

Does **not** change matcher rules. A PhoneMatch candidate may correctly show Name/DOB evidence when the server lists those in `matchedAttributes`.

### 3. Selected-candidate state

- Soft/hard lists use radio selection (`selectedId`, default first candidate).
- “Review matching information” disabled without selection; invokes `openDuplicateReviewForCandidate(selected)`.
- Context stores `candidateId`, identity labels, and **server** `matchedAttributes` / `differentAttributes` copies.

### 4. Review & Confirm highlighting (Bug B)

- `duplicateReviewContext` → `duplicateEvidenceForField` → `ReviewPair` red treatment (`border-red-400 bg-red-50`, `data-duplicate-evidence="matched"`).
- Field-only red highlight (C3 approved); no Match badge copy.
- Only signals present in server `matchedAttributes` highlight; no client value comparison.
- Return path does **not** re-run duplicate check, clear form, or create.

### 5. Soft acknowledgement flow

- In-memory `softMatchAcknowledgedKey` = `registrationIdentityFingerprint` for current first/last/DOB/phone/email.
- Identity edit clears acknowledgement + `duplicateReviewContext`.
- Soft gate: if fingerprint not acknowledged → `check-duplicates` → soft UI → **stop before** `POST /patients`.
- Continue sets acknowledgement then creates once.
- No permanent override; no “Create Anyway”.

### 6. Continue registration behavior (Bug C / footer decision)

**Product decision = OPTION A (existing DUP-C.3):**

Soft Possible Duplicate Patient footer:

1. **Back to Registration** — close soft UI; form + session preserved; no create  
2. **Review matching information** — optional; Review & Confirm with selected evidence  
3. **Continue Registration** — acknowledge soft matches → `POST /api/patients` → server authoritative  

Hard Possible Duplicate Patient footer (unchanged):

1. **Back to Registration**  
2. **Review matching information**  
3. **No Continue** — hard block remains blocking until identity changes or operator abandons  

If UAT saw only Back + Review, that surface is the **hard** dialog (or ExactNameDOB soft-skip → create → hard), not soft Continue omission.

### 7. Hard duplicate boundary (section 9)

| Condition | FE behavior |
|---|---|
| Pre-check includes `ExactNameDOB` | Soft review **skipped** (`shouldShowSoftDuplicateReview` false) → create attempted → server hard-block if ≥0.95 |
| Soft PhoneMatch / Email / Fuzzy only | Soft dialog; Continue allowed; create may still hard-block |
| Create 400 hard-block | Hard dialog; no success / Preview / silent close |
| Soft Continue | Does **not** bypass hard create validation |

Screenshot with Name + Date of birth matched does **not** force Soft treatment. Authority is server `MatchType` / confidence. If MatchType is PhoneMatch with Name/DOB in `matchedAttributes`, UI shows those attributes under PhoneMatch. If MatchType is ExactNameDOB, candidate must not be soft-gated.

### 8. Exact footer / product decision

Adopted **OPTION A**: soft dialog exposes Continue directly; Review matching is optional inspection with red highlights; Confirm & Create after Review re-runs create-scoped pre-check unless soft fingerprint already acknowledged via Continue.

### 9. Tests

| Suite | Coverage |
|---|---|
| `registration-duplicate-check.test.ts` | Attribute aggregation; soft gate; fingerprint invalidation |
| `duplicate-hard-block.test.ts` | Attribute preservation on hard candidates |
| `DuplicatePatientSoftMatchDialog.test.tsx` | DOB+Phone / phone-only / Name+DOB; Continue present |
| `DuplicatePatientHardBlockDialog.test.tsx` | Attribute badges; **no** Continue |
| `registration-duplicate-review-context.test.ts` | Field highlight mapping |
| `AddPatientWizard.dup-c3.test.tsx` | Soft stop before create; Continue ack; Review attribute handoff |
| `registration-confirm-lifecycle.behavior.test.ts` | Lifecycle soft → Continue once |
| Playwright forensic | Remount regression retained |

### 10. Browser UAT (acceptance gate)

| ID | Steps | Expect |
|---|---|---|
| UAT-1 | Sam / Badikolu / 01-08-1987 / 8919653433 | Soft Possible Duplicate; every candidate shows **all** server matched fields (Samuel Aluri DOB Aug 1 1987 → Date of birth **and** Phone number) |
| UAT-2 | Select candidate → Review matching information | Review & Confirm; selected matched fields red |
| UAT-3 | Continue Registration | `POST /patients` → 201 → MRN → Registration Card |
| UAT-4 | Back to Registration | Values preserved; no create |
| UAT-5 | Edit identity after soft | Ack invalid; duplicate check required again |
| UAT-6 | Hard duplicate identity | Hard dialog; cannot create |

### Files touched (this slice)

| File | Change |
|---|---|
| `registration-duplicate-check.ts` | `buildMatchedEvidenceRows` / `resolveMatchedEvidenceLabels` |
| `duplicate-hard-block.ts` | Preserve attribute signals on hard candidates |
| `DuplicatePatientSoftMatchDialog.tsx` | Attribute-first Match review + Continue footer |
| `DuplicatePatientHardBlockDialog.tsx` | Attribute-first Matched information |
| `AddPatientWizard.tsx` | Review context handoff + soft ack (unchanged contract) |
| Focused `*.test.ts(x)` | Behavioral coverage A–K |
| This report | Section added |

Matcher / search / remount lifecycle: **unchanged**.

---

**IMPLEMENTATION STATUS:** SOFT DUPLICATE EVIDENCE + CONTINUE FLOW COMPLETE — AUTOMATED TESTS PASSED — MANUAL UAT REQUIRED  

**NEXT GATE:** MANUAL UAT (UAT-1…UAT-6)  

**STOP**

---

## Soft Duplicate UAT Correction (runtime forensic)

**Date:** 2026-10-05  
**Scope:** Runtime evidence path + soft footer (remove Back) + ExactNameDOB hard precheck using registration-check attributes.  
**Out of scope:** Matcher, thresholds, MatchType, phone normalization, create DTO contract, search, remount architecture.

### 1. Runtime forensic — Samuel Aluri Aug 1 (MRN-2026-10-49562)

#### Live `POST /api/patients/registration/check-duplicates` (Sam / Badikolu / 1987-08-01 / 8919653433)

| Candidate | MatchType | matchedAttributes |
|---|---|---|
| Sam Badikolu · MRN-2026-10-A89F6 | **ExactNameDOB** | FirstName, LastName, DateOfBirth, Phone |
| sadfas… · MRN-2026-10-D5F70 | PhoneMatch | Phone |
| **Samuel Aluri · MRN-2026-10-49562** | PhoneMatch | **DateOfBirth, Phone** |
| Samuel Aluri · MRN-2026-10-8B782 | PhoneMatch | Phone |

**CASE A for soft registration-check payload:** API returns DateOfBirth + Phone for Samuel. Frontend parser + `toSoftMatchCandidates` preserve both.

#### Why UAT showed Phone-only + no Continue

1. ExactNameDOB Sam Badikolu (**MRN-2026-10-A89F6**) now exists (prior Continue create).
2. FE `shouldShowSoftDuplicateReview` correctly **skipped soft** (ExactNameDOB present).
3. Prior path: proceed to `POST /patients` → **400 hard-block**.
4. Create hard-block DTO (`PatientDuplicateMatch`) has **no `matchedAttributes`** — only MatchType / confidence / differenceReason.
5. Hard UI MatchType fallback for PhoneMatch → **Phone number only** (CASE B for create payload).
6. Hard footer = Back + Review, **no Continue** — matches the UAT screenshot labels (“Matched information”).

**Root cause:** Not soft attribute-drop for Samuel. Operator was on **hard** dialog after ExactNameDOB soft-skip; create response lacked attributes so PhoneMatch peers collapsed to Phone-only.

### 2. Fixes applied

| Fix | Detail |
|---|---|
| ExactNameDOB hard **precheck** | When registration-check includes ExactNameDOB, open hard dialog from **check-duplicates matches** (attribute-rich) and **do not POST**. Samuel shows Date of birth + Phone. No Continue. |
| Soft footer | **Remove** “Back to Registration”. Footer = **Review matching information** + **Continue Registration**. X/close returns to active registration session (no remount / no create). |
| Soft evidence | Unchanged attribute-first `buildMatchedEvidenceRows` (CASE A when soft opens). |

### 3. Soft footer after change

```
[ Review matching information ]  [ Continue Registration ]
```

Dismiss: dialog X → `closeSoftMatchDialog` → phase=registration; form preserved; session Root stays open.

Hard footer unchanged: Back to Registration · Review matching information · **no Continue**.

### 4. Soft vs hard for current Sam/Badikolu identity

| Gate | Behavior |
|---|---|
| Soft (PhoneMatch-only identities) | Soft dialog; Review + Continue; attributes from check |
| ExactNameDOB present (current Sam Badikolu) | Hard dialog from precheck; attributes from check; **no Continue**; no create |

### 5. Automated tests

**11 files / 98 tests passed** (focused registration + duplicate suites).

Includes: Samuel DateOfBirth+Phone preservation; soft footer no Back; Continue present; hard no Continue; ExactNameDOB precheck wiring; lifecycle remount contracts.

### 6. Boundaries preserved

Matcher · thresholds · MatchType · phone normalization · create DTO · search · session-root remount fix: **unchanged**.

### 7. Manual UAT (acceptance)

| ID | Expect |
|---|---|
| UAT-1 (current Sam/Badikolu) | **Hard** Possible Duplicate (ExactNameDOB). Samuel Aug 1 shows **Date of birth + Phone number**. No Continue. |
| UAT-1b (soft path) | Use a **non-ExactNameDOB** phone-collision identity. Soft dialog: Samuel-like attrs render fully; footer = Review + Continue only. |
| UAT-2 | Soft → Review matching information → red highlights from server matchedAttributes only. |
| UAT-3 | Soft Continue → one POST /patients → 201 → MRN → card → Preview handoff. |
| UAT-4 | Soft X/close → session active; values preserved; no create; no Personal reset. |
| UAT-5 | Identity edit invalidates soft ack. |
| UAT-6 | ExactNameDOB / hard → no Continue; no success; no Preview. |

---

**IMPLEMENTATION STATUS:** SOFT DUPLICATE UAT CORRECTION COMPLETE — AUTOMATED TESTS PASSED — MANUAL UAT REQUIRED  

**NEXT GATE:** MANUAL UAT  

**STOP**

---

## Hard Duplicate Review Loop + Creation Blocking

**Date:** 2026-10-05  
**Scope:** Frontend hard-duplicate Review state machine only. Soft Continue / matcher / APIs unchanged.

### 1. Exact root cause

After hard ExactNameDOB → **Review matching information**:

1. `openDuplicateReviewForCandidate` stored only `matchedAttributes` / `differentAttributes` / identity labels.
2. **`matchType` and hard/soft severity were discarded.**
3. Review correctly painted red fields from attributes (working).
4. **Confirm & Create** ignored that visit — it only skipped create when `softMatchAcknowledgedKey` matched (soft Continue path).
5. Hard never sets soft acknowledgement → Confirm re-ran `check-duplicates` → ExactNameDOB again → hard dialog again → **Review → Confirm → hard loop**.

State lost/ignored: **hard create-block severity** on return to Review.

### 2. Fix

| Piece | Behavior |
|---|---|
| `DuplicateReviewContext.severity` | `'hard' \| 'soft'` from dialog **source** (hard dialog → hard; soft → soft). ExactNameDOB MatchType also maps hard. **Not** from attribute counts. |
| `matchType` | Preserved on context for telemetry/display. |
| Confirm guard | `isHardDuplicateReviewBlocking` → no check, no POST, toast; no hard re-open. |
| CTA | Hard Review → disabled **Creation blocked** (`data-create-blocked="hard-duplicate"`). |
| Banner | `review-hard-duplicate-blocked` — creation blocked; edit identity to retry. |
| Identity edit | Existing effect clears `duplicateReviewContext` + soft ack. |

### 3. Final state machine

```
Confirm & Create
  → check-duplicates
       ├─ soft only → Soft dialog (Review | Continue)
       │                 Continue → ack → POST once
       │                 Review → Review(severity=soft) → Confirm rechecks
       ├─ ExactNameDOB → Hard dialog (no Continue)
       │                 Review → Review(severity=hard)
       │                   CTA disabled / Confirm rejected
       │                   edit identity → clear context → recheck
       └─ none → POST /patients
```

### 4. Files changed

| File | Change |
|---|---|
| `registration-duplicate-review-context.ts` | severity, matchType, `resolveDuplicateReviewSeverity`, `isHardDuplicateReviewBlocking` |
| `AddPatientWizard.tsx` | hard Review banner; blocked CTA; Confirm guard; soft/hard review source |
| Focused tests | severity + hard create-block contracts |
| This report | Section added |

### 5. Automated tests

**12 files / 107 passed** (registration + duplicate + preview handoff suites).

### 6. Boundaries preserved

Matcher · MatchType rules · thresholds · phone normalization · duplicate/create APIs · search · remount lifecycle · soft Continue: **unchanged**. No client field-count hard rule. No Open Patient / merge invented.

### 7. Manual UAT

| ID | Expect |
|---|---|
| UAT-1 | Sam/Badikolu → ExactNameDOB hard; Name+DOB+Phone evidence; no Continue; no POST |
| UAT-2 | Review matching → red First/Last/DOB/Mobile; **Creation blocked**; Confirm does not create / does not re-open loop |
| UAT-3 | Edit identity → hard context cleared; recheck required |
| UAT-4 | Unique identity → create 201 → MRN → card → Preview |
| UAT-5 | Soft phone collision → Review \| Continue; Continue once |
| UAT-6 | Soft Review → server matched fields red; Continue via soft ack |
| UAT-7 | Soft X → session preserved; no create; no remount |

---

**IMPLEMENTATION STATUS:** HARD DUPLICATE REVIEW LOOP FIX COMPLETE — AUTOMATED TESTS PASSED — MANUAL UAT REQUIRED  

**NEXT GATE:** MANUAL UAT  

**STOP**

---

## Post-Registration Success / Card / Print Isolation

**Date:** 2026-10-05  
**Scope:** Frontend post-create UX + Registration Card print isolation only.

### 1. Root cause — success inside Register New Patient

`AddPatientWizard` kept `savedPatient` and rendered success **inside** the still-open `AddPatientDialog` (`DialogTitle` = Register New Patient + stepper chrome until success hid steps). Session `addPatientOpen` stayed true after 201.

### 2. Root cause — card inside registration shell

`showRegistrationCard` toggled a second in-wizard view that mounted `RegistrationCardPreview` under the same Register New Patient dialog.

### 3. Root cause — 31-page print

`RegistrationCardPreview.handlePrint` called **SPA `window.print()`** with `@media print { body * { visibility: hidden } }` + show `.registration-card-container`. That does **not** isolate print from Patient Directory / portals / dialog chrome; layout still paginated the app → multi-page preview.

### 4. Final ownership

```
PatientHubPage
 ├── AddPatientDialog          (registration only; closes on 201)
 ├── PatientRegistrationSuccessDialog
 └── PatientRegistrationCardSurfaceDialog
       └── RegistrationCardPreview → openRegistrationCardPrint (dedicated document)
```

State machine: 201 → `onRegistrationComplete(patient)` → close Add Patient → Success → Print opens Card → isolated print window → Card Close → Success → Success Close → existing Preview handoff by `patient.id`.

### 5. Print isolation

`registration-card-print.ts` (OT-slip pattern): clone card `outerHTML` into `window.open` document; `@page 3.5in 2in`; print + close. **No** SPA `window.print()`. **No** `body *` visibility hacks.

### 6. Files changed

| File | Change |
|---|---|
| `registration-card-print.ts` | Isolated print document helper |
| `RegistrationCardPreview.tsx` | Uses helper; removed SPA print CSS |
| `PatientRegistrationSuccessDialog.tsx` | Dedicated success |
| `PatientRegistrationCardSurfaceDialog.tsx` | Dedicated card |
| `AddPatientWizard.tsx` | Dialog: lift complete; no in-dialog success |
| `AddPatientDialog.tsx` | `onRegistrationComplete` → close session |
| `PatientHubPage.tsx` | Owns success/card; Preview on Success Close |
| Tests + this report | Ownership + print contracts |

### 7. Automated tests

**14 files / 110 passed** (post-registration + duplicate + create + handoff suites). Native browser print preview remains **manual UAT**.

### 8. Boundaries preserved

Create API · MRN · duplicate matcher/lifecycle · search · permissions · Preview API · card visual design: **unchanged**.

### 9. Manual UAT

| ID | Expect |
|---|---|
| UAT-1 | Unique create → dedicated success; **no** Register New Patient shell/stepper |
| UAT-2 | Success Close → Directory Preview by id; filters preserved |
| UAT-3 | Print Registration Card → dedicated card dialog; no wizard shell |
| UAT-4 | Print → preview shows **only** card (1 page); not Directory / not 31 pages |
| UAT-5 | Cancel print → card remains |
| UAT-6 | Card Close → Success |
| UAT-7 | Hard/soft duplicate regression green |
| UAT-8 | Success Close → Preview handoff by `patient.id` |

---

**IMPLEMENTATION STATUS:** POST-REGISTRATION SUCCESS / CARD / PRINT ISOLATION COMPLETE — AUTOMATED TESTS PASSED — MANUAL UAT REQUIRED  

**NEXT GATE:** MANUAL UAT  

**STOP**

---

## Registration Card Print Fidelity (single-page self-contained CSS)

**Date:** 2026-10-05  
**Scope:** Dedicated print document representation only. SPA isolation architecture retained.

### 1. Root cause of two-page / split print

1. **CSS unavailable in `about:blank` (primary):** Print cloned on-screen `outerHTML` that used Tailwind classes (`grid`, `grid-cols-3`, `flex`, typography utilities). The print document did **not** include SPA/Tailwind CSS, so layout collapsed to vertical block flow (QR → header → name on next page).
2. **Page geometry (secondary):** `@page { size: 3.5in 2in; margin: 0.15in }` made the printable area smaller than the forced `3.5in × 2in` card → overflow onto page 2.

### 2–3. CSS + geometry confirmed

| Factor | Proven |
|---|---|
| Missing print CSS for grid/flex | Yes — about:blank had only thin `.print-card` rules |
| Page margin overflow | Yes — 0.15in margins on 3.5×2 page |
| SPA still printed | No — dedicated window already correct |

### 4. Final print architecture

```
RegistrationCardPreview (screen, Tailwind OK)
  → openRegistrationCardPrint({ patient, cardElement })
  → extract QR/barcode SVG from live card
  → buildRegistrationCardPrintDocumentHtml(patient, media)
       self-contained HTML + REGISTRATION_CARD_PRINT_DOCUMENT_STYLES
  → window.open → document.write → images ready → print → close
```

- `@page { size: 3.5in 2in; margin: 0 }`
- Card fills page exactly; `page-break-inside: avoid`
- Explicit CSS grid (`0.95in | 1fr`) matching on-screen composition
- No SPA `window.print()`, no `body *` visibility hacks

### 5. Files changed

| File | Change |
|---|---|
| `registration-card-print.ts` | Self-contained HTML/CSS builder; media extract; readiness before print |
| `RegistrationCardPreview.tsx` | Passes patient + card element (not outerHTML clone) |
| `registration-card-print.test.ts` | Fidelity + single-page contracts |
| This report | Section added |

### 6. Automated tests

**6 files / 50 passed** in focused run (print fidelity + ownership + duplicate soft/hard + handoff). Native browser print-preview pagination remains **manual UAT**.

### 7–8. Confirmations

- SPA / Directory **not** printed.
- Print HTML includes complete card: avatar, HOSPITAL PORTAL, title, name, MRN, blood, DOB, gender, contact, QR SVG, barcode SVG, footer.

### 9. Manual UAT

| ID | Expect |
|---|---|
| UAT-1 | Card surface matches approved on-screen card |
| UAT-2 | Print preview = **ONE page**, complete card composition |
| UAT-3 | Cancel → card stays open |
| UAT-4 | Print again → same one-page card |
| UAT-5 | Card Close → Success |
| UAT-6 | Success Close → Preview handoff |
| UAT-7 | Duplicate flows unchanged |

---

**IMPLEMENTATION STATUS:** REGISTRATION CARD PRINT FIDELITY COMPLETE — AUTOMATED TESTS PASSED — MANUAL UAT REQUIRED  

**NEXT GATE:** MANUAL UAT (one-page complete card)  

**STOP**

---

## Registration Card patient photo propagation (forensic + bounded fix)

### 1. Exact root cause

Directory rows already carry the authoritative photo as `photoThumbnailUrl` (mapped from API `photo_url` / lookup DTO).  
`registrationCardPatient(row)` previously **omitted** that field when building the Registration Card patient object, so `RegistrationCardPreview` always fell through to the generic avatar. Print then inherited the empty photo path.

### 2. Exact loss point

```
Patient Directory row.photoThumbnailUrl  (present — Sam Aluri UAT)
        ↓
registrationCardPatient(row)            ← photo dropped here (pre-fix)
        ↓
RegistrationCardPreview.patient.photoUrl  (undefined)
        ↓
generic avatar on card + in print HTML
```

Create/success path already passed `photoUrl` through `onRegistrationComplete` → Success → Card surface; Directory open-card was the broken boundary.

### 3. Layers affected

| Layer | Status |
|---|---|
| Card data (Directory → card DTO) | **Root cause** — fixed |
| Card rendering | Fixed via resolved `photoUrl` + existing fallback |
| Print data | Fixed — passes resolved absolute URL into print HTML |
| Print image loading | Extended readiness already waits for `<img>` load/error |

### 4. Authoritative photo source

- Patient record attribute: `photo_url` / FE lookup: `photoThumbnailUrl` → card: `photoUrl`
- Write permission remains `patient.edit`; no new photo API

### 5. Reused utilities

- `resolvePatientPhotoUrl` (`patient-display-utils`) — absolute/API-origin resolution for relative paths (required for `about:blank` print)
- Existing card `<img>` + generic fallback frame (same size/object-fit); no new photo component

### 6. Files changed

| File | Change |
|---|---|
| `PatientRegistrationCardDialog.tsx` | `photoUrl: row.photoThumbnailUrl` |
| `RegistrationCardPreview.tsx` | Resolve photo; `onError` → fallback; pass resolved URL to print |
| `registration-card-print.ts` | Resolve photo for print HTML; `<img class="rc-avatar">` or fallback |
| `registration-card-photo.test.ts` | New photo propagation contracts |
| `patient-directory-slice-e3.test.tsx` | Assert mapper + resolve wiring |
| This report | Section added |

### 7. Automated tests

**8 files / 66 passed** (photo + print fidelity + success/card + handoff + soft/hard duplicate).

### 8–10. Confirmations

- No new patient-photo API.
- Auth/tenant/branch/`patient.view`/`patient.edit` unchanged; photos not made public; no tokens in print HTML.
- One-page print geometry (`@page` 3.5×2, self-contained CSS, QR/barcode extract) unchanged — only avatar source when available.

### 11. Manual UAT

| ID | Steps / expect |
|---|---|
| UAT-1 | Sam Aluri Directory photo → Registration Card same photo → Print same photo; **one page** |
| UAT-2 | Directory / Card / Print = same photograph; no generic avatar; no distortion |
| UAT-3 | Patient without photo → generic avatar on card + print; no broken image |
| UAT-4 | New create with photo **only if** wizard already uploaded → card + print use that photo |
| UAT-5 | Print regression: one page, QR, barcode, footer, no Directory chrome |

---

**IMPLEMENTATION STATUS:** REGISTRATION CARD PHOTO PROPAGATION COMPLETE — AUTOMATED TESTS PASSED — MANUAL UAT REQUIRED  

**NEXT GATE:** MANUAL UAT (Directory photo = Card photo = Print photo)  

**STOP**

