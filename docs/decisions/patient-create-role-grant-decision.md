# Phase 3O — Patient Create Role-Grant Decision

Recorded 2026-10-01. Source: Phase 3N canonical Add Patient acceptance and the Phase 3O patient-create authorization audit.

This file records the product and security decision only. No permission rows, role rows, seeders, UI, or API behavior are changed by this record.

---

## 1. Approved permission

| | |
|---|---|
| Permission | `patient.create` |
| Status | **APPROVED** |
| Catalog | Unchanged. Module `patient`, action `create`, resource `patient`, scope `branch`. |
| API | `POST /api/patients` remains the only application identity writer. |
| UI | `/dashboard/patients/new` remains the canonical Add Patient experience. |

No new permission is created. No role-specific patient-create permission is created.

## 2. Approved role grants

Stored `role_permission` grants for the existing `patient.create` permission are approved for these live named roles only:

| Role | Why |
|---|---|
| ADMIN | Ordinary admin authorization must be an explicit stored grant, not the demo JWT `*`. |
| COUNSELLOR | Waiting-list registration creates a patient identity before scheduling. The existing grant stays. |
| RECEPTIONIST | Front Office is a registration entry and must be able to register an unknown patient. |
| MEDICAL RECORDS OFFICER | Identity and registration administration matches this named role. |
| NURSE | Appointment booking already exposes Register New Patient, and this role has appointment access. |
| IP COORDINATOR | Appointment booking already exposes Register New Patient, and this role has appointment access. |

`patient.create` authorizes patient identity creation only. It does not grant patient view, update, or export, and it does not grant appointments, check-in, walk-in booking, counselling sessions, waiting-list assignment, counsellor ownership, billing, insurance, clinical documentation, surgery, admission, pharmacy, or portal registration.

## 3. Excluded role categories

`patient.create` is not granted to:

- Clinical providers: `DOCTOR`, `CONSULTANT`, `SENIOR DOCTOR`, `JUNIOR DOCTOR`, `SURGEON`, `ANAESTHETIST`
- Pharmacy: `PHARMACIST`, `PHARMACY MANAGER`, `PHARMACY TECHNICIAN`
- Billing and finance: `BILLING CLERK`, `CASHIER`, `FINANCE`
- Insurance: `TPA EXECUTIVE`
- Diagnostics: `RADIOLOGIST`, `RADIOLOGY TECHNICIAN`, `LAB MANAGER`, `LAB TECHNICIAN`
- OT and IP operations outside the approved list: `OT COORDINATOR`
- Optical, inventory, facilities, security, purchase, and technical roles, including `OPTICAL MANAGER`, inventory roles, `HOUSEKEEPING SUPERVISOR`, `MAINTENANCE TECHNICIAN`, `SECURITY OFFICER`, purchase roles, and `IT ADMINISTRATOR`
- Portal and self-service roles
- Unnamed `RoleCode`-only roles, including rows such as `OPHTHALMOLOGIST`, `OPTOMETRIST`, `PARAMEDIC`, and `EMT`
- Any other operational role not named in section 2

The live role spelling is `COUNSELLOR`. This decision does not create or rename a `COUNSELOR` role.

## 4. Preserved security boundaries

Unchanged by this decision:

- Authentication and `[RequirePermission("patient.create")]` on `POST /api/patients`
- `PatientService.CreatePatientAsync` as the identity writer
- Tenant taken from the JWT
- Branch authorization through `FollowupBranchAccessService`, including the single-branch fallback, the multi-branch selection requirement, and rejection of an unauthorized branch
- The existing catalog definition of `patient.create`
- Demo JWT `*` login behavior. A stored `ADMIN` grant does not replace or remove that demo path.

## 5. Separate future decisions

These are not decided here:

- Whether Add Patient visibility must match the approved grants
- The missing Directory 0.80 duplicate warning
- Whether unnamed `RoleCode` roles should ever receive `patient.create`
- Seeder acceptance of both `COUNSELLOR` and `COUNSELOR` spellings
- The wizard showing a 403 as “Unknown error”

## Implementation status

NO APPLICATION CODE CHANGED.  
NO PERMISSION ROWS CHANGED.  
NO ROLE ROWS CHANGED.  
NO DATABASE CHANGED.  
NO SEEDER CHANGED.

| | |
|---|---|
| Decision status | **APPROVED** |
| Implementation authorization | **NOT GRANTED** |
| Next gate | **PERMISSION IMPLEMENTATION** |
