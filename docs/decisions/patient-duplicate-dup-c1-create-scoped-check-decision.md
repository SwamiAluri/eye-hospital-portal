# DUP-C.1 — Create-Scoped Duplicate Check Decision (PD-DUP-C-04)

**Status:** DUP-C.1 DECISION COMPLETE — IMPLEMENTATION NOT AUTHORIZED  
**Decision ID:** PD-DUP-C-04  
**Recorded:** 2026-10-05  
**Phase:** Patient Directory → Duplicate Prevention → DUP-C  

---

## 1. Current security boundary (APPROVED / EXISTING)

| Rule | Status |
|---|---|
| `patient.create` ≠ `patient.view` | Phase 3O — preserved |
| Six approved create roles | ADMIN, COUNSELLOR, RECEPTIONIST, MEDICAL RECORDS OFFICER, NURSE, IP COORDINATOR |
| Stored `patient.view` among those six | ADMIN, COUNSELLOR only (DUP-C.0) |
| `POST /api/patients` | `[RequirePermission("patient.create")]` |
| `POST /api/patients/check-duplicates` | `[RequirePermission("patient.view")]` |
| Matcher | `PatientDuplicateDetectionService.CheckDuplicatesAsync` — single SoT |
| Create hard-block ≥0.95 | Server 400 + full `PatientDuplicateMatch` list to create caller |
| Soft band 0.80–0.94 on create | Silent allow today (no wizard UI) |

**This decision does not change any grants, APIs, DTOs, or code.**

---

## 2. Problem statement

DUP-C requires a **pre-create** soft-match review for all six create roles, using the existing matcher.

The only public pre-check endpoint today requires `patient.view`. Four approved create roles lack that grant. Granting `patient.view` (Option A) would expand Directory / Patient-read access and weaken Phase 3O. Skipping soft-check for those roles (Option C) breaks registration consistency.

**Need:** create-scoped duplicate check that preserves `patient.create ≠ patient.view`.

---

## 3. Option A — Grant `patient.view` to missing create roles

| Dimension | Assessment |
|---|---|
| Least privilege | Weak — Directory, lookup, many `patient.view` reads open for Receptionist / MRO / Nurse / IP Coordinator |
| PHI | Broad beyond registration duplicate review |
| Consistency | Good for DUP-C |
| Complexity | Low (role_permission only) |
| Phase 3O | **Violates** create ≠ view for those roles |
| Directory / 360 | Expands access |

**Rejected for DUP-C** while Phase 3O boundary stands.

---

## 4. Option B — Create-scoped duplicate check (SELECTED)

| Dimension | Assessment |
|---|---|
| Least privilege | Strong — no new Directory/360 capability |
| PHI | Minimized response (below); smaller than current check-duplicates / create-400 payload |
| Consistency | All six create roles identical |
| Complexity | Moderate — new endpoint + slim DTO; **no new matcher**; **no new permission code** |
| Phase 3O | **Preserves** create ≠ view |
| Directory / 360 | Unchanged |

---

## 5. Option C — Soft-check only if `patient.view`

| Dimension | Assessment |
|---|---|
| Least privilege | Preserves grants |
| Consistency | **Fails** — four roles silently skip DUP-C |
| Phase 3O | Preserved |
| DUP-C product fit | Rejected |

---

## 6. Decision (PD-DUP-C-04)

| Field | Value |
|---|---|
| **Decision** | **OPTION B — Create-scoped duplicate check** |
| **Rationale** | Enables consistent DUP-C soft prevention for all six create roles without granting `patient.view`, without a second matcher, and without inventing a convenience permission. |
| **Preserves** | `patient.create ≠ patient.view` |
| **Implementation authorized?** | **NO** |

### Security impact
- No expansion of Directory / Patient 360 / lookup for create-only roles.
- Create-scoped callers receive **less** candidate PHI than today’s `check-duplicates` or create hard-block body.
- Existing `check-duplicates` remains view-gated for Patient 360 hint / administrative use.

### PHI impact
Wire response excludes phone, email, DifferenceReason, MatchConfidence. UI continues to show only approved identity + MatchType presentation.

### API impact (proposed for future DUP-C.2 — not authorized now)
See §7.

