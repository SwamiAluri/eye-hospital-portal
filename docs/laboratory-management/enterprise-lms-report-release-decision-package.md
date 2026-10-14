# L-REP-02B — Report Release  
## Product Decision Package

**Date:** 2026-10-12  
**Status:** `PRODUCT_OWNER_DECISION_REQUIRED`  
**Mode:** PRODUCT OWNER INPUT REQUIRED — **no implementation authorization**  
**Companion audit:** [enterprise-lms-report-release-discovery-audit.md](./enterprise-lms-report-release-discovery-audit.md)  

This package does **not** create a Product Decision Closure. It does **not** stamp APPROVED.  
**RECOMMENDED** options are engineering guidance only until Product Owner explicitly approves them in a Decision Closure.

---

## 1. Status

```text
PRODUCT_OWNER_DECISION_REQUIRED
```

Discovery stamp (companion): `DISCOVERY_COMPLETE_READY_FOR_PRODUCT_OWNER_DECISION`

Forbidden for this task: `IMPLEMENTATION_COMPLETE`, `READY_FOR_PRE_UAT`, `MANUAL_UAT_PASSED`, `ACCEPTED`.

---

## 2. Date

2026-10-12

---

## 3. Authoritative references

| Document | Role |
| --- | --- |
| [enterprise-lms-reporting-decision-closure.md](./enterprise-lms-reporting-decision-closure.md) | L-REP-01 binding principles |
| [enterprise-lms-report-finalize-decision-closure.md](./enterprise-lms-report-finalize-decision-closure.md) | L-REP-02A authorized + claim lifetime through Release |
| [enterprise-lms-report-finalization-acceptance-closure.md](./enterprise-lms-report-finalization-acceptance-closure.md) | `ACCEPTED_L_REP_02A` |
| [enterprise-lms-report-release-discovery-audit.md](./enterprise-lms-report-release-discovery-audit.md) | Post–L-REP-02A repository re-audit |
| Prior combined L-REP-02 package | Historical; superseded for Release-only decisions by this document |

---

## 4. Accepted L-REP-01 / L-REP-02A baseline

| Stamp | Meaning |
| --- | --- |
| `PRODUCT_DECISIONS_CLOSED_L_REP_01_AUTHORIZED` | Report foundation principles |
| `PRODUCT_DECISIONS_CLOSED_L_REP_02A_AUTHORIZED` | Finalize metadata authorized |
| `ACCEPTED_L_REP_02A` | Finalize implemented + Manual UAT accepted |

**Already closed (do not reopen without contradiction):**

- LaboratoryApi owns LMS Reports  
- ResultStatus never changed by Report ops  
- Released ≠ patient-visible (unless new PO stamp)  
- Release ≠ delivery / NotificationHub  
- Claims remain after Final **and** (per L-REP-02A §13) through future Release until Amendment policy  
- Amendments future  
- No Pathology dual-write  
- CanonicalDocument = downstream bytes only  
- Audit fail-closed; idempotency; RowVersion; tenant + branch  
- No invented numbering / templates / signatory hierarchy  
- No automatic Release from Final  

---

## 5. Repository discovery summary

| Area | Reality after L-REP-02A |
| --- | --- |
| Final | Implemented and accepted |
| Released constant | Exists; never set |
| Release API / UI / DTO / entity metadata | **Absent** |
| `lms.reports.release` | Catalogue only; not enforced |
| `RELEASE_REPORT` allowlist | **Absent** |
| PDF / numbering / download / publication | **Absent** for LmsReport |
| Pathology LabReport | Separate; **RED** as LMS SoT |

---

## 6. Current Release readiness

| Question | Answer |
| --- | --- |
| Can Release be implemented now? | **No** — Product Owner decisions required |
| Can metadata-only Release be designed without new master data? | **Yes, if** PO stamps authority Option A (permission + tenant + branch) |
| Can PDF-capable Release be implemented now? | **No** — **CONFIGURATION_REQUIRED** (templates/branding) |
| Can numbered Release be implemented now? | **No** — **CONFIGURATION_REQUIRED** (sequence/format) |
| Can patient-visible Release be implemented now? | **No** — portal backend + publication policy missing |

---

## 7. Current schema / API / UI state

| Layer | State |
| --- | --- |
| Schema | Final metadata present; no Released* columns |
| API | Finalize only; no `/release` |
| UI | Finalize panel; honesty “Release not implemented” |
| Authz | `ReportsRelease` constant unused |
| Audit | `FINALIZE_REPORT` only among Finalize/Release |

