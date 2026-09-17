# Charge Reconciliation permission split (`bill.reconciliation.view`)

**Phase:** 2Z-RBAC  
**Status:** Implemented (awaiting manual Amelia UAT)

## Rationale

Charge Reconciliation previously authorized on broad `bill.view`. Counsellor was
intentionally granted `bill.view` (migration 156) for cost counselling / bill
read, which incorrectly opened the CR operational board.

## Permission meanings

| Code | Meaning |
|---|---|
| `bill.view` | General billing **read** (bill lines, OPD desk helpers, completeness feed) |
| `bill.reconciliation.view` | Charge Reconciliation **operational** reports (GET/run/wastage) |

## Authorization matrix (this phase)

| Endpoint | Permission |
|---|---|
| `GET /api/ChargeReconciliation` | `bill.reconciliation.view` |
| `POST /api/ChargeReconciliation/run` | `bill.reconciliation.view` |
| `GET /api/ChargeReconciliation/wastage` | `bill.reconciliation.view` |
| `GET /api/ChargeReconciliation/completeness` | **`bill.view`** (unchanged — OPD billing desk) |

Frontend: sidebar + `ProtectedRoute` + `canViewChargeReconciliation` use
`bill.reconciliation.view`. Deep links keep working for authorized roles;
unauthorized users (e.g. Counsellor) are sent to Access Denied.

## Role grants

**Granted:** ADMIN, FINANCE, CASHIER, BILLING CLERK, TPA EXECUTIVE  

**Not granted:** COUNSELLOR (retains `bill.view`)

## Migration / seed

- `consolidated/migrations/192_bill_reconciliation_view_rbac.sql`
- Startup: `PermissionSeeder.SeedBillReconciliationViewPermissionsAsync`

Users must **re-login** after apply to refresh JWT claims.
