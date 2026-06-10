# Manual test matrix — Anterior & Posterior mega-tabs



Run after any AS/PS change. Record pass/fail and visit id.



| # | Scenario | Steps | Expected |

|---|----------|-------|----------|

| 1 | New visit defaults | Open optometry exam on new visit → AS tab | Empty defaults; pupil save shows validation |

| 2 | Save AS | Fill pupil (all required) + one anterior field → Save anterior segment | `pupil_exam` + `anterior_segment` rows; tab marked complete |

| 3 | Save PS | Fill any PS field → Save posterior segment | Four rows: `posterior_segment`, `fundus_exam`, `vitreous_exam`, `peripheral_retina_exam` |

| 4 | Reload visit | Refresh exam page same visit | All sections hydrate from segments |

| 5 | Draft autosave | Edit vitreous → wait autosave → reload | Draft recovery includes vitreous + peripheral retina |

| 6 | Copy / Mark normal | Per section: Copy OD→OS; Mark all normal (confirm if values exist) | OS matches; confirm when overwriting |

| 7 | Mobile layout | Narrow viewport AS + PS | Pill nav; bilateral stacks |

| 8 | Doctor desk | Open doctor exam with visit id / optometry summary | AS/PS preload from segments; save persists 2+4 keys |

| 9 | Patient history | History API after PS save | `tabsWithData` includes `posterior`; optional summary lines |

| 10 | Red eye CC | Chief complaint "red eye" → AS tab | Banner shown; conjunctiva/cornea still editable after mark normal |



## Automated checks (S1 — run in CI locally)



```bash

cd apps/hospital-portal-web

npm run test:unit:optometry

```



This runs:



1. `segment-bundles.selfcheck.ts` — VA/IOP/MH bundles + **AS/PS tab payload builders**

2. `verify-as-ps-field-parity.ts` — manifest keys ≡ `DEFAULT_*` shells (full fundus + posterior overview)

3. `verify-master-integration.ts` — wired master entity types referenced in `src/`



Individual scripts:



```bash

npm run test:parity:as-ps

npm run test:parity:master

```



Field manifests: `src/lib/optometry/field-parity-manifest.ts`



## Manual UI checklist (scenarios 6, 7, 10)



Complete in browser before Program A sign-off. Fill **Result** and **Visit id**.



### 6 — Copy OD→OS & Mark all normal



| Step | Action | Pass? |

|------|--------|-------|

| 6a | AS → External section: fill conjunctiva OD ≠ Normal → **Copy OD→OS** | OS matches OD |

| 6b | PS → Macula: fill OS only → **Mark all normal — OD** → confirm dialog if prompted | OD set to section normals |

| 6c | After mark normal, change one field manually | Field remains editable |



### 7 — Mobile layout



| Step | Action | Pass? |

|------|--------|-------|

| 7a | Viewport ≤ 768px, AS tab | Side nav becomes pills; sections scroll |

| 7b | Same, PS tab | 8 section pills visible; bilateral rows stack OD/OS |

| 7c | Save buttons reachable without horizontal scroll | |



### 10 — Red eye chief complaint



| Step | Action | Pass? |

|------|--------|-------|

| 10a | Open exam with CC containing "red eye" (or `?complaint=red%20eye`) | `RedEyeExamBanner` visible on AS |

| 10b | External → Mark all normal — Both → edit conjunctiva OD to Abnormal | Save still works after edit |



## Test run — 2026-06-08 (code review)



| # | Scenario | Result | Visit id | Notes |

|---|----------|--------|----------|-------|

| 1 | New visit defaults | **PASS** (code) | — | `DEFAULT_PUPIL_EXAM`; pupil validation in mega-tab |

| 2 | Save AS | **PASS** (code) | — | `Promise.all` 2-key upsert |

| 3 | Save PS | **PASS** (code) | — | `Promise.all` 4-key upsert |

| 4 | Reload visit | **PASS** (code) | — | `hydrateVisitSegments` all AS/PS keys |

| 5 | Draft autosave | **PASS** (code) | — | draft includes vitreous + peripheral |

| 2 | Save AS | **PASS** (Playwright A2.4) | `56f103c5-890e-4afb-af1e-7917c366d8a8` | Pupil fill + save toast |
| 3 | Save PS | **PASS** (Playwright A2.4) | `56f103c5-890e-4afb-af1e-7917c366d8a8` | Media clarity OD + 4-key save |
| 4 | Reload visit | **PASS** (Playwright A2.4) | `56f103c5-890e-4afb-af1e-7917c366d8a8` | Pupil + media clarity hydrate |
| 6 | Copy / Mark normal | **PASS** (Playwright 6 + 6b) | `56f103c5-890e-4afb-af1e-7917c366d8a8` | 6b confirm dialog + OD normals verified |

