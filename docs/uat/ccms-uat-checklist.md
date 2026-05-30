# Coverage & Claims — UAT Acceptance Checklist
_Plan reference: Part K.2 — K.1 (Automated) + K.2 (UAT success criteria)_

> **How to use this document**
> Each tester signs off a row by adding their initials + date in the **Pass** column.
> A scenario fails if the observed behaviour deviates from **Expected**.
> All **Critical** scenarios must pass before go-live.
> **High** scenarios must pass before pilot-tenant cutover.
> **Medium** can be deferred to the first week of live operation.

---

## Roles used in testing

| Role label | CCMS permissions needed |
|---|---|
| **Counsellor** | `ccms.policy.edit`, `ccms.case.view` |
| **Insurance cell** | `ccms.preauth.operate`, `ccms.case.view` |
| **Finance** | `ccms.settlement.record`, `ccms.case.view` |
| **Billing** | `ccms.billing.allocate`, `ccms.case.view` |
| **Admin** | `ccms.master.manage`, `ccms.workflow.admin` |

---

## Section 1 — Counsellor: Policy capture on session

| # | Scenario | Role | Steps | Expected | Priority | Pass (initials + date) | Notes |
|---|---|---|---|---|---|---|---|
| C1 | Add 2+ policies for a session | Counsellor | Open session → Coverage & Insurance tab → Policies → Add 2 policies | Both policies appear in list; exactly one marked Primary | **Critical** | | |
| C2 | Mark a policy as Primary | Counsellor | Select secondary policy → Set Primary | Previous primary is cleared; new one shows "Primary" badge | **Critical** | | |
| C3 | Submit without primary policy | Counsellor | Remove all primary flags → click Submit to Insurance Cell | Submit button disabled or validation error shown | **Critical** | | |
| C4 | Underwriting snapshot populated | Counsellor | Open Underwriting tab → check chronic conditions | Conditions pre-filled from patient clinical data; editable | **High** | | |
| C5 | Save underwriting snapshot | Counsellor | Edit chronic conditions → Save | Changes persist on page reload | **High** | | |
| C6 | Estimate + service tax | Counsellor | Open Estimate & Tax tab → enter cost + enable service tax | Tax amount computed automatically; total = base + tax | **High** | | |
| C7 | Complete session submission | Counsellor | All fields valid → Submit to Insurance Cell | CCMS draft case created; status shows "Pending Pre-Auth" | **Critical** | | |
| C8 | Session < 5 min flow | Counsellor | End-to-end from open session to submit | Full flow (policies + underwriting + estimate + submit) ≤ 5 minutes | **High** | | |

---

## Section 2 — Insurance cell: Pre-auth operations desk

| # | Scenario | Role | Steps | Expected | Priority | Pass | Notes |
|---|---|---|---|---|---|---|---|
| P1 | Pre-auth queue loads | Insurance cell | Open /operations/preauth | Queue renders with patient name, mobile, procedure, state pills | **Critical** | | |
| P2 | Filter — Ready to Send | Insurance cell | Click "Ready to Send" filter | Only cases in `PREAUTH_GENERATED` state shown | **Critical** | | |
| P3 | Filter — Awaiting TPA | Insurance cell | Click "Awaiting TPA" filter | `PREAUTH_SENT`, `WAITING_APPROVAL`, `RESUBMITTED` states shown | **Critical** | | |
| P4 | Send pre-auth | Insurance cell | Click Send Pre-Auth on a ready case → fill TPA ref → Submit | Case state → `PREAUTH_SENT`; process status → `SENT` | **Critical** | | |
| P5 | Record TPA Approval | Insurance cell | Click TPA Response → Decision = Approved → Approved amount → Submit | State → `APPROVED`; approved amount saved; process status → `REPLY_RECEIVED` | **Critical** | | |
| P6 | Record TPA Partial Approval | Insurance cell | TPA Response → Decision = Partial | State → `PARTIAL_APPROVAL`; rejected amount recorded | **High** | | |
| P7 | Record TPA Rejection | Insurance cell | TPA Response → Decision = Rejected → enter reason | State → `REJECTED`; rejection reason visible on case | **High** | | |
| P8 | Send pre-auth from desk only | Insurance cell | Verify no legacy /dashboard/insurance route is accessible | Redirect to /dashboard/ccms | **Critical** | | |
| P9 | Operations desk modal a11y | Insurance cell | Tab through Send Pre-Auth modal | Focus trapped in modal; Escape closes; all fields labelled | **High** | | |
| P10 | Session enrichment in queue | Insurance cell | Check queue row for a session-linked case | Mobile, procedure name, counsellor name populated | **High** | | |

---

## Section 3 — Admission gate (IP integration)

| # | Scenario | Role | Steps | Expected | Priority | Pass | Notes |
|---|---|---|---|---|---|---|---|
| A1 | Admit patient — pre-auth approved | Insurance cell + IP | Complete pre-auth approve → attempt admit in IP | Admission allowed | **Critical** | | |
| A2 | Admit patient — no pre-auth (fail-open) | IP | Attempt admit with no CCMS case; admission mode = fail_open | Warning shown; admission allowed | **Critical** | | |
| A3 | Admit patient — no pre-auth (fail-closed) | Admin + IP | Set mode = fail_closed in Settings → attempt admit | Admission blocked with reason | **High** | | |
| A4 | Admit patient — pre-auth rejected | IP | Pre-auth status = REJECTED → attempt admit | Warning or block (configurable) shown | **High** | | |
| A5 | Settings toggle works | Admin | /ccms/settings → toggle fail-open/fail-closed → Save | Config applied immediately on next validate-admission call | **High** | | |

---

