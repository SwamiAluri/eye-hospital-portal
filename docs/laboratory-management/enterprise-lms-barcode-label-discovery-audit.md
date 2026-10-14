# L-COL-01E — Barcode & Labels  
# Discovery Audit + Product Decision Gate

**Date:** 2026-10-11  
**Slice:** L-COL-01E — Barcode & Labels  
**Mode:** AUDIT → PRODUCT DECISION WORKSHOP → IMPLEMENTATION READINESS GATE  
**Implementation:** **NOT AUTHORIZED** by this document (discovery audit only)  
**Product Owner decision closure:** [enterprise-lms-barcode-label-decision-closure.md](./enterprise-lms-barcode-label-decision-closure.md) (`PRODUCT_DECISIONS_CLOSED_L_COL_01E_AUTHORIZED`)  

**Program:** Enterprise Hospital Laboratory Management System  
**Project:** Hospital Portal — Counsellor & Ownership  

---

## Gate determination

# PRODUCT_OWNER_APPROVED — SEE DECISION CLOSURE

Product Owner has approved the recommended L-COL-01E decision set. Authoritative stamp and configuration values are recorded in:

**[enterprise-lms-barcode-label-decision-closure.md](./enterprise-lms-barcode-label-decision-closure.md)**  
**Status:** `PRODUCT_DECISIONS_CLOSED_L_COL_01E_AUTHORIZED`

L-COL-01E implementation is authorized only as a **separate bounded task** against that closure. This discovery audit preserves original findings and recommendations; where the closure differs, the closure prevails.

**This document does not implement L-COL-01E.**  
**No barcode columns, generators, label templates, print endpoints, scanner UI, permissions seeding, role grants, migrations, or API/UI changes were made.**

---

## 1. Executive summary

L-COL-01D Receiving & Accession is **accepted at the PRE-UAT / Receive UAT boundary**. Barcode, label generation, and label printing were **explicitly deferred** to L-COL-01E and must not reopen L-COL-01D unless a concrete defect is found.

Current LMS specimen identity is:

```text
Specimen GUID  ≠  Accession  ≠  Barcode
```

- Specimen GUID exists (L-COL-01C).  
- Accession exists after successful Receive (`ACC-YYYYMMDD-NNNNNN`, length **19**) (L-COL-01D).  
- **Barcode does not exist** as an authoritative LMS specimen field.  
- **Label printing does not exist** in LMS.

The Enterprise LMS PRD/BRD v1.0 binary was located outside the repository at:

`C:\Users\Sam Aluri\Downloads\enterprise_laboratory_management_system_prd_brd.docx`

PRD default policy: **print/activate labels at point of collection after patient verification**; labels carry a **durable barcode**, patient identifiers **per policy**, specimen/order information, and collection context. PRD also requires **label print/reprint logging**, **void labels cannot be reused**, and barcode match at collection/receipt **according to location policy**. Full scanner-to-receive, custody, aliquot, and Labelled-state machine expansion remain broader than a safe first L-COL-01E slice unless Product Owner expands scope.

**Existing platform barcode/print assets are reuse patterns only** (Patient MRN JsBarcode/CODE128 + isolated print window; IOL GS1 parser; journey safety token barcode; Counsellor/OT/document print helpers). **None are LMS specimen SoT.** Legacy Pathology `/dashboard/laboratory` must not be promoted.

**Verdict (discovery):** L-COL-01E was ready for Product Owner approval of the PD-COL-BAR-* / AD-COL-BAR-* matrices.  

**Post-approval update (2026-10-11):** Product Owner approved the recommended set. See [enterprise-lms-barcode-label-decision-closure.md](./enterprise-lms-barcode-label-decision-closure.md) (`PRODUCT_DECISIONS_CLOSED_L_COL_01E_AUTHORIZED`). Barcode payload format remains **CONFIGURATION-OWNED** (no engineering-invented prefix/date/width/check-digit). Implementation remains a **separate** authorized task.

---

## 2. Current LMS specimen state

### 2.1 Upstream accepted slices (do not reopen)

| Slice | Status | Boundary relevant to barcodes |
|---|---|---|
| L0 LMS shell | Accepted | `/dashboard/lms` |
| L-CAT-01B | Accepted | Catalogue SoT |
| L-ORD-01B / 01C | Accepted | Order Submitted; OrderTest Ordered; **no** barcode/label at submit (**PD-ORD-17**) |
| L-COL-01B | Accepted | CollectionTask lifecycle unchanged |
| L-COL-01C | Accepted | Specimen birth via Complete Collection → **Collected** |
| L-COL-01D | PRE-UAT passed; Receive UAT executed | Collected → Received + accession; Reject without accession; **barcode/labels deferred** |

### 2.2 `LmsSpecimen` fields present today

Source: `LaboratoryApi/Domain/LmsSpecimen.cs`, receiving migration `20261011075112_AddLmsSpecimenReceivingAccession`, DTOs in `SpecimenDtos.cs`.

| Area | Present? | Evidence |
|---|---|---|
| Specimen GUID (`Id`) | **Yes** | Immutable PK |
| Accession | **Yes** (Received only) | `accession` varchar(19); format `ACC-YYYYMMDD-NNNNNN`; exposed on list/detail DTOs |
| Accession date / sequence | **Yes** (DB/entity) | `accession_date`, `accession_sequence` + `lms_accession_number_sequences`; **not** separately exposed on API DTOs today |
| Specimen status | **Yes** | `Collected` \| `Received` \| `Rejected` |
| CollectionTask link | **Yes** | `CollectionTaskId` |
| Order link | **Yes** | `OrderId` |
| OrderTest links | **Yes** | `lms_specimen_order_tests` (M:N-capable) |
| Patient identity | **Yes** | `PatientId` + MRN/name/DOB snapshots from Order |
| Collection branch / location | **Yes** | `CollectionBranchId`, `LocationText` |
| Receiving branch / location | **Yes** | `ReceivingBranchId`, `ReceivingLocationText` |
| Collector / receiver | **Yes** | `CollectedByUserId` / `ReceivedByUserId` (+ reject actor fields) |
| Audit | **Yes** | Platform `audit_log` via internal allowlist: `CREATE_SPECIMEN`, `COMPLETE_COLLECTION`, `RECEIVE_SPECIMEN`, `REJECT_SPECIMEN` |
| Idempotency | **Yes** | `lms_specimen_idempotency` ops: `complete_collection`, `receive`, `reject` |
| RowVersion | **Yes** | Optimistic concurrency on specimen mutations |
| **Barcode field** | **No** | Entity comment + tests assert absence (`GetProperty("Barcode")` null) |
| **Label print / template** | **No** | Specimens UI copy defers to L-COL-01E |
| Human/business specimen id (non-accession) | **No** | Deferred since PD-COL-SPC-03 |

