# L-CRT-01 — Critical Results (First Slice)  
# + L-CRT-UX-01 — Authorized Results Entry Point  
# Acceptance Closure

**Date:** 2026-10-12  
**Mode:** DOCUMENTATION / FORMAL ACCEPTANCE CLOSURE ONLY — no application code, schema, API, UI behavior, permission, role-grant, ResultStatus, Critical backend, Testing, Verification, Authorization lifecycle, Collection, Specimen, Receiving, Barcode, Pathology, Reporting, Amendments, Instrument/Runs/QC, Referral, or Billing changes  

**Authoritative references:**

| Document | Role |
|---|---|
| [enterprise-lms-critical-results-decision-closure.md](./enterprise-lms-critical-results-decision-closure.md) | L-CRT-01 product authorization |
| [enterprise-lms-critical-result-authorized-results-ux-decision-closure.md](./enterprise-lms-critical-result-authorized-results-ux-decision-closure.md) | L-CRT-UX-01 product authorization |
| [enterprise-lms-critical-results-implementation.md](./enterprise-lms-critical-results-implementation.md) | L-CRT-01 implementation report |
| [enterprise-lms-authorized-results-ux-implementation.md](./enterprise-lms-authorized-results-ux-implementation.md) | L-CRT-UX-01 implementation report |
| [enterprise-lms-critical-results-pre-uat-verification.md](./enterprise-lms-critical-results-pre-uat-verification.md) | L-CRT-01 PRE-UAT evidence |
| [enterprise-lms-authorized-results-ux-pre-uat-verification.md](./enterprise-lms-authorized-results-ux-pre-uat-verification.md) | L-CRT-UX-01 PRE-UAT evidence |
| Upstream | L-COL-01B … 01E, L-TST-01A, L-VER-01, L-AUTH-01 **ACCEPTED** |

```text
PRODUCT_DECISIONS_CLOSED_L_CRT_01_AUTHORIZED
  → L-CRT-01 implemented + PRE-UAT passed
PRODUCT_DECISIONS_CLOSED_L_CRT_UX_01_AUTHORIZED
  → L-CRT-UX-01 implemented + PRE-UAT passed
  → Manual UAT PASSED (UI evidence below)
  ↓
L-CRT-01 + L-CRT-UX-01 ACCEPTED  (THIS DOCUMENT)
  ↓
Next gate (NOT started): L-REP-01 — Reporting / Release Discovery Audit
```

---

## FINAL STATUS

# ACCEPTED_L_CRT_01_AND_L_CRT_UX_01

| Gate | Status |
|---|---|
| Implementation complete | **YES** (L-CRT-01 + L-CRT-UX-01) |
| PRE-UAT passed | **YES** |
| Manual UAT | **`MANUAL_UAT_PASSED`** |
| Formal acceptance | **`ACCEPTED`** |

Acceptance is based on Product Decision stamps, implementation/PRE-UAT documentation, repository verification against those stamps, **and** Manual UAT exercised through the UI (evidence in §D). Automated tests alone do not constitute acceptance.

---

## A. Slices

| Slice | Scope |
|---|---|
| **L-CRT-01** | Critical Results first slice — CriticalResultEvent, manual classification, acknowledgement, event-backed queue, in-app notification intent, audit, permissions catalog, tenant/branch, idempotency, concurrency |
| **L-CRT-UX-01** | Authorized Results discovery under Results & Authorization — ClinicallyAuthorized-only worklist opening existing Manual Results / CriticalResultPanel |

---

## B. Product Decision authorization stamps

| Stamp | Source |
|---|---|
| `PRODUCT_DECISIONS_CLOSED_L_CRT_01_AUTHORIZED` | Critical Results decision closure |
| `PRODUCT_DECISIONS_CLOSED_L_CRT_UX_01_AUTHORIZED` | Authorized Results UX decision closure (`PD-CRT-UX-01`) |

---

## C. Implementation and PRE-UAT status

| Item | Status | Evidence |
|---|---|---|
| L-CRT-01 implementation | Complete | [enterprise-lms-critical-results-implementation.md](./enterprise-lms-critical-results-implementation.md) |
| L-CRT-UX-01 implementation | Complete | [enterprise-lms-authorized-results-ux-implementation.md](./enterprise-lms-authorized-results-ux-implementation.md) |
| L-CRT-01 PRE-UAT | Passed (`PRE_UAT_READY_FOR_MANUAL_UAT`) | [enterprise-lms-critical-results-pre-uat-verification.md](./enterprise-lms-critical-results-pre-uat-verification.md) |
| L-CRT-UX-01 PRE-UAT | Passed (`PRE_UAT_READY_FOR_MANUAL_UAT`) | [enterprise-lms-authorized-results-ux-pre-uat-verification.md](./enterprise-lms-authorized-results-ux-pre-uat-verification.md) |

**Pre-acceptance repository verification (2026-10-12):** Implementation still matches approved closures — Critical orthogonal to `ResultStatuses` (Draft / TechnicalVerified / ClinicallyAuthorized only); Authorized Results page filters ClinicallyAuthorized; Testing default page has no `resultStatus` override; Critical queue remains event-backed; no Twilio/escalation/threshold engine in LaboratoryApi Critical path. **No unexpected drift.** Acceptance is not blocked.

---

## D. Manual UAT evidence summary (`MANUAL_UAT_PASSED`)

Manual UAT was exercised through the UI. Accepted evidence:

### D.1 Authorized Results entry point (L-CRT-UX-01)

