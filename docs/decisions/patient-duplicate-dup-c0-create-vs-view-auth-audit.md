# DUP-C.0 — Create vs View Authorization Gate Audit

**Status:** AUTHORIZATION AUDIT COMPLETE — IMPLEMENTATION NOT AUTHORIZED  
**Phase:** DUP-C.0  
**Recorded:** 2026-10-05  
**Scope:** Whether approved `patient.create` roles can call `POST /api/patients/check-duplicates` (`patient.view`) for the proposed DUP-C soft pre-check  

---

## 0. Hard constraints

This record is **audit only**. It does **not** authorize or perform:

- permission / role / catalog changes
- API / DTO / route / database / migration changes
- duplicate threshold or matcher changes
- AddPatientWizard / dialog / Directory / Patient 360 / Merge changes
- patient cleanup

Related:

| Document | Relevance |
|---|---|
| `docs/decisions/patient-create-role-grant-decision.md` | Phase 3O approved six `patient.create` roles; create does **not** imply view |
| `docs/decisions/patient-duplicate-soft-match-dup-c-decision.md` | PD-DUP-C-04 left create-vs-view gate OPEN |
| Migration `201_patient_create_role_grants.sql` | Stored `patient.create` links only |

---

## 1. Current `patient.create` grants (live DB + catalog)

### Catalog

| Code | Name | Module | Action | ResourceType | Scope | TenantId | Active |
|---|---|---|---|---|---|---|---|
| `patient.create` | Create Patients | patient | create | patient | branch | `00000000-…` (system) | yes |

Only **one** active catalog row observed for `patient.create`.

### Stored role_permission (approved roles)

| Role (NormalizedName) | Explicit `patient.create` |
|---|---|
| ADMIN | Yes (1 row) |
| COUNSELLOR | Yes (1 row) |
| RECEPTIONIST | Yes (1 row) |
| MEDICAL RECORDS OFFICER | Yes (1 row) |
| NURSE | Yes (1 row) |
| IP COORDINATOR | Yes (1 row) |

No other live roles currently hold `patient.create` in the inspected development database.

Seeder evidence: `PatientCreateRoleGrantCatalog` + `PermissionSeeder.SeedPatientCreateRoleGrantsAsync` + SQL `201`.

---

## 2. Current `patient.view` grants (approved six)

### Catalog

| Code | Name | Module | Action | ResourceType | Scope | TenantId | Active |
|---|---|---|---|---|---|---|---|
| `patient.view` | View Patients | (empty) | View | Patient | (empty) | `11111111-…` | yes |

Only **one** active catalog row observed for `patient.view` (different tenant id than `patient.create` row; grants still resolve by permission id).

### Stored role_permission (approved roles)

| Role | Explicit `patient.view` |
|---|---|
| ADMIN | Yes |
| COUNSELLOR | Yes (also seeded by counsellor workflow RBAC / migration 191) |
| RECEPTIONIST | **No** |
| MEDICAL RECORDS OFFICER | **No** |
| NURSE | **No** |
| IP COORDINATOR | **No** |

No alternate Receptionist/Nurse/MRO/IP Coordinator `patient.view` grants found under similar name patterns.

---

## 3. Exact six-role matrix

| Role | patient.create | patient.view | Grant type | Can use proposed DUP-C pre-check today? |
|---|---|---|---|---|
| ADMIN | Yes | Yes | Explicit stored grants | **Yes** |
| COUNSELLOR | Yes | Yes | Explicit stored grants | **Yes** |
| RECEPTIONIST | Yes | **No** | create explicit; view absent | **No** (403 on check-duplicates) |
| MEDICAL RECORDS OFFICER | Yes | **No** | create explicit; view absent | **No** |
| NURSE | Yes | **No** | create explicit; view absent | **No** |
| IP COORDINATOR | Yes | **No** | create explicit; view absent | **No** |

### Inheritance / wildcard

| Mechanism | Applies to these six? |
|---|---|
| Role hierarchy inheritance | **No** — `PermissionService.GetUserPermissionsAsync` loads only direct `RolePermissions`; no hierarchy tables present in this DB |
| Demo JWT `*` | Test/demo path only (`PermissionAuthorizationHandler` / `admin@test.com` temp override) — **not** a stored grant for operational roles |
| `patient.create` implies `patient.view` | **No** — exact code match only; Phase 3O explicitly rejects implication |

