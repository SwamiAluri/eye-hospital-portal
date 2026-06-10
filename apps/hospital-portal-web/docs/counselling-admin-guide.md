# Admin guide — counselling packages (Phase 15.1)

## Where to manage packages

**Master Data → Counsellor → Counselling Packages** (`/dashboard/master-data/counsellor/packages`)

## Create a package

1. Click **New package**.
2. Set **Code** (e.g. `CAT-ECON`) and **Name**.
3. **Procedure variant** — search service catalog surgery variant.
4. **IOL** — filtered list when variant supports IOL.
5. **Investigations** — multi-select imaging + lab catalog items (quote-only in counselling).
6. **Package amount** — bundled price; preview shows itemized sum vs package (savings).
7. **Max discount %** — optional cap ≤ tenant default (50%).
8. Save — package appears in counsellor **Build estimate → Package** tab.

## Tenant discount settings

On the packages page, open **Settings**:

- **Max discount %** — default 50; applies to all packages unless template cap is lower.
- **Flat cap (₹)** — optional maximum flat discount per estimate.

## Post-migration catalog linking (A4)

Economy seeds (`CAT-ECON`, `CAT-STD`, `RET-ECON`, `GLAU-STD`) are created by migration 65 with empty investigation lists. Link catalog IDs per tenant:

```bash
cd apps/hospital-portal-web
$env:TENANT_ID="<tenant-uuid>"
$env:DATABASE_URL="postgresql://..."
npm run link:counselling-packages
```

Verify in SQL or admin UI: procedure, IOL, and investigation counts &gt; 0.

## Deprecation

`counsellor.surgery_package` master dropdown is **deprecated**. New sessions use `counselling_package_templates` API only.
