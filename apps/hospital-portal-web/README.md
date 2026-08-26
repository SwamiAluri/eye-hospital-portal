# Hospital Portal Web

Minimal Next.js app scaffold for the Hospital Portal frontend created inside the monorepo.

This folder contains the frontend React/Next components and a minimal setup. If you need a full `create-next-app` scaffold, run:

```bash
cd apps
npx create-next-app@latest hospital-portal-web --typescript --tailwind --app
```

Then replace or merge the files in `src/` with the components in this folder.

## Permissions

Permission helpers fail closed: a JWT with an empty `permission` claim grants nothing. No IP
mutation button renders, and the IP billing dashboard falls back to the narrowest `ward` scope.

If you are working locally against a token minted before the IP and billing permission codes were
seeded (`consolidated/migrations/156_ip_billing_rbac_seed.sql`), the fix is to log in again so the
claim is reissued. Failing that, set:

```bash
NEXT_PUBLIC_PERMISSIONS_FAIL_OPEN=true
```

This restores the old permissive behaviour for the empty-claim case only, logs a loud warning, and
is ignored entirely when `NODE_ENV=production`, so it cannot ship enabled. It never grants the
privileged actions — refund, financial adjustment, discharge override and emergency financial
clearance still require their explicit permission code.
