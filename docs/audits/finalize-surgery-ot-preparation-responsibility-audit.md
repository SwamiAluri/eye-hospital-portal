# Finalize Surgery + OT Preparation
# Responsibility Remediation Audit
# Standalone OT Preparation vs Surgery Finalization → OT Prepared

| Field | Value |
|-------|--------|
| **Document type** | **AUDIT ONLY — NO IMPLEMENTATION** |
| **Audit ID** | OTPREP-RESP-AUDIT-2026-09-23 |
| **Date prepared** | 2026-09-23 |
| **Program** | Hospital Portal — Finalize Surgery / OT Preparation |
| **Mode** | Governance-first responsibility split validation |
| **Production code / API / DB / permissions / routes / FSM / ownership modified** | **NO** |
| **Product Decision created by this audit** | Companion recording only — see Product Decision artifact |
| **Implementation Authorized** | **NO** |

---

## 1. Purpose

Manual UAT / cross-screen review observed that the standalone **OT Preparation** workspace displays existing **OTPrepared** rows, while **Surgery Finalization → OT Prepared** already provides an operational prepared queue (filter, search, Reopen, Print).

**Proposed target model (TO VALIDATE — NOT ASSUMED APPROVED):**

```text
OT Preparation              = preparation workspace (Finalised awaiting Prepare)
Surgery Finalization → OT Prepared = authoritative prepared operational worklist
```

This audit answers AUDIT-01 … AUDIT-10 from **repository evidence only**.  
It does **not** invent business rules. It does **not** authorize implementation.

---

## 2. Authoritative sources inspected

### 2.1 Governance

| Artifact | Role |
|----------|------|
| `docs/product-decisions/finalize-surgery-ot-preparation-product-decision.md` | Parent PD-FS (incl. **PD-FS-11**) |
| `docs/product-decisions/finalize-surgery-ot-preparation-operational-model-product-decision.md` | PD-OTPREP-01…10 |
| `docs/product-decisions/finalize-surgery-ot-preparation-uat-remediation-product-decision.md` | PD-OTPREP-UAT-01…15 (incl. **UAT-03/04/05**) |
| `docs/product-decisions/finalize-surgery-ot-preparation-uat-remediation-package-a-implementation-authorization.md` | Package A auth (auto-load + prepared grid) |
| `docs/product-decisions/finalize-surgery-ot-preparation-discoverability-implementation-authorization.md` | PD-OTPREP-01…05 auth |
| `docs/product-decisions/finalize-surgery-ot-preparation-implementation-authorization.md` | Package 1 auth |
| Prior operational-model / UAT / comprehensive audits | SoT evidence |

### 2.2 Frontend

| Path | Role |
|------|------|
| `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/finalize-surgery/page.tsx` | Dual workspace; STATUS_TABS incl. OT Prepared; Prepare modal; GetOtList |
| `apps/hospital-portal-web/src/lib/counsellors-desk/ot-preparation-surgery-date-catalog.ts` | Actual ScheduleDate catalog; Ready/Prepared/None presentation |
| `apps/hospital-portal-web/src/lib/counsellors-desk/prepare-ot-date-scope.ts` | `selectFinalisedForPrepareDate` |
| `apps/hospital-portal-web/src/lib/api/counsellors-desk.api.ts` | `getOtList` / `submitPrepareOtList` |
| Related unit + e2e tests (catalog, prepare-ot-date-scope, package1, auth, discoverability) | Certified behavior locks |

### 2.3 Backend

| Path | Role |
|------|------|
| `microservices/auth-service/AuthService/Services/OtFinalizeService.cs` | `PrepareOtListAsync` / `GetOtListAsync` |
| `microservices/auth-service/AuthService/Services/IOtFinalizeService.cs` | Contracts |
| `OtFinalizeSchedule` / status constants | FSM SoT |

### 2.4 Search coverage

Terms searched across docs + FE + BE: `OT Prepared`, `OTPrepared`, `Prepare New List`, `Prepare OT List`, `getOtList`, `submitPrepareOtList`, `ScheduleDate`, `Finalised`, `Reopen`, `PreparedAt`, `SequenceNo`, `PD-OTPREP-RESP`.

