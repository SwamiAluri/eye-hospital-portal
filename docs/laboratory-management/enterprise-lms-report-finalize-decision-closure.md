# L-REP-02A — Report Finalization (Metadata Only)  
# Product Decision Closure

**Date:** 2026-10-12  
**Slice:** L-REP-02A (Report Finalization — metadata only)  
**Mode:** DOCUMENTATION / PRODUCT OWNER APPROVAL ONLY — no application source, schema, migrations, APIs, DTOs, services, UI, routes, PDF, CanonicalDocument, numbering, NotificationHub, Amendments, permission seed/grant changes, audit allowlist changes, ResultStatus changes, L-AUTH / L-VER / L-TST / L-CRT, Collection / Specimen / Orders, Pathology, Patient Portal / Patient 360 publication, or Release (L-REP-02B) implementation  

**Discovery audit:** [enterprise-lms-report-final-release-discovery-audit.md](./enterprise-lms-report-final-release-discovery-audit.md)  
**Decision package:** [enterprise-lms-report-final-release-decision-package.md](./enterprise-lms-report-final-release-decision-package.md)  
**Upstream L-REP-01 closure:** [enterprise-lms-reporting-decision-closure.md](./enterprise-lms-reporting-decision-closure.md) (`PRODUCT_DECISIONS_CLOSED_L_REP_01_AUTHORIZED`)  
**Discovery status superseded for stamped items:** `DISCOVERY_COMPLETE_READY_FOR_PRODUCT_OWNER_DECISION`

```text
L-REP-01 Report Foundation (certified)
  + Draft source uniqueness (PD-REP-DRAFT-UNIQUE-01)
  ↓
L-REP-02 Discovery / Decision Package
  ↓
PD-REP-02-* (THIS DOCUMENT) ← PRODUCT OWNER APPROVED (2026-10-12, outside Cursor)
  ↓
L-REP-02A — REPORT FINALIZATION (METADATA ONLY)
  ← AUTHORIZED FOR SEPARATE IMPLEMENTATION TASK
  ← NOT IMPLEMENTED BY THIS DOCUMENT
  ↓
Later (not authorized by this document):
  L-REP-02B Release metadata
  L-REP-02C PDF / CanonicalDocument downstream
  L-REP-02D Business Report Number
  Amendments · notification delivery · patient publication
```

---

## 1. Product Owner approval statement

Product Owner has **explicitly approved** the L-REP-02A Product Decisions recorded in this document, based on:

- [enterprise-lms-report-final-release-discovery-audit.md](./enterprise-lms-report-final-release-discovery-audit.md)
- [enterprise-lms-report-final-release-decision-package.md](./enterprise-lms-report-final-release-decision-package.md)
- Certified L-REP-01 Report Foundation and Draft source-uniqueness correction

with authorization provided **outside Cursor**.

| Class | Meaning |
| --- | --- |
| **APPROVED** | Product Owner approved for L-REP-02A (and noted future-slice stamps where stated) |
| **OUT_OF_SCOPE** | Explicitly outside L-REP-02A implementation |
| **FUTURE SLICE** | Authorized as a principle for a later slice; **not** implementation authorization here |

**This document does not implement L-REP-02A.**

Certified upstream L-REP-01 decisions are **not reopened**.

---

## 2. Decision register

| ID | Topic | Stamp | Option |
| --- | --- | --- | --- |
| **PD-REP-02-01** | Slice packaging | **APPROVED** | **A** — 02A Finalize → 02B Release → 02C PDF → 02D Numbering |
| **PD-REP-02-02** | Finalize freeze mechanics | **APPROVED** | **A** — Status=Final on current version; no new ReportVersion |
| **PD-REP-02-03** | Live Result re-validation | **APPROVED** | **A** — Trust immutable snapshots + claims |
| **PD-REP-02-04** | Finalize authority | **APPROVED** | **A** — `lms.reports.finalize` + tenant + operating branch |
| **PD-REP-02-05** | Release authority (future 02B) | **APPROVED** (principle) | **A** — `lms.reports.release` + tenant + branch; **does not authorize 02B implementation** |
| **PD-REP-02-06** | Same-person / multi-signatory | **APPROVED** | **A** — No same-person restriction; no dual control |
| **PD-REP-02-07** | PDF / document | **APPROVED** | **A** — Out of 02A and 02B |
| **PD-REP-02-08** | Business Report Number | **APPROVED** | **A** — GUID sufficient; numbering deferred |
| **PD-REP-02-09** | Release ReportVersion (future 02B) | **APPROVED** (principle) | **A** — Metadata on existing Final version |
| **PD-REP-02-10** | Notification intent | **APPROVED** | **A** — No NotificationHub from 02A/02B |
| **PD-REP-02-11** | Draft source claim lifetime | **APPROVED** | **A** — Claims remain after Final/Release |
| **PD-REP-02-12** | Amendments prerequisite | **APPROVED** | **A** — Final/Release without Amendment workflow |
| **PD-REP-02-13** | Download | **APPROVED** | **A** — No download in 02A/02B |
| **PD-REP-02-14** | Permission grants | **APPROVED** | **A** — No role/user grants |

