# Coverage policy card OCR — PHI & retention (ops note)

## Data handled

Policy card uploads (front/back) may contain PHI: insured name, policy number, employer, contact numbers, and sum insured.

## Storage

| Asset | Location | Retention |
|-------|----------|-----------|
| Raw card images (OCR) | CCMS blob container (`policy-extraction` prefix) | Purge after **90 days** (`BlobPurgeAt` on audit row) |
| Intake document slots | Same CCMS document engine as counsellor uploads (`insurance_card_front`, `insurance_card_back`) | Case lifecycle + org retention policy |
| Extraction audit | `ccms_policy_extraction_audit_log` | Long-term (no blob); field overrides JSON only |

## Access

- Counsellor desk: users with counselling + coverage tab access for the patient’s branch.
- CCMS case page: claims / coverage roles per existing CCMS RBAC.
- OpenAI: same API key as inventory GRN; images sent only when `PolicyExtraction:Enabled=true`.

## Audit

Each confirmed OCR writes: `documentUrl`, `providerModel`, `processingMs`, `fieldOverrideCount`, `overriddenFieldsJson`, `createdPolicyId`.

## Disable OCR

Set `PolicyExtraction:Enabled=false` in CCMS `local.settings.json` (or App Settings in Azure). FE hides the scan panel after status probe returns disabled.

## Incident / deletion

- Delete case documents via CCMS document API (soft-delete).
- Blob purge job should honour `BlobPurged` flag on audit rows after `BlobPurgeAt`.
