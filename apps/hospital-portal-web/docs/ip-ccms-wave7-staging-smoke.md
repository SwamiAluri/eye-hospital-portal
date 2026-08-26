# Wave 7 — Staging smoke (G3)

Live API runner (Auth + IP + CCMS):

```bash
cd apps/hospital-portal-web
npm run smoke:wave7
```

Needs Auth `:5073`, IP `:5074`, CCMS `:7075`. Web `:3000` is required for UI checks (`npm run test:e2e:wave7-g3-ui`).

Last live API run: **24/24**. Cash path used **UAT-IP-001** (admit → transfer → notes → planning → LAMA) after `_seed_w7_cash_expected_recycle.sql` (clears `is_locked` / `is_discharged` / discharge metadata). Occupied `W7-SMOKE-1` was not released. Re-apply `_seed_w7_smoke_available_beds.sql` after LAMA so `W7-SMOKE-3`/`W7-SMOKE-4` are Available again.

Live UI: admit panel `blockReason` on `UAT-IP-091`, counselling CCMS strip + case link, operational analytics KPIs. The operational page no longer dies when optional dashboard charts 404; CCMS now serves `/ccms/dashboard/state-distribution` and `/ccms/dashboard/cash-flow`.

IP→CCMS `validate-admission` is live after registering `AddHttpClient<ICcmsAdmissionClient, CcmsAdmissionClient>` (typed client BaseAddress). Seed `_seed_w7_ccms_admission_gates.sql` links `UAT-IP-091` → `WAITING_APPROVAL` and `UAT-IP-096` → `APPROVED`.

Routine `simulate/discharge` from **Admitted** is illegal (clinical graph is ReadyForDischarge → Discharged). G3 bed vacate from ward uses typed **LAMA** (`simulate/lama`).

## Admission / coverage
- [x] Cash admit while CCMS is down (must not block) — live `simulate/admit` with `ccms_unavailable`
- [x] Insurance `WAITING_APPROVAL` BLOCK + `blockReason` (API + admit panel UI, `UAT-IP-091`)
- [x] Approved insurance admit ALLOW (API, `UAT-IP-096` / `CCMS-W7-SMOKE-APPROVED`)
- [x] Emergency FC projects WARN with FC flag (API, existing UAT Emergency FC journey). Full apply+audit was seeded earlier (`ApplyEmergencyFcIntegrationTests`)
- [x] Duplicate `X-Idempotency-Key` on JourneyAdmitted / BillFinalized is a no-op — live smoke POSTs twice with the same key (throwaway journey GUID)
- [x] Counselling coverage payment type shows CCMS ALLOW/WARN/BLOCK strip + case link — live Playwright `e2e/ip-ccms-wave7-g3-ui.spec.ts`

## Beds / stay
- [x] Admit with `assignedBedId` sets Auth bed to Occupied
- [x] Ward transfer: previous bed Cleaning, new bed Occupied
- [x] Clinical discharge: assigned bed Cleaning (LAMA from Admitted)
- [x] Daily progress note saves and lists
- [x] Discharge planning flag persists
- [x] Day Care Ward bed list includes `W7-SMOKE-*` after 167 (no free-text `Wave7` unmatched rows)
- [x] Day Care has Available `W7-SMOKE-3` / `W7-SMOKE-4` after `_seed_w7_smoke_available_beds.sql` (does not release Occupied `W7-SMOKE-1`). IP list returns `bedType` Recliner / DayCareChair after the Functions host rebuild

## Claims / analytics
- [x] After claim submit, raise query → `query_raised` — live against `CCMS-W7-SMOKE-CLAIM` (`_seed_w7_ccms_claim_query.sql`)
- [x] Query response returns case to `response_submitted` — live smoke; seed resets `CLAIM_SUBMITTED` / `query_status=none` for re-runs
- [x] `GET /ccms/analytics/journey-kpis` loads (CCMS-owned, no IP DB join). Dashboard page `/dashboard/ccms/analytics/operational` verified in Playwright (journey KPIs + state/cash-flow charts)

## Wave 0 residuals (closed via G3 runner)
- [x] Partial approval payer vs patient share — `UAT-IP-106` + `_seed_w7_ccms_partial_approval.sql`
- [x] Outbox pending age / failed after forced CCMS 500 — `ccms_outbox_fail` + `simulate/outbox-probe` (probe-key scoped)
