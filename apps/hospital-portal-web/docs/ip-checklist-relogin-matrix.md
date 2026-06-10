# IP Checklist RBAC — Re-login Matrix

After applying migrations **139**, **140**, or **141**, users must **log out and log back in** so JWTs pick up new `permission` claims.

| Role | Permissions granted | Can access |
|------|---------------------|------------|
| Admin | All checklist permissions | Ward, OT, PAC, monitoring, counsellor P0, overrides |
| Nurse | `ward.checklist.edit`, `ip_management.view` | Ward page, journey detail, pre-op/post-op saves |
| OT Nurse | `ot.safety.sign`, `ip_management.view` (+ ward if also Nurse) | Operation Theatre, accept/start surgery |
| Counsellor | `counsellor.outpatient_checklist.edit` | Outpatient P0 checklist on counselling session |
| Anaesthetist / Doctor | `anaesthesia.pac.edit`, `anaesthesia.monitoring.edit`, OT sign | PAC, Form 5 monitoring, OT safety |
| Read-only supervisor | `ip_management.view` only | IP dashboard, journey timeline (no edits) |

## Apply script (broken lowercase schema)

```bash
psql $DATABASE_URL -f consolidated/migrations/141_rbac_repair.sql
```

Then restart `auth-service` and ask affected users to re-login.

## Verify permissions in browser

DevTools → Application → Local Storage → `permissions` JSON array should include codes above for the logged-in role.
