# Patient 360 — Coverage / Financial / Insurance forensic audit

Document type: read-only forensic audit  
Date: 2026-09-29  
Application code changed: NO  
This audit does not implement Coverage, Financial, Insurance, CCMS, claims, pre-authorization, or documents.

Evidence is limited to files in this repository. A relationship is recorded only where a key or query exists. Naming similarity is not treated as a foreign key.

Authoritative product references used, not reopened:

- `docs/decisions/patient-360-product-decision-contract.md` — north star and PD-F / PD-H **APPROVED**; sections 5.1, 5.2, 7, and 8 are **Proposed decision for implementation**; PD360-R2 and PD360-R4 remain **DECISION REQUIRED** (contract lines 145–155, 209–235, 413–415, 408).
- `docs/design/patient-360-information-architecture.md` — Coverage is one section with two labeled stacks, Financial and Insurance (lines 93, 254–287).
- `docs/audits/patient-directory-master-forensic-redesign-audit.md` and the Patient 360 source-of-truth notes recorded in the decision contract.
- `.cursor/rules/09-coverage-claims-ux.mdc` — CCMS owns coverage workflow; Billing owns cash. They are not merged.
- `.cursor/rules/10-accessibility.mdc` — any later Coverage UI must use real headings, text status (not color alone), table headers, and keyboard access. This audit adds no UI.

Current Patient 360 Coverage UI is the not-integrated body for section key `coverage` (`apps/hospital-portal-web/src/lib/patients/patient-360-sections.ts`, `PatientRecordPage.tsx`). It was not changed.

---

## 1. Executive summary

Three different stores already exist. They are not one insurance record.

| Store | What it is | Patient-id GET today | Patient 360 readiness |
|---|---|---|---|
| `patient` insurance columns | Denormalized registration text copied onto the summary | Yes, inside `GET /api/patients/{id}/summary` | YELLOW. Profile text, not a claim file |
| `patient_insurance` | Patient-scoped policy rows. Also overwritten by a CCMS sync copy | `GET /api/patient-insurance/patient/{id}` | YELLOW. Read exists. Amounts and verify-status sit on `patient.view` |
| `ccms_coverage_cases` and children | Coverage case, authorization, claim packet, settlement, documents | No patient list. List filters state, payer type, and search. By-session lookup exists | RED for a patient chart until a patient-id read and PD360-R4 exist |
| `insurance_pre_authorizations` | Legacy counselling pre-auth. `patient_id` column exists | No patient-id list API. Census loads it by tenant and selected branch | YELLOW identity, RED as a Patient 360 list |
| `insurance_preauth_requests` | Newer session pre-auth requests | GET by session or schedule, not by patient | YELLOW |
| `opd_bills` | Cash ledger, including a journey bill when `patient_journey_id` is set | `GET /api/opdbills?patientId=` | YELLOW data, GRAY permission. The GET is `[Authorize]` only |
| `ip_billing_transactions` | Journey projection: Advance, Payment, Discount, Refund | No patient id | RED until a journey read is proven |

The next Coverage implementation must not start until PD360-R2 (which existing billing permission gates financial display) and PD360-R4 (which existing CCMS permission gates cases, claims, and CCMS documents) are approved. The contract forbids inventing a permission code and forbids a service-account read of CCMS.

Operational desks stay where they are: `src/components/ccms` and `/dashboard/ccms/*`, Billing, and the existing record tools disclosure (`BillingTab`, `InsuranceTab`). Patient 360 may only later show read-only context, and only for sources classified GREEN or YELLOW after those decisions.

---

## 2. Existing insurance sources

### 2.1 Patient registration columns

- Module: Patient / MPI.
- Owner: `patient` row in auth-service (`AuthService/Models/Domain/Patient.cs` lines 192–213): `insurance_provider`, `insurance_policy_number`, `insurance_group_number`, `insurance_valid_from`, `insurance_valid_to`, `insurance_status`.
- API: `GET /api/patients/{id}/summary` maps provider and policy number only (`PatientSummaryService.cs` lines 95–96). Group number, validity, and `insurance_status` are not on `PatientSummaryDto`.
- Permission: `patient.view` (`PatientsController.cs` line 462).
- Tenant: `p.TenantId == tenantId && p.DeletedAt == null`. The summary `branchId` query is not passed through `ResolveEffectiveBranchAsync` on this action (controller lines 461–469). Patient load does not filter `BranchId`.
- UI: `InsuranceTab` receives `summary.insuranceProvider` and `summary.insurancePolicyNumber` as `profileInsurance` (`PatientRecordTabContent.tsx` lines 113–120). Examination demographics also render those two fields (`PatientDemographicsSheet.tsx`).
- Authoritative for: registration text on the patient row.
- Not authoritative for: CCMS case, claim, or pre-auth.
- Class: operational registration data plus historical text. No separate history table was found for these columns.

### 2.2 `patient_insurance`

