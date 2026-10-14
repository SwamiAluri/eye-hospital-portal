# L-AUTH-01 — PRE-UAT Verification

**Date:** 2026-10-12  
**Slice:** L-AUTH-01 — Clinical Authorization  
**Authorization:** `PRODUCT_DECISIONS_CLOSED_L_AUTH_01_AUTHORIZED`  
**Implementation baseline:** `IMPLEMENTATION_CORRECTED_READY_FOR_RETEST`

---

## Gate purpose

PRE-UAT **evidence** gate only.

- Manual UAT was **not** re-executed as passed after the 404 correction  
- L-CRT-01 / Reporting / Amendments / Instrument / Runs-QC / Referral / Billing were **not** started  
- Product scope was **not** expanded beyond TechnicalVerified → ClinicallyAuthorized  
- Product stamp `PRODUCT_DECISIONS_CLOSED_L_AUTH_01_AUTHORIZED` was **not** changed  

---

## Manual UAT 404 defect (discovered) → correction

### Original symptom

On `/dashboard/lms/results/authorization`, opening a TechnicalVerified result and clicking **Clinical Authorization** showed:

`Request failed with status code 404`

Work queue, result detail, and TechnicalVerified eligibility UI loaded successfully. Failure occurred only on the authorize mutation.

### Root cause

**Stale LaboratoryApi Azure Functions host** serving `bin\output\LaboratoryApi.dll` that contained `LmsResultVerify` but **not** `LmsResultAuthorize`.

| Probe (before fix) | Result |
|---|---|
| `GET /api/lms/health` | 200 |
| `POST /api/lms/testing/results/{id}/verify` | **401** (route present) |
| `POST /api/lms/testing/results/{id}/authorize` | **404** (route missing on live host) |
| `GET /admin/functions` → `LmsResultAuthorize` | **false** |
| `bin\Debug\net8.0\LaboratoryApi.dll` | Had `LmsResultAuthorize` |
| `bin\output\LaboratoryApi.dll` (loaded by `func`) | Missing `LmsResultAuthorize` |

Frontend URL/method/base and source `TestingFunctions` route already matched the approved L-AUTH-01 contract. Same operational class as prior LMS Collection/Specimen stale-host 404s.

### Exact correction

1. Stopped stale `func` on `:7076`  
2. Rebuilt LaboratoryApi Debug  
3. Restarted `func start --port 7076` (Core Tools refreshed `bin\output`)  
4. Added FE + BE contract regression tests so authorize route cannot silently diverge from the FE client  

**No L-AUTH-01 business-rule, DTO, permission, role-grant, or lifecycle changes.**

### Route contract after correction

| Side | Value |
|---|---|
| HTTP method | `POST` |
| FE axios base | `NEXT_PUBLIC_LABORATORY_API_URL` = `http://localhost:7076/api` |
| FE path | `/lms/testing/results/{id}/authorize` (`authorizeLmsResult`) |
| Browser / final URL | `http://localhost:7076/api/lms/testing/results/{id}/authorize` |
| Backend function | `LmsResultAuthorize` |
| Backend route attribute | `lms/testing/results/{id:guid}/authorize` + `host.json` prefix `api` |

### Environment verification (after correction)

| Check | Result |
|---|---|
| Unauthenticated `POST …/authorize` | **401** (route present; not 404) |
| Unauthenticated `POST …/verify` | **401** |
| `admin/functions` lists `LmsResultAuthorize` | **true** |
| `invoke_url_template` | `…/api/lms/testing/results/{id:guid}/authorize` |
| `bin\output` contains authorize | **yes** |
| Real authorize mutation against UAT result | **NOT EXECUTED** (Manual UAT only) |

---

## Product boundary checklist

| Check | Result |
|---|---|
| Only TechnicalVerified → ClinicallyAuthorized | **PASS** (service + tests; unchanged by 404 fix) |
| No AuthorizationPending / Final / Released / Amended | **PASS** |
| No Critical / Reporting / Amendments UI or APIs | **PASS** |
| ClinicallyAuthorized ≠ Final / Released / patient-visible | **PASS** |

---

## Domain boundary checklist

