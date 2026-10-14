# Patient Directory — Sam Badikolu Registration / Duplicate / Lookup Forensic Audit

**Date:** 2026-10-05  
**STATUS:** FORENSIC AUDIT COMPLETE — IMPLEMENTATION NOT AUTHORIZED  
**NEXT GATE:** Review the fix register and approve bounded implementation slices.  
**STOP**

No code, matcher, API, schema, census, permission, Preview, or shared-DB data was modified during this investigation. Database access was **read-only SELECT**. No test patients were created.

---

## 1. Executive summary

The UAT claim was: register **Sam / Badikolu / 01-08-1987 / 8919653433** → Confirm & Create → patient created → no duplicate UI → Directory search cannot find “Sam Badikolu”.

Independent layer findings:

| Layer | Verdict |
|---|---|
| **A. Duplicate pre-check** | Live `POST /api/patients/registration/check-duplicates` for the **claimed** identity returns **200**, `isDuplicate=true`, **3× PhoneMatch** soft candidates. Soft dialog **must** open under current FE rules. |
| **B. Patient creation (claimed identity)** | **No row** `first_name=Sam` + `last_name=Badikolu` exists in any tenant (including soft-deleted). Claimed create of “Sam Badikolu” is **not evidenced in DB**. |
| **C. Closest live surname row** | `Samuel Badikolu` `MRN-2026-10-7ABCD` (`09012e03-…`), DOB **1987-06-12**, phone **8919653499**, branch Downtown, created **2026-10-05 10:27 UTC**. Different first name, DOB, and phone from the claimed UAT payload. |
| **D. Lookup / search** | `q=Badikolu` finds 2 rows; `q=Sam Badikolu` finds **0**; `q=8919653433` finds **3** phone holders. Full-name substring search does **not** match `Samuel Badikolu` when the query is `Sam Badikolu`. |
| **E. Post-create Preview handoff** | Code path exists and is close-gated by `patient.id`. Cannot have executed for a non-existent Sam Badikolu create. Not re-proven in a live browser session for this UAT (no browser session available). |

**Primary root-cause classification (claimed Sam Badikolu identity):**

1. **CREATION DEFECT (evidentiary)** — claimed patient identity was never persisted as stated.  
2. **DUPLICATE UI DEFECT is not proven** for that identity — if Confirm used phone `8919653433`, soft review is required by current code + live matcher. Absence of soft UI + successful create is inconsistent with that payload.  
3. **SEARCH UX / LOOKUP CONTRACT subtlety** — searching the two-token string `Sam Badikolu` returns zero rows even when `Samuel Badikolu` exists (full-name `Contains` does not treat “Sam” as a prefix of “Samuel”).  
4. **MATCHING COVERAGE GAP / PRODUCT DECISION** — surname-only / Sam↔Samuel without shared phone or same-DOB fuzzy ≥0.80 is intentionally uncovered.

Most likely UAT reconstruction: operator registered a **near** identity (very likely **Samuel Badikolu** with phone ending **3499** / DOB **12-06-1987**, or misremembered fields), saw no soft review because that phone was unique, then searched **`Sam Badikolu`** and got an empty worklist.

---

## 2. Exact UAT reproduction (as reported)

1. Directory → Add Patient  
2. Progressive steps through Review & Confirm  
3. Confirm & Create Patient  
4. Patient believed created  
5. Returned to Directory  
6. No Possible Duplicate Patient review observed  
7. Search for “Sam Badikolu” failed  

Claimed payload:

| Field | Claimed value | Form/API SoT note |
|---|---|---|
| First name | Sam | Wizard `firstName` |
| Last name | Badikolu | Wizard `lastName` |
| DOB display | 01-08-1987 | Wizard stores ISO `yyyy-MM-dd` → **1987-08-01** (DD-MM-YYYY) |
| Phone | 8919653433 | Form `phone` → API `contactNumber` |
| Email | (not supplied) | `null` |

Runtime environment for this audit:

