# Patient Directory — DUP-C Soft-Match / Probable Duplicate Product Decision Audit

**Status:** AUDIT COMPLETE — IMPLEMENTATION NOT AUTHORIZED  
**Phase:** DUP-C  
**Recorded:** 2026-10-05  
**Scope:** Probable duplicate (0.80–0.94) workflow for canonical Add Patient  
**Prerequisite:** DUP-A / DUP-B / DUP-B.1 / DUP-B.2 hard-block UX certified and UAT-passed  

---

## 0. Hard constraints of this record

This document inspects and recommends only. It does **not** authorize:

- application code changes
- API / DTO / database / migration / permission / route changes
- duplicate threshold or matcher changes
- Merge restoration or Create Anyway / Override
- patient cleanup / DELETE / TRUNCATE / CASCADE
- Patient 360 or Directory redesign changes
- DUP-B.2 hard-block behavior changes

Related records:

| Document | Relevance |
|---|---|
| `docs/decisions/patient-duplicate-matching-audit.md` | Phase 3N.1 forensic baseline; PD-DUP-01 left 0.80–0.94 OPEN |
| `docs/audits/patient-directory-ux-data-contract-reconciliation.md` PD-DIR-UX-09 | Soft-warning UI blocked until product decision |
| DUP-A → DUP-B.2 | Hard-block (≥0.95) UX is APPROVED / EXISTING |

---

## 1. Current 0.80–0.94 behavior (CODE FACT)

### 1.1 Create path (canonical)

```
AddPatientWizard.handleSubmit
  → patientApi.create
  → POST /api/patients  [RequirePermission("patient.create")]
  → PatientDuplicateDetectionService.CheckDuplicatesAsync
  → if IsDuplicate AND any MatchConfidence >= 0.95 → HTTP 400 { error, message, duplicates }
  → else PatientService.CreatePatientAsync → 201 CreatedAtAction(PatientResponse)
```

**Wizard does not call** `POST /api/patients/check-duplicates` before create  
(asserted by `canonical-add-patient.test.ts`, `AddPatientDialog.test.tsx`).

Evidence:

- `PatientsController.CreatePatient` (`microservices/auth-service/AuthService/Controllers/PatientsController.cs`)
- `PatientDuplicateDetectionService.CheckDuplicatesAsync`
- `AddPatientWizard.tsx` submit + `parseDuplicateHardBlockError` catch path only

### 1.2 Case matrix (create)

| Case | MatchType | Confidence | Create outcome today | Frontend sees |
|---|---|---|---|---|
| A. Exact name + DOB | `ExactNameDOB` | 1.00 | **HTTP 400 hard block** | DUP-B.2 dialog via `duplicates[]` |
| B. Exact phone | `PhoneMatch` | 0.95 | **HTTP 400 hard block** | DUP-B.2 dialog via `duplicates[]` |
| C. Exact email | `EmailMatch` | 0.90 | **Create succeeds** (201) | Success / registration card only — **no soft UI** |
| D. Fuzzy name + DOB | `FuzzyNameDOB` | 0.80–0.94 | **Create succeeds** (201) | Success / registration card only — **no soft UI** |
| D′. Fuzzy name + DOB | `FuzzyNameDOB` | ≥ 0.95 | **HTTP 400 hard block** | DUP-B.2 dialog (same as hard-block band) |

**CODE FACT:** On successful create, `PatientResponse` does **not** include `IsDuplicate`, `Matches`, or soft-match candidates. Soft matches are discarded after the gate allows create.

### 1.3 check-duplicates path (not used by wizard)

```
POST /api/patients/check-duplicates  [RequirePermission("patient.view")]
  → DuplicateCheckResult { IsDuplicate, Message, Matches: PatientDuplicateMatch[] }
```

`IsDuplicate = Matches.Any(m => MatchConfidence >= 0.80)`.

Live consumer today: `PatientDuplicateHintBanner` on Patient 360 record (post-create / existing patient), not registration.

### 1.4 Update path

Same ≥0.95 hard-block gate on `PUT /api/patients/{id}` with `excludePatientId`. Soft band also silently allowed on update. Out of DUP-C registration scope unless product expands later.

---

## 2. Existing API / data contract (APPROVED / EXISTING)

### `PatientDuplicateMatch`

