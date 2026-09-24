# Counsellor C-01 — Waiting List Dashboard Redesign Reconciliation Audit

| Field | Value |
|-------|--------|
| **Date** | 2026-09-22 |
| **Mode** | **AUDIT ONLY** — no production code, API, DB, permission, route, ownership rule, UI, Product Decision, phase, or slice created or modified |
| **Objective** | Reconnect original Counsellor Waiting List Dashboard redesign (**C-01**) with current certified Counsellor / Phase 3I implementation; establish what remains and what must be decided before any future implementation |
| **Phase 3I** | **FORMALLY CLOSED** — do not reopen |
| **PD-S13-J** | **ACCEPTED Option A** — no further Waiting List UX in Slice 13 / Phase 3I Package B (**OUT OF PACKAGE / NO ACTION**) |
| **Slice 14 / Phase 3J** | **NOT CREATED** by this audit |
| **Git posture** | Inspected for evidence only; unrelated dirty/untracked files preserved; **only this audit file created** |

---

## 1. Executive Summary

**C-01** was the Aug 2026 product-acceptance initiative for Counsellor Waiting List (`C-WL` / `/dashboard/counsellors-desk/waiting-list`). It recorded functional defects (Pre-Auth mapping, soft-success Add Patient, OT race, decorative pagination, etc.) and later spawned a Sep 2026 visual “clinical worklist” redesign (v1 → v2 after visual UAT rejection).

**Since then:**

- Historical **functional defects A–C, F, G** are largely **resolved in current code**.
- **Pagination (I)** is no longer decorative: **functional client-side** paging exists; **not** server-side.
- **Phase 3I** certified shared-queue ownership, Assign / Claim / Reassign, PD16 branch auth, owner indicators, and open ≠ ownership — these are **LOCKED**.
- **PD-S13-J Option A** explicitly deferred **further Waiting List UX** (visual redesign, lifecycle CTA expansion, business-rule changes) outside closed Phase 3I.
- Formal **C-01 USER ACCEPTED** delivery acceptance was **not found** under `docs/audits/`.
- Remaining material scope is primarily **bounded operational UX / composition** around the certified model — **not** a second ownership worklist and **not** Phase 3I reopen.

**Final classification:** **A. C-01 READY FOR PRODUCT DECISION**

Evidence is sufficient to define a Product Decision gate. Implementation must not start until Product explicitly authorizes C-01 scope beyond the PD-S13-J freeze and resolves the open decision surface in §11.

---

## 2. Audit Scope

### In scope

- Original C-01 Waiting List redesign intent and historical issues A–J  
- Current Waiting List UI, APIs, tests  
- Phase 3I ownership reconciliation (safe vs preserve vs PD)  
- Genuine UX opportunities that do **not** alter certified behavior  
- Product Decision surface required before implementation  

### Out of scope

- Implementing, redesigning, refactoring, migrating, or deleting anything  
- Creating Product Decisions, slices, Phase 3J, Slice 14  
- Reopening Phase 3I  
- Changing ownership, Assign, ReQueue, Sessions, Follow-up, Finalize, Analytics, or Post-Surgery boundaries  

### Category legend (this audit)

| Cat | Meaning |
|-----|---------|
| **A** | Certified / complete |
| **B** | UX improvement opportunity (behavior works) |
| **C** | Product Decision required |
| **D** | Implementation gap vs approved current behavior |
| **E** | Test gap |
| **F** | UAT / acceptance gap |
| **G** | Deferred / out of scope |
| **H** | No longer applicable |
| **I** | Insufficient evidence |

---

## 3. Current Waiting List Architecture

### Route / shell

| Item | Current |
|------|---------|
| Route | `/dashboard/counsellors-desk/waiting-list` |
| Page | `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/waiting-list/page.tsx` |
| Permission | `counseling_sessions.read` via `ProtectedRoute` |
| Landing | Counsellor role → Waiting List (`DashboardRouter`); PD-S13-I keeps WL as landing (no Dashboard) |
| Composition | Summary KPI strip + Filter toolbar + Queue widget + client pagination footer |

### Primary components

| Component | Path |
|-----------|------|
| Filter toolbar | `…/waiting-list/WaitingListFilterToolbar.tsx` |
| Summary / tabs | `…/waiting-list/WaitingListSummaryWidget.tsx` |
| Queue shell | `…/waiting-list/WaitingListQueueWidget.tsx` |
| Work row | `…/waiting-list/WaitingListWorkRow.tsx` |
| OT Returned row | `…/waiting-list/WaitingListOtReturnedRow.tsx` |
| Pagination | `…/waiting-list/WaitingListQueuePagination.tsx` |
| Patient detail | `…/waiting-list/WaitingListPatientDetailSheet.tsx` |
| Assign / Reassign | `WaitingListAssignDialog.tsx` / `WaitingListReassignDialog.tsx` |
| Add Patient | `…/AddPatientModal.tsx` + `add-patient-to-waiting-list.ts` |

### Data flow

```text
useWaitingListQuery({ branchId, dates/name/mrd, type: 'All' })
  → GET /Counseling/waiting-list  (AuthService CounselingController)
  → shared queue within ResolveFollowupBranchesAsync (PD16)
  → client filters: type, status tab, owner Mine/Unassigned/Other, quick search, Pre-Auth (CCMS)
  → client pagination slice (default page size 10)
  → OT Returned tab: parallel IP journeys (ReadyForSurgery + otReturnReason) — not Auth WL rows
```

### Backend SoT

| Layer | Path |
|-------|------|
| Endpoint | `GET api/Counseling/waiting-list` — `CounselingController.cs` |
| Create/Add | `POST api/Counseling/sessions` with `AddToQueue=true` |
| Ownership | `CounselorId`, `CounselorName`, `Version`, `BranchId` on DTO |
| Shared queue | No `CounselorId` visibility filter on waiting-list |
| Soft-delete | Queue + session `DeletedAt == null` |

