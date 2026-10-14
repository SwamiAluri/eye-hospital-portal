# PATIENT DIRECTORY — DUP-C.3A  
# Patient Matching Safety & Normalization Forensic Audit

**Status:** AUDIT COMPLETE — IMPLEMENTATION NOT AUTHORIZED  
**Phase:** Patient Directory → Duplicate Prevention → DUP-C.3A  
**Recorded:** 2026-10-05  
**Scope:** Read-only forensic audit of why a UAT registration could create a patient that appeared to share surname, DOB, and phone with an existing patient; readiness for DUP-C.3 soft-match UX  
**Implementation:** NOT AUTHORIZED by this document  

---

## 0. Hard constraints of this record

This audit **does not**:

- implement DUP-C.3 soft-match UX  
- change duplicate thresholds or the matcher  
- change patient creation behavior, permissions, or roles  
- delete / merge / modify patients or database data  
- pollute the shared Azure PostgreSQL development database  

**Related records (preserve):**

| Document | Relevance |
|---|---|
| `docs/decisions/patient-duplicate-matching-audit.md` | Phase 3N.1 matcher baseline |
| `docs/decisions/patient-duplicate-soft-match-dup-c-decision.md` | DUP-C soft-band product decision |
| `docs/decisions/patient-duplicate-dup-c0-create-vs-view-auth-audit.md` | create ≠ view |
| `docs/decisions/patient-duplicate-dup-c1-create-scoped-check-decision.md` | PD-DUP-C-04 Option B |
| RegistrationDuplicateCheckTests + PatientsController | DUP-C.2 create-scoped endpoint facts |

**Reproduction method used:** code-path proof + in-memory matcher simulation matching `PatientDuplicateDetectionService` rules. **No new patients created. No shared-DB writes. No live Azure patient PHI queried** (specific UAT MRN pair was not supplied; if product needs DB-value proof for named UAT rows, provide MRNs for a separate read-only query approval).

---

## 1. Executive summary

**Verdict:** The create hard-block at `MatchConfidence >= 0.95` is intact. `PhoneMatch = 0.95` still hard-blocks when phone strings are **exactly equal**. The reported UAT case was **not** a hard-block defect.

The most probable root cause is a **false-negative** from the current matcher design:

1. Different first names → no `ExactNameDOB`  
2. Full-name Levenshtein similarity for names like “Sam Aluri” vs “Levin Aluri” ≈ **0.545** → below fuzzy ≥0.80 → no `FuzzyNameDOB`  
3. Phone compared with **exact string equality, no normalization** → `+91 98765 43210` ≠ `9876543210` → no `PhoneMatch`  
4. **No composite rule** for same DOB + same surname + same phone  
5. Soft-band matches are never surfaced on Create today (wizard does not call pre-check)

Therefore a registration that *looks* like the same family identity in the UI can create a new patient with **zero matcher hits**.

**Classification:** NOT a CRITICAL DUPLICATE PREVENTION DEFECT in the ≥0.95 gate.  
**Classification:** CRITICAL **MATCHING COVERAGE / NORMALIZATION GAP** for registration safety before DUP-C.3.

**NEXT GATE:** PRODUCT DECISION REVIEW  

---

## 2. Exact UAT scenario reconstruction

### 2.1 Observed UAT symptom (user report)

A newly created patient appeared to share with an existing patient:

- same / similar surname  
- same date of birth  
- same phone number  

### 2.2 Matcher-level reconstruction (code-proven)

| Observed UI similarity | Matcher input | Current outcome |
|---|---|---|
| Same surname (“Aluri”) | LastName alone is **never** a match key | No match from surname alone |
| Same DOB | DOB alone is **never** a match key; only with exact/fuzzy name | No match from DOB alone |
| Different first names (e.g. Sam vs Levin) | ExactNameDOB requires both FirstName + LastName case-insensitive equal | No ExactNameDOB |
| Sam Aluri vs Levin Aluri + same DOB | Fuzzy full-name similarity ≈ **0.5455** | No FuzzyNameDOB (< 0.80) |
| Phones look “the same” but differ by formatting | `ContactNumber == request.ContactNumber` (exact) | No PhoneMatch if formats differ |
| Phones identical as stored strings | PhoneMatch 0.95 | **Hard-block create (400)** |

