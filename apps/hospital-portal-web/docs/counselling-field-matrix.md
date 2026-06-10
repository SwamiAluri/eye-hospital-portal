# Counselling session — save/load field matrix (Phase 0)

## Estimate fields (`package_addons_json` blob)

| Field | Load | Save | Notes |
|-------|------|------|-------|
| `estimateMode` | ✅ | ✅ | `custom` \| `package` |
| `packageTemplateId` | ✅ | ✅ | UUID when package mode |
| `discountType` | ✅ | ✅ | `percent` \| `flat` \| null |
| `discountValue` | ✅ | ✅ | User-entered value |
| `discountReason` | ✅ | ✅ | Required when discount applied |
| `discountAmount` | ✅ | ✅ | Computed capped amount |
| `itemizedSubtotal` | ✅ | ✅ | Audit / PDF |
| `bundleSavings` | ✅ | ✅ | Package mode only |
| `finalPayableAmount` | ✅ | ✅ | **Primary amount** for coverage/CCMS |

## Legacy package fields (still persisted)

| Field | Load | Save | Notes |
|-------|------|------|-------|
| `packageName` | ✅ | ✅ | Template name or custom label |
| `packageRate` / `rate` | ✅ | ✅ | Template amount; fallback if no final payable |
| `selectedSurgeryId` | ✅ | ✅ | Composite surgery key |
| `variantId` | ✅ | ✅ | Service catalog variant UUID |
| `eye` | ✅ | ✅ | RE / LE / BE |
| `variantSubOption` | ✅ | ✅ | Session column + blob |

## Workflow fields

| Field | Auth blob | Azure | History audit |
|-------|-----------|-------|---------------|
| `paymentType` | ✅ | ✅ | ✅ |
| `insuranceCompany` | ✅ | ✅ | ✅ |
| `decision` | ✅ | ✅ | ✅ |
| `schedule` | ✅ | ✅ | ✅ |
| `counsellorNotes` | ✅ | — | ✅ |
| `investigations[]` | separate API | — | — |
| Price overrides | Azure API | ✅ | `PriceOverride` entries |

## Downstream consumers

| Consumer | Amount field |
|----------|--------------|
| Coverage / pre-auth | `sessionFinalPayable` → `estimatedAmount` |
| `build-preauth-prefill` | `draft.finalPayableAmount` preferred |
| OT schedule upsert | `packageRate` (legacy column) |
| PDF estimate | `finalPayableAmount` from hook |

## Legacy sessions

Sessions with `packageName` but no `packageTemplateId` load in **custom** mode with saved procedure/investigations; counsellor can pick a template manually.