**FACT:** Zero existing `PD-OTPREP-RESP-*` decisions found before this audit.

---

## 3. Certified baseline (relevant)

| ID | Certified statement | Status |
|----|---------------------|--------|
| **PD-FS-11** | OT Preparation = one logical operational list per branch/date; Load OT List reads **OTPrepared** for date; UI presents as date-scoped **prepared** list | **DECIDED — A** |
| **PD-OTPREP-UAT-03** | Date selection **auto-loads** existing OTPrepared (READ only); Ready if Finalised only; None if neither | **DECIDED** |
| **PD-OTPREP-UAT-04** | READY / PREPARED / NONE using existing statuses only | **DECIDED** |
| **PD-OTPREP-UAT-05** | Prepared OT List operational grid on OT Preparation | **DECIDED** |
| **Package A** | Authorizes auto-load + prepared grid + ACs (AC-A05 etc.) | **IMPLEMENTATION AUTHORIZED** |
| FSM | NotConfirmed → Confirmed → Finalised → OTPrepared → SurgeryDone; any → Cancelled; Reopen OTPrepared → Confirmed | **LOCKED** — do not modify |

---

## 4. AUDIT answers

### AUDIT-01 — Is Surgery Finalization → OT Prepared already the authoritative operational worklist for OTPrepared?

**Answer: NO (not certified as authoritative prepared SoT).**

| Surface | Evidence role |
|---------|----------------|
| **Surgery Finalization → status tab `OT Prepared`** | Client filter on shared finalize queue (`STATUS_TABS` → `OTPrepared` in `finalize-surgery/page.tsx`). Provides Reopen, Print (OT slip), UHID/name/date filters. **Not** declared the prepared-list SoT. |
| **OT Preparation workspace** | Certified date-scoped prepared list: Load/GetOtList + Prepared OT List grid (**PD-FS-11**, **PD-OTPREP-UAT-03/05**, Package A). |

**Evidence quotes:**

> “Load OT List \| `OTPrepared` for date only”  
> — `finalize-surgery-ot-preparation-product-decision.md` §5

> “Treat OT Preparation as one logical operational list per branch/date… Load OT List reads OTPrepared for date. UI presents as a date-scoped prepared list.”  
> — **PD-FS-11**

> “Selecting date auto-loads existing OTPrepared via existing READ path”  
> — Package A **AC-A05**

**PRODUCT DECISION REQUIRED** to elevate Finalization → OT Prepared as the *sole* authoritative prepared operational worklist (would supersede / narrow PD-FS-11 presentation + UAT-03/05 + Package A prepared grid).

---

### AUDIT-02 — Certified rule that OT Preparation should show only Finalised not yet OTPrepared?

**Answer: NO — opposite is certified.**

OT Preparation **must** show OTPrepared when present (Prepared / Prepared OT List). “Ready” = Finalised-not-yet-prepared for that date is **one of three** presentation states, not an “only Finalised” rule.

**Evidence:**

> Date selection auto-loads existing OTPrepared; if none but Finalised exist → Ready; if neither → None.  
> — **PD-OTPREP-UAT-03**

> READY / PREPARED / NONE  
> — **PD-OTPREP-UAT-04**

---

### AUDIT-03 — Authoritative predicate for “Ready for OT Preparation”?

**Answer: Existing presentation predicate only (not a new FSM state).**

```text
status === 'Finalised'
AND scheduleDate / StartTime day === selected surgery ScheduleDate
```

After empty GetOtList (or before prepared rows exist): Ready presentation when readyCount > 0.

**Evidence:**

- Discoverability IA §6.3: Ready = `Finalised` + `StartTime` / `scheduleDate` on selected surgery date  
- `prepare-ot-date-scope.ts` → `selectFinalisedForPrepareDate`  
- `ot-preparation-surgery-date-catalog.ts` → Ready when `readyCount > 0`

**Do not invent:** slot completeness, payment, insurance, theatre, ownership as readiness blockers unless a certified PD already defines them (PD-FS-08/10 family leaves slot predicate undefined).

