# Enterprise LMS Order State Machine (L-ORD-01B)

**Product decisions:** PD-ORD-10, PD-ORD-11, PD-ORD-12

## Order lifecycle

```text
Draft ──submit──► Submitted ──cancel──► Cancelled
  │                    │
  └──cancel────────────┘
```

| State | Editable | Transitions |
|---|---|---|
| `Draft` | Yes (draft APIs) | → `Submitted` (submit), → `Cancelled` (cancel) |
| `Submitted` | No silent edit | → new submitted version via **amend**, → `Cancelled` |
| `Cancelled` | No | Terminal — no reactivate / no amend |

### Rules

- Client cannot set arbitrary status.
- No `Submitted` → `Draft`.
- No `Amended` status — amendment creates a new **version** while status remains `Submitted`.
- Cancel requires reason + expected RowVersion + audit; does not delete.

## OrderTest lifecycle (this slice)

| State | Meaning |
|---|---|
| `Ordered` | Created at submit/amend for each test/referral work item (and panel components) |

Later slices own Collected / Received / InProgress / Verified / Authorized / OnHold.

## Version chain

```text
Order
  ├── Version 1 (Draft content → Submitted snapshot)
  └── Version 2 (Amend — new Submitted snapshot; Version 1 preserved)
```

Each submitted version pins catalogue versions and identity snapshots.