- Entity: `AuthService/Models/Domain/PatientInsurance.cs`, table `patient_insurance`.
- Controller: `PatientInsuranceController`, route `api/patient-insurance`.
- Client: `apps/hospital-portal-web/src/lib/api/patient-insurance.api.ts`.
- Patient key: `patient_id` (required Guid, FK to `Patient`).
- Tenant: `TenantId` on the row. `GetByPatient` filters `TenantId` and `PatientId`. It does not filter `DeletedAt` (`PatientInsuranceController.cs` lines 34–41).
- Branch: no branch column in the entity. Tenant only.
- Permission: GET `patient.view`. Create, update, delete, and `POST {id}/verify` use `patient.update` (same file).
- UI consumers: `InsuranceTab` (loads and can call `verify`), `InsuranceWidget`, `AlertBanner`. Patient 360 Coverage does not call this API. The live page still mounts `InsuranceTab` only inside “Existing record tools” (`PatientRecordPage.tsx` lines 427–455).
- Authoritative: yes, as the patient profile table. The CCMS comment on `POST /api/insurance/ccms/patient-insurance-sync` says CCMS is the source of record and this table is a convenience copy (`InsuranceController.cs` lines 420–425). The sync writes the primary row (`InsuranceWorkflowService.SyncPatientInsuranceFromCcmsAsync`).
- Fields present: provider name, policy number, group number, `policy_type` comment primary/secondary/tertiary, plan name, subscriber name, subscriber id, subscriber relation, start date, end date, copay, deductible, deductible met, out-of-pocket max and met, coverage details text, pre-auth required flag, pre-auth number text, contact phone, notes, status comment `active`, `inactive`, `expired`, `pending_verification`, created/updated timestamps, created/updated user ids, `deleted_at`.
- Fields absent: member number as its own column (subscriber id is the closest), insurance card file reference, document id.
- Safe Patient 360 candidate fields, after keeping the profile caption required by the IA: provider, policy type, policy number, group number, subscriber relation, start, end, status, timestamps. Amount columns are financial values on a `patient.view` read. Whether Patient 360 may show them is **DECISION REQUIRED** under section 5.1, not decided here.

### 2.3 Orphan client `insurancePoliciesApi`

`apps/hospital-portal-web/src/lib/api/billing.api.ts` `insurancePoliciesApi.list` calls `GET /patients/{patientId}/insurance-policies`. No matching controller route was found under `microservices`. Treat as a client with no confirmed server. Do not use it for Patient 360.

### 2.4 CCMS visit policies (case-scoped, syncs the profile)

`VisitPolicyFunctions` routes are under `ccms/coverage-cases/{caseId}/policies` and `ccms/sessions/{sessionId}/policies`. On set-primary they call `AuthServiceClient.SyncPatientInsuranceAsync` (fire-and-forget). Patient identity is on the coverage case, not on a patient-list route. See section 4.

### 2.5 Master payers

`ccms/master/insurance-providers`, TPA providers, government schemes, coverage packages. These are catalogs. They have no patient id. Not a Patient 360 source.

---

## 3. Existing financial sources

### 3.1 OPD bills (also the IP journey bill carrier)

- Entity: `OpdBill`, table `opd_bills` (`AuthService/Models/Domain/OpdBill.cs`).
- Keys: `patient_id` required, `tenant_id`, `branch_id` required, optional `appointment_id`, optional `patient_journey_id`. Comment on the journey column: “One bill per journey. PatientId is not the IP account key.”
- Amount fields on the entity include consultation fee, registration fee, additional charges, gross, discount, net, amount paid, balance due, plus insurance provider / policy number strings on the bill.
- Service read: `OpdBillService.GetByPatientIdAsync` filters `PatientId` and `DeletedAt == null`. It does not filter `TenantId` or `BranchId` (`OpdBillService.cs` lines 152–160).
- Controller: class `[Authorize]` only. `GET /api/opdbills` and `GET /api/opdbills/by-patient/{patientId}` have no method `RequirePermission`. `GET /api/opdbills/outstanding/{patientId}` computes outstanding on the server from balance due and stored status strings `Paid` and `Fully Paid` (`OpdBillsController.cs` lines 207–238).
- Mutations that do carry permissions: create and ensure-IP-bill `bill.create`; payment, cancel, finalize, and several updates `bill.update`; rules `bill.admin`. Payment: `POST /api/opdbills/payment` with `bill.update`.
- Client used by the record: `opdBillsApi.getByPatient` → `GET /opdbills` with `patientId` (`src/lib/api.ts` lines 97–101).
- UI: `BillingTab` renders bill number, date, totals, paid, balance, status, and a client-side outstanding sum (`BillingTab.tsx`). It does not post payments. `TimelineTab` also calls `opdBillsApi.getByPatient`. `BillingWidget` and `AlertBanner` call the same method. IP dashboard `GET opdbills/ip-dashboard` is branch-scoped, not patient-scoped.
- Refunds: no `refund` action was found on `OpdBillsController`. IP refund type lives on `ip_billing_transactions.transaction_type` (`Refund`), not as an OPD patient refund route.
- Class: operational ledger. Historical rows remain while `deleted_at` is null.

### 3.2 Payments

`OpdBillPayment` is a child of a bill, loaded with the bill (`Include Payments` on some by-appointment reads). There is no patient-id payment list. `opdBillsApi.addPayment` is the cashier write. Patient 360 must not call it (contract section 7).

### 3.3 Outstanding balance

`GET /api/opdbills/outstanding/{patientId}` is a derived read of unpaid `opd_bills` for that patient id. Same authorization as the bill list: authenticated, no `bill.*` permission. `BillingTab` does not call this route. It sums the page it loaded (page size 50). Those two balances can differ. Do not pick a new outstanding definition in Patient 360.

