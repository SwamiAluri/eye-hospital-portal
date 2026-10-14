# Enterprise LMS Information Architecture (L0)

**Route prefix:** `/dashboard/lms`  
**Sidebar section:** Laboratory Management  
**Gate permission (L0):** `lms.view`

## Primary navigation

```
Laboratory Management
  Overview                         /dashboard/lms
  Work Queue                       /dashboard/lms/work-queue
  Orders                           /dashboard/lms/orders
  Collection                       /dashboard/lms/collection
  Specimens                        /dashboard/lms/specimens
  Testing                          /dashboard/lms/testing
    Workbench                      /dashboard/lms/testing/workbench
    Runs                           /dashboard/lms/testing/runs
    Manual Results                 /dashboard/lms/testing/manual-results
    Instrument Results             /dashboard/lms/testing/instrument-results
    Exceptions                     /dashboard/lms/testing/exceptions
  Results & Authorization          /dashboard/lms/results
    Verification                   /dashboard/lms/results/verification
    Authorization                  /dashboard/lms/results/authorization
    Critical Results               /dashboard/lms/results/critical
    Amendments                     /dashboard/lms/results/amendments
  Reports                          /dashboard/lms/reports
  Referrals                        /dashboard/lms/referrals
  ── Quality & commercial ──
  Quality                          /dashboard/lms/quality
    QC / Nonconformities / CAPA / Equipment / Reagents / Competency
  Operations                       /dashboard/lms/operations
  Billing                          /dashboard/lms/billing
  Analytics                        /dashboard/lms/analytics
  ── Governance ──
  Configuration                    /dashboard/lms/configuration
    Test Catalogue / Panels / Specimen Types / Reference Intervals /
    TAT Rules / Sites·Sections / Referral Partners
  Administration                   /dashboard/lms/administration
```

## Context boundary (reused platform)

| Context | Source | L0 behavior |
|---|---|---|
| Tenant | JWT / auth store | Reused |
| Site / branch | `useBranchContext` | Displayed on LMS shell |
| User / roles | auth store | Displayed on LMS shell |
| Laboratory / section / discipline | Future | Explicitly “not configured in L0” |

## Canonical planning entities (not persisted in L0)

Patient, Encounter, Order, OrderTest, TestCatalogue, TestCatalogueVersion, Panel, Specimen, SpecimenContainer, SpecimenCustodyEvent, TestWorkItem, AnalyticalRun, Result, ResultVersion, Report, ReportVersion, Referral, ReferralPartner, CriticalResultEvent, Notification, Invoice/Charge, QualityEvent, CAPA, Equipment, ReagentLot, Competency, AuditEvent.

## Honesty rule

Navigation and placeholder pages are **not** workflow implementation. Overview indicators show “Not yet implemented” with **no fabricated counts**.
