# Phase 3I — Program Product Decision
## Program Boundary / Closure Decision

### 1. Decision Metadata

| Field | Value |
|-------|--------|
| **Date** | 2026-09-22 |
| **Program** | Hospital Portal — Counsellor Ownership & Work Allocation |
| **Phase** | Phase 3I |
| **Current Slice** | Slice 13 — **FORMALLY CLOSED** |
| **Decision Type** | **PROGRAM BOUNDARY / CLOSURE PRODUCT DECISION** |
| **Mode** | **PRODUCT DECISION ONLY** — no production code, API, DB, permission, ownership, UI, route, UAT, or implementation |
| **Current Program Status** | **FORMALLY CLOSED** — Product Owner accepted **OPTION A** |
| **Current Slice 13 Status** | **CLOSED** |
| **Approved Slice 14** | **DOES NOT EXIST** |
| **Implementation authorized by this document** | **NO** |
| **Document status** | **PRODUCT DECISION ACCEPTED — OPTION A** |
| **Option A accepted** | **YES** |
| **Option B accepted** | **NO** |
| **Phase 3I formally closed** | **YES** |
| **Additional Phase 3I scope authorized** | **NO** |

---

### 2. Authoritative Sources

| Artifact | Role |
|----------|------|
| `docs/audits/counsellor-ownership-work-allocation-phase3i-program-status-next-gate-audit.md` | **Primary** — program status; next gate = Phase 3I Product Decision; no approved next slice |
| `docs/audits/counsellor-ownership-work-allocation-phase3i-slice13-closure.md` | Slice 13 formal closure |
| `docs/audits/counsellor-ownership-work-allocation-phase3i-slice13-closure-readiness-audit.md` | Slice 13 remaining decision surface |
| `docs/audits/phase3i-slice13-package-b-acceptance.md` | Package B Delivery Accepted |
| `docs/audits/counsellor-ownership-work-allocation-phase3i-slice13-product-decisions.md` | Slice 13 PDs (Package B + OUT OF PACKAGE / deferred) |
| `docs/audits/phase3i-slice12-acceptance.md` | Slice 12 Delivery Accepted |
| `docs/audits/counsellor-ownership-work-allocation-phase3i-implementation-readiness-audit.md` | Original Phase 3I roadmap (Slices 1→12) |

**Historical documentation context (not rewritten):** Early slice reports may still say “READY FOR MANUAL UAT / do not start next slice” while later gates progressed. Stale stop language is historical context only. Program-status language that described Phase 3I as remaining open pending Option A / Option B is superseded by this accepted Option A record.

---

### 3. Certified Phase 3I Scope

The following ownership / work-allocation delivery scope is **certified and closed**. It must **not** be reopened without a new explicit Product Decision:

| Area | Status |
|------|--------|
| Waiting List PD16 branch authorization | Certified / closed |
| Removal of implicit ownership from Start | Certified / closed |
| Explicit Assign | Certified / closed |
| Owner mutation ACL | Certified / closed |
| Ownership History / Audit | Certified / closed |
| Reassign | Certified / closed |
| Optimistic concurrency / CAS / 409 | Certified / closed |
| ReQueue → `CounselorId` NULL | Certified / closed |
| Finalize / Post-Surgery **boundary honesty** | Certified / closed (assignment deferred separately) |
| Follow-up shared ownership model | Certified / closed |
| Analytics My Work reporting-only model | Certified / closed |
| Leave / Reassignment Required behavior | Certified / closed (Slice 12) |
| Slice 13 Sessions RR Reassign | Certified / closed (Package B) |
| Counsellor Sessions navigation | Certified / closed (Package B) |
| Sessions UX remediation | Certified / closed (Package B) |
| Sessions pagination | Certified / closed (Package B) |

```text
Approved Phase 3I delivery scopes (Slices 1–13 as reconciled):
NO AUTHORIZED UNFINISHED IMPLEMENTATION PACKAGE REMAINS.
```

---

### 4. Certified Ownership Model