**Secondary:** Azure `counselling-service` is **not** the Waiting List ownership SoT.

---

## 4. Original C-01 Intent

### Identity

| Field | Value |
|-------|--------|
| **ID** | **C-01** (product acceptance) / matrix screen **C-WL** |
| **Date (acceptance audit)** | 2026-08-27 |
| **Route** | `/dashboard/counsellors-desk/waiting-list` |
| **Matrix** | `apps/hospital-portal-web/docs/ip-product-ui-ux-e2e-acceptance-matrix-2026-08-27.md` |
| **Formal USER ACCEPTED in `docs/audits/`** | **Not found** |

**Note:** Repo `docs/audits/` has **no** file titled “C-01”. Original defect audit lives primarily in agent transcript / support extracts (2026-08-27). Do not confuse **C-01** with **CS-01** (session Finish / `markAddOnSurgery` false-success path).

### Planned surface (historical)

1. Waiting List page/shell  
2. Page hierarchy (summary + filters + queue)  
3. KPI / summary treatment  
4. Search  
5. Patient type / status filters  
6. Filter Apply / reset  
7. Table / list structure  
8. Row information hierarchy  
9. Row actions  
10. Add Patient  
11. Patient demographics  
12. Doctor / referral information  
13. Follow-up information  
14. Pre-Auth / CCMS information  
15. OT Returned  
16. Pagination  
17–21. Loading / empty / error / responsive / a11y  
22. Operational density / readability  
23–25. Ownership display / Assign / ReQueue (later largely absorbed by Phase 3I)  
26–27. Relationship to Counselling Sessions / navigation into session  
28–30. Dead UI, API mismatches, domain ambiguity  

### Visual redesign layer (Sep 2026 — adjacent to C-01)

| Artifact | Role |
|----------|------|
| `docs/superpowers/specs/2026-09-05-counsellor-waiting-list-worklist-design.md` | “Priority Clinical Worklist Redesign” — FE UX composition |
| `docs/superpowers/plans/2026-09-05-counsellor-waiting-list-worklist.md` | Implementation plan; preserve Pre-Auth/OT handlers |
| `docs/superpowers/specs/2026-09-07-counsellor-waiting-list-worklist-v2.md` | V2 after **browser UAT rejected V1 visuals** |
| Commit evidence (historical) | Waiting-list widgets shipped under `components/counsellors-desk/waiting-list/` |

These specs are **historical proposals / shipped FE composition**, not Phase 3I Product Decisions and not a substitute for formal C-01 USER ACCEPTED.

### What Phase 3I later certified (must not be redesigned as “C-01 ownership”)

From PD-S13-J certified list + program PD:

- Shared list  
- Lifecycle CTAs  
- Explicit Assign  
- Claim-for-lifecycle  
- Reassign (WL Pending\|Processed)  
- Owner indicators  
- Opening ≠ ownership  
- PD16 branch authorization  

---

## 5. Historical Issue Reconciliation

Status values used: **RESOLVED** · **STILL VALID** · **PARTIALLY RESOLVED** · **PRODUCT DECISION REQUIRED** · **OUT OF SCOPE / DEFERRED** · **NO LONGER APPLICABLE** · **INSUFFICIENT EVIDENCE**

### A. patientType / paymentType → Pre-Auth mapping

| Field | Finding |
|-------|---------|
| **Historical** | FE read `paymentType` (never on WL DTO) → Pre-Auth column/button dead |
| **Current** | WL uses **`patientType`** (`WaitingListPatientDto.PatientType`). Pre-Auth membership via `isWaitingListPreAuthQueue` + `isCoveragePaymentTypeValue(patientType)` + CCMS awaiting. Comment: coverage alone is **not** enough. |
| **Evidence** | `waiting-list-preauth.ts`; `CounselingController` WaitingList DTO; `use-deferred-ccms-badges.ts` |
| **Status** | **RESOLVED** |
| **Category** | **A** (functional) / residual presentation polish = **B** if Product authorizes |

### B. Dead Pre-Auth Queue / count behavior

| Field | Finding |
|-------|---------|
| **Historical** | Tab counted `status === 'PreAuthQueue'` + broken paymentType → always 0 |
| **Current** | Tab `PreAuthQueue`; count = `typeScoped.filter(isPreAuthQueueRow)`; CTA becomes Pre-Auth; navigates `tab=coverage&subtab=preauth` |
| **Evidence** | `page.tsx` tabCounts; `waiting-list-lifecycle-action.ts`; `WAITING_LIST_STATUS_TABS` |
| **Status** | **RESOLVED** (membership rule implemented) |
| **Category** | **A**; formal C-01 UAT of Pre-Auth Queue = **F** |

### C. Add Patient soft-success behavior

| Field | Finding |
|-------|---------|
| **Historical** | POST to non-existent CounsellorDesk waiting-list; catch → toast success |
| **Current** | `POST /Counseling/sessions` + `addToQueue: true`; errors toast + rethrow (modal stays open); success toast after invalidate |
| **Evidence** | `add-patient-to-waiting-list.ts`; `page.tsx` Add Patient handler; `AddPatientModal` |
| **Status** | **RESOLVED** |
| **Category** | **A**; Playwright depth for Add Patient mutation = **E** |

### D. Doctor referral path

