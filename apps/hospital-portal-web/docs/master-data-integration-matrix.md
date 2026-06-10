# Master data integration matrix

Canonical registry: `src/lib/master-data/integration-manifest.ts`  
CI enforcement: `npm run test:parity:master`

## How to read this

| Status | Meaning | Admin edits in Master Data UI? |
|--------|---------|--------------------------------|
| **wired** | `useMasterValues` (or equivalent) drives live dropdowns | Yes — changes appear in UI |
| **catalog-owned** | Service Catalog (procedures, investigations, prices) | **Master Data → Service Catalog** — CRUD admin UI (F1) |
| **hardcoded** | TypeScript constants by design | No — code change / future migration |
| **planned** | Seeded in master; integration scheduled (Program B) | Yes, but UI not connected yet |
| **deprecated** | Legacy API; do not add consumers | Prefer master lookup or catalog |

## Quick answers

| Question | Answer |
|----------|--------|
| Counsellor **procedures**? | **Service Catalog** → synced labels in `clinical.surgery_type` |
| Counsellor **investigations**? | **Service Catalog** only — `DIAGNOSTICS` → imaging tab, `INVESTIGATIONS` → lab tab (B2) |
| Counsellor **packages**? | **`counselling_package_templates`** API — Master Data → Counsellor → Counselling Packages (`CounsellingPackagesAdmin`) |
| OPD **payment modes**? | `billing.payment_mode` via `usePaymentModes` — **CheckInModal**, **PaymentCollectionWidget**, inventory GRN |
| Optometry **exam dropdowns**? | **hardcoded** (`*-form-options.ts`) — parity via `field-parity-manifest.ts` |

## Wired today (`useMasterValues`)

| Entity type | Primary screens |
|-------------|-----------------|
| `patient.*` (10 types incl. `nationality`, `id_proof_type`, `relationship`) | Registration (`patients/new`), payment widgets |
| `clinical.anesthesia_type` | Finalize OT modal / surgery drawer |
| `appointment.type`, `consultation_type`, `priority`, `cancel_reason` | Booking, filters, cancel dialog |
| `operations.station`, `routing_reason` | Front desk, optometry queue |
| `operations.service_room` | Optometry rooms API lookup |
| `insurance.provider` | Patient modal, counsellor, CCMS alignment |
| `counselling_package_templates` | Counsellor desk package workspace + estimate engine |
| `counsellor.settings` | Tenant max discount % / flat cap (`CounsellingPackagesAdmin`) |
| `counsellor.comm_channel` | Contact log + send reminder modals |
| `counsellor.reminder_type` | Send reminder message types + templates |
| `counsellor.callback_type` | Schedule callback (contact log) |
| `counsellor.session_type` | Add patient, re-queue, repeat session start, session header |
| `inventory.purchase_category` | GRN, returns |
| `billing.payment_mode` | Check-in, payment widget, inventory GRN |
| `system.timezone`, `currency`, `language` | System settings |

## Catalog-owned (not master CRUD)

| Asset | API | Sync to master |
|-------|-----|----------------|
| Surgery variants | `GET /api/servicecatalog/full` | `clinical.surgery_type` via **Master Data → Service Catalog → Sync to Master Data** |
| IOL options | `GET …/variants/{id}/iol` | `clinical.iol_catalog` via Sync |
| Investigations / imaging | `GET /api/servicecatalog/full` (`DIAGNOSTICS`, `INVESTIGATIONS`) | None |

## Counsellor: Catalog vs Master (B1.5)

| Data | Source | Admin UI |
|------|--------|----------|
| Procedures, IOL, investigations, prices | **Service Catalog** | Master Data → Service Catalog |
| Package templates (bundles), session type, comm channel, reminders | **`counsellor.*` + templates API** | Master Data → Counsellor |
| Payment / coverage | **`patient.patient_type`** + `billing.payment_mode` | Patient Setup / Billing |

## Planned (Program B)

Remaining `clinical.*` (OT/IP enums), `billing.bill_item_type`, insurance TPA/govt_scheme, pharmacy/lab/ward/HR — see `integration-manifest.ts` (**29 wired**).

## Deprecated

| Path | Replacement |
|------|-------------|
| `master-data.api` `getSurgeryTypes` | `useCounsellorProcedureVariants` |
| `master-data.api` `getAnesthesiaTypes` | `useAnesthesiaTypeMaster` / `clinical.anesthesia_type` |
| `/Counseling/master-catalog` | **410 Gone** — use `GET /api/servicecatalog/full` (B2/F0.5) |

## Deprecated (counsellor packages)

| Entity | Status |
|--------|--------|
| `counsellor.surgery_package` | **deprecated** — label-only legacy; use `counselling_package_templates` |

## Related docs

- [counselling-data-flow.md](./counselling-data-flow.md) — counselling desk load/save flow
- [counselling-field-matrix.md](./counselling-field-matrix.md) — estimate blob fields
- [counselling-admin-guide.md](./counselling-admin-guide.md) — package builder
- [counselling-counsellor-guide.md](./counselling-counsellor-guide.md) — custom vs package, PDF
- [TESTING-anterior-posterior-megatab.md](./TESTING-anterior-posterior-megatab.md) — AS/PS parity CI
- [optometry-segment-keys.md](./optometry-segment-keys.md) — visit segment keys

## CI commands

```bash
cd apps/hospital-portal-web
npm run test:unit:optometry   # segment builders + AS/PS parity + master integration
npm run test:parity:as-ps     # field manifest ≡ DEFAULT_* shells
npm run test:parity:master    # wired entities referenced in src
npm run test:parity:hardcoded-options  # B9 gate for new hardcoded option arrays
```