**Locked.** Do not alter without a new explicit Product Decision.

| Rule | Status |
|------|--------|
| `CounselorId` = ownership SoT | **LOCKED** |
| `CreatedByUserId` ≠ ownership | **LOCKED** |
| Opening / viewing / starting ≠ ownership | **LOCKED** |
| Explicit assignment establishes ownership | **LOCKED** |
| Reassign transfers ownership | **LOCKED** |
| ReQueue clears ownership (`CounselorId` NULL) | **LOCKED** |
| CAS / version / 409 remains authoritative | **LOCKED** |
| Ownership History remains authoritative | **LOCKED** |
| PD16 branch authorization remains authoritative | **LOCKED** |
| Inactive target protection remains authoritative | **LOCKED** |
| No automatic leave transfer | **LOCKED** |
| No automatic `CounselorId` clear | **LOCKED** |
| No automatic ReQueue | **LOCKED** |
| No new Supervisor role | **LOCKED** |
| No duplicate operational worklist | **LOCKED** |
| No cross-branch bypass | **LOCKED** |
| No silent historical migration / backfill | **LOCKED** |
| Hybrid model: shared operational queues + explicit ownership for active counselling | **LOCKED** |
| Waiting List remains shared within server-authorized branch scope | **LOCKED** |
| Reassignment Required = operational condition, not lifecycle Status | **LOCKED** |

---

### 5. Remaining Deferred / Governance / Separate-Track Items

| Item | Current Status | Required Future Gate | Phase 3I? | Implementation Authorized? |
|------|----------------|----------------------|-----------|----------------------------|
| **PD-S13-C** Admin deactivate → RR handoff | ACCEPTED DIRECTION / OUT OF PACKAGE; **not implemented**; remains **outside closed Phase 3I implementation**; Deactivate = `UserStatus` only; no auto transfer / clear / ReQueue | New explicit Product Decision / scope authorization **if** Product later authorizes implementation | **Not** Phase 3I continuation scope; future work requires a new explicit Product Decision / program gate | **No** |
| **PD-S13-E** Claim availability | **DEFERRED** — Claim does not use Assign/Reassign availability helper | TARGETED TECHNICAL / SECURITY AUDIT (before any behavior-changing PD) | Technical/security-adjacent; not implementation-authorized | **No** |
| **PD-S13-F** Post-Surgery D6 / ownership SoT | **DEFERRED** — Post-Surgery remains shared; no CounselorId on projection; no inheritance | TARGETED D6 / persistence SoT TECHNICAL AUDIT → then future Product Decision | Ownership-shaped residual; **not** Phase 3I continuation; future Product Decision required | **No** |
| **PD-S13-K** Wave 2 formal acceptance | GOVERNANCE / UAT prerequisite; implementation exists; formal acceptance pack thin | FORMAL UAT / ACCEPTANCE | Governance — **not** a Phase 3I continuation package; **no redesign** | **No** redesign |
| **PD-S13-L** ReQueue → History | GOVERNANCE / UAT; READY FOR MANUAL UAT / Not Accepted | FORMAL UAT / ACCEPTANCE | Governance — **not** a Phase 3I continuation package; **no redesign** | **No** redesign |
| **PD-S13-G** Legacy stamps | ACCEPTED OUT OF PACKAGE / NO ACTION | Remain deferred unless Product reopens | No Phase 3I implementation | **No** |
| **PD-S13-H** Bulk remediation | ACCEPTED OUT OF PACKAGE / NO ACTION | Remain deferred until ops requirement + PD | No Phase 3I implementation | **No** |
| **PD-S13-I** Counsellor Dashboard | ACCEPTED OUT OF PACKAGE / NO ACTION | Remain deferred | No Phase 3I implementation | **No** |
| **PD-S13-J** Waiting List UX beyond certified | ACCEPTED OUT OF PACKAGE / NO ACTION | Remain deferred | No Phase 3I implementation | **No** |
| **PD-S13-M** Clinical Recommendations | ACCEPTED OUT OF PACKAGE / NO ACTION; Optometrist = static UX placeholder | Future clinical SoT track if ever | Separate clinical track | **No** |
| JWT / session invalidation | OUT OF SCOPE (PD-S12-19) | Separate security track | **No** (separate) | **No** |
| HR leave integration | OUT OF SCOPE | Separate future track | **No** (separate) | **No** |

