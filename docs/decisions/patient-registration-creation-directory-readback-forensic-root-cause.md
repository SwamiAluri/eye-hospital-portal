# Add Patient — Creation / Directory Read-Back Forensic Investigation

**Date:** 2026-10-05  
**Gate:** FORENSIC INVESTIGATION FIRST — no speculative fix  
**IMPLEMENTATION STATUS:** BLOCKED — ROOT CAUSE NOT PROVEN  
**NEXT GATE:** FORENSIC REVIEW  
**STOP**

No backend / matcher / permission / census / schema / API-contract changes were made.  
No additional frontend “refresh” patch was applied in this investigation.

---

## Runtime probes executed

| Probe | Method | Result |
|---|---|---|
| API create (unique) | `POST /api/patients` as `admin@test.com` | **201** `id=02ff80d9-…` `MRN-2026-10-1BF17` `branchId=74c014cf-…` |
| DB row (API create) | read-only `patient` | **exists**, `deleted_at IS NULL`, tenant `155fe198-…`, branch `74c014cf-…` |
| Lookup MRN/name/phone | `GET /patients/lookup` | **returns same id** (totalCount=1 each) |
| Wrong branch | lookup with unauthorized branch | **403** (branch auth intact) |
| Wizard unique create | Browser Confirm & Create | check-duplicates **200** `isDuplicate=false`; create **201** `id=46dacc73-…` `MRN-2026-10-4CFA3` |
| Wizard success UI | Browser | **Patient Registered Successfully** + MRN shown |
| Immediate invalidation | XHR after create (dialog still open) | **GET lookup + GET stats** fired |
| Census tabs | Browser | All **272→273**, New **27→28** |
| DB row (wizard create) | read-only | **exists**, active, same tenant/branch |
| Lookup after wizard | MRN / name / phone | **same id** |
| UI search after API create | `q=MRN-2026-10-1BF17` | **Forensic183541 ProbeX** shown (1 of 1) |

Prior UAT-created rows from today (e.g. `MRN-2026-10-D5F70`) also exist in DB and appear in Directory.

---

## Forensic table (required before any fix)

| Layer | Result | Evidence |
|---|---|---|
| Confirm handler | PASS | Wizard Confirm reaches REVIEW handler; runtime Confirm clicked |
| Duplicate pre-check | PASS | Network `POST …/registration/check-duplicates` **200**, `isDuplicate=false`, `matchCount=0` |
| POST /api/patients | PASS | Network **201** (wizard + API) |
| Created patient.id | PASS | `46dacc73-68d2-4774-a875-27561d89e93c` (wizard); `02ff80d9-…` (API) |
| Created MRN | PASS | `MRN-2026-10-4CFA3` / `MRN-2026-10-1BF17` |
| DB row | PASS | `public.patient` row present |
| Tenant | PASS | `155fe198-6ae5-4a01-9254-ead5b427247e` (create context = DB) |
| Branch | PASS | `74c014cf-9570-4824-bdf9-b369ea11a8f4` (create = DB = Directory lookup) |
| deleted_at | PASS | NULL / active |
| Direct lookup | PASS | `/patients/lookup` returns created id |
| Name search | PASS | lookup + Directory `q` |
| MRN search | PASS | lookup + Directory `q` |
| Phone search | PASS | lookup `q` phone |
| onCreated callback | PASS | post-create lookup/stats XHR while dialog open (invalidate path executed) |
| Query invalidation | PASS | `patientLookupKeys.all` → active lookup+stats refetch observed |
| Fresh lookup request | PASS | Network GET lookup after create |
| UI rendering | PASS | Success MRN UI; Directory finds patient when searched |

---

## Case classification (A–F)

| Case | Meaning | Verdict |
|---|---|---|
| A | POST fails | **Disproven** (201 observed) |
| B | POST ok, DB missing | **Disproven** (row present) |
| C | DB ok, lookup misses | **Disproven** (lookup returns id) |
| D | Lookup returns, UI does not render | **Disproven** for search-by-MRN/name (UI shows row) |
| E | Lookup ok, search fails | **Disproven** (name/MRN/phone) |
| F | Outside tenant/branch scope | **Disproven** for India Eye / branch `74c014cf-…` |

**Previous CASE B (invalidate-only-on-Close) is not the proven cause of permanent non-discovery.**  
Even if invalidate lagged, a later Directory search/refresh would still call `/patients/lookup`. Runtime also shows invalidate **does** fire immediately after create.

---

## ROOT CAUSE

**Not proven as a create / persist / lookup / search defect.**

The unique-patient end-to-end chain was reproduced and passed at every layer:

Review → Confirm → check-duplicates (unique) → `POST /api/patients` 201 → DB row → invalidate → lookup/stats → Directory search by MRN/name/phone finds **the same `patient.id`**.

The reported UAT symptom (“created patient never appears / never searchable”) **could not be reproduced** in this environment with a unique identity.

### Observation (not declared root cause)

While Add Patient is open, Directory may still show a **prior active search** (`q=…`). Tab totals update, but the worklist remains filtered until search is cleared or retargeted. That can look like “count moved / list unchanged” if the operator does not search by the new MRN/name. This is existing filter semantics, not a failed create.

### Query-key check

`patientLookupKeys.all = ['patient-lookup']` prefixes `lookup` / `stats` / `suggest` keys. Runtime confirmed both lookup and stats refetch after create.

---

## Fix

**None in this slice.** Instructions forbid speculative frontend changes before a proven failure layer.

---

## Duplicate evidence (separate)

Not re-tested in this create forensic run. Existing soft-dialog still maps server `matchedAttributes` / `differentAttributes` only.  
**MPI PRODUCT DECISION REQUIRED** for surname-only / DOB-only / gender-only as new candidate-generating rules (not present today).

---

## Tests

No new code; no new automated suite run required for a non-fix investigation.  
Prior unfocused creation/evidence suites remain available; not re-claimed here as proof of the UAT failure mode.

---

## UAT

Manual browser proof for unique create/read-back: **executed and PASS** in this forensic session.  
Reported failure mode from prior UAT: **not reproduced**.

---

**IMPLEMENTATION STATUS: BLOCKED — ROOT CAUSE NOT PROVEN**  
**NEXT GATE: FORENSIC REVIEW**  
**STOP**