| Field | Finding |
|-------|---------|
| **Historical** | Concern that refer-counsellor may not land on `counselor_queue` (fixture/path) |
| **Current** | BE joins `ReferredByDoctorId` → Doctor display name; Add Patient requires `referredByDoctorId`; row Visit shows doctor |
| **Evidence** | `CounselingController` waiting-list join; `WaitingListWorkRow`; Add Patient payload |
| **Status** | **PARTIALLY RESOLVED** (display + Add Patient path exist) / **INSUFFICIENT EVIDENCE** that every clinical referral entry path lands on queue without bypass |
| **Category** | **I** for full clinical referral E2E; display path **A** |

### E. Demographics / follow-up data

| Field | Finding |
|-------|---------|
| **Historical** | Demographics panel mostly empty; FollowUpDate/Reason unused |
| **Current** | Follow-up: BE maps `DecisionDate`/`ReasonsForDelay` for **RepeatCounselling** only. Demographics sheet can show DOB/bloodGroup **if present**, but Waiting List DTO **does not populate** `dob`/`bloodGroup` (only computed Age + Gender). Empty fields omitted. |
| **Evidence** | `CounselingController` DTO mapping (~822–868); `WaitingListPatientDetailSheet.tsx`; FE type optional `dob`/`bloodGroup` |
| **Status** | **PARTIALLY RESOLVED** (follow-up Repeat path); demographics enrichment **STILL VALID** as UX/data thinness |
| **Category** | Follow-up Repeat = **A**; demographics enrichment = **B** + **C** (whether to enrich API) |

### F. Type-filter Apply ambiguity

| Field | Finding |
|-------|---------|
| **Historical** | Type chips draft-only until Apply |
| **Current** | Type filters **immediately** client-side; Apply commits dates (forces `type: 'All'` into appliedFilters); type **not** sent to API from page |
| **Evidence** | `page.tsx` §6 comments; `waiting-list-client-filters.test.ts` |
| **Status** | **RESOLVED** |
| **Category** | **A**; name/MRD Apply fields without visible toolbar inputs = residual **B**/clarity (**C** if Product wants server type filter) |

### G. OT Returned branch/race behavior

| Field | Finding |
|-------|---------|
| **Historical** | Fetch on mount before `branchId`; errors swallowed |
| **Current** | `useEffect` waits for `branchId`; loads IP journeys; toast on failure; clears list |
| **Evidence** | `page.tsx` §8 comment + OT fetch; `WaitingListOtReturnedRow` |
| **Status** | **RESOLVED** (race) |
| **Category** | **A**; OT remains IP-journey data, not Auth queue status — **CERTIFIED BEHAVIOR — PRESERVE** |

### H. AddOnSurgery schema mismatch

| Field | Finding |
|-------|---------|
| **Historical** | Service wrote `AddOnSurgery` while CHECK allegedly allowed only Waiting\|Called\|InProgress\|Completed\|Cancelled\|NoShow |
| **Current** | BE actively writes/maps `AddOnSurgery`; WL status/tab/upgrade fields from `PackageAddonsJson`; active-queue predicates include `AddOnSurgery` |
| **Evidence** | `MarkAddOnSurgeryAsync`; waiting-list status switch; FE tab Add-on Surgery |
| **Status** | **PARTIALLY RESOLVED** / likely operational — **INSUFFICIENT EVIDENCE** of a remaining live CHECK constraint failure in current DB migrations inspected in this audit |
| **Category** | **I** for production DB CHECK; application path **A** if environments accept the write |

### I. Decorative / non-functional pagination

| Field | Finding |
|-------|---------|
| **Historical** | Full list client-side; pager disabled / decorative |
| **Current** | **Functional client-side** `sliceWaitingListPage`; page size 10/25/50; resets on filter change. API still returns **full** authorized list (no Skip/Take). |
| **Evidence** | `waiting-list-pagination.ts`; `WaitingListQueuePagination.tsx`; `page.tsx`; Phase 3I pagination audit notes WL client-side vs Sessions server-side |
| **Status** | **PARTIALLY RESOLVED** (no longer decorative; still not server paging) |
| **Category** | Functional client pager = **A** vs historical decorative; whether to add **server** paging = **C** + **B** |

### J. Other material historical items

| Item | Current status | Category |
|------|----------------|----------|
| KPI vs status-tab overlap / “dashboard feel” | Still a composition concern from Sep V2 UAT narrative; PD-S13-J deferred further polish | **B** / **G** until new PD |
| Row keyboard / a11y | Partial unit/layout coverage; Package B a11y UAT was Sessions-focused, not full C-01 WL | **E** / **F** |
| URL filter state | Still largely not encoded in URL (unlike Sessions `page`/`reassignmentRequired`) | **B** / **C** |
| Soft-delete UI on WL | Backend delete exists; no desk soft-delete UI — not certified C-01 requirement | **G** (aligns with PD-S13-J) |
| Ownership / Assign / open≠own | Certified Phase 3I — not a C-01 “redesign target” | **A** / **DO NOT CHANGE** |
| ReQueue on Waiting List | ReQueue remains Follow-up Center owned — intentional | **A** / **DO NOT CHANGE** |
| Formal C-01 USER ACCEPTED | Not found | **F** |

---

## 6. Current UI/UX Assessment