---

## 4. Controller authorization evidence

| Endpoint | Attribute | AuthN | Tenant | Branch |
|---|---|---|---|---|
| `POST /api/patients/check-duplicates` | `[RequirePermission("patient.view")]` | Required | JWT tenant used for matcher scope (`TenantId` claim read in action) | Matching is tenant-wide; branch not used in duplicate queries |
| `POST /api/patients` | `[RequirePermission("patient.create")]` | Required | JWT tenant + `ResolveEffectiveBranchAsync` | Branch authorized for create target |

**CODE FACT:** `patient.create` alone is **not** sufficient for check-duplicates anywhere in the controller attribute model.

Handler evidence: `PermissionAuthorizationHandler` succeeds on JWT claim `permission` exact match or `*`, else DB `HasPermissionAsync` exact code match.

---

## 5. Runtime authorization evidence

Existing tests:

- `PatientCreateRoleGrantTests` — create endpoint requires `patient.create`; JWT with only `patient.create` does **not** authorize `patient.view` requirement.
- `PatientDirectoryExportAuthorizationTests` — Lookup = `patient.view`, Create = `patient.create`.
- Counsellor catalog tests — counsellor baseline includes both view and create.

Live DB matrix above is the authoritative stored-grant evidence for the six approved roles.

---

## 6. Registration-entry-point impact

| Entry | Typical roles | Pre-check impact if DUP-C uses check-duplicates as-is |
|---|---|---|
| Patient Directory | Needs `patient.view` for page; Add uses `patient.create` | Users who can open Directory already have view; create-only users may still hit create if they navigate elsewhere |
| `/dashboard/patients/new` | All six create roles | **Blocked soft-check** for Receptionist / MRO / Nurse / IP Coordinator |
| Front Office | RECEPTIONIST | **Blocked** — New Patient button has no local `patient.view` gate |
| Counsellor waiting list | COUNSELLOR | OK (has both) |
| Appointment booking | NURSE, IP COORDINATOR (among others) | **Blocked** for those create-only roles |
| Admin patients | ADMIN | OK |

**Blocker is real for 4 of 6 approved create roles.**

---

## 7. PHI / security assessment

`check-duplicates` returns `PatientDuplicateMatch` including name, MRN, DOB, phone, email, MatchType, MatchConfidence, DifferenceReason.

| Question | Assessment |
|---|---|
| Does registration already need limited existing-patient identity? | Yes — hard-block 400 already returns the same match DTO to **`patient.create`** callers |
| Does granting full `patient.view` exceed soft-check need? | **Yes** — unlocks Directory lookup, many Patient read endpoints, favorites, summary surfaces gated by `patient.view` |
| Does create imply view today? | **No** (Phase 3O + runtime) |
| Soft-check PHI vs create 400 PHI | Same DTO family; soft-check would expose candidates **before** write for the soft band |

Granting `patient.view` to all six create roles is therefore a **broader access expansion**, not only a soft-check enablement.

---

## 8. OPTION A — Grant `patient.view` to all approved create roles

| Dimension | Assessment |
|---|---|
| Security / least privilege | Weaker — expands Directory/read surface for Receptionist, MRO, Nurse, IP Coordinator |
| PHI | Soft-check covered; also expands other view-gated PHI reads |
| Complexity | Lowest after approval (role_permission links like SQL 201) |
| Consistency | Best for DUP-C across all entry points |
| Maintainability | Simple mental model: registration staff can view patients |
| MPI extensibility | Good |
| Phase 3O tension | Conflicts with “create does not grant view” unless product revises that boundary for these six roles |

---

## 9. OPTION B — Create-scoped duplicate-check permission/endpoint

