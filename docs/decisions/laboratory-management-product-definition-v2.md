# Laboratory Management — Product Definition V2 / Architecture Decision Gate

**Date:** 2026-10-07  
**Type:** PRODUCT / DOMAIN / ARCHITECTURE DECISION GATE  
**Status:** COMPLETE — AWAITING PRODUCT OWNER REVIEW  
**Kind:** Recommendations and decision register only — **NOT IMPLEMENTED**

**Authoritative priors (do not silently reopen):**
- [diagnostics-laboratory-product-definition.md](./diagnostics-laboratory-product-definition.md) — **PRODUCT OWNER RATIFICATION COMPLETE** for D-LAB-* / Slice 4 preserve / counsellor separation
- [laboratory-management-deep-domain-audit.md](./laboratory-management-deep-domain-audit.md) — deep domain audit
- [slice-4-laboratory-document-implementation.md](./slice-4-laboratory-document-implementation.md) — **CERTIFIED EXISTING** document behavior
- [slice-4-laboratory-uat-blocker-addendum.md](./slice-4-laboratory-uat-blocker-addendum.md)
- [diagnostics-laboratory-complete-gap-analysis.md](./diagnostics-laboratory-complete-gap-analysis.md)

```text
PRODUCT DEFINITION V2: COMPLETE
IMPLEMENTATION: NOT STARTED
CODE CHANGES: NONE
DATABASE CHANGES: NONE
PRODUCT DECISIONS: REQUIRED
MANUAL UAT: PAUSED
NEXT GATE: PRODUCT OWNER REVIEW
```

---

## 1. Executive Summary

Laboratory Management must become a real hospital laboratory operating system — internal and send-out — under the ratified root **`LabReport`**, with Patient 360 remaining a projection and Slice 4 remaining the document architecture.

Current L1 is a **thin prototype** (worklist + free-text Order New Test). It is **not accepted** and **not production-ready**. Product direction must define the **target operating model first**, not incrementally polish the free-text form.

| Position | Status |
|---|---|
| Lab Management = ops workbench; LabReport = SoT; P360 = projection | **RATIFIED / PRESERVE** (D-LAB-01) |
| Do not revive `lab_order` / `lab_order_item` / `lab.api.ts` | **RATIFIED / PRESERVE** (D-LAB-02 / D-DATA-02) |
| Counsellor pre-op lab separate until bridge | **RATIFIED / PRESERVE** (D-LAB-14) |
| Slice 4 attach ≠ complete; one active canonical attachment | **RATIFIED / PRESERVE** + **CERTIFIED EXISTING** |
| `completed` = final released result; no ordinary post-complete edit | **RATIFIED / PRESERVE** (D-LAB-03) |
| Verification required in target workflow; role mapping not approved | **RATIFIED** requirement / **PRODUCT OWNER DECISION REQUIRED** for impl mapping |
| Clinical catalog SoT for pathology LIS | **PRODUCT OWNER DECISION REQUIRED** (PD-LAB-CAT-01) — **RECOMMENDED: Option C hybrid** |
| Specimen / Observation children / PerformingLaboratory | **RECOMMENDED** for first production-ready Lab; prior L1/L2 specimen optional remains **RATIFIED** for those slices until owner elevates scope |
| FHIR/HL7/analyzer/advanced QC | **FUTURE** unless explicitly brought into a bounded slice |

**Catalog recommendation (not approved):**  
**Option C — Hybrid** — Service Catalog `ServiceVariant` remains commercial/billable investigation identity; a dedicated Laboratory clinical definition owns panels, analytes, specimen requirements, ranges, methods, LOINC maps, and performing-lab clinical metadata. Do **not** treat `LabTestCatalog` alone as pathology SoT.

---

## 2. Current State

| Layer | Reality | Classification |
|---|---|---|
| `/dashboard/laboratory` | L1 workbench: list/filter + Order New Test create | **YELLOW** — prototype, not LIS |
| `LabReport` / `lab_reports` | Flat order + result + status | **GREEN** root — clinically thin |
| Slice 4 documents | Canonical attach/content; P360 Documents | **GREEN** — **CERTIFIED EXISTING** |
| `LabTestCatalog` | Counsellor/PreOp price-ish catalog | **YELLOW** — not LIS dictionary |
| Service Catalog V2 | Commercial category→service→variant + prices | **GREEN** commercial / **YELLOW** for clinical LIS |
| Counsellor lab orders | `counselor_lab_order_items` | **GREEN** counsellor / **YELLOW** bridge |
| Orphan SQL `lab_order*` / FE `lab.api.ts` | No EF / no BE for Laboratory | **RED** |
| Specimen / Observation entities | Absent | **NEW** (if approved) |
| External / performing lab entity | `LabName` string only | **NEW** (if approved) |
| GET worklist contract | FE GET vs committed AuthService POST-only collection | Stabilization item — see §2.1 |

### 2.1 L1 Runtime Stabilization — Deferred Implementation Item