**This document does not change Claim, Post-Surgery, Wave 2, ReQueue→History, Admin deactivate, or any certified rule.**

**Classification preserved under Option A:** remaining items stay deferred / governance / technical-security / separate-track as above. **None** are converted into Phase 3I implementation.

---

### 6. Slice 13 Boundary

| Statement | Value |
|-----------|--------|
| Slice 13 status | **FORMALLY CLOSED** |
| Package B | **DELIVERY ACCEPTED** |
| Reopen Slice 13 | **FORBIDDEN** without a new explicit Product Decision |
| New Slice 13 package | **NOT AUTHORIZED** |
| Slice 12 RR detection | **CLOSED / CERTIFIED** — do not reopen |

---

### 7. Slice 14 Status

```text
NO APPROVED SLICE 14 EXISTS.
```

This Product Decision (Option A accepted):

- does **not** create Slice 14  
- does **not** name Slice 14 as approved scope  
- does **not** invent a Slice 14 readiness or implementation package  
- does **not** authorize any further Phase 3I implementation  

Any future ownership / work-allocation initiative must begin as a **new explicitly authorized Product Decision / program gate** — not an automatic “Slice 14,” and not a Phase 3I continuation package from this file.

---

### 8. Product Decision

**Decision question:**

> Should Phase 3I now be formally closed, with remaining items retained as separately deferred, governance, technical/security, or future-track items?  
> **OR**  
> Should Phase 3I remain open for explicitly authorized additional ownership / work-allocation scope?

#### Option A — FORMALLY CLOSE PHASE 3I

Meaning:

- all approved Phase 3I delivery scopes are complete  
- Slice 13 remains closed  
- no Slice 14 is created  
- no further Phase 3I implementation is authorized  
- remaining deferred items remain deferred  
- governance / UAT items retain their existing UAT / acceptance gates  
- Wave 2 / ReQueue→History remain governance / UAT gates  
- Claim availability remains technical / security audit  
- Post-Surgery D6 remains technical audit + future Product Decision  
- JWT / HR / clinical items remain separate tracks  
- future ownership work requires a **new** explicit Product Decision / program gate  
- **no implementation authorized** by accepting Option A  

#### Option B — KEEP PHASE 3I OPEN FOR EXPLICITLY AUTHORIZED FUTURE SCOPE

Meaning (historical alternative — **not accepted**):

- Phase 3I remains open  
- **NO** implementation is authorized by this document alone  
- specific future ownership / work-allocation scope must be **explicitly named** in a subsequent Product Decision  
- that scope requires a **separate readiness audit**  
- Product Decision → Implementation → Automated tests → Manual UAT → Acceptance remain **separate** gates  
- **no** Slice 14 is automatically created  

**No additional options.** Do not invent Option C+.

---

### 9. Product Owner Decision Record

```text
PRODUCT OWNER DECISION:
OPTION A — FORMALLY CLOSE PHASE 3I

DECISION DATE:
2026-09-22

RATIONALE:
Product Owner decision to formally close Phase 3I after completion and
acceptance of all approved Phase 3I delivery scopes through Slice 13.
Remaining items retain their separately defined deferred,
governance/UAT, technical/security, clinical, HR, or future-track
classification and are not Phase 3I implementation scope.
```

| Field | Value |
|-------|--------|
| **Document status** | **PRODUCT DECISION ACCEPTED — OPTION A** |
| **Option A accepted?** | **YES** |
| **Option B accepted?** | **NO** |
| **Implementation authorized?** | **NO** |
| **Phase 3I formally closed by this document?** | **YES** |
| **Additional Phase 3I scope authorized by this document?** | **NO** |
| **Approved Slice 14** | **DOES NOT EXIST** |