| Field | Present | Safe for soft UX? |
|---|---|---|
| `Id` | Yes | Yes (identity key; do not display raw GUID as primary label) |
| `MedicalRecordNumber` | Yes | Yes |
| `FirstName` / `LastName` | Yes | Yes |
| `DateOfBirth` | Yes | Yes |
| `Gender` | **Not on DTO** | N/A — hard-block UI already handles missing gender |
| `ContactNumber` / `Email` | Yes on DTO | **Do not display** (PHI; same as DUP-B.2) |
| `MatchType` | Yes | Yes — sole presentation source |
| `MatchConfidence` | Yes | **Do not display** numeric score |
| `DifferenceReason` | Yes | **Do not display** (may contain phone/email PHI) |

### `DuplicateCheckResult`

- `IsDuplicate`, `Message`, `Matches`
- Message may include “Highest confidence: XX%” — **do not surface raw confidence wording** in registration UX

### Hard-block create 400 body

- `{ error: "Duplicate patient detected", message, duplicates }`  
- Note key name `duplicates` (not `matches`)

### Frontend helpers (reusable)

- `parseDuplicateHardBlockError` — **hard-block 400 only**; does not detect soft-band success
- `resolveDuplicateMatchPresentation(matchType)` — certified MatchType → chips/explanation
- `registrationStepForMatchType` / `registrationStepForDuplicates`
- `DuplicatePatientHardBlockDialog` — ≥0.95 only; no Open Patient 360 (DUP-B.2)

---

## 3. Existing reusable UI / components

| Asset | Status | Soft-match reuse? |
|---|---|---|
| `DuplicatePatientHardBlockDialog` | Live, UAT-passed | **Pattern reuse** — new soft dialog variant; do not overload hard-block semantics |
| `resolveDuplicateMatchPresentation` | Live | **Reuse as-is** |
| `PatientDuplicateHintBanner` | Live on Patient 360 | Post-create only; shows confidence % and Merge — **do not copy** into registration |
| `DuplicatePatientWarningDialog` | **Orphan** (zero production imports); has `onProceedAnyway` | **Do not revive** — wrong product language and override path |
| Dialog / Button / Badge / PatientAvatar | Design system | Reuse |
| Sheet / Alert | Available | Prefer Dialog for parity with hard-block |

**Do not create a second matching framework.** Prefer a soft-match dialog that shares presentation helpers with hard-block.

---

## 4. Product options (not auto-selected)

### OPTION A — Informational warning

Show probable matches but allow registration without pause (e.g. banner on review step; create still one click).

| Dimension | Assessment |
|---|---|
| Identity integrity | Weak — easy to ignore |
| Usability | Highest |
| False-positive friction | Low |
| Duplicate risk | Highest among options |
| Consistency with hard-block | Poor (hard-block pauses; soft does not) |

### OPTION B — Review-before-create

Pause before POST create when soft matches exist; require explicit review; then allow continue create or back to form.

| Dimension | Assessment |
|---|---|
| Identity integrity | Stronger than A; weaker than C |
| Usability | Moderate friction |
| False-positive (email / fuzzy / family) | Manageable — continue allowed |
| Duplicate risk | Reduced vs silent allow |
| Consistency with hard-block | Good — same review surface language; different actions |

### OPTION C — Hard block 0.80–0.94

Treat soft band like ≥0.95 (block create).

| Dimension | Assessment |
|---|---|
| Identity integrity | Highest |
| Usability | Poor — email match and fuzzy spelling become hard stops |
| Family shared email | Severe FP |
| Twins / similar names | Severe FP |
| Threshold change | **Would change certified create policy** — requires separate explicit approval |

---

## 5. False-positive / false-negative analysis (matcher unchanged)

| Scenario | Likely outcome today | Soft UX implication |
|---|---|---|
| Family shared phone | Hard block 0.95 | Already blocked; soft UX N/A |
| Family shared email | Silent create 0.90 | Soft warn valuable; **must allow continue** (not hard block) |
| Twins / same DOB + similar names | Fuzzy soft or hard if ≥0.95 | Soft review appropriate; continue needed |
| Spelling variations + same DOB | Fuzzy 0.80–0.94 soft / ≥0.95 hard | Soft review catches mid band |
| Missing phone | Phone level skipped | Relies on name/DOB/email |
| Missing email | Email level skipped | Relies on name/DOB/phone |
| Unnormalized phone | Exact string only | FN risk remains (threshold unchanged) |
| Same name, different DOB | No Exact/Fuzzy | No match on name+DOB levels |
| Different name, same DOB | Fuzzy only if similarity ≥0.80 | Soft/hard depending on score |
| Health ID / MRN | Not match inputs | No change in DUP-C |

---

## 6. Recommended product decision (PROPOSED / REQUIRES PRODUCT APPROVAL)

### Recommended behavior

**OPTION B — Review-before-create for soft matches in 0.80–0.94.**

### Why