### 2.3 Confirmed non-introduction of barcode/labels

| Check | Result |
|---|---|
| Barcode not an authoritative specimen field | **Confirmed** |
| Accession remains distinct from barcode | **Confirmed** (PD-COL-REC-13 / PD-COL-SPC-05) |
| Label printing not introduced accidentally | **Confirmed** (UI/API comments + tests forbid `generateBarcode`) |
| CollectionTask unchanged for barcode | **Confirmed** (no barcode ops on CollectionTask) |
| Order / OrderTest unchanged for barcode | **Confirmed** |
| Receiving lifecycle unchanged for barcode | **Confirmed** — Receive/Reject/accession remain L-COL-01D SoT |

### 2.4 Permissions currently defined (specimens)

| Code | Role today |
|---|---|
| `lms.specimens.view` | Read |
| `lms.specimens.manage` | Complete Collection / manage |
| `lms.specimens.receive` | Receive / Reject |

No barcode/label permission codes exist yet. **No role grants in this audit.**

---

## 3. Authoritative source review

### 3.1 Sources reconciled

| # | Source | Role |
|---|---|---|
| 1 | Enterprise LMS PRD/BRD v1.0 (`enterprise_laboratory_management_system_prd_brd.docx`, 08 Oct 2026) | Functional SoT — binary **found outside repo** (Downloads) |
| 2 | L-COL-01B acceptance closure | CollectionTask accepted; Specimen/barcode out |
| 3 | L-COL-01C specimen decision closure (`enterprise-lms-specimen-receiving-decision-closure.md`) | GUID ≠ barcode ≠ accession; barcode deferred |
| 4 | L-COL-01C implementation/acceptance docs | Specimen Collected foundation |
| 5 | L-COL-01D receiving/accession decision closure | PD-COL-REC-13/14 defer barcode/labels to 01E |
| 6 | L-COL-01D implementation report | Accession 19-char; no barcode |
| 7 | L-COL-01D PRE-UAT verification | Passed; no barcode/labels |
| 8 | L-COL-01D UAT 404 correction report | Receive path corrections; barcode still out |
| 9–12 | Code: LaboratoryApi specimen domain, FE specimens UI, Auth audit allowlist, permission catalog | Runtime SoT |

### 3.2 PRD FILE GAP status

| Item | Status |
|---|---|
| PRD binary in repository | **Absent** (repository packaging gap) |
| PRD binary in project Downloads/Library | **Found** — used for this audit |
| Prior closure rule (PD-COL-REC-24) | Repository absence ≠ product unavailability |

### 3.3 Certified decisions that constrain L-COL-01E (not reopened)

| Decision | Status |
|---|---|
| Barcode ≠ accession | **APPROVED** |
| Accession at Receiving only; immutable once issued | **APPROVED** |
| Rejected specimen gets **no** accession | **APPROVED** |
| Order remains Submitted; OrderTest remains Ordered through Receive/Reject | **APPROVED** |
| CollectionTask Completed ≠ Specimen created; Complete Collection creates Specimen | **APPROVED** |
| Recollection → new task + new specimen + prior link (UX deferred) | **APPROVED** |
| Pathology not LMS SoT | **APPROVED** |
| Platform `audit_log` sole audit SoT | **APPROVED** |
| Branch authorization; no new org hierarchy | **APPROVED** |
| No production role grants from decision/audit tasks | **APPROVED** |
| Do not manufacture UAT data merely to exercise Reject | **APPROVED** (operational) |

### 3.4 PRD vs certified Enterprise LMS tension (must not silently invent)

| Topic | PRD | Certified Enterprise LMS today | Handling for L-COL-01E |
|---|---|---|---|
| Submit creates labels/tasks | PRD §6.3 mentions labels at submit | **PD-ORD-17** forbids CollectionTask/Specimen/barcode/label at submit | **Keep PD-ORD-17** — labels belong to Collection/Specimen domain |
| Labelled state before Collected | PRD specimen SM: Planned → Labelled → Collected | LMS: Specimen born **Collected** at Complete Collection | **Do not introduce full PRD Labelled SM** unless PO expands scope |
| Labels at collection (default) | PRD §6.4 Label timing | Barcode never implemented; Receive already works without barcode | Recommend **label/barcode operable from Collected** (and Received), without rewriting Receive |
| Receive scans every container | PRD Receipt assessment | L-COL-01D Receive = identity confirm + accession; **no scan** | Scan-to-receive = **out of L-COL-01E MVP** unless PO expands |
| Custody / aliquot barcodes | PRD SPC-03/05, aliquot own barcode | Deferred | **Out of L-COL-01E** |

---

## 4. Existing-system reuse audit

### 4.1 Inventory (repository-wide)