- Auth API: `http://localhost:5073` (listening)  
- Web: `localhost:3000` (listening)  
- Tenant (India Eye): `155fe198-6ae5-4a01-9254-ead5b427247e`  
- Branch (Downtown): `74c014cf-9570-4824-bdf9-b369ea11a8f4`  
- Browser session for this UAT: **not available** (no open IDE browser tabs)

---

## 3. Duplicate pre-check trace

### 3.1 Confirm & Create request flow (code)

`AddPatientWizard` Review button → `handleSubmit` (`AddPatientWizard.tsx` ~1062–1149):

1. Gate: `currentStepId === 'REVIEW'`, `validateForCreate()`, not already submitting  
2. If soft-ack fingerprint ≠ current identity → `patientApi.checkDuplicatesForRegistration`  
3. `parseRegistrationDuplicateCheckResult`  
4. If `shouldShowSoftDuplicateReview` → open soft dialog / phase `duplicate-review` / **return (no create)**  
5. Else → `createPatientFromWizard` → `POST /patients`

**Endpoint (create-scoped):**

| Item | Value |
|---|---|
| URL | `POST /api/patients/registration/check-duplicates` |
| Permission | `patient.create` |
| FE client | `patients.api.ts` → `checkDuplicatesForRegistration` |
| Controller | `PatientsController.CheckDuplicatesForRegistration` |

**Payload fields from wizard:**

```json
{
  "firstName": "<trimmed>",
  "lastName": "<trimmed>",
  "dateOfBirth": "<ISO yyyy-MM-dd or null>",
  "contactNumber": "<form phone trimmed or null>",
  "email": "<trimmed or null>"
}
```

Skip condition: `softMatchAcknowledgedKey === registrationIdentityFingerprint(...)` after Continue on soft dialog.

Fail-closed: check throw → alert; **create does not run**.

### 3.2 Live probe — claimed UAT identity (read-only)

Auth as `admin@test.com` + `X-Tenant-ID` + Downtown branch context.

Request body (safe):

```json
{
  "firstName": "Sam",
  "lastName": "Badikolu",
  "dateOfBirth": "1987-08-01",
  "contactNumber": "8919653433"
}
```

| Result | Value |
|---|---|
| HTTP status | **200** |
| `isDuplicate` | **true** |
| Candidate count | **3** |
| Message | Possible matching patients were found… |

| # | patient.id | MRN | Name | DOB | MatchType | matchedAttributes | differentAttributes |
|---|---|---|---|---|---|---|---|
| 1 | `345b3f07-…` | MRN-2026-10-D5F70 | sadfasfdsfsafd asdfasfsdfsf | 1997-08-13 | **PhoneMatch** | Phone | FirstName, LastName, DateOfBirth |
| 2 | `03cfe1cc-…` | MRN-2026-10-49562 | Samuel Aluri | **1987-08-01** | **PhoneMatch** | DateOfBirth, Phone | FirstName, LastName |
| 3 | `9ec9b6b6-…` | MRN-2026-10-8B782 | Samuel Aluri | 1987-08-03 | **PhoneMatch** | Phone | FirstName, LastName, DateOfBirth |

No `ExactNameDOB`. No `FuzzyNameDOB` for this request (see matcher section).

### 3.3 Live probe — existing Samuel Badikolu identity

```json
{
  "firstName": "Samuel",
  "lastName": "Badikolu",
  "dateOfBirth": "1987-06-12",
  "contactNumber": "8919653499"
}
```

| Result | Value |
|---|---|
| HTTP | **200** |
| `isDuplicate` | **true** |
| MatchType | **ExactNameDOB** |
| matchedAttributes | FirstName, LastName, DateOfBirth, Phone |
| FE soft dialog? | **No** (`shouldShowSoftDuplicateReview` false when any ExactNameDOB) |
| Create authority | Hard-block on `POST /patients` (≥ 0.95) |

---

## 4. Matcher trace

### 4.1 Phone normalization

`PatientPhoneComparisonNormalizer.Normalize("8919653433")` → **`8919653433`** (bare 10-digit Indian mobile, first digit 8).