| Item | Detail |
|---|---|
| Symptom | UI “Unable to load laboratory orders”; browser `GET /api/lab-reports` → **HTTP 405** |
| Root cause | Collection route on **committed** AuthService registers **POST** Create only; FE L1 calls **GET** list → ASP.NET method mismatch. Authorization is **not** the cause. |
| Working-tree note | Uncommitted `[HttpGet] List` observed; process/rebuild drift can change runtime without committing HEAD. |
| Distortion rule | This defect **must not** reshape product architecture. |
| Disposition | **Deferred implementation item only** — fix FE/BE GET list contract + runtime discipline in **L1-Stabilize** after owner gate. |
| This task | **NOT IMPLEMENTED** — do not fix 405 here. |

---

## 3. Product Vision

**Laboratory Management** is the staff-facing operational system for ordering, collecting/receiving specimens (when in scope), performing or sending out tests, capturing structured results, verifying/releasing, attaching report documents, and notifying stakeholders — for both **internal hospital laboratory** and **external/send-out laboratories**.

Quality bar (UX): modern healthcare-grade, clean, task-focused, accessible, responsive, operationally useful, minimal unnecessary copy, consistent with existing Hospital Portal design system and Counsellor-quality staff UI patterns. Desktop-first workstations.

Honesty bar: no fake clinical data; no mock workstations; frontend never authoritative for clinical/financial/state transitions.

---

## 4. Product Boundaries

### In scope (target product)

- Laboratory / Pathology operational lifecycle under `LabReport`
- Clinical test definition (pending catalog decision)
- Internal and external performing laboratory
- Specimen pre-analytical (bounded by phase)
- Structured observations/results
- Verification / release (per ratified D-LAB-03/04 once mapping approved)
- Slice 4 documents (preserve)
- Patient 360 projection (not ops)
- Platform communications **requests** (not Lab-owned channels)
- Future interoperability readiness (local-first)

### Out of scope (unless later approved)

- Blood Bank as Laboratory submodule
- Pharmacy, Billing ownership of clinical results
- Counsellor desk redesign
- Automatic Counsellor→LabReport fabrication
- Analyzer / barcode / PACS / full QC suite (**FUTURE**)
- FHIR/HL7 implementation (**FUTURE** until L-Interop)
- Inventing branch semantics on LabReport (**RATIFIED** defer D-SPEC-01)
- Silently inventing new `lab.*` permission codes (**RATIFIED** D-LAB-09 for L0–L2; FUTURE least-privilege remains owner-gated)

---

## 5. Authoritative Existing Decisions

Treat as **RATIFIED / PRESERVE** unless repository evidence proves internal contradiction (none found that forces reopen):

| ID / Topic | Position |
|---|---|
| D-LAB-01 | Laboratory Management = authoritative ops workbench; LabReport = SoT; P360 = projection |
| D-LAB-02 / D-DATA-02 / D-LAB-13 | Do **not** revive `lab_order`, `lab_order_item`, `lab_panel` SQL SoT, or `lab.api.ts` |
| D-LAB-03 | `completed` = final released clinical result; ordinary edit after completion **not allowed**; amendment = **FUTURE** |
| D-LAB-04 | Verification is a **target** requirement before final release; exact role/capability mapping **not approved** for implementation |
| D-LAB-05…08 | Slice 4 attach rules; one active attachment; no replacement/versioning in prior slices |
| D-LAB-09 / D-LAB-10 | No new lab workflow codes silently; continue `patient.view` / `patient.update` for API; nav `laboratory.view` |
| D-LAB-11 | API status vocabulary authoritative (`ordered`, `sample_collected`, `in_progress`, `completed`, `cancelled`, `on_hold`) |
| D-LAB-14 | Counsellor / Pre-Op laboratory remains separate SoT; no auto LabReport |
| D-SPEC-01 | Do not invent LabReport branch semantics |
| D-DATA-01 | No fake clinical seeds |
| Specimen (prior ratification) | Specimen step **optional** for L1/L2; **no** barcode/accessioning/analyzer in those slices |
| Critical escalation | **FUTURE DECISION** |
| Analyzer, accessioning, PACS, FHIR/HL7, advanced QC | **FUTURE** unless explicitly approved into a bounded slice |
| Slice 4 certified behaviors | Canonical identity, SHA-256, association, idempotency, 409 conflict, authenticated content, P360 Documents actions, no generic Laboratory upload |

**V2 does not reopen these.** Where V2 **RECOMMENDS** elevating scope (e.g. specimen for first production-ready Lab), that elevation is **PRODUCT OWNER DECISION REQUIRED** and does not silently override prior slice bounds.

---

## 6. Current Laboratory Architecture

### 6.1 Inventory classification

| Asset | Class | Notes |
|---|---|---|
| `LabReport` / `lab_reports` / `LabReportsController` / `labReportsApi` | **GREEN** | Authoritative root |
| L1 `LaboratoryWorkbench` / `LaboratoryOrderDialog` | **YELLOW** | Prototype UX |
| Slice 4 `LabReportCanonicalDocumentService` | **GREEN** | Document SoT path |
| P360 Clinical / Documents lab surfaces | **GREEN** | Projection |
| `GET /users/doctors/search` + `searchDoctors` / `useDoctorSearch` | **YELLOW** | Reusable; Lab UI uses free-text today |
| Organization / Branch / `STD_LABORATORY` Department | **YELLOW** | Internal facility; not external lab registry |
| Inventory Vendor | **RED** | Supply categories — unfit as clinical lab |
| Service Catalog V2 | **GREEN** commercial | **YELLOW** as sole clinical LIS dictionary |
| `LabTestCatalog` | **YELLOW** | Counsellor/PreOp; seed candidate only |
| `counselor_lab_order_items` | **YELLOW** bridge | Counsellor-owned |
| `IAuditService` / NotificationService dispatch / NotificationHub | **GREEN** platform | Lab must request, not own |
| Front-desk `QueueItem` | **RED** for Lab | No Lab queue type |
| Observation / Specimen / PerformingLaboratory entities | **NEW** | Absent |
| Orphan `lab.api.ts` / SQL `lab_order*` | **RED** | Do not use |