### 3.4 IP transactions

- Entity: `IpManagementService/Models/Domain/IpBillingTransaction.cs`, table `ip_billing_transactions`.
- Keys: `tenant_id`, `branch_id`, `patient_journey_id`. No `patient_id`.
- Types stored as strings: Advance, Payment, Discount, Refund. Mapping columns `opd_bill_id`, `opd_bill_payment_id`, `mapping_status`.
- No controller GET by patient was found in `ip-management-service`.
- Platform rule (`.cursor/rules/04-ip-management-ux.mdc`): these rows are projections. Billing `OpdBill` owns charges, payments, refunds, and receipts.
- Chain, not a patient query: `patient.id` → journey id → `ip_billing_transactions.patient_journey_id`. The journey list API was not found as a patient-id billing read. Class: RED.

### 3.5 CCMS billing allocation

Routes exist only under a coverage case: `GET ccms/coverage-cases/{id}/billing`, `.../billing/full`, allocations under a billing summary id, plus POST allocate and import-from-bill. This is payer responsibility on a case, not the cashier ledger (rule 09). No patient-id route.

### 3.6 Patient account client

`billing.api.ts` `GET /patients/{patientId}/account` has no matching controller in `microservices`. Do not use it.

### 3.7 Quotes and estimates

Counsellor draft JSON on a coverage case exposes `EstimatedAmount` through the CCMS summary mapper (`CoverageCaseService.ToSummaryDto`). That is case data, not a patient billing API. Session quotes and price overrides are counselling content and remain under PD360-R3, not this Coverage stack.

### 3.8 Optical and pharmacy money

Optical orders and pharmacy bills were not traced as Coverage sources. They stay in those modules.

---

## 4. CCMS map

Service: `microservices/ccms-service/CcmsApi`. UI owner: `src/components/ccms` and `/dashboard/ccms/*`. Patient Record does not call CCMS (contract section 8 current fact; confirmed by Coverage still rendering the not-integrated body).

| Entity | What it represents | Patient link | Read | Write examples |
|---|---|---|---|---|
| `CcmsCoverageCase` | Coverage workflow case. `current_state` default `DRAFT`. Payer type. Approved amount. Pre-auth number and expiry stored on the case | `PatientId` required Guid. Also `PatientName` text, optional `SessionId`, optional `JourneyId`, optional `BranchId` | `GET ccms/coverage-cases` (no patient filter). `GET ccms/coverage-cases/{id}`. `GET .../by-session/{sessionId}` | POST create, PATCH, transition, submit-to-claims, remind, eligibility |
| `CcmsCoverageAuthorization` | Pre-auth / enhancement / resubmission on a case | Through `CoverageCase_Id` only | `GET ccms/coverage-cases/{id}/authorization` | POST create, submit, TPA response, approve, reject, clarify |
| Eligibility checks and policy captures | Eligibility and captured policy text | Case id | `.../eligibility-checks`, `.../policy-captures` | POST on the case |
| Visit policies | Policy rows on the case or session | Case or session | GET policies | CRUD, set-primary (syncs `patient_insurance`) |
| `CcmsClaimPacket` | Claim packet for a case | Through `CoverageCase_Id` | `GET ccms/coverage-cases/{id}/claims` | Generate, submit, acknowledge, query |
| `CcmsSettlement` | Payer settlement versus a claim | Through case and optional claim packet | Settlement queue routes under operations | Create, reconcile |
| `ccms_documents` | Case documents, blob-backed | Case id | GET documents and access-url | Upload, delete |
| Communication functions | Case messages | Case id | Case-scoped | POST on the case. Not `patient_communications` |
| Master data | Payers, schemes, packages | None | `ccms/master/*` | Manage |
| Dashboard / queues | Ops queues | Not patient-scoped | dashboard, operations queues | None for chart display |

`ListAsync` filters `TenantId` and `DeletedAt` (`CoverageCaseService.cs` lines 353–382). Query parameters used by the function are `state`, `payerType`, `search`, page. The list call passes `insuranceProviderId: null` and does not accept a patient id (`CoverageCaseFunctions.cs` lines 92–110). Search matches case number, `PatientName`, insurer name, and payer type. That is name search, not `patient.id`.

`GetByIdAsync` filters id and `DeletedAt` only. It does not filter `TenantId` (lines 221–224). Document as a security finding. Do not change it in this audit.

JWT: list, get-by-id, get-by-session, and get-claims call `ValidateAndExtract` and do not call `CcmsAuthz.ForbidUnlessAsync`. Some mutations do require codes such as `ccms.claim.submit`. Seeded read codes exist in `consolidated/migrations/127_ccms_permissions.sql` (`ccms.coverage_case.read`, `ccms.claim.read`, `ccms.authorization.read`, `ccms.document.read`, `ccms.eligibility.read`, `ccms.billing.read`, `ccms.settlement.read`) but the patient-relevant GET functions above do not check them. PD360-R4 still has to name which code Patient 360 must require. Matching the live GET (JWT only) would be broader than the contract’s proposed rule. This audit does not choose.

Branch: case `BranchId` is optional. List does not filter branch.

Patient 360 must not become the CCMS desk: no transition, no submit, no document upload, no settlement.

