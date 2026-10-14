# L-REP-02B — Report Release (Metadata Only)  
# Product Decision Closure

**Date:** 2026-10-12  
**Slice:** L-REP-02B (Report Release — metadata only)  
**Mode:** PRODUCT DECISION CLOSURE — documentation / Product Owner approval only  

**This task does not implement L-REP-02B.**  
No application source, schema, migrations, APIs, DTOs, services, UI, routes, PDF, CanonicalDocument association, business numbering, download, NotificationHub, patient publication, Amendments, Unrelease/Revoke, permission seed/grant changes, audit allowlist changes, ResultStatus changes, L-AUTH / L-VER / L-TST / L-CRT, Collection / Specimen / Orders, Pathology, or Patient Portal / Patient 360 changes are authorized **in this task**.

| Upstream reference | Role | Stamp |
| --- | --- | --- |
| [enterprise-lms-reporting-decision-closure.md](./enterprise-lms-reporting-decision-closure.md) | L-REP-01 Report foundation | `PRODUCT_DECISIONS_CLOSED_L_REP_01_AUTHORIZED` |
| [enterprise-lms-report-finalize-decision-closure.md](./enterprise-lms-report-finalize-decision-closure.md) | L-REP-02A Finalize decisions | `PRODUCT_DECISIONS_CLOSED_L_REP_02A_AUTHORIZED` |
| [enterprise-lms-report-finalization-acceptance-closure.md](./enterprise-lms-report-finalization-acceptance-closure.md) | Accepted L-REP-02A behavior | `ACCEPTED_L_REP_02A` |
| [enterprise-lms-report-release-discovery-audit.md](./enterprise-lms-report-release-discovery-audit.md) | Post–L-REP-02A Release discovery | `DISCOVERY_COMPLETE_READY_FOR_PRODUCT_OWNER_DECISION` |
| [enterprise-lms-report-release-decision-package.md](./enterprise-lms-report-release-decision-package.md) | PD-REP-02B-01 … PD-REP-02B-24 | Superseded for stamped items by this closure |

**Authoritative discovery for Release:** post–L-REP-02A Release-only discovery. Older combined Final+Release discovery is historical where it conflicts.

```text
L-REP-01 Report Foundation (certified)
  ↓
L-REP-02A Finalize metadata (ACCEPTED_L_REP_02A)
  ↓
L-REP-02B Discovery / Decision Package
  ↓
PD-REP-02B-* (THIS DOCUMENT) ← PRODUCT OWNER APPROVED (2026-10-12, outside Cursor)
  ↓
L-REP-02B — REPORT RELEASE (METADATA ONLY)
  ← AUTHORIZED FOR SEPARATE FUTURE IMPLEMENTATION TASK
  ← NOT IMPLEMENTED BY THIS DOCUMENT
  ↓
Later (not authorized by this document):
  PDF / CanonicalDocument · business Report number · download ·
  notification intent/delivery · patient publication · Amendments ·
  Unrelease / Revoke
```

---

## 1. Status

```text
PRODUCT_DECISIONS_CLOSED_L_REP_02B_AUTHORIZED
IMPLEMENTATION_NOT_STARTED
```

| Field | Value |
| --- | --- |
| Mode | PRODUCT DECISION CLOSURE |
| Closure stamp | `PRODUCT_DECISIONS_CLOSED_L_REP_02B_AUTHORIZED` |
| Implementation | `IMPLEMENTATION_NOT_STARTED` |
| Configuration gate | `CONFIGURATION_REQUIRED = NO` |
| Next gate | **L-REP-02B IMPLEMENTATION AUTHORIZATION** (separate task) |

This stamp does **not** mean `IMPLEMENTATION_COMPLETE`, `PRE_UAT_READY`, `UAT_READY`, `UAT_PASSED`, or `ACCEPTED`.

**This document authorizes a future separate implementation task; it does not itself authorize Cursor to modify code in this task.**

---

## 2. Product Owner approval statement

Product Owner has **explicitly approved ALL recommended options** (Option A for PD-REP-02B-01 through PD-REP-02B-24) from:

