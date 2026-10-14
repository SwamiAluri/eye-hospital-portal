# Patient Directory — Duplicate Patient Prevention & Matching Forensic Audit

**Status:** AUDIT ONLY — PRODUCT DECISION CONTRACT  
**Phase:** 3N.1  
**Recorded:** 2026-10-05  
**Scope:** Patient Directory / Patient 360 identity creation and duplicate matching  
**Implementation:** NOT AUTHORIZED by this document  

---

## 0. Hard constraints of this record

This document inspects and recommends only. It does **not** authorize:

- threshold changes
- algorithm changes
- “Create Anyway” / override
- Merge UI restoration on Directory
- Merge API deletion
- API / DTO / DB / migration / permission / route changes
- Add Patient / Directory / Front Office / Counsellor / Appointment UX changes

**Application code, APIs, DTOs, database, migrations, permissions, routes, and tests remain unchanged by this audit.**

### Related existing decisions (preserve)

| Document | What it already decides |
|---|---|
| `docs/decisions/patient-create-role-grant-decision.md` | `patient.create` is the only create permission; `POST /api/patients` is the only identity writer; `/dashboard/patients/new` is canonical UI |
| `docs/audits/patient-directory-ux-data-contract-reconciliation.md` PD-DIR-UX-09 | Do not change 0.80 / 0.95; no Create Anyway; warning UI for 0.80–0.94 is OPEN and blocked until product decision |
| `docs/audits/patient-directory-ux-data-contract-reconciliation.md` PD-DIR-UX-10 | Merge stays off Directory; backend Merge lifecycle OPEN / out of Directory UX scope |
| `docs/decisions/patient-directory-redesign-ux-contract.md` | Directory = discovery/navigation; Add Patient → canonical wizard |

---

## A. Existing certified behavior

### A.1 Single identity writer

**CODE FACT:** All live MPI patient creates converge on:

```
AddPatientWizard
  → patientApi.create
  → POST /api/patients
  → PatientsController.CreatePatient [RequirePermission("patient.create")]
  → PatientDuplicateDetectionService.CheckDuplicatesAsync
  → (if any MatchConfidence >= 0.95) HTTP 400
  → else PatientService.CreatePatientAsync
```

Evidence:

- Wizard submit: `apps/hospital-portal-web/src/components/patients/AddPatientWizard.tsx` (`patientApi.create`)
- API client: `apps/hospital-portal-web/src/lib/api/patients.api.ts`
- Controller: `microservices/auth-service/AuthService/Controllers/PatientsController.cs` (`CreatePatient`)
- Matching: `microservices/auth-service/AuthService/Services/PatientDuplicateDetectionService.cs`
- Create insert: `PatientService.CreatePatientAsync` (no duplicate logic inside service)

### A.2 Matching levels and scores (verified against current repository)

| Level | MatchType | Fields | Comparison | Confidence |
|---|---|---|---|---|
| 1 | `ExactNameDOB` | FirstName, LastName, DOB | Case-insensitive exact name; DOB `.Date` | **1.00** |
| 2 | `PhoneMatch` | ContactNumber | Exact string equality (**no normalization**) | **0.95** |
| 3 | `EmailMatch` | Email | Case-insensitive exact | **0.90** |
| 4 | `FuzzyNameDOB` | Full name + same DOB | Levenshtein similarity ≥ 0.80 | **similarity value** |

`IsDuplicate = matches.Any(m => m.MatchConfidence >= 0.80m)`  
Create/update hard block = any match `MatchConfidence >= 0.95m`

#### Threshold verification vs previous audit expectation

| Rule | Expected from previous audit | Current implementation | Match? |
|---|---|---|---|
| Exact name + DOB | 1.0 | 1.0 | Yes |
| Phone | 0.95 | 0.95 | Yes |
| Email | 0.90 | 0.90 | Yes |
| Fuzzy name + DOB include | ≥ 0.80 | ≥ 0.80 | Yes |
| `IsDuplicate` | ≥ 0.80 | ≥ 0.80 | Yes |
| Create hard block | ≥ 0.95 | ≥ 0.95 | Yes |

**No drift detected** from the previously documented threshold set.

### A.3 Normalization / filtering facts

