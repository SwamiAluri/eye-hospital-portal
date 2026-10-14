# Slice 3B — CCMS / Insurance Document Readiness Audit (post–Slice 3A)

Date: 2026-10-07  
Status: **PRODUCT DECISIONS APPROVED — IMPLEMENTATION IN PROGRESS / COMPLETE FOR AUTOMATED GATE**  
Prerequisite: Slice 3A canonical identity foundation (ACCEPTED)  
Principle: **Document sharing ≠ workflow requirement satisfaction**

Slice 3B product decisions D1–D9 were approved. This document remains the readiness record; implementation follows the approved Slice 3B prompt.

## 1. Verdict

| Area | Status |
|---|---|
| Architecture direction | **CONFIRMED** — canonical registry + associations; CCMS remains SoT |
| `ResolveOrCreateExternalAsync` | **CONTRACT READY** — no-copy identity; **not wired** to CCMS |
| CCMS adapter | **NOT BUILT** |
| Patient 360 Insurance tab | **SOURCE GAP** |
| Patient 360 All / CCMS | Metadata only; no authenticated content actions |
| Auto-satisfy Insurance from Counselling | **MUST NOT** — gate uses case `ccms_documents` only |

## 2. Post-3A identity contract

**Ready:** `ResolveOrCreateExternalAsync`, `EnsureAssociationAsync`, uniqueness by tenant+patient+hash, constants `ccms` / `CcmsDocument`.

**Gaps:** no CCMS caller; no hash on `CcmsDocument`; auth vs ccms DB bridge absent; MPI OpenContent refuses `ccms-documents` (correct — use CCMS `/content`); pointers not streamable.

## 3. Live CCMS

CoverageCase chain; container `ccms-documents`; replace = new Id; by-patient + `/content` with `ccms.document.read`; upload/delete ForbidUnless still missing (document only). Checklist: `PreAuthDocumentGate` requires matching `DocumentType` on case documents.

## 4. Patient 360

All lists CCMS as "CCMS Documents". Insurance filter honesty gap. No P360→Insurance upload. Canonical All dedupe covers General↔Counselling only today.

## 5. Taxonomy

CCMS `policy_document` ≠ Counselling `PolicyDocument` — no certified auto-map.

## 6. Sharing ≠ requirement satisfaction

Visibility of a shared Policy Document must not mark Insurance slot satisfied unless an explicit CCMS association + gate recognition is product-approved (default: not in 3B).

## 7. Product decisions (block implementation prompt)

1. Insurance tab: which CCMS types/categories?
2. Register on upload only vs historical ensure?
3. How to obtain hash for historical CCMS blobs?
4. Same bytes as Counselling: reuse identity + ccms association without checklist auto-fill?
5. Wire P360 Preview/Download/Print to CCMS `/content`?
6. Harden upload/delete authz in 3B or defer?
7. Exclude pointer docs from file actions?
8. Cross-service path: CCMS→Auth vs Auth←CCMS?

## 8. Proposed bounded 3B (NOT approved)

In: external resolve + association on CCMS file upload; optional historical ensure; Insurance filter subset; All dedupe; content via CCMS permissions.  
Out: auto-satisfy checklist; P360 Insurance upload; blob copy; Lab/Imaging/IP; legacy insurance_documents; silent RBAC redesign.

## 9. Gate

```text
AUDIT: COMPLETE
PRODUCT DECISIONS: APPROVED (D1–D9)
BOUNDED 3B SCOPE: APPROVED
IMPLEMENTATION: AUTOMATED GATE — see Slice 3B final report
MANUAL UAT: REQUIRED
ACCEPTANCE: NOT CLAIMED
```

---

## Appendix A — Identity-contract deep dive (post–3A agent audit)

Evidence corroborates the main audit. Material additions:

1. **Azure blob MD5 ≠ canonical SHA-256** — cannot derive identity hash from blob properties alone; historical ensure requires streaming bytes (or hash-at-upload).
2. **Hash hit reuses existing canonical regardless of container** — if bytes already live under `patient-documents`, external resolve returns that row and does **not** rewrite storage to `ccms-documents` (CCMS blob remains operational SoT; canonical pointer may stay MPI container). Product must accept that dual-location reality.
3. **CCMS soft-delete / replace-on-upload** does not call `RemoveAssociationAsync` today — 3B must define association lifecycle or risk orphan associations / stale Patient 360 index.
4. **Pointer docs** (`pacs://`, `biometry://`) unfit for `ResolveOrCreateExternalAsync` without a separate identity rule.
5. **STOP:** cross-service writes without an explicit Auth API/ownership contract; trusting MD5 as content hash; associating with null hash (unique index excludes nulls → duplicate actives possible).

Source: identity readiness subagent findings aligned with live `CanonicalDocumentIdentityService` / `DocumentEngineService`.

---

## Appendix B — CCMS / Patient 360 deep dive (post–3A agent audit)

Corroborates §§3–8. Material additions for product review:

### Live surfaces
- Upload: `POST /ccms/coverage-cases/{id}/documents` (multipart preferred); soft-replace prior same type+category; no hard blob GC.
- By-patient: metadata only (tests forbid `blobUrl` in body).
- Content: `GET /ccms/documents/{id}/content?coverageCaseId=` — ops FE uses it; Patient 360 does **not**.
- Authz: `ccms.document.read` enforced on list/content; upload/PACS/biometry/delete still JWT-only (codes exist in FE/migrations, not ForbidUnless on write).

### Patient 360
- All: CCMS rows labeled `CCMS Documents`, preview metadata-only, no download/print/content.
- Insurance filter: hard honesty gap (`insuranceDocumentsUnavailableMessage`); area non-writable.
- No case-picker upload-to-Insurance from 360.

### Taxonomy (three+ vocabularies)
| Store | Shape | Example |
|---|---|---|
| CCMS slots | snake_case | `policy_document`, `insurance_card_front` |
| Counselling | PascalCase | `PolicyDocument`, `InsuranceCard` |
| 360 Insurance UI (future) | `insurance_*` | `insurance_policy` — not CCMS keys |

No certified cross-map. Counselling rejects CCMS keys (e.g. `insurance_card_front`).

### Checklist
- Satisfied only by case `CcmsDocument` rows matching required `DocumentType` (`PreAuthDocumentGate` / `mergeSlotsWithDocuments`).
- FE completeness (`isCompleteStoredCaseDocument`) can diverge from BE type-only gate — product decision whether gate should require complete file docs.
- Canonical association alone never inserts `ccms_documents` and never fills slots.

### Bounded adapter MUST / MUST NOT (proposal only)
**MUST:** keep CCMS SoT + `ccms-documents`; `ResolveOrCreateExternalAsync` pointer only; `domain=ccms` / `entityType=CcmsDocument`; existing CoverageCase required; share ≠ satisfaction; preserve pointer non-streamability.
**MUST NOT:** blob copy; fabricate cases; type-alias slot fill without explicit map + CCMS write; second insurance store; silently close write-authz gap.

### Decision map (D1–D9) aligned to §7
| Id | Decision |
|---|---|
| D1 | Enforce upload/delete permissions in 3B? |
| D2 | Insurance tab: show CCMS metadata / stay unavailable / other? |
| D3 | Wire P360 Preview/Download/Print via `/content` + `ccms.document.read`? |
| D4 | P360 Upload-to-Insurance (case picker → CCMS)? |
| D5 | Certified type map or explicit refusal of auto-map? |
| D6 | Share counselling PolicyDocument → re-upload / associate-only / forbidden? (default: not auto-satisfy) |
| D7 | Align preauth BE gate with completeness validator? |
| D8 | Soft-replace blob retention / GC? |
| D9 | Adapter timing: upload-time vs first-read vs async? (+ hash strategy per Appendix A) |

Source: [CCMS/P360 readiness audit](97f2736c-0c20-433c-a790-b87d56dbfcb9).