**In-memory simulation (same rules as service):**

| Scenario | Matches | IsDuplicate | Hard-block |
|---|---|---|---|
| UAT-like: Levin Aluri + same DOB + phone `+91 98765 43210` vs existing Sam Aluri + `9876543210` | **none** | false | false → **create allowed** |
| Same pair with **identical** phone string `9876543210` | PhoneMatch 0.95 | true | **true → create blocked** |

### 2.3 What was not proven from shared DB

Without the specific UAT MRNs / stored `contact_number` values, this audit cannot assert which of the two phone cases occurred in Azure.  
**Code + simulation prove:** if create succeeded while phones *looked* the same, either (a) stored strings differed, or (b) phone was null/empty on one side, or (c) existing patient was soft-deleted / other tenant (excluded). Option (d) hard-block broken is **contradicted by current controller source**.

### 2.4 Preferred safe reproduction (done without DB pollution)

1. Use existing in-process fixtures / `RegistrationDuplicateCheckTests.Real_matcher_*` patterns  
2. Apply the four-level rules from `PatientDuplicateDetectionService`  
3. Confirm hard-block source still contains `MatchConfidence >= 0.95m`  
4. **Stop** — do not create additional duplicate patients  

---

## 3. Existing matcher flow

```
AddPatientWizard.handleSubmit
  → patientApi.create
  → POST /api/patients   [RequirePermission("patient.create")]
  → PatientsController.CreatePatient
  → PatientDuplicateDetectionService.CheckDuplicatesAsync
       Level 1 ExactNameDOB     → 1.00
       Level 2 PhoneMatch       → 0.95   (exact string)
       Level 3 EmailMatch       → 0.90   (case-insensitive)
       Level 4 FuzzyNameDOB     → similarity if ≥ 0.80
  → if any MatchConfidence >= 0.95 → HTTP 400 + full duplicates[]
  → else PatientService.CreatePatientAsync → 201
```

**Pre-create soft check (DUP-C.2, backend only today):**

```
POST /api/patients/registration/check-duplicates  [RequirePermission("patient.create")]
  → same CheckDuplicatesAsync
  → RegistrationDuplicateCheckMapper → minimized DTO
```

**Wizard does not call** `registration/check-duplicates` or `check-duplicates` before create (asserted by frontend tests).

**Single SoT:** `IPatientDuplicateDetectionService` / `PatientDuplicateDetectionService`.

---

## 4. Phone matching audit

| Stage | Behavior |
|---|---|
| Registration input | Wizard field `phone` → payload `contactNumber` (`AddPatientWizard` maps `contactNumber: cleanPayload.contactNumber \|\| cleanPayload.phone`) |
| Client validation | Optional; regex `/^\+?[\d\s()-]+$/` only — **no digit normalization** |
| DTO | `CreatePatientRequest.ContactNumber` / `DuplicateCheckRequest.ContactNumber` (`string?`, max 20) |
| DB column | `Patient.ContactNumber` → `contact_number` |
| Matcher compare | `p.ContactNumber == request.ContactNumber` — **exact, case-sensitive string equality** |
| Whitespace | **Not trimmed** for match (leading/trailing space ⇒ miss) |
| Country code | **Not stripped / not canonicalized** |
| Punctuation / spaces | **Not removed** |
| Null / empty | Phone level skipped if `string.IsNullOrWhiteSpace(request.ContactNumber)`; empty stored values do not match a non-empty request via Level 2 |
| Index | Migration `idx_patient_phone_duplicate_check` on `(tenant_id, contact_number)` where not deleted |

### Would these be the same phone today?

| A | B | Same under matcher? |
|---|---|---|
| `+91 98765 43210` | `9876543210` | **NO** |
| `+919876543210` | `9876543210` | **NO** |
| `98765 43210` | `9876543210` | **NO** |
| `9876543210` | `9876543210` | **YES** → PhoneMatch 0.95 → hard-block |