Equivalent forms also normalize to the same key: `+91 89196 53433`, `08919653433`, etc. Stored `contact_number` is never rewritten.

### 4.2 Phone comparison

- Compared field: **`ContactNumber` only** (request + stored patient)  
- Formatting differences: handled via digit extract + Indian 91/0 rules  
- MatchType: `PhoneMatch`  
- Confidence: **0.90** (soft band)  
- Soft vs hard: soft (`< 0.95`); create hard-block threshold remains **≥ 0.95**  
- Therefore PhoneMatch alone **never** hard-blocks create

### 4.3 Certified rules (unchanged product boundary)

| Level | MatchType | Trigger | Confidence |
|---|---|---|---|
| 1 | ExactNameDOB | Normalized first **and** last + same calendar DOB | 1.00 (hard) |
| 2 | PhoneMatch | Normalized phone equal | 0.90 (soft) |
| 3 | EmailMatch | Case-insensitive email | 0.90 (soft) |
| 4 | FuzzyNameDOB | Same DOB + full-name Levenshtein similarity ≥ 0.80 | 0.80–0.99 |

`IsDuplicate` flag: any match ≥ **0.80**.

### 4.4 Fuzzy simulation for claimed name (local Levenshtein = service algorithm)

| Request full name | Existing | Same DOB? | Similarity | FuzzyMatch? |
|---|---|---|---|---|
| sam badikolu | samuel aluri | yes (1987-08-01 for one Aluri) | **0.25** | No |
| sam badikolu | sam aluri | yes | **0.4167** | No |
| sam badikolu | samuel badikolu | **no** (DB DOB 1987-06-12) | 0.80 theoretical if DOB matched | N/A (DOB gate) |
| sam badikolu | sandeep badikolu | no | 0.6875 | No |

For claimed DOB + phone: only **PhoneMatch** fires (proven live).

---

## 5. Candidate evidence (read-only DB)

Tenant `155fe198-…`, branch Downtown unless noted.

### 5.1 Exact claimed identity

| Probe | Result |
|---|---|
| `first_name=Sam` AND `last_name=Badikolu` | **0 rows** (all tenants) |
| Soft-deleted Sam/Badikolu-like | **0 rows** |
| Recent `first_name=Sam` last 3 days | **0 rows** |

### 5.2 Surname Badikolu

| id | MRN | Name | DOB | Phone | Created |
|---|---|---|---|---|---|
| `09012e03-864c-415f-be47-d40b8af04340` | MRN-2026-10-7ABCD | **Samuel** Badikolu | 1987-06-12 | 8919653499 | 2026-10-05 10:27 UTC |
| `cd064828-6ff8-4ad1-a987-5e202114e709` | MRN-2026-02-42E13 | Sandeep Badikolu | 1988-11-27 | (empty) | 2026-02-02 |

Both: tenant India Eye, branch Downtown, `deleted_at` NULL, status Active.

### 5.3 Normalized phone `8919653433` (exact comparison key)

| id | MRN | Name | DOB | Match rule vs claimed Sam Badikolu |
|---|---|---|---|---|
| `345b3f07-…` | MRN-2026-10-D5F70 | sadfasfdsfsafd asdfasfsdfsf | 1997-08-13 | PhoneMatch |
| `9ec9b6b6-…` | MRN-2026-10-8B782 | Samuel Aluri | 1987-08-03 | PhoneMatch |
| `03cfe1cc-…` | MRN-2026-10-49562 | Samuel Aluri | 1987-08-01 | PhoneMatch (+ DOB attribute signal) |

Count of normalized phone equals `8919653433`: **3**.

### 5.4 Does any existing patient match certified matcher for claimed payload?

**Yes — three PhoneMatch soft candidates** (live API + DB).  
**No ExactNameDOB** for Sam+Badikolu+1987-08-01.  
**No FuzzyNameDOB** at ≥0.80 for that name+DOB against current rows.

---