Contextual candidates, only after a patient-id read and PD360-R4: case number, stored `current_state`, payer type, pre-auth number already stored on the case, approved amount if amount visibility is allowed. Not before that. Until then the Coverage group stays **not integrated**. A profile row must not be labeled “no coverage on file” (IA lines 285).

---

## 5. Claims map

- Table/entity: `CcmsClaimPacket` (`AllModels.cs` lines 422–436), plus `CcmsClaimDocument` and `CcmsSettlement`.
- Patient: not stored on the packet. Chain: `patient.id` on `CcmsCoverageCase.PatientId` → `CoverageCase_Id` → packet.
- Identifiers: `ClaimNumber`, optional `TpaClaimNumber`.
- Amount fields stored: `ClaimedAmount`. Settlement has `SettledAmount`, `ClaimAmount`, `OutstandingAmount`, `DisallowedAmount` on line items. The packet itself has no approved or paid column.
- Status fields that exist, in source words: `Status` on `StandardEntity` (default `"active"`), `ClaimType` (`cashless` or `reimbursement`), `SubmissionMode`, `QueryStatus` (default `"none"`), timestamps `SubmittedAt` and `AcknowledgedAt`. Do not invent approved / denied / paid lifecycle words for the packet.
- API: `GET ccms/coverage-cases/{id}/claims`. Queue: `GET ccms/claims/queue` and `ccms/operations/claims-queue`. No `GET` by `patient.id`.
- GET claims: JWT extract only. Generate requires `ccms.claim.submit` or `ccms.claim.write` or `ccms.workflow.admin` (`ClaimFunctions.cs`). Seeded `ccms.claim.read` is not applied on that GET.
- UI: `GenerateClaimModal`, `ClaimSubmissionForm`, `ClaimPacketPreview`, `/dashboard/ccms` claims flow, `e2e/ccms-claims.spec.ts`. Not the patient record.
- Readiness: RED for Patient 360.

`billing.api.ts` also defines `/claims/{id}/scrub` and `/claims/generate-from-invoice/{invoiceId}`. No auth-service or ccms-service route with those paths was found. Do not use that client.

---

## 6. Pre-authorization map

Three stores. Contract section 8 says pre-authorization remains `insurance_pre_authorizations` as the owning insurance workflow record, and a census badge is not the Insurance tab source of truth. The live code has additional stores. This audit does not merge them.

### 6.1 `insurance_pre_authorizations`

- Entity: `InsurancePreAuthorization` (`InsuranceWorkflow.cs`).
- Keys: `tenant_id`, required `branch_id`, required `session_id`, required `patient_id`.
- Fields include pre-auth number, insurance provider, TPA name, policy number, policy holder name, requested and approved amounts, status default `Draft`, submitted and approval dates, `tpa_approval_number`, `tpa_approval_letter_url`.
- Patient-id list: none. `GET /api/insurance/pre-auths` filters optional `sessionId` and `status` (`InsuranceController.cs` lines 60–68). Permission `insurance.preauth.view`.
- Writes to create/update are frozen (HTTP 410) unless `X-CCMS-Bypass: true`.
- Documents: `GET /api/insurance/pre-auths/{preAuthId}/documents` with `insurance.documents.view`. Entity `InsuranceDocument` keyed by `pre_auth_id` and `file_url`, not `patient_id`.
- Census: `PatientEngagementService` loads non-terminal rows for the tenant and the branch id passed in, then uses `PatientId` (`PatientEngagementService.cs` lines 103–108 and 187–191). That is an engagement signal inside the summary, which is already visible with `patient.view`. It is not a pre-auth list API.
- Readiness for a Patient 360 list: YELLOW (patient id exists) and not safe to load as the Coverage pre-auth list without its permission and a patient-id read. Class for the list: RED.

### 6.2 `insurance_preauth_requests`

- Entity: `InsurancePreauthRequest` (`PreAdmissionChecklistModels.cs`). Comment: different from the legacy table.
- Keys: `tenant_id`, required `session_id`, optional `patient_id`, optional `schedule_id`.
- Fields include provider, policy number, member id, group number, `preauth_request_number`, `insurer_reference_number`.
- API: `InsurancePreauthController` `GET api/insurance-preauth/session/{sessionId}` and `GET schedule/{scheduleId}`. Permission `counseling_sessions.read`. GET by id is the same permission. No patient-id route.
- Chain: `patient.id` → session id → request. YELLOW.

### 6.3 CCMS authorization

- Entity: `CcmsCoverageAuthorization`. Case foreign key only. `PreAuthNumber`, amounts, valid from/to, TPA reference, rejection reason.
- The case also stores `PreAuthNumber`, `PreAuthExpiry`, `LegacyPreauthId`, `SessionPreauthId`.
- API is case-scoped (`AuthorizationFunctions.cs`). No patient-id read. RED.

No Patient 360 pre-auth display is authorized by this audit.

---

## 7. Patient ID relationship matrix