| Area | Current behavior | Assessment |
|------|------------------|------------|
| Page shell | Summary + Filter + Queue worklist | Works; composition still candidate for polish if authorized |
| Hierarchy | KPI strip + status pills + dense 7-column work grid | Operational density present; Sep V2 complained about KPI-dashboard feel / whitespace — **historical UX opportunity**, not Phase 3I defect |
| Search | Debounced quick search client-side | Works |
| Filters | Immediate type; Apply for dates; owner convenience filter | Works; Apply vs type semantics corrected |
| Table | Patient \| Visit \| Procedure \| Owner \| Payment \| Status \| Action | Certified ownership column present |
| Row actions | Lifecycle matrix + Assign/Reassign/Pre-Auth | **CERTIFIED — PRESERVE** |
| Add Patient | Modal + MPI + create session | Soft-success fixed |
| Demographics sheet | Omits empty fields; thin without DOB/blood from API | Opportunity / PD |
| Doctor | Display + Add Patient referral id | Display OK |
| Follow-up | Repeat rows only | Expected |
| Pre-Auth | CCMS-backed queue membership | Functional |
| OT Returned | Separate IP rows | Preserve boundary |
| Pagination | Client functional | Works; scale PD open |
| Loading / empty / error | Skeleton, empty copy, toasts | Present |
| Responsive | Workstation fluid tracks in layout helpers | Present |
| Accessibility | Some contracts; full C-01 a11y acceptance thin | **F** / **E** |
| Ownership display | Owner column + You | Certified |
| Assign | Explicit dialog; row-click may open Assign for eligible unassigned | Certified |
| ReQueue | Not on WL | Preserve |
| Sessions relationship | Open → `/dashboard/counsellors-desk/[id]`; Sessions is separate ownership remediation host (Package B) | Preserve dual surfaces |

**Design system:** Existing Hospital Portal / counselling-session tokens. **No new design system proposed.**

---

## 7. Current API / Data Assessment

| Concern | Supported by current implementation? | Notes |
|---------|--------------------------------------|-------|
| Shared branch-scoped list | **Yes** | PD16; no CounselorId visibility filter |
| Ownership fields | **Yes** | CounselorId, CounselorName, Version, BranchId |
| Assign / Claim / Reassign | **Yes** | Separate endpoints; WL consumers |
| Pre-Auth Queue | **Yes** | FE + deferred CCMS; not a queue Status enum |
| Follow-up on Repeat | **Yes** | DecisionDate / ReasonsForDelay mapping |
| Demographics DOB/blood on WL DTO | **No** | Age/Gender only from patient DOB computation |
| Server pagination | **No** | Full list return + FE slice |
| Server type filter from page | **Unused** | Page always sends `type: 'All'` |
| OT Returned | **Yes** via IP API, not WL DTO | Correct boundary |
| AddOnSurgery upgrade fields | **Yes** | PackageAddonsJson parse |
| Add Patient | **Yes** | Create session + AddToQueue |

Do **not** infer a backend defect from UI assumptions alone. Demographics thinness is a **missing DTO projection**, not proof Patients lack data.

---

## 8. Phase 3I Ownership Reconciliation

| Proposed C-01 UX area | Classification |
|-----------------------|----------------|
| Visual density / whitespace / typography / KPI composition | **SAFE TO REDESIGN** *only after* new Product authorization beyond PD-S13-J; must not invent Dashboard/worklist |
| Search / filter chrome presentation | **SAFE TO REDESIGN** (presentation) — preserve filter semantics unless PD changes them |
| Client pagination chrome | **SAFE TO REDESIGN** presentation; **server paging** = **REQUIRES PRODUCT DECISION** |
| Row information hierarchy / column labels | **SAFE TO REDESIGN** presentation — **preserve** Owner / Assign / lifecycle meaning |
| Loading / empty / error copy | **SAFE TO REDESIGN** |
| Accessibility / keyboard polish | **SAFE TO REDESIGN** (harden, don’t change ownership) |
| Shared queue / PD16 / branch scoping | **CERTIFIED BEHAVIOR — PRESERVE** |
| CounselorId ownership SoT | **CERTIFIED BEHAVIOR — PRESERVE** |
| Explicit Assign / Claim-for-lifecycle / Reassign gates | **CERTIFIED BEHAVIOR — PRESERVE** |
| Opening / viewing / starting ≠ ownership | **CERTIFIED BEHAVIOR — PRESERVE** |
| Owner mutation ACL / Version / 409 | **CERTIFIED BEHAVIOR — PRESERVE** |
| Ownership History | **CERTIFIED BEHAVIOR — PRESERVE** (session History; not WL redesign target) |
| ReQueue → CounselorId NULL | **CERTIFIED BEHAVIOR — PRESERVE** (Follow-up owns ReQueue CTA) |
| Counselling Sessions as RR remediation host | **CERTIFIED BEHAVIOR — PRESERVE** |
| Expanding WL Reassign eligibility beyond certified | **REQUIRES PRODUCT DECISION** (was PD-S13-D Option C — leave WL unchanged) |
| Creating Counsellor Dashboard / My Queue | **REQUIRES PRODUCT DECISION** / currently **NO ACTION** (PD-S13-I) |
| Changing Pre-Auth membership business rule | **REQUIRES PRODUCT DECISION** |
| Enriching demographics via API fields | **REQUIRES PRODUCT DECISION** |
| Server-side waiting-list pagination | **REQUIRES PRODUCT DECISION** |
| OT Returned data source change | **REQUIRES PRODUCT DECISION** (currently IP journeys) |

**Rule:** C-01 may improve operational UX **around** the certified model. It must **not** modify the model.

---

## 9. Certified Behavior Protection List

## DO NOT CHANGE

(Unless a **new** explicit Product Decision authorizes a change — not this audit.)

