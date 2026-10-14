# L-CAT-01B — UAT-04 Draft → Review Transition Diagnostic

**Date:** 2026-10-09  
**Mode:** Diagnostic only — no code changes, no retry, no lifecycle/data mutation  
**Record:** `UAT-TEST-001` (`UAT Test 001 - Edited`)  

## Final status

**NO_FIX_REQUIRED_UAT_CAN_CONTINUE**

## Root-cause classification

**A. TRANSITION_NOT_CALLED**

(with explicit caveat below)

Authoritative backend/database state shows **no successful Draft → Review mutation** and **no `SUBMIT_REVIEW` audit footprint** for this version (or anywhere in `audit_log`). Frontend success/stale-list after success (**E**) is ruled out. Backend state machine Draft → Review is implemented correctly (**not D**).

**Caveat:** A retained browser Network HAR for the exact “Submit for review” click was **not** available in this diagnostic session (browser was on login; LaboratoryApi console logs for that click were not recoverable). Therefore a failed HTTP call that never reached audit (**B** / **C**) cannot be 100% excluded from client evidence alone. Server SoT still proves the transition **did not complete**.

---

## 1. User action

| Field | Value |
|---|---|
| Record | `UAT-TEST-001` / display name `UAT Test 001 - Edited` |
| Expected prior state | Draft / v1 |
| Control clicked | **Submit for review** |
| Observed UI after | Returned to Test Catalogue **list**; row still **Draft** / v1; no clear success confirmation |
| UAT-04 result | **NOT PASSED** |

---

## 2. Network request

| Item | Result |
|---|---|
| Retained Network capture of the click | **Not available** in this diagnostic session |
| Intended FE call (source) | `POST /lms/catalogue/{id}/submit-review` via `submitLmsCatalogueReview()` |
| Full URL (configured) | `http://localhost:7076/api/lms/catalogue/{id}/submit-review` |
| Intended body | `{ expectedRowVersion: <current version rowVersion> }` |
| Required permission | `lms.catalogue.manage` (Admin `*` also satisfies) |

**Cannot report** live HTTP status / response body / correlation ID for the UAT click without inventing data.

---

## 3. API response

**Not observed** for the UAT click (no HAR).

What can be stated from server SoT:

| Possible outcome | Consistent with evidence? |
|---|---|
| 2xx Review success | **No** — DB still Draft; `submitted_at` null; no `SUBMIT_REVIEW` audit |
| Stale FE after success | **No** — DB never became Review |
| Error / not called | **Yes** — see §9 |

---

## 4. Backend state (authoritative)

Read-only query against Azure `hospitalportal` for `internal_order_code = 'UAT-TEST-001'`:

| Field | Value |
|---|---|
| CatalogueItem ID | `f7dd25b6-7aba-4da8-a5b4-1ef09d6bac08` |
| Tenant | `155fe198-6ae5-4a01-9254-ead5b427247e` |
| Type | `TEST` |
| Latest version ID | `f544af89-1894-49de-afa0-d1ee5aadb375` |
| Current active version | `null` |
| VersionNumber | **1** |
| Lifecycle status | **Draft** |
| Display name | `UAT Test 001 - Edited` |
| Discipline | `MOLECULAR_DIAGNOSTICS` |
| Change reason | `Initial UAT catalogue draft - Edited` |
| `submitted_at` / `submitted_by` | **null** / **null** |
| `approved_at` / `activated_at` | null |
| `row_version` | **5** |
| Branch applicability rows | **0** (tenant-wide) |
| Soft-deleted | false |

### Data integrity

| Check | Result |
|---|---|
| CatalogueItem count for code | **1** |
| Version count for code | **1** (v1 only) |
| Duplicate / orphan versions | **None** |
| Unexpected Review / Approved / Active version | **None** |

`row_version = 5` aligns with **CREATE_DRAFT (v=1) + four UPDATE_DRAFT** audits (see §7), not with a stuck successful Review transition.

---

## 5. LaboratoryApi log evidence

LaboratoryApi was running on `:7076` during diagnosis. A targeted search for retained `submit-review` / `SUBMIT_REVIEW` log files for the UAT click did **not** yield a durable, attributable request log artifact in this session.

No server log proof of a successful submit was found. Combined with DB/audit SoT, there is **no evidence of a completed Draft → Review mutation**.

---

## 6. Audit evidence

| Query | Result |
|---|---|
| `audit_log` where `action = 'SUBMIT_REVIEW'` (entire DB) | **Count = 0** |
| `audit_log` where `resource_type = 'LmsCatalogueVersion'` and `resource_id = f544af89-…` | **5 rows** — all draft lifecycle |

Audits present for this version (newest first):

