# Counselling redesign — rollout & sign-off (Phase 15.3–15.5)

## Telugu T&C

Bilingual terms live in `counselling-estimate-pdf-content.ts` (`COUNSELLING_ESTIMATE_TERMS`).  
**Clinical/legal review:** pending formal sign-off document; copy is fixed in code for PDF rendering (Noto Sans Telugu).

## Letterhead asset (A5)

| Asset | Path | Role |
|-------|------|------|
| **Primary (canonical)** | `public/brand/hospital-letterhead.svg` | Default in PDF/print |
| Optional PNG | `public/brand/hospital-letterhead.png` | Override if present |
| Fallback | `public/auth/ophthalmocare-logo.svg` | If both above fail |

Replace SVG/PNG with hospital-branded assets before production rollout.

## Feature flag

No counselling-specific feature flag is required — redesign replaces the counselling tab in place. Use tenant package admin to control bundle availability (`is_active` on templates).

## QA sign-off checklist

- [ ] Custom path: procedure → investigations → discount → save → PDF totals match screen
- [ ] Package path: select → auto-fill → override inv → save → restore on reload
- [ ] Quoted price override appears in history
- [ ] Doctor conflict banner when procedure ≠ recommendation
- [ ] Done / read-only / repeat counselling states
- [ ] Tablet 768px: bottom sheet estimate, no horizontal scroll pain
- [ ] Coverage tab `estimatedAmount` = final payable
- [ ] `npm run test:unit:counselling` green
- [ ] `npm run test:e2e:counselling` green (with `E2E_COUNSELLING_SESSION_ID`)
- [ ] AuthService package template tests green

## CI commands

```bash
cd apps/hospital-portal-web
npm run test:unit:counselling
npm run resolve:e2e:counselling   # optional fixture
npm run test:e2e:counselling
```

```bash
dotnet test AuthService.Tests --filter CounsellingPackageTemplate
```