1. Waiting List remains a **shared** operational queue (not “My Queue”).  
2. Server-authorized **branch scope** (PD16 / `ResolveFollowupBranchesAsync`).  
3. **`CounselorId`** is ownership SoT; **`CreatedByUserId`** is not ownership.  
4. Opening / viewing / starting a row or session does **not** establish ownership.  
5. Ownership established only via **explicit Assign**, **claim-for-lifecycle**, or **Reassign**.  
6. Owner mutation ACL and **Version / CAS / 409** behavior.  
7. Ownership History as authoritative audit trail.  
8. **ReQueue** clears `CounselorId` to NULL; ReQueue CTA remains on **Follow-up Center**, not invented as a duplicate WL ownership action unless newly decided.  
9. Waiting List Reassign eligibility matrix as certified (Pending\|Processed; Sessions hosts RR remediation).  
10. Counselling Sessions remains the authoritative active-work / RR remediation surface (Package B).  
11. No duplicate Counsellor ownership worklist.  
12. No Counsellor Dashboard unless separately approved (PD-S13-I Option A).  
13. Canonical routes: `/dashboard/counsellors-desk/waiting-list`, `/sessions`, `/[id]`, Follow-up, Finalize, Analytics.  
14. Existing AuthService Waiting List / Assign / Claim / Reassign / ReQueue APIs unless explicitly approved.  
15. OT Returned as IP-journey projection (not fake queue Status).  
16. Pre-Auth Queue as **operational filter** (coverage + CCMS awaiting), not a lifecycle Status enum.  
17. Follow-up / Finalize Surgery / Analytics / Post-Surgery certified boundaries.  
18. Soft-delete / shared-queue population rules (`DeletedAt`, authorized branches only).  

---

## 10. Current UX / Product Opportunity List

**Only genuine current opportunities.** Not ranked. Not a roadmap.

| ID | Current behavior | Operator problem | Evidence | Proposed UX direction (non-binding) | Business-rule dependency | Reuse | PD required? | Safe without certified-behavior change? |
|----|------------------|------------------|----------|--------------------------------------|--------------------------|-------|--------------|------------------------------------------|
| UX-01 | KPI strip + many status pills coexist | Can read as “dashboard” / duplicated status signals | Sep V2 UAT narrative; current `WaitingListSummaryWidget` | Composition/density polish within existing widgets | None if presentation-only | Summary + Queue widgets | Yes — authorize polish beyond PD-S13-J | Yes if no CTA/ownership change |
| UX-02 | Dense 7-column work grid | Readability / hierarchy at some breakpoints | `waiting-list-layout.ts` tracks | Hierarchy/spacing polish | None if presentation-only | `WAITING_LIST_WORK_GRID*` | Yes | Yes |
| UX-03 | Demographics sheet omits DOB/blood (API doesn’t send) | Detail sheet thinner than operators may expect | DTO mapping; Sheet | Either enrich DTO from Patients **or** keep omit-empty and clarify | Enrichment = API projection | Patients fields already in join for DOB age | Yes if enriching | Presentation-only: yes; enrichment: PD |
| UX-04 | Client-side pagination of full payload | Large branch lists may load/filter entire set client-side | No Skip/Take on GET waiting-list | Keep as-is **or** server paging | Server paging = API contract | Sessions pagination pattern (different surface) | Yes for server paging | Client chrome polish: yes |
| UX-05 | Type immediate; Apply dates; name/MRD Apply without obvious inputs | Mild filter mental model friction | `page.tsx` Apply forces `type: 'All'` | Clarify Apply scope in UI copy/controls | Changing server type filter = PD | FilterToolbar | Optional PD | Yes if copy/control only |
| UX-06 | Filters not mirrored in URL | Hard to share/deep-link filtered WL view | Contrast Sessions URL page/RR | Optional URL state for filters | Encoding only vs filter semantics | Sessions URL helpers as pattern | Optional PD | Yes if no ownership change |
| UX-07 | Formal C-01 a11y/UAT thin | Keyboard/focus certainty incomplete for full WL | Tests + lack of C-01 acceptance pack | Targeted a11y hardening | None | Existing Radix/Sheet/Dialog | Yes to authorize UAT/polish package | Yes |
| UX-08 | Pre-Auth / OT / AddOn presentation density | Attention/badge clutter risk (historical V2) | Attention helpers + tabs | Label/badge refinement only | Do not change Pre-Auth membership rule without PD | `waiting-list-attention.ts`, preauth helper | Yes | Yes if labels only |

**Not listed as opportunities (forbidden / deferred):** Counsellor Dashboard, My Waiting List ownership filter as SoT, Sessions ReQueue on WL, Clinical SoT integration, automatic ownership transfer.

---

## 11. PRODUCT DECISIONS REQUIRED BEFORE C-01 IMPLEMENTATION

Only genuinely unresolved decisions. **No option selected by this audit.**

### PD-C01-01 — Authorize C-01 beyond PD-S13-J freeze

| Field | Content |
|-------|---------|
| **Exact question** | Does Product authorize a **new** Waiting List UX package (C-01 continuation) now that PD-S13-J Option A deferred further WL UX in Phase 3I? |
| **Why unresolved** | PD-S13-J already accepted “no further Waiting List UX” for Slice 13/Package B; Phase 3I is closed. C-01 cannot lawfully implement without a **new** authorization. |
| **Current behavior** | Certified WL ownership/lifecycle preserved; further polish NO ACTION under Phase 3I |
| **Documented alternatives** | PD-S13-J Options A/B/C (no further / visual polish only / lifecycle refinement) — historical options for Slice 13, not a live open PD |
| **Affected UI** | Entire Waiting List shell |
| **Affected API** | None if presentation-only |
| **Phase 3I impact** | Must **not** reopen ownership model; authorization is for UX package only |
| **Must approve** | Scope boundary: presentation-only vs any behavior change; explicit “not Phase 3I reopen” |

### PD-C01-02 — Server-side Waiting List pagination

