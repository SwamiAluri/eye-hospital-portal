# Optometry visit segment keys

Segment data is stored in `optometry_segment_exams` as JSON per `segment_key` (no per-field tables).

## Anterior segment tab (single save)

| `segment_key`       | Description                          |
|---------------------|--------------------------------------|
| `pupil_exam`        | Pupil examination (required on save) |
| `anterior_segment`  | External, cornea, iris, lens         |

## Posterior segment tab (single save)

| `segment_key`            | Description                                      |
|--------------------------|--------------------------------------------------|
| `posterior_segment`      | Dilatation, media clarity, overall finding       |
| `fundus_exam`            | Disc, macula, retina, vessels                    |
| `vitreous_exam`          | Vitreous findings (separate from fundus retina)  |
| `peripheral_retina_exam` | Peripheral retina (separate from fundus field)   |

## Bundled tabs

| `segment_key`              | Description        |
|----------------------------|--------------------|
| `visual_acuity_bundle`     | VA mega-tab        |
| `iop_bundle`               | IOP mega-tab       |
| `medical_history_bundle`   | Medical history    |

## History / prior visit

`OptometryPatientHistoryService` and `mapVisitRecordToPriorSnapshot` expose snake_case and camelCase aliases in `PriorVisitSnapshot.raw` for tab formatters and Last columns.

EF migration `20260604163514_SyncOptometryVisitExamAndExaminationDraftVisitId` (AuthService/Migrations) creates `optometry_visit_exams`, `examination_drafts.visit_id`, and indexes. `vitreous_exam` / `peripheral_retina_exam` remain JSON `segment_key` values (no new tables).

Manual QA: see [TESTING-anterior-posterior-megatab.md](./TESTING-anterior-posterior-megatab.md).

Field parity CI: `npm run test:unit:optometry` (includes `test:parity:as-ps`).  
Master data integration: [master-data-integration-matrix.md](./master-data-integration-matrix.md).