> **Rule:** Option A is the authoritative Product Owner selection recorded in this section. Option B was **not** accepted. No further Phase 3I implementation is authorized by this acceptance.

---

### 10. Consequences / Boundaries

#### Authoritative current state — **Option A accepted**

| Consequence | Effect |
|-------------|--------|
| Phase 3I program | **FORMALLY CLOSED** |
| Slice 13 | **CLOSED** |
| Approved Phase 3I implementation | **COMPLETE** |
| Authorized unfinished Phase 3I implementation | **NONE** |
| Further Phase 3I implementation | **NOT AUTHORIZED** |
| Slice 14 | **Not created** / **DOES NOT EXIST** |
| Deferred items (C/E/F + no-action items) | Remain deferred / separate gates as classified in §5 |
| Governance (K/L) | Retain Formal UAT / Acceptance gates |
| Claim availability | Remains technical / security audit item |
| Post-Surgery D6 | Remains technical audit + future Product Decision |
| JWT / session invalidation | Separate security track |
| HR leave integration | Separate future track |
| Clinical Recommendations | Separate future clinical SoT track if ever required |
| Future ownership work | **REQUIRES A NEW EXPLICIT PRODUCT DECISION / PROGRAM GATE** |
| Implementation | **Not authorized** |

#### Historical alternative — Option B (not accepted)

| Consequence | Effect |
|-------------|--------|
| Phase 3I program | Would have remained open |
| Slice 14 | Would **not** automatically be created |
| Future scope | Would require **explicit naming** in a subsequent Product Decision |
| Next technical step | Separate readiness audit for that named scope |
| Implementation | **Not authorized** by Option B acceptance alone |
| Certified ownership rules | Unchanged |

#### Historical pending state (superseded)

While the decision was **PENDING**, Phase 3I remained open with no formal program closure, no implementation authorized, and no Slice 14. That pending state is **superseded** by Option A acceptance on **2026-09-22**.

---

### 11. Governance Gate

Any future ownership / work-allocation work (post–Option A new program work) must follow:

```text
AUDIT
  → PRODUCT DECISION
    → IMPLEMENTATION
      → AUTOMATED TESTS
        → MANUAL UAT
          → ACCEPTANCE
```

Do **not** collapse these gates.  
**Option A acceptance itself does NOT implement anything.**

---

### 12. Non-Implementation Statement

This Product Decision acceptance task (Option A):

- Did **not** change production code  
- Did **not** change APIs  
- Did **not** change DB / schema / migrations  
- Did **not** change permissions  
- Did **not** change ownership behavior  
- Did **not** change UI / routes  
- Did **not** perform UAT  
- Did **not** start implementation  
- Did **not** create Slice 14  
- Did **not** implement any deferred item  
- Did **not** implement Admin → RR, Claim availability, Post-Surgery ownership, Wave 2, or ReQueue → History  
- Did **not** reopen Slice 12 or Slice 13  
- Did **not** rewrite historical acceptance / closure / implementation reports  
- Did **not** create any new Product Decision beyond updating this record  

**Only file modified:** this Product Decision record.

---

## Final Status Block

```text
PHASE 3I PROGRAM PRODUCT DECISION:
ACCEPTED — OPTION A

PHASE 3I PROGRAM:
FORMALLY CLOSED

SLICE 13:
CLOSED

SLICE 14:
NOT CREATED

IMPLEMENTATION:
NOT AUTHORIZED

REMAINING ITEMS:
DEFERRED / GOVERNANCE / TECHNICAL-SECURITY / SEPARATE TRACKS
AS CLASSIFIED

NEXT PHASE 3I IMPLEMENTATION:
NONE AUTHORIZED

FUTURE OWNERSHIP WORK:
REQUIRES NEW EXPLICIT PRODUCT DECISION / PROGRAM GATE
```

**END — PHASE 3I PROGRAM PRODUCT DECISION ACCEPTED (OPTION A) — PHASE 3I FORMALLY CLOSED — STOP**
