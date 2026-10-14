# DUP-C.3A.2 Match Evidence & Comparison UX Forensic Audit

**Status:** AUDIT COMPLETE — IMPLEMENTATION NOT AUTHORIZED  
**Phase:** Patient Directory → Duplicate Prevention → DUP-C3A.2  
**Recorded:** 2026-10-05  
**Scope:** Read-only forensic audit of why soft-review UI shows only `Match basis → Phone number` when additional identity attributes may also equal  
**Implementation:** NOT AUTHORIZED  

**Code basis:** Live repository after DUP-C3A.1 + DUP-C.3 (not prior audit documents alone).

---

## 0. Hard constraints of this record

This audit **does not**:

- change matcher rules, thresholds, MatchTypes, phone normalization  
- change DTOs, soft dialog, permissions, database, or patient data  
- invent client-side match evidence as a production fix  
- authorize implementation  

---

## 1. Executive summary

**Verdict:** The soft dialog shows only “Phone number” because **`MatchType` is a single highest-winning rule label**, not complete multi-attribute evidence — and the create-scoped DTO **intentionally discards** the only field-level comparison text the matcher already builds (`DifferenceReason`).

For the UAT-class case (same first name + same DOB + same normalized phone + different last name):

| Layer | What happens |
|---|---|
| ExactNameDOB | **Does not fire** (last name differs) |
| PhoneMatch | **Fires** → `MatchType=PhoneMatch`, confidence **0.90** |
| FuzzyNameDOB | **Skipped** for that patient id (already matched at phone level) |
| `GetDifferences` | Could list first/last/DOB/phone/email diffs **with raw values** |
| `RegistrationDuplicateCheckMapper` | **Strips** phone, email, confidence, **DifferenceReason** |
| Soft UI | Maps `PhoneMatch` → chip “Phone number” only |

**Where the fix belongs (recommendation, not implementation):**

| Layer | Role |
|---|---|
| Matcher evaluation | Already compares fields; **not** a threshold bug for this case |
| Backend candidate evidence | **Primary gap** — no safe structured matched/different attribute signals |
| Create-scoped DTO | **Must carry** safe evidence (or mapping cannot surface it) |
| Frontend presentation | **Secondary** — can only render what DTO provides; must not invent evidence |

**Classification:** Evidence-contract / UX gap — **not** a CRITICAL hard-block defect and **not** (by itself) a false PhoneMatch.

---

## 2. Screenshot finding

Observed soft dialog roughly:

- Title: Possible Duplicate Patient  
- Candidate: Samuel Aluri · MRN · DOB · age · gender  
- **Match basis:** Phone number  
- Explanation: Phone number matches an existing patient  

Missing for decision quality:

1. What the registrar entered (new registration)  
2. Attribute-level matches (first name, DOB, phone)  
3. Attribute-level differences (last name)  
4. Differentiation between multiple candidates with the same MatchType  

---

## 3. Current frontend flow

```
AddPatientWizard Create
  → patientApi.checkDuplicatesForRegistration
  → parseRegistrationDuplicateCheckResult
  → shouldShowSoftDuplicateReview
  → toSoftMatchCandidates(matches)   // only id, name, MRN, DOB, gender, matchType
  → DuplicatePatientSoftMatchDialog(candidates only)
  → resolveDuplicateMatchPresentation(matchType)
       PhoneMatch → matchedFields: ['Phone number']
```

**CODE FACTS:**

- Soft dialog receives **`candidates` only** — not current registration identity (`AddPatientWizard` does not pass form values into the dialog).  
- Presentation is **100% MatchType-driven** via `resolveDuplicateMatchPresentation`.  
- Frontend correctly **does not** re-run matching rules (aligned with server-SoT principle).  
- Consequence: with only `PhoneMatch`, UI **cannot** show first-name/DOB equality even if they are true in the form vs candidate name/DOB fields displayed.

---

## 4. Current backend flow

```
POST /api/patients/registration/check-duplicates  [patient.create]
  → CheckDuplicatesAsync
       L1 ExactNameDOB (1.00)
       L2 PhoneMatch (0.90) — normalized phone; skip ids already matched
       L3 EmailMatch (0.90) — skip already matched
       L4 FuzzyNameDOB (≥0.80) — same DOB only; skip already matched
  → order by MatchConfidence desc
  → RegistrationDuplicateCheckMapper.Map
       keep: Id, MRN, First/Last, DOB, Gender, MatchType
       drop: ContactNumber, Email, MatchConfidence, DifferenceReason
  → RegistrationDuplicateCheckResult
```