| Asset | Location (representative) | Domain | What it does |
|---|---|---|---|
| Patient registration card CODE128 + QR | `RegistrationCardPreview.tsx`, `jsbarcode`, `react-qr-code` | Patient / MPI | Renders MRN as CODE128; QR of patient context; print via isolated window |
| Registration card print helper | `registration-card-print.ts` | Patient | Isolated print document; extracts on-screen SVG; **not** SPA `window.print` against chrome |
| Inventory HID/camera scanner | `components/inventory/BarcodeScanner.tsx` | Inventory | Keyboard-wedge burst detection + optional `BarcodeDetector` camera; `onScan(code)` |
| Inventory lookup-by-barcode | `ItemService.GetByBarcodeAsync` / stock batch barcode | Inventory | Lookup pattern; stock SoT |
| IOL / implant GS1 parser | `Gs1BarcodeParser.cs`, FE `gs1-barcode.ts`, `ImplantScanPanel.tsx` | IP / OT / implant UDI | Parses GS1 AI (GTIN/serial/lot/expiry); OT uses plain input+Enter (not `BarcodeScanner`) |
| Journey safety token + wristband print | `JourneySafetyTokenService`, `WristbandPrintDialog.tsx`, `wristband-print.ts` | IP / Ward | Token `WB-…`; `BarcodeValue`; issue/reprint updates `PrintedAt`; QR print sheet; clinical audit events |
| IOL barcode fields on journey | `IolBarcode` / verify endpoints | IP | Compatibility only — not implant barcode SoT (E4) |
| Front-desk token slip | `TokenSlip.tsx` (`@page` ~80mm) | Front desk / OPD | Narrow/thermal-ish CSS + QR; not specimen label SoT |
| Counsellor OT slip / prep list print | `ot-slip-print.ts`, prep list print helpers | Counsellor | Dedicated print windows |
| Counselling estimate PDF/print | `counselling-estimate-pdf.ts` | Counsellor | Print + PDF download pattern |
| Patient 360 / imaging document print | `patient-360-document-print.ts`, `PrintPreview.tsx` | Documents / Imaging | Isolated print / PDF blob UX |
| OPD bill / analytics `window.print` | Billing / Counsellor analytics | Finance / ops | Browser print of pages |
| Auth report barcode placeholder | `ReportService.cs` `[BARCODE PLACEHOLDER]` | Reports | Placeholder text only |
| MFA QR | Notification `QrCodeService` / activate page | Auth | TOTP only — non-clinical |
| Pathology workbench + `LabReport` | `/dashboard/laboratory`, Auth `LabReport` | Legacy Pathology | **No specimen barcode/accession columns**; separate SoT |
| LMS Specimens UI deferral copy | `SpecimenDetailView.tsx` | LMS | Explicitly states barcode/labels deferred to L-COL-01E |
| LMS accession sequence pattern | `lms_accession_number_sequences` | LMS | Tenant + date sequence pattern for identifiers |
| Platform MasterValue | Auth MasterValue + `lms.specimen_rejection_reason` | Platform config | Governed selectable codes pattern |
| Platform audit allowlist | `InternalAuditController.AllowedActions` | Platform | Expand deliberately for new actions |
| LMS number sequences (Order/COL) | LaboratoryApi sequences | LMS | Pattern for tenant-scoped numbers |
| Shared thermal / ZPL / print queue / branch printer config | *(not found)* | — | **Absent** — do not invent from another domain |

### 4.2 GREEN / YELLOW / RED classification

#### GREEN — reusable without changing certified business meaning

| Asset | Reuse as |
|---|---|
| Isolated browser print-window pattern (`registration-card-print`, OT slip helpers) | **UI printing technique** for specimen labels (new label HTML/CSS owned by LMS) |
| Inventory `BarcodeScanner.tsx` | **HID wedge (+ optional camera) scan input** if PO stamps scan-to-find in L-COL-01E |
| Platform `audit_log` + internal audit allowlist expansion pattern | Sole audit SoT for barcode/label actions |
| LaboratoryApi ownership + `lms_*` tables + RowVersion + idempotency tables | Domain home and mutation safety patterns |
| Branch authorization / tenant isolation patterns already on Specimen APIs | Same authorization envelope |
| Accession uniqueness / sequence **pattern** (not accession format itself) | If PO chooses a **separate** barcode sequence |
| MasterValue governed-config pattern | Only if PO chooses configurable label/reason-like masters (not required to invent barcode format) |
| FE permission constants + PermissionGate patterns | Wire new codes when approved |
| IP wristband print **permission ACL pattern** | Pattern only — codes remain IP-specific |
| `jsbarcode` / `react-qr-code` / `qrcode` **libraries already in web package.json** | Client-side symbology rendering **if** PO selects those symbologies |

#### YELLOW — potentially reusable; needs explicit product/architecture decision

| Asset | Why YELLOW |
|---|---|
| Patient MRN CODE128 rendering | Correct **symbology UX pattern**; wrong **payload SoT** (MRN ≠ specimen barcode) |
| Patient card label layout / PHI field set | Shows how PHI appears on physical media; LMS label contents need separate PHI decision |
| QR on registration card / wristband QR | Symbology choice for specimen labels is open; PRD report QR ≠ specimen barcode |
| Wristband issue/reprint/`PrintedAt`/audit workflow | Strong **reprint + print-timestamp** pattern; identity model is IP wristband, not specimen |
| TokenSlip ~80mm `@page` CSS | Closest thermal-width print CSS; not label SoT |
| Accession string as barcode payload | Tempting (19 chars, already unique) but **barcode ≠ accession** is certified; encoding accession as *representation* vs *identity collapse* needs PO wording |
| Specimen GUID as barcode payload | Avoids inventing a format; GUID length/scan ergonomics need ops approval |
| LMS accession sequence infrastructure for a new barcode sequence | Reuse pattern OK; **format/prefix must be PO-owned** (do not invent `BAR-…`) |
| OT implant scan input / inventory `getByBarcode` | Scan/lookup UX patterns; wrong payload domains |
| Counsellor/document PDF download | If MVP includes PDF labels — leakage/PHI risk needs security approval |
| PRD “location policy” for barcode match | Needs tenant/site policy binding; LMS has Branch, not a new hierarchy |

#### RED — must not reuse as LMS specimen barcode/label SoT