## 6. Why no duplicate UI appeared

FE soft gate (`registration-duplicate-check.ts`):

```ts
shouldShowSoftDuplicateReview =
  isDuplicate && matches.length > 0 && !matches.some(m => matchType === 'ExactNameDOB')
```

| Hypothesis | Evidence | Verdict |
|---|---|---|
| Endpoint not called | Wizard always calls before create unless soft-ack | Unlikely for first Confirm |
| Wrong payload | Unknown without Network HAR from that UAT | Possible (identity mismatch) |
| Endpoint returned no candidates | Live probe with claimed phone → **3 candidates** | Disproven for claimed phone |
| Parser rejected candidates | Parser keeps rows with `id`; live body has ids | Disproven for current code |
| Hard-match bypassed soft incorrectly | Soft skipped only for ExactNameDOB; PhoneMatch must show soft | Disproven for PhoneMatch |
| Soft dialog lifecycle closed incorrectly | Would still have been shown once | Not evidenced |
| Registration shell skipped review | Hosted soft dialog is sibling; phase switches to `duplicate-review` | Code path present |

**Exact root cause for “no duplicate UI” under claimed payload:**  
**Not reproducible.** Current implementation **must** show `DuplicatePatientSoftMatchDialog` for that phone.

**Consistent reconstruction:** Confirm payload did **not** include phone `8919653433` (e.g. registered **Samuel Badikolu / 8919653499 / 1987-06-12** when that phone was unique → `isDuplicate=false` → no soft UI → create 201). Soft-ack skip only applies after an earlier Continue for the same fingerprint.

Classification: **EXPECTED CURRENT BEHAVIOR** for unique phone create of Samuel Badikolu; **DUPLICATE UI DEFECT** only if Network proof shows PhoneMatch response + dialog never opened.

---

## 7. Create trace

| Probe | Result |
|---|---|
| Claimed Sam Badikolu create response (this session) | **Not available** (no browser HAR; no such DB row) |
| Closest create today | Samuel Badikolu `MRN-2026-10-7ABCD`, id `09012e03-…` |
| Wizard create path | `POST /api/patients` → parse `id`/`Id` → `setSavedPatient` → `onCreated(patientId)` in dialog mode |
| Hard-block | 400 when any match confidence ≥ 0.95; clears saved patient; hard dialog |

Live ExactNameDOB re-check of Samuel Badikolu proves create of that exact identity would now hard-block.

---

## 8. Database persistence evidence (read-only)

### Claimed Sam Badikolu

**Not found.** No `patient.id` / MRN to attribute to that identity.

### Closest row — Samuel Badikolu

| Column | Value |
|---|---|
| id | `09012e03-864c-415f-be47-d40b8af04340` |
| medical_record_number | `MRN-2026-10-7ABCD` |
| first_name | Samuel |
| last_name | Badikolu |
| date_of_birth | 1987-06-12 |
| contact_number | 8919653499 |
| email | (empty) |
| tenant_id | `155fe198-6ae5-4a01-9254-ead5b427247e` |
| branch_id | `74c014cf-9570-4824-bdf9-b369ea11a8f4` |
| deleted_at | NULL |
| status | Active |
| created_at | 2026-10-05 10:27:43.231422+00 |

No row mutated during this audit.

---

## 9. Lookup trace

Contract: `GET /api/patients/lookup`  
Tenant: JWT + `X-Tenant-ID`  
Branch: `branchId` query → effective branch  
Defaults: `tab=all`, `page=1`, `pageSize=25`, `sortBy=name`, `sortDir=asc`

Live API (Downtown branch) — key needles:

| q | HTTP | totalCount | Includes claimed Sam Badikolu? | Notes |
|---|---|---|---|---|
| `Sam` | 200 | 14+ (page truncated in capture) | No (identity absent) | Includes many Sam/Samuel* |
| `Badikolu` | 200 | **2** (SQL + suggest corroboration) | No | Samuel + Sandeep |
| `Sam Badikolu` | 200 | **0** (SQL ApplySearchFilter sim + live suggest empty) | No | Does **not** hit Samuel Badikolu |
| `8919653433` | 200 | **3** | No | Phone holders only |
| `MRN-2026-10-7ABCD` | 200 | **1** | N/A | Samuel Badikolu |
| `Samuel` | 200 | **6** | No | Includes Samuel Badikolu |
| `Samuel Badikolu` | (SQL Contains) | **1** expected | No | Distinct from `Sam Badikolu` |
| `8919653499` | (DB uniqueness) | 1 | N/A | Samuel Badikolu only |

SQL simulation of `ApplySearchFilter` on Downtown scope:

| needle | cnt |
|---|---|
| sam | 14 |
| badikolu | 2 |
| sam badikolu | **0** |
| 8919653433 | 3 |
| mrn-2026-10-7abcd | 1 |

---

## 10. Search trace (field mapping)

`PatientLookupService.ApplySearchFilter` (`PatientLookupService.cs` ~361–371):

`q` (length ≥ 2) matches if **any**:

- `(FirstName + " " + LastName).ToLower().Contains(needle)`  
- `MedicalRecordNumber` contains (lower)  
- `ContactNumber` contains (needle lowercased; column not lowercased)  
- `Email` contains (lower)

Not searched by lookup `q`: MiddleName, HealthId/UHID, discrete first/last OR (unlike legacy `/search`).

Directory UI copy (`PatientDirectorySearch.tsx`):

- aria-label / placeholder: name, MRN, phone, email  

**Promise vs lookup:** fields match.  
**Behavioral gap:** UI says “name” but implementation is **substring of concatenated full name**, so `Sam Badikolu` ∉ `samuel badikolu`. Classify as **SEARCH UX DEFECT** (and optionally LOOKUP CONTRACT if product intends tokenized/prefix name search).

---

## 11. Suggest trace

Directory search box does **not** call suggest (debounced lookup only). Autosuggest is a separate path (`PatientSearchAutosuggest` / `unified-patient-search`) used by Front Desk and other modules.

Live `GET /api/patients/suggest` (Downtown):

| q | HTTP | Result (high level) |
|---|---|---|
| Sam | 200 | Many Sam/Samuel* including Samuel Badikolu |
| Badikolu | 200 | Samuel Badikolu + Sandeep Badikolu |
| MRN-2026-10-7ABCD | 200 | Samuel Badikolu |
| 8919653433 | 200 | 3 phone holders |
| Sam Badikolu | 200 | **[] empty** |

So even suggest does not surface Samuel Badikolu for `Sam Badikolu`. Not the Directory path, but same user expectation failure mode.

Classification: **AUTOSUGGEST DEFECT** only if product expects two-token prefix/tokenization; Directory path remains lookup-driven.

---

## 12. Tenant / branch analysis

| Subject | tenant_id | branch_id |
|---|---|---|
| Samuel Badikolu (closest) | India Eye `155fe198-…` | Downtown `74c014cf-…` |
| Phone holders | same tenant | same branch |
| Directory default UAT context (prior forensics) | same | same |

Lookup/suggest scope: `TenantId` + `DeletedAt IS NULL` + `(BranchId IS NULL OR BranchId == effectiveBranch)`.

**Branch mismatch is not the cause** for Downtown Directory vs Samuel Badikolu.  
Do not broaden branch visibility.

Classification: **EXPECTED CURRENT BEHAVIOR** for scope; not TENANT/BRANCH SCOPE DEFECT for this UAT context.

Census tabs (`current` / `discharged` / `high_priority`) can hide brand-new patients from the worklist; `all` / `new` should not hide a fresh create. Active non-matching `q` will hide them from the table while Preview handoff (by id) is supposed to still open.

---

## 13. Post-create handoff trace

Files:

- `created-patient-preview-handoff.ts` — `resolveCreatedPatientPreviewRow` / summary→row map  
- `PatientHubPage.tsx` — `createdHandoffPatientId`, `onCreated`, close → `openCreatedPatientPreview`