### 6.2 LabReport API consumers (evidence)

Workbench list/create; Patient 360 Clinical map; Documents attach/content; `LabReportsTab`; Timeline; LabResultsWidget; AlertBanner; honesty/workbench tests.

### 6.3 Status vocabulary (preserve)

LabReport snake_case statuses (**RATIFIED** D-LAB-11). Do not silently unify with Imaging (`Pending`/`In-Progress`) or counsellor investigation strings.

---

## 7. Target Laboratory Operating Model

```text
CATALOG (clinical definition + optional commercial link)
    → ORDER (LabReport root; clinician; priority; indication; routing)
        → PRE-ANALYTICAL (specimen collect / receive / accept|reject)  [phase-gated]
        → ANALYTICAL (internal process OR external send-out)
        → STRUCTURED RESULTS (observations under LabReport)
        → TECHNICAL VALIDATION / VERIFICATION  [mapping OWNER]
        → RELEASE (status → completed)
        → DOCUMENT (Slice 4 canonical PDF/report)
        → COMMUNICATION (platform dispatch / hub)  [policy OWNER]
        → P360 PROJECTION (read-only clinical + documents)
```

Internal and external paths share the same `LabReport` root; routing differs by performing laboratory and referral state — **NOT IMPLEMENTED**.

---

## 8. Test Catalog Strategy

### 8.1 Candidate comparison matrix

| Dimension | A. `LabTestCatalog` | B. Service Catalog V2 | C. Counsellor paths | D. Billing/Insurance | E. Ward FE catalog | F. Orphan `lab.api.ts` |
|---|---|---|---|---|---|---|
| Owner | Counsellor / PreOp | Billing / Master Data | Counsellor Desk + PreOp | Billing charges; CCMS docs | Ward UI meta | None |
| Table | `lab_test_catalog` | `service_categories` → `catalog_services` → `service_variants` + `variant_prices` | Orders + checklist items | `ServiceVariantId` on charges | Const only | None |
| Lab L1 uses? | No | No | No | No | No | Banned |
| Pricing SoT | Inline `Price` | **Canonical** variant_prices | Snapshot | Yes | No | Types |
| Clinical LIS fields | Thin | Commercial only | Thin | No | FE hardcoded | Aspirational |
| Panel / analyte | No | No | No | No | No | Types only |
| LOINC / SNOMED | No | No | No | No | No | No |
| Performing / routing | No | No | No | No | No | No |

**Evidence highlights:**
- Counsellor desk investigations: live via `GET /api/servicecatalog/full` → FE `investigation-catalog.ts`; `GET /api/Counseling/master-catalog` = **410**.
- PreOp still reads EF `LabTestCatalog` via `PreOpTestManagement/lab-catalog`.
- Billing binds `ServiceVariantId`; insurance payer tariffs on `variant_prices`.
- Legacy import SQL intends commercial seed toward investigations — schema drift vs live V2 tables; treat as intent, not runnable clinical completeness.
- Laboratory L1 orders free-text — **no** catalog SoT today.

### 8.2 Options

| Option | Description | Verdict |
|---|---|---|
| **A** | Extend Service Catalog alone as Laboratory SoT | Insufficient alone — commercial tree lacks panels/analytes/ranges/method/LOINC/routing; overloads Billing ownership |
| **B** | Dedicated Laboratory Test Definition only | Correct clinically, but re-fragments billing/counsellor SKU identity |
| **C** | Hybrid: shared commercial identity + Laboratory clinical definition | **RECOMMENDED** |

### 8.3 Recommended direction (not approved)

**RECOMMENDED — Option C (Hybrid):**

1. **ServiceVariant** (Service Catalog) = commercial / billable / counsellor-orderable SKU identity when chargeable.  
2. **LaboratoryTestDefinition** (name TBD; Laboratory-owned) = clinical dictionary: display name, local code, discipline, specimen requirements, method, TAT, units, reference ranges, panel membership, analytes, active lifecycle, optional LOINC/SNOMED maps, performing defaults.  
3. Optional `ServiceVariantId` (or equivalent) link when the test is chargeable.  
4. Seed names from Service Catalog / legacy `lab_test_catalog` — **do not** make `LabTestCatalog` the long-term pathology SoT.  
5. **Do not** wire orphan `lab.api.ts`.

**PRODUCT OWNER DECISION REQUIRED:** PD-LAB-CAT-01 (choose A / B / C).

---

## 9. Test / Panel / Analyte Model

### 9.1 Target support (product)