---

## 8. Existing reusable infrastructure

See discovery §20 (GREEN / YELLOW / RED).

Primary GREEN template: mirror `FinalizeAsync` (idempotency, RowVersion, fail-closed audit, branch validation, FE confirmation panel).

---

## 9. GREEN / YELLOW / RED classification (summary)

| Class | Examples |
| --- | --- |
| GREEN | LaboratoryApi Report SoT; Finalize pattern; platform audit; permission catalogue code |
| YELLOW | CanonicalDocument bytes; QuestPDF patterns; notification intent pattern; claim lifetime reconfirm |
| RED | Pathology LabReport SoT; inventing hierarchy/number/templates; Released=patient-visible |

---

## 10. Configuration dependencies

Mark **CONFIGURATION_REQUIRED** when PO chooses options that need missing governed config:

| Config | Triggering choice |
| --- | --- |
| Release/signatory authority matrix | Authority ≠ Option A |
| Dual-control Finalizer ≠ Releaser | Dual-control required |
| Report number sequence/format | Number at Final or Release |
| Templates / branding | PDF required at Release |
| Publication / portal policy | Patient-visible or Patient 360 publication |

Do **not** create configuration in discovery. Do **not** seed fake config or role grants.

---

## 11. Release lifecycle proposal (RECOMMENDED — not approved)

```text
Draft → Final (ACCEPTED_L_REP_02A)
         ↓  explicit actor action + lms.reports.release
      Released
         ↓  (future slices)
      PDF / number / download / notification intent / publication / Amendments
```

**Recommended mechanics:**

- Eligibility: `Status == Final` only (Draft rejected)  
- Report-level transition (not per ResultVersion)  
- Current Final ReportVersion remains the released content  
- No new ReportVersion on Release  
- No content mutation  
- Forward-only (no Unrelease in L-REP-02B)  
- Claims unchanged  
- ResultStatus / CriticalResultEvent unchanged  

---

## 12. Product Decision tables

### PD-REP-02B-01 — Release slice packaging

| Option | Meaning |
| --- | --- |
| **A (RECOMMENDED)** | L-REP-02B = metadata Release only; PDF/number/download/publication/notification later |
| **B** | L-REP-02B includes PDF document generation |
| **C** | L-REP-02B includes business Report number |
| **D** | Larger combined slice (PDF + number + download) — requires all config gates green |

**Ask:** Which packaging is authorized?

---

### PD-REP-02B-02 — Release eligibility

| Option | Meaning |
| --- | --- |
| **A (RECOMMENDED)** | Only `Status == Final` may be Released |
| **B** | Draft may be Released (violates binding Final-first principle — not recommended) |

**Ask:** A or B?

---

### PD-REP-02B-03 — Release state transition

| Option | Meaning |
| --- | --- |
| **A (RECOMMENDED)** | `Status` Final → Released; store ReleasedAtUtc + ReleasedByUserId (server UTC / actor) |
| **B** | Released tracked only by side table / flag without Status change |

**Ask:** A or B?

---

### PD-REP-02B-04 — Release version behavior

| Option | Meaning |
| --- | --- |
| **A (RECOMMENDED)** | Release freezes/uses **current** Final ReportVersion; **no** new ReportVersion |
| **B** | Release creates a new ReportVersion that becomes the Released content |

**Ask:** A or B?

---

### PD-REP-02B-05 — Release authority

| Option | Meaning |
| --- | --- |
| **A (RECOMMENDED for metadata-only)** | `lms.reports.release` + tenant + operating-branch authorization is sufficient |
| **B** | Additional governed release/signatory authority required → **CONFIGURATION_REQUIRED** (no such LMS SoT found) |
| **C** | Block Release until authority configuration is built → **CONFIGURATION_REQUIRED** |

**Ask:** A, B, or C?  
**Repository note:** OPTION B infrastructure for LMS Reports = **NOT FOUND**.

---

### PD-REP-02B-06 — Same-person / dual control

| Option | Meaning |
| --- | --- |
| **A (RECOMMENDED)** | Same person may Finalize and Release (no invented dual-control) |
| **B** | Releaser must differ from Finalizer (`FinalizedByUserId`) |
| **C** | Multi-signatory required → **CONFIGURATION_REQUIRED** (not in repository) |

