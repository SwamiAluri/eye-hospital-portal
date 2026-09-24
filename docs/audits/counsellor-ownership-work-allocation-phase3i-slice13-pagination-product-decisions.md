# Phase 3I Slice 13 Package B — Counselling Sessions Pagination  
# PRODUCT DECISION RECORD

| Field | Value |
|-------|--------|
| **Document date** | 2026-09-22 |
| **Acceptance date** | 2026-09-22 |
| **Mode** | **PRODUCT DECISION ACCEPTANCE** — no production code, API, DB, permission, ownership, UI, route, or test implementation in this task |
| **Audit reference** | `docs/audits/phase3i-slice13-package-b-pagination-audit.md` |
| **Audit classification** | **B — EXISTING API SUPPORT** |
| **Parent Package B decisions** | **PD-S13-A = C** · **PD-S13-B = B** · **PD-S13-D = C** (ACCEPTED; unchanged) |
| **Parent Package B SoT** | `docs/audits/counsellor-ownership-work-allocation-phase3i-slice13-product-decisions.md` |
| **Document status** | **ACCEPTED** |
| **Product Decision Review** | **COMPLETE** |
| **Product acceptance** | **ACCEPTED** |
| **Convention** | Under `docs/audits/` to match Phase 3I records |

| Change gate (this task) | Value |
|-------------------------|--------|
| Production code changed | **NO** |
| API / DTO / DB changed | **NO** |
| Permissions / ownership / RR changed | **NO** |
| Sessions UI / routes changed | **NO** |
| Implementation started | **NO** |
| Formal Product Owner acceptance of PAG decisions | **ACCEPTED** |

---

## 1. Document date

**2026-09-22** (documented) · **Acceptance date: 2026-09-22**

---

## 2. Product Decision Review status

| Metric | Status |
|--------|--------|
| Pagination / UX purpose audit | **COMPLETE** |
| Classification | **B — EXISTING API SUPPORT** |
| Product Decision documentation | **COMPLETE** |
| Decisions status | **ACCEPTED** |
| Formal Product Owner acceptance | **ACCEPTED** (2026-09-22) |
| Pagination implementation | **NOT STARTED** — requires **explicit pagination implementation prompt** |
| Manual UAT / Delivery Acceptance | **NOT CLAIMED** |

### Gate summary

```text
PAGINATION AUDIT COMPLETE (B)
    ↓
PRODUCT DECISION DOCUMENTATION COMPLETE
    ↓
PRODUCT OWNER ACCEPTANCE OF PD-S13-PAG-*  ← COMPLETE / ACCEPTED
    ↓
EXPLICIT PAGINATION IMPLEMENTATION PROMPT  ← NEXT GATE
```

**Acceptance of these Product Decisions does not authorize implementation by itself.**  
An explicit pagination implementation prompt is still required.

---

## 3. Audit reference

Authoritative audit:

`docs/audits/phase3i-slice13-package-b-pagination-audit.md`

Confirmed by audit:

- Sessions API already supports `page`, `pageSize`, `TotalCount`, `TotalPages`
- Backend order is already:

```text
Authorized scope
  → existing RR filter (when reassignmentRequired=true)
  → Count
  → Order (SessionDate DESC, CreatedAt DESC)
  → Skip / Take
  → UI
```

- Sessions UI currently hard-codes `page: 1`, `pageSize: 50` and exposes no pagination controls
- No backend business-rule change is required for bounded frontend pagination

---

## 4. PD-S13-PAG-01 — Default page size

| Field | Value |
|-------|--------|
| **Decision ID** | **PD-S13-PAG-01** |
| **Topic** | Default Sessions list `pageSize` |
| **Status** | **ACCEPTED** |
| **Accepted value** | **20 sessions / page** |

### Evidence considered

