# Counsellor Cross-Module Grid and Filter UX Product Decision

| Field | Value |
|-------|--------|
| **Document status** | **APPROVED — PRODUCT DECISION RECORDED** |
| **Implementation Authorization** | **NOT CREATED** |
| **Product Owner selection** | **RECORDED** — PD-CGX-01 through PD-CGX-06 |
| **Mode** | **GOVERNANCE / PRODUCT DECISION ONLY** |
| **Source audit** | `docs/audits/counsellor-cross-module-grid-and-filter-ux-audit.md` |
| **Decision date** | 2026-09-25 |
| **Earlier status of this file** | 2026-09-25 review recorded **BLOCKED** because the identifier label and the KPI population had not been selected. **Superseded** by the selections in this revision. The blocked text is not retained. |
| **Production code, API, DTO, database, permissions, routes, ownership, workflow, UI, tests** | **NOT MODIFIED** |
| **Implementation performed** | **NO** |

**PRODUCT DECISION APPROVED does not equal IMPLEMENTATION AUTHORIZED.**

The next gate is a separate Implementation Authorization. This task does not create one.

---

## 1. Decision metadata

| Field | Value |
|-------|--------|
| **Decision IDs** | PD-CGX-01 … PD-CGX-06 |
| **Title** | Counsellor Cross-Module Grid and Filter UX |
| **Decision date** | 2026-09-25 |
| **Status** | **APPROVED — PRODUCT DECISION RECORDED** |
| **Implementation Authorization** | **NOT CREATED** |
| **Source audit** | `docs/audits/counsellor-cross-module-grid-and-filter-ux-audit.md` |
| **Scope** | Interaction convention and the six recorded choices. Module-specific information architecture stays |
| **Product Owner decision status** | **APPROVED / ADOPTED** for PD-CGX-01, 02, 03, 04, and 06. **PD-CGX-05 OPTION A APPROVED / ADOPTED** |
| **Selects options?** | **YES** — only the options written in sections 4–9 |
| **Design principle** | **One interaction model + five information architectures.** Not one universal Counsellor grid |
| **Phase 3I** | Remains formally closed. Slice 14 does not exist. Phase 3J does not exist |
| **C-01** | Remains **ACCEPTED / CLOSED**. This decision does not reopen it |
| **Packages LA / B Print / C** | Remain closed |
| **C-LA-04** | Remains deferred |

### Status vocabulary

| Term | Meaning |
|------|---------|
| **APPROVED / ADOPTED** | Explicit Product Owner choice recorded here |
| **NOT AUTHORIZED** | Chosen as direction, but no build, test, or UAT until a later Implementation Authorization |
| **REMAINS IN FORCE** | Already certified behavior confirmed, not redesigned |
| **OUT OF THIS DECISION** | Not solved here. Needs a later Product Decision and, if build is wanted, an Implementation Authorization |
| **DEFERRED** | Named for later. Not approved now |

---

## 2. Problem statement

The five Counsellor surfaces share visual tokens and desktop density. They do not share columns, filters, pagination, data sources, or the meaning of status and owner. That difference is not a defect.

Waiting List is a closed C-01 seven-zone queue. Sessions is a server-paged registry that does not show the medical record number or eye already present on the list DTO. Finalize Surgery and OT Preparation are one shared operational surface with hierarchical schedule cells. Follow-up Center is one visual grid over three sources. Analytics is a report.

The Product Owner adopts a common **interaction** model and keeps five **information architectures**.

---

## 3. Protected baseline

| Boundary | Status |
|----------|--------|
| Phase 3I | Formally closed. Slice 14 does not exist. Phase 3J does not exist |
| C-01 | **ACCEPTED / CLOSED.** Not reopened |
| Waiting List | Shared operational queue. Seven-zone layout remains authoritative |
| View / open | Does not establish ownership |
| `CounselorId` | Semantics unchanged |
| Follow-up | Shared. No My Follow-ups queue. Historical counsellor attribution is not current ownership ACL. ReQueue rules unchanged. Post-Surgery counsellor ownership is not invented |
| Analytics | Reporting surface. My Work is reporting scope, not an operational queue. Authorized Branch and peer counselor scope unchanged. PD13–PD15 unchanged. Existing drill-down destinations unchanged |
| Finalize / OT Preparation | Shared. RESP2 unchanged. No second OT Prepared worklist. FSM unchanged. SequenceNo unchanged |
| Package LA | Closed |
| Package B Print | Closed |
| Package C | Closed |
| C-LA-04 | Deferred |
| Worklists | No duplicate operational worklist |

