# Laboratory Management — L2 UAT Correction Implementation

**Date:** 2026-10-07  
**Type:** L2 UAT CORRECTION  
**Status:** IMPLEMENTATION COMPLETE — AUTOMATED TESTS COMPLETE — STOP FOR MANUAL UAT

```text
STATUS: IMPLEMENTATION COMPLETE → AUTOMATED TESTS COMPLETE → STOP FOR MANUAL UAT

ACCEPTANCE: NOT CLAIMED
L3: NOT STARTED
```

---

## Summary

Bounded L2 UAT correction for Laboratory Management:

1. Fixed the live create-order failure caused by circular JSON serialization of `LabReport` ↔ `LabReportItem`.
2. Extended catalog-order create to accept multiple catalog selections as **one** `LabReport` with multiple `LabReportItem` children.
3. Replaced single-test order UX with an Order Composer (add/remove tests, duplicate prevention, selected-state patient/clinician).
4. Audited clinical indication sources — **no authoritative controlled vocabulary exists**; free-text field preserved.
5. Catalog and ordering-clinician pickers load eligible options when opened (search remains available).

---

## Root Cause (HTTP 500 / client transport failure)

| Item | Detail |
|---|---|
| **HTTP method** | `POST` |
| **URL** | `/api/lab-reports/catalog-order` |
| **Observed** | Response starts as `201 Created`, then body serialization expands infinitely through `LabReport.Items[].LabReport.Items…` |
| **Client symptom** | Connection closed / truncated body (often reported as HTTP 500 or network failure in UI) |
| **DB state** | Order **was** committed before serialization failed |
| **Root cause** | Navigation cycle `LabReport` ↔ `LabReportItem.LabReport` without `[JsonIgnore]` (same class of defect as Refund navigations) |
| **Fix** | `[JsonIgnore]` on `LabReportItem.LabReport` and `LabReportItem.TestDefinition` |
| **Regression test** | `CreateFromCatalog_ResponseSerializesWithoutCircularReference` |

Not caused by stale runtime alone — reproduced against live AuthService on `:5073` with a valid CBC001 payload.

---

## Architecture

Preserved approved shape:

```text
LabReport (order root)
├── LabReportItem → test A
├── LabReportItem → test B
└── LabReportItem → test C
```

- Legacy single `testDefinitionId` / `panelId` still accepted.
- New `items[]` payload preferred for multi-test composer.
- Panels still expand to member `LabReportItem` rows under one root.
- No revival of `lab_order` / `lab_order_item` / `lab.api.ts`.

Multi-line header metadata: composite `TestName` (`A + B + C`), null header `TestDefinitionId`/`PanelId`. Per-item code/category/name remain catalog-derived on `LabReportItem`.

---

## Clinical Indication

| Finding | Detail |
|---|---|
| Authoritative lab indication lookup | **None** in entities, enums, APIs, or tables |
| Product decision (existing) | IND-01: required structured **free text**; no fake diagnosis catalog |
| Parallel domains | Imaging `ClinicalIndication` is also free text |
| This slice | Preserve required free-text field; do **not** invent values or a new terminology model |

---

## UX

| Control | Change |
|---|---|
| Dialog title | Order New Laboratory Tests |
| Patient | Selected emerald card + Change (no empty-search look) |
| Ordering clinician | Selected card + load-on-open via existing `/laboratory/catalog/ordering-clinicians` |
| Priority | Default `routine`; labels Routine / Urgent / STAT |
| Tests/Panels | Composer: load-on-open, search, add, remove, exclude duplicates |
| Selected list | Catalog-derived name / code / category / specimen |
| Clinical indication | Required free text |
| Submit | One `POST /lab-reports/catalog-order` with `items[]` |

---

## Authorization

| Surface | Permission | Change |
|---|---|---|
| Catalog search / clinician search | `patient.view` | Unchanged |
| Catalog-order create | `patient.update` | Unchanged |
| Worklist | `patient.view` | Unchanged |
| Lab Technician grants | `laboratory.view`, `patient.view`, `patient.update` | Unchanged |
| `user.view` | Not required for ordering clinician | Preserved |

---

## Data

| Concern | Behavior |
|---|---|
| Persistence | One `lab_reports` row + N `lab_report_items` |
| Duplicate selection | Rejected UI + server (selection keys and expanded test definition IDs) |
| Mixed specimens | Header specimen may be null; per-test catalog metadata shown in UI |
| Migration | **None** — used existing `lab_report_items` |
| CBC001 vs CBC | Both remain distinct catalog identities |

---

## Tests

### Backend (fresh re-run 2026-10-08)

```text
Filter: LaboratoryCatalogTests | LabReportWorklistTests | LabReportCanonicalDocumentTests | LaboratoryClinicalCatalogBootstrapTests
Passed!  - Failed: 0, Passed: 53, Skipped: 0, Total: 53, Duration: 8 s
```

New coverage includes: multi-test one LabReport, duplicate rejection, circular-serialization regression; existing single-test/panel/authz/tenant cases remain.

### Frontend (fresh re-run 2026-10-08)

```text
vitest run src/app/dashboard/laboratory
Test Files  6 passed (6)
Tests       58 passed (58)
```

Includes new `laboratory-l2-uat-correction.test.tsx`.

### Live AuthService repro (restarted `:5073`, India Eye tenant)

```text
POST /api/lab-reports/catalog-order
→ 201 Created
→ one LabReport with 3 LabReportItem children (CBC001 + LIPID001 + HCV001)
→ response body fully serializes (HTTP 500 / truncated body gone)
Duplicate items → 400 "Duplicate test or panel selection is not allowed in one order."
```

---

## Regression

- L1 workbench contracts preserved (button label still “Order New Test”).
- Ordering clinician least-privilege endpoint preserved.
- Slice 4 canonical document tests in the backend filter suite passed (no Slice 4 code changes).
- Legacy single-test catalog-order path preserved.

---

## Out of Scope

L3 Order & Routing, specimen/accession/barcode, observations/results, verification/release, QC, LIS/HL7/FHIR, Counsellor Laboratory bridge, CBC catalog merge, Service Catalog redesign, P360 redesign, new permissions.

---

## UAT Gate

**Implementation complete → Automated tests complete → STOP FOR MANUAL UAT**

Do not claim L2 Acceptance.