| Source | Value |
|--------|--------|
| Sessions API `SessionFilters.PageSize` default | **20** |
| Follow-up server-side Counsellor pagination | **20** (`FOLLOWUP_PAGE_SIZE`) |
| Current Sessions UI request | **50** (hard-coded; superseded by this acceptance) |
| Waiting List client-side options | **10 / 25 / 50** (different architecture — client slice; not adopted) |

### Accepted decision

**PD-S13-PAG-01 = 20**

### Rationale

- Aligns with the existing Sessions API contract default
- Aligns with Follow-up’s server-side Counsellor pattern (closest behavioural match)
- Avoids retaining an arbitrary Sessions-only 50-row request without Product basis
- Provides a predictable operational page size

### Not in this acceptance

- Waiting List–style 10/25/50 page-size selector (may be revisited later; not required for bounded paging)

---

## 5. PD-S13-PAG-02 — Page state

| Field | Value |
|-------|--------|
| **Decision ID** | **PD-S13-PAG-02** |
| **Topic** | Where current page is stored |
| **Status** | **ACCEPTED** |
| **Accepted value** | **URL query parameter `page`** |

### Accepted decision

**PD-S13-PAG-02 = URL query parameter**

Use:

- `?page=1`
- `?page=2`
- `?page=3`

Must coexist with RR:

- `/dashboard/counsellors-desk/sessions?page=2`
- `/dashboard/counsellors-desk/sessions?reassignmentRequired=true&page=2`

### Rationale

- Sessions already uses URL state for RR (`reassignmentRequired`)
- Refresh preserves the current page
- Browser Back/Forward has deterministic behavior
- Deep links remain meaningful
- TanStack Query can derive the list request from URL-derived filters

### Constraints (accepted)

- Do not invent a second page-state mechanism as SoT
- Invalid / missing `page` resolves to page **1** at implementation time
- Changing RR / other list filters resets `page` to **1**

---

## 6. PD-S13-PAG-03 — Return from Open

| Field | Value |
|-------|--------|
| **Decision ID** | **PD-S13-PAG-03** |
| **Topic** | Preserve Sessions page when returning from Open |
| **Status** | **ACCEPTED** |
| **Accepted value** | **Preserve current Sessions page on return via existing history / Back** |
| **New route contract required?** | **NO** |

### Accepted decision

**Preserve the current Sessions page when returning from Open.**

Example:

```text
Sessions ?page=3
  → Open session (?from=sessions)
  → view / complete session
  → Back
  → return to Sessions ?page=3
```

### Navigation evidence (accepted path)

| Item | Evidence |
|------|----------|
| Open | `router.push(/dashboard/counsellors-desk/{id}?from=sessions)` |
| List / session Back | Existing `router.back()` / browser history |
| Page encoding | List URL contains `page` (PD-S13-PAG-02); `from=sessions` does **not** encode page |
| Preservation | History restores the list URL including `page` — **no new route, alias, or navigation contract** |

### Constraints (accepted)

- Do not introduce new navigation infrastructure
- Do not expand `from=sessions` into a second page-encoding scheme unless a later Product Decision explicitly requires it

---

## 7. PD-S13-PAG-04 — Backend MaxPageSize

| Field | Value |
|-------|--------|
| **Decision ID** | **PD-S13-PAG-04** |
| **Topic** | Sessions-specific backend MaxPageSize clamp |
| **Status** | **ACCEPTED = DEFER** |
| **Accepted value** | **DEFER** — no Sessions-specific backend MaxPageSize in this bounded work |

### Accepted decision

**DEFER**

Do **not** add a Sessions-specific backend `MaxPageSize` in this Slice 13 Package B pagination gate.

**No backend pagination-limit change is authorized.**

### Rationale

- Not required for frontend pagination against the existing API
- No approved backend change for this gate
- Existing API already supports pagination
- Introducing a backend limit would expand scope beyond classification B

---

## 8. Rationale (summary)