---

### AUDIT-04 — Prepare semantics: all eligible / selected subset / other?

**Answer: Implemented model ≈ (A) “all Finalised for selected ScheduleDate submitted by FE,” with API shape that accepts submitted IDs — no certified subset-selection UX.**

| Layer | Behavior |
|-------|----------|
| **FE eligibility** | `selectFinalisedForPrepareDate` — Finalised on that day only |
| **FE Prepare modal** | Builds items from **all** `finalisedRecords` passed in — **no checkboxes / deselect** (`finalisedRecords.map(...)`) |
| **BE** | Prepares **submitted** `Items` that are Finalised + StartTime in `[request.Date, request.Date+1)`; rejects others |

**Evidence:**

- `page.tsx` PrepareOtListModal `handleSubmit` maps all `finalisedRecords`  
- `OtFinalizeService.PrepareOtListAsync` validates submitted IDs  
- Interface comment: “marks all specified Finalised records as OTPrepared”

**Not certified as a product option:** operator row-deselect / subset picker.

**PRODUCT DECISION REQUIRED — PREPARE SELECTION SEMANTICS NOT ESTABLISHED AS EXPLICIT PRODUCT CHOICE A vs B**  
(implementation FACT exists; dedicated RESP / PO option “must always submit all remaining vs allow subset” is **not** recorded as a Product Owner selection).

**Related open:** **PD-OTPREP-06** late-add / SequenceNo continuation — PARTIALLY DECIDED; blocks certified append UX.

---

### AUDIT-05 — After Prepare succeeds, certified expected behavior?

**Answer: Mutation + reload prepared list on OT Preparation (current certified chain).**

1. Rows: Finalised → OTPrepared; `IsLocked`; `SequenceNo`; `PreparedAt` / `PreparedBy`; audit “Prepare”  
2. UI: success toast (*OT list locked and prepared*), close modal, invalidate finalize list, **reload GetOtList** for that date  
3. Workspace shows Prepared OT List (Package A / UAT)

**Not certified:** navigate-away to Finalization OT Prepared tab as the *only* post-success destination; hide prepared grid from OT Prep.

---

### AUDIT-06 — API returns both Finalised eligible + OTPrepared, or separate read models?

**Answer: Separate read models (certified / implemented).**

| API | Returns |
|-----|---------|
| `GET …/ot-schedule` (`getFinalizeList`) | Multi-status finalize rows (incl. Finalised + OTPrepared) |
| `GET …/ot-list?date=` (`getOtList`) | **OTPrepared only** for date, ordered by SequenceNo then StartTime |
| `POST …/prepare` | Mutation Finalised → OTPrepared for submitted items |

---

### AUDIT-07 — Removing OTPrepared rows from standalone OT Preparation — break certified workflow?

**Answer: YES — breaks certified Package A / UAT remediation / PD-FS-11 prepared-list UX.**

Would violate:

- PD-OTPREP-UAT-03 auto-load of OTPrepared  
- PD-OTPREP-UAT-04 PREPARED state honesty  
- PD-OTPREP-UAT-05 Prepared OT List grid  
- Package A AC-A05, prepared-grid ACs, Journeys A/E/F  
- e2e expectations for prepared grid / Reopen-on-prepared-row in OT Prep

**PRODUCT DECISION REQUIRED** before any removal (must explicitly supersede / narrow prior decisions + Package A scopes).

---

### AUDIT-08 — Does Surgery Finalization OT Prepared already provide all required operational actions for prepared rows?

**Answer: PARTIAL — shared queue actions exist; not certified as full replacement for OT Prep prepared-list UX.**

| Capability | Finalization (OT Prepared tab) | OT Preparation workspace |
|------------|--------------------------------|---------------------------|
| Reopen | Yes | Yes (prepared-row) |
| Print | Per-row OT slip | Toolbar `window.print()` — **not** certified list print (**PD-OTPREP-UAT-08** → Package B) |
| Search | UHID + name | No equivalent on prepared grid |
| Filter | Date + status tabs | Surgery-date catalog |
| SequenceNo operational grid | Not the OT Prep prepared grid | Certified Package A grid |

