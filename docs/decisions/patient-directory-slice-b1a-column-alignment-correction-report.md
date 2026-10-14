# Patient Directory — B.1A Column Alignment Correction

Document type: Implementation result (layout correction)  
Date: 2026-10-05  
Slice: **B.1A CORRECTION — Worklist column geometry & action alignment**  
Status: **IMPLEMENTATION COMPLETE · AUTOMATED TESTS PASS · BROWSER VERIFICATION BLOCKED · MANUAL UAT PENDING**

Application code changed: **YES** (frontend layout/containment only)  
Backend / DTO / API / permissions / search / census predicates: **NO**  
Next slice: **BLOCKED** pending manual UAT

---

## 1. Root cause of the column mismatch

Three interacting defects produced the live-browser misalignment even though unit tests asserted a “shared” `PATIENT_HUB_COLUMN_TRACK`:

### RC-1 — Hybrid Provider hide (primary)

Provider used CSS `hidden xl:table-cell` on `th`/`td`, while the non-compact **colgroup always reserved seven columns**.

`compactColumns` was wired only as `showDockedPreview` (docked Preview), **not** for viewport `< xl`.

Between `md` (table visible) and `xl` (Provider supposed to appear), the DOM had:

- 7 colgroup tracks (including Provider)
- 6 visible cells (Provider `display: none`)

HTML table column mapping then drifted: header labels and body cells no longer shared the same physical tracks. That matches Phone overlapping Current Visit and Actions appearing outside the Actions header.

### RC-2 — Unbounded Patient leftover track

Under `table-fixed`, the first `<col />` had **no width**. Patient absorbed all remaining table width. At 1440–1600px this created a large empty band between Patient content and Phone, looking like header/row desync even when track indices matched.

### RC-3 — Dual width authority

Tailwind `w-*` / `min-w-*` / `max-w-*` were applied on `th`/`td` **in addition to** colgroup inline widths. In `table-fixed`, cell min/max-width is unreliable; tests passed on class-string presence, not rendered geometry. Phone at 7rem was also too narrow for `+91…` numbers, and cells lacked `overflow-hidden`, so intrinsic content spilled across tracks. Actions used `flex-wrap`, so the action cluster could wrap or visually leave the Actions column.

### Why `PATIENT_HUB_COLUMN_TRACK` did not produce browser geometry

It was a shared **class-name contract**, not a single layout engine. Header and rows used the same strings, but:

1. colgroup disagreed with CSS-hidden Provider,
2. Patient had no track share,
3. overflow was not contained to the track,
4. Vitest `renderToStaticMarkup` cannot prove pixel alignment.

---

## 2. Exact layout architecture after correction

Kept the existing HTML `<table>` (one table → one geometry).

Authoritative model:

1. **`table-layout: fixed` + `border-collapse`**
2. **Percentage widths only on `<colgroup>`** (`PATIENT_HUB_COLGROUP_DESKTOP` / `_COMPACT`), summing to **100%**
3. **Matching `data-col` on `col`, `th`, and `td`** for contract tests
4. **Cells:** `min-w-0 overflow-hidden` — no independent w/min/max width classes
5. **Provider fold:** omit Provider cells from the DOM when `compactColumns` is true (no CSS hide)
6. **`compactColumns={showDockedPreview || !canDock}`** — fold below xl (1280) and when Preview is docked

---

## 3. Final desktop grid definition (≥ xl, Preview not docked)

| Column | Share |
|---|---|
| Patient | 17% |
| Phone | 12% |
| Current Visit | 15% |
| Provider | 11% |
| Location | 9% |
| Next Appointment | 12% |
| Actions | 24% |
| **Total** | **100%** |

---

## 4. Final tablet / compact behavior

When viewport `< 1280` (`!canDock`) or docked Preview:

| Column | Share |
|---|---|
| Patient | 20% |
| Phone | 13% |
| Current Visit | 18% (+ inline Provider) |
| Location | 10% |
| Next Appointment | 14% |
| Actions | 25% |
| **Total** | **100%** |

Provider is omitted from the table track and folded into Current Visit via `showInlineProvider`.