| Source | Class | Chain |
|---|---|---|
| `patient` insurance columns | GREEN | `patient.id` |
| `patient_insurance` | GREEN | `patient.id` stored and used in `GetByPatient` |
| Summary insurance strings | GREEN | Same patient row, subset of columns |
| `ccms_coverage_cases` | YELLOW | `patient.id` is stored (`PatientId`). No query uses it for a list. List search uses `PatientName` text (RED if used as the lookup) |
| `ccms_coverage_cases` via session | YELLOW | `patient.id` → counselling `session.id` → `GET .../by-session/{sessionId}` |
| Visit policies, eligibility, authorization, claims, settlements, CCMS documents | YELLOW | `patient.id` → case `PatientId` → `case.id` → child. Child rows do not store `patient.id` |
| `insurance_pre_authorizations` | YELLOW | `patient.id` is stored. No patient GET. Census reads by tenant and branch, then matches patient ids |
| `insurance_preauth_requests` | YELLOW | `patient_id` nullable. GET is by session or schedule |
| `insurance_documents` | YELLOW | `pre_auth_id` → pre-auth `patient_id` |
| `opd_bills` | GREEN | `patient_id` queried by `GetByPatientIdAsync` |
| `opd_bill` payments | YELLOW | `patient.id` → bill id → payment rows |
| Outstanding GET | GREEN | `patient.id` on `GET outstanding/{patientId}` |
| `ip_billing_transactions` | YELLOW identity, no API | `patient.id` → `patient_journey_id` → transaction. Transaction has no patient id |
| `billing.api.ts` policy and account clients | GRAY | URLs contain a patient id. No server route was found |
| CCMS list search | RED if used as identity | `PatientName` text |
| Master payers | GRAY for a patient | No patient relationship |

---

## 8. Permission matrix

See section 10 for the combined security matrix. Facts that must not be collapsed:

- `patient.view` is enough for `patient_insurance` GET and for the summary insurance strings.
- `patient.view` is not the contract’s proposed gate for financial detail or for CCMS. The live bill GET does not check `bill.create`, `bill.update`, or `bill.admin`.
- No `bill.view` or `bill.read` attribute was found on `OpdBillsController`. PD360-R2 asks which existing code is required. Do not invent one.
- Seeded `ccms.coverage_case.read` and `ccms.claim.read` exist in SQL. The chart-relevant GETs do not enforce them.
- `insurance.preauth.view` gates `GET /api/insurance/pre-auths`.
- `counseling_sessions.read` gates `GET /api/insurance-preauth/session/{sessionId}`.
- `patient.update` gates insurance verify, create, update, and delete.
- Role-name checks were not found on these GET actions. Permissions, `[Authorize]`, or JWT extract are what the code uses.
- `POST /api/insurance/ccms/patient-insurance-sync` is `[AllowAnonymous]` and checks header `X-Internal-Key` against `InternalApiKey` (`InsuranceController.cs` lines 426–437). That is a service write into the profile, not a Patient 360 read. The contract forbids Patient 360 from using a privileged identity to read CCMS.

UI versus API:

- `BillingTab` has no `PermissionGate` and no `bill.*` check. The GET matches that (authenticated only).
- `InsuranceTab` calls a `patient.view` GET and a `patient.update` verify. The Verify button is shown for `pending_verification` with no extra client permission check.

---

## 9. Tenant and branch matrix

Directory lookup and several patient list actions call `ResolveEffectiveBranchAsync` (`PatientsController.cs`, for example line 140). Summary does not (`GetPatientSummary` lines 461–469). Engagement loading then uses the client-supplied `branchId` (`PatientEngagementService` pre-auth filter `p.BranchId == branchId`, lines 103–106). Null-branch patients stay visible per the approved directory behavior. PD360-R8 remains **DECISION REQUIRED** and PD-B forbids changing that predicate now.

| Source | Tenant | Branch |
|---|---|---|
| `patient_insurance` GET | Token tenant | None |
| Patient summary | Token tenant on the patient row | Query `branchId` used for engagements only, not `ResolveEffectiveBranchAsync` |
| `opd_bills` by patient | Not applied in `GetByPatientIdAsync` | Not applied. Branch filter exists only on `GetByBranchIdAsync` |
| `GET outstanding` | Same patient query | None |
| `insurance_pre_authorizations` list | `GetTenantId()` on the service call | Not a query parameter on the list. Census uses selected branch equality, not null-branch inclusion |
| `insurance_preauth_requests` | Tenant on the row. Controller uses session id | No branch column on the entity excerpt reviewed |
| CCMS list | `claims.TenantId` | Not filtered. `BranchId` on the case is optional |
| CCMS get by id | Not filtered | Not filtered |
| `ip_billing_transactions` | Column exists | Column exists. No patient read to compare |

Mismatch to flag, not to change: a patient bill list can return rows from other branches and, because tenant is not in that query, the patient-id filter is the only scope. Directory census is branch-authorized. Patient 360 must not silently adopt the bill query as “effective branch” behavior, and must not weaken the bill query.

---

## 10. Source-of-truth and security matrix