| Field | Content |
|-------|---------|
| **Exact question** | Remain client-side slice of full authorized list, or add server Skip/Take (or equivalent) to `GET /Counseling/waiting-list`? |
| **Why unresolved** | Historical decorative pager fixed with **client** paging; scale/perf trade-off never Product-decided for WL (Sessions chose server paging separately). |
| **Current** | Full list API + FE slice (10/25/50) |
| **Alternatives** | Keep client-only · add server pagination · hybrid |
| **UI** | Pagination footer, totals |
| **API** | Contract change if server paging |
| **Phase 3I** | Must preserve shared-queue + PD16 filters; must not invent ownership filter |
| **Must approve** | Page size SoT, TotalCount source, filter interaction with server page |

### PD-C01-03 — Demographics enrichment on Waiting List detail

| Field | Content |
|-------|---------|
| **Exact question** | Should Waiting List Patient Detail expose DOB / blood group / other MPI fields by extending DTO projection, or remain age/sex + omit-empty? |
| **Why unresolved** | Patients DOB already used for age; DOB/blood not projected; sheet ready for optional fields |
| **Current** | Age/Gender; optional sheet fields unused from API |
| **Alternatives** | Enrich DTO · open Patient Details elsewhere · leave as-is |
| **UI** | `WaitingListPatientDetailSheet` |
| **API** | WaitingListPatientDto fields |
| **Phase 3I** | None if read-only projection |
| **Must approve** | Field list + privacy posture (no PHI in URLs/logs) |

### PD-C01-04 — Pre-Auth Queue presentation vs membership

| Field | Content |
|-------|---------|
| **Exact question** | Is the current membership rule (coverage `patientType` **AND** CCMS case **AND** awaiting set) the permanent Product rule, with only presentation polish allowed? |
| **Why unresolved** | Rule is implemented and historically approved in C-01 continuation notes, but formal C-01 USER ACCEPTED pack not found; changing membership would be a business-rule change |
| **Current** | Implemented in `waiting-list-preauth.ts` |
| **Alternatives** | Lock rule · change membership criteria (would be new domain PD) |
| **UI** | Pre-Auth tab counts/rows/CTA |
| **API** | CCMS by-sessions dependency |
| **Phase 3I** | Must not conflate with ownership |
| **Must approve** | Lock vs change; if change, exact criteria |

### PD-C01-05 — URL state for Waiting List filters

| Field | Content |
|-------|---------|
| **Exact question** | Should Waiting List encode tab/type/owner/search/page in URL (like Sessions page/RR), or keep ephemeral client state? |
| **Why unresolved** | Never Product-decided for WL; Sessions already uses URL page state |
| **Current** | Ephemeral React state |
| **Alternatives** | No URL · partial URL · full filter URL |
| **UI** | Deep-link / Back behavior |
| **API** | None unless server paging coupled |
| **Phase 3I** | Must not encode ownership claims |
| **Must approve** | Parameter set + Back expectations |

### PD-C01-06 — Doctor referral end-to-end certification

| Field | Content |
|-------|---------|
| **Exact question** | Which clinical referral entry paths are in-scope for C-01 acceptance (Add Patient only vs all refer-to-counsellor flows)? |
| **Why unresolved** | Display/Add Patient path exists; historical P0 referral-path concern lacked full fixture closure evidence |
| **Current** | ReferredByDoctorId join + Add Patient surgeon picker |
| **Alternatives** | Scope Add Patient only · full referral matrix UAT · defer |
| **UI** | Visit doctor column; Add Patient |
| **API** | Create session / queue population |
| **Phase 3I** | Must not auto-assign ownership on referral |
| **Must approve** | In-scope referral paths + acceptance criteria |

---

## 12. Automated Test Coverage

| Behavior | Coverage exists? | Notes |
|----------|------------------|-------|
| Client filters (type immediate, owner, Pre-Auth tab) | **Yes** | `waiting-list-client-filters.test.ts` |
| Pagination helpers | **Yes** | `waiting-list-pagination.test.ts` + component tests |
| Pre-Auth membership | **Yes** | `waiting-list-preauth` tests (if colocated) / client-filters Pre-Auth cases |
| Assign / Reassign dialogs | **Yes** | `WaitingListAssignDialog.test.tsx`, Reassign dialog tests |
| Lifecycle / claim / pending RO | **Yes** | `waiting-list-lifecycle-*.contract.test.ts`, pending-readonly |
| Shared queue / branch scope helpers | **Yes** | FE shared-queue / branch-scope tests; BE `WaitingListBranchAuthTests`, `WaitingListSharedQueueContractTests` |
| Add Patient payload / duplicate | **Yes** | `add-patient-to-waiting-list.test.ts` |
| Work row ownership CTAs | **Yes** | `WaitingListWorkRow*.test.tsx` |
| OT Returned row | **Yes** | `WaitingListOtReturnedRow` tests |
| Playwright full WL mutation UAT | **Thin** | Load/responsive/screenshot; `counselling-session.spec.ts` navigates WL; not full Assign/Add Patient/Pre-Auth matrix |
| Accessibility suite for full WL | **Thin** | Layout contracts; no dedicated C-01 a11y acceptance pack |
| Live pass/fail this audit | **PASSING UNKNOWN** | Suites not re-executed here |

**Test gaps (Category E):** Assign E2E; Add Patient E2E; Pre-Auth Queue E2E with live CCMS; server-vs-client pagination scale; full keyboard a11y.

---

## 13. Documentation Reconciliation