**Recommendation (not implemented):** product must decide phone normalization policy (E.164 / national digits-only / strip `+91`) **before** relying on soft-match UX alone — otherwise soft review will also miss format variants.

---

## 5. Name matching audit

| Attribute | Stored / captured | Used by matcher? |
|---|---|---|
| Title | Yes (CreatePatientRequest / Patient) | **NOT USED** |
| FirstName | Yes (required) | Exact (ToLower) + Fuzzy full name |
| MiddleName | Yes | **NOT USED** |
| LastName | Yes (required) | Exact (ToLower) + Fuzzy full name |
| Suffix | Not a first-class field found on CreatePatientRequest | N/A |

| Normalization | Behavior |
|---|---|
| Case | `ToLower()` on exact and fuzzy |
| Whitespace | Exact uses full field equality after ToLower (no Trim/collapse); fuzzy concatenates `"FirstName LastName"` then ToLower — extra internal spaces affect distance |
| Punctuation | No hyphen/apostrophe normalization (`John-Paul` vs `John Paul` → fuzzy sim ≈ 0.889 → **would match** if same DOB) |
| Fuzzy algorithm | Levenshtein on full name; similarity = `1 - distance/maxLength`; include if ≥ 0.80 |

### “Sam Aluri” vs “Levin Aluri” + same DOB

| Check | Result |
|---|---|
| ExactNameDOB | **No** (first names differ) |
| Fuzzy similarity | **0.5455** |
| FuzzyNameDOB | **No** (< 0.80) |
| Surname-only rule | **Does not exist** |

**Conclusion:** same surname + same DOB with dissimilar first names does **not** match today.

---

## 6. DOB audit

| Topic | Current behavior |
|---|---|
| Exact / fuzzy | `p.DateOfBirth.Date == request.DateOfBirth.Value.Date` |
| Date-only | Yes — `.Date` strips time |
| Timezone | Comparison uses DateTime `.Date` after model binding; UI sends `type="date"` `yyyy-MM-dd`. No separate timezone-normalized identity type |
| Null | Levels 1 and 4 **return early** if request DOB null; create DTO requires DOB |
| Age-derived DOB | Wizard “Enter Age Directly” sets approximate DOB = today − N years (month/day = today). **Can create false DOB equality or inequality** vs true calendar DOB |
| Exact equality | Required for ExactNameDOB and as blocking key for FuzzyNameDOB candidate set |

### Why DOB alone cannot safely identify a unique patient

DOB is a **weak quasi-identifier**. Legitimate distinct people share DOB:

- twins / multiples  
- siblings born on different years but registrars may err; more importantly many unrelated people share a calendar date  
- age-derived approximate DOBs cluster on “today − N years”

**This audit does NOT propose DOB uniqueness.** Matching on DOB alone would create catastrophic false positives.

---

## 7. Composite matching matrix

Derived from actual `PatientDuplicateDetectionService` + create gate. Registration UI surfaces matches **only** via DUP-B.2 hard-block dialog on create 400 today (not soft).

| Scenario | Current MatchType | Confidence | IsDuplicate | Create hard-block | Registration surfaces today |
|---|---|---|---|---|---|
| A. Exact name + DOB | ExactNameDOB | 1.00 | Yes | **Yes** | DUP-B.2 dialog |
| B. Same DOB + same surname (different first, low fuzzy) | — | — | No | No | None |
| C. Same DOB + same phone (exact phone string) | PhoneMatch | 0.95 | Yes | **Yes** | DUP-B.2 (phone type) |
| D. Same DOB + surname + phone (phone format differs) | — | — | No | No | None |
| D′. Same DOB + surname + phone (phone exact) | PhoneMatch | 0.95 | Yes | **Yes** | DUP-B.2 |
| E. Similar name + same DOB (e.g. Jon/John Smith) | FuzzyNameDOB | ~0.80–0.94 | Yes | No (unless ≥0.95) | **None** (silent create) |
| F. Same phone + different name (exact phone) | PhoneMatch | 0.95 | Yes | **Yes** | DUP-B.2 |
| G. Same email + different name | EmailMatch | 0.90 | Yes | **No** | None (silent create) |
| H. Same address + same DOB | — | — | No | No | Address **not in matcher** |
| I. Same gender + DOB | — | — | No | No | Gender **not in matcher** |
| J. Multiple attributes | Highest applicable level; earlier levels exclude ID from later levels | per type | if ≥0.80 | if any ≥0.95 | hard-block only |