| Topic | Current behavior |
|---|---|
| Tenant | Always `p.TenantId == tenantId` |
| Branch | **Not used** in matching queries (tenant-wide) |
| Soft-delete | `p.DeletedAt == null` on all levels |
| Status filter | No explicit Active-only filter (merged/deleted excluded via `DeletedAt`) |
| Candidate limit | **None** — `.ToListAsync()` unbounded |
| Phone normalization | **None** |
| Email normalization | `ToLower()` |
| Name normalization | `ToLower()`; fuzzy uses `"first last"` |
| DOB | Required for levels 1 and 4; date-only compare |
| MRN | **Not a matching input** (returned on matches only) |
| Health ID / Aadhaar / National ID | Stored on Patient; **not used** in duplicate matching |
| Exclude self | `excludePatientId` on update / hint banner |

### A.4 Create path UX (certified)

- Wizard does **not** call `POST /patients/check-duplicates` before submit (asserted by `canonical-add-patient.test.ts`, `AddPatientDialog.test.tsx`).
- On create failure, wizard shows `alert('Failed to create patient: ' + message)` using API `message` only — does **not** parse `duplicates[]`, does **not** offer Open Patient 360, does **not** offer Create Anyway.
- Server is authoritative for the hard block.

### A.5 Soft-signal consumers

| Consumer | Calls check-duplicates? | Permission | Behavior |
|---|---|---|---|
| `PatientDuplicateHintBanner` (Patient 360 record) | Yes | `patient.view` (API); merge link needs `patient.update` | Amber hint; links to merge / profile |
| `DuplicatePatientWarningDialog` | N/A | — | **Orphan** — zero production imports |
| `patients-enhanced.api.findSimilarPatients` | Calls `/patients/find-similar` | — | **No matching backend route found** |

---

## B. Security findings

| ID | Finding | Severity | Evidence |
|---|---|---|---|
| SEC-DUP-01 | Duplicate match DTO returns name, MRN, DOB, phone, email to callers of `check-duplicates` (`patient.view`) and create hard-block body (`patient.create`) | Medium — PHI exposure is intentional for matching but broad | `PatientDuplicateMatch` |
| SEC-DUP-02 | Matching is tenant-scoped; other tenants cannot appear | OK | All queries filter `TenantId` |
| SEC-DUP-03 | Matching is **not** branch-scoped; candidates from other authorized/unauthorized branches in the same tenant can appear | Product + privacy question | No `BranchId` filter |
| SEC-DUP-04 | Duplicate detection logs first name, last name, DOB at Information level | Privacy risk | `PatientDuplicateDetectionService` log lines |
| SEC-DUP-05 | Create hard-block returns full `duplicates` array; wizard currently ignores it, but any client with `patient.create` receives PHI candidates on 400 | Medium | `CreatePatient` BadRequest body |
| SEC-DUP-06 | No override / Create Anyway exists — good for integrity | Positive | Controller gate |

---

## C. UX findings

| ID | Finding |
|---|---|
| UX-DUP-01 | Hard-block UX is a browser `alert` with a generic sentence — not Counsellor-grade structured surface |
| UX-DUP-02 | Hard-block response includes candidate IDs/MRNs/names, but wizard does not surface them or link to Patient 360 |
| UX-DUP-03 | 0.80–0.94 matches produce **no** create-time warning; create proceeds silently |
| UX-DUP-04 | Post-create, Patient 360 may later show `PatientDuplicateHintBanner` — late, not prevention |
| UX-DUP-05 | Orphan `DuplicatePatientWarningDialog` already models proceed/select UX but is unused |
| UX-DUP-06 | UI `patient.create` gate is present on Directory Add Patient; Front Desk / Counsellor / Booking / Admin buttons often navigate without a local `patient.create` gate (API still enforces) |

---

## D. Data-integrity findings

| ID | Finding |
|---|---|
| DI-DUP-01 | Email (0.90) and mid-band fuzzy (0.80–0.94) do **not** block create → silent duplicate risk |
| DI-DUP-02 | Shared family phone (exact) blocks at 0.95 even when name/DOB differ → false-positive hard block risk |
| DI-DUP-03 | Merge re-points only visits, appointments, prescription, imaging_orders; deletes favorites; soft-deletes duplicate as `Merged` |
| DI-DUP-04 | Merge does **not** re-point counselling, billing, CCMS, IP journeys, labs, queue, optical, etc. |
| DI-DUP-05 | No unmerge API / reverse path found |
| DI-DUP-06 | Soft-deleted / merged patients are excluded from future matching (`DeletedAt == null`) |
| DI-DUP-07 | Health ID and other government IDs are not matching attributes today |