| Asset | Why RED |
|---|---|
| Pathology `/dashboard/laboratory` + Auth `LabReport` | Separate SoT; **no** Pathology specimen barcode/accession field to migrate; AD-COL-REC-12 / AD-COL-BAR-07 |
| IOL GS1 / implant UDI barcodes + journey `IolBarcode` compat fields | Implant product identity / frozen compat — not specimen identity |
| Journey safety token `barcode_value` as specimen identity | Wrong-eye/wristband safety token encoding |
| Patient MRN barcode as specimen barcode | Wrong-patient risk; collapses patient ≠ specimen |
| Accession column as the barcode column | Violates PD-COL-SPC-05 / PD-COL-REC-13 unless PO explicitly redefines (not recommended) |
| MFA QR / Auth `ReportService` barcode placeholder | Non-clinical / not a generator |
| Billing/receipt print widgets; CCMS document “accession” naming | Wrong document domains |
| Shared thermal/ZPL/print-queue service | **Does not exist** — do not invent as LMS SoT from another domain |
| Legacy lab ZPL / “Lab accession” claims in older v3 gap docs | Historical gap notes — not Enterprise LMS certified SoT |
| Inventing GS1 lab specimen symbology from IOL parser | Wrong domain semantics |

**Special rule (reaffirmed):** Do **not** migrate or promote legacy Pathology specimen/barcode fields to LMS SoT.

---

## 5. PRD traceability (barcode / labels)

| PRD statement (paraphrase) | PRD locus | Mandatory for enterprise | Covered by certified LMS? | L-COL-01E implication |
|---|---|---|---|---|
| Labels at collection after patient verification; durable barcode; patient IDs per policy; specimen/order; collection context | §6.4 Label timing | Yes (default policy) | Not implemented | Core MVP content + timing decision |
| Label print/reprint logged; void labels cannot be reused | Specimen SM (Labelled) | Yes | Not implemented | Audit + void/reprint rules |
| Receiving uses barcode scan | Receiving queue / receipt assessment | Yes (enterprise) | L-COL-01D Receive without scan | Recommend **defer scan-to-receive** unless PO expands 01E |
| SPC-02 barcode match at collection and receipt per location policy | SPC-02 | Yes | Partial (identity confirm; no barcode) | Match rules need policy decision; full hard-stop scan may be later |
| Aliquot gets own barcode + parent lineage | §6.4 / SPC-05 | Yes later | Deferred | **Out of 01E** |
| Release 1 includes barcode/custody with collection/receipt | Release plan | Program-level | Custody deferred | 01E = barcode/labels; custody separate |
| Keyboard/scanner friendly UX | Usability | Recommended | Pattern elsewhere | Display + optional find-by-scan only if approved |
| Manual label print without MPI/positive ID is high risk | Risk table | Control required | Complete Collection / Receive already require identity confirm | Keep identity gates; do not allow blind bulk label print |

**Invented-from-general-LIMS (forbidden):** none treated as Mandatory without PRD or certified decision citation.

---

## 6. Product decision matrix — PD-COL-BAR-01 onward

Status key for this audit package:

| Status | Meaning |
|---|---|
| **RECOMMENDED** | Engineering recommendation for PO stamp |
| **CONFIGURATION_REQUIRED** | PO must supply concrete value/format (not invented here) |
| **APPROVED (upstream)** | Already closed; reaffirm only |
| **DEFERRED** | Explicitly out of L-COL-01E MVP |

---

### PD-COL-BAR-01 — Barcode identity

| Field | Content |
|---|---|
| **Question** | Is barcode a persistent specimen identifier? Representation only? Multiple barcodes? Reissue? Reuse? |
| **Evidence** | PRD “durable barcode”; void cannot be reused; certified GUID ≠ accession ≠ barcode |
| **Recommendation** | **Persistent barcode value** bound to one Specimen. Machine-readable identifier **distinct** from GUID and accession. **One active barcode value per specimen** for MVP. **No reuse** of a voided barcode value. Reissue of a *new* value only via explicit void+replace workflow (not silent). |
| **Status** | **RECOMMENDED** (awaiting PO) |

---

### PD-COL-BAR-02 — Relationship: GUID / accession / barcode

| Field | Content |
|---|---|
| **Question** | Define Specimen GUID ↔ accession ↔ barcode |
| **Evidence** | PD-COL-SPC-03/05, PD-COL-REC-13 **APPROVED** |
| **Recommendation** | Preserve **three separate concepts**. Barcode value may *encode* accession as human/scan payload **only if PO explicitly allows representation encoding** — it must **not** collapse the accession column into “the barcode field.” Prefer a dedicated `barcode` (or barcode entity) value. |
| **Status** | Separation **APPROVED (upstream)**; encoding choice **RECOMMENDED option set** below |

**Encoding options for PO:**

| Option | Description | Fit |
|---|---|---|
| **E1** | Dedicated barcode value (PO-supplied format/sequence) | Best long-term; **CONFIGURATION_REQUIRED** |
| **E2** | Payload = Specimen GUID string | No invented format; scan ergonomics risk |
| **E3** | Payload = Accession when Received; Collected specimens cannot print until Received | Conflicts with PRD collection-label default |
| **E4** | Collapse barcode == accession as SoT | **Rejected** unless PO overturns certified separation |

**Recommended default for stamp:** **E1** with format supplied by PO/config (do not invent prefix/check digit in engineering). If PO needs a temporary MVP without a new sequence, **E2** may be accepted explicitly.

---

### PD-COL-BAR-03 — Barcode format

| Field | Content |
|---|---|
| **Question** | Configurable? Global? Tenant? Site? Branch? |
| **Evidence** | Accession format was PO/config closed as tenant + UTC date sequence; PD-COL-04 forbade inventing barcode format |
| **Recommendation** | **Tenant-scoped** governed format/sequence (same organizational grain as accession). **Not** branch-specific numbering unless PO requires. **Do not invent** prefix/width/check digit in this audit. |
| **Status** | Principle **RECOMMENDED**; concrete format **CONFIGURATION_REQUIRED** |

---

### PD-COL-BAR-04 — Symbology

