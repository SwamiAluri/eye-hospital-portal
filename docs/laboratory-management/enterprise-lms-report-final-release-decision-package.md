# L-REP-02 — Report Finalization & Release  
## Product Decision Package

**Date:** 2026-10-12  
**Mode:** PRODUCT OWNER INPUT REQUIRED — no implementation authorization  
**Companion audit:** [enterprise-lms-report-final-release-discovery-audit.md](./enterprise-lms-report-final-release-discovery-audit.md)  
**Prior closure (binding principles):** [enterprise-lms-reporting-decision-closure.md](./enterprise-lms-reporting-decision-closure.md) (`PRODUCT_DECISIONS_CLOSED_L_REP_01_AUTHORIZED`)

This package does **not** create a Product Decision Closure. It lists decisions that must be stamped before any L-REP-02 engineering task starts.

---

## 1. Why a new closure is required

L-REP-01 closed **lifecycle principles** (Final/Released exist; Finalize freezes; Release is distinct; no ResultStatus bleed; config gates for numbering/templates/signatory). It did **not** authorize Final/Release implementation mechanics, authority model for a release-capable system, PDF/numbering inclusion, or slice packaging.

---

## 2. Decisions requiring Product Owner stamp

### PD-REP-02-01 — Slice packaging

| Option | Meaning |
| --- | --- |
| **A (recommended)** | L-REP-02A Finalize (metadata) → L-REP-02B Release (metadata) → later PDF/numbering |
| **B** | Single slice: Finalize + Release metadata only (no PDF/numbering) |
| **C** | Single large slice including PDF and/or numbering (requires config gates green) |

**Ask:** Which packaging is authorized?

---

### PD-REP-02-02 — Finalize freeze mechanics

| Option | Meaning |
| --- | --- |
| **A (recommended)** | Finalize sets `Status=Final` on current ReportVersion; no new ReportVersion; Append blocked |
| **B** | Finalize creates a new ReportVersion that is the frozen Final content, then sets Status=Final |

**Ask:** A or B?

---

### PD-REP-02-03 — Live Result re-validation at Finalize

| Option | Meaning |
| --- | --- |
| **A (recommended)** | Trust immutable Draft snapshots + existing claims; do not require live Result still ClinicallyAuthorized |
| **B** | Re-validate every source Result is still ClinicallyAuthorized at the claimed ResultVersion before Final |

**Ask:** A or B?

---

### PD-REP-02-04 — Authority model for Finalize

| Option | Meaning |
| --- | --- |
| **A** | `lms.reports.finalize` + tenant + operating-branch authorization is sufficient governed authority |
| **B** | Finalize requires an additional signatory/release-authority configuration (**CONFIGURATION_REQUIRED** until built) |

**Ask:** A or B? (PD-REP-15 applies; do not invent hierarchies.)

---

### PD-REP-02-05 — Authority model for Release

| Option | Meaning |
| --- | --- |
| **A** | `lms.reports.release` + tenant + operating branch is sufficient |
| **B** | Release requires governed release-authority / signatory configuration (**CONFIGURATION_REQUIRED**) |

**Ask:** A or B?  
**Note:** Discovery default without stamp: treat Release as **CONFIGURATION_REQUIRED** per PD-REP-15.

---

### PD-REP-02-06 — Same-person / multi-signatory

| Option | Meaning |
| --- | --- |
| **A (recommended)** | No same-person restriction between Draft creator and Finalizer/Releaser in L-REP-02 |
| **B** | Finalizer must differ from Draft creator |
| **C** | Multi-signatory required before Final or Release |

**Ask:** A / B / C? (C implies CONFIGURATION_REQUIRED.)

---

### PD-REP-02-07 — PDF / document in L-REP-02

| Option | Meaning |
| --- | --- |
| **A (recommended)** | Out of L-REP-02A/B — metadata Final/Release only; PDF later |
| **B** | Release requires generated/persisted document bytes (CanonicalDocument downstream) — templates **CONFIGURATION_REQUIRED** |
| **C** | Finalize requires document bytes |

**Ask:** A / B / C?

---

### PD-REP-02-08 — Business Report Number

| Option | Meaning |
| --- | --- |
| **A (recommended for first Final/Release)** | GUID Report ID remains sufficient; business number later |
| **B** | Required at Finalize |
| **C** | Required at Release |

B/C → **CONFIGURATION_REQUIRED** (do not invent format).

---

### PD-REP-02-09 — Release ReportVersion behavior

| Option | Meaning |
| --- | --- |
| **A (recommended)** | Release is aggregate metadata (releasedAt/By) on existing Final version; no new ReportVersion |
| **B** | Release creates a new ReportVersion |

---

### PD-REP-02-10 — Notification intent on Release

| Option | Meaning |
| --- | --- |
| **A (recommended)** | Defer intent emission; Release succeeds without NotificationHub write |
| **B** | Emit notification intent in same Release transaction (delivery still separate) |

---

### PD-REP-02-11 — Draft source claim lifetime after Final/Released

| Option | Meaning |
| --- | --- |
| **A (recommended)** | Claims remain; ResultVersion cannot enter a new Draft Report until a future Amendment policy releases/supersedes |
| **B** | Claims released when Report becomes Final or Released |

---

### PD-REP-02-12 — Amendments prerequisite

| Option | Meaning |
| --- | --- |
| **A (recommended)** | Final/Release proceed; Amendments remain future (PD-REP-17) |
| **B** | Amendment policy must be closed before Finalize is authorized |

---

### PD-REP-02-13 — Download scope

| Option | Meaning |
| --- | --- |
| **A** | No download in L-REP-02A/B |
| **B** | Download only Released (requires document decision) |
| **C** | Browser print of structured snapshot acceptable interim (no PDF bytes) |

---

### PD-REP-02-14 — Permission grants

| Option | Meaning |
| --- | --- |
| **A (recommended)** | No role grants in implementation; catalogue already exists; ops assigns later |
| **B** | Implementation may seed grants to named roles (specify roles) |

---

## 3. Already closed (do not re-open)

- Report owned by LaboratoryApi (not LabReport / CanonicalDocument SoT)  
- Final/Released are Report states, not ResultStatus  
- Clinical Authorization does not Finalize/Release  
- Released ≠ patient-visible  
- Release ≠ notification delivery  
- Amendments not in first Final/Release unless PD-REP-02-12 = B  
- Fail-closed audit; idempotency; RowVersion  
- No invented numbering/templates/signatory hierarchies  
- Pathology coexistence without dual-write  

---

## 4. Suggested stamp outcomes (after PO answers)

| If PO chooses… | Next status |
| --- | --- |
| 02-01=A, 02-04=A, 02-07=A, 02-08=A, 02-12=A | Finalize (02A) ready for a **separate** Decision Closure → implementation |
| 02-05=B or numbering/PDF required without config | Remain **CONFIGURATION_REQUIRED** for Release/document slices |
| 02-05=A and 02-07=A | Release (02B) can follow Finalize Closure |

---

## 5. Explicit non-authorization

This package does **not** authorize:

- Schema / migrations / APIs / UI  
- Permission grants  
- PDF generation  
- CanonicalDocument changes  
- Patient publication  
- Notification delivery  
- Pathology changes  
- ResultStatus changes  

**Await Product Owner answers → separate Decision Closure task → then implementation.**