| Concept | First production-ready Lab? | Notes |
|---|---|---|
| Individual test | **RECOMMENDED required** | Minimum orderable unit |
| Test panel | **PRODUCT OWNER DECISION REQUIRED** (PD-LAB-CAT-02) | **RECOMMENDED** include if CBC-style panels are in live scope |
| Analyte / component | **RECOMMENDED required** if panels or multi-value tests are in scope | Else single-analyte may use flat LabReport fields temporarily |
| Quantitative / qualitative / coded / textual | **RECOMMENDED required** | Discriminated observation values |
| Microbiology / pathology narrative | **FUTURE** or phase-late | May use narrative observation + PDF initially |
| Derived/calculated | **FUTURE** | |

### 9.2 Relation to LabReport (**RATIFIED** root)

Do **not** recreate SQL `lab_order` / `lab_order_item`.

**RECOMMENDED ownership under LabReport:**

| Concept | Ownership |
|---|---|
| Order header | `LabReport` (extend) |
| Orderable selection | FK to LaboratoryTestDefinition / panel; denormalize display name/code on LabReport |
| Multi-test panel expansion | Optional **LabReportItem** children of LabReport (**NEW** name — avoid `lab_order_item`) — **PRODUCT OWNER DECISION REQUIRED** if panels approved |
| Results | Observation children of LabReport (see §12) |

---

## 10. LabReport Evolution

| Aspect | Direction |
|---|---|
| Root | **PRESERVE** `LabReport` |
| Flat result fields | **PRESERVE** for backward compatibility / simple single-analyte summary |
| New children | Specimen, Observation, Referral, Verification events — **NEW** when phases approved |
| Ordering clinician | Bind `OrderedById` to doctor search user; keep `OrderedByName` as denormalized display |
| Visit | Optional `VisitId` — **PRODUCT OWNER DECISION REQUIRED** whether mandatory when encounter exists |
| Performing lab | Replace sole reliance on `LabName` string with typed performing laboratory reference (**NEW**) + display denorm |
| Status machine | Enforce transitions server-side when L-Release approved; vocabulary **PRESERVE** (D-LAB-11) |
| Post-complete | Enforce D-LAB-03 (**NOT IMPLEMENTED** in controller today — implementation deferred to approved phase) |

---

## 11. Specimen / Pre-Analytical Model

### 11.1 Target lifecycle

```text
Order → preparation → collection → labeling → transport
  → received → acceptance | rejection → processing → result
```

### 11.2 Prior ratification vs V2 recommendation

| Topic | Status |
|---|---|
| Specimen optional for L1/L2; no barcode/accession/analyzer | **RATIFIED / PRESERVE** for those slice bounds |
| Elevate bounded specimen into first production-ready Laboratory | **RECOMMENDED** — **PRODUCT OWNER DECISION REQUIRED** (PD-LAB-SPEC-01) |

### 11.3 Capability matrix

| Capability | First production-ready (if elevated) | Future |
|---|---|---|
| Specimen type | **RECOMMENDED** | |
| Collector + collection timestamp | **RECOMMENDED** | |
| Received timestamp | **RECOMMENDED** | |
| Acceptance / rejection + reason | **RECOMMENDED** | |
| Accession identifier | **RECOMMENDED** (manual/system string) | Hardware barcode |
| Collection method / site | **RECOMMENDED** if clinically needed | |
| Multiple specimens per order | **PRODUCT OWNER DECISION REQUIRED** | |
| Specimen-to-test link | **RECOMMENDED** when multi-test | |
| Labeling printers / analyzers | | **FUTURE** |
| Transport logistics | | **FUTURE** |

**RECOMMENDED:** Specimen as child entity of `LabReport` (or 1:N when multi-specimen approved). **NOT IMPLEMENTED.**

---

## 12. Result / Observation Model

### 12.1 Current flat fields (**PRESERVE**)

`ResultValue`, `ResultUnit`, `ReferenceRange`, `Interpretation`, `TechnicianName`, `VerifiedByName`, `CompletedAt`.

### 12.2 Target

| Need | Direction |
|---|---|
| Analyte identity | Observation child → LaboratoryAnalyte / definition component |
| Value + type | Numeric / text / coded / qualitative discriminator |
| Unit, reference range, abnormal/critical flags | Structured on Observation |
| Interpretation / comments | Observation + optional LabReport summary |
| Result status | Draft / preliminary / final (align with release model) — **PRODUCT OWNER DECISION REQUIRED** for vocabulary beyond LabReport status |
| Performer + timestamp | User id + time (**RECOMMENDED**) |
| Panel results | Multiple Observations |
| Flat LabReport fields | Denormalized summary for P360 cards / single-analyte |

**RECOMMENDED:** Observation-like children required for production multi-analyte LIS (PD-LAB-OBS-01). **NOT IMPLEMENTED.**

---

## 13. Verification / Release Model

**RATIFIED:** `completed` = final released clinical result; ordinary edit forbidden; verification is a **target** requirement; role mapping not approved.

### Conceptual lifecycle

```text
Result entry (draft)
  → technical validation
  → clinical review / verification   [OWNER mapping]
  → release → Status = completed
  → amendment/correction             [FUTURE]
  → critical communication           [FUTURE DECISION]
```

| Step | First production-ready | Future |
|---|---|---|
| Result entry workspace | **RECOMMENDED** | |
| Enforce no ordinary edit after completed | **RECOMMENDED** (implements D-LAB-03) | |
| Verification before release | **RATIFIED** target — **PRODUCT OWNER DECISION REQUIRED** for who/capability (PD-LAB-VER-01) | |
| Status history + audit events | **RECOMMENDED** | |
| Controlled amendment | | **FUTURE** (D-LAB-03) |
| Critical escalation policy | | **FUTURE** (PD-LAB-COM-01) |