| Field | Content |
|---|---|
| **Question** | Governed symbology |
| **Evidence** | Platform Patient cards use **CODE128** via JsBarcode; IOL uses **GS1** (RED for specimen); PRD does not mandate Code 128/39/DataMatrix/QR for specimen labels |
| **Recommendation** | MVP specimen label symbology = **Code 128** (linear), matching existing hospital staff print tooling. Optional human-readable text under bars. **QR/DataMatrix/GS1 not MVP** unless PO mandates. |
| **Justification** | Operational continuity with existing `jsbarcode` CODE128 usage; avoids implant GS1 semantics; thermal-friendly later |
| **Status** | **RECOMMENDED** (awaiting PO) |

---

### PD-COL-BAR-05 — Generation timing

| Field | Content |
|---|---|
| **Question** | When is barcode created? |
| **Evidence** | PRD default: labels at collection after verification. LMS Specimen exists at Complete Collection. Receive already works without barcode. |
| **Recommendation** | Barcode created on first successful **Generate/Print Specimen Label** (or explicit **Assign Barcode**) for a Specimen in **Collected** or **Received**. **Do not** auto-create barcode merely because a Specimen row exists, and **do not** auto-create barcode inside Receive/Reject (preserves L-COL-01D). Going forward, Complete Collection UX may offer label print as a **follow-on action**, not as a silent side effect of Complete Collection unless PO requires atomic create+print. |
| **Status** | **RECOMMENDED** (awaiting PO) |

---

### PD-COL-BAR-06 — Rejected specimens

| Field | Content |
|---|---|
| **Question** | Retain / none / replacement on recollection |
| **Evidence** | Rejected has no accession; LABELING_ERROR is a rejection reason; PRD void rules |
| **Recommendation** | If never barcoded → remains without barcode. If barcode already issued → **retain historical barcode value**; **do not** issue a new barcode on the rejected specimen; **void further printing** except audited reprint of the same value for investigation if PO allows. Recollection uses **new specimen → new barcode**. |
| **Status** | **RECOMMENDED** (awaiting PO) |

---

### PD-COL-BAR-07 — Recollection

| Field | Content |
|---|---|
| **Question** | Old vs new specimen barcodes |
| **Evidence** | PD-COL-SPC-11: new CollectionTask + new Specimen + prior link |
| **Recommendation** | New specimen → **new barcode**. Old specimen barcode remains historical and must not be reused on the new specimen. |
| **Status** | **RECOMMENDED** (mechanics) / recollection UX still **DEFERRED** |

---

### PD-COL-BAR-08 — Label contents

| Field | Content |
|---|---|
| **Question** | Physical label fields |
| **Evidence** | PRD: durable barcode, patient identifiers per policy, specimen/order info, collection context. Receive already confirms MRN/name/DOB. |
| **Recommendation (candidate set for PO approval)** | **Required:** barcode (symbol + human-readable), patient MRN, patient name, accession **if present**, Specimen GUID short/ref or full per ops, collection date/time, order number. **Optional/PO:** DOB, specimen type/container (from order/catalogue snapshots if available), branch/site name, collector initials. **Do not invent** clinical identifiers beyond Order/Patient/Specimen fields already authoritative. |
| **Status** | Field set **CONFIGURATION_REQUIRED** / **RECOMMENDED candidates** |

---

### PD-COL-BAR-09 — PHI minimization

| Field | Content |
|---|---|
| **Question** | Which patient information may appear on physical labels? |
| **Evidence** | Healthcare UX privacy rules; PRD “per policy”; labels are physical leakage surfaces |
| **Recommendation** | MVP allow **MRN + patient name**; DOB **only if PO explicitly requires** for bedside safety. No address, phone, payer, diagnosis, or full clinical notes on labels. Printing/reprinting requires permission + audit. |
| **Status** | **RECOMMENDED** — requires **product/security approval** |

---

### PD-COL-BAR-10 — Label lifecycle

| Field | Content |
|---|---|
| **Question** | Generate vs print; mandatory?; reprint; audit; original validity |
| **Evidence** | PRD print/reprint logged; void cannot reuse |
| **Recommendation** | Generate barcode value (persist) → render label → print. Print **not mandatory** to complete Receive (L-COL-01D already closed). Reprint **allowed** with reason + audit; **original barcode remains valid** unless voided. Voided barcode values **cannot be reused**. |
| **Status** | **RECOMMENDED** (awaiting PO) |

---

### PD-COL-BAR-11 — Printing architecture (MVP)

| Field | Content |
|---|---|
| **Question** | Browser / PDF / thermal / network / queue |
| **Evidence** | No enterprise print server/thermal fleet in LMS; hospital already uses browser isolated-print for cards/slips |
| **Recommendation** | **MVP = browser isolated print** of an LMS-owned specimen label document. **PDF download optional** only if PO accepts leakage controls. **Thermal / ZPL / network print queue / fleet management = DEFERRED**. |
| **Status** | **RECOMMENDED** (awaiting PO) |

---

### PD-COL-BAR-12 — Reprint semantics

| Field | Content |
|---|---|
| **Question** | Same vs new barcode; auth; reason |
| **Evidence** | PRD void/reuse; durable barcode |
| **Recommendation** | Reprint prints the **same** barcode value; preserves specimen identity; requires **`lms.specimens.label.reprint`** (or manage) + **reason** + audit `REPRINT_SPECIMEN_LABEL`. Does **not** generate a new barcode. |
| **Status** | **RECOMMENDED** (awaiting PO) |

---

### PD-COL-BAR-13 — Lost / damaged label

| Field | Content |
|---|---|
| **Question** | Replacement process |
| **Evidence** | PRD void + reprint; no LMS replacement workflow today |
| **Recommendation** | Operational replacement = **audited reprint of the same barcode** (damaged/lost). **Void+replace with a new barcode** is a separately governed capability (**DEFERRED** unless PO elevates into 01E). Do not invent bedside relabel-without-audit. |
| **Status** | Reprint path **RECOMMENDED**; void+new-value **DEFERRED** |

---

### PD-COL-BAR-14 — Scanning scope for L-COL-01E