**Ask:** A, B, or C?  
**Repository note:** No existing LMS dual-control rule for Finalizer vs Releaser.

---

### PD-REP-02B-07 — Release reversibility

| Option | Meaning |
| --- | --- |
| **A (RECOMMENDED)** | L-REP-02B is forward-only; Unrelease/Revoke/Correct are future governed scope |
| **B** | Unrelease/Revoke in same slice (requires full reverse policy — not found) |

**Ask:** A or B?

---

### PD-REP-02B-08 — Business Report number

| Option | Meaning |
| --- | --- |
| **A (RECOMMENDED)** | GUID remains Report identity; business number later |
| **B** | Number assigned at Final (already closed for L-REP-02A as not done — would be new work) |
| **C** | Number assigned at Release → **CONFIGURATION_REQUIRED** (no sequence/format) |

**Ask:** A, B, or C?  
Do **not** invent prefix/date/counter/branch/fiscal/check-digit/reset.

---

### PD-REP-02B-09 — PDF / document requirement

| Option | Meaning |
| --- | --- |
| **A (RECOMMENDED)** | Metadata Release only; document generation later |
| **B** | Release **requires** generated document bytes before Status=Released → **CONFIGURATION_REQUIRED** |
| **C** | Release **includes** document generation in-slice → **CONFIGURATION_REQUIRED** |

**Ask:** A, B, or C?  
Separate: Report clinical SoT ≠ rendered document ≠ CanonicalDocument bytes ≠ download ≠ publication.

---

### PD-REP-02B-10 — Download behavior

| Option | Meaning |
| --- | --- |
| **A (RECOMMENDED)** | No download in L-REP-02B |
| **B** | Download only after Release (depends on document source) |
| **C** | Browser print of structured snapshot only (no persisted PDF) |
| **D** | Download persisted document bytes (depends on PD-REP-02B-09) |

**Ask:** A–D?

---

### PD-REP-02B-11 — Notification intent

| Option | Meaning |
| --- | --- |
| **A (RECOMMENDED)** | Release emits **no** notification intent in L-REP-02B |
| **B** | Release emits platform notification intent (type/contract TBD; delivery still separate) |
| **C** | Notification/delivery entirely separate future slice (equivalent to A for this slice) |

**Ask:** A, B, or C?  
Do **not** send SMS/email/WhatsApp in L-REP-02B.

---

### PD-REP-02B-12 — Patient visibility / publication

| Option | Meaning |
| --- | --- |
| **A (RECOMMENDED)** | Released remains **staff-only**; not patient-visible |
| **B** | Discoverable by Patient 360 only (staff-facing) — still not patient portal |
| **C** | Become patient-visible → contradicts binding principle unless explicitly overridden; portal backend **NOT FOUND** → **CONFIGURATION_REQUIRED** |
| **D** | Separate publication workflow (future slice) |

**Ask:** A–D?  
Binding default remains: Released ≠ patient-visible.

---

### PD-REP-02B-13 — Source claim lifetime

| Option | Meaning |
| --- | --- |
| **A (RECOMMENDED / L-REP-02A already stamped)** | Claims remain permanently until future Amendment policy; Release does not drop claims |
| **B** | Release changes claim state (specify how) |
| **C** | Other governed behavior (specify) |

**Ask:** Confirm A, or override with B/C?  
**Note:** L-REP-02A Decision Closure §13 already stamped claims remain through Release. Override requires explicit PO contradiction stamp.

---

### PD-REP-02B-14 — Amendment dependency

| Option | Meaning |
| --- | --- |
| **A (RECOMMENDED)** | Release may proceed without Amendments implemented |
| **B** | Amendments must exist before Release |

**Ask:** A or B?

---

### PD-REP-02B-15 — Multi-result release semantics

| Option | Meaning |
| --- | --- |
| **A (RECOMMENDED)** | Release applies to the **whole Report** aggregate |
| **B** | Individual source ResultVersions may be Released independently |
| **C** | Partial Release of a multi-result Report allowed |

**Ask:** A, B, or C?  
Source ResultStatuses may differ historically, but Report Release is Report-scoped under Option A.

---

### PD-REP-02B-16 — Idempotency

| Option | Meaning |
| --- | --- |
| **A (RECOMMENDED)** | Operation `release_report`; same key+hash → safe replay; same key+different hash → 409; already Released with new key → `invalid_state` (mirror Finalize) |

**Ask:** Confirm A or specify alternate?