- [enterprise-lms-report-release-decision-package.md](./enterprise-lms-report-release-decision-package.md)
- [enterprise-lms-report-release-discovery-audit.md](./enterprise-lms-report-release-discovery-audit.md)

with authorization provided **outside Cursor**, reconciled against certified L-REP-01 and accepted L-REP-02A.

| Class | Meaning |
| --- | --- |
| **APPROVED** | Product Owner approved for L-REP-02B (metadata-only Release) |
| **CONFIRMED / CARRIED FORWARD** | Upstream L-REP-02A principle reconfirmed for Release (not newly invented) |
| **OUT_OF_SCOPE** | Explicitly outside L-REP-02B implementation |

**This document does not implement L-REP-02B.**  
Certified upstream L-REP-01 and L-REP-02A decisions are **not reopened**.

---

## 3. Decision register — all 24 APPROVED

| ID | Topic | Stamp | Option | Resulting rule |
| --- | --- | --- | --- | --- |
| **PD-REP-02B-01** | Release slice packaging | **APPROVED** | **A** | Metadata-only Release. PDF, business numbering, download, publication, and notification are separate future slices. |
| **PD-REP-02B-02** | Release eligibility | **APPROVED** | **A** | Only `Status == Final` may transition to Released. Draft cannot be Released. |
| **PD-REP-02B-03** | Release state transition | **APPROVED** | **A** | `Report.Status` Final → Released. Persist `ReleasedAtUtc` and `ReleasedByUserId` (server UTC; authenticated actor). |
| **PD-REP-02B-04** | Release version behavior | **APPROVED** | **A** | Release uses the current Final ReportVersion. No new ReportVersion. Released content remains the existing frozen ReportVersion. |
| **PD-REP-02B-05** | Release authority | **APPROVED** | **A** | `lms.reports.release` + tenant authorization + authorized operating-branch authorization are sufficient. No signatory hierarchy. No release-authority configuration. Does **not** create `CONFIGURATION_REQUIRED`. |
| **PD-REP-02B-06** | Same-person / dual control | **APPROVED** | **A** | Same authenticated user may Finalize and Release. No mandatory Finalizer ≠ Releaser. No multi-signatory workflow. |
| **PD-REP-02B-07** | Release reversibility | **APPROVED** | **A** | L-REP-02B is forward-only. No Unrelease, Revoke, or correction mechanism in this slice. |
| **PD-REP-02B-08** | Business Report number | **APPROVED** | **A** | Technical Report GUID remains Report identity. No business Report number in L-REP-02B. Order number and Accession number must **not** become Report numbers. |
| **PD-REP-02B-09** | PDF / document requirement | **APPROVED** | **A** | Metadata-only. No PDF/document generation required for Release. CanonicalDocument is not modified or associated with LmsReport. |
| **PD-REP-02B-10** | Download | **APPROVED** | **A** | No download capability in L-REP-02B. |
| **PD-REP-02B-11** | Notification intent | **APPROVED** | **A** | Release emits **no** notification intent. No SMS/email/WhatsApp. Notification and delivery remain separate future scope. |
| **PD-REP-02B-12** | Patient visibility / publication | **APPROVED** | **A** | Released remains staff-only. Released does **not** become patient-visible. No Patient Portal or Patient 360 publication. |
| **PD-REP-02B-13** | Source claim lifetime | **APPROVED** — **CONFIRMED / CARRIED FORWARD** from L-REP-02A (PD-REP-02-11) | **A** | Source claims remain after Final and through Release. Release does not drop or alter source claims. See §5. |
| **PD-REP-02B-14** | Amendment dependency | **APPROVED** | **A** | Amendments are not required before Release. Amendments remain future scope. |
| **PD-REP-02B-15** | Multi-result Release semantics | **APPROVED** | **A** | Release applies to the whole LmsReport aggregate. Individual ResultVersions are not independently Released. Partial Report Release is not supported. |
| **PD-REP-02B-16** | Idempotency | **APPROVED** | **A** | Operation `release_report`. Same key + same hash → safe replay. Same key + different hash → `idempotency_conflict` / HTTP 409. Already Released with a new key → `invalid_state`. Mirror certified Finalize. |
| **PD-REP-02B-17** | Optimistic concurrency | **APPROVED** | **A** | Require `expectedRowVersion`. Stale → `concurrency_conflict` / HTTP 409. Concurrent Release → exactly one successful transition. |
| **PD-REP-02B-18** | Audit behavior | **APPROVED** | **A** | Action `RELEASE_REPORT`, resource `LmsReport`, platform `audit_log` only, fail-closed. Allowlist addition is **implementation** work — **not** performed by this closure. |
| **PD-REP-02B-19** | Tenant / branch authorization | **APPROVED** | **A** | Mirror Finalize: JWT tenant match; `ValidateUserBranch`; `Report.OperatingBranchId` must match requested operating branch; no cross-tenant or cross-branch Release. No new organizational hierarchy. |
| **PD-REP-02B-20** | Permission grants | **APPROVED** | **A** | Enforce `lms.reports.release`. Do **not** add role grants or seed production grants. Permission catalogue remains the source for the permission code. |
| **PD-REP-02B-21** | Release vs notification / delivery | **APPROVED** | **A** | Release is separate from notification intent, orchestration, delivery, and patient communication. No notification implementation in L-REP-02B. |
| **PD-REP-02B-22** | Artifact immutability | **APPROVED** | **A** | Released Report content remains immutable. Current ReportVersion snapshots unchanged. Corrections require future Amendment / new-version policy. |
| **PD-REP-02B-23** | Report identity / business number | **APPROVED** | **A** | Technical identity remains Report GUID. Any future business number is a separate attribute. Order and Accession numbers are **not** Report numbers. |
| **PD-REP-02B-24** | Release failure semantics | **APPROVED** | **A** | Fail-closed. On audit or required side-effect failure: Status remains Final; `ReleasedAtUtc` / `ReleasedByUserId` not persisted; honest failure; no best-effort Release. |

