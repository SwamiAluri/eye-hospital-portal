# Patient 360 Phase D — Documents Workspace

Date: 2026-10-06  
Status: **PHASE D — DOCUMENTS IMPLEMENTATION COMPLETE — AUTOMATED TESTS COMPLETE — MANUAL UAT REQUIRED — STOP**  
Acceptance: **not claimed**

Route: `/dashboard/patients/[id]?section=documents`  
Blueprint: `docs/decisions/patient-360-complete-ux-redesign-blueprint.md` §I  
Accepted pattern: Phase C Clinical table-first contract  
This slice: **Documents only**

---

## 1. Scope

Patient 360 Documents is a **read/context longitudinal index**, not a document-management worklist.

The user should see which documents are associated with the patient, their type, source, date, status, and whether a **safe existing** View/Open/Details action exists.

**Not started:** Coverage, Administration, Timeline, upload/download infrastructure, new document APIs, new tables, Clinical redesign.

---

## 2. Repository audit

Inspected before coding:

| Item | Finding |
|---|---|
| `Patient360Documents.tsx` | One table + All/Clinical/Counselling/Insurance/Laboratory/Imaging filters already existed |
| Filters Clinical/Lab/Imaging | Declared **“not connected”** even though Clinical already loads notes, labs, and imaging files |
| Insurance filter | Incorrectly mixed CCMS rows with an insurance source-gap label |
| MPI | No patient-scoped MPI documents API; 360 already had gap copy on All-empty |
| CCMS | `getDocumentsByPatient` metadata only; `accessUrl` **must not** be wired (existing 360 tests forbid it) |
| Counselling | `getCounselingDocumentsByPatient` metadata only |
| `Patient360RecordTable` | Headers + compact status row already correct; **not modified** |
| Clinical | Accepted; **not modified** |
| Date helper | `formatPatient360Date` already on the RecordTable module |

---

## 3. Current document sources / APIs

| Index source | API / loader | Bytes? | 360 action |
|---|---|---|---|
| CCMS documents | Existing `loadPatient360Documents` → `GET` via `getDocumentsByPatient` | Not opened in 360 | **View details** Sheet (metadata only) |
| Counselling session documents | Existing `loadPatient360CounsellingDocuments` | Not opened | **View details** Sheet (metadata only) |
| Chart notes | Existing `loadPatient360Clinical` → notes (`patient-notes` GET) | Text | **View chart note** Sheet |
| Laboratory reports | Same clinical loader → labs | `reportUrl` if http(s) | **Open report** (existing Clinical pattern) |
| Imaging files | Existing `loadPatient360ImagingFiles` | No | **View details** Sheet (metadata only) |
| MPI / `getPatientDocuments` | **No patient-scoped source** | — | SOURCE GAP copy |
| Insurance document store | **No 360 GET** | — | SOURCE GAP on Insurance filter |
| Legacy uploads / portal uploads / IP pre-op docs | Not 360 | — | Not wired |

No new API, DTO, storage, or permission catalog.

Calling `loadPatient360Clinical` from Documents reuses the **existing** clinical bundle loader (it also fetches vitals/exams/optical as that loader already does). That is not a new contract.

---

## 4. Permission behavior

Frontend does not add permission codes. 401/403 → unauthorized table/footer copy; other failures → unavailable; empty ready list → empty copy.

| Source | Contract permission (unchanged) |
|---|---|
| CCMS documents | `ccms.document.read` |
| Counselling documents | `session_documents.read` |
| Notes / lab reports | `patient.view` |
| Imaging files | `examination.view` |

Unauthorized metadata is not rendered as rows.

---

## 5. Document table design

One primary Documents section. Filters are `aria-pressed` chips (`aria-label="Document sources"`), **not** a second tablist.

Columns:

| Document | Type | Source | Date | Status | Action |

- Document: `documentName` / note title / lab test name / imaging file name, else `—`
- Type: DTO type/category only (not mime+size dump)
- Source: CCMS Documents · Counselling Documents · Chart notes · Laboratory · Imaging files
- Date: `formatPatient360Date`
- Status: DTO status or `—`
- Action: View details / View chart note / Open report when authorized capability exists; else `—`

Coverage-case id, session id, mime, and byte size stay in the **Sheet**, not the scan row.

CCMS rows appear on **All** only. They are **not** relabeled as insurance documents.

---

## 6. Empty / unavailable / unauthorized behavior

`Patient360RecordTable` always renders headers.

