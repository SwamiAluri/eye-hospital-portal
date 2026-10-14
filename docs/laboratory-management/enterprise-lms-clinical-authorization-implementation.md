# L-AUTH-01 — Clinical Authorization  
# Implementation Report

**Date:** 2026-10-12  
**Authorization:** `PRODUCT_DECISIONS_CLOSED_L_AUTH_01_AUTHORIZED`  
**Decision closure:** [enterprise-lms-clinical-authorization-decision-closure.md](./enterprise-lms-clinical-authorization-decision-closure.md)  
**Slice:** L-AUTH-01 only  

---

## 1. Implementation summary

Implemented Clinical Authorization for LMS Results in LaboratoryApi + LMS FE.

- Result status transition: **TechnicalVerified → ClinicallyAuthorized** only  
- Authorization metadata on `LmsResult`: authorizer, authorized-at UTC, authorized version number  
- Append-only `LmsResultVersion` history preserved (not rewritten)  
- Eligibility reuses L-TST-01A Testing eligibility + TechnicalVerified status + version bind  
- Permission catalog `lms.results.authorize` (**no role grants**)  
- Audit action `AUTHORIZE_RESULT` (fail-closed)  
- Idempotency operation `authorize_result`  
- Optimistic concurrency via `ExpectedRowVersion` → `409 concurrency_conflict`  
- Draft update blocked after ClinicallyAuthorized  
- UI: Clinical Authorization action on Result detail; `/dashboard/lms/results/authorization` reuses Testing Work Queue with `resultStatus=TechnicalVerified`  

**Not implemented:** Final/release, Reporting, Critical (L-CRT-01), Amendments, Instrument/Runs/QC, Pathology reuse, OrderTest lifecycle mutation, production role grants, signatory matrix, `AuthorizationPending`.

---

## 2. Files changed (primary)

**Backend LaboratoryApi**

- `Domain/ResultEnums.cs`, `LmsResult.cs`  
- `Services/ResultService.cs`, `ResultDtos.cs`, `LaboratoryAuthz.cs`  
- `Functions/TestingFunctions.cs`  
- `Data/LaboratoryDbContext.cs`  
- `Migrations/20261012110000_AddLmsResultClinicalAuthorization.cs`  
- `Migrations/LaboratoryDbContextModelSnapshot.cs`  
- `LaboratoryApi.Tests/ResultAuthorizationServiceTests.cs` (new)  
- `LaboratoryApi.Tests/LaboratoryDbContextShellTests.cs` (entity count refresh)

**AuthService**

- `SeedData/EnterpriseLmsTestingPermissionCatalog.cs`  
- `Controllers/InternalAuditController.cs`  
- Tests: `EnterpriseLmsTestingPermissionTests.cs`, `InternalAuditControllerTests.cs`

**Frontend**

- `lib/lms/lms-permissions.ts`, `lms-testing.api.ts`, `lms-capability-registry.ts`  
- `components/lms/testing/ResultDraftEntry.tsx`, `TestingWorkbench.tsx`  
- `app/dashboard/lms/results/authorization/page.tsx`  
- `app/dashboard/lms/testing/enterprise-lms-testing-ui.test.ts`

**Docs**

- This report + PRE-UAT verification  

---

## 3. Schema / migration

Migration: `20261012110000_AddLmsResultClinicalAuthorization`

| Table | Change |
|---|---|
| `lms_results` | Add `authorized_by_user_id` (uuid nullable) |
| `lms_results` | Add `authorized_at_utc` (timestamptz nullable) |
| `lms_results` | Add `authorized_version_number` (int nullable) |

Status remains string column; `ClinicallyAuthorized` is a status value (no enum table).  
No CollectionTask / Specimen / Order / OrderTest / Barcode table changes.

---

## 4. API endpoints

| Method | Route | Permission |
|---|---|---|
| POST | `/api/lms/testing/results/{id}/authorize` | `lms.results.authorize` |
| GET | `/api/lms/testing/work-queue` | view \| manage \| result \| verify \| **authorize** (added) |
| GET | work-items / results/{id} | view \| manage \| result \| verify \| **authorize** (added) |

Work queue optional query: `resultStatus=TechnicalVerified` (Authorization surface).

Authorize body: `operatingBranchId`, `expectedRowVersion`, optional `expectedCurrentVersionNumber`, optional idempotency key.  
Server owns `AuthorizedByUserId`, `AuthorizedAtUtc`, `AuthorizedVersionNumber`, status.

### Runtime route / client contract (authoritative)

| Layer | Contract |
|---|---|
| Azure Function | `LmsResultAuthorize` · `POST` · `Route = "lms/testing/results/{id:guid}/authorize"` |
| `host.json` | `extensions.http.routePrefix = "api"` → public URL `/api/lms/testing/results/{id}/authorize` |
| FE base | `NEXT_PUBLIC_LABORATORY_API_URL` default `http://localhost:7076/api` |
| FE path | `authorizeLmsResult` → `POST /lms/testing/results/${resultId}/authorize` (no second `/api`) |
| Final URL | `http://localhost:7076/api/lms/testing/results/{id}/authorize` |