| Domain | Patient ID | API | Permission on the read found | Tenant | Branch | Operational? | Patient 360 candidate |
|---|---|---|---|---|---|---|---|
| Patient insurance profile table | GREEN | `GET /api/patient-insurance/patient/{id}` | `patient.view` | Token tenant | None | Record tools can verify, create, update, delete | YELLOW read-only profile, not the claim |
| Registration insurance columns | GREEN | Summary subset | `patient.view` | Token tenant | Engagement branch only | Edited on patient registration (`PatientsController` maps the fields on update) | YELLOW caption as registration text, not a second profile |
| Insurance verification | GREEN | Same profile row; `POST .../verify` | `patient.update` | Token tenant | None | Yes. Sets `status` to `active` | Not a 360 write |
| CCMS coverage case | YELLOW key, RED API | List, get by id, by session | JWT on those GETs. Seeded `ccms.coverage_case.read` not applied | List yes. Get by id no | None | Yes, the CCMS desk | RED |
| CCMS eligibility | YELLOW via case | Case routes | JWT on the functions read in `EligibilityFunctions` entry | Case’s tenant column | Case optional branch | Yes | RED |
| Claims | YELLOW via case | `GET .../coverage-cases/{id}/claims` | JWT only | On the case, not checked on get-by-id | None | Yes | RED |
| Pre-auth legacy table | YELLOW | `GET /api/insurance/pre-auths` by session | `insurance.preauth.view` | Service tenant | Census uses selected branch | Writes frozen unless bypass | RED as a 360 list |
| Pre-auth session requests | YELLOW | Session and schedule GET | `counseling_sessions.read` | Row tenant | None on entity | Yes, counselling/insurance | RED until a patient read is approved |
| CCMS authorization | YELLOW via case | Case authorization GET | Function uses JWT; mutation codes differ | Case | Case | Yes | RED |
| OPD billing | GREEN | `GET /api/opdbills?patientId=` | `[Authorize]` only | Not in the patient query | Not in the patient query | Yes. Tab is view. Cashier posts with `bill.update` | YELLOW data, GRAY permission (PD360-R2) |
| IP billing transactions | YELLOW via journey | None by patient | Not applicable | Column | Column | Projection of billing | RED |
| Payments | YELLOW via bill | Nested on bill | Same as bill GET | Same gap | Same gap | POST payment is `bill.update` | Not a separate 360 list |
| Refunds | RED | No patient refund GET | — | IP type string only | IP branch column | Cashier/IP | RED |
| Outstanding | GREEN | `GET /api/opdbills/outstanding/{patientId}` | `[Authorize]` only | Same bill query | None | Read for check-in gate | GRAY until R2. Do not recompute a new total |
| Quotes / estimates | YELLOW inside case draft | CCMS case payload | CCMS JWT | Case tenant | Case optional branch | Counsellor desk | Not a Financial stack. PD360-R3 |
| Insurance documents (legacy) | YELLOW via pre-auth | `GET /api/insurance/pre-auths/{id}/documents` | `insurance.documents.view` | Document tenant | Inherited from pre-auth | Upload and verify endpoints exist | RED for 360 documents |
| CCMS documents | YELLOW via case | `GET ccms/coverage-cases/{id}/documents` | JWT only. `ccms.document.read` exists in seed and is not on this GET | Case | Case | Upload/delete | RED |

GREEN / YELLOW / RED / GRAY are evidence classes, not rankings.

---

## 11. Document sources

| Store | Metadata | Blob / URL | Patient | Permission | Retention |
|---|---|---|---|---|---|
| `insurance_documents` | `document_type`, `document_name`, `mime_type`, `file_size_bytes`, `pre_auth_id` | `file_url` | Through pre-auth `patient_id` | `insurance.documents.view` for the list by pre-auth id | Not defined in the entity reviewed |
| `ccms_documents` | Case documents mapped in `DocumentFunctions` | Access URL from `TryBuildReadAccessUrlAsync` / `GetReadAccessUrlAsync` | Through case | GET is JWT extract only | Not defined here. Contract PD360-R1 is recordings and deleted clinical/consent rows, not this blob |
| Claim documents | `CcmsClaimDocument` `DocumentType`, `DocumentName` | `BlobUrl` | Through claim → case | Not separately inventoried beyond claim routes | Unknown |
| `patient_insurance` | None | No file column | Direct | `patient.view` | Soft `deleted_at` not excluded by GET |
| Patient document uploads | Called out in the decision contract as a separate store | Not part of this insurance path | — | — | Insurance card is not that store in the files reviewed |
| Pre-auth letter | Column `tpa_approval_letter_url` on `insurance_pre_authorizations` | URL on the pre-auth row | Direct `patient_id` on that row | `insurance.preauth.view` on get-by-id | Unknown |

No download was added. Documents on Patient 360 stay out of scope. IA says insurance documents follow the parent case or pre-auth permission and do not appear for `patient.view` alone (IA line 287). That remains a proposed rule, and PD360-R4 is still open for CCMS documents.

---

## 12. Security findings (documented only)

1. OPD patient bill GETs, including outstanding, are `[Authorize]` without a billing permission. `BillingTab` shows amounts. Contract section 5.1 says Patient 360 must not show financial detail on `patient.view` alone. The live API is wider than that proposed rule. Tightening it is a later security slice. This audit does not change the controller.
2. `GetByPatientIdAsync` does not filter tenant or branch.
3. `patient_insurance` GET does not exclude `deleted_at`, so a soft-deleted policy can still be returned.
4. CCMS get-by-id does not filter tenant. List does.
5. CCMS list, get, claims GET, and document GET authenticate the JWT and do not require the seeded `ccms.*.read` codes. Mutations are tighter. Patient 360 must not call these GETs with only `patient.view`, and must not use an internal key to widen access (contract section 8 and line 478).
6. `SyncPatientInsuranceFromCcmsAsync` assigns `TenantId = patientId` when inserting a new profile row (`InsuranceWorkflowService.cs` lines 669–673). That is a data defect in the copy path. It is out of scope to fix here. A Patient 360 profile read must not assume every primary row’s tenant matches the patient’s tenant.
7. Insurance Verify on `InsuranceTab` mutates status with `patient.update`. Patient 360 must not call it.
8. `X-CCMS-Bypass` re-enables legacy pre-auth writes. Patient 360 must not send it.
9. Summary engagement can surface a non-terminal pre-auth as an engagement label to any `patient.view` user, while a pre-auth list requires `insurance.preauth.view`. The badge is not a list (contract section 8).