**Merge classification (evidence-only):**

- **Not** a safe primary duplicate-prevention mechanism (prevention is create-time matching + hard block)
- **Is** a limited **data-management** operation for a subset of clinical scheduling/Rx/imaging FKs
- **Incomplete** for enterprise MPI / full cross-domain consolidation
- Directory Merge chrome already removed; API retained (`patient.update`)

---

## E. Performance findings

| ID | Finding |
|---|---|
| PERF-DUP-01 | Level 4 loads **all** same-DOB patients for the tenant into memory, then runs Levenshtein per row |
| PERF-DUP-02 | No candidate cap / `.Take()` |
| PERF-DUP-03 | Levels 1–3 are EF filter queries (indexed fields depend on DB schema — not verified as covering indexes in this audit) |
| PERF-DUP-04 | Phone exact match without normalization may miss format variants and still scan contact column |
| PERF-DUP-05 | Risk grows with tenant census and birthday clustering (common DOBs) |

No indexes or query changes are proposed here.

---

## F. Product Decision Register

### PD-DUP-01 — Confidence band 0.80–0.94

**Current behavior:**  
`IsDuplicate=true` on `check-duplicates`. Create/update **allowed**. Wizard shows nothing. Patient 360 hint may appear later if banner runs.

**Product decision required:**  
What should happen on create for 0.80–0.94?

Options (for decision, not selected here):

1. Keep silent allow (status quo)
2. Soft warn + require acknowledgement (no override of ≥0.95)
3. Soft warn with Open Existing Patient, still allow create without “Create Anyway” wording
4. Raise/lower soft threshold (would change certified thresholds — needs explicit approval)

**Cite:** PD-DIR-UX-09 already blocks inventing warning UI until this decision exists.

---

### PD-DUP-02 — UX for ≥0.95 hard block

**Current behavior:**  
HTTP 400 `{ error, message, duplicates[] }`. Wizard `alert(message)` only.

**Product decision required:**  
What must the user see? Must candidates (MRN/name/DOB) be shown? Structured dialog vs alert?

---

### PD-DUP-03 — Open Existing Patient action

**Current behavior:**  
Candidates include `Id` and `MedicalRecordNumber`, but create UX does not link to Patient 360.

**Product decision required:**  
Should hard-block (and optionally soft-warn) offer a safe “Open existing patient” navigation using returned IDs?

---

### PD-DUP-04 — Consistency across creation entry points

**Current behavior:**  
All live MPI creates share the same wizard → same server gate. Entry chrome differs (dialog vs page; some lack UI `patient.create` visibility gate).

**Product decision required:**  
Require UI `patient.create` gating on every “New patient” button? Keep API-only enforcement?

---

### PD-DUP-05 — Matching identity field hierarchy

**Current behavior:**  
Name+DOB, phone, email, fuzzy name+DOB. Health ID / Aadhaar / National ID / MRN not used as match inputs.

**Product decision required:**  
Approved hierarchy for future matching (including whether Health ID becomes a hard identifier)?

---

### PD-DUP-06 — Shared family phone / email

**Current behavior:**  
Shared phone → 0.95 hard block. Shared email → 0.90 signal only (silent create).

**Product decision required:**  
How should shared household contacts be treated (block / warn / ignore unless name also similar)?

---

### PD-DUP-07 — Branch in matching vs authorization only

**Current behavior:**  
Branch authorizes create target via `ResolveEffectiveBranchAsync`. Matching is tenant-wide.

**Product decision required:**  
Should candidates be tenant-wide (current), branch-scoped, or authorized-branch-scoped?

---

### PD-DUP-08 — Soft-deleted / historical patients

**Current behavior:**  
`DeletedAt == null` only; merged patients excluded from matching.

**Product decision required:**  
Should historical/merged patients ever surface as “already existed” signals (read-only), or remain invisible?