**Manual UAT 404 note (2026-10-12):** FE and source/Debug DLL already matched this contract. The live `func` host on `:7076` was loading a stale `bin\output\LaboratoryApi.dll` that registered `LmsResultVerify` but **not** `LmsResultAuthorize`. Correction was rebuild + restart so `bin\output` includes authorize. No second authorize endpoint was added; business rules unchanged.

---

## 5. State / versioning / eligibility

| Topic | Behavior |
|---|---|
| Transition | TechnicalVerified → ClinicallyAuthorized only |
| Metadata | `AuthorizedByUserId`, `AuthorizedAtUtc`, `AuthorizedVersionNumber` (= current = verified version) |
| Versions | Historical ResultVersion rows immutable |
| Fail-closed | CurrentVersion ≠ VerifiedVersion → `version_conflict` |
| Same-person | Verifier may authorize (no mandatory dual control) |
| Clinical interpretation | Not calculated; structural eligibility only |
| Catalogue `authorization_required` | Not used as skip/auto-complete |

---

## 6. Permissions

| Code | Seeded | Role grants |
|---|---|---|
| `lms.results.authorize` | Yes (catalog) | **None** |
| Existing view/manage/result/verify | Unchanged | **None** |

Authority gate: authenticated user + `lms.results.authorize` + tenant + authorized operating branch.  
Not full PRD-RES-03 signatory matrix.

---

## 7. Audit / idempotency / concurrency

| Concern | Detail |
|---|---|
| Audit | `AUTHORIZE_RESULT` on `LmsResult`; fail-closed revert to TechnicalVerified |
| Idempotency | `authorize_result`; same key+hash replay; hash conflict → 409 |
| Concurrency | Stale RowVersion → 409; already authorized → 409 `already_authorized` |

---

## 8. UI

- Result detail: Clinical Authorization button when TechnicalVerified + `lms.results.authorize`  
- After authorize: status banner, authorizer/timestamp/version; honesty copy (not Final/Released/patient-visible); draft inputs remain disabled  
- `/dashboard/lms/results/authorization`: Testing Work Queue filtered to TechnicalVerified Results  
- No Release / Publish / Finalize / Critical / Amend controls  
- No fake authorization KPIs  

### Post-UAT work-queue boundary (2026-10-12)

**UAT finding:** After Clinical Authorization succeeded, `/dashboard/lms/testing` still listed the ClinicallyAuthorized result with **Edit draft**.

**Root cause:** `ListWorkQueueAsync` only applied `ResultStatus` when the query supplied it. The default Testing page omitted the filter, so any eligible OrderTest/Specimen (including TechnicalVerified / ClinicallyAuthorized) was returned. FE labeled any `resultId` as **Edit draft**.

**Correction:**

| Layer | Behavior |
|---|---|
| Backend default (no `resultStatus`) | Actionable Testing work only: **no Result yet, or `Status == Draft`**. Non-Draft statuses excluded via existing status predicate. |
| Explicit `resultStatus=TechnicalVerified` | Unchanged — Authorization page still lists TechnicalVerified rows. |
| Explicit `resultStatus=Draft` | Unchanged — Verification page. |
| FE primary action | **Enter draft** / **Edit draft** only for none/Draft; TechnicalVerified → **Open result**; ClinicallyAuthorized → no draft action |

Authorize mutation, permissions, and L-AUTH-01 transition rules unchanged. No role grants.

---

## 9. Automated tests (executed 2026-10-12; re-run after work-queue boundary fix)

| Suite | Passed | Failed | Total |
|---|---:|---:|---:|
| Full `LaboratoryApi.Tests` | 246 | 0 | 246 |
| `ResultAuthorizationServiceTests` (incl. queue exclusions) | — | 0 | — |
| `ResultVerificationServiceTests` (incl. Draft-only default) | — | 0 | — |
| `TestingAuthorizeRouteContractTests` | 2 | 0 | 2 |
| FE `enterprise-lms-testing-ui.test.ts` | 7 | 0 | 7 |
| AuthService Testing permission + Result audit allowlist | 3 | 0 | 3 |

AuthService default `bin` was locked by a running AuthService process; filtered tests were executed successfully via alternate `-o` output path.

---

## 10. Explicit out-of-scope confirmation

Not started: L-CRT-01, Reporting/Final/Release, Amendments, Instrument/Runs/QC, Autoverification, Referral Results, Billing, Pathology migration, production role grants, OrderTest/Specimen/Collection/Receiving/Barcode lifecycle changes, signatory/discipline matrix, AuthorizationPending.

---

## 11. Manual UAT

Authorization mutation path was demonstrated in Manual UAT (TechnicalVerified → ClinicallyAuthorized).  
Work-queue boundary retest after this correction is **NOT claimed passed** here.

---

## 12. Status

`IMPLEMENTATION_CORRECTED_READY_FOR_RETEST`

See [enterprise-lms-clinical-authorization-pre-uat-verification.md](./enterprise-lms-clinical-authorization-pre-uat-verification.md).