Sequence (dialog Directory):

1. Create success → `onCreated(patient.id)` (immediate + optional close re-notify)  
2. Hub stores `createdHandoffPatientId` + invalidates `patientLookupKeys.all`  
3. On Add Patient **close** → consume id → `openCreatedPatientPreview`  
4. Prefer list row by id; else `GET /api/patients/{id}/summary?branchId=…` → map → `openPreview`  
5. Does **not** clear `q` / tab / filters / sort / page  

Silent no-op if `branchId` missing.

**For claimed Sam Badikolu:** handoff cannot run — no created id.  
**For Samuel Badikolu:** code would run on Close if create went through current hub wiring; this UAT did not supply Network/UI proof that Close occurred after create under the new handoff build.

Classification if Preview missing after a real create: investigate **POST-CREATE HANDOFF DEFECT** vs operator closed without noticing docked/floating Preview; not proven for this case.

---

## 14. Preview hydration trace

`GET /api/patients/{id}/summary?branchId={branch}&skipPhiAudit=true` for Samuel Badikolu:

| Item | Value |
|---|---|
| HTTP | **200** |
| id | `09012e03-…` |
| mrn | MRN-2026-10-7ABCD |
| name | Samuel Badikolu |
| Can map to Preview row | Yes (`patientLookupRowFromSummary`) |

No 404/403 for in-tenant Downtown summary of that id with admin JWT.

Classification: **EXPECTED CURRENT BEHAVIOR** for summary hydration of existing id. **PREVIEW HYDRATION DEFECT** not evidenced.

---

## 15. Root-cause classification

| # | Category | Applies? | Statement |
|---|---|---|---|
| 1 | CREATION DEFECT | **Yes (claimed identity)** | No persisted Sam Badikolu; claimed create not evidenced |
| 2 | DUPLICATE PRE-CHECK DEFECT | **No** | Endpoint + matcher return PhoneMatch for claimed phone |
| 3 | MATCHING COVERAGE GAP | **Yes (product)** | Sam↔Samuel / surname-only / surname+DOB without phone not in certified rules |
| 4 | DUPLICATE UI DEFECT | **Not proven** | Would require HAR: PhoneMatch 200 + dialog absent |
| 5 | TENANT / BRANCH SCOPE DEFECT | **No** (Downtown) | Closest row in scope |
| 6 | LOOKUP CONTRACT DEFECT | **Partial / UX** | `q` full-name substring misses prefix first-name + surname (`Sam Badikolu` vs `Samuel Badikolu`) |
| 7 | SEARCH UX DEFECT | **Yes** | Empty results for natural two-token query against Samuel Badikolu |
| 8 | AUTOSUGGEST DEFECT | **Secondary** | Suggest also empty for `Sam Badikolu`; Directory does not use it |
| 9 | POST-CREATE HANDOFF DEFECT | **Not proven** | No created Sam id; handoff code present |
| 10 | PREVIEW HYDRATION DEFECT | **No** | Summary 200 for Samuel Badikolu |
| 11 | EXPECTED CURRENT BEHAVIOR | **Yes** | Unique-phone Samuel Badikolu create without soft UI; phone soft-only; ExactNameDOB skips soft |
| 12 | PRODUCT DECISION REQUIRED | **Yes** | Whether Sam/Samuel / surname rules should enter matcher; whether lookup tokenizes names |

---

## 16. Complete fix register