---

### PD-REP-02B-17 — Optimistic concurrency

| Option | Meaning |
| --- | --- |
| **A (RECOMMENDED)** | Require `expectedRowVersion`; stale → 409 `concurrency_conflict`; concurrent Release succeeds exactly once |

**Ask:** Confirm A?

---

### PD-REP-02B-18 — Audit behavior

| Option | Meaning |
| --- | --- |
| **A (RECOMMENDED)** | Action `RELEASE_REPORT` / resource `LmsReport`; platform `audit_log` only; **fail-closed** (revert Release on audit failure) |

**Ask:** Confirm A?  
**Repository:** `RELEASE_REPORT` not currently allowlisted — implementation task must add it (not this package).

Suggested audit details (from Finalize pattern; not inventing new PHI fields): actor, tenant, branch, ReportId, ReportVersion number, action, outcome, timestamp, operatingBranchId.

---

### PD-REP-02B-19 — Tenant / branch authorization

| Option | Meaning |
| --- | --- |
| **A (RECOMMENDED)** | Same as Finalize: JWT tenant + `ValidateUserBranch` + Report.OperatingBranchId must match request branch; no cross-tenant / cross-branch Release |

**Ask:** Confirm A?

---

### PD-REP-02B-20 — Permission grants

| Option | Meaning |
| --- | --- |
| **A (RECOMMENDED)** | Enforce `lms.reports.release` on endpoint; **no production role grants** in L-REP-02B |
| **B** | Add role grants in-slice (**forbidden** by L-REP-01/02A pattern unless explicit PO override) |

**Ask:** Confirm A?

---

### PD-REP-02B-21 — Release vs notification / delivery separation

| Option | Meaning |
| --- | --- |
| **A (RECOMMENDED)** | Release ≠ notification intent ≠ delivery ≠ patient communication; keep separated |

**Ask:** Confirm A? (Aligns with PD-REP-02B-11.)

---

### PD-REP-02B-22 — Artifact immutability

| Option | Meaning |
| --- | --- |
| **A (RECOMMENDED)** | Released Report content (current ReportVersion snapshots) remains immutable; corrections → future Amendments / new ReportVersion policy |
| **B** | Allow content edit after Release (not recommended) |

**Ask:** A or B?

---

### PD-REP-02B-23 — Report identity / business number relationship

| Option | Meaning |
| --- | --- |
| **A (RECOMMENDED)** | Technical identity remains GUID; business number (if ever) is separate attribute; Order/Accession numbers are **not** Report numbers |
| **B** | Promote Order number as Report number (**RED** reuse without explicit stamp) |

**Ask:** A or B?

---

### PD-REP-02B-24 — Release failure semantics

| Option | Meaning |
| --- | --- |
| **A (RECOMMENDED)** | On audit (or required side-effect) failure: fail closed; Status remains Final; no ReleasedAt/By persisted; honest error (mirror Finalize `audit_unavailable`) |
| **B** | Best-effort Release even if audit fails (**forbidden** by fail-closed principle) |

**Ask:** Confirm A?

---

## 13. Recommended options (rollup — NOT APPROVED)

| Decision | Recommended |
| --- | --- |
| 01 Packaging | A — metadata only |
| 02 Eligibility | A — Final only |
| 03 Transition | A — Status + ReleasedAt/By |
| 04 Version | A — no new ReportVersion |
| 05 Authority | A — permission + tenant + branch |
| 06 Dual control | A — same person permitted |
| 07 Reversibility | A — forward-only |
| 08 Number | A — GUID only for now |
| 09 PDF | A — later |
| 10 Download | A — none in slice |
| 11 Notification | A — none in slice |
| 12 Patient visibility | A — staff-only |
| 13 Claims | A — remain (reconfirm L-REP-02A) |
| 14 Amendments | A — not required first |
| 15 Multi-result | A — whole Report |
| 16–19 | A — mirror Finalize patterns |
| 20 Grants | A — none |
| 21 Separation | A — keep separate |
| 22 Immutability | A — immutable |
| 23 Identity | A — GUID ≠ order/accession |
| 24 Fail-closed | A — fail closed |

---

## 14. Explicit unanswered Product Owner questions