## Section 4 — Billing → Claim → Settlement

| # | Scenario | Role | Steps | Expected | Priority | Pass | Notes |
|---|---|---|---|---|---|---|---|
| B1 | Surgery completes | IP | Mark surgery complete in IP | CCMS case state → `SURGERY_COMPLETED` | **High** | | |
| B2 | Patient discharged | IP | Discharge patient in IP | CCMS case state → `BILL_PENDING` | **High** | | |
| B3 | Bill finalized | Billing | Finalize bill in billing system → send to CCMS | CCMS case state → `BILL_FINALIZED`; billing lines importable | **High** | | |
| B4 | Import billing lines | Billing | Import from bill → allocate | Insurance/patient split shown in allocation panel | **High** | | |
| B5 | Generate claim | Insurance cell | Case at BILL_FINALIZED → Generate Claim | Claim packet created; case → `CLAIM_READY` | **Critical** | | |
| B6 | Submit claim | Insurance cell | Submit claim → enter TPA claim number | Case → `CLAIM_SUBMITTED`; TPA claim # visible | **Critical** | | |
| B7 | Acknowledge claim | Insurance cell | Acknowledge claim | Case → `CLAIM_IN_PROCESS` | **High** | | |
| B8 | Record full settlement | Finance | Record Settlement → settled = claim amount → NEFT UTR | Case → `FULL_SETTLEMENT`; outstanding = 0 | **Critical** | | |
| B9 | Record partial settlement | Finance | Record Settlement → settled < claim amount | Case → `PARTIAL_SETTLEMENT`; outstanding > 0 | **Critical** | | |
| B10 | Reconcile case | Finance | Reconcile workbench → mark reconciled | Case → `RECONCILED` → `CLOSED` | **Critical** | | |
| B11 | Aging report | Finance | Open /ccms/settlement → aging buckets | 4 buckets (0–30, 31–60, 61–90, 90+ days) populated | **High** | | |

---

## Section 5 — No legacy insurance routes

| # | Scenario | Steps | Expected | Priority | Pass | Notes |
|---|---|---|---|---|---|---|
| L1 | /dashboard/insurance redirects | Navigate to /dashboard/insurance | 301/redirect to /dashboard/ccms | **Critical** | | |
| L2 | /dashboard/counselor/insurance redirects | Navigate to legacy counsellor insurance | Redirect to /dashboard/ccms | **Critical** | | |
| L3 | Old PreAuthForm not rendered | Search built JS bundle for `PreAuthForm` or `ClaimForm` components | Not present in app bundle | **High** | | |

---

## Section 6 — Accessibility

| # | Scenario | Steps | Expected | Priority | Pass | Notes |
|---|---|---|---|---|---|---|
| AC1 | All modals labelled | Open each modal (Send Pre-Auth, TPA Response, Generate Claim, Record Settlement, Allocate Bill, Eligibility) | `role="dialog"`, `aria-modal="true"` present | **High** | | |
| AC2 | Focus trapped in modals | Open modal → Tab through all fields | Focus stays within modal; no focus escapes | **High** | | |
| AC3 | Escape closes modals | Open any modal → press Escape | Modal closes | **High** | | |
| AC4 | Required fields marked | Open any form | Required fields marked with `*` | **Medium** | | |
| AC5 | Submit disabled until valid | Leave required field empty | Submit button disabled or form shows error on attempt | **High** | | |

---

## Section 7 — Payer master & permissions

| # | Scenario | Steps | Expected | Priority | Pass | Notes |
|---|---|---|---|---|---|---|
| PM1 | Create insurer | Admin → Master Data → Payers → Add | Insurer created with all fields; appears in payer list | **High** | | |
| PM2 | Create Other Debtor | Admin → Add Payer → Category = Other Debtor | Sub-type field appears; debtor saved | **High** | | |
| PM3 | Edit payer | Select existing → change tax % → Save | Changes persisted | **High** | | |
| PM4 | Delete payer | Select → Delete → Confirm | Soft-deleted; not shown in list | **High** | | |
| PM5 | RBAC enforcement | Log in as Counsellor → try /ccms/master-data/payers | Restricted or read-only view shown | **High** | | |
| PM6 | Insurance cell cannot access settings | Log in as Insurance cell | /ccms/settings shows "Access Restricted" | **High** | | |

---

## Section 8 — Analytics & enhancements

| # | Scenario | Steps | Expected | Priority | Pass | Notes |
|---|---|---|---|---|---|---|
| AN1 | Analytics page loads | /ccms/analytics | KPI cards, chart, no error | **Medium** | | |
| AN2 | Enhancement creation | Open case → Enhancements tab → Request Enhancement | Enhancement record created | **Medium** | | |
| AN3 | Approve enhancement | Enhancement pending → Decide → Approved + amount | Status → approved; amount saved | **Medium** | | |

---

## Sign-off matrix

| Area | Tester name | Sign-off date | Issues raised |
|---|---|---|---|
| Section 1 — Counsellor | | | |
| Section 2 — Insurance cell | | | |
| Section 3 — Admission gate | | | |
| Section 4 — Billing / Claims / Settlement | | | |
| Section 5 — Legacy routes | | | |
| Section 6 — Accessibility | | | |
| Section 7 — Payer master / RBAC | | | |
| Section 8 — Analytics / Enhancements | | | |

---

## Go-live criteria

All **Critical** rows must be signed off before go-live.
All **High** rows must be signed off before the pilot tenant is expanded to all users.
**Medium** rows can be tracked as post-launch issues with SLA ≤ 5 business days.

---

_Document version: 1.0 — generated 2026-05-24. Update this file when defects are fixed or scope changes._