---

## 4. PD-CGX-01 — Common Counsellor interaction standard

### Question

Should Counsellor adopt one common interaction model across Waiting List, Sessions, Finalize Surgery, Follow-up Center, and Analytics without a new shared grid component and without identical column sets?

### Current state

The surfaces share tokens and density. Columns, filters, pagination, status meaning, and owner meaning differ on purpose. There is no shared Counsellor grid framework.

### Decision

**APPROVED / ADOPTED.**

One common interaction model. Module-specific information architecture stays.

The model is:

1. Visible page title matching the navigation context.
2. State tabs remain population controls where the module already uses them.
3. Existing module-specific filters remain in the toolbar.
4. Clear / Refresh only where the module already supports that behavior.
5. Textual status pills.
6. One explicit primary row action.
7. Secondary actions remain explicit and permission-gated.
8. Result-range / total presentation follows the module’s existing pagination contract.
9. Consistent empty, loading, and error presentation.
10. Consistent header typography.
11. Pattern-B patient identity where an authoritative identifier exists on the list DTO.
12. No generic grid framework.
13. No forced identical column sets across modules.
14. No generic per-column filter row.
15. Owner, historical counsellor, and My Work retain distinct meanings.

### Rationale

The audit’s scanning gaps are interaction and a few already-returned Sessions fields, not a missing universal grid.

### Scope

Visual and interaction convention only.

### Out of scope

Creating `CounsellorDataGrid` or any new grid framework. Rewriting existing grids into one component. Forcing identical columns. Turning Analytics into a worklist. Rewriting Waiting List into a table.

### Implementation implication

**NOT AUTHORIZED.** A later Implementation Authorization may bound presentation-only refinements that this decision names. This decision does not start that work.

---

## 5. PD-CGX-02 — Waiting List layout lock

### Question

Should the accepted C-01 seven-zone Waiting List remain the layout?

### Current state

C-01 is accepted and closed. Patient identity is hierarchical (name, UHID, age, gender). Visit holds type, doctor, and queue time. Procedure and eye share a zone. Owner, Payment / Coverage, Status, and Action are the remaining zones.

### Decision

**APPROVED / ADOPTED.**

The C-01 seven-zone grid remains the authoritative layout. Patient identity remains hierarchical. C-01 is not reopened.

Preserve:

| Zone | Contents |
|------|----------|
| Patient | Patient name, UHID, age, gender |
| Visit | Visit type, doctor, queue time |
| Procedure / Eye | Procedure, eye |
| Owner | Current ownership presentation |
| Payment / Coverage | Current payment / coverage presentation |
| Status | Current status presentation |
| Action | Current action presentation |

### Rationale

Splitting UHID, age, gender, doctor, or eye into new default columns would reopen a closed information architecture. The audit rejected that split.

### Scope

Confirmation of the existing Waiting List layout.

### Out of scope — do not

- Split UHID into its own default column
- Split Age/Gender into separate columns
- Create a separate Doctor column
- Create a separate Eye column
- Add phone, DOB, blood group, or address
- Change the C-01 pagination model
- Change C-01 URL semantics
- Change Pre-Auth membership semantics
- Change ownership semantics

Also unchanged: client pagination, lightweight Age/Gender, Pre-Auth membership, limited URL state, and the Add Patient referral path.

### Implementation implication

**No Waiting List grid change is authorized.** Count semantics are confirmed separately in PD-CGX-05 and are not a layout change.

---

## 6. PD-CGX-03 — Sessions identifier and eye presentation

### Question

What may a future Sessions list show from the authoritative list DTO, and what label is used for `PatientMrn`?

### Current state

