# Implementation status (honest snapshot)

Last updated: 2026-06-08. Canonical registry: `src/lib/master-data/integration-manifest.ts`.

## Overall completion

| Program / track | Code / automation | Sign-off / QA | Notes |
|-----------------|-------------------|---------------|-------|
| **Foundation F0** | **~100%** | N/A | Manifest, CI parity gates, Used-by badge, hardcoded-options gate |
| **Foundation F1** | **~95%** | M1–M3 informal | Full catalog admin + IOL + branch pricing |
| **Foundation F2** | **~90%** | — | Save toasts, `usePaymentModes`, `MasterValuesSelect` on filter/CCMS/counsellor widgets |
| **Program A (AS/PS)** | **~100%** | **~95%** | **9/9 Playwright** + A2.4 persist on live API |
| **Program B** | **~97%** of registry | — | **78 wired** / 83 entries; hardcoded baseline **0** |

## Sprint rollup

| Sprint | Status |
|--------|--------|
| S1 F0 + A1 | Done |
| S2 F1 | Done (exceeded MVP) |
| S3 B1 + B2 | Done |
| S4 A2 + F2 | Done |
| S5–S9 Weeks 1–4 | Done in code |
| S10 Weeks 5+ (B5–B8) | Done in code |
| F2.3 baseline sweep | Done — AppointmentsFilterPanel, VisitPolicyForm, PatientDecisionWidget; analytics periods renamed |

## CI commands

```bash
cd apps/hospital-portal-web
npm run test:unit:optometry          # parity + manifest + hardcoded gate (0 baseline debt)
npm run test:e2e:optometry           # Program A — 9 scenarios on live API
npm run test:e2e:master-data         # used-by + edit→dropdown refresh (B9)
```

## Registry snapshot (manifest statuses)

| Status | Count | Notes |
|--------|-------|-------|
| wired | 78 | Verified by `verify-master-integration.ts` |
| catalog-owned | 4 | Service catalog SKUs |
| hardcoded | 1 | `optometry.exam_enums` (A3a — intentional) |
| planned | 0 | — |

New F2.3 entity types (backend seeds + frontend):

| Entity | Consumer |
|--------|----------|
| `appointment.status` | AppointmentsFilterPanel |
| `counsellor.patient_intention` | PatientDecisionWidget |
| `insurance.accommodation_class` | VisitPolicyForm room class |

## Program A sign-off (2026-06-08)

Live API run against tenant `155fe198-6ae5-4a01-9254-ead5b427247e`:

| Fixture | Value |
|---------|-------|
| Patient | Balamurugan Chettiar (`98f33bd6-1969-4126-b7bf-fd78fe6fa926`) |
| Visit | `56f103c5-890e-4afb-af1e-7917c366d8a8` |
| Playwright | **9/9 passed** (`test:e2e:optometry`, chromium, serial) |

## Still open (optional / ops)

| # | Item | Effort |
|---|------|--------|
| A4 | Manual 10b (red eye → mark normal → edit conjunctiva) | ~0.5 day QA |
| F1.7 | Execute `scripts/import-legacy-lab-catalog.sql` per tenant | Ops |
| Backend | Re-seed existing tenants for new entity types | `npm run seed:f23-master` (SQL) or `-- --api` |
| CI | Flip E2E job from `continue-on-error: true` when stable | Config |