Do **not** invent a verifier role without repository capability mapping — mark **PRODUCT OWNER DECISION REQUIRED**.

---

## 14. Internal Laboratory Model

| Concept | Evidence | Direction |
|---|---|---|
| In-house lab | `STD_LABORATORY` department + subs (Pathology, Micro, Biochem, Serology) | **RECOMMENDED** use as internal discipline context |
| Organization / Branch | Tenant campus | Patient/facility context; **not** performing-lab registry alone |
| PerformingLaboratory (internal) | Missing typed entity | **RECOMMENDED NEW** typed performing org, or typed Organization extension — **PRODUCT OWNER DECISION REQUIRED** (PD-LAB-ORG-01) |

---

## 15. External Laboratory Model

Target must support **external / send-out** laboratories.

| Candidate | Fit |
|---|---|
| Inventory Vendor | **RED** — pharmaceutical/optical/supplies categories |
| Organization as-is | **YELLOW** — no lab-network semantics |
| Department | **RED** for external orgs |
| Free-text `LabName` | Insufficient |

**RECOMMENDED:** Introduce a Laboratory-owned **PerformingLaboratory** (or equivalent) with type `Internal | External | Reference | CollectionCenter`, optional link to Organization/Branch when internal. **PRODUCT OWNER DECISION REQUIRED** (PD-LAB-ORG-01): new typed concept vs Organization extension.

Do **not** misuse Vendor.

---

## 16. External Result Workflow

### Product lifecycle

```text
Order → send-out decision → referral → dispatch
  → external accession → expected result
  → result received → reconciliation → review → release
```

### Integration modes

| Mode | First production-ready | Future |
|---|---|---|
| 1. Manual external result + PDF (Slice 4) + structured entry | **RECOMMENDED** | |
| 2. Structured API integration | | **FUTURE** (after channel adapter) |
| 3. HL7 ORM/ORU / FHIR | | **FUTURE** (L-Interop) |
| 4. SFTP / bulk automation | | **FUTURE** |

**RECOMMENDED:** Laboratory owns **referral/reconciliation state** on/under `LabReport`; integrations are **channel adapters** outside Lab domain core. **PRODUCT OWNER DECISION REQUIRED** (PD-LAB-EXT-01) for first-phase external scope.

---

## 17. Communication / Integration Strategy

| Channel | Platform | Lab ownership |
|---|---|---|
| SMS / email / WhatsApp dispatch | NotificationService `POST .../notifications/dispatch` | **Request only** — do not hard-code gateways in Lab |
| Staff realtime | NotificationHub / `useNotifications` | Publish events; do not add second bus |
| Counsellor WhatsApp | Stub / SMS under WhatsApp label | **Do not** treat as Lab channel |
| CCMS inbound email | TPA | Unrelated |
| IP LIS webhook | Ward checklist | Pattern only — not LabReport SoT |

**RECOMMENDED:** Lab emits communication **intents** (e.g. result ready, critical) to platform dispatch + hub. Critical policy = **PRODUCT OWNER DECISION REQUIRED** (PD-LAB-COM-01). **FUTURE** until approved.

---

## 18. Laboratory Workbench UX

Design an operational workspace — **not** a giant CRUD form. Match Hospital Portal + Counsellor-quality density. **NOT IMPLEMENTED** beyond L1 list/create.

### Laboratory Dashboard
Work queue; priority; status; TAT/SLA; specimen state; internal/external; assigned work; exceptions; search/filters; patient identity.

### Order Detail
Patient; order; test/panel; ordering clinician; specimen timeline; performing lab; results; documents; communications; audit.

### Result Workspace
Analytes; units; ranges; flags; comments; validation; verification; release.

### External Lab
Referral; dispatch; external accession; expected vs received; reconciliation; document.

### Order New Test (target, not L1 form polish)
MPI patient search; **doctor search** clinician; catalog test/panel; codes; specimen requirements; priority; reason; internal/external performing lab; collection instructions; expected TAT.

---

## 19. Patient 360 Boundary

| Laboratory Management | Patient 360 |
|---|---|
| Operational workbench | Patient-context projection / discovery |
| Order, specimen, result entry, verify, release, send-out | May show orders, results, report metadata, authorized documents |
| Must **not** become queue / specimen / result / verify / referral workstation | **RATIFIED / PRESERVE** |

Preserve Slice 4 Documents Laboratory behavior. Do not redesign P360 Clinical as ops.

---

## 20. Document Architecture

Treat Slice 4 as **CERTIFIED EXISTING** / **RATIFIED / PRESERVE**:

- Canonical document identity + SHA-256  
- Association `domain=lab`, `entityType=LabReport`  
- One active attachment; same-byte idempotent; different-byte 409  
- Authenticated content access (`patient.view`)  
- Attach ≠ clinical completion  
- P360 Documents Preview / Download / Print  
- No generic Patient 360 Laboratory upload (`writable: false`)  
- No silent replacement/versioning (D-LAB-08)  

Structured results remain clinical data; PDF/external report remains document data. **Do not redesign document storage.** L-Documents phase only if owner requires capability beyond Slice 4.