---

## 4. Binding L-REP-01 / L-REP-02A principles (preserved)

| Principle | Status |
| --- | --- |
| LaboratoryApi owns LMS Reports | Preserved |
| AuthService legacy LabReport is **not** the LMS Report SoT | Preserved |
| ResultStatus is never changed by Report operations | Preserved |
| Clinical Authorization does not automatically Release a Report | Preserved |
| Release is an explicit Report-domain operation | Preserved |
| Released is **not** automatically patient-visible | Preserved (PD-REP-02B-12 = A) |
| Release is **not** notification delivery | Preserved (PD-REP-02B-11 / 21 = A) |
| CanonicalDocument is not the Report clinical SoT | Preserved |
| Pathology remains separate; no dual-write / bridge / migration / replacement | Preserved |
| Source ResultVersion provenance remains exact and immutable | Preserved |
| L-REP-02A source claims remain after Final and through Release | **Carried forward** (PD-REP-02B-13) |
| Final ReportVersion remains frozen | Preserved |
| No ReportVersion is created by Release | Preserved (PD-REP-02B-04 = A) |
| Amendments remain future | Preserved (PD-REP-02B-14 = A) |
| Audit remains platform `audit_log` and fail-closed | Preserved |
| Idempotency and RowVersion remain mandatory | Preserved |
| Tenant and branch authorization remain mandatory | Preserved |
| No production role grants | Preserved (PD-REP-02B-20 = A) |

---

## 5. PD-REP-02B-13 — Source claim lifetime (carried forward)

**L-REP-02A Decision Closure §13 (PD-REP-02-11 = A)** already stamped:

> Existing `lms_report_draft_source_claims` remain after Final and (future) Release.  
> A ResultVersion already claimed must **not** become eligible for another Draft Report merely because the Report became Final or Released.  
> Claims remain until a future governed Amendment/supersession policy explicitly changes that behavior.

**PD-REP-02B-13 = Option A** is therefore recorded as **CONFIRMED / CARRIED FORWARD**, not as a newly invented architecture decision.

Release **must not** drop, rewrite, or weaken source claims.

---

## 6. Configuration gate

With all Option-A decisions stamped:

| Dependency | Required? |
| --- | --- |
| Release authority beyond permission + tenant + operating branch | **NOT REQUIRED** |
| Dual-control configuration | **NOT REQUIRED** |
| Business Report numbering | **NOT REQUIRED** |
| PDF / templates / branding | **NOT REQUIRED** |
| Patient publication | **NOT REQUIRED** |
| CanonicalDocument association | **NOT REQUIRED** |

```text
CONFIGURATION_REQUIRED = NO
```

**Reason:** The approved metadata-only Release boundary uses permission + tenant + operating branch and does not require missing signatory, numbering, template, document, or publication configuration.

---

## 7. Release lifecycle (authorized rules)

```text
Draft → Final (ACCEPTED_L_REP_02A)
         ↓  explicit actor action + lms.reports.release
      Released
         ↓  (future separately authorized slices)
      PDF / number / download / notification / publication / Amendments
```

### Eligibility

A Report may be Released only when:

1. Report exists  
2. Authenticated tenant owns the Report  
3. Actor is authorized for `Report.OperatingBranchId`  
4. `Report.Status == Final`  
5. Actor holds `lms.reports.release`  
6. `expectedRowVersion` matches (optimistic concurrency)

Draft → Released is **forbidden**.

### Transition (PD-REP-02B-03 / 04)

- Set `Report.Status = Released`  
- Persist `ReleasedAtUtc` (server UTC) and `ReleasedByUserId` (authenticated actor)  
- Bind Release to the **current** Final ReportVersion  
- **Do not** create a new ReportVersion  
- **Do not** mutate source snapshots or ResultStatus  

### Post-Release (this slice)

- View / discover / read frozen content  
- Honest Released state + actor/time in UI  
- **No** Unrelease / Revoke / Amend / PDF / download / publication / notification  

---

## 8. Authorized future implementation boundary

A **separate** L-REP-02B implementation task (after implementation authorization) may implement **only**:

### Backend / domain

- `ReleasedAtUtc`  
- `ReleasedByUserId`  
- Final → Released transition  
- Released state persistence  

### API

- `POST /api/lms/reports/{reportId}/release`  

### Authorization

- `lms.reports.release`  
- Tenant authorization  
- Operating-branch authorization  

### Idempotency

- Operation: `release_report`  
- Same key + same request hash → safe replay  
- Same key + different hash → `idempotency_conflict` / HTTP 409  
- Already Released + new key → `invalid_state`  

### Concurrency

- Require `expectedRowVersion`  
- Stale → `concurrency_conflict` / HTTP 409  
- Concurrent Release → exactly one success  

### Audit

- Action: `RELEASE_REPORT`  
- Resource: `LmsReport`  
- Store: platform `audit_log` only  
- Fail-closed  
- Allowlist addition occurs **only** in the implementation task (not this closure)  

### UI

- Release action for eligible Final Report  
- Explicit confirmation  
- Honest Released state  
- Released actor / time  
- No Release action once already Released  

### Testing (minimum certification set)

- Draft cannot Release  
- Final can Release  
- Released cannot Release again  
- Same idempotency key replay  
- Idempotency hash conflict  
- Stale RowVersion 409  
- Concurrent Release exactly once  
- Audit failure leaves Report Final  
- Claims remain  
- ReportVersion unchanged  
- ResultStatus unchanged  
- CriticalResultEvent unchanged  
- Tenant / branch authorization  
- Permission enforcement  
- No role grants  
- No notification  
- No patient publication  
- No PDF  
- No numbering  
- No download  
- No Pathology effects  

---

## 9. Explicit out-of-scope (L-REP-02B implementation)

Do **NOT** implement under L-REP-02B (even after implementation authorization) without a new Product Owner stamp:

- PDF generation  
- Document rendering  
- CanonicalDocument association  
- Business Report numbering  
- Report download  
- Patient Portal publication  
- Patient 360 publication  
- Patient visibility  
- SMS / email / WhatsApp  
- NotificationHub intent  
- Notification delivery  
- Amendments  
- Corrected reports  
- Supersession  
- Unrelease  
- Revoke  
- Dual-control workflow  
- Signatory hierarchy  
- Release-authority configuration  
- Production role grants  
- ResultStatus changes  
- CriticalResultEvent changes  
- L-TST / L-VER / L-AUTH / L-CRT changes  
- Orders changes  
- Collection changes  
- Specimen / Receiving / Barcode changes  
- Pathology migration / bridge / dual-write  
- Patient Directory / Patient 360 SoT changes  
- Billing / insurance  
- Analytics  
- New organizational hierarchy  

