# Phase 3 — Legacy Insurance Dependency Map

Complete inventory before further deletions. Produced for `03-phase-3-legacy-retirement-and-financial-state-consolidation.md` §1.

| Surface | Callers | UI entry points | Backend dependencies | Database dependencies | Production usage assumptions | Migration requirement | Removal risk |
|---|---|---|---|---|---|---|---|
| `InsuranceController` | `insurance.api.ts`, counsellor legacy flows | None primary (sidebar → CCMS) | `IInsuranceWorkflowService` | `insurance_pre_authorizations`, docs, TPA logs | Historical GET; writes frozen unless `X-CCMS-Bypass` (all creates including empty SessionId) | Link via `LegacyPreauthId` | **High** — retain GETs |
| `InsuranceWorkflowService` | `InsuranceController` only | n/a | `AppDbContext`, workflow orchestration | Same as above | Internal bridge / compatibility | No new cases; link only | **High** until retention ends |
| `InsurancePreauthController` | `use-insurance-preauth` (frozen writes) | None active production screen found | EF `InsurancePreauthRequests` | `insurance_preauth_requests` | Historical GET by session/schedule | Link via `SessionPreauthId` | **High** |
| `insurance.api.ts` | Exported from `lib/api`; write callers should be gone | None | Auth `/insurance/*` | n/a | Reads OK; writes throw `CCMS_LEGACY_WRITE_FROZEN` | n/a | **Low** to delete after zero imports |
| `insurance_pre_authorizations` | Auth Module 3.6 | Legacy APIs only | InsuranceWorkflowService | Auth DB table | Production historical pre-auths may exist | Map → CCMS case/auth; preserve id | **Critical** — do not drop |
| `InsurancePreAuthWidget` | Widget gallery only (`galleryOnly`) | Widget gallery | `widgetsApi` mock/local | none canonical | Demo only; submit blocked Phase 3 | Do not migrate mock state | **Low** after gallery decommission |
| `InsuranceClaimTrackingWidget` | Gallery only | Widget gallery | `widgetsApi.getInsuranceClaimStatus` | none canonical | Demo / possibly mock API | Do not migrate | **Low** |
| `GovernmentSchemeAuthorizationWidget` | Gallery only | Widget gallery | Session config | none canonical | Demo; submit blocked Phase 3 | Do not migrate | **Low** |
| `/dashboard/insurance` | Bookmarks | Redirect page + Next permanent redirect | n/a | n/a | None | n/a | **None** (redirected) |
| `/dashboard/finance?tab=insurance` | Bookmarks / old links | Finance page `useEffect` replace | n/a | n/a | None | n/a | **None** |
| `/dashboard/finance/insurance/*` | Bookmarks | Catch-all redirect page | n/a | n/a | None | n/a | **None** |
| Module 3.6 insurance | Auth controllers + frozen FE | Should be CCMS | Auth insurance APIs | `insurance_pre_authorizations` | Reads for history | Bridge SQL Phase 3 | **High** |
| Module 3 financial clearance | `FinancialClearance.tsx` (orphan), SurgeryBooking payment gate | Counsellor Module 3 if mounted | Packages / payments APIs | counsellor packages/payments | **Patient payment** only — not coverage SoT | Retitle done; no insurance migrate | **Medium** — payment UX still needed |
| Finance mock claims | Removed from Finance page | Was Insurance Claims tab | none | none | Was mock — never SoT | **Do not migrate** | **Done** |
| Sidebar Finance → Insurance | Was insurance nav | Now `/dashboard/ccms/cases` | CCMS | CCMS cases | Production CCMS | n/a | **Done** |

## Cleanup order (traceable)

1. Disable writes — Auth + FE (done; Create hole closed Phase 3 cross-check)
2. Redirect UI — done
3. Remove dead API consumers — Finance mock removed; hooks frozen; gallery submit blocked
4. Remove obsolete backend write paths — only via bypass (retained for emergency)
5. Remove unused FE components — deferred (gallery/docs); quarantined submit
6. Obsolete config — widget `galleryOnly`/`deprecated`
7. Dead DB — **not yet** (retention)

## Related classification

See `ip-financial-field-classification.ts` / `IpFinancialFieldClassification.cs`.