---

## 21. Interoperability Strategy

**Local-first:** Hospital Portal local IDs remain authoritative. Optional standard mappings added later (**FUTURE** L-Interop).

| FHIR R4 | Internal affinity |
|---|---|
| ServiceRequest | LabReport order header |
| Specimen | Specimen child (**NEW** if approved) |
| Observation | Observation children (**NEW** if approved) |
| DiagnosticReport | LabReport release envelope + canonical document |
| Task | Optional work assignment — **FUTURE** / avoid unless needed |
| CommunicationRequest | Platform communication intents — **FUTURE** |

HL7 v2 ORM/ORU: adapters map into Referral + Observation + provenance — **FUTURE**.

LOINC/SNOMED: mapping tables on clinical definitions — **PRODUCT OWNER DECISION REQUIRED** for timing (PD-LAB-CODE-01); do not block on LOINC for first internal ops if local codes exist.

Avoid models that permanently collapse multi-analyte into one string or omit specimen identity if those phases are approved.

---

## 22. Quality / Safety / Traceability

**Do not claim ISO 15189 / NABL / WHO compliance.** Use as contextual benchmarks only.

| Capability | First production-ready Lab | Future LIS/QMS |
|---|---|---|
| Order traceability | LabReport + audit | |
| Specimen traceability | If specimen elevated | Full chain / barcode |
| Result provenance | Observation performer/time + source | External message ids |
| Verifier identity | User id when PD-LAB-VER-01 approved | Competence matrices |
| Status history | Append-only history **RECOMMENDED** | |
| Audit events | `IAuditService` **RECOMMENDED** | |
| Critical communication | | Policy + delivery ack |
| Amendments | | Controlled versions |
| TAT | Catalog TAT + queue signals **RECOMMENDED** | SLA engines |
| Specimen rejection | If specimen elevated | |
| QC | | Runs / lots / rules |
| Accountability | Bound actors (not free-text) **RECOMMENDED** | |

---

## 23. Authorization

### Current (evidence)

| Surface | Permission |
|---|---|
| Nav / page | `laboratory.view` |
| LabReport read / content | `patient.view` |
| LabReport write / complete / attach | `patient.update` |
| Doctor search | `user.view` |

**RATIFIED** D-LAB-09/10: no new lab-specific codes silently for L0–L2; stop if a slice would expose APIs to roles lacking required permission.

### Target assessment

| Question | Position |
|---|---|
| Sufficient for first production workflow? | **YELLOW** — functionally usable, not least-privilege for Lab Tech vs verifier vs releaser |
| Eventually need lab-specific codes? | **RECOMMENDED yes** (view queue, order, collect, enter results, verify, release, send-out) |
| Invent codes in this gate? | **No** |
| Decision | **PRODUCT OWNER DECISION REQUIRED** (PD-LAB-PERM-01) for timing/catalog |

---

## 24. Counsellor / Pre-Op Boundary

| Topic | Position |
|---|---|
| Counsellor lab structures | Remain Counsellor-owned (**RATIFIED** D-LAB-14) |
| Laboratory Management | Owns LabReport lifecycle |
| Auto-create LabReport from counsellor | **Must NOT happen** without explicit bridge approval |
| Bridge | **FUTURE** / L-Bridge only after design + owner approval (PD-LAB-14) |
| Trigger if ever approved | Explicit event + mapping + permissions + no fabrication of results — design TBD |
| Billing overlap | Counsellor may order billable ServiceVariant; Laboratory clinical performance remains LabReport |

---

## 25. Data / Migration Strategy

**No migration in this gate.**

| Asset | Strategy |
|---|---|
| Existing LabReports | **Preserve** — never delete/recreate clinical history |
| Flat result fields | **Preserve**; populate Observation children via adapter when introduced; keep summary fields |
| Slice 4 documents | **Preserve** |
| New children | Additive under LabReport |
| Coexistence | Readers prefer Observations when present; else flat fields |
| `lab_order` SQL | **Deprecated** — do not revive |
| `LabTestCatalog` | Counsellor path may continue; Laboratory clinical SoT per PD-LAB-CAT-01 |
| Historical free-text orders | Remain valid; catalog FKs optional for legacy rows |

---

## 26. Product Decision Register

Recommendations are **not** approved. Owner must decide.