- Empty All: compact status row includes CCMS/counselling honesty **and** `MPI documents are not available in Patient 360.`
- Populated All: MPI gap remains as a compact **footer** status row (not a warning card)
- Unauthorized/unavailable of a second source while rows exist: footer status row
- Insurance filter: `Insurance documents are not available in Patient 360.` inside the table (source gap, not “No documents”)
- Clinical / Laboratory / Imaging filters: notes/labs/files honesty via existing clinical/imaging messages

No standalone paragraph-only empty state.

---

## 7. Source gaps

| Gap | Presentation |
|---|---|
| MPI documents | Always honest on All (empty row and/or footer). Never converted to “No documents” alone |
| Insurance documents | Insurance filter source-gap copy |
| CCMS/counselling **bytes** | Metadata + Sheet; no download/SAS/`access-url` |
| Imaging **bytes** | Metadata Sheet only |
| Portal / legacy / IP pre-op document stores | Not indexed |

---

## 8. Detail / viewer behavior

Reused `Patient360DetailSheet` (`ui/sheet`). Lab `reportUrl` uses the existing external Open-report link when `https?://`.

No second modal stack. No invented viewer for missing bytes.

---

## 9. Responsive behavior

- Panel: `min-w-0 overflow-x-hidden` (same Clinical page-overflow guard)
- Table: existing `ui/table` `overflow-auto` + `min-w-[40rem]`
- Filters wrap (`flex-wrap`)
- No card-wall conversion

Live viewport UAT was **not** run.

---

## 10. Files changed

| File | Role |
|---|---|
| `apps/hospital-portal-web/src/components/patients/record/Patient360Documents.tsx` | Index table, filters, Sheets, overflow, existing loaders |
| `apps/hospital-portal-web/src/lib/patients/patient-360-documents.ts` | MPI / insurance source-gap copy helpers |
| `apps/hospital-portal-web/src/components/patients/record/Patient360Documents.test.tsx` | Phase D presentation contract |
| `docs/decisions/patient-360-phase-d-documents-report.md` | This report |

**Not modified:** Clinical product files, RecordTable primitive, Coverage, Administration, Timeline, Directory, header/Overview.

---

## 11. Automated tests

Focused Patient 360 suite (`patient-360*.test.ts`, `Patient360*.test.tsx`, `patient-handoff.test.ts`, `PatientDirectoryAppointmentDialog.test.tsx`):

**39 files, 185 tests, all passed.**

Documents presentation: **12 passed**. Clinical regression files in the same suite: **passed**.

Playwright / live UAT: **not run**.

---

## 12. Typecheck / build status

`npx tsc --noEmit` still fails on pre-existing `WaitingListFilterToolbar.tsx` parse errors. **Not modified.**

After excluding that file, no additional diagnostics were reported.

Next.js `build` was not run.

---

## 13. Out-of-scope confirmation

Did **not** implement: Coverage, Administration, Timeline, upload/delete/replace, new document repository, new APIs, new permissions, Clinical product changes, Directory/Preview/Create/MRN, billing/insurance/OT/IP, waiting list, counsellor ownership.

Did **not** claim Phase D acceptance.

---

## 14. Manual UAT checklist

Desktop

- [ ] Documents opens from the primary Patient 360 nav
- [ ] One Documents heading (the primary tab), no extra page title
- [ ] Filters All / Clinical / Counselling / Insurance / Laboratory / Imaging are subordinate chips
- [ ] Table headers always visible
- [ ] CCMS and counselling rows are readable; dates formatted
- [ ] Empty All keeps headers + one status row including MPI gap
- [ ] Insurance filter is a source gap and does not list CCMS as insurance files
- [ ] Laboratory Open report only when `reportUrl` is a real http(s) link
- [ ] Imaging/CCMS/notes Details/Sheet do not imply a successful binary viewer
- [ ] No Upload / Delete / Download controls

Tablet / mobile

- [ ] Table scrolls internally
- [ ] Page does not gain horizontal overflow
- [ ] No card-wall conversion
- [ ] Filter chips remain usable

Security

- [ ] Unauthorized source copy is not “No documents recorded”
- [ ] Denied sources do not leak rows
- [ ] `accessUrl` / blob URLs are not shown as download targets

Regression

- [ ] Overview, Clinical, Care, Coverage, Administration, Timeline
- [ ] Directory, Preview, counsellor ownership, billing/insurance

---

## 15. Final STOP gate

**PHASE D — DOCUMENTS IMPLEMENTATION COMPLETE — AUTOMATED TESTS COMPLETE — MANUAL UAT REQUIRED — STOP**

No Phase E (Coverage) or later Patient 360 phase is authorized until manual UAT and **explicit acceptance** of Phase D.
