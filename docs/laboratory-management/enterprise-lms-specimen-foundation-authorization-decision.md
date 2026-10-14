# L-COL-01C — Product Owner Authorization Decision

**Date:** 2026-10-10  
**Slice:** L-COL-01C — Specimen Foundation + Complete Collection  
**Status:** `PRODUCT_DECISION_APPROVED_L_COL_01C_AUTHORIZATION`

Resolves [enterprise-lms-specimen-foundation-decision-required.md](./enterprise-lms-specimen-foundation-decision-required.md).

## Q1 — Complete Collection mutation gate — APPROVED **C**

Require **both**:

- `lms.specimens.manage`
- `lms.collection.collect`

Neither alone is sufficient. Server-side LaboratoryApi is authoritative. Does not modify `lms.collection.*` meanings, CollectionTask lifecycle, or ownership.

## Q2 — Specimen detail / read gate — APPROVED **V2**

Authorize when the caller has **either**:

- `lms.specimens.view`
- **or** `lms.specimens.manage`

## Q3 — UI action visibility — APPROVED **Same as Q1**

Complete Collection UI visibility uses the same AND rule as Q1. Frontend is UX-only; API remains authoritative.

## Fixed constraints (unchanged)

- Seed definitions only: `lms.specimens.view` · `lms.specimens.manage` · `lms.specimens.receive`
- No role/user grants in L-COL-01C
- Do not modify `lms.collection.*`
- Do not use `lms.specimens.receive` for Complete Collection (reserved for Receiving)
- CollectionTask lifecycle unchanged; Complete Collection does not transition the task
- Specimen state = Collected; Order = Submitted; OrderTest = Ordered
- No accession / barcode / label / Receiving / custody / aliquot / referral / testing / results / reporting / billing