---

### PD-DUP-09 — Role of Merge after Directory removal

**Current behavior:**  
Directory has no Merge chrome. Merge API + `/dashboard/patients/merge` + Patient 360 hint remain. Partial FK re-point; no unmerge.

**Product decision required:**  
Keep as admin/data-management tool? Restrict further? Require cross-domain re-point + unmerge before any expansion?  
**Preserve PD-DIR-UX-10:** not a Directory UX slice.

---

### PD-DUP-10 — Enterprise MPI later?

**Current behavior:**  
In-service 4-level matcher; not an MPI product. No golden-record / survivorship / link-not-merge model.

**Product decision required:**  
Is a later enterprise MPI/master-patient-index program required, or is enhanced in-app matching sufficient?

---

## G. Recommended bounded implementation sequence

> None of the following slices are authorized by this audit.

| Slice | Intent | Depends on | Justified now? |
|---|---|---|---|
| **DUP-A** | Hard-block UX: structured error, show candidate identity (MRN/name), Open Existing Patient, Cancel registration — **no threshold change**, no Create Anyway | PD-DUP-02, PD-DUP-03 | **Yes — highest value / safest** (uses existing 400 payload) |
| **DUP-B** | Align UI `patient.create` visibility on all New Patient entry buttons; keep same wizard | PD-DUP-04 | Yes if product wants consistent chrome |
| **DUP-C** | Soft-warn UX for approved 0.80–0.94 band (pre-check or create response) | **PD-DUP-01 required first** | Blocked until PD-DUP-01 |
| **DUP-D** | Matching policy (phone/email/Health ID/branch/soft-delete) | PD-DUP-05..08 | Later; algorithm change |
| **DUP-E** | Merge / MPI data-integrity program | PD-DUP-09, PD-DUP-10 | Separate from Directory |

**Directory must not become a duplicate-management worklist.**

---

## H. Patient creation path matrix

| Entry point | Canonical wizard | Duplicate check | Same thresholds | Same response | Same UX |
|---|---|---|---|---|---|
| Patient Directory Add Patient (dialog) | Yes (`AddPatientDialog`) | Server on POST only | Yes | Yes | alert on fail |
| `/dashboard/patients/new` | Yes (page) | Server on POST only | Yes | Yes | alert on fail |
| Front Office Quick Action | Yes (nav → `/new`) | Server on POST only | Yes | Yes | alert on fail |
| Counsellor “New patient” | Yes (nav → `/new`) | Server on POST only | Yes | Yes | alert on fail |
| Appointment “Register New Patient” | Yes (nav → `/new`) | Server on POST only | Yes | Yes | alert on fail |
| `/admin/patients` New Patient | Yes (nav → `/new`) | Server on POST only | Yes | Yes | alert on fail |
| Counsellor Schedule counselling modal | **No** (select existing / session) | Waiting-list episode duplicate, not MPI | N/A | N/A | N/A |
| Specialty clinic “New Patient” buttons | Broken / non-wiring / wrong query | N/A | N/A | N/A | Inconsistent chrome |

---

## I. 0.80–0.94 band (explicit)

### Current behavior

1. Matching may return EmailMatch (0.90) and/or FuzzyNameDOB (0.80–0.94).
2. `IsDuplicate` is **true**.
3. `POST /patients/check-duplicates` returns 200 with matches.
4. `POST /patients` **does not block**; patient is created.
5. Wizard shows **no** warning for this band.
6. Nothing is stored as a “duplicate link” record by create.
7. Logs may record match findings at Information/Warning in the detection service when check runs.
8. Later, Patient 360 hint banner may call check-duplicates and show amber UI.

### Product decision required

See **PD-DUP-01**. Do not invent a policy in implementation until decided.

---

## J. ≥0.95 hard block (explicit)

| Topic | Current |
|---|---|
| Status | HTTP **400 BadRequest** |
| Body keys | `error`, `message`, `duplicates` (note: check-duplicates uses `matches`) |
| Candidates returned | Yes — full `PatientDuplicateMatch` list |
| Candidate IDs / MRN / name / DOB / phone / email | Yes |
| UI identifies existing patient | **No** (alert message only) |
| Open Patient 360 | **No** |
| Abandon registration | User dismisses alert / closes wizard manually |
| Override | **None** |
| Authority | **Server** |