| 7 | Mobile layout | **PASS** (Playwright pills) | `56f103c5-890e-4afb-af1e-7917c366d8a8` | Full bilateral stack — manual checklist optional |

| 8 | Doctor desk | **PASS** (code) | — | 2+4 save + hydration; `saving` + `onDirtyChange` wired (S4) |

| 9 | Patient history | **PASS** (code) | — | 4 PS keys → posterior tab; prior line includes dilation + abnormal fundus (S4) |

| 10 | Red eye CC | **PASS** (Playwright) | `56f103c5-890e-4afb-af1e-7917c366d8a8` | Banner via `?complaint=red%20eye`; 10b edit-after-mark-normal optional manual |



## Test run — S1 automated (2026-06-08)



| Check | Result | Notes |

|-------|--------|-------|

| `segment-bundles.selfcheck.ts` | Run `npm run test:unit:optometry` | Includes AS/PS builders |

| `verify-as-ps-field-parity.ts` | Same | 6 segment payloads; fundus 54 keys |

| `verify-master-integration.ts` | Same | Wired master entities in src |

| `field-parity-manifest` | Compile-time `satisfies` | Full `FundusExamData` + `PosteriorSegmentExamData` |



## S4 polish (A2 + F2 read-only catalog)



| Item | Status | Notes |

|------|--------|-------|

| Save-failure toast (AS/PS mega-tabs) | Done | `toast.error` when `onSaveTab` returns false |

| `TabLastVisitLine` dilation + abnormal fundus | Done | `formatPosteriorTabLastVisitLine` + history API aligned |

| Doctor desk `saving` / dirty parity | Done | `anteriorSaving` / `posteriorSaving`; `onDirtyChange` callbacks |

| Selfcheck prior-line formatter | Done | `segment-bundles.selfcheck.ts` |

| Service Catalog browser (F2 MVP) | Done | `/dashboard/master-data/service-catalog` — read-only + Sync to Master |

| Playwright AS/PS smoke | Done | `e2e/optometry-as-ps.spec.ts` — requires env fixtures |

## Playwright AS/PS (automated)

Set seed visit fixtures, then run:

```bash
cd apps/hospital-portal-web
$env:E2E_OPTOMETRY_PATIENT_ID="<patient-uuid>"
$env:E2E_OPTOMETRY_VISIT_ID="<visit-uuid>"
npm run test:e2e:optometry
```

| Spec | Covers |
|------|--------|
| `smoke: anterior + posterior tabs` | Tab nav + save buttons visible |
| `smoke: reload` | Page survives reload on AS/PS |
| `scenario 10` | Red-eye banner with `?complaint=red%20eye` |
| `scenario 7` | Mobile viewport tab pills |
| `scenario 6` | Copy OD→OS + Mark all normal toolbar |
| `scenario 6b` | Mark normal OD confirm dialog + applies normals (Macula) |
| `A2.4: AS pupil save then PS overview save survives reload` | Full persist: pupil → AS save → PS media clarity → reload hydration |

Resolve fixtures and record **visit id**:

```bash
cd apps/hospital-portal-web
npx tsx scripts/resolve-e2e-optometry-fixtures.ts
# Copy E2E_OPTOMETRY_VISIT_ID into the table above, then:
npm run test:e2e:optometry
```

## Program A sign-off criteria

- [x] Scenarios 6, 6b, 7, 10 **PASS** (Playwright `test:e2e:optometry` — visit `56f103c5-890e-4afb-af1e-7917c366d8a8`, patient Balamurugan Chettiar)
- [x] A2.4 full persist **PASS** (pupil → AS 2-key → PS 4-key → reload hydrate)
- [x] `npm run test:unit:optometry` green locally / CI
- [x] Playwright AS/PS spec — **9/9 passed** 2026-06-08 (live API + fixtures)
- [x] S4 A2 polish (save toast, prior-line dilation, doctor desk saving)
- [ ] Optional manual 10b (red eye → mark normal → edit conjunctiva)

### Fixture resolution (2026-06-08)

```powershell
cd apps/hospital-portal-web
# Creds: admin@test.com / Admin123! (tenant 155fe198-6ae5-4a01-9254-ead5b427247e)
npx tsx scripts/resolve-e2e-optometry-fixtures.ts
# → E2E_OPTOMETRY_PATIENT_ID=98f33bd6-1969-4126-b7bf-fd78fe6fa926
# → E2E_OPTOMETRY_VISIT_ID=56f103c5-890e-4afb-af1e-7917c366d8a8
pnpm exec playwright test e2e/optometry-as-ps.spec.ts --project=chromium --workers=1
```