Create path still uses full `PatientDuplicateMatch` on hard-block 400 (includes DifferenceReason with possible PHI) — out of soft-dialog wire.

---

## 5. Current matcher evidence

### A. Does the matcher evaluate individual fields separately?

**Partially, for rule entry — not as retained evidence.**

| Check | Fields used |
|---|---|
| ExactNameDOB | normalized first **and** last + DOB.Date |
| PhoneMatch | normalized phone only |
| EmailMatch | email ToLower only |
| FuzzyNameDOB | full `"first last"` string + same DOB |
| `GetDifferences` | per-field equality for first, last, DOB, phone, email |

### B. Does it “know” first/last/DOB/phone/email equality?

**Transiently yes** inside `GetDifferences` and rule predicates.  
**Persistently as structured booleans: no.**

### C. Are signals discarded after MatchType selection?

**Yes for the create-scoped wire.**

- One `MatchType` string retained on `PatientDuplicateMatch`  
- Richer text in `DifferenceReason` (often includes **raw phone/email/name literals**)  
- Mapper **drops** `DifferenceReason` for registration soft-check (PHI safety)

### D. Is only one MatchType retained?

**Yes per candidate.** Levels exclude already-matched ids — a phone hit **prevents** a later FuzzyNameDOB row for the same patient even if DOB also matches.

### E. Is MatchType “highest-confidence reason” or “complete evidence”?

**Highest-winning rule / confidence label — not complete evidence.**

Example: PhoneMatch means “normalized phone equal (and not already ExactNameDOB).”  
It does **not** mean “only phone matched among all demographics.”

---

## 6. Exact reconstruction of screenshot scenario

**Safe in-memory reconstruction (no shared DB writes):**

| | Registration | Existing candidate |
|---|---|---|
| First name | Samuel | Samuel |
| Last name | Levin (differs) | Aluri |
| DOB | 1987-08-01 | 1987-08-01 |
| Phone | same normalized (e.g. `9876543210` vs `+91 98765 43210`) | same |

| Question | Answer |
|---|---|
| MatchType | **PhoneMatch** |
| Confidence | **0.90** |
| First name equal? | **Yes** (known only via GetDifferences / ad-hoc compare — not on soft DTO) |
| Last name equal? | **No** |
| DOB equal? | **Yes** |
| Phone equal (normalized)? | **Yes** (this is why PhoneMatch fires) |
| Available after mapper? | **Only MatchType=PhoneMatch** (+ candidate identity fields). Equality signals / DifferenceReason / confidence / phone **not** available |

**Why ExactNameDOB does not fire:** last name differs.  
**Why FuzzyNameDOB does not add a second row:** phone level already claimed the id; also full-name similarity ≈ **0.67** (`samuel levin` vs `samuel aluri`) &lt; 0.80 anyway.

**Soft UI outcome:** Match basis → Phone number. First-name and DOB equality are **invisible** even though candidate DOB and first name are displayed as identity text.

---

## 7. Multiple-candidate reconstruction

| | Candidate A | Candidate B |
|---|---|---|
| First name | Samuel (=) | Samuel (=) |
| Last name | Aluri (≠) | Aluri (≠) |
| DOB | same as registration | **different** |
| Phone | same normalized | same normalized |
| Engine MatchType | PhoneMatch 0.90 | PhoneMatch 0.90 |
| Soft UI | “Phone number” | “Phone number” |

**Why they look identical:** both collapse to the same MatchType presentation; DOB difference is only visible if the operator carefully compares the DOB line in identity text — **not** as explicit “DOB differs” evidence. Soft DTO has no structured `matchedAttributes` / `differentAttributes`.

---

## 8. DTO contract audit

### `RegistrationDuplicateCandidate` (current)

| Field | Present |
|---|---|
| Id | Yes |
| MedicalRecordNumber | Yes |
| FirstName / LastName | Yes |
| DateOfBirth | Yes |
| Gender | Yes (projected) |
| MatchType | Yes |

### Intentionally excluded (CODE FACT — mapper)

| Field | Excluded |
|---|---|
| ContactNumber / phone | Yes |
| Email | Yes |
| MatchConfidence | Yes |
| DifferenceReason | Yes |
| Clinical / billing / insurance / counselling | Yes (never on match DTO) |