---

## 13. Current versus historical

| Source | What the code keeps | What Patient 360 must not invent |
|---|---|---|
| `patient_insurance.status` | `active`, `inactive`, `expired`, `pending_verification` | A new “current coverage” flag |
| Soft delete | `deleted_at` set on DELETE, but GET still returns the row | Hiding or resurrecting rows until the query is an approved change |
| Verify | Sets status `active` | Treating verify as eligibility or as a CCMS state |
| CCMS `CurrentState` | Workflow state code, default `DRAFT` | A local copy or a mapped “approved/denied” vocabulary |
| `StandardEntity.Status` on claims | Default `active` | Using that word as claim adjudication |
| `opd_bills` | Rows with `DeletedAt == null` | A second ledger |
| IP transactions | `status` default `active`, type includes `Refund` | Showing them as current balance |
| Pre-auth census | Non-terminal statuses only | Using the census query as the history list |
| Registration columns | Latest strings on `patient` | History of previous policies |

Contract section 5.3 is **Proposed**. Retention where the repository has no policy is **DECISION REQUIRED** (PD360-R1). Do not create a retention rule here.

---

## 14. API readiness matrix

| Data | Class | Note |
|---|---|---|
| Insurance profile rows | GREEN | `GET /api/patient-insurance/patient/{id}` |
| Registration provider and policy number | GREEN | Already on the summary the record loads |
| Registration group, validity, `insurance_status` | YELLOW | Columns exist. Not on the summary DTO. No extra patient read is required if a later slice maps them from the patient already loaded by an authorized patient GET. Not done here |
| OPD bill list | GREEN key, GRAY permission | Patient id read exists. PD360-R2 blocks display |
| Outstanding | GREEN key, GRAY permission | Same |
| Payments | YELLOW | Inside the bill |
| IP transactions | RED | No patient-id read |
| Refunds | RED | No patient-id read |
| CCMS cases | RED | `PatientId` column unused by list |
| Claims, CCMS pre-auth, CCMS documents | RED | Case id only |
| Legacy pre-auth list | RED | Session filter, not patient |
| Session pre-auth requests | YELLOW | Session or schedule |
| Quotes | RED for Coverage | Counselling / case draft, PD360-R3 |
| `insurancePoliciesApi` and patient account | GRAY | Client URLs only |

No missing API is created by this audit.

---

## 15. Performance and fan-out

A future Coverage panel that called every related read on section entry would fan out at least: summary (already loaded), `patient_insurance`, `opdbills`, then for CCMS an unbound list or a per-session lookup, then per case claims, authorization, and documents. That is an N+1 across sessions and cases. There is no patient aggregate for coverage.

Recommendation, not an implementation:

- Load only the section when `?section=coverage`, same pattern as Clinical and Administration.
- Inside it, load only sources whose permission and patient-id GET are approved.
- Do not add an aggregator.
- Do not call CCMS list and filter by name.
- Insurance profile can later load by itself because the GET is already patient-scoped.
- Financial stays independent and hidden until PD360-R2 names a permission that the API actually enforces, or a later security slice aligns the GET.
- CCMS, claims, and pre-auth stay **not integrated** until a patient-id read exists and PD360-R4 names the permission. Lazy-loading those subsections does not remove the missing query.

---

## 16. Target Coverage IA input

Approved structure stays one section, Coverage, with two stacks: Financial and Insurance. Do not collapse them into one Insurance block. Do not add an eighth nav item.

| Group | Stack | Now | Why |
|---|---|---|---|
| Insurance profile | Insurance | Possible later read-only of `patient_insurance`, captioned as a profile, not a claim. Registration columns, if shown, captioned separately | GREEN patient-id read and `patient.view` already match section 8’s proposed use of the profile. Amount fields stay out until section 13 item 9 is decided |
| Coverage / authorization | Insurance | **Not integrated** | No patient-id case or pre-auth list. PD360-R4 open |
| Claims | Insurance | **Not integrated** | No patient-id claim read. Do not use packet `Status` as adjudication |
| Financial summary | Financial | **Not integrated** | Patient-id bill read exists, but PD360-R2 is open and the live permission is only `[Authorize]`. Showing it would ignore the proposed rule |
| IP financial | Financial | **Not integrated** | No patient-id transaction read |
| Insurance documents | Documents section later, not this stack | **Not integrated** | Parent case or pre-auth permission, IA line 287 |

Empty copy is allowed only after an authorized read returns zero rows. Missing CCMS or missing financial permission uses the not-integrated or not-authorized states from the IA, never “No coverage” and never “No bills.”

Accessibility for a later slice (`.cursor/rules/10-accessibility.mdc`): section heading remains an `h2`, groups `h3`, status as text, tables with headers, keyboard and visible focus. The current not-integrated body already states that Coverage is not available in Patient 360. Leave it.