| Priority | Problem | Proven root cause | Evidence | Fix required | Layer |
|---|---|---|---|---|---|
| **P0** | Claimed “Sam Badikolu” create cannot be located | Identity never persisted as claimed (or different identity registered) | DB 0 rows for Sam+Badikolu; closest Samuel Badikolu different phone/DOB | UAT re-run with Network capture of check-duplicates + POST /patients; do **not** invent create fix without HAR | Process / UAT |
| **P0** | Soft duplicate missed (if claimed phone was used) | Inconsistent with live matcher — either wrong payload or unproven UI bug | Live check-duplicates → 3 PhoneMatch; FE `shouldShowSoftDuplicateReview` true | Capture HAR; if response soft + no dialog → FE lifecycle slice only | Frontend (only if proven) |
| **P1** | Directory search `Sam Badikolu` empty while Samuel Badikolu exists | Full-name `Contains` does not match prefix-of-first-name + last-name | SQL + API: `q=Sam Badikolu` → 0; `q=Badikolu` → 2; `q=Samuel Badikolu` would hit | Product-approved tokenized/prefix name search **or** UI copy that users should search surname/MRN/phone; **do not** silently broaden branch/census | API lookup and/or FE copy |
| **P1** | Post-create discoverability when filters hide new patient | Preview handoff is close-gated; UAT may predate/miss it | `PatientHubPage` + handoff report READY FOR MANUAL UAT | Complete handoff UAT; optional toast if summary fails; never clear `q` automatically | Frontend |
| **P2** | Operator expects surname / Sam↔Samuel duplicate safety | Certified matcher has no surname-only / nickname rules | Fuzzy Sam vs Samuel Aluri 0.25–0.42; Samuel Badikolu different DOB | MPI product decision only — **no new MatchType without approval** | Product |
| **P2** | Suggest empty for `Sam Badikolu` | Same substring semantics | suggest `[]` | Align with lookup decision if Directory ever adopts suggest | API |

### Per-fix detail (bounded slices — not authorized yet)

#### F1 — UAT evidentiary capture (P0, Process)

- **Change:** None to product code. Mandatory Network + MRN capture checklist.  
- **Remain unchanged:** Matcher, APIs, DB.  
- **Tests:** N/A.  
- **UAT:** Confirm with claimed fields; save check-duplicates body (redact PHI in logs); save create status/id/MRN; screenshot soft dialog if shown; search Badikolu / phone / MRN / Sam Badikolu separately.

#### F2 — Soft dialog only if HAR proves skip (P0, Frontend)

- **Files (candidates):** `AddPatientWizard.tsx`, `AddPatientDialog.tsx`, `registration-duplicate-check.ts`, `DuplicatePatientSoftMatchDialog.tsx`  
- **Change:** Only if proven response soft + dialog not shown — fix lifecycle/phase sync.  
- **Remain unchanged:** Matcher thresholds, PhoneMatch 0.90, ExactNameDOB skip soft.  
- **Tests:** Existing dup-c3 soft dialog suites + hosted dialog phase tests.  
- **UAT:** PhoneMatch path → Possible Duplicate Patient visible before create.

#### F3 — Name search tokenization / copy (P1, API and/or FE) — PRODUCT APPROVAL REQUIRED

- **Files (candidates):** `PatientLookupService.ApplySearchFilter`; optional Directory placeholder/empty hint  
- **Change options:** (a) tokenize `q` into AND/OR first/last tokens; (b) keep contract, improve copy (“try surname or MRN”); (c) both  
- **Remain unchanged:** Branch/tenant filters, census tabs, permissions, suggest ownership unless explicitly in scope  
- **Tests:** Lookup unit/integration for `Sam` / `Badikolu` / `Sam Badikolu` / `Samuel Badikolu` / phone / MRN  
- **UAT:** Samuel Badikolu findable via intended queries without widening branch

#### F4 — Handoff UAT completion (P1, Frontend)

- **Files:** already implemented — `created-patient-preview-handoff.ts`, `PatientHubPage.tsx`  
- **Change:** None until UAT fails with create id proven  
- **Remain unchanged:** Preview component, summary API, filters retention  
- **Tests:** existing handoff unit suite  
- **UAT:** unique create → Close → Preview exact id; with active non-matching `q`

#### F5 — Matching coverage (P2, Product)

- **Files:** none until decision  
- **Change:** Decide whether Sam/Samuel or surname+DOB become MatchTypes  
- **Remain unchanged:** Current 4-level certified matcher until approved  
- **Tests:** matcher suite expansion only after decision  
- **UAT:** MPI safety scenarios