### Can safe structured evidence be added without raw PHI?

**Yes, technically** — as **boolean / enum attribute signals** computed server-side from request + already-loaded candidate, e.g.:

- `matchedAttributes: ["FirstName","DateOfBirth","Phone"]`  
- `differentAttributes: ["LastName"]`  

without returning phone/email values, confidence, or Levenshtein distance.

**Not implemented. Not authorized by this audit.**

---

## 9. What information is currently lost

| Signal | Computed in engine? | On full `PatientDuplicateMatch`? | On create-scoped DTO? | Soft UI |
|---|---|---|---|---|
| Winning MatchType | Yes | Yes | Yes | Yes |
| MatchConfidence | Yes | Yes | **No** | No |
| Per-field equal/differ (structured) | Implicit only | Via prose DifferenceReason | **No** | No |
| DifferenceReason prose | Yes | Yes (may contain PHI) | **No** | No |
| New registration values | N/A | N/A | N/A | **Not passed to dialog** |
| Multiple MatchTypes per candidate | No (single winner) | No | No | No |

---

## 10. Security / PHI assessment

| Topic | Assessment |
|---|---|
| Soft DTO phone/email omission | Correct — preserve |
| DifferenceReason omission | Correct today — it embeds raw phone/email/name literals |
| Future structured signals | Safe **if** booleans/enums only; never raw telecom |
| Create-only roles | Still limited to create-scoped endpoint; do not expand to view-gated full DTO |
| Frontend inventing evidence by comparing form vs candidate fields | **Unsafe / non-authoritative** — DOB/name on candidate are visible, but phone equality cannot be proven client-side without phone on wire; would violate server-SoT principle |
| Masked phone of **new registration** only | Local form value; product may allow mask in “NEW REGISTRATION” panel without exposing existing patient’s phone |

---

## 11. Performance assessment

Structured evidence can be derived from **already-loaded** `DuplicateCheckRequest` + candidate `Patient` / match row at map time:

- **No extra DB round trip** required if computed in mapper/service after `CheckDuplicatesAsync`  
- Reuses existing phone normalizer  
- Does not change fuzzy candidate load (already done)  
- Ordering can remain confidence-desc; optional evidence-strength grouping is a **product** choice, not required for evidence emission  

---

## 12. UX gap analysis

| Dimension | Current | Gap vs decision-quality target |
|---|---|---|
| Hierarchy | Title → list → MatchType chips | No NEW vs EXISTING comparison |
| Match evidence | Single MatchType label | Incomplete; over-simplifies multi-attribute reality |
| Differences | Implicit in name/DOB text | Not explicit (“Last name differs”) |
| Multiple candidates | Same Match basis text | Hard to differentiate A vs B |
| Spacing / density | Compact hard-block-like | Acceptable shell; evidence content too thin |
| Footer | Back / Continue | OK — out of scope to change |
| Accessibility | Dialog title/description present | Evidence list would need clear non-button semantics |
| Design language | counselling-session Dialog | Preserve; avoid dense card wall |

Target (conceptual only — §11 of request): make identity decision obvious in seconds via NEW REGISTRATION + EXISTING PATIENT + MATCH REVIEW bullets.

---

## 13. Recommended target evidence contract

**Server-authored, PHI-minimized** (names illustrative — follow project casing):

```text
RegistrationDuplicateCandidate
  + matchedAttributes: string[]   // e.g. FirstName, LastName, DateOfBirth, Phone, Email
  + differentAttributes: string[] // subset of comparable fields that do not equal
```

Rules of thumb:

- Emit only for fields the matcher actually compared / can safely compare  
- Phone/Email: signal only (`Phone`, `Email`) — UI copy “Phone number matches” / “Email matches”  
- Never emit raw phone/email, confidence, Levenshtein, SQL  
- Keep `MatchType` as high-level winning reason  
- Compute in auth-service from request + candidate; frontend only renders  

**Not authorized here.**

---

## 14. Recommended target comparison UX

Conceptual (do not implement):

1. Dialog-level **NEW REGISTRATION** summary from wizard form (name, DOB; masked phone/email if approved)  
2. Per candidate **EXISTING PATIENT** identity (current fields)  
3. **MATCH REVIEW** from server `matchedAttributes` / `differentAttributes`  
4. Preserve Back / Continue; no Merge / Open 360 / Create Anyway  

Frontend must not invent match ticks by local comparison of telecom fields.

---

## 15. Product decision register