The list DTO includes `PatientMrn` (medical record number) and `SurgeryTentativeEye`. The grid does not render them. `PatientMrn` is not the Waiting List HealthId-first display rule. Age, sex, and HealthId are not on the list DTO.

### Decision

**APPROVED / ADOPTED.**

Future authorized presentation may:

**A.** Render the existing list-DTO medical record number as a secondary identity line.

Approved label: **MRN**.

Do **not** label `PatientMrn` as **UHID**. `PatientMrn` is the Medical Record Number and is not equivalent to the Waiting List HealthId-first display rule.

**B.** Render `SurgeryTentativeEye` as secondary information under the existing Surgery column when it is populated.

The Surgery column remains procedure, with eye as secondary information.

**C.** Preserve:

- Decision as the decision column
- Open as the primary action
- Reassign only when Reassignment Required applies
- Server page size 20
- Current Sessions pagination behavior
- Current Reassignment Required behavior
- Current ownership semantics

Target direction (not built by this decision):

| Column | Contents |
|--------|----------|
| Patient | Name, then MRN |
| Session date | Unchanged |
| Surgery | Procedure, eye secondary when populated |
| Decision | Unchanged |
| Action | Open. Reassign when Reassignment Required applies |

No permanent Owner column. No Age/Gender. No patient-name search until API support exists.

### Rationale

MRN and eye are already on the list DTO. The label must say MRN so operators do not treat it as Waiting List UHID.

### Scope

Sessions list presentation direction only.

### Out of scope — not authorized

- HealthId on the Sessions list
- Age
- Gender
- Patient-name search
- Permanent Owner column
- Doctor as a default column
- Session Type as a default column
- `CurrentStage` as a new status column
- `Status` beside Decision
- Session start time as a default column

Those remain separate Product/Data decisions.

### Implementation implication

MRN and eye already exist on the list DTO. **Implementation is not authorized by this Product Decision.** A separate Implementation Authorization is required before any Sessions UI change.

---

## 7. PD-CGX-04 — Grid configuration interactions

### Question

Should this gate introduce column resize, drag-reorder, per-column filter menus, or a generic Columns menu?

### Current state

Those interactions are not implemented on these surfaces. Filtering is the existing module toolbar and state tabs.

### Decision

**APPROVED / ADOPTED FOR THIS GATE.**

Do **not** introduce:

- Column resize
- Drag-and-drop column reorder
- Generic per-column filter menus
- Generic alphabetical column filtering
- Generic Columns visibility menu

The existing module-specific toolbar and state filters remain the filtering model.

A future Columns visibility menu may be considered only through a **separate** Product Decision. If it is ever considered, it must use a button/menu interaction, provide a keyboard-accessible path, expose only authoritative optional fields, not reopen certified Waiting List columns silently, and decide persistence separately.

No such future functionality is approved now.

### Rationale

Resize and reorder do not fix the information-architecture gaps the audit found, and they have no accessible alternative in the product today. Per-column filters would duplicate module filters and would need API support on server-paged lists.

### Scope

Exclusion from this gate.

### Out of scope

Designing resize handles, remembered column order, alphabetical filters, or a Columns menu.

### Implementation implication

**NOT AUTHORIZED** to add these controls. Their absence stays.

---

## 8. PD-CGX-05 — Waiting List KPI / tab count scope

### Question

What population do Waiting List KPI cards and tab counts represent?

### Current state

Counts are computed from the fetched population after authorized branch scope, date range, and type. Quick search, the Owner filter, and the current page do not change the cards or tab badges. Search and Owner change which rows and pages are shown.

### Decision

**OPTION A — APPROVED / ADOPTED.**

KPI cards and tab counts retain current certified population semantics.

Counts represent the fetched population after the existing authorized / type / date constraints.

Counts do **not** change because of:

- Quick search
- Owner filter
- Current page

Search and Owner continue to affect displayed rows and pagination without changing the KPI/tab population.

Preserve:

- Patients / All
- Pending
- Processing
- Done
- Repeat Counselling
- Existing additional state tabs
- Existing Pre-Auth membership behavior
- Existing OT Returned projection behavior

### Rationale