---

## 10. Security / authorization boundary

| Layer | Requirement |
| --- | --- |
| Permission | `lms.reports.release` (catalogue code; enforce on endpoint) |
| Tenant | JWT tenant must match Report tenant |
| Operating branch | `ValidateUserBranch`; Report.OperatingBranchId must match requested branch |
| Cross-tenant Release | Forbidden |
| Cross-branch Release | Forbidden |
| Role grants | None in L-REP-02B |
| Signatory / release-authority config | Not required; do not invent |
| Dual control | Not required; do not invent |
| UI visibility | Not security — backend enforcement mandatory |

---

## 11. Audit / idempotency / concurrency requirements

| Concern | Binding rule |
| --- | --- |
| Audit action | `RELEASE_REPORT` |
| Audit resource | `LmsReport` |
| Audit store | Platform `audit_log` only |
| Audit failure | Fail-closed — Release must not remain persisted |
| Allowlist today | `RELEASE_REPORT` is **not** allowlisted; adding it is **implementation** work only |
| Idempotency operation | `release_report` |
| Idempotency same key + same hash | Safe replay |
| Idempotency same key + different hash | `idempotency_conflict` / HTTP 409 |
| Already Released + new key | `invalid_state` |
| Concurrency | `expectedRowVersion` required |
| Stale RowVersion | `concurrency_conflict` / HTTP 409 |
| Concurrent Release | Exactly one successful transition |

---

## 12. Failure semantics (PD-REP-02B-24 = A)

Release is **fail-closed**.

If audit or another required Release-side effect fails:

1. `Status` remains **Final**  
2. `ReleasedAtUtc` is **not** persisted  
3. `ReleasedByUserId` is **not** persisted  
4. Honest failure is returned  
5. **No** best-effort Release  

---

## 13. Regression / certification boundary

Any future L-REP-02B implementation must preserve:

- L-REP-01 Report Foundation  
- L-REP-02A Finalize (accepted behavior untouched by this closure)  
- L-TST / L-VER / L-AUTH / L-CRT  
- Orders / Collection / Specimen / Receiving / Barcode  
- Pathology LabReport coexistence (no dual-write)  
- Patient 360 / Patient Portal unrelated paths  
- CanonicalDocument unrelated associations  
- CriticalResultEvent behavior  
- Platform audit fail-closed pattern  
- No production role grants  

---

## 14. Explicit non-claims (this closure task)

This Product Decision Closure task:

- Did **not** start L-REP-02B implementation  
- Did **not** create a migration  
- Did **not** create a Release endpoint  
- Did **not** wire `lms.reports.release` enforcement  
- Did **not** add `RELEASE_REPORT` to the audit allowlist  
- Did **not** change schema, APIs, UI, permissions, or role grants  
- Did **not** modify L-REP-02A accepted runtime behavior  
- Does **not** claim PRE-UAT, Manual UAT, or ACCEPTED for Release  

---

## 15. Next gate

```text
PRODUCT_DECISIONS_CLOSED_L_REP_02B_AUTHORIZED
  → L-REP-02B IMPLEMENTATION AUTHORIZATION (separate task)
  → only then: metadata-only Release engineering
```

Until a separate implementation authorization task starts coding:

```text
IMPLEMENTATION_NOT_STARTED
```

STOP after this decision closure.  
Do **not** implement Release in this task.  
Do **not** start PDF, numbering, download, publication, notifications, Amendments, or any adjacent slice.

---

## 16. Final authorization stamp

```text
PRODUCT_DECISIONS_CLOSED_L_REP_02B_AUTHORIZED
IMPLEMENTATION_NOT_STARTED
CONFIGURATION_REQUIRED = NO
```

# PRODUCT_DECISIONS_CLOSED_L_REP_02B_AUTHORIZED

**IMPLEMENTATION_NOT_STARTED**