| Field | Content |
|---|---|
| **Question** | Generation only vs display vs scanner workflows |
| **Evidence** | PRD wants scan at collection/receipt; L-COL-01D closed without scan; user brief warns not to expand unless approved |
| **Recommendation** | **In MVP:** barcode generation/persistence + on-screen barcode display + label print/reprint. **Optional (PO):** keyboard-wedge **scan-to-find** specimen in worklist. **Out:** scan-to-receive, scan-to-verify, full SPC-02 hard-stop matrix, wristband scan hardware program. |
| **Status** | Core **RECOMMENDED**; scan-to-find **YELLOW optional**; scan-to-receive **DEFERRED** |

---

### PD-COL-BAR-15 — Validation

| Field | Content |
|---|---|
| **Question** | Uniqueness, check digit, invalid/unknown/duplicate handling |
| **Evidence** | Accession uniqueness is tenant-scoped DB-enforced |
| **Recommendation** | Barcode value **unique per tenant** (DB unique filtered index). Check digit **only if PO format requires** (none invented). Unknown barcode on lookup → clear not-found. Duplicate assign attempt → conflict. Invalid symbology payload rejected at generate/print. |
| **Status** | **RECOMMENDED** (awaiting PO) |

---

### PD-COL-BAR-16 — Branch / site configuration

| Field | Content |
|---|---|
| **Question** | Tenant vs site vs branch config |
| **Evidence** | Accession tenant-scoped; no new org hierarchy |
| **Recommendation** | Barcode **format/sequence tenant-wide**. Label **print** authorized under existing **branch** operating context (printer destination is local browser for MVP). Do not add site/section masters. |
| **Status** | **RECOMMENDED** (awaiting PO) |

---

### PD-COL-BAR-17 — Permissions (candidates — no grants)

| Field | Content |
|---|---|
| **Question** | Permission codes |
| **Evidence** | Existing `lms.specimens.view|manage|receive` |
| **Recommendation** | Add capability constants (catalog only when implementation authorized): `lms.specimens.barcode.view`, `lms.specimens.label.print`, `lms.specimens.label.reprint`. Optionally fold barcode view into `lms.specimens.view`. **Do not seed role grants** in decision or first implementation unless separately approved. |
| **Status** | **RECOMMENDED candidates** (awaiting PO) |

---

### PD-COL-BAR-18 — Audit actions

| Field | Content |
|---|---|
| **Question** | Which actions enter `audit_log` |
| **Evidence** | Existing UPPER_SNAKE LMS actions on `InternalAuditController` allowlist |
| **Recommendation** | Candidate allowlist additions (names follow existing convention): `CREATE_SPECIMEN_BARCODE`, `PRINT_SPECIMEN_LABEL`, `REPRINT_SPECIMEN_LABEL`, `VOID_SPECIMEN_LABEL` (void only if void capability is in scope). Resource type remains `LmsSpecimen` (or add `LmsSpecimenLabel` if separate entity — see AD-COL-BAR-02). Fail-closed mutations. |
| **Status** | **RECOMMENDED candidates** (awaiting PO) |

---

### PD-COL-BAR-19 — Idempotency

| Field | Content |
|---|---|
| **Question** | Separate idempotency for generate/print/reprint? |
| **Evidence** | Specimen ops use `lms_specimen_idempotency` with operation names |
| **Recommendation** | **Yes — operation-specific:** e.g. `assign_barcode` / `print_label` / `reprint_label` (exact op names at implementation). Same key + same hash → replay; same key + different hash → conflict. Reprint is a **new** audited event even when barcode value unchanged. |
| **Status** | **RECOMMENDED** (awaiting PO) |

---

### PD-COL-BAR-20 — Concurrency

| Field | Content |
|---|---|
| **Question** | RowVersion / optimistic concurrency |
| **Evidence** | Receive/Reject require ExpectedRowVersion |
| **Recommendation** | Any mutation that assigns barcode, voids barcode, or records label state on the specimen (or label entity) uses **ExpectedRowVersion** / optimistic concurrency with existing `409 concurrency_conflict` semantics. Pure client-side re-render/print of an already-persisted barcode may be non-mutating but still audited if policy requires print audit via backend. |
| **Status** | **RECOMMENDED** (awaiting PO) |

---

## 7. Architecture decision matrix — AD-COL-BAR-01 onward

### AD-COL-BAR-01 — System ownership

| Decision | Recommendation | Status |
|---|---|---|
| Owner of LMS specimen barcode/label domain behavior | **LaboratoryApi** remains owner | **RECOMMENDED** (aligns AD-COL-REC-01) |

No existing approved platform print microservice is the authoritative LMS specimen label owner.

### AD-COL-BAR-02 — Database shape

| Option | Pros | Cons |
|---|---|---|
| **A. Columns on `lms_specimens`** (barcode value, issued_at, voided_at, …) | Simple for one active barcode | Weak print history; reprints only via audit_log |
| **B. Separate `lms_specimen_barcodes` / label entity** + optional current pointer on specimen | Multiple labels/history/void/reprint-friendly | More schema |
| **C. Print-event table only; barcode value = accession/GUID with no barcode column** | Minimal | Collapses identity concepts / fights certified separation |

| Recommendation | **Hybrid:** persist **current active barcode value** on specimen (or 1:1 current barcode row) **plus** append-only **label print events** (print/reprint/void metadata) for operational history. Prefer B/hybrid over print-audit-only. |
| Status | **RECOMMENDED** (awaiting PO) |

### AD-COL-BAR-03 — Identifier separation

| Decision | Preserve Specimen GUID ≠ Accession ≠ Barcode unless PO overturns | Status |
|---|---|---|
| | **RECOMMENDED / upstream APPROVED** | Do not overturn |

### AD-COL-BAR-04 — Printing architecture

| Decision | MVP browser isolated print in hospital-portal-web; backend persists barcode + print audit; no new print microservice | Status |
|---|---|---|
| | **RECOMMENDED** | Thermal/ZPL adapter **DEFERRED** |