---

## 17. Product and security decisions still required

| Item | Contract label | What is still open |
|---|---|---|
| Financial visibility requires `patient.view` and a billing permission | **Proposed** (5.1) | Not a certified rule |
| Which existing billing code is that permission | **DECISION REQUIRED** PD360-R2 | `bill.create`, `bill.update`, and `bill.admin` exist. None is on the bill GET. No `bill.read` was found |
| Whether every `patient.view` user may see bill amounts | **DECISION REQUIRED** by the gap in 5.1 | Live tab and API say yes. Proposed 360 rule says no |
| CCMS cases, claims, documents need a CCMS permission, not `patient.view` alone | **Proposed** (section 8) | PD360-R4 must name the existing code |
| Profile read with `patient.view` | **Proposed** (section 8) | Matches the current GET. Not reopened |
| Policy versus claim versus pre-auth stay separate | **Proposed** | Not reopened |
| Claim information separate authorization | **DECISION REQUIRED** inside R4 | `ccms.claim.read` is seeded and not enforced on GET |
| Pre-auth separate authorization | **DECISION REQUIRED** | Two permissions exist (`insurance.preauth.view` and `counseling_sessions.read`) plus CCMS authorization routes. The contract names the legacy table. It does not choose among the three stores for a 360 list |
| Cross-branch historical visibility | **Proposed** (5.2) plus **DECISION REQUIRED** PD360-R8 | Bill patient query ignores branch. Census does not |
| Current versus historical | **Proposed** (5.3) | Deleted profile rows still return |
| Amount visibility on the profile (copay, deductible, out of pocket) | **DECISION REQUIRED** | These are money fields on a `patient.view` profile |
| Patient 360 versus Billing workflow | **Proposed** (section 7) | Show context only. No post, refund, or adjustment |
| Patient 360 versus CCMS workstation | **APPROVED** via PD-H and **Proposed** in section 8 | No case operations |
| Retention | **DECISION REQUIRED** PD360-R1 | Not specific to coverage blobs |
| Service-account CCMS read | Forbidden | Contract line 478. **APPROVED** prohibition, not a new decision |

No new permission is proposed.

---

## 18. Recommended implementation slices

Do not start these until the named decision is approved.

1. **Decision gate.** PD360-R2 and the amount-visibility question for profile money fields. No UI.
2. **Insurance profile read, smallest code slice.** `patient_insurance` by `patient.id` only, read-only, inside Coverage’s Insurance stack, captioned as a profile. No verify, no create, no CCMS, no registration-column merge, no amounts until that decision allows them. Registration provider and policy number may be shown only with a separate caption if included. Stop for manual UAT.
3. **Financial read only after R2 names a permission the API enforces.** If the chosen code is not on `GET /api/opdbills`, the slice is a security alignment of that GET, approved separately, before any Patient 360 amount is shown. Until then Financial stays not integrated.
4. **CCMS still not integrated.** A case list requires a patient-id query that does not exist and PD360-R4. Do not add the query in the profile slice.
5. **Claims, CCMS pre-auth, and documents** only after the case can be read for that patient under the approved CCMS permission. They are separate slices, not part of the profile.
6. **Legacy pre-auth list** only if a later decision picks `insurance_pre_authorizations` and a patient-id read under `insurance.preauth.view`. The census badge stays what it is.
7. **IP transactions** stay not integrated until a journey-scoped read is proven and R2 covers it. Do not add a second ledger.
8. **Documents** stay in the Documents section later, with the parent permission. Not a Coverage download button.

The next implementation slice must not begin from this file alone. The contract says implementation authorization is not created by the decision record, and this audit does not create it either.

---

## 19. Risks

- Showing `patient_insurance` as “coverage” hides CCMS (IA line 632).
- Calling `GET /api/opdbills?patientId=` from Patient 360 under only `patient.view` violates the proposed financial rule even though the record tools already do it.
- Using CCMS list search on the patient name returns the wrong person’s cases and bypasses an id key.
- Using get-by-id after guessing a case id is not tenant-checked.
- Sync can write a primary profile with `TenantId` set to the patient id.
- `BillingTab` outstanding is a client sum of one page, not `GET outstanding`.
- Three pre-auth stores will be merged by accident if a slice “just shows pre-auth.”
- Profile `pre_auth_number` is text on the policy, not the pre-auth workflow row.
- Deleted insurance rows still come back from GET.
- Orphan clients in `billing.api.ts` look like APIs and are not.

---

## 20. Explicit non-goals

This audit did not:

- implement Coverage or change the placeholder
- change `PatientRecordPage`, the section catalog, routes, navigation, APIs, permissions, schema, migrations, or tests
- create a patient-id CCMS, claim, pre-auth, document, or IP-transaction API
- fix bill authorization, tenant filters, CCMS tenant on get-by-id, or the insurance sync tenant assignment
- seed data or read a live database
- change the `patient_communications` 500
- implement counselling, Timeline, Documents, clinical, administration, or overview changes
- post payments, refunds, verify insurance, transition cases, or download files

---

## STOP

Coverage is not implemented. Financial is not implemented. Insurance is not implemented. CCMS, claims, pre-auth, documents, and Timeline are not implemented.