1. Status quo silently creates true probable duplicates (especially `EmailMatch` 0.90 and mid-band `FuzzyNameDOB`).
2. OPTION C would hard-block shared email and many legitimate fuzzy cases — conflicts with family/twin operational reality and changes the certified ≥0.95 gate meaning.
3. OPTION A does not force attention at the moment of creation.
4. OPTION B aligns with DUP-B.2 review language while preserving create after informed review.
5. Matches PD-DIR-UX-09 / PD-DUP-01 intent without changing thresholds.

### Exact user flow (proposed)

1. User completes wizard and clicks **Create Patient**.
2. Frontend calls existing `POST /patients/check-duplicates` with entered identity fields **before** `POST /patients` *(contract exists; permission note below)*.
3. If any match has `MatchConfidence >= 0.95` → do **not** invent client block; proceed to create (server remains authoritative hard-block). Alternatively skip pre-check for ≥0.95 and let server 400 + DUP-B.2 handle (simpler; recommended).
4. If `IsDuplicate` and **all** matches are `< 0.95` (i.e. soft band only, typically EmailMatch and/or FuzzyNameDOB 0.80–0.94) → open **soft-match dialog**; **do not** call create yet.
5. User chooses:
   - **Back to Registration** → close dialog; form state intact; no create.
   - **Continue registration** → close dialog; proceed with the **same** pending create payload (single create attempt).
6. If user returns and changes Name / DOB / Phone / Email, next Create re-runs check (no sticky acknowledgement across identity edits).
7. Server create gate unchanged: ≥0.95 still 400; soft band still allowed.

### Exact actions (proposed)

| Action | Soft dialog | Hard dialog (DUP-B.2) |
|---|---|---|
| Back to Registration | Yes | Yes |
| Review matching information | Optional (same guided step routing) | Yes |
| Continue registration | **Yes** | **No** |
| Open Patient 360 | **No** (parity with DUP-B.2) | No |
| Create Anyway / Override / Merge | **No** | No |

### Exact wording (proposed)

- Title: **Possible matching patient**
- Description: **We found existing patients with similar information. Review the match before creating a new patient.**
- Section: **Existing patients**
- Matched information: reuse DUP-B.2 chips/explanations via `MatchType`
- Primary: **Continue registration**
- Secondary: **Back to Registration**
- Optional tertiary/secondary: **Review matching information** (guided step) — product may keep two-action footer only; if so, guided review can be omitted from soft dialog and user uses Back + edit.

**Recommended footer (minimal):** Back to Registration · Continue registration  
**Optional:** keep Review matching information as in hard-block if product wants identical navigation aid.

### What “Continue registration” means (must be explicit)

**PROPOSED definition:**

- Means: staff acknowledges they reviewed the probable matches and wants to **proceed with create using the current form values**.
- Does **not** mean override of ≥0.95 (server still blocks).
- Does **not** require editing identity (editing is optional via Back).
- Does **not** open Patient 360.
- Does **not** merge.
- Re-submit: call `POST /patients` once with the same payload.
- **Acknowledgement persistence:** in-memory for the current wizard session / current identity fingerprint only; cleared if Name/DOB/Phone/Email change.
- **Audit event:** **NOT proposed for v1** — no existing create-path duplicate-acknowledgement audit mechanism found. Logging-only server duplicate checks already exist. Any durable acknowledgement audit is a **separate product/security decision**.

### Multiple candidates

- Show each candidate with its own `MatchType` presentation (same as DUP-B.2).
- Preserve API order (already confidence-descending from service).
- Scrollable list; no per-candidate actions.

### Mandatory review?

- **Yes** — create is paused until Continue or Back.
- Creation remains possible after Continue (soft band only).

### Server authority

- Thresholds, matcher, and ≥0.95 hard-block remain server-authoritative.
- Soft dialog is a **client gate before create**, not a replacement for server validation.

### Permission gap (OPEN PRODUCT DECISION)

`check-duplicates` requires **`patient.view`**.  
Create requires **`patient.create`**.

A clerk with `patient.create` but without `patient.view` **cannot** call the soft pre-check today.

Options (approval required):

1. Grant/ensure create roles also have `patient.view` (IAM/product).
2. Add a create-scoped duplicate preview endpoint (API change — larger).
3. Soft-check only when `patient.view` present; otherwise fall back to silent create (uneven UX — not preferred).

**Smallest frontend-only slice assumes create operators already have `patient.view` (common for Directory staff) — must be verified per role before implementation.**

---

## 7. Security / PHI

- Show only: name, MRN, DOB, age (computed), gender if available.
- Do not show: phone, email, DifferenceReason, confidence %, algorithm terms.
- Soft dialog must not become Patient 360 or Merge.
- Pre-check response contains phone/email in JSON — do not render; avoid logging response bodies.