| ID | Decision | Current Evidence | Recommended Direction | Owner Decision Required? | Why It Blocks | Phase |
|---|---|---|---|---|---|---|
| **PD-LAB-CAT-01** | Laboratory clinical catalog SoT | SC commercial; LabTestCatalog thin; L1 free-text | **Option C hybrid** | **Yes** | Cannot build real Order New Test | Gate 0 → L-Cat |
| **PD-LAB-CAT-02** | Panels + analytes in first production scope? | No panel/analyte SoT | Include panels/analytes if CBC-class tests in live scope | **Yes** | Schema under LabReport | L-Cat |
| **PD-LAB-SPEC-01** | Elevate specimen beyond optional L1/L2? | Columns only; prior ratification optional | Bounded Specimen child for first production-ready Lab | **Yes** | Pre-analytical honesty | L-Specimen |
| **PD-LAB-OBS-01** | Observation children vs flat-only? | Flat ResultValue | Observation children + flat summary | **Yes** | Result workspace | L-Result |
| **PD-LAB-ORG-01** | PerformingLaboratory model | LabName string; Vendor unfit; Org/Dept internal only | **NEW typed PerformingLaboratory** (internal/external), optional Org link | **Yes** | Internal vs send-out | L-Order / L-External |
| **PD-LAB-CLI-01** | Mandate authoritative ordering clinician? | Doctor search exists; L1 free-text | Require `OrderedById` via `GET /users/doctors/search`; name denorm | **Yes** | Attribution / audit | L-Cat |
| **PD-LAB-WF-01** | Exact status transition rules + actors | String status; no machine | Server-enforced matrix from D-LAB-11 + specimen/result gates | **Yes** | Safety | L-Release |
| **PD-LAB-VER-01** | Verification role/capability mapping | VerifiedByName only; D-LAB-04 target | Define who verifies/releases before UI | **Yes** | Blocks verification impl | L-Release |
| **PD-LAB-EXT-01** | First-phase external/send-out scope | No referral entity | Manual referral + PDF + structured entry first | **Yes** | External workflow | L-External |
| **PD-LAB-COM-01** | Critical result communication policy | Interpretation string; FUTURE in V1 | Define triggers/channels/ack via platform dispatch | **Yes** | Patient safety | Post L-Release / FUTURE |
| **PD-LAB-PERM-01** | Timing for lab least-privilege codes | patient.* + laboratory.view | Keep patient.* until owner approves new codes | **Yes** | Authz redesign risk | FUTURE after L-Release or earlier if owner insists |
| **PD-LAB-CODE-01** | LOINC/SNOMED mapping timing | Absent | Local codes first; mapping tables in L-Interop | **Yes** | Interop scope | L-Interop |
| **PD-LAB-14** | Counsellor→Lab bridge timing/design | Separate SoTs; D-LAB-14 | Keep separate; design bridge only when owner requests | **Yes** | Dual queues | L-Bridge |
| **PD-LAB-VISIT-01** | Visit/encounter mandatory on order? | VisitId optional unset | Prefer capture when encounter known; not invent branch | **Yes** | Clinical context | L-Order |
| **PD-LAB-MULTI-01** | Multiple specimens / multi-item orders | One flat row | Decide with CAT-02 / SPEC-01 | **Yes** | Child cardinality | L-Cat / L-Specimen |
| **PD-LAB-IND-01** | Clinical indication required? | Notes only | Structured reason/indication field | **Yes** | Order quality | L-Order |

---

## 27. Phased Roadmap

**Do not implement any phase in this gate.** Lifecycle: Audit → Product Decision → Implementation → Automated Tests → Manual UAT → Acceptance → Next Slice.

### Gate 0 — Product Definition V2 / Owner Ratification
| | |
|---|---|
| Goal | Owner reviews V2; decides PD-* register |
| Prerequisites | Deep audit + this document |
| In scope | Decision only |
| Out of scope | All code |
| Acceptance gate | Written owner positions on blocking PD-* |
| Manual UAT | N/A |

### L1-Stabilize
| | |
|---|---|
| Goal | FE/BE `GET /api/lab-reports` list contract + AuthService runtime discipline; clear 405 class defect |
| Prerequisites | Gate 0 acknowledgment that stabilization may proceed |
| In scope | List endpoint commit/deploy/restart alignment only |
| Out of scope | Catalog, specimen, results, permissions, UI redesign |
| Dependencies | AuthService + lab-reports.api |
| Acceptance | Authenticated GET list returns 200/empty/data; workbench loads without 405 |
| Manual UAT | **Required** for worklist load |

### L-Cat
| | |
|---|---|
| Goal | Clinical test definition + selection + authoritative ordering clinician |
| Prerequisites | PD-LAB-CAT-01/02, PD-LAB-CLI-01 |
| In scope | Catalog SoT per decision; order from catalog; doctor search binding |
| Out of scope | Specimen hardware; verification; FHIR; counsellor bridge |
| Acceptance | No free-text-only primary test identity for new orders (unless owner exception) |
| Manual UAT | **Required** |

### L-Order
| | |
|---|---|
| Goal | Real order/routing + performing laboratory (internal/external flag at minimum) |
| Prerequisites | PD-LAB-ORG-01, PD-LAB-VISIT-01, PD-LAB-IND-01 |
| In scope | Routing fields; performing lab reference; indication |
| Out of scope | Full external dispatch automation |
| Acceptance | Orders show performing lab + routing |
| Manual UAT | **Required** |

### L-Specimen
| | |
|---|---|
| Goal | Collection / receive / accept|reject / accession (manual) |
| Prerequisites | PD-LAB-SPEC-01 elevated |
| In scope | Specimen child + UI timeline |
| Out of scope | Barcode hardware, analyzers |
| Acceptance | Rejection reason + timestamps auditable |
| Manual UAT | **Required** |

### L-Result
| | |
|---|---|
| Goal | Structured observations + result workspace |
| Prerequisites | PD-LAB-OBS-01 |
| In scope | Observation children; workspace; flat field summary sync |
| Out of scope | Micro suite, calculated results unless approved |
| Acceptance | Multi-analyte entry without losing prior flat reads |
| Manual UAT | **Required** |