**Do not remove or weaken** Finalization OT Prepared capabilities.  
**Do not assume** they already replace OT Prep’s certified prepared grid without a Product Decision.

---

### AUDIT-09 — Can target model use existing APIs without duplicate API/worklist?

**Answer: Technically YES for reads/mutations — APIs already separate Finalised vs OTPrepared.**

Consolidation is a **UX responsibility redesign**, not a missing-API problem. Creating a *second* prepared worklist/entity remains forbidden. Reusing Finalization tab as sole prepared surface still requires Product Decision + Implementation Authorization because it conflicts with certified OT Prep prepared UX.

---

### AUDIT-10 — Are backend changes required?

| Change | Backend required? |
|--------|-------------------|
| Current certified Package A OT Prep UX | **No** |
| Separate Finalised vs OTPrepared reads | **No** — already separate |
| Responsibility split UI only (Finalised queue on OT Prep; hide prepared grid) | **No** new API **if** Product Decision + IA approve FE-only presentation change |
| Subset Prepare UX / certified append | FE (+ SequenceNo rule); BE already accepts item list — **PD required** |
| Package B Print / Package C PD-OTPREP-10 | Separate tracks — **out of scope** |

---

## 5. Target model consistency check

| Proposed claim | Consistent with certified baseline? |
|----------------|--------------------------------------|
| OT Prep = Finalised-only preparation queue | **NO** — conflicts with PD-FS-11, UAT-03/04/05, Package A |
| Finalization → OT Prepared = sole authoritative prepared worklist | **NO** — not certified; OT Prep is certified prepared-list surface |
| Stop auto-rendering OTPrepared on OT Prep | **NO** — conflicts with UAT-03 / Package A A3 / AC-A05 |
| Keep Prepare mutation + FSM unchanged | **YES** — preserve |
| Use existing APIs only | **YES** — feasible if UX PD approves |

**Verdict:** Proposed responsibility remediation is a **proposed product change**, not a confirmation of existing certified behavior.

---

## 6. Critical gap — Prepare selection semantics

Per governance stop rule:

> Do NOT assume “Prepare New List prepares all Finalised” or “prepares selected surgeries.”  
> If repository does not establish the answer as Product Decision: STOP.

**FACT established:** FE currently submits all Finalised rows for the selected date; BE prepares submitted IDs; no subset UI.

**PRODUCT OWNER SELECTION not established** as explicit RESP decision A vs B.

**Record:**

```text
PRODUCT DECISION REQUIRED — PREPARE SELECTION SEMANTICS NOT ESTABLISHED BY EXISTING CERTIFIED PRODUCT-OWNER OPTIONS.
```

(Implementation FACT ≠ Product Owner decision option register.)

---

## 7. Gate status after this audit

| Gate | Status |
|------|--------|
| **AUDIT** | **COMPLETE** |
| **PRODUCT DECISION (RESP)** | **REQUIRED** — see companion Product Decision (PENDING PO) |
| **IMPLEMENTATION AUTHORIZATION** | **NONE** — do not create until RESP decided |
| **IMPLEMENTATION** | **NOT STARTED — BLOCKED** |
| **AUTOMATED TESTS (for remediation)** | **NOT STARTED** |
| **MANUAL UAT** | **REQUIRED** (after future authorized implementation) — **not performed here** |
| **ACCEPTANCE** | **NOT RECORDED** |

---

## 8. Explicit non-actions

This audit does **not**:

- modify production code  
- create Implementation Authorization  
- supersede Package A  
- implement Package B or Package C  
- change FSM / SequenceNo / ownership / APIs / permissions  
- record UAT PASS or Acceptance  

---

## 9. Recommended next governance step

1. Product Owner records `PD-OTPREP-RESP-01…10` in  
   `docs/product-decisions/finalize-surgery-ot-preparation-responsibility-product-decision.md`  
2. Explicitly reconcile / supersede conflicting Package A / UAT-03/05 / PD-FS-11 presentation scopes **if** target model is selected.  
3. Only then create a **bounded** Implementation Authorization.  
4. Only then implement.

**STOP.**