---

## 3. L-REP-01 certified boundaries (preserved)

The following remain binding and unchanged:

| Boundary | Status |
| --- | --- |
| LaboratoryApi owns LMS Report SoT | Preserved |
| Exact ResultVersion provenance + immutable snapshots | Preserved |
| Multi-result same patient/order context | Preserved |
| Draft source uniqueness claims (PD-REP-DRAFT-UNIQUE-01) | Preserved |
| Result lifecycle Draft → TechnicalVerified → ClinicallyAuthorized | Preserved |
| Report lifecycle Draft → Final → Released (Report domain only) | Preserved |
| No Final/Released/Published on `ResultStatus` | Preserved |
| No auto Report create/Finalize/Release from Clinical Authorization | Preserved |
| CanonicalDocument not Report SoT | Preserved |
| Pathology LabReport separate boundary | Preserved |
| Platform `audit_log` SoT; fail-closed governed mutations | Preserved |
| Tenant + operating-branch authorization patterns | Preserved |
| Permission catalogue family without `lms.reports.publish` | Preserved |

---

## 4. L-REP-02A authorized scope

**Authorized next engineering direction (separate implementation task):**

**L-REP-02A — REPORT FINALIZATION (METADATA ONLY)**

| In scope | Out of scope (this closure) |
| --- | --- |
| Transition Draft → Final | Release (L-REP-02B) |
| Finalization actor + timestamp | PDF / document / CanonicalDocument |
| Freeze current ReportVersion (no new version) | Business Report Number |
| Block Append / Draft mutation after Final | Download |
| `lms.reports.finalize` enforcement | NotificationHub / SMS / email / WhatsApp |
| Tenant + operating-branch authorization | Patient Portal / Patient 360 publication |
| RowVersion concurrency | Amendments / supersession / void |
| Operation-specific idempotency `finalize_report` | ResultStatus changes |
| Platform audit `FINALIZE_REPORT` (fail-closed) | L-AUTH / L-VER / L-TST / L-CRT / Orders / Collection / Specimen |
| Deterministic conflict handling | Pathology / Billing / Analytics |
| Final status + Finalize action in existing Reports UI | Production role grants |
| Honest unauthorized / concurrency / validation UX | Multi-signatory / invented hierarchies |

---

## 5. Finalization state transition

```text
Draft Report
    ↓  Finalize (L-REP-02A)
Final Report
    ↓  (future L-REP-02B — not authorized here)
Released Report
```

### Eligibility (authorized rules)

A Report may be Finalized only when:

1. Report exists  
2. Report belongs to the authenticated tenant  
3. Report operating branch is authorized for the actor  
4. Report status is **Draft**  
5. Current ReportVersion exists  
6. Report has valid bound ResultVersion sources (L-REP-01 snapshots)  
7. Actor holds `lms.reports.finalize`  

### Freeze mechanics (PD-REP-02-02 = A)

- Set `Report.Status = Final`  
- Bind Finalization to the **current** ReportVersion  
- **Do not** create a new ReportVersion  
- Source snapshots remain immutable  
- `LmsResult` / `LmsResultVersion` are never mutated  

### Post-Final allowed

- View / discover / read version history / read frozen snapshot  
- Future Release operation (L-REP-02B only, separately authorized)

### Post-Final forbidden

- Append ReportVersion  
- Edit Report content or source snapshots  
- Replace source ResultVersion  
- Change ResultStatus  
- Create another Draft from the claimed ResultVersion (claims remain — PD-REP-02-11)

---

## 6. Authority model

### Finalize (L-REP-02A) — PD-REP-02-04 = A

| Layer | Requirement |
| --- | --- |
| Permission | `lms.reports.finalize` |
| Tenant | Authenticated tenant owns the Report |
| Operating branch | Actor authorized for Report.OperatingBranchId |

**Forbidden to invent:** doctor, laboratory/section, credential, specialty, on-call, or delegation hierarchies.

### Release authority principle (PD-REP-02-05 = A) — FUTURE SLICE ONLY

For a future metadata-only L-REP-02B:

`lms.reports.release` + tenant + authorized operating branch.

This **explicitly resolves** the prior PD-REP-15 configuration gate for **metadata-only Release**.  
It does **not** authorize L-REP-02B implementation in this document.  
It does **not** authorize PDF, numbering, publication, or notification.

---

## 7. Same-person rule (PD-REP-02-06 = A)

| Rule | Status |
| --- | --- |
| Draft creator may Finalize | **Allowed** |
| Draft creator may Release (future 02B) | **Allowed** |
| Mandatory second-person approval | **Not required** |
| Multi-signatory | **Not required** |
| Dual control | **Do not invent** |

---

## 8. Freeze mechanics summary

