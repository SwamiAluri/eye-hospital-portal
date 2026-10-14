# L-COL-01B — Search + Ownership Implementation Report

**Date:** 2026-10-09  
**Slice:** L-COL-01B follow-up (search + ownership decisions)  
**Final gate status (implementation-era):** `IMPLEMENTATION_COMPLETE_READY_FOR_TARGETED_UAT`  
**Acceptance (2026-10-09):** **L-COL-01B ACCEPTED** — see [enterprise-lms-collection-task-acceptance-closure.md](./enterprise-lms-collection-task-acceptance-closure.md) and [enterprise-lms-collection-task-final-uat-audit.md](./enterprise-lms-collection-task-final-uat-audit.md).

Specimen / Receiving remain out of scope / not started.

---

## 1. Decision closure referenced

[enterprise-lms-collection-search-ownership-decision-closure.md](./enterprise-lms-collection-search-ownership-decision-closure.md)  
(`PRODUCT_DECISIONS_CLOSED_IMPLEMENTATION_READY`)

| Decision | Status | Implemented |
|---|---|---|
| PD-COL-OWN-01 | APPROVED | Yes — dual Assigned/Claimed display |
| PD-COL-OWN-02 | APPROVED | Yes — Claim/Assign matrix + 409 codes |
| PD-COL-OWN-03 | APPROVED | Yes — Release clears claim only (confirmed + tested) |
| PD-COL-OWN-04 | DEFERRED | No (out of scope) |
| PD-COL-OWN-05 | APPROVED | Yes — assignee must hold `lms.collection.collect` |
| PD-COL-SEARCH-01 | APPROVED | Yes — case-insensitive TaskNumber search |
| PD-COL-UX-01 | DEFERRED | No — raw GUID Assign retained |
| PD-COL-SPC-BOUND | UNCHANGED | No Specimen/Receiving |

---

## 2. Files changed

### LaboratoryApi

- `Services/CollectionService.cs` — search, Claim/Assign rules, assignee capability call
- `Services/PlatformReferenceClient.cs` — `ValidateUserWithPermissionAsync`
- `LaboratoryApi.Tests/CollectionServiceTests.cs` — search + ownership + eligibility tests

### AuthService

- `Controllers/InternalLmsReferenceController.cs` — optional `RequiredPermission` on validate-user via `IPermissionService.HasPermissionAsync`
- `AuthService.Tests/InternalLmsValidateUserPermissionTests.cs` *(new)*

### Frontend

- `components/lms/collection/CollectionWorkbench.tsx` — independent Assigned/Claimed columns
- `components/lms/collection/CollectionTaskDetailSheet.tsx` — Assigned above Claimed with test ids
- `app/dashboard/lms/collection/enterprise-lms-collection-ui.test.ts` — PD-COL-OWN-01 asserts

### Docs

- This report

**No migration. No schema change. No role grants. No new permission definitions.**

---

## 3. Search implementation (PD-COL-SEARCH-01)

```csharp
var s = query.Search.Trim().ToLower();
q = q.Where(t => t.TaskNumber.ToLower().Contains(s));
```

- Scope: **TaskNumber only** (Orders-aligned).
- Pagination / status / branch filters unchanged.
- No FE debounce / stale-response changes.

---

## 4. Ownership implementation (PD-COL-OWN-01)

- Backend: `AssignedToUserId` and `ClaimedByUserId` remain independent columns.
- FE worklist: two lines — `Assigned: …` / `Claimed: …` (or `—` / `Unclaimed`).
- FE detail: separate `collection-task-assigned` and `collection-task-claimed` fields.
- Display uses truncated GUID (no staff directory / name resolution in this slice).

---

## 5. Claim / Assign matrix enforcement (PD-COL-OWN-02)

| Rule | Enforcement |
|---|---|
| Unassigned + Unclaimed → Claim | Allowed for collector actor |
| Assigned A + Unclaimed → only A Claims | Others → **409** `claim_conflict` |
| Unassigned + Claimed A → Assign by other | **409** `assign_conflict` |
| Assigned A + Claimed A | Valid (claimer may Assign to self) |
| Assigned A + Claimed B | Unreachable via allowed APIs |
| Claim never changes AssignedTo | Claim mutates claim fields only |
| Assign never clears Claim | Assign mutates assign fields only |

Error codes reuse existing family: `claim_conflict`, `assign_conflict`, HTTP **409**.

---

## 6. Release behavior (PD-COL-OWN-03)

- Clears `ClaimedByUserId` / `ClaimedAt` only.
- Preserves `AssignedToUserId` / `AssignedAt`.
- Non-claimer → **403** `release_forbidden`.
- No forced release / manager takeover.

---

## 7. Assignee authorization (PD-COL-OWN-05)

1. LaboratoryApi `AssignAsync` calls `ValidateUserWithPermissionAsync(tenant, userId, "lms.collection.collect")`.
2. Auth `POST api/internal/lms/validate-user` accepts optional `requiredPermission`.
3. When set: after tenant + active + not soft-deleted checks, `HasPermissionAsync` (* or exact code).
4. Failures map to **400** with codes such as `user_lacks_permission`, `user_inactive`, `platform_not_found`.
5. Actor Assign still requires `lms.collection.manage` at the API Function layer (unchanged).
6. **No** new permission codes. **No** role grants.