---

## 8. Normalization matrix

| Field | Normalization today | False-negative examples |
|---|---|---|
| Phone | **None** | `+919876543210` vs `9876543210`; `+91 98765 43210` vs `9876543210` |
| Email | `ToLower()` only | Trailing space / alias `+tag` not normalized |
| First / last name | `ToLower()` only | Leading/trailing spaces; middle name ignored; nickname not handled |
| Address | N/A (not matched) | — |
| DOB | `.Date` | Age-approx DOB vs true DOB |

Conceptual evaluations requested:

| Pair | Current result |
|---|---|
| Phone `+919876543210` / `9876543210` / `+91 98765 43210` | All pairwise **non-equal** → no PhoneMatch |
| Name `John-Paul` / `John Paul` / `JOHN PAUL` (same DOB) | Case OK; hyphen vs space → fuzzy ~0.89 → FuzzyNameDOB if DOB matches |
| Email `User@example.com` / `user@example.com` | **Match** (EmailMatch 0.90) — soft allow on create |

---

## 9. Available matching attributes inventory

### CORE

| Field | Available in registration / DB | Used by matcher |
|---|---|---|
| First name | AVAILABLE | USED |
| Middle name | AVAILABLE | **NOT USED** |
| Last name | AVAILABLE | USED |
| DOB | AVAILABLE | USED (with name / fuzzy) |
| Gender | AVAILABLE | **NOT USED** (projected only on DUP-C.2 response) |
| Phone | AVAILABLE | USED (exact) |
| Email | AVAILABLE | USED (case-insensitive) |
| Address / structured address | AVAILABLE | **NOT USED** |

### ADDITIONAL

| Field | Available | Used by matcher |
|---|---|---|
| Health ID | AVAILABLE | **NOT USED** |
| Aadhaar / National ID / Passport / Driving license / IdProofType | AVAILABLE | **NOT USED** |
| Insurance / policy / group | AVAILABLE | **NOT USED** |
| Previous / maiden / preferred name | **NOT AVAILABLE** as dedicated fields | — |
| Guardian name/phone/email | AVAILABLE | **NOT USED** |
| Emergency contact | AVAILABLE | **NOT USED** |
| Title / photo | AVAILABLE | **NOT USED** |
| MRN | AVAILABLE (system-generated) | **NOT USED** as input |
| Branch | AVAILABLE | **NOT USED** (tenant-wide match) |
| Tenant | AVAILABLE | USED (scope) |
| Soft-delete (`DeletedAt`) | AVAILABLE | USED (excluded when not null) |

---

## 10. Hard-block verification

**Trace confirmed:**

`POST /api/patients` → `PatientsController.CreatePatient` → `CheckDuplicatesAsync` →  

```csharp
if (duplicateCheck.IsDuplicate && duplicateCheck.Matches.Any(m => m.MatchConfidence >= 0.95m))
    return BadRequest(... duplicates ...);
```

Also asserted by `RegistrationDuplicateCheckTests.Create_hard_block_source_still_checks_confidence_at_zero_point_nine_five`.

| Claim | Status |
|---|---|
| ≥0.95 still hard-blocks | **CONFIRMED** |
| PhoneMatch = 0.95 still prevents create when phones are equal per matcher | **CONFIRMED** |
| Hard-block broken | **NOT SUPPORTED** |

**Why the UAT case was likely not Exact PhoneMatch:** stored phone strings almost certainly differed under exact equality, and/or first-name difference prevented name+DOB paths, with **no composite DOB+surname+phone rule**.

---

## 11. DUP-C.2 verification