### AD-COL-BAR-05 — Audit

| Decision | Platform `audit_log` only; expand allowlist deliberately | Status |
|---|---|---|
| | **RECOMMENDED / upstream APPROVED** | |

### AD-COL-BAR-06 — Configuration source

| Decision | Concrete barcode format/sequence is **CONFIGURATION_REQUIRED** (PO-owned). Reuse LMS sequence **pattern** if a new barcode number is chosen. Do not create a duplicate config platform. Symbology can be a code constant for MVP if PO fixes Code 128. Label template MVP may be code-owned HTML (not a CMS) unless PO requires MasterValue/template registry. | Status |
|---|---|---|
| | **RECOMMENDED** | |

### AD-COL-BAR-07 — Pathology

| Decision | Legacy Pathology barcode/specimen fields are **not** LMS SoT and must not be silently promoted | Status |
|---|---|---|
| | **RECOMMENDED / upstream APPROVED** | |

---

## 8. Security / PHI considerations

| Risk | Assessment | Decision needed |
|---|---|---|
| PHI on physical labels | High leakage surface (printer trays, waste, photos) | PD-COL-BAR-09 |
| Minimum necessary | Prefer MRN+name; DOB optional | PO/security |
| Unauthorized print/reprint | Capability permissions + audit | PD-COL-BAR-17/18 |
| Branch authorization | Reuse specimen branch patterns; browser print is local | Confirm no cross-tenant label render |
| Tenant isolation | Barcode uniqueness + queries tenant-scoped | AD already |
| Printer destination risk | MVP browser print → user-selected OS printer; wrong printer possible | Ops SOP; thermal routing deferred |
| Label leakage | Physical control outside app | SOP |
| PDF download leakage | Higher retention risk than ephemeral print window | Allow PDF only with explicit PO/security OK |
| Browser print exposure | Print dialog may include unexpected chrome if wrong helper used | **Must** use isolated print document pattern (GREEN) |
| Scan under wrong patient | PRD SPC-02 hard-stop | Defer full enforcement unless scan-to-find/receive approved |
| HIPAA/GDPR invention | Do not invent legal regimes beyond project privacy rules | Flag for security review, not engineering invention |

---

## 9. Proposed MVP scope (L-COL-01E)

**In scope (recommended):**

1. Persist a durable specimen barcode value (distinct from GUID and accession).  
2. Explicit assign/generate barcode timing per PD-COL-BAR-05 (not silent on Receive).  
3. Render Code 128 (if PO stamps PD-COL-BAR-04) + human-readable value on specimen detail.  
4. Browser isolated specimen label print.  
5. Reprint with reason + permission + audit (same barcode).  
6. Tenant-unique barcode enforcement + RowVersion + operation idempotency.  
7. Permission catalog entries (no role grants).  
8. Audit allowlist expansion for create/print/reprint/(void if in scope).  
9. UI on existing `/dashboard/lms/specimens` worklist/detail — no second workbench.  
10. Tests asserting L-COL-01D Receive/Reject/accession unchanged; Order/OrderTest/CollectionTask unchanged.

**Optional in MVP only if PO stamps:**

- Keyboard-wedge scan-to-find specimen by barcode.  
- Void label action (without issuing a replacement value).  
- PDF label download.

---

## 10. Explicit out of scope (unless separately approved)

- Full scanner workflow / wristband hardware program  
- Scan-to-receive / scan-to-verify / SPC-02 full hard-stop matrix  
- Aliquots / derivative barcodes  
- Custody chain / In Transit / Hold / Conditional acceptance state expansion  
- Referral receiving  
- Testing / Results / Verification / Authorization / Reporting  
- Billing / Payment  
- QC / instrument integration  
- Printer fleet management / enterprise print server / ZPL thermal adapters  
- Pathology migration or Pathology SoT coupling  
- Changing Order / OrderTest / CollectionTask / Receiving lifecycles  
- Ownership / claim / reassignment for specimens  
- Production role grants  
- Invented barcode format/prefix/check digit without PO configuration  
- Manufacturing UAT data solely to exercise Reject  
- Reopening L-COL-01D without a concrete defect  

---

## 11. UAT / test-data dependencies

| Dependency | Required for L-COL-01E UAT? | Notes |
|---|---|---|
| Collected specimen (no accession) | **Yes** | Label-before-receive path if PO stamps collection-time labeling |
| Received specimen + accession | **Yes** | Label after receive; accession display on label |
| Rejected specimen | **Optional** | Behavior for retain/no-print; do **not** manufacture data solely for Reject |
| Accession present | For Received labels | Already produced by L-COL-01D |
| Configured barcode format | **Yes** if E1 | **CONFIGURATION_REQUIRED** before implementation UAT |
| Configured label field/PHI policy | **Yes** | PD-COL-BAR-08/09 |
| Printer / browser environment | **Yes** | Staff workstation browser print dialog |
| Thermal printer | **No** for MVP | Deferred |
| Scanner hardware | **No** unless scan-to-find approved | Keyboard-wedge optional |

**Do not create test data automatically as part of this audit.**

---

## 12. Implementation prerequisites (after PO approval)

1. Product Owner stamps PD-COL-BAR-01…20 and AD-COL-BAR-01…07 (or records explicit alternates).  
2. Close **CONFIGURATION_REQUIRED**: barcode payload format/sequence (if E1), label field set, PHI (DOB yes/no), PDF yes/no, scan-to-find yes/no, void-in-MVP yes/no.  
3. Separate **implementation task** authorized — this audit does not authorize coding.  
4. Preserve L-COL-01D Receive/Reject/accession behavior and tests.  
5. Expand Auth audit allowlist + permission catalog in the implementation task only.  
6. No Pathology / Billing / Order lifecycle changes.

---

## 13. Open decisions (compact register)