Triggered by ExactNameDOB (1.0), PhoneMatch (0.95), or FuzzyNameDOB ≥ 0.95.

---

## K. Identity model (current)

| Attribute | Role |
|---|---|
| `Patient.Id` (Guid) | **Canonical identity** |
| `MedicalRecordNumber` | Business identifier (generated on create; display / search) |
| `HealthId`, Aadhaar, NationalId, Passport, DL | Stored identifiers; **not** duplicate-match inputs today |
| First/Last name, DOB | Matching + display |
| ContactNumber, Email | Matching + display |
| `TenantId` | Isolation boundary |
| `BranchId` | Create authorization / home branch; **not** match filter |

---

## L. False positive / false negative analysis

| Scenario | Likely code outcome | Classification |
|---|---|---|
| Same name + same DOB | Block (1.0) | CODE FACT |
| Same phone, different person (family) | Block (0.95) | RISK — FP hard block |
| Same email, different person | Silent create (0.90) | RISK — FN prevention |
| Typo name + same DOB (high similarity) | Soft IsDuplicate; create allowed if &lt;0.95; block if ≥0.95 | CODE FACT |
| Same name, different DOB | No level-1/4; phone/email may still match | CODE FACT |
| Missing phone/email | Fewer signals; more reliance on name+DOB | RISK — FN |
| Twins (same DOB, similar names) | Fuzzy may warn/block depending on similarity | RISK — FP |
| Married name change | May miss unless phone/email match | RISK — FN |
| Phone format variants (`+91` vs local) | Miss (no normalization) | RISK — FN |
| Health ID same, demographics differ | No match on Health ID | RISK — FN / PD-DUP-05 |
| Soft-deleted prior record | Invisible to matcher | CODE FACT / PD-DUP-08 |

---

## M. Existing test coverage (audit; no new tests added)

| Area | Coverage found | Gap |
|---|---|---|
| Threshold unit tests for matcher | **None** asserting 0.80/0.90/0.95 scores | High |
| Create controller duplicate block | Mocks return empty duplicates in several AuthService tests | No positive ≥0.95 case found in this audit |
| Permission on Merge / create | Export authorization tests assert permission attributes | Partial |
| Wizard does not pre-check | `canonical-add-patient.test.ts`, `AddPatientDialog.test.tsx` | Covered |
| FE orphan dialog | Exists; unused | No integration |
| E2E duplicate create | Archive testing guides under `archive/docs/...` — not live suite proof | Gap |

---

## N. Explicit out of scope

- Directory redesign / worklist changes  
- Changing thresholds or algorithm  
- Create Anyway  
- Restoring Directory Merge chrome  
- Deleting Merge API  
- Enterprise MPI build  
- Specialty clinic dead “New Patient” button repairs (separate cleanup unless product prioritizes)  
- Index / performance migrations  

---

## O. Files inspected (non-exhaustive)

**Backend:**  
`PatientDuplicateDetectionService.cs`, `PatientDuplicateDtos.cs`, `PatientsController.cs`, `PatientMergeService.cs`, `PatientService.cs`, `Patient.cs`, `Program.cs`

**Frontend:**  
`AddPatientWizard.tsx`, `AddPatientDialog.tsx`, `canonical-add-patient.ts`, `patients.api.ts`, `PatientHubPage.tsx`, `PatientDuplicateHintBanner.tsx`, `DuplicatePatientWarningDialog.tsx`, merge routes/page, Front Desk / Counsellor waiting-list / UnifiedAppointmentBooking entry points

**Docs:**  
`patient-create-role-grant-decision.md`, `patient-directory-ux-data-contract-reconciliation.md`, prior Directory redesign audits

---

## P. Next gate

**PRODUCT DECISION REVIEW** for PD-DUP-01 … PD-DUP-10  

Recommended first implementation candidate **after** decisions: **DUP-A** (hard-block UX only).

---

**IMPLEMENTATION STATUS:** NOT AUTHORIZED  
**APPLICATION CODE:** UNCHANGED  
**API / DTO / DATABASE / MIGRATIONS / PERMISSIONS / ROUTES / TESTS:** UNCHANGED  