| Check | Result |
|---|---|
| Order remains Submitted | **PASS** |
| OrderTest remains Ordered | **PASS** |
| CollectionTask / Specimen / Receiving / Barcode unchanged by authorize | **PASS** |
| Pathology not used as SoT | **PASS** |
| L-TST-01A / L-VER-01 regression | **PASS** (full LaboratoryApi.Tests **242/242**) |

---

## Security checklist

| Check | Result |
|---|---|
| Dedicated `lms.results.authorize` catalogued | **PASS** |
| No production role grants added by this correction | **PASS** |
| Verify/manage/result alone ≠ authorize authority | **PASS** |
| AuthService filtered permission + audit allowlist tests | **PASS** (3/3 via alternate `-o`) |

---

## Integrity checklist

| Check | Result |
|---|---|
| RowVersion 409 / idempotency / audit fail-closed | **PASS** (ResultAuthorizationServiceTests; unchanged) |
| Draft update after ClinicallyAuthorized → invalid_state | **PASS** |
| Same-person verifier may authorize | **PASS** |

---

## Automated evidence (re-run after 404 fix)

| Suite | Evidence |
|---|---|
| LaboratoryApi.Tests | **242 passed / 0 failed** (includes new `TestingAuthorizeRouteContractTests` ×2) |
| ResultAuthorizationServiceTests | **15 passed** (included) |
| FE `enterprise-lms-testing-ui.test.ts` | **6 passed** (includes authorize URL contract test) |
| AuthService Testing permission + Result audit allowlist | **3 passed** |

### Regression coverage added

- FE: Clinical Authorization composes `POST /api/lms/testing/results/{id}/authorize` without double `/api`; asserts `TestingFunctions` source route + `LmsResultAuthorize`  
- BE: `TestingAuthorizeRouteContractTests` asserts authorize + distinct verify routes in `TestingFunctions.cs`  
- BE: default Testing work queue excludes TechnicalVerified / ClinicallyAuthorized; Draft remains; authorization `resultStatus=TechnicalVerified` still works  
- FE: `testingWorkQueuePrimaryAction` — Edit draft only for Draft; Open result for TechnicalVerified; none for ClinicallyAuthorized  

---

## Post-UAT work-queue boundary correction (2026-10-12)

| Item | Detail |
|---|---|
| Symptom | `/dashboard/lms/testing` showed ClinicallyAuthorized (`LAB-20261011-000002`) with **Edit draft** |
| Root cause | Default `GET …/work-queue` had no Draft predicate; FE treated any `resultId` as Edit draft |
| BE fix | When `resultStatus` omitted: exclude any non-Draft Result (no Result or Draft only) |
| FE fix | Status-aware primary action; ClinicallyAuthorized never shows Edit draft |
| Auth page | Still uses `resultStatus=TechnicalVerified` — unaffected |
| UAT data | Do **not** reverse ClinicallyAuthorized on the UAT result |

### Retest checklist (Manual UAT — not executed here)

1. `/dashboard/lms/testing` does **not** list ClinicallyAuthorized `LAB-20261011-000002` as actionable work.  
2. TechnicalVerified rows do **not** appear on normal Testing queue.  
3. Draft / no-result rows still appear; Enter/Edit draft only for those.  
4. `/dashboard/lms/results/authorization` still lists TechnicalVerified (Open result).  
5. Authorized Result Detail remains read-only; no Final/Released/Reporting.  
6. Order Submitted · OrderTest Ordered · Specimen Received · barcode unchanged.  

---

## Remaining Manual UAT steps (operator)

1. Hard-refresh `/dashboard/lms/testing` and `/dashboard/lms/results/authorization` against restarted LaboratoryApi.  
2. Confirm work-queue boundary checklist above.  
3. Do not re-authorize the already ClinicallyAuthorized UAT result unless intentionally testing conflict/idempotency.  

**Manual UAT is NOT claimed passed by this document.**

---

## Final PRE-UAT status

# IMPLEMENTATION_CORRECTED_READY_FOR_RETEST

Automated suites green; LaboratoryApi restarted with Draft-default work queue.  
Manual UAT retest is the next gate before L-AUTH-01 acceptance.
