# IP × CCMS Phase 5 — Staging smoke & ops apply log



Date: 2026-08-22  

Environment: Azure Postgres `hospitalportal` + local CCMS `:7075` / Auth `:5073` / IP `:5074`



---



## Ops apply



| Step | Result |

|---|---|

| Outbox migration `ip_integration_outbox_phase2.sql` | **Applied** — `integration_outbox_event` created |

| Enhancements `113_ccms_enhancements.sql` | **Present** (idempotent) |

| Bridge preview `apply_phase3_legacy_insurance_bridge(NULL, true)` | **17 orphan_report** (no link_* pending) |

| Bridge APPLY `…(NULL, false)` | **Applied** after PK fix (`id` row PK + `batch_id` group) — 17 orphans logged |

| Permission seed (PascalCase Auth schema) | Codes already existed |

| Assign `ccms.*` + `ip.emergency_fc.apply` | **306 links** → Admin, IT_ADMIN, HEALTHCARE_ADMINISTRATOR (3 roles) |



Artifacts added:

- `database_migrations/permissions/seed_ccms_phase2_permission_aliases_pascal.sql`

- `database_migrations/permissions/assign_ccms_and_emergency_fc_to_admin_roles.sql`

- Bridge batch PK repair in `ccms_legacy_insurance_bridge_phase3.sql`

- `scripts/staging-smoke-phase5.ps1`



---



## Staging smoke



| Check | Result | Evidence |

|---|---|---|

| Cash admit when CCMS down | **PASS** | `CcmsAdmissionClientUnavailableTests` (HTTP 500 / throw → cash ALLOW, coverage BLOCK) |

| Insurance pending → block | **PASS (live)** | `validate-admission` session `…000007` → `WAITING_APPROVAL` / `BLOCK` |

| Insurance approved → admit | **PASS (live)** | unique session on `CCMS-2627-000111` → `APPROVED` / `ALLOW` |

| Partial approval | **PASS (live)** | session `…000006` → `PARTIAL_APPROVAL` / `WARN`+allow |

| Replay same outbox event | **PASS (live)** | `POST journey-admitted` twice, same `X-Idempotency-Key` → **200 / 200** |

| Enhancement draft→submit→decide | **PASS (automated)** | 16× `EnhancementServiceTests` (HTTP needs JWT; route returns 401 without token) |



### Fixes found during smoke

1. CCMS `JwtService` internal key read — also accept `AuthService:InternalApiKey` (colon form).

2. Integration lifecycle JSON deserialize — use case-insensitive options.

3. Bridge batch table — `batch_id` must not be the row primary key.



### Residual

- Admin JWT already has `*` wildcard — re-login not required for admin smoke.
- Enhancement HTTP create/submit/decide — **PASS** via `scripts/p0-jwt-ui-smoke.ps1`.
- 17 orphan legacy preauths need review / migrate_128 if product requires cases.
- Restart IP service if it was started before outbox table existed.
- IP Emergency FC returns HTTP 200 + error JSON for missing journeys (pre-existing).

---

## P0 follow-up (2026-08-22)

| Item | Result |
|---|---|
| Shared idempotency table `ccms_integration_idempotency` | **Applied** |
| DB-backed multi-instance guard | `DbIntegrationIdempotencyGuard` + resilient fallback |
| Live replay stores key in Postgres | **PASS** (200/200 + row present) |
| JWT enhancement draft→submit→decide | **PASS** |
| JWT Emergency FC authz | **PASS** (handler reached) |

---

## How to re-run

```powershell
powershell -File scripts/staging-smoke-phase5.ps1
powershell -File scripts/p0-jwt-ui-smoke.ps1
```