---

## 8. FE ownership display

- Worklist ownership cell: dual lines (`data-testid="collection-ownership"`).
- Detail: Assigned then Claimed independently.
- Assign input remains raw User GUID placeholder.
- Search placeholder unchanged: “Search task number…”.

---

## 9. Concurrency behavior

- Existing `ExpectedRowVersion` + EF concurrency token preserved on Claim/Assign/Release.
- Ownership checks run on tracked entity before mutation under the same concurrency gate.
- Existing concurrent claim test retained (`claim_conflict` when second actor claims).
- Conflicting Assign while claimed blocked before write → cannot produce Assigned A + Claimed B via APIs.

---

## 10. Audit behavior

- Successful Claim / Assign / Release continue to write platform audit fail-closed (unchanged actions).
- Ownership-conflict **rejections** do not write mutation audits (no state change) — matches prior convention.
- No second audit mechanism; no new audit action names.

---

## 11. Tests with exact counts

| Suite | Result |
|---|---|
| `CollectionServiceTests` | **24** passed (includes prior + new search/ownership/eligibility) |
| Full `LaboratoryApi.Tests` | **104** passed |
| `InternalLmsValidateUserPermissionTests` | **6** passed |
| Auth filter (`InternalLmsValidateUserPermission` + `EnterpriseLmsCollectionPermission` + `InternalAuditController`) | **24** passed (alternate output path; AuthService process lock on default bin) |
| FE Collection + LMS regression (`src/app/dashboard/lms` + `src/lib/lms`) | **45** passed (7 files) |

---

## 12. Regression tests

| Area | Result |
|---|---|
| LaboratoryApi full suite (Orders/Catalogue/Collection/Pathology shells as included) | **104** passed |
| Auth Enterprise LMS Collection permission definitions + Internal Audit allowlist | Passed in filtered Auth run |
| FE Collection structural tests | **12** passed |

---

## 13. Scope-leakage verification

| Check | Result |
|---|---|
| Force reassign / leave / manager takeover | Not implemented |
| Staff picker / directory / search | Not implemented |
| Search expansion beyond TaskNumber | Not implemented |
| Debounce / stale-response FE | Not implemented |
| New permissions / role grants | Not added |
| Specimen / accession / barcode / label / receiving | Not implemented |
| Orders / Catalogue / Pathology domain changes | None |

---

## 14. Confirmation — no Specimen / Receiving

No Specimen tables, APIs, UI, accession, barcode, label, or Receiving workflows were added.

---

## 15. Confirmation — no role grants

No AuthService role→permission seeders or mappings changed to grant `lms.collection.collect`.

---

## 16. Confirmation — no new permission definitions

Existing codes only: `lms.collection.view` / `manage` / `collect`.

---

## 17. Confirmation — no staff picker

Raw User GUID Assign input retained (PD-COL-UX-01 deferred).

---

## 18. Known limitations

1. Ownership UI shows truncated user GUID, not resolved display names.
2. AuthService default `bin` build may fail while AuthService.exe is running; tests verified via `-o` alternate output + `UseAppHost=false`.
3. UAT still requires temporary grants of collection permissions (or `*`) — not production role seeding.
4. PD-COL-OWN-04 force reassign remains deferred.
5. Search debounce / stale-response hardening deferred.
6. PRD FILE GAP preserved where binary unavailable.

---

## 19. Manual UAT checklist (targeted)

Do **not** mark passed automatically.

1. Search exact case (`COL-…`)  
2. Search lowercase (`col-…`)  
3. Search mixed case  
4. Clear search restores full queue  
5. Unassigned + Unclaimed → Claim  
6. Assigned to self → Claim  
7. Assigned to another → Claim → **409**  
8. Unassigned + claimed by A → another user Assign → **409**  
9. Assigned A + Claimed A → **both visible** on worklist and detail  
10. Release → claim cleared, assignment retained  
11. Non-claimer Release rejected  
12. Eligible collector assignment  
13. Ineligible user (no collect) assignment rejected  
14. Inactive user assignment rejected  
15. Cross-tenant assignment rejected  
16. Concurrent Claim → only one succeeds  
17. Concurrent ownership mutation → no Assigned A + Claimed B  
18. Audit verification for successful Claim/Assign/Release  
19. Order remains Submitted  
20. OrderTest remains Ordered  
21. No Specimen created  
22. No accession/barcode/label created  
23. No Receiving created  
24. Pathology unchanged  

---

## FINAL STATUS

**Implementation-era gate:** `IMPLEMENTATION_COMPLETE_READY_FOR_TARGETED_UAT`  
**Post-UAT acceptance (2026-10-09):** **L-COL-01B ACCEPTED** — [acceptance closure](./enterprise-lms-collection-task-acceptance-closure.md).

**STOP.** Do not start Specimen or Receiving.