| Requirement | Evidence | Status |
|---|---|---|
| `POST /api/patients/registration/check-duplicates` | `PatientsController` HttpPost template | Present |
| Uses `patient.create` | `[RequirePermission("patient.create")]` | Confirmed |
| Same matcher | Calls `_duplicateDetectionService.CheckDuplicatesAsync` | Confirmed |
| No `patient.view` required | Separate from view-gated `check-duplicates` | Confirmed |
| No new permission | Reuses `patient.create` | Confirmed |
| No branch restriction | No BranchId filter in matcher / registration action | Confirmed (tenant-wide preserved) |
| Tenant restriction | JWT tenant via `TryGetTenantAndUser` | Confirmed |
| Soft-deleted excluded | `p.DeletedAt == null` in all levels | Confirmed |
| Minimized response | `RegistrationDuplicateCheckMapper` strips phone, email, DifferenceReason, MatchConfidence | Confirmed by unit tests |
| Frontend wired | Wizard / Directory tests assert **no** `check-duplicates` call | **Not wired** (correct for this gate) |

---

## 12. False-positive analysis

| Pattern | Why it fires | Risk |
|---|---|---|
| Shared family phone (exact string) | PhoneMatch 0.95 hard-blocks even if name/DOB differ | Blocks legitimate child/spouse registration |
| Shared family email | EmailMatch 0.90 IsDuplicate but create allowed today; under DUP-C.3 would soft-interrupt | Review friction / wrong-person suspicion |
| Common short names + same DOB near fuzzy threshold | FuzzyNameDOB | Soft false alarms if soft UX enabled |
| Exact name + DOB for twins with identical legal names | ExactNameDOB 1.00 hard-block | May need supervised identity workflow (product) |

AHIMA / ONC guidance: false positives (wrong-person link / overlay risk if auto-merged) are patient-safety critical; this system hard-blocks rather than auto-merges — safer posture, but family phone exactness is harsh.

---

## 13. False-negative analysis

| Pattern | Why it misses | Risk |
|---|---|---|
| Phone format variants | No phone normalization | **Primary UAT-class risk** |
| Same surname + DOB, different first names | No surname+DOB composite; fuzzy too low | Family / related / typo first-name misses |
| Same DOB + phone with format drift | No composite; phone miss | Same as UAT reconstruction |
| Email only | 0.90 soft allow, no create UI | Silent duplicate |
| Fuzzy 0.80–0.94 | Create allowed; no wizard soft UI | Silent duplicate |
| Government / Health ID equal | Not matched | High-value ID duplicates possible |
| Middle name / address / gender unused | Reduced signal | Missed multi-attribute matches |
| Age-derived DOB mismatch | Approximate DOB ≠ true DOB | Miss Exact/Fuzzy |

**UAT case aligns with false-negative class, not hard-block failure.**

---

## 14. Healthcare-standard comparison

Sources consulted (guidance, not mandates for numeric thresholds):

- ONC — Patient Identity and Patient Record Matching  
- ONC Patient Identification and Matching Final Report (2014)  
- ONC **2025 SAFER Guide — Patient Identification**  
- AHIMA — Best Practices for Patient Matching at Patient Registration  
- AHIMA — Managing Integrity of Patient Identity / MPI discrepancy research  

| Guidance theme | Current system | Gap |
|---|---|---|
| Multiple demographic identifiers | Uses name, DOB, phone, email only | Address, sex/gender, middle name, government IDs unused |
| Standardized demographic capture | Free-text phone; age-approx DOB shortcut | Weak capture standardization |
| Normalization | Email lowercasing only | Phone/name/address normalization absent |
| Human review for uncertain matches | Soft band silent on create; DUP-C.2 API ready, UX not wired | DUP-C.3 needed **after** product decisions |
| Prevent duplicates at registration | Hard-block ≥0.95 only | Probable matches not reviewed pre-create |
| EMPI / probabilistic multi-attribute | Deterministic 4-level + single fuzzy | Not full EMPI |
| Specific numeric thresholds | Not mandated by ONC/AHIMA as universal constants | Do **not** claim 0.80/0.95 are externally mandated |

**No external guideline found that mandates this product’s exact 0.80 / 0.95 cutovers.** Thresholds remain local product policy.

---

## 15. Product decision register