| Action | Behavior |
| --- | --- |
| Finalize | Status → Final; current ReportVersion frozen |
| New ReportVersion on Finalize | **Forbidden** |
| Append after Final | **Forbidden** |
| Draft mutation after Final | **Forbidden** |
| Source snapshot edit | **Forbidden** |
| ResultVersion mutation | **Forbidden** |

---

## 9. Provenance rule (PD-REP-02-03 = A)

Finalize **trusts** already-bound immutable ResultVersion snapshots and existing Draft source claims.

Finalize does **not** require a fresh live `ResultStatus == ClinicallyAuthorized` re-query solely for Finalization.

This does **not** permit:

- Editing source ResultVersion  
- Changing ResultStatus or Result data  
- Bypassing original L-REP-01 source eligibility rules used at Draft creation  

No new ResultStatus values. No mutation of Order, OrderTest, Specimen, or CriticalResultEvent.

---

## 10. Idempotency

| Item | Authorization |
| --- | --- |
| Operation | `finalize_report` |
| Same key + same request | Safe replay |
| Same key + different request | Deterministic **409** |
| Retry/backoff policy | **Do not invent** |

---

## 11. Concurrency

| Item | Authorization |
| --- | --- |
| Mechanism | Existing Report `RowVersion` optimistic concurrency |
| Stale RowVersion | Deterministic **409** concurrency conflict |
| Client timestamps as authority | **Forbidden** |

---

## 12. Audit

| Item | Authorization |
| --- | --- |
| Action | `FINALIZE_REPORT` |
| Store | Platform `audit_log` only |
| Failure | **Fail closed** — no successful Final if required audit cannot be written |
| Second audit store | **Forbidden** |

Allowlist/seed changes occur only in a future implementation task (not this closure).

---

## 13. Source-claim lifetime (PD-REP-02-11 = A)

Existing `lms_report_draft_source_claims` remain after Final and (future) Release.

A ResultVersion already claimed must **not** become eligible for another Draft Report merely because the Report became Final or Released.

Claims remain until a future governed Amendment/supersession policy explicitly changes that behavior.

**Amendments are not implemented by L-REP-02A** (PD-REP-02-12 = A).

---

## 14. UI boundary

Future L-REP-02A implementation **may** add within existing Reports UI:

- Final status badge  
- Finalize action + confirmation  
- Finalized actor / time  
- Disabled append/edit after Final  
- Concurrency / permission / validation error states  

**Must not** add in L-REP-02A:

- Release action  
- PDF / Download buttons  
- Patient publication  
- Notification actions  

---

## 15. Explicit out-of-scope

Do **NOT** implement under this closure or under L-REP-02A implementation without a new authorization:

- Release (L-REP-02B)  
- PDF / document generation / templates / branding  
- CanonicalDocument attach or streaming  
- Report numbering  
- Download  
- Patient Portal / Patient 360 publication  
- NotificationHub / SMS / email / WhatsApp  
- Amendments / corrected reports / supersession / void  
- `ResultStatus` Final / Released / Published  
- Clinical Authorization / Verification / Testing / Critical changes  
- Collection / Specimen / Receiving / Barcode / Orders  
- Pathology migration or dual-write  
- Billing / Analytics  
- Production role grants / `lms.reports.publish`  
- Invented signatory hierarchies  

---

## 16. L-REP-02B future boundary

| Topic | Status under this closure |
| --- | --- |
| Metadata Release authority model (PD-REP-02-05) | **APPROVED principle** |
| Release creates no new ReportVersion (PD-REP-02-09) | **APPROVED principle** |
| No notification intent (PD-REP-02-10) | **APPROVED** for 02A/02B |
| No PDF / numbering / download (PD-REP-02-07/08/13) | **APPROVED** for 02A/02B |
| L-REP-02B implementation | **Not authorized** — requires separate implementation authorization after L-REP-02A acceptance |

---

## 17. Implementation gate

A separate engineering task may implement **only** L-REP-02A as bounded above.

Before coding, the implementation task must:

1. Inspect the certified L-REP-01 Report aggregate and uniqueness claims  
2. Preserve all L-REP-01 boundaries  
3. Implement Draft → Final metadata transition only  
4. Stop without starting L-REP-02B, PDF, numbering, publication, or Amendments  

If an unexpected configuration dependency appears that would require inventing policy outside this stamp, **STOP** and report rather than inventing.

---

## 18. Explicit non-claims

This closure task:

- Did **not** implement Finalization  
- Did **not** change schema, migrations, APIs, UI, or permissions  
- Did **not** modify audit allowlists  
- Did **not** implement Release  
- Did **not** grant roles  
- Does **not** claim PRE-UAT, Manual UAT, or ACCEPTED  

---

## 19. Final authorization stamp

```text
PRODUCT_DECISIONS_CLOSED_L_REP_02A_AUTHORIZED
IMPLEMENTATION_NOT_STARTED
```

**Required final status:**

# PRODUCT_DECISIONS_CLOSED_L_REP_02A_AUTHORIZED

STOP after this decision closure.  
Do **not** implement L-REP-02A in this task.  
Do **not** start L-REP-02B.