This confirms the behavior C-01 shipped. Matching cards to the search box would change certified count meaning. That alternative (Option B) is not selected.

### Scope

Confirmation of existing count semantics. No formula change.

### Out of scope — do not

- Recalculate KPI cards from visible rows
- Make KPI cards follow Owner
- Make KPI cards follow search
- Change C-01 count formulas
- Change pagination to server-side
- Remove the cards
- Remove the tab counts

### Implementation implication

**No implementation change to the count logic is authorized.** This decision confirms existing semantics.

---

## 9. PD-CGX-06 — Owner terminology

### Question

Should the five surfaces share one universal “Owner” concept?

### Current state

They do not. Waiting List Owner is current `CounselorId` on a shared queue. Sessions shows owner only in the Reassignment Required context. Follow-up Active/Cold shows historical counsellor attribution, not an access-control owner. Analytics My Work is reporting scope. Finalize has no counsellor ownership column. Post-Surgery has no counsellor field on its list DTO.

### Decision

**APPROVED / ADOPTED.**

Do not standardize the five modules around one universal Owner concept.

| Term | Meaning that remains |
|------|----------------------|
| Owner | Current operational ownership where `CounselorId` is authoritative |
| Historical Counsellor | Historical attribution on Follow-up Active/Cold. **Not** current ownership ACL |
| My Work | Analytics reporting scope. **Not** an operational queue |
| Finalize / OT Preparation | Shared operational work. No counsellor ownership column |
| Post-Surgery | Do not invent counsellor ownership when the authoritative DTO does not provide it |

Do **not** create:

- My Waiting List
- My Sessions queue
- My Follow-ups
- My Finalize
- My OT Preparation
- A universal Owner column
- An ownership mutation
- An ownership transfer
- New `CounselorId` semantics

Ownership behavior remains certified.

### Rationale

One column label would collapse assignment, history, and reporting scope into a false operational queue.

### Scope

Terminology boundaries. No ownership redesign.

### Out of scope

Renaming live controls in a way that changes these meanings. Any assignment, reassignment, or ReQueue change.

### Implementation implication

**No ownership work is authorized.**

---

## 10. Resulting design principle

**One interaction model + five information architectures.**

Not one universal Counsellor grid.

| Surface | Role after this decision |
|---------|--------------------------|
| Waiting List | Unchanged C-01 seven-zone shared queue |
| Counselling Sessions | Same registry contract. Future authorized UI may add MRN and eye as secondary lines only |
| Finalize Surgery / OT Preparation | Unchanged shared operational grids. Hierarchical schedule identity stays |
| Follow-up Center | One visual grid, three data-source row templates (Active, Cold, Post-Surgery) |
| Analytics | Reporting surface. Aging table may later share Sessions header/pill styling. It does not become a queue |

Each surface keeps its operational or reporting meaning and its authoritative data contract.

### Approved target direction only

**Waiting List.** Unchanged from C-01. No grid redesign, no column splitting, no new fields, no new grid framework.

**Sessions.** Future authorized presentation may be: Patient (name, MRN), Session date, Surgery (procedure, eye), Decision, Action (Open, and Reassign when Reassignment Required applies). No permanent Owner column. No Age/Gender. No patient-name search until API support exists.

**Finalize Surgery.** Preserve Patient, Surgery, Status, Schedule, Action. Keep hierarchical UHID, eye, time, theatre, reporting time, and relevant contextual metadata. Do not add a SequenceNo column or a counsellor Owner column. Do not create another OT Prepared worklist.

**Follow-up Center.** Keep one visual grid and three row templates. Historical counsellor stays historical attribution. No current-owner inference. No invented Post-Surgery counsellor. No SLA or priority chrome. No My Follow-ups.

**Analytics.** Remains reporting. The aging table may eventually align visually with Sessions. Do not add Owner, Assign, Reassign, row selection, operational queue behavior, or a My Work queue. Preserve PD13–PD15 and existing drill-down destinations.

---

## 11. Data gaps

Explicitly **deferred / outside this gate**. These are not implementation gaps to solve under this Product Decision. Where an API or DTO change would be required, a separate Product Decision and a separate Implementation Authorization are both required.