| PD | Accepted | Why |
|----|----------|-----|
| PAG-01 | **20** | Matches API + Follow-up server pattern; replaces undocumented FE 50 |
| PAG-02 | **URL `page`** | Consistent with RR URL state; refresh/Back/deep-link friendly |
| PAG-03 | **Preserve via history** | Achievable without new routes once `page` is in the URL |
| PAG-04 | **DEFER** | Backend clamp out of scope for bounded FE paging |

RR semantics remain locked as audited:

```text
Authorized scope → existing RR filter → count → sort → pagination
```

---

## 9. Certified behavior constraints

These remain **LOCKED** and are **not** reopened by this acceptance:

1. Slice 12 Reassignment Required detection  
2. `CounselorId` as ownership source of truth  
3. `CreatedByUserId` is not ownership  
4. Existing Reassign API / dialog  
5. `counseling_sessions.reassign` permission  
6. CAS / version and 409 conflict behavior  
7. Ownership History  
8. PD16 server-side authorization  
9. Inactive-target protection  
10. Waiting List Reassign eligibility  
11. Follow-up ReQueue behavior  
12. Sessions route (`/dashboard/counsellors-desk/sessions`)  
13. RR query semantics (`reassignmentRequired=true`)  
14. No automatic ownership assignment / clear / transfer / ReQueue  
15. Lifecycle states and ownership semantics unchanged  

Pagination implementation must remain **frontend-only** against the existing Sessions API contract.  
**No backend / API / DB / permission / ownership / RR changes are authorized.**

---

## 10. Implementation scope unlocked after explicit implementation prompt

**Only after** an **explicit pagination implementation prompt**, a bounded frontend implementation **may**:

1. Read `page` from the URL.  
2. Use `pageSize = 20` (**PD-S13-PAG-01**).  
3. Send `page` / `pageSize` to the existing Sessions API.  
4. Render existing server pagination metadata (`TotalCount`, `TotalPages`, etc.).  
5. Add a quiet pagination footer using existing Hospital Portal / Counsellor patterns.  
6. Reset `page` to **1** when RR / other list filter state changes.  
7. Preserve page when returning from Open via existing history / Back (**PD-S13-PAG-03**).  
8. Clamp `page` after Reassign / refetch when the current page exceeds `TotalPages`.  
9. Preserve existing RR filtering (server-side, before pagination).  
10. Preserve Open (primary) / Reassign (secondary, gated) hierarchy.  
11. Reuse existing pagination presentation patterns driven by **server** totals — not client-slice of incomplete data.

**This acceptance does not start implementation.**

---

## 11. Explicit out-of-scope items

The eventual pagination implementation (and this acceptance) must **NOT**:

- Client-slice the returned page as if it were the full population  
- Fetch all Sessions and paginate locally  
- Change RR filtering / predicate / order relative to pagination  
- Create a new API, DTO contract, or backend MaxPageSize (**PD-S13-PAG-04 = DEFER**)  
- Create a new worklist, route, or route alias  
- Create a new ownership entity or change ownership rules  
- Modify Reassign API / dialog semantics  
- Add ReQueue to Sessions  
- Modify Waiting List, Follow-up Center, or Analytics  
- Introduce a new design system or pagination framework  
- Reopen Package B business decisions (PD-S13-A/B/D)

---

## Decision status matrix

| Decision | Accepted value | Formal acceptance |
|----------|----------------|-------------------|
| **PD-S13-PAG-01** | **20** sessions/page | **ACCEPTED** |
| **PD-S13-PAG-02** | URL query `page` (coexists with `reassignmentRequired`) | **ACCEPTED** |
| **PD-S13-PAG-03** | Preserve page on return from Open via existing Back/history; no new route | **ACCEPTED** |
| **PD-S13-PAG-04** | **DEFER** backend MaxPageSize | **ACCEPTED** |

---

## Final status (this task)

**PRODUCT DECISION ACCEPTANCE COMPLETE**  
**PD-S13-PAG-01…04 = ACCEPTED**  
**NO PRODUCTION IMPLEMENTATION PERFORMED**  
**NEXT GATE = EXPLICIT PAGINATION IMPLEMENTATION PROMPT**
