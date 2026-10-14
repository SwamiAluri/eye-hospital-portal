# Enterprise LMS Order Domain Architecture (L-ORD-01B)

**Status:** Implemented (domain/API foundation)  
**Service:** LaboratoryApi (`/api/lms/*`)  
**Product decisions:** [enterprise-lms-order-product-decision-closure.md](./enterprise-lms-order-product-decision-closure.md)

## Ownership

```text
Hospital Portal Web (/dashboard/lms/orders — shell only in this slice)
        ↓
LaboratoryApi
        ↓
LMS Order Domain (lms_orders, lms_order_versions, lms_order_selections, lms_order_tests, …)
        │
        ├── AuthService internal LMS reference adapters (Patient / Visit / User)
        ├── LMS Catalogue (same LaboratoryApi — orderables resolution)
        ├── Platform audit_log (PlatformAuditClient → InternalAudit)
        └── Billing / CCMS — reference fields only (no charge posting)
```

## Tables (LaboratoryApi-owned)

| Table | Purpose |
|---|---|
| `lms_orders` | Stable order identity, status, order number, RowVersion |
| `lms_order_versions` | Version-chain clinical snapshots |
| `lms_order_selections` | User-selected catalogue identities per version |
| `lms_order_tests` | Ordered work items (initial status `Ordered`) |
| `lms_order_number_sequences` | Tenant-daily sequence for `LAB-YYYYMMDD-NNNNNN` |
| `lms_order_idempotency` | Tenant-scoped idempotency records |

## Catalogue resolution

`GET /api/lms/catalogue/orderables` (permission `lms.orders.create`) returns only:

Active + effective + branch-applicable + `Orderable=true` + non-deleted parent.

Submit pins exact `CatalogueVersionId` on selections and tests. Never re-resolves submitted orders to “latest”.

## Platform adapters

| Concern | Endpoint |
|---|---|
| Patient | `POST /api/internal/lms/validate-patient` |
| Visit | `POST /api/internal/lms/validate-visit` |
| User | `POST /api/internal/lms/validate-user` (active + tenant; **no** Doctor string heuristic) |

Auth: `X-Internal-Key` + matching `X-Tenant-ID`.

## Consent

Order stores optional `ConsentReference`, `ConsentTemplateVersionRef`, and `AcknowledgementEvidence` (required for `SelfRequested`). No LMS consent master. Dual platform consent stacks are not duplicated; adapter is reference/evidence capture only.

## Performing site

`PerformingBranchId` equals `OperatingBranchId` in this slice (PD-ORD-04).

## Optimistic concurrency

Mutating APIs require `ExpectedRowVersion`. `lms_orders.row_version` is an EF concurrency token so `SaveChanges` issues:

`UPDATE lms_orders SET …, row_version = @new WHERE id = @id AND tenant_id is enforced in load AND row_version = @original`

Affected-row / concurrency failure → HTTP 409 `concurrency_conflict`. Two concurrent mutations with the same expected version cannot both commit.

## Order number allocation

`LAB-YYYYMMDD-NNNNNN` from `lms_order_number_sequences` (unique `(tenant_id, sequence_date)`).

- PostgreSQL: atomic upsert `INSERT … ON CONFLICT DO UPDATE SET last_value = last_value + 1 RETURNING last_value`
- Client cannot supply the final order number
- Orders also unique on `(tenant_id, order_number)`

## Idempotency

`lms_order_idempotency` unique on `(tenant_id, idempotency_key)`. Claim-first insert under that unique constraint, then complete with response JSON after a successful audited mutation. Same key + same hash → replay; same key + different hash → 409; different tenants are independent.

## Audit fail-closed

Platform audit write is required for CREATE_DRAFT, UPDATE_DRAFT, SUBMIT_ORDER, AMEND_ORDER, CANCEL_ORDER. On audit failure the operational mutation is compensated (including amend orphan versions/selections/tests) so no partial durable mutation remains.

## Out of scope (this slice)

Collection, specimens, testing, results, reporting, referral ops, billing execution, work queue, AOE, favourites/pathways, complete Orders UI, Pathology changes.