| ID | Topic | Audit status |
|---|---|---|
| PD-COL-BAR-01 | Identity / reuse / one active barcode | RECOMMENDED |
| PD-COL-BAR-02 | GUID ≠ accession ≠ barcode; encoding E1–E4 | Separation APPROVED; encoding RECOMMENDED (E1) |
| PD-COL-BAR-03 | Format scope | RECOMMENDED tenant; format CONFIGURATION_REQUIRED |
| PD-COL-BAR-04 | Symbology Code 128 | RECOMMENDED |
| PD-COL-BAR-05 | Generate on first label/assign; not inside Receive | RECOMMENDED |
| PD-COL-BAR-06 | Rejected retain / no new | RECOMMENDED |
| PD-COL-BAR-07 | Recollection new barcode | RECOMMENDED |
| PD-COL-BAR-08 | Label contents | CONFIGURATION_REQUIRED |
| PD-COL-BAR-09 | PHI minimization | RECOMMENDED + security approval |
| PD-COL-BAR-10 | Lifecycle / non-mandatory print | RECOMMENDED |
| PD-COL-BAR-11 | Browser print MVP | RECOMMENDED |
| PD-COL-BAR-12 | Reprint same barcode + reason | RECOMMENDED |
| PD-COL-BAR-13 | Lost label = reprint; void+replace deferred | RECOMMENDED |
| PD-COL-BAR-14 | No scan-to-receive in MVP | RECOMMENDED |
| PD-COL-BAR-15 | Tenant uniqueness | RECOMMENDED |
| PD-COL-BAR-16 | Tenant format; branch auth for print | RECOMMENDED |
| PD-COL-BAR-17 | Permission candidates | RECOMMENDED (no grants) |
| PD-COL-BAR-18 | Audit action candidates | RECOMMENDED |
| PD-COL-BAR-19 | Op-specific idempotency | RECOMMENDED |
| PD-COL-BAR-20 | RowVersion | RECOMMENDED |
| AD-COL-BAR-01…07 | Ownership, schema hybrid, print, audit, config, Pathology | RECOMMENDED |

---

## 14. Recommended implementation sequence (post-approval only)

1. Decision closure document (PO stamps) + configuration values recorded.  
2. Schema: barcode persistence + print-event history (per AD-COL-BAR-02).  
3. LaboratoryApi assign/generate + print/reprint commands, idempotency, RowVersion, audit allowlist.  
4. Permission constants (no grants).  
5. FE: specimen detail barcode display + label print/reprint UX (Counsellor-quality, desktop-first).  
6. Automated tests + PRE-UAT gate.  
7. Manual UAT on Collected + Received specimens.  
8. STOP — do not start Testing/Results/custody/aliquots.

---

## 15. Final gate status

```text
PRODUCT_OWNER_APPROVED
→ enterprise-lms-barcode-label-decision-closure.md
→ PRODUCT_DECISIONS_CLOSED_L_COL_01E_AUTHORIZED
→ L-COL-01E implementation authorized as a SEPARATE bounded task
```

| Forbidden in this discovery audit task | Status |
|---|---|
| Database migrations / barcode columns | **Not done** |
| Generators / templates / print endpoints / print UI | **Not done** |
| Scanner UI | **Not done** |
| Permissions seeding / role grants | **Not done** |
| API / FE implementation changes | **Not done** |
| L-COL-01D / Specimens / Collection / Orders / Catalogue / Pathology / Billing modifications | **Not done** |

**Authoritative next gate:** [enterprise-lms-barcode-label-decision-closure.md](./enterprise-lms-barcode-label-decision-closure.md) — Product Owner stamped PD-COL-BAR-01…20 and AD-COL-BAR-01…07. Proceed only via a **separate** L-COL-01E implementation task. Do not implement barcode/label functionality from this audit alone.

---

## Appendix A — Evidence index (code)

| Item | Path |
|---|---|
| Specimen entity (no barcode) | `microservices/laboratory-service/LaboratoryApi/Domain/LmsSpecimen.cs` |
| Statuses / audit action names | `.../Domain/SpecimenEnums.cs` |
| Receive/Reject/Complete Collection | `.../Services/SpecimenService.cs` |
| DTOs | `.../Services/SpecimenDtos.cs` |
| Audit allowlist | `microservices/auth-service/AuthService/Controllers/InternalAuditController.cs` |
| Specimen permissions | `AuthService/SeedData/EnterpriseLmsSpecimenPermissionCatalog.cs`, `lms-permissions.ts` |
| FE deferral copy | `apps/hospital-portal-web/src/components/lms/specimens/SpecimenDetailView.tsx` |
| Patient CODE128 pattern | `apps/hospital-portal-web/src/components/patients/RegistrationCardPreview.tsx` |
| Print isolation pattern | `apps/hospital-portal-web/src/lib/patients/registration-card-print.ts` |
| Inventory scanner (GREEN input) | `apps/hospital-portal-web/src/components/inventory/BarcodeScanner.tsx` |
| Wristband reprint pattern (YELLOW) | `IpManagementService/Services/JourneySafetyTokenService.cs`, `WristbandPrintDialog.tsx` |
| GS1 (RED for LMS specimen) | `IpManagementService/Services/Gs1BarcodeParser.cs` |
| Pathology LabReport (no barcode) | `AuthService/Models/Domain/LabReport.cs` |

## Appendix B — Document relationships

| Document | Relation |
|---|---|
| `enterprise-lms-specimen-receiving-decision-closure.md` | Barcode deferred; identity separation |
| `enterprise-lms-receiving-accession-decision-closure.md` | PD-COL-REC-13/14 → L-COL-01E |
| `enterprise-lms-receiving-accession-implementation.md` | Accession SoT; barcode out |
| `enterprise-lms-receiving-accession-pre-uat-verification.md` | PRE-UAT passed |
| `enterprise-lms-collection-specimen-decision-closure.md` | Historical PD-COL-04 barcode workshop |
| `enterprise-lms-barcode-label-decision-closure.md` | Product Owner stamp — `PRODUCT_DECISIONS_CLOSED_L_COL_01E_AUTHORIZED` |
| This file | L-COL-01E discovery + decision package (superseded as stamp by decision closure) |