### Permission impact
- **No** new permission catalog code.
- **No** changes to `patient.create` or `patient.view` grants.
- New endpoint authorized solely with existing `patient.create`.

### Role impact
All six approved create roles get the same pre-check capability via `patient.create` already held.

### UX impact
Unblocks DUP-C.3 soft dialog for every canonical registration entry point. Hard-block DUP-B.2 unchanged. No Continue on ≥0.95. No Create Anyway / Override / Merge / Open Patient 360.

### Migration impact
None for DUP-C.1. Future DUP-C.2 may add API/DTO only (no patient data migration; no role_permission changes if Option B as specified).

### Testing / UAT impact
See §12–13. Deferred until implementation slices are authorized.

### Explicit non-goals
- Granting `patient.view` to additional roles  
- Changing thresholds / matcher / branch policy  
- Soft policy on update  
- Acknowledgement checkbox or durable audit event (v1)  
- Merge / Patient 360 / Directory redesign  
- Patient cleanup  

---

## 7. Exact API / permission architecture proposed

### Why not modify `POST /api/patients/check-duplicates` in place?

| Approach | Verdict |
|---|---|
| A. New permission on existing endpoint | Rejected — new catalog permission + grants; convenience IAM surface |
| C. Dual-auth / dual-response on existing endpoint | Rejected — easy to leak full DTO to create callers; couples 360 hint contract to registration |
| D. Existing pattern | Closest pattern: **CreatePatient already invokes `CheckDuplicatesAsync` under `patient.create`**. Pre-check should be the same engine exposed as a create-scoped read-before-write validation, not a view-scoped Directory tool |

### Selected shape (smallest secure)

**New endpoint** (name illustrative; finalize in DUP-C.2):

```
POST /api/patients/registration/check-duplicates
[RequirePermission("patient.create")]
```

| Concern | Design |
|---|---|
| Auth | `patient.create` only |
| Engine | Call existing `IPatientDuplicateDetectionService.CheckDuplicatesAsync` — **no second matcher** |
| Request | Reuse `DuplicateCheckRequest` fields (FirstName, LastName, DateOfBirth, ContactNumber, Email). `ExcludePatientId` unused for create |
| Tenant | JWT tenant — same as create |
| Branch | Do **not** add branch filter; preserve tenant-scoped matching |
| Soft-delete | Engine already excludes `DeletedAt != null` |
| Response | **New minimized DTO** (do not return `PatientDuplicateMatch` wire shape) |
| Existing endpoint | `POST /check-duplicates` stays `[RequirePermission("patient.view")]` and keeps current full `DuplicateCheckResult` for Patient 360 hint |

**Do not** authorize create on the existing full-PHI endpoint without response restriction.

---

## 8. Minimum safe response fields

### Proposed create-scoped candidate (wire)

| Field | Required | Notes |
|---|---|---|
| `id` | Yes | Internal navigation key only; not a Directory deep-link in soft dialog |
| `medicalRecordNumber` | Yes | |
| `firstName` / `lastName` | Yes | |
| `dateOfBirth` | Yes | |
| `gender` | Optional | **Not** on current `PatientDuplicateMatch`; may be projected from `Patient` when mapping create-scoped response, or omitted if unavailable |
| `matchType` | Yes | ExactNameDOB / PhoneMatch / EmailMatch / FuzzyNameDOB |

### Must not appear on wire

- `contactNumber` / `email`  
- `differenceReason`  
- `matchConfidence`  
- clinical / billing / counselling / insurance fields  
- algorithm / Levenshtein wording in messages  

### Envelope

| Field | Purpose |
|---|---|
| `isDuplicate` | Same semantic as engine (`≥ 0.80`) |
| `matches` / `candidates` | Minimized list, confidence order preserved from engine |
| `message` | Optional; must **not** include “Highest confidence: XX%” for registration UI |

Frontend soft-band detection uses `matchType` + server create hard-block remains authoritative for ≥0.95 (create still returns 400; wizard may skip soft dialog when highest match would hard-block, or show soft only when all returned minimized matches are soft — exact client rule in DUP-C.3).

---

## 9. Six-role behavior