| Document / source | Role today |
|-------------------|------------|
| Aug 2026 C-01 transcript / matrix C-WL | **Historical proposal + defect audit**; formal USER ACCEPTED **not found** in `docs/audits/` |
| Sep 2026 superpowers Waiting List worklist specs/plans | **Historical visual redesign SoT**; partially shipped as widgets |
| Phase 3I program Product Decision (Option A) | **Current SoT** — Phase 3I closed |
| PD-S13-J Option A | **Current SoT** — further WL UX OUT OF PACKAGE / NO ACTION for Phase 3I |
| Package B acceptance | **Current SoT** for Sessions — **not** a Waiting List redesign acceptance |
| `counsellor-module-final-completion-audit.md` | **Current SoT** — WL certified ownership **A**; additional UX **H deferred (PD-S13-J)** |
| `hospital-portal-post-phase3i-program-transition-audit.md` | Confirms WL certified scope complete; PD-S13-J no action |
| Early Phase 3I slice docs saying “do not redesign Waiting List” | **Consistent** with PD-S13-J; do not treat as contradiction with future C-01 **if newly authorized** |
| Program-status audit “Phase 3I remains open” | **Superseded** by Option A closure |

**Distinguish:**

- **Current SoT:** Phase 3I closed ownership + PD-S13-J freeze + live code behavior  
- **Historical proposal:** C-01 acceptance + Sep worklist redesign briefs  
- **Deferred:** Further WL UX until new Product authorization  
- **Accepted/certified:** Shared queue, Assign, Claim, Reassign, PD16, open≠own  
- **Unresolved:** C-01 authorization + PD-C01-02…06  

---

## 14. Final Classification

### Required reconciliation table

| C-01 Area | Historical Intent | Current Implementation | Current Evidence | Status | Phase 3I Impact | Product Decision Needed? | Implementation Needed? |
|-----------|-------------------|------------------------|------------------|--------|-----------------|--------------------------|------------------------|
| Page/shell | Clinical worklist shell | Summary+Filter+Queue | `waiting-list/page.tsx` | PARTIALLY RESOLVED | Preserve landing | PD-C01-01 | Only if authorized polish |
| Hierarchy / KPI | Clear ops hierarchy | KPI + tabs coexist | `WaitingListSummaryWidget` | STILL VALID (UX) | None if presentation | PD-C01-01 | Optional UX |
| Search | Fast find | Debounced client search | page + filters | RESOLVED | Preserve shared list | No | No (unless polish) |
| Type/status filters | Clear Apply semantics | Type immediate; tabs | client-filters tests | RESOLVED | Preserve | Optional PD-C01-05 | No unless PD |
| Apply/reset | Unambiguous Apply | Dates Apply; type not Apply | page §6 | RESOLVED | None | Optional | Optional clarity |
| Table/rows | Readable ops rows | 7-track work grid + Owner | layout + WorkRow | PARTIALLY RESOLVED | Preserve Owner/actions | PD-C01-01 | Optional UX |
| Row actions | Correct CTAs | Lifecycle+Assign/Reassign | lifecycle-action + Phase 3I | RESOLVED (certified) | **PRESERVE** | No (change needs PD) | **No redesign of model** |
| Add Patient | Real create, no soft-success | POST sessions+queue | add-patient lib | RESOLVED | Preserve no auto-own | No | No |
| Demographics | Useful detail | Thin sheet; no DOB/blood DTO | Controller DTO; Sheet | PARTIALLY RESOLVED | Read-only OK | **PD-C01-03** | Only if enrich decided |
| Doctor/referral | Show referrer; path works | Doctor join + Add Patient | Controller; WorkRow | PARTIALLY RESOLVED | No auto-own | **PD-C01-06** | UAT/scope first |
| Follow-up info | Show Repeat follow-up | DecisionDate/Reasons map | Controller | RESOLVED | Preserve | No | No |
| Pre-Auth / CCMS | Live queue+count | patientType+CCMS awaiting | preauth.ts | RESOLVED | Preserve rule vs PD | **PD-C01-04** to lock | Polish only if locked |
| OT Returned | Reliable branch fetch | branchId-gated IP fetch | page §8 | RESOLVED | Preserve IP SoT | No | No |
| Pagination | Real or remove chrome | Client functional slice | pagination.ts | PARTIALLY RESOLVED | Preserve shared list | **PD-C01-02** | Only after PD |
| Loading/empty/error | Honest states | Present | QueueWidget + toasts | RESOLVED | Preserve | No | Optional copy |
| Responsive/a11y | Workstation usable | Layout tracks; thin formal a11y | layout tests | PARTIALLY RESOLVED | None | PD-C01-01/UAT | Optional |
| Ownership display | Clear owner | Owner column | WorkRow | RESOLVED | **PRESERVE** | No | No |
| Assign | Explicit | Dialog + eligibility | AssignDialog | RESOLVED | **PRESERVE** | No | No |
| ReQueue | Honest ownership clear | Follow-up CTA; not WL | Follow-up Center | RESOLVED / N/A on WL | **PRESERVE** | No | No |
| WL ↔ Sessions | Clear relationship | Separate routes; Package B Sessions RR | sidebar; sessions page | RESOLVED | **PRESERVE** | No | No |
| Nav into session | Open without claim | navigateToSession / Assign first | page handleRowClick | RESOLVED | **PRESERVE** | No | No |
| paymentType Pre-Auth (A) | Fix mapping | patientType SoT | preauth.ts | RESOLVED | None | No | No |
| Dead Pre-Auth count (B) | Fix count | Predicate count | page tabCounts | RESOLVED | None | No | No |
| Soft-success (C) | Stop false success | Real API + error path | add-patient | RESOLVED | None | No | No |
| AddOnSurgery schema (H) | Align schema/write | App writes AddOnSurgery | MarkAddOnSurgery | INSUFFICIENT EVIDENCE (DB CHECK) | Preserve status meaning | Env verify / optional PD | Only if DB broken |
| Formal C-01 acceptance | USER ACCEPTED | Not found | docs/audits search | STILL VALID (governance) | None | Yes (acceptance gate) | Acceptance, not code |
| Further visual redesign | Worklist v2 goals | Deferred by PD-S13-J | PD-S13-J Option A | OUT OF SCOPE / DEFERRED until PD-C01-01 | Must not reopen ownership | **PD-C01-01** | Only after authorize |