Mobile: unchanged `PatientHubMobileCards` (`md:hidden`).

---

## 5. Phone / Current Visit / Actions containment

- **Phone:** `block min-w-0 max-w-full truncate whitespace-nowrap` inside an overflow-clipped cell; 12–13% track share.
- **Current Visit:** `min-w-0 max-w-full overflow-hidden`; reason + status truncate; max two lines; no pill stack.
- **Actions:** `inline-flex flex-nowrap` (no wrap); 24–25% track; still stopPropagation; no More menu.

---

## 6. Header/body synchronization mechanism

One `<table>` → one `<colgroup>` → same number of `th`/`td` children in order → shared `data-col` keys. Loading/empty/error rows use `colSpan` over the active column count (6 or 7).

---

## 7. Files changed

- `PatientHubTable.tsx` — colgroup SoT, containment, remove CSS Provider hide
- `PatientHubPage.tsx` — `compactColumns={showDockedPreview || !canDock}`
- `PatientHubContextCluster.tsx` — phone nowrap/truncate; Provider fold only when compact
- `PatientHubRowActions.tsx` — `flex-nowrap`
- `patient-lookup-test-ids.ts` — `tableColgroup`
- Tests: `PatientHubTable.a11y`, `patient-directory-layout`, `visual-language`, `slice-e3`, `slice-e4`
- This report

---

## 8. Automated tests

```text
Test Files  22 passed (22)
Tests       103 passed (103)
```

---

## 9. Browser verification status

**BLOCKED — not executed in this session.**

No authenticated Playwright/browser run was performed against the live Directory at 1280 / 1440 / 1600. Prior portal UAT auth bootstrap limitations remain. Do **not** treat Vitest green as browser alignment proof.

Manual UAT (UAT-1–UAT-22) is required.

---

## 10. Explicit out-of-scope confirmation

No changes to: backend, DTO, API, permissions, search/`q`, census predicates/stats, Patient 360, Filters, Preview content, Add Patient, duplicate detection, Counsellor ownership.

Census remains **All | Active** (`Active` → `tab=current`).

---

## 11. Remaining limitations

1. Percentage tracks scale with container width; at very narrow tablet widths the compact `min-w-[56rem]` may introduce horizontal scroll inside the existing worklist scroller rather than crushing Actions.
2. Checked-in Book-appointment limitation from B.1A (no separate future appointment field) is unchanged.
3. Pixel alignment must be confirmed in browser UAT — automated tests assert structural contracts only.

---

## Manual UAT checklist

| ID | Check |
|---|---|
| UAT-1 | Desktop header and all rows have identical column boundaries |
| UAT-2 | Patient column has no excessive unused whitespace |
| UAT-3 | Phone numbers never overlap Current Visit |
| UAT-4 | Long phone values remain readable or safely contained |
| UAT-5 | Current Visit stays within its own column |
| UAT-6 | Long visit reasons truncate cleanly |
| UAT-7 | Provider aligns exactly with Provider header |
| UAT-8 | Location aligns exactly with Location header |
| UAT-9 | Next Appointment aligns exactly with its header |
| UAT-10 | Actions align exactly with Actions header |
| UAT-11 | Print Card and Book appointment fit on one line |
| UAT-12 | No three-dot/More menu exists |
| UAT-13 | Actions never open Preview accidentally |
| UAT-14 | No horizontal overflow at desktop widths |
| UAT-15 | 1280px remains usable |
| UAT-16 | 1440px remains balanced |
| UAT-17 | 1600px does not create excessive Patient-column whitespace |
| UAT-18 | Tablet layout remains usable |
| UAT-19 | Mobile cards remain unaffected |
| UAT-20 | All \| Active census remains unchanged |
| UAT-21 | Continuous search typing remains focused |
| UAT-22 | Preview / Patient 360 / Check-in / Print Card / Book Appointment remain functional |

---

```text
B.1A COLUMN ALIGNMENT CORRECTION: COMPLETE
AUTOMATED TESTS: PASS (22 files / 103 tests)
BROWSER VERIFICATION: BLOCKED — not run (auth/browser UAT required)
MANUAL UAT: PENDING
NEXT SLICE: BLOCKED
```