| ID | Topic | Why needed before / with DUP-C.3 |
|---|---|---|
| PD-C3A-01 | Phone normalization | Without it, soft review misses format variants (UAT class) |
| PD-C3A-02 | Email normalization beyond ToLower | Alias / whitespace policy |
| PD-C3A-03 | Name normalization (trim, collapse space, hyphen) | Reduce false negatives / noise |
| PD-C3A-04 | Composite matching (e.g. DOB+surname+phone) | Close surname+DOB+phone gap **without** DOB uniqueness |
| PD-C3A-05 | Address matching | AHIMA/ONC Level-1 demographics; currently unused |
| PD-C3A-06 | Shared family phone policy | Exact PhoneMatch hard-block vs soft review |
| PD-C3A-07 | Shared family email policy | Soft vs ignore |
| PD-C3A-08 | Twins / identical legal name + DOB | Hard-block exception workflow? (no Create Anyway today) |
| PD-C3A-09 | Same DOB + same surname treatment | Soft review vs ignore (twins/siblings) |
| PD-C3A-10 | Same DOB + same phone treatment | Today collapses to PhoneMatch if exact |
| PD-C3A-11 | Government / Health ID matching | High-confidence identity when present |
| PD-C3A-12 | Match confidence / hard / soft thresholds | Keep 0.80/0.95 or revise — needs explicit approval |
| PD-C3A-13 | Soft-review threshold & Continue rules | DUP-C soft dialog product (already partially decided in DUP-C docs) |
| PD-C3A-14 | Age-derived DOB at registration | Safety of approximate DOB for matching |

**This audit does not select options.**

---

## 16. Security / privacy findings

| ID | Finding | Severity |
|---|---|---|
| SEC-C3A-01 | Matcher logs FirstName, LastName, DOB (Information) and phone/email on match warnings | Medium — PHI in logs |
| SEC-C3A-02 | Create 400 returns full `PatientDuplicateMatch` including phone/email/DifferenceReason | Medium — intentional for create caller; minimize further only with product approval |
| SEC-C3A-03 | DUP-C.2 minimized DTO correctly strips phone/email/confidence/DifferenceReason | Positive |
| SEC-C3A-04 | Tenant scope preserved; branch not filtered | Privacy/product: cross-branch candidates visible to create roles |
| SEC-C3A-05 | Wizard `console.log` of saved patient data on success (may include phone) | Medium — client console PHI |
| SEC-C3A-06 | No shared-DB mutation performed in this audit | Positive |

---

## 17. Performance findings

| ID | Finding |
|---|---|
| PERF-C3A-01 | Fuzzy level loads **all** same-DOB patients for tenant into memory, then Levenshtein per row — unbounded |
| PERF-C3A-02 | No candidate cap |
| PERF-C3A-03 | Phone/email exact queries benefit from indexes (phone index exists in migration); fuzzy does not |
| PERF-C3A-04 | Adding soft pre-check (DUP-C.3) doubles matcher invocations per successful create path (pre-check + create) — acceptable if queries stay bounded |

---

## 18. DUP-C.3 blockers

| Blocker | Type | Notes |
|---|---|---|
| Phone normalization undecided | PRODUCT DECISION | Soft UX alone will **not** catch UAT-class format misses |
| Composite DOB+surname(+phone) undecided | PRODUCT DECISION | Current algorithm cannot express “family-looking” multi-attribute without new rules |
| Soft-band silent allow still true on create | PRODUCT / DUP-C.3 | Expected until soft UX authorized |
| Frontend not wired to registration/check-duplicates | DUP-C.3 | Backend DUP-C.2 ready |
| Shared family phone hard-block harshness | PRODUCT DECISION | Soft UX does not soften ≥0.95 |
| Government ID unused | PRODUCT DECISION / LATER | Optional high-signal attribute |
| Logging / console PHI | NOW (defect hygiene) | Fix before broader registration matching traffic |
| Matcher threshold changes | PRODUCT DECISION | Not authorized by this audit |

**Ready for soft-match UX plumbing?** Backend create-scoped check: **yes**.  
**Ready for safe soft-match *prevention outcomes* for the UAT class?** **No** — without phone normalization and/or composite rules, soft review will often show “no matches” for the unsafe case.

---

## 19. Registration success UX recommendation (AUDIT ONLY — do not implement)

### Current state (code)

