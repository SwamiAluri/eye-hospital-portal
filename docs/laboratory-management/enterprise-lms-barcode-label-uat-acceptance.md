# L-COL-01E — Manual UAT Acceptance

**Date:** 2026-10-11  
**Slice:** L-COL-01E — Barcode & Label Lifecycle  

```text
Manual UAT: PASSED
Acceptance: ACCEPTED
L-COL-01E_ACCEPTED
```

- Manual UAT passed.
- L-COL-01E accepted.
- L-COL-01F is **NOT** implemented by this task.
- Testing is **NOT** started by this task.

---

## Test environment

| Item | Value |
|---|---|
| Portal | `http://localhost:3000` |
| LaboratoryApi | `http://localhost:7076` (`/api/lms/health` **200**) |
| AuthService | `http://localhost:5073` |
| Tenant | India Eye Development (`155fe198-6ae5-4a01-9254-ead5b427247e`) |
| UAT actor | `admin@test.com` (Admin; permissions `*`) |
| Corrections preceding acceptance | A (stale LaboratoryApi 404), B (sync print popup) — both verified |

### Primary specimen identifiers

| Identifier | Value |
|---|---|
| Specimen GUID | `65b0ff03-b6ee-4c50-9cdd-cc17fc773acd` |
| Accession | `ACC-20261011-000001` |
| Barcode | `SPC-20261011-000001` |
| Order | `LAB-20261009-000006` (`Submitted`) |
| OrderTest status | `Ordered` |
| CollectionTask | `COL-20261009-000004` / `7137212b-eb7a-49a6-9740-8a2d7f700012` (`Completed`) |
| Specimen status at print/reprint UAT | `Received` |

---

## Automated evidence (fresh run this gate)

| Suite | Result |
|---|---|
| `SpecimenBarcodeServiceTests` | **Passed 28 / Failed 0** |
| FE `specimen-label-print.test.ts` + `enterprise-lms-specimen-ui.test.ts` | **Passed 18 / Failed 0** |

Boundary tests included (among others):  
`Complete_Collection_Does_Not_Auto_Generate_Barcode`, `Receive_Does_Not_Auto_Generate_Barcode_And_Accession_Remains_Distinct`, `Reject_Does_Not_Auto_Generate_And_Retains_Existing_Barcode`, `Rejected_Without_Barcode_Does_Not_Auto_Generate`, `Print_With_Existing_Barcode_Reuses_Same_Value`, `Reprint_Requires_Reason_And_Reuses_Barcode`.

---

## UAT scenarios

### A. No implicit barcode generation

| # | Expected | Actual | Evidence |
|---|---|---|---|
| Complete Collection does not auto-create barcode | No barcode after collection | **PASS** | Unit: `Complete_Collection_Does_Not_Auto_Generate_Barcode`; `SpecimenService.CompleteCollectionAsync` does not call barcode allocation |
| Receive does not auto-create barcode | Accession only; barcode null until print | **PASS** | Unit: `Receive_Does_Not_Auto_Generate_Barcode…`; live Received specimen obtained accession then barcode only via Generate/Print |
| Reject does not auto-create barcode | Reject does not allocate | **PASS** | Unit: `Rejected_Without_Barcode_Does_Not_Auto_Generate` / retain-existing; `RejectAsync` has no barcode allocate path |

Barcode creation remains explicit Generate / Print.

### B. Existing barcode + rejection

| Expected | Actual | Evidence |
|---|---|---|
| Reject after barcode retains same barcode; no replacement | **PASS** (legal Collected path) | Unit: `Reject_Does_Not_Auto_Generate_And_Retains_Existing_Barcode` |
| Live Received specimen cannot be rejected | **PASS** (lifecycle boundary) | Live `POST …/reject` → **400** `invalid_state` / `Reject is allowed only from Collected.` — Receiving/Reject rules unchanged |

### C. Rejected specimen without barcode

| Expected | Actual | Evidence |
|---|---|---|
| Reject before barcode → remains without barcode | **PASS** | Unit: `Rejected_Without_Barcode_Does_Not_Auto_Generate` |
| Live Collected-without-barcode specimen | **N/A** | UAT DB has only one specimen (`Received` + barcode). No product change made to manufacture another. Covered by automated test above. |

### D. Identifier separation

| Expected | Actual | Evidence |
|---|---|---|
| GUID ≠ Accession ≠ Barcode | **PASS** | Live detail: GUID `65b0ff03-…`, accession `ACC-20261011-000001`, barcode `SPC-20261011-000001` — all pairwise distinct |

### E. Reprint invariants

| Expected | Actual | Evidence |
|---|---|---|
| Empty reprint reason blocked | **PASS** | Live **400** `reprint_reason_required`; FE dialog requires reason |
| Valid reason succeeds | **PASS** | Live reprint reason `UAT acceptance reprint verification` → **200**, `printType=Reprint` |
| Barcode unchanged / no new allocation | **PASS** | Live still `SPC-20261011-000001` after reprint; unit `Reprint_Requires_Reason_And_Reuses_Barcode` |
| Manual UI reprint + reason | **PASS** | Prior Manual UAT (Correction B) verified |