### L-Release
| | |
|---|---|
| Goal | Validation/verification/release; status history; enforce D-LAB-03 |
| Prerequisites | PD-LAB-WF-01, PD-LAB-VER-01 |
| In scope | Transition enforcement; verifier identity; audit |
| Out of scope | Amendments; critical policy unless PD-LAB-COM-01 approved |
| Acceptance | Completed immutable to ordinary edit; verify gate if mandated |
| Manual UAT | **Required** |

### L-External
| | |
|---|---|
| Goal | Send-out referral + reconciliation (manual-first) |
| Prerequisites | PD-LAB-EXT-01, PD-LAB-ORG-01 |
| In scope | Referral state; external accession; manual result/PDF reconcile |
| Out of scope | HL7/FHIR/SFTP automation |
| Acceptance | External path distinguishable in queue |
| Manual UAT | **Required** |

### L-Documents
| | |
|---|---|
| Goal | Only if capability beyond Slice 4 required |
| Prerequisites | Explicit reopen of D-LAB-08 or new doc need |
| Default | **Skip** — Slice 4 **PRESERVE** |
| Manual UAT | If executed |

### L-Interop
| | |
|---|---|
| Goal | LOINC maps + FHIR/HL7 adapters |
| Prerequisites | PD-LAB-CODE-01; stable Observation/Specimen |
| Out of scope | Claiming compliance |
| Manual UAT | **Required** |

### L-Bridge
| | |
|---|---|
| Goal | Counsellor → Laboratory bridge |
| Prerequisites | PD-LAB-14 explicit design approval |
| Must not | Auto-fabricate LabReports/results without design |
| Manual UAT | **Required** cross-module |

---

## 28. Risks / Open Questions

| Risk | Mitigation |
|---|---|
| Treating L1 free-text form as product end-state | Gate 0 + catalog decision before L-Cat |
| Dual catalog SoT (LabTestCatalog vs Service Catalog vs new definition) | PD-LAB-CAT-01 Option C clarity |
| Overloading Service Catalog with LIS clinical fields | Prefer hybrid clinical definition |
| Misusing Vendor as external lab | PD-LAB-ORG-01 |
| Implementing verification without role mapping | Block on PD-LAB-VER-01 |
| 405 / process drift mistaken for architecture flaw | L1-Stabilize only |
| Counsellor bridge pressure | Hold D-LAB-14 / PD-LAB-14 |
| Silent permission invention | D-LAB-09 + PD-LAB-PERM-01 |
| FHIR-first redesign | Local-first; L-Interop later |

**Open questions** = entire PD-* register in §26.

---

## 29. Final Product Gate

```text
PRODUCT DEFINITION V2: COMPLETE
IMPLEMENTATION: NOT STARTED
CODE CHANGES: NONE
DATABASE CHANGES: NONE
PRODUCT DECISIONS: REQUIRED
MANUAL UAT: PAUSED
NEXT GATE: PRODUCT OWNER REVIEW
```

**STOP.** Do not start L1-Stabilize, L-Cat, L-Specimen, L-Result, L-Release, L-External, L-Interop, or L-Bridge until Product Owner reviews this gate and records decisions.

---

## Appendix A — Documents inspected

- `docs/decisions/diagnostics-laboratory-product-definition.md` (incl. §26 ratification)
- `docs/decisions/laboratory-management-deep-domain-audit.md`
- `docs/decisions/slice-4-laboratory-document-implementation.md`
- `docs/decisions/slice-4-laboratory-uat-blocker-addendum.md`
- `docs/decisions/diagnostics-laboratory-complete-gap-analysis.md`

## Appendix B — Repository areas inspected (read-only)

- `LabReport.cs`, `LabReportsController.cs`, `LabTestCatalog.cs`, `ServiceCatalogV2.cs`
- `UsersController.SearchDoctors`, `master-data.api.ts` `searchDoctors`
- Laboratory FE components + `lab-reports.api.ts` + orphan `lab.api.ts`
- PreOp / counsellor investigation catalog paths; Service Catalog admin/read APIs
- Organization / Branch / Department seeds; inventory Vendor categories
- NotificationService dispatch; NotificationHub; audit service patterns
- Slice 4 canonical lab document service constants

## Appendix C — Actor identity reuse

| Actor | Existing source | Reuse | Gap |
|---|---|---|---|
| Ordering clinician | `GET /users/doctors/search` (`user.view`); AppUser + Doctor role | **RECOMMENDED** bind `OrderedById` | External non-user clinicians **PRODUCT OWNER DECISION REQUIRED** |
| Specimen collector | None on LabReport | **NEW** user id field when specimen elevated | |
| Result performer | `TechnicianName` string | **RECOMMENDED** user id | |
| Verifier / reviewer / releaser | `VerifiedByName` string | **PRODUCT OWNER DECISION REQUIRED** mapping | D-LAB-04 |

## Appendix D — Label legend used in this document

| Label | Meaning |
|---|---|
| **RATIFIED / PRESERVE** | Already owner-ratified or certified; do not change without explicit reopen |
| **RECOMMENDED** | V2 recommendation — not approved |
| **PRODUCT OWNER DECISION REQUIRED** | Blocking owner choice |
| **FUTURE** | Explicitly deferred capability |
| **NOT IMPLEMENTED** | Not built in this gate / not yet built in product |
| **CERTIFIED EXISTING** | Live certified behavior (Slice 4) |