- Results & Authorization → **Authorized Results** loads.
- ClinicallyAuthorized results displayed.
- **Open Result** works; reuses existing Manual Results detail.
- Result remains ClinicallyAuthorized after open.

### D.2 Critical classification (L-CRT-01)

- **Mark as Critical** visible on eligible ClinicallyAuthorized Result.
- Classification confirmation shown; classification confirmed.
- Critical event becomes **Open**, bound to correct ResultVersion.
- Notification intent emitted.
- ResultStatus remains **ClinicallyAuthorized**.
- Critical is **not** represented as a ResultStatus.

### D.3 Critical acknowledgement

- Acknowledgement evidence required; button disabled until evidence supplied.
- Evidence entered; event becomes **Acknowledged**.
- Acknowledged-by and UTC timestamp displayed.
- ResultStatus remains ClinicallyAuthorized.

### D.4 Critical Results queue

- Event-backed grid shows the created event (patient, order, test, Result Status, Critical state, version, Classified UTC, Ack UTC, Open Result).
- Open Result redirects to existing Manual Results detail.

### D.5 UX correction boundaries

- Authorized Results supplies the previously missing CA entry point.
- Critical queue remains event-backed.
- No generic Result-by-ID route.
- Default Testing Workbench behavior unchanged.

---

## E. Automated test evidence (already produced)

| Suite | Result (from PRE-UAT / implementation records) |
|---|---|
| LaboratoryApi Critical + Result Auth/Verify / full suite | Critical filters and full suite **266/266** at L-CRT-01 PRE-UAT; PG concurrency **2/2** |
| AuthService Critical permissions + audit allowlist | **7/7** |
| Frontend Critical + Testing + Authorized Results UI | **18/18** (Authorized + Testing + Critical contracts after L-CRT-UX-01) |

---

## F. Database / migration evidence (already produced)

| Item | Evidence |
|---|---|
| Migration | `20261012130000_AddLmsCriticalResultEvents` applied |
| Table | `lms_critical_result_events` with FK to `lms_results`, `row_version`, unique `(tenant_id, result_id, result_version_number)` |
| No Critical ResultStatus column on `lms_results` | Verified at PRE-UAT |

---

## G. Permission / audit evidence

| Item | Evidence |
|---|---|
| Catalog | `lms.results.critical.view` / `manage` / `acknowledge` seeded active |
| Production role grants | **None** added for Critical or Authorized Results |
| Audit actions | `CREATE_CRITICAL_EVENT`, `ACKNOWLEDGE_CRITICAL_EVENT` allowlisted; fail-closed create/ack verified in automated tests |
| UAT actor | Admin wildcard / already-authorized administrator (no temporary production role grants) |

---

## H. Lifecycle boundaries (accepted)

### H.1 Critical event lifecycle

**Open → Acknowledged** (with mandatory acknowledgement evidence). Notification intent does not acknowledge the event.

### H.2 Result lifecycle (unchanged)

**Draft → TechnicalVerified → ClinicallyAuthorized**

Critical classification and acknowledgement **do not** change ResultStatus. Clinical Authorization remains unchanged by Critical operations.

### H.3 Orthogonality

**Critical is orthogonal to ResultStatus.** No `ResultStatus = Critical` exists. Critical is represented only as `CriticalResultEvent`.

---

## I. Explicit out-of-slice statements (acceptance boundaries)

| Statement | Status |
|---|---|
| No Critical ResultStatus | **Confirmed** |
| No automated clinical threshold / Critical Rule engine | **Confirmed — not implemented** |
| No escalation timers / on-call hierarchy | **Confirmed — not implemented** |
| No patient-visible Critical notification or patient publication | **Confirmed — staff in-app intent only** |
| Reporting / Final / Released outside this slice | **Confirmed** |
| Amendments outside this slice | **Confirmed** |
| Pathology remains a separate system boundary | **Confirmed** |
| No production role grants added | **Confirmed** |
| Authorized Results UX does not modify default Testing Workbench behavior | **Confirmed** |

---

## J. Known limitations / future scope

1. Critical detection remains **manual** only (no automated thresholds).  
2. No escalation SLA / multi-channel clinical delivery.  
3. No Reporting / Final / Released / PDF / patient portal Critical disclosure.  
4. No Amendments workflow.  
5. Permission catalog seeded without production role grants — non-Admin actors need future governed grants.  
6. Authorized Results lists **ClinicallyAuthorized only** (TechnicalVerified discovery remains Authorization).  

**Next gate (not started by this document):** **L-REP-01 — Reporting / Release Discovery Audit** (separate AUDIT → PRODUCT DECISION → IMPLEMENTATION sequence).

---

## K. This task did not change

- Application backend or frontend behavior  
- Permissions / role grants / audit allowlists  
- Database schema / migrations  
- L-TST-01A / L-VER-01 / L-AUTH-01  
- Collection / Specimen / Receiving / Barcode / Pathology  
- Reporting / Final / Released / Amendments / Instrument / Runs / QC / Referral / Billing  

---

## FINAL ACCEPTANCE STAMP

**ACCEPTED_L_CRT_01_AND_L_CRT_UX_01**

| Field | Value |
|---|---|
| L-CRT-01 | **ACCEPTED** |
| L-CRT-UX-01 | **ACCEPTED** |
| Manual UAT | **`MANUAL_UAT_PASSED`** |
| Formal acceptance | **`ACCEPTED`** |

**STOP.** Do not implement L-REP-01 or any other next LMS slice in this task.