| Timestamp (UTC) | Action | Outcome (`status`) |
|---|---|---|
| 2026-10-08 18:39:49 | `UPDATE_DRAFT` | active |
| 2026-10-08 18:39:25 | `UPDATE_DRAFT` | active |
| 2026-10-08 18:37:17 | `UPDATE_DRAFT` | active |
| 2026-10-08 18:37:09 | `UPDATE_DRAFT` | active |
| 2026-10-08 18:10:30 | `CREATE_DRAFT` | active |

**No** `SUBMIT_REVIEW` row for this resource (or any resource).  
Therefore: either the submit endpoint never reached a successful audited transition, or never ran. Fail-closed compensation after a successful save would also leave Draft + no successful `SUBMIT_REVIEW` audit; that path is less likely given healthy `UPDATE_DRAFT` audits minutes earlier on the same audit channel, but cannot be fully excluded without request logs.

---

## 7. Authorization evidence

| Item | Value |
|---|---|
| Submit endpoint permission | `lms.catalogue.manage` (`CatalogueFunctions.SubmitReview` → `LaboratoryAuthz.CatalogueManage`) |
| Admin `*` | Effective for Lab API via `LaboratoryAuthz.HasAny` (wildcard short-circuit) |
| FE button gate | `canManage && status === 'Draft'` (`CatalogueDetailView`) |
| Observed 403 for this click | **Not captured** (no Network HAR) |

No permission grant changes were made. Authorization failure is **not evidenced**; if Admin UAT JWT carries `*`, 403 is unlikely.

---

## 8. Frontend post-response behavior

Source inspection of `CatalogueDetailView`:

```ts
async function runLifecycle(label, action) {
  setBusy(true);
  try {
    const next = await action();
    setDetail(next);                 // stay on detail; update local state
    toast.success(label);            // "Submitted for review"
  } catch {
    toast.error(...);
  } finally {
    setBusy(false);
  }
}
```

Submit button:

```ts
submitLmsCatalogueReview(detail.id, { expectedRowVersion: v.rowVersion })
```

| Behavior | Present? |
|---|---|
| Auto-navigate to list after submit | **No** |
| Query-cache invalidate (React Query) | **N/A** — detail uses local `useState` + explicit load; list reloads on mount |
| “Back to list” link | **Yes** — manual navigation to `/dashboard/lms/configuration/test-catalogue` |

**Interpretation of UAT observation:** returning to the list is explained by the **Back to list** control (or equivalent manual navigation), not by submit success handling. The list showing Draft is **consistent with database truth**, not a stale cache of a successful Review transition.

---

## 9. Backend state machine check

`SubmitForReviewAsync` → `TransitionAsync(..., from: Draft, to: Review, audit: SUBMIT_REVIEW)`:

- Requires current status **Draft**
- Enforces `expectedRowVersion` concurrency
- Runs `ValidateReadyForReview` (code, name, discipline)
- Sets `SubmittedAt` / `SubmittedBy`
- Writes platform audit fail-closed (`SUBMIT_REVIEW` / `LmsCatalogueVersion`)
- Does **not** approve, activate, create a new version, or mutate another version

**Conclusion:** Draft → Review is an explicit server-side lifecycle transition and is correctly implemented. UAT-04 failure is **not** a state-machine design defect.

---

## 10. Root cause

**A. TRANSITION_NOT_CALLED** (server SoT: no successful submit footprint)

Supporting evidence:

1. Status remains **Draft**; `submitted_at` null.  
2. Zero `SUBMIT_REVIEW` audits (resource and global).  
3. List Draft display matches DB (not stale Review).  
4. FE submit handler would keep the user on detail and toast success if the API returned 2xx — that path did not produce a Review state.  
5. Backend Draft → Review implementation is correct.

**Product decision check:** Do not invent lifecycle changes. No backend rejection reason was captured because no successful/failed submit response was retained. Next UAT attempt must capture Network for `POST .../submit-review`.

---

## 11. Smallest safe correction boundary

**No code correction indicated by current evidence.**

Operational next step (Manual UAT, not an agent fix):

1. Open detail:  
   `/dashboard/lms/configuration/test-catalogue/f7dd25b6-7aba-4da8-a5b4-1ef09d6bac08`
2. Open browser DevTools → Network.
3. Click **Submit for review** once.
4. Capture method/URL/status/body for `submit-review`.
5. Confirm DB/UI status becomes **Review** and a `SUBMIT_REVIEW` audit appears.

If Network then shows 4xx/5xx, reopen diagnostic as **B** / **C** with that payload (still without inventing lifecycle rules).

---

## 12. Whether code change is required

**No** — not with the evidence available.

| Final status | |
|---|---|
| **NO_FIX_REQUIRED_UAT_CAN_CONTINUE** | Retry UAT-04 from the existing Draft detail with Network capture |

---

## STOP

- No retry of the transition by the agent  
- No code changes  
- No approve / activate / retire / supersede  
- No new catalogue item  
- L-ORD-01 not started  

Resume Manual UAT at **UAT-04 Submit for review** on existing `UAT-TEST-001` after this report is reviewed.