1. Is L-REP-02B metadata-only, or must PDF/numbering/download be included?  
2. Is `lms.reports.release` + tenant + branch sufficient authority, or is CONFIGURATION_REQUIRED?  
3. May the same person Finalize and Release?  
4. Forward-only Release for this slice?  
5. Confirm Released remains staff-only / not patient-visible?  
6. Any notification intent at Release?  
7. Confirm claims remain after Release (L-REP-02A stamp)?  
8. Confirm Report-level (not per-source) Release?  
9. Confirm fail-closed audit + `release_report` idempotency + RowVersion?  
10. Confirm no production role grants?

---

## 15. Implementation boundary proposal (after closure only)

**In-scope candidate (if recommendations stamped):**

- Schema: Released metadata columns  
- `POST /api/lms/reports/{id}/release`  
- Enforce `lms.reports.release`  
- Idempotency `release_report`  
- Audit `RELEASE_REPORT` allowlist + fail-closed  
- UI: Release confirmation on Final reports  
- Tests + PRE-UAT docs  

**Still out of scope even after metadata authorization:**

- PDF / CanonicalDocument attach  
- Business numbering  
- Download  
- Patient Portal / Patient 360 publication  
- Notification delivery / SMS  
- Amendments / Unrelease  
- Pathology bridge  
- Role grants  
- ResultStatus / L-TST / L-VER / L-AUTH / L-CRT / Orders / Collection / Specimen changes  

---

## 16. Explicit out-of-scope items

L-REP-03+, PDF, numbering, download, publication, NotificationHub delivery, Amendments, Unrelease/Revoke, Pathology LabReport changes, Patient Portal backend, CanonicalDocument association for LmsReport (unless separately authorized), inventing signatory hierarchies.

---

## 17. Security / authorization considerations

- Permission catalogue already contains `lms.reports.release` — wire, do not invent new code unless needed  
- No role grants by default  
- Tenant + operating branch mandatory  
- Hidden UI is not security — backend enforcement required  
- Dual-control must not be faked without CONFIGURATION_REQUIRED resolution  

---

## 18. Audit requirements

| Item | Requirement if Option A stamped |
| --- | --- |
| Action | `RELEASE_REPORT` |
| Resource | `LmsReport` |
| Store | Platform `audit_log` |
| Failure | Fail closed |
| Allowlist | Must be added in implementation task |

---

## 19. Idempotency / concurrency requirements

| Item | Requirement if Option A stamped |
| --- | --- |
| Operation | `release_report` |
| Concurrency | `expectedRowVersion` → 409 on stale |
| Concurrent Release | Exactly one success |

---

## 20. Patient visibility boundary

Default binding: **Released ≠ patient-visible**.  
Any change requires explicit PD-REP-02B-12 override + publication architecture.

---

## 21. Notification / delivery boundary

Release ≠ intent ≠ orchestration ≠ patient communication.  
Critical Results notification pattern is reusable infrastructure only (YELLOW).

---

## 22. PDF / document boundary

No LMS Report PDF SoT today.  
CanonicalDocument is downstream bytes (YELLOW), not clinical Report SoT (RED).  
Pathology LabReport attach pattern is **RED** as LMS SoT.

---

## 23. Numbering boundary

No `LmsReportNumberSequence`.  
Do not reuse Order/Accession as Report number without explicit stamp.  
CONFIGURATION_REQUIRED for Options B/C of PD-REP-02B-08.

---

## 24. Pathology coexistence boundary

Parallel models; no dual-write; no replacement; no migration of LabReport → LmsReport in L-REP-02B.

---

## 25. Regression boundary

Any future implementation must preserve:

L-REP-01, L-REP-02A, L-TST, L-VER, L-AUTH, L-CRT, L-COL, Orders, Specimen/Receiving/Barcode, Pathology, Patient 360 legacy paths, CanonicalDocument unrelated associations.

---

## 26. No implementation statement

This Product Decision Package authorizes **zero** engineering change.

- No migration / schema / API / UI  
- No permission or role grants  
- No audit allowlist mutation  
- No notification / PDF / numbering / publication  
- L-REP-02A remains untouched  

---

## 27. Next gate

```text
Product Owner reviews this package
  → stamps decisions (APPROVED / REJECTED / CONFIGURATION_REQUIRED)
  → separate Product Decision Closure document
  → only then: L-REP-02B implementation authorization
```

Until Decision Closure exists:

```text
PRODUCT_OWNER_DECISION_REQUIRED
```

Do **not** start L-REP-02B implementation.  
Do **not** start PDF, numbering, download, patient publication, notification delivery, or Amendments.
