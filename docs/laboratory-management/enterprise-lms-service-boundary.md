# Enterprise LMS — Laboratory Service Boundary (L-CAT-01A)

## In scope (service ownership — future)

Catalogue, Orders, Collection, Specimens, Receiving, Testing, Results, Verification, Clinical Authorization, Reporting, Referrals, Quality, Laboratory Operations (as PRD evolves).

## Out of scope (platform / other services)

| Concern | Owner |
|---|---|
| Authentication / identity / JWT issuance | AuthService |
| Permission catalog seeding / role grants | AuthService |
| Platform `audit_log` product | AuthService (integration from Lab) |
| Tenant / org / branch master data | Existing platform |
| Billing ledger / Service Catalog pricing | Billing / Service Catalog |
| CCMS insurance claims | CCMS |
| Pathology Laboratory workspace | AuthService + `/dashboard/laboratory` |

## Hard isolation rules

1. No LMS writes to `laboratory_*` tables.
2. No Pathology writes to future `lms_*` tables via bridge.
3. No redirects from Pathology UI to LMS (or reverse) without separate PO decision.
4. `laboratory.view` ≠ `lms.view`.
5. Do not mount Pathology `LaboratoryCatalogController` under `/api/lms`.

## L-CAT-01A implemented surface

- Empty `LaboratoryDbContext`
- Health + secure-ping only
- FE client stub (`laboratory-service.api.ts`) with health/ping helpers only

## Architecture closure

Closure of AD-CAT-DB / AD-CAT-AUDIT / PD-CAT-01..04 / CI:  
[enterprise-lms-lcat-01a-architecture-closure.md](./enterprise-lms-lcat-01a-architecture-closure.md)

Catalogue tables remain **out of scope** until L-CAT-01B acceptance.