| Surface | Not solved here |
|---------|-----------------|
| Sessions | HealthId, age, gender, patient-name search, additional lifecycle status presentation, optional Doctor column, optional Session Type, optional session start time |
| Finalize | Age, gender |
| Follow-up | Eye, age, gender, current owner, Post-Surgery counsellor attribution |
| Analytics | Aging UHID, unless an authoritative list/DTO source is established later |
| Waiting List | Phone, DOB, blood group |

---

## 12. Deferred decisions

| Item | Status |
|------|--------|
| Columns visibility menu, including persistence | **DEFERRED.** Separate Product Decision required. Not approved now |
| PD-CGX-05 Option B (counts follow search and Owner) | **NOT SELECTED** |
| Sessions label “UHID” for `PatientMrn` | **NOT SELECTED.** Approved label is **MRN** |
| Sessions options that omit the identifier entirely | **NOT SELECTED** |
| HealthId, age, gender, patient-name search, Doctor, Session Type, `CurrentStage`, `Status` beside Decision, session start time on the Sessions list | **OUT OF THIS DECISION** |
| Waiting List column splits and new demographic columns | **NOT SELECTED.** C-01 layout locked |
| Resize, drag-reorder, per-column filters, alphabetical column filters | **NOT SELECTED** for this gate |
| C-LA-04 | **DEFERRED** (unchanged) |
| Server-side Waiting List pagination | **OUT OF THIS DECISION** |
| Server-side column sorting | **OUT OF THIS DECISION** |
| Any new operational worklist (My Waiting List, My Sessions, My Follow-ups, My Finalize, My OT Preparation, My Work queue) | **NOT SELECTED** |

---

## 13. Implementation authorization status

**IMPLEMENTATION AUTHORIZATION: NOT CREATED**

**PRODUCT DECISION APPROVED does not equal IMPLEMENTATION AUTHORIZED.**

The next step is a separate Implementation Authorization review. It must be created and scoped on its own. This decision does not create that authorization and does not create an implementation prompt.

Until that authorization exists, no production UI, test, API, DTO, permission, ownership, route, or workflow change is allowed under PD-CGX.

### Boundary for a future authorization (not granted now)

A later authorization may consider only:

**A.** Presentation-only common interaction refinements that this decision explicitly approves (titles, header typography, textual status, empty/loading/error consistency, range text that follows each module’s existing pagination contract, Clear/Refresh only where that behavior already exists).

**B.** Sessions: MRN as a secondary line with the label **MRN**, and `SurgeryTentativeEye` as secondary text under Surgery when populated.

**C.** Header, title, and accessibility presentation refinements, if that later authorization bounds them.

Waiting List C-01 remains unchanged.

No API/DTO work is authorized. No ownership work is authorized. No workflow or state-machine work is authorized. No new grid framework is authorized. No change to Waiting List count logic is authorized.

---

## 14. Protected certified behavior

- Phase 3I closed. Slice 14 does not exist. Phase 3J does not exist.
- C-01 accepted and closed. Seven-zone Waiting List unchanged.
- Shared Waiting List. View/open does not establish ownership. `CounselorId` semantics unchanged.
- C-01 pagination, URL semantics, and Pre-Auth membership unchanged.
- Follow-up shared. Historical counsellor attribution is not ACL. ReQueue rules unchanged. Post-Surgery ownership is not invented.
- Analytics My Work remains reporting scope. Authorized Branch and peer counselor scope unchanged. PD13–PD15 unchanged. Existing Analytics drill-downs unchanged.
- Finalize shared. RESP2 unchanged. FSM unchanged. SequenceNo unchanged.
- Package LA closed. Package B Print closed. Package C closed.
- C-LA-04 deferred.
- No second OT Prepared worklist.
- No duplicate operational worklist.

---

## 15. Next governance gate

**IMPLEMENTATION AUTHORIZATION REVIEW**

That review must be created separately and scoped explicitly. It is not started by this document.

Do not implement. Do not modify tests. Do not run UAT.

**STOP.**

PRODUCT DECISION APPROVED — IMPLEMENTATION NOT YET AUTHORIZED