| Role | patient.create | patient.view | Create-scoped pre-check | Soft DUP-C UX | Hard ≥0.95 |
|---|---|---|---|---|---|
| ADMIN | Yes | Yes | Yes via create endpoint | Same | DUP-B.2 |
| COUNSELLOR | Yes | Yes | Yes via create endpoint | Same | DUP-B.2 |
| RECEPTIONIST | Yes | No | Yes via create endpoint | Same | DUP-B.2 |
| MEDICAL RECORDS OFFICER | Yes | No | Yes via create endpoint | Same | DUP-B.2 |
| NURSE | Yes | No | Yes via create endpoint | Same | DUP-B.2 |
| IP COORDINATOR | Yes | No | Yes via create endpoint | Same | DUP-B.2 |

No role silently skips DUP-C.

---

## 10. Tenant / branch / PHI analysis

| Topic | Design |
|---|---|
| Tenant isolation | Engine filters `TenantId == JWT tenant` |
| Deleted patients | Excluded (`DeletedAt == null`) |
| Branch | Unchanged — tenant-wide matching; create still uses `ResolveEffectiveBranchAsync` for write target only |
| Auth before data | `[RequirePermission("patient.create")]` before engine / response |
| PHI minimization | Slim DTO; no phone/email/scores on wire |
| Cross-branch | Preserve current product policy (not newly restricted) |

---

## 11. Exact future implementation slices (not authorized now)

```
DUP-C.1  Authorization / API decision          ← THIS RECORD (done)
    ↓
DUP-C.2  Create-scoped duplicate check API
         - endpoint + minimized DTO
         - wire to CheckDuplicatesAsync
         - auth tests for create vs view
         - no FE soft dialog yet
    ↓
DUP-C.3  Soft-match dialog integration in AddPatientWizard
         - pre-create call to create-scoped endpoint
         - Possible matching patient UI
         - Back / Continue
         - preserve DUP-B.2 hard-block
    ↓
Automated tests
    ↓
Manual UAT
    ↓
Acceptance
```

Do not combine slices.

---

## 12. Test strategy (future)

**DUP-C.2**
- Endpoint requires `patient.create`; rejects without it  
- `patient.view`-only user cannot call create-scoped endpoint (unless also has create)  
- Existing `check-duplicates` still requires `patient.view`  
- Response omits phone/email/DifferenceReason/MatchConfidence  
- Engine thresholds unchanged (unit/integration against known MatchTypes)  
- Tenant isolation  

**DUP-C.3**
- Soft 0.80–0.94 → dialog; Continue → one create  
- ≥0.95 → DUP-B.2; no Continue  
- All entry points via shared wizard  
- No Create Anyway / Merge / Open 360  

---

## 13. UAT strategy (future)

After C.2+C.3: exercise Admin, Counsellor, Receptionist, MRO, Nurse, IP Coordinator — soft email/fuzzy path, hard phone/name+DOB path, unique create, confirm no Directory access gained for create-only roles.

---

## 14. Risks

| Risk | Mitigation |
|---|---|
| Accidental reuse of full `PatientDuplicateMatch` on create path | Dedicated DTO + tests for forbidden fields |
| Client soft-check bypass | Server ≥0.95 hard-block remains |
| Message field leaks confidence % | Sanitize create-scoped message or omit |
| Gender missing | Optional; UI already tolerates absence |
| Dual endpoints drift | Single engine SoT; thin controller mapping only |

---

## 15. Product decision summary

| ID | Decision |
|---|---|
| **PD-DUP-C-04** | **Approve Option B: create-scoped duplicate check under `patient.create`, minimized response, existing matcher. Do not grant `patient.view` to additional roles for DUP-C. Do not use Option C.** |

Related preserved decisions:
- PD-DUP-01 soft band → Option B review-before-create (soft-match product audit)  
- Phase 3O create ≠ view  
- DUP-B.2 hard-block UX  
- No checkbox / no durable ack audit in v1  

---

## 16. Authorization status

| Item | Status |
|---|---|
| DUP-C.1 decision record | Complete |
| Permission changes | **Not authorized** |
| API/DTO implementation | **Not authorized** |
| Frontend soft dialog | **Not authorized** |
| Next gate | Explicit authorization of **DUP-C.2** only |

---

## FINAL STATUS

**DUP-C.1 DECISION COMPLETE — IMPLEMENTATION NOT AUTHORIZED**
