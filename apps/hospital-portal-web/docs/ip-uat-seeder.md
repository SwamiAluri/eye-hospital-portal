# UAT IP dataset seeder and realtime simulator

Development-only framework that provisions realistic inpatient journeys through **existing** PatientJourney, Billing (`OpdBill`), Auth bed lifecycle, audit, and outbox paths. It does not introduce a parallel data model.

## Guards

Seeding is rejected unless **all** of:

- Host environment is not Production (`AZURE_FUNCTIONS_ENVIRONMENT` / `ASPNETCORE_ENVIRONMENT`)
- `EnableUatDataSeeder=true` on IP Management (`local.settings.json`) and Auth (bill cleanup)

Hiding the UI is not sufficient. Production returns 403.

## How to invoke

CLI (from `apps/hospital-portal-web`):

```bash
npm run seed:uat
npm run seed:uat:reset
npm run seed:uat:reseed
npm run seed:uat:status
```

HTTP (JWT required):

- `GET  /api/dev/uat/status?branchId=`
- `POST /api/dev/uat/seed?branchId=`
- `POST /api/dev/uat/reset?branchId=`
- `POST /api/dev/uat/reseed?branchId=`
- `POST /api/dev/uat/simulate/{action}?branchId=`
- `POST /api/dev/uat/failures`

UI: **Ward & Inpatient → UAT Data** (`/dashboard/dev/uat`) in Next.js development.

## Identity

Journeys use `Uhid` `UAT-IP-001` … Patients use `health_id` `UAT-HID-001` … and last name `{code} {scenario}`. Reset only touches those prefixes.

## Dataset

30 scenarios × **5 replicas** = **150** journeys (plus a prior discharged journey for each readmission replica). Clinical, billing, coverage, OT, LAMA, cancel, emergency FC, and bed-conflict cases are included.

## Simulator

Actions: `next`, `admit`, `transfer-bed`, `send-to-ot`, `accept-ot`, `start-surgery`, `complete-surgery`, `post-op`, `ready-discharge`, `payment`, `refund`, `emergency-fc`, `discharge`, `lama`, `cancel`, `rebook`, `cancel-discharge`.

Live Demo on the UAT page calls `next` on an interval (Fast / Normal / Slow). It does not start on app boot.

## Failure flags

`POST /dev/uat/failures` with `{ "ccms_unavailable": true, "bed_service_unavailable": true, "billing_unavailable": true, "concurrent_transition": true }`.

## Reset

Soft-deletes UAT journeys and patients, releases Auth beds for those journeys, and soft-deletes linked OpdBills via internal billing (also gated).