| ID | Decision | Notes |
|---|---|---|
| **PD-DUP-C3A2-01** | Expose structured matched/different attribute signals on create-scoped DTO? | Recommended **Yes** for evidence fidelity |
| **PD-DUP-C3A2-02** | Show current registration identity in soft dialog? | Recommended **Yes** (local form; optional mask) |
| **PD-DUP-C3A2-03** | Phone/email only as “matches” text (no values)? | Recommended **Yes** (preserve PHI posture) |
| **PD-DUP-C3A2-04** | Show DOB as matched attribute when equal? | Recommended **Yes** |
| **PD-DUP-C3A2-05** | Explicitly show different attributes? | Recommended **Yes** (e.g. last name) |
| **PD-DUP-C3A2-06** | Keep MatchType as high-level reason + detailed evidence underneath? | Recommended **Yes** |
| **PD-DUP-C3A2-07** | Rank/group candidates by evidence strength? | Optional; defer unless product wants — confidence already sorts engine list but is stripped on soft DTO |

No decisions selected in code by this audit.

---

## 16. Implementation slices (proposed sequence — not authorized)

| Slice | Content |
|---|---|
| **DUP-C3A.2a** | Product approve PD-DUP-C3A2-01…06 |
| **DUP-C3A.2b** | Backend: compute safe attribute signals; extend create-scoped DTO + mapper tests; **no** matcher threshold changes |
| **DUP-C3A.2c** | Frontend: render server evidence + optional NEW REGISTRATION panel; keep soft gate / hard-block unchanged |
| **DUP-C3A.2d** | Focused automated tests + manual UAT |

Do not combine with matcher rule changes or Health ID / EMPI work.

---

## 17. Automated test plan (future)

- First/last/DOB/phone/email match & differ signals  
- Normalized phone equal → Phone in matchedAttributes without leaking digits  
- Multiple candidates with different evidence sets  
- Mapper never emits phone/email/confidence/DifferenceReason  
- Soft gate / ExactNameDOB skip / hard-block unchanged  
- Soft dialog renders server evidence; no client invention  
- Mobile dialog + a11y names for match review list  

---

## 18. Manual UAT plan (future)

1. Same first + DOB + phone, different last → evidence shows three matches + last differs  
2. Same phone only, different name/DOB → phone match; name/DOB differ  
3. Two candidates same phone, different DOB → distinct evidence rows  
4. Confirm no raw phone/email in network response  
5. Create-only role still uses create-scoped endpoint  
6. Hard-block ExactNameDOB path unchanged  

---

## 19. Risks

| Risk | Severity |
|---|---|
| Operators Continue on family phone without seeing DOB/name context | Medium identity integrity |
| Frontend “fixes” by comparing form vs candidate locally | High — breaks SoT; cannot verify phone without PHI |
| Expanding DifferenceReason onto soft wire | High PHI leak |
| Treating this as matcher threshold bug and raising PhoneMatch again | High family-phone false hard-blocks (regresses C3A.1) |

**Separate note (not a defect to fix here):** Matcher does not emit multi-rule evidence per candidate by design; first winning level wins. That is an **evidence model** limitation, not a failed PhoneMatch.

---

## 20. Out-of-scope

- Matcher threshold / MatchType / normalization changes  
- Surname-only / DOB-only / Health ID / address / EMPI  
- Soft dialog implementation / DTO changes in this audit  
- Permissions, Merge, Directory/360 redesign  
- Database / patient data changes  

---

## 21. Final recommendation

1. Treat the UAT finding as an **evidence presentation + create-scoped contract gap**, not a soft-dialog chip bug alone.  
2. Keep MatchType as winning-reason; add **server-computed safe attribute signals**.  
3. Optionally show **NEW REGISTRATION** from wizard state (masked telecom).  
4. Do **not** have the frontend invent match ticks for phone/email.  
5. Proceed to **Product Decision Review** for PD-DUP-C3A2-01…07 before any code.

---

## FINAL STATUS

```
AUDIT COMPLETE — IMPLEMENTATION NOT AUTHORIZED

NEXT GATE:
Product Decision Review for DUP-C3A.2.
```

DO NOT CHANGE CODE.  
DO NOT CHANGE DTOs.  
DO NOT CHANGE MATCHER.  
DO NOT CHANGE DATABASE.  
DO NOT CHANGE PERMISSIONS.  
DO NOT CHANGE THE SOFT DIALOG.

**STOP.**