---

## 8. Cross-entry-point consistency (CODE FACT)

| Entry point | UI path | Create engine |
|---|---|---|
| Patient Directory | `AddPatientDialog` → `AddPatientWizard` | Same POST /api/patients |
| `/dashboard/patients/new` | `AddPatientWizard` page | Same |
| Front Office | `buildCanonicalAddPatientHref` → `/dashboard/patients/new` | Same |
| Counsellor waiting list | canonical href → new page | Same |
| Appointment booking | canonical href → new page | Same |
| Admin patients | canonical href → new page | Same |

**Backend:** one duplicate engine for all MPI creates.  
**UX inconsistency today:** Directory uses dialog chrome; others use full page — soft dialog must live in shared wizard so all entry points inherit it.  
**Do not fix entry chrome in DUP-C.**

---

## 9. Implementation slice proposal (AFTER APPROVAL ONLY)

### Smallest slice (prefer frontend-only)

1. In `AddPatientWizard` submit: before `patientApi.create`, call existing check-duplicates when soft-band candidates exist.
2. New soft dialog component (or parameterized variant of hard-block presentation) reusing `resolveDuplicateMatchPresentation`.
3. Actions: Back / Continue (Continue → create).
4. Preserve DUP-B.2 hard-block on 400 unchanged.
5. Do **not** revive `DuplicatePatientWarningDialog`.
6. Do **not** change matcher/thresholds/DTOs/DB.

### Backend only if required

- Create-scoped soft-check permission or endpoint — **only if** role audit proves `patient.view` gap blocks registration staff.

### Explicitly not in first slice

- Soft-warning policy for update
- Patient 360 hint redesign
- Merge
- Audit acknowledgement persistence
- Threshold changes
- Disposable DB cleanup

---

## 10. Automated test plan (future)

1. Soft match EmailMatch 0.90 → dialog; no create until Continue  
2. Soft match Fuzzy 0.80–0.94 → dialog  
3. Multiple soft candidates → per-MatchType presentation  
4. No match → create unchanged  
5. ≥0.95 regression → DUP-B.2 hard-block; no Continue  
6. Back to Registration → form preserved; no create  
7. Continue → exactly one create call  
8. Change phone/email/name/DOB after soft warn → re-check on next create  
9. All entry points use wizard soft gate  
10. No Create Anyway / Override / Merge  
11. Authorization: create without view (document/fail closed per approved option)  
12. Parser hard-block unchanged  

---

## 11. Manual UAT plan (future)

1. Create patient with unique identity → success, no soft dialog  
2. Shared email only (different name) → soft dialog; Continue creates; Back cancels  
3. Similar name + same DOB (fuzzy mid) → soft dialog  
4. Exact phone → hard-block (no Continue)  
5. Exact name+DOB → hard-block  
6. Multi-candidate soft list scroll/order  
7. Directory dialog + `/dashboard/patients/new` + Front Office return path  
8. Confirm no Patient 360 / Merge in soft dialog  
9. Confirm registration card success path after Continue  

---

## 12. Out of scope

- Threshold / matcher / normalization changes  
- Hard-blocking 0.80–0.94 (OPTION C) without separate approval  
- Create Anyway / Override / Merge  
- Patient cleanup / DB reset  
- Health ID / MRN matching  
- Branch-scoped matching  
- Soft policy on update (unless expanded)  
- DUP-B.2 hard-block redesign  
- Patient 360 / Directory column changes  

---

## 13. Open product decisions (must approve before DUP-C implementation)

| ID | Decision |
|---|---|
| PD-DUP-C-01 | Approve OPTION B (review-before-create) vs A vs C vs status quo |
| PD-DUP-C-02 | Soft dialog title/copy finalize (proposed wording above) |
| PD-DUP-C-03 | Footer: two actions (Back + Continue) vs three (+ Review matching information) |
| PD-DUP-C-04 | **DECIDED in DUP-C.1** — Option B create-scoped duplicate check (`docs/decisions/patient-duplicate-dup-c1-create-scoped-check-decision.md`). Implementation not authorized. |
| PD-DUP-C-05 | Whether Continue requires checkbox acknowledgement (recommended: **no** for v1) |
| PD-DUP-C-06 | Whether to persist acknowledgement audit (recommended: **no** for v1) |
| PD-DUP-C-07 | Soft policy on patient update (recommended: **defer**) |

---

## FINAL STATUS

**AUDIT COMPLETE — IMPLEMENTATION NOT AUTHORIZED**