### F. Print invariants

| Expected | Actual | Evidence |
|---|---|---|
| Print with existing barcode does not allocate another | **PASS** | Live Print ×2 → both `SPC-20261011-000001`; unit `Print_With_Existing_Barcode_Reuses_Same_Value` |
| Repeated Print uses same barcode | **PASS** | Live PRINT1 == PRINT2 |
| Isolated print window populated (no popup-blocked) | **PASS** | Manual UAT after Correction B |

### G. Label content

| Expected | Actual | Evidence |
|---|---|---|
| Contains MRN, Patient, Order, Collected, Accession (when available), CODE128 + value | **PASS** | Live print payload: MRN `MRN000001`, Patient `Revathi Sundar`, Order `LAB-20261009-000006`, accession `ACC-20261011-000001`, symbology `CODE128`, barcode `SPC-20261011-000001`; HTML builder in `specimen-label-print.ts` |
| No DOB / GUID / collector UUID / receiver UUID / debug | **PASS** | Payload has no DOB field; HTML omits DOB; FE tests assert no DOB; Manual UAT confirmed |

Optional Type/Branch rows appear only when present on payload (approved optional fields).

### H. Permission boundary

| Expected | Actual | Evidence |
|---|---|---|
| View → `lms.specimens.barcode.view` | **PASS** (gated) | FE `LMS_SPECIMENS_PERMISSIONS.barcodeView`; BE `LaboratoryAuthz.SpecimensBarcodeView` on GET barcode |
| Print → `lms.specimens.label.print` | **PASS** (gated) | FE `labelPrint`; BE on POST barcode / label/print |
| Reprint → `lms.specimens.label.reprint` | **PASS** (gated) | FE `labelReprint`; BE on POST label/reprint |
| Lab Tech UAT accounts lack these codes | **PASS** (expected) | Live login `labtech1@hospital.com` / `labmgr1@hospital.com`: barcode.view/print/reprint all **False** — no new production role grants made |
| Admin UAT ops | **PASS** | Admin permissions `*` |

### I. Upstream regression

| Expected | Actual | Evidence |
|---|---|---|
| CollectionTask unchanged | **PASS** | Live `Completed` / `COL-20261009-000004` |
| Order remains Submitted | **PASS** | Live `LAB-20261009-000006` status `Submitted` |
| OrderTest remains Ordered | **PASS** | Live linked OrderTest status `Ordered` |
| Receiving / accession unchanged by print/reprint | **PASS** | Accession still `ACC-20261011-000001` after print/reprint |
| Pathology/legacy Laboratory not used for this flow | **PASS** | LMS LaboratoryApi client only (`NEXT_PUBLIC_LABORATORY_API_URL`); no `/lab-reports` in LMS specimen API |

---

## Print / reprint verification summary

| Check | Result |
|---|---|
| Generate/Print API | Working (prior Manual UAT + live print **200**) |
| Isolated browser print window | Populated; no Chrome “Pop-up blocked” after Correction B |
| CODE128 rendered | Yes |
| Barcode value | `SPC-20261011-000001` |
| Accession | `ACC-20261011-000001` |
| Reprint reason required | Yes (FE + API) |
| Reprint reuses barcode | Yes |

---

## Corrections closed before acceptance

| ID | Issue | Status |
|---|---|---|
| A | Stale LaboratoryApi → HTTP 404 on barcode/print routes | Corrected & verified |
| B | Async/`noopener` print popup → blank `about:blank` | Corrected & verified |

See [enterprise-lms-barcode-label-uat-correction.md](./enterprise-lms-barcode-label-uat-correction.md).

---

## Known non-blocking follow-ups

1. **Stale page copy** — specimen detail still shows descriptive text like “Enterprise LMS · read-only specimen detail (L-COL-01C)” while the page is interactive (Receive/Reject/Print). Cosmetic only; **not** changed in this acceptance task.
2. **Rejection-reason MasterValue seed** — UAT DB temporarily lacked `lms.specimen_rejection_reason` rows (`GET …/rejection-reasons` returned `[]`). Applied existing `migrations/68_lms_specimen_rejection_reasons.sql` during this gate for environment readiness. Live Reject on **Received** remains correctly blocked by lifecycle (`invalid_state`).
3. **No second Collected UAT specimen** — scenario C live replay deferred; covered by automated reject-without-barcode test.
4. **Lab Tech role grants** — barcode/print/reprint permissions not granted to Lab Tech/Manager UAT roles (by design for L-COL-01E); Admin used for operational UAT.

---

## Explicit out-of-scope for this task

- L-COL-01F not implemented  
- Testing slice not started  
- No product behavior changes for acceptance  
- No CollectionTask / Order / Pathology / Receiving redesign  

---

## Final status

```text
L-COL-01E_ACCEPTED
```