- Shell remains full registration canvas: `h-[calc(100dvh-7.5rem)]` (page) / `h-full` (dialog)  
- Step indicator hides when `savedPatient` set  
- Success body is a small `max-w-md` centered block inside a tall `flex-1` scroll region → **large unused vertical space**  
- Shows: check icon, “Patient Registered Successfully”, **MRN only**, Print Registration Card, Close/Continue  
- Print opens **inline** `RegistrationCardPreview` in the same shell (not a second overlay / black backdrop)  
- Webcam capture still uses a separate `fixed inset-0 bg-black` modal — unrelated to success  

### Bounded recommendation (presentation only)

| Element | Recommendation |
|---|---|
| Layout | Compact completion panel (content-height), not empty full-wizard canvas |
| Identity | Show registered patient name + gender/DOB summary (non-PHI-noisy) |
| MRN | Keep prominent |
| Confirmation | Keep single success title |
| View / Print Registration Card | Keep existing inline card flow |
| Close | Keep existing Close/Continue / postMessage / returnTo |
| Overlays | **No** second overlay, **no** black backdrop, **no** duplicate modal |
| Business rules | **No** change |

**Do not implement in this slice.**

---

## 20. Required matching matrix (summary)

| Scenario | Current Result | Risk | Recommended Treatment |
|---|---|---|---|
| Exact name + DOB | ExactNameDOB 1.00 → hard-block | Low FN / twin FP | Keep hard-block; twins policy PRODUCT |
| Same DOB only | No match | High FP if blocked | Keep ignore — **never** DOB-unique |
| Same surname + DOB | No match (if fuzzy <0.80) | FN for related/typo | PRODUCT: soft review candidate |
| Same phone (exact) | PhoneMatch 0.95 → hard-block | Family phone FP | PRODUCT: family-phone policy |
| Same phone (format variant) | No match | **High FN (UAT)** | PRODUCT: normalize phone **NOW-class** |
| Same DOB + phone (exact) | PhoneMatch → hard-block | Same as phone | Keep / refine with family policy |
| Same DOB + surname + phone (formats differ) | No match | **High FN (UAT)** | PRODUCT: normalize + optional composite |
| Same email | EmailMatch 0.90 → create allowed | Silent dup | DUP-C.3 soft review |
| Similar name + DOB | FuzzyNameDOB 0.80–0.94 → create allowed | Silent dup | DUP-C.3 soft review |
| Same family phone | PhoneMatch hard-block | FP block | PRODUCT decision |
| Twins (different first names) | Usually no match | Correct allow | Keep allow; identical twins PRODUCT |
| Twins (identical name+DOB) | ExactNameDOB hard-block | Operational friction | PRODUCT supervised workflow |

---

## 21. Recommended implementation sequence

### NOW (before soft matching is trustworthy)

1. **Product decide phone normalization** (digits / E.164 / strip country) — code change only after approval  
2. Fix client `console.log` PHI on registration success  
3. Confirm UAT pair stored phone strings via **approved read-only** MRN query (optional proof)  
4. Do **not** ship DUP-C.3 UX assuming format-variant phones will appear  

### PRODUCT DECISION

- PD-C3A-01 … PD-C3A-14 (register above)  
- Especially: phone normalization, composite DOB+surname(+phone), family phone/email, twins, Health ID matching, soft/hard thresholds  

### DUP-C.3

- Wire Add Patient → `POST registration/check-duplicates` → soft-match review → Continue → `POST /api/patients`  
- Preserve ≥0.95 hard-block; no Create Anyway; minimized candidate fields  
- Compact success UX may be a parallel presentation slice (no business-rule change)  

### LATER

- Address / middle-name / probabilistic EMPI  
- Government ID matching with privacy controls  
- Fuzzy candidate bounding / indexing  
- Cross-org matching (out of scope)  

---

## 22. Final status

```
AUDIT COMPLETE — IMPLEMENTATION NOT AUTHORIZED

NEXT GATE:
PRODUCT DECISION REVIEW
```

- Do **NOT** implement DUP-C.3 in this gate.  
- Do **NOT** modify the matcher in this gate.  
- **STOP.**