| Dimension | Assessment |
|---|---|
| Security / least privilege | Strongest — scopes soft-check to registration without full Directory/`patient.view` |
| PHI | Can return min safe fields (name/MRN/DOB/MatchType) |
| Complexity | Higher (API and/or catalog + FE client path) |
| Consistency | Good if all create roles authorized |
| Maintainability | Extra permission/endpoint to keep in sync |
| “New permission for convenience” | Not mere convenience if goal is preserve Phase 3O boundary |

Smallest B variant (if later approved): authorize existing `check-duplicates` for `patient.create` **or** `patient.view` without a new catalog code — still an API authorization change.

---

## 10. OPTION C — Soft-check only when user has `patient.view`

| Dimension | Assessment |
|---|---|
| Security | Preserves current grants |
| Consistency | **Fails** DUP-C requirement — Receptionist/Nurse/IP/MRO silently skip soft review |
| Usability | Uneven duplicate prevention by role |
| Maintainability | Hidden behavior differences |
| Recommendation fitness | Poor for canonical registration safety |

---

## 11. Recommended option

**Recommend OPTION A — ensure all six approved `patient.create` roles also have explicit stored `patient.view`.**

### Why

1. DUP-C must behave consistently across all registration entry points; OPTION C does not.
2. Do not invent a new permission only for convenience; OPTION A reuses the existing `patient.view` code already required by check-duplicates.
3. Registration duplicate review is identity discovery adjacent to Directory/`patient.view` semantics already used by Admin and Counsellor.
4. Create hard-block already returns match candidates to create-capable clients; soft pre-check is the same class of limited identity disclosure during registration.
5. Operational roles that register patients (especially Receptionist / Medical Records) typically need patient lookup; current create-without-view for four roles is already an awkward split.

### Product caveat (must approve)

OPTION A **revises** the Phase 3O statement that `patient.create` does not grant view, **for these six named roles only**, by adding explicit `patient.view` grants. It is not automatic inheritance.

If product instead prioritizes least privilege for Nurse / IP Coordinator (create without Directory), choose **OPTION B** before DUP-C implementation.

---

## 12. Exact changes required AFTER approval (not authorized now)

If OPTION A approved:

1. Decision record update (Phase 3O companion or DUP-C auth decision).
2. Idempotent migration/seeder: link existing `patient.view` to  
   `RECEPTIONIST`, `MEDICAL RECORDS OFFICER`, `NURSE`, `IP COORDINATOR`  
   (ADMIN/COUNSELLOR already linked).
3. Users re-login for JWT permission claims.
4. Authorization tests asserting all six create roles can authorize `patient.view`.
5. Then DUP-C frontend soft pre-check may proceed.

If OPTION B approved instead: API authorization design + optional response shaping + tests — larger than A.

---

## 13. DUP-C implementation dependency

| Question | Answer |
|---|---|
| Is the blocker resolved today? | **No** |
| Roles missing `patient.view` | RECEPTIONIST, MEDICAL RECORDS OFFICER, NURSE, IP COORDINATOR |
| Roles already OK | ADMIN, COUNSELLOR |
| DUP-C frontend-only pre-check safe for all create roles? | **Not until Option A or B is approved and implemented** |

---

## 14. Automated test recommendations (future)

1. Matrix test: each of six roles → `HasPermission("patient.create")` / `patient.view` expected outcomes.  
2. `CheckDuplicates` attribute remains `patient.view` until Option B changes it.  
3. Integration: create-only role receives 403 on check-duplicates today; after Option A, 200.  
4. Regression: create endpoint still requires only `patient.create`.  
5. JWT claim refresh / re-login note in UAT.

---

## 15. Manual UAT implications

After any approved grant change: log in as Receptionist, Nurse, IP Coordinator, MRO — confirm Directory/lookup access expectations and that check-duplicates succeeds before enabling DUP-C soft dialog UAT.

---

## 16. Out of scope

- Implementing Option A/B/C  
- DUP-C soft dialog  
- Threshold/matcher changes  
- Merge / Create Anyway  
- Database cleanup  
- Granting `patient.view` to non-approved create roles  
- Changing demo `*` behavior  

---

## FINAL STATUS

**AUTHORIZATION AUDIT COMPLETE — IMPLEMENTATION NOT AUTHORIZED**

**OPTION A is NOT already true.** Four approved create roles lack `patient.view`.