---

## 17. Product decisions required

1. **Is `Sam Badikolu` vs `Samuel Badikolu` an intended duplicate candidate without shared phone?** Today: only if same DOB and fuzzy ≥0.80 (borderline 0.80 for those exact strings). Different DOB → no name rule.  
2. **Should Directory `q` tokenize multi-word names** so prefix first name + surname finds `Samuel Badikolu`?  
3. **Should soft PhoneMatch be more interruptive** (blocking continue until explicit acknowledgement metrics / UX)? Behavior already soft-reviews; UAT may have continued without recognizing it — or never hit it.  
4. **Is post-create Preview handoff sufficient** for “I can’t find them in the list under my current search,” or is additional Directory affordance required (without clearing `q`)?

---

## 18. Automated test gaps

| Gap | Suggested coverage (when implementation authorized) |
|---|---|
| Lookup `q=Sam Badikolu` vs stored `Samuel Badikolu` | Contract/regression once product decides tokenization |
| Registration soft UI when PhoneMatch-only | Already partially covered; add hosted-dialog Directory path assertion with fixture response |
| Handoff when `q` filters out created id | Exists in handoff tests; add e2e if flaky in UAT |
| End-to-end: check-duplicates PhoneMatch → soft → Continue → 201 → Preview | Playwright Directory journey (safe UAT data) |
| No Sam Badikolu row after failed create | Negative assertion helpers for forensics |

---

## 19. Manual UAT scenarios

| ID | Scenario | Expected |
|---|---|---|
| UAT-SB-01 | Confirm with **exact** claimed Sam/Badikolu/1987-08-01/8919653433 | Soft dialog with ≥1 PhoneMatch; do **not** create until Continue |
| UAT-SB-02 | Continue soft → create | 201; success MRN; `onCreated`; Close → Preview exact id |
| UAT-SB-03 | Search `Badikolu` | Samuel (and Sandeep) visible |
| UAT-SB-04 | Search `Sam Badikolu` | Document actual totalCount (today **0** for Samuel) |
| UAT-SB-05 | Search phone `8919653433` | 3 existing holders (before any new create) |
| UAT-SB-06 | Search `MRN-2026-10-7ABCD` | Samuel Badikolu |
| UAT-SB-07 | Re-register Samuel Badikolu exact | Soft skipped (ExactNameDOB); create hard-block 400 |
| UAT-SB-08 | Unique phone create | No soft; 201; Preview on Close; Directory find by MRN |
| UAT-SB-09 | Create with active unrelated `q` | Worklist may stay empty; Preview still opens by id |
| UAT-SB-10 | Capture HAR for any “no soft UI” claim | Attach check-duplicates response |

---

## 20. Explicit non-changes (this audit)

Did **not** change:

- `PatientDuplicateDetectionService`  
- Phone normalization / thresholds / MatchType / fuzzy / surname / DOB rules  
- Duplicate DTOs / dialogs  
- `POST /api/patients`, `POST …/registration/check-duplicates`  
- Lookup / suggest / summary APIs  
- Census predicates / search semantics / branch resolution / tenant filtering / permissions  
- Database schema / migrations / shared DB rows  
- Patient 360 / Preview implementation  

Did **not** create test patients.

---

## 21. Expected end-to-end contract (restated)

**Unique patient:** Directory → Add Patient → steps → Review → Confirm → check-duplicates (no blocking soft, or soft Continue) → `POST /patients` 201 → success/MRN/card → Close → Directory Preview by `patient.id`.

**Soft duplicate:** Confirm → check-duplicates → Possible Duplicate Patient → evidence → Continue / Dismiss / Review matching.

**Hard duplicate:** Confirm → check-duplicates may skip soft for ExactNameDOB → create authority hard-block → **no** create → **no** Preview.

---

## FINAL STATUS

**FORENSIC AUDIT COMPLETE — IMPLEMENTATION NOT AUTHORIZED**

**NEXT GATE:** Review the fix register and approve the bounded implementation slices.

**STOP**