### Category rollup

| Category | Items |
|----------|-------|
| **A Certified/complete** | Shared queue, Assign/Claim/Reassign, open≠own, Pre-Auth functional fix, Add Patient soft-success fix, type Apply fix, OT race fix, Repeat follow-up mapping, Sessions relationship |
| **B UX opportunity** | KPI/composition density, row hierarchy polish, filter clarity, optional URL state, a11y hardening |
| **C Product Decision** | PD-C01-01…06 |
| **D Implementation gap** | **None evidenced** against currently authorized behavior (PD-S13-J = no further UX authorized) |
| **E Test gap** | WL Assign/Add Patient/Pre-Auth E2E; full a11y |
| **F UAT/acceptance gap** | Formal C-01 USER ACCEPTED pack not found |
| **G Deferred** | Further WL UX under PD-S13-J; Dashboard; soft-delete UI |
| **H No longer applicable** | Decorative disabled pager as originally described; paymentType-on-WL-row defect |
| **I Insufficient evidence** | Full clinical referral path matrix; live DB CHECK for AddOnSurgery |

---

### Exactly one classification

# **A. C-01 READY FOR PRODUCT DECISION**

**Why this and not others:**

- **Not C:** Material UX/governance scope remains (deferred polish + formal acceptance + open PDs).  
- **Not B:** Current code + Phase 3I docs are sufficient to frame decisions; no blocking evidence hole for the PD gate itself.  
- **Not D:** PD-S13-J is **resolved** (Option A). C-01 is not blocked mid-flight by an open Phase 3I PD; it needs a **new** authorization PD surface, which this audit defines.

---

## 15. Recommended Next Gate

```text
NEXT GATE = PRODUCT DECISION (C-01 AUTHORIZATION + BOUNDED SCOPE)
```

1. Product answers **PD-C01-01…06** (select options explicitly).  
2. If PD-C01-01 = no authorize → C-01 remains deferred; **STOP** (consistent with PD-S13-J).  
3. If PD-C01-01 = authorize presentation-only polish → write implementation plan **after** PD, preserving §9 DO NOT CHANGE list.  
4. Do **not** start implementation from this audit.  
5. Do **not** reopen Phase 3I, create Slice 14, or create Phase 3J in this step.  
6. Do **not** treat this audit as Product Decision acceptance.

---

## 16. Evidence Index

### Authoritative current SoT

- `docs/audits/counsellor-ownership-work-allocation-phase3i-program-product-decision.md`  
- `docs/audits/counsellor-ownership-work-allocation-phase3i-slice13-product-decisions.md` (PD-S13-J)  
- `docs/audits/counsellor-ownership-work-allocation-phase3i-slice13-closure.md`  
- `docs/audits/hospital-portal-post-phase3i-program-transition-audit.md`  
- `docs/audits/counsellor-module-final-completion-audit.md`  
- `docs/audits/phase3i-slice13-package-b-acceptance.md` (Sessions — adjacent)  

### Historical C-01 / redesign

- Agent transcript C-01 Waiting List acceptance (2026-08-27) — defects A–J  
- `apps/hospital-portal-web/docs/ip-product-ui-ux-e2e-acceptance-matrix-2026-08-27.md` (C-WL)  
- `docs/superpowers/specs/2026-09-05-counsellor-waiting-list-worklist-design.md`  
- `docs/superpowers/plans/2026-09-05-counsellor-waiting-list-worklist.md`  
- `docs/superpowers/specs/2026-09-07-counsellor-waiting-list-worklist-v2.md`  
- `docs/superpowers/plans/2026-09-07-counsellor-waiting-list-worklist-v2.md`  

### Frontend

- `apps/hospital-portal-web/src/app/dashboard/counsellors-desk/waiting-list/page.tsx`  
- `apps/hospital-portal-web/src/components/counsellors-desk/waiting-list/*`  
- `apps/hospital-portal-web/src/lib/counsellors-desk/waiting-list-*.ts`  
- `apps/hospital-portal-web/src/lib/counsellors-desk/add-patient-to-waiting-list.ts`  
- `apps/hospital-portal-web/src/lib/api/counsellors-desk.api.ts`  
- `apps/hospital-portal-web/src/lib/navigation/sidebar-menu-sections.tsx`  

### Backend

- `microservices/auth-service/AuthService/Controllers/CounselingController.cs` (`waiting-list`, `MarkAddOnSurgery`)  
- `microservices/auth-service/AuthService/Services/CounselingWorkflowService.cs`  
- `microservices/auth-service/AuthService/Models/Counselor/CounselingWorkflowModels.cs`  

### Tests (selected)

- `waiting-list-client-filters.test.ts`, `waiting-list-pagination.ts` tests, Assign/Reassign/WorkRow/OT tests  
- `waiting-list-lifecycle-*.contract.test.ts`, `waiting-list-pending-readonly.contract.test.ts`  
- `AuthService.Tests/WaitingListBranchAuthTests.cs`, nested `WaitingListSharedQueueContractTests.cs`  

---

## Audit control flags

| Flag | Value |
|------|--------|
| IMPLEMENTATION PERFORMED | **NO** |
| PRODUCT DECISION CREATED | **NO** |
| PHASE 3I REOPENED | **NO** |
| SLICE 14 CREATED | **NO** |
| PHASE 3J CREATED | **NO** |
| C-01 IMPLEMENTATION STARTED | **NO** |
| PRODUCTION CODE MODIFIED | **NO** |

---

**END — COUNSELLOR C-01 WAITING LIST REDESIGN RECONCILIATION AUDIT — STOP**
