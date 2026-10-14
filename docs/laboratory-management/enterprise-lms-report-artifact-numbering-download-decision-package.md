# Enterprise LMS — Report Artifact / Numbering / Staff Download  
## Product Decision Review / Decision Package

**Date:** 2026-10-12  
**Mode:** PRODUCT DECISION REVIEW — documentation only  
**Status:** `PRODUCT_OWNER_DECISION_REQUIRED`  

This package does **not** create a Product Decision Closure.  
It does **not** stamp APPROVED.  
It does **not** authorize implementation.  

**RECOMMENDED** options below are engineering / discovery guidance only until Product Owner approves them in a separate Decision Closure.

```text
ACCEPTED_L_REP_02B
  ↓
Post-Release discovery (DISCOVERY_COMPLETE)
  ↓
THIS DOCUMENT — Product Decision Review (Artifact / Numbering / Download)
  ↓
NEXT_GATE = PRODUCT_DECISION_CLOSURE
  (Product Owner stamps choices outside this task)
```

---

## 1. Decision package status

| Field | Value |
| --- | --- |
| Mode | PRODUCT DECISION REVIEW / DECISION PACKAGE |
| Implementation | `NO_IMPLEMENTATION_STARTED` |
| L-REP-02B | Remains `ACCEPTED_L_REP_02B` — **not reopened** |
| Product Decision Closure | **Not created** by this document |
| Configuration gate | `CONFIGURATION_GATE_PENDING` (depends on PO choices) |
| Next gate | `PRODUCT_DECISION_CLOSURE` |

Forbidden stamps for this task: `IMPLEMENTATION_COMPLETE`, `READY_FOR_PRE_UAT`, `MANUAL_UAT_PASSED` (for a new slice), `ACCEPTED` (for a new slice), `PRODUCT_DECISIONS_CLOSED_*_AUTHORIZED`.

---

## 2. Authoritative references

| Document | Role |
| --- | --- |
| [enterprise-lms-post-release-report-lifecycle-discovery.md](./enterprise-lms-post-release-report-lifecycle-discovery.md) | Post–L-REP-02B discovery (`DISCOVERY_COMPLETE`) |
| [enterprise-lms-report-release-acceptance-closure.md](./enterprise-lms-report-release-acceptance-closure.md) | `ACCEPTED_L_REP_02B` |
| [enterprise-lms-report-release-decision-closure.md](./enterprise-lms-report-release-decision-closure.md) | Metadata Release decisions (immutable for this review) |
| [enterprise-lms-report-release-implementation.md](./enterprise-lms-report-release-implementation.md) | Delivered Release scope |
| [enterprise-lms-report-release-pre-uat-verification.md](./enterprise-lms-report-release-pre-uat-verification.md) | PRE-UAT evidence |
| [enterprise-lms-reporting-decision-closure.md](./enterprise-lms-reporting-decision-closure.md) | L-REP-01 principles (PD-REP-08/12/13/14/21/23/24/25; AD-REP-05/06) |
| [enterprise-lms-report-finalize-decision-closure.md](./enterprise-lms-report-finalize-decision-closure.md) | L-REP-02A; claim lifetime |

---

## 3. Certified L-REP-02B baseline

### Lifecycle (unchanged)

```text
Draft → Final → Released
```

### Release semantics (immutable for this review)

L-REP-02B Release **only**:

| Does | Does **not** |
| --- | --- |
| `Report.Status` Final → Released | Create PDF / document bytes |
| Persist `ReleasedAtUtc` / `ReleasedByUserId` | Create CanonicalDocument association |
| Keep existing ReportVersion | Assign business Report number |
| Preserve snapshots + source claims | Download / publish / notify |
| Leave ResultStatus / ResultVersion / CriticalResultEvent unchanged | Amend / Unrelease / Revoke |

**This decision package must not alter Release semantics.** Artifact, numbering, and download are **separate** future capabilities that may *depend on* Released (or Final) state; they must not be folded into Release retrospectively.

### Packaging options under review (do not auto-select)

| Option | Packaging |
| --- | --- |
| **A** | Numbering first → PDF/artifact → Download |
| **B** | PDF/artifact first → Numbering later |
| **C** | Numbering + PDF/artifact as one bounded implementation slice |
| **D** | Another justified packaging based on repository evidence |

---

## 4. Repository evidence

### Enterprise LMS Reports (LaboratoryApi)

| Fact | Evidence |
| --- | --- |
| Technical identity is Report GUID | `LmsReport.Id`; PD-REP-02B-08 / 23 |
| No business Report number field/sequence | Discovery §3–§4; no `ReportNumber` on entity |
| Status Draft / Final / Released with Finalized* / Released* | `LmsReport.cs`, `ReportStatuses` |
| Immutable ReportVersion + sources | `LmsReportVersion`, `LmsReportVersionSource` |
| Append Version Draft-only | `ReportService.AppendVersionAsync` |
| No PDF in LaboratoryApi | No QuestPDF/Puppeteer/iText refs; ReportService/Functions exclude PDF |
| No download endpoint/UI | Discovery; `lms.reports.download` catalogue-only |
| Release does not assign number or generate bytes | `ACCEPTED_L_REP_02B` |

### Permissions / audit

| Item | State |
| --- | --- |
| `lms.reports.download` | Catalogue reserved; **not wired** |
| Generate-PDF / number-assign permissions | **Not found** |
| PDF / download audit actions for LMS Reports | **Not found** |
| Production role grants | Forbidden by prior stamps (PD-REP-21 / PD-REP-02B-20) |

### Existing platform capabilities (reference only — not LMS SoT)

| Capability | Location | Constraint |
| --- | --- | --- |
| Order / Accession / Barcode / Collection sequences | LaboratoryApi | **Must not silently become Report numbers** (PD-REP-02B-08) |
| Accession pattern (technical reference) | Tenant + date sequence; format was product-approved for accession — **not** transferable as Report policy | Gaps possible on failed post-allocate work — product policy for Reports is open |
| QuestPDF | AuthService Patient Summary / Imaging | Not LaboratoryApi; AD-REP-06: do not hard-code renderer into clinical SoT |
| CanonicalDocument + Blob | AuthService; LabReport attach/download | Downstream byte store (PD-REP-25 / AD-REP-05); Pathology association is **not** LMS Report SoT |
| Patient Portal results | Mock data | Out of this package |

### Established product principles (carry forward — not reopened)

| Principle | Stamp |
| --- | --- |
| Numbering is configuration-owned; do not invent format/scope | PD-REP-13 |
| Templates/branding configuration-owned | PD-REP-14 |
| CanonicalDocument may store generated bytes; not clinical SoT | PD-REP-25 / AD-REP-05 |
| PDF is a separate capability from Report clinical SoT | PD-REP-12 / AD-REP-06 |
| Released ≠ patient-visible | PD-REP-08 / PD-REP-02B-12 |
| Retention duration configuration-owned when needed | PD-REP-23 |
| GUID remains technical identity; business number separate attribute if introduced | PD-REP-02B-23 |

---

## 5. Report numbering decision matrix

| # | Question | Repository / prior stamp | Open PO choice |
| --- | --- | --- | --- |
| N1 | Is a business Report Number required at all? | Not required for L-REP-02B; absent today | **PD-ART-01** |
| N2 | If yes, when assigned? Draft / Final / Released / PDF gen / first official artifact | Timing **unresolved**; Release must not assign today | **PD-ART-02** |
| N3 | Is the number immutable once assigned? | Not established for Reports | **PD-ART-02b** (see PO section) |
| N4 | Identifies Report aggregate vs ReportVersion? | GUID identifies aggregate; version number is integer on ReportVersion — business number binding open | **PD-ART-02c** |
| N5 | Sequence scope: tenant / operating branch / other | Report has `TenantId` + `OperatingBranchId`; scope for sequence **open** (PD-REP-13 forbids inventing) | **PD-ART-03** |
| N6 | Format (prefix, date, width, reset) | **CONFIGURATION_REQUIRED** — values absent; inventing forbidden | Config values after PD-ART-01=YES |
| N7 | Gaps / reuse | LMS accession increments then formats; failed later work can leave unused values — **technical reference only**, not Report policy | **PD-ART-03b** |
| N8 | PDF generation fails after number assigned? | No Report numbering code exists | **PD-ART-02d** (orphan number policy) |
| N9 | Report never Released after number? | Depends on assignment timing (Final vs Released) | Coupled to PD-ART-02 |
| N10 | Future Amendments | Amendments future; number supersession open | Defer detail to Amendment package; **record interaction risk** |
| N11 | Show number in UI before Release? | UI today shows GUID/status/version only | **PD-ART-02e** |
| N12 | GUID still immutable technical identity? | **Yes — established** (PD-REP-02B-23). Business number cannot replace GUID | Carry forward |

### Numbering configuration gate (if PD-ART-01 = YES)

```text
CONFIGURATION_REQUIRED = YES
```

Required before implementation (values not invented here):

- Format / prefix / width / date component / reset period  
- Sequence scope (tenant vs branch vs other)  
- Gap and reuse policy  
- Assignment timing relative to Final / Release / artifact  

If PD-ART-01 = NO:

```text
CONFIGURATION_REQUIRED = NO  (for numbering subdomain)
```

---

## 6. PDF / artifact decision matrix

| # | Question | Repository / prior stamp | Open PO choice |
| --- | --- | --- | --- |
| P1 | Eligible state: Final / Released / both / other | Content frozen at Final; Released is official metadata; eligibility **open** | **PD-ART-04** |
| P2 | Mode: automatic / explicit / sync / async / once / regenerable | No LMS generator today; Clinical Auth must not auto-create Reports (PD-REP-11) — extends caution against hidden side effects | **PD-ART-05** |
| P3 | Content source | Must be immutable ReportVersion snapshot + sources (established immutability) | Carry forward |
| P4 | Regeneration / identical bytes / template change / artifact versioning | Open | **PD-ART-05b** |
| P5 | Template ownership / effective version recording | PD-REP-14: configuration-owned; location/manager **open** | **PD-ART-06** |
| P6 | Branding tenant/branch/config | Configuration-owned; values absent | Part of PD-ART-06 / config |
| P7 | Signatory on PDF | Release actor known; signatory hierarchy not required for metadata Release; PDF signatory **open** — do not invent | **PD-ART-06b** |
| P8 | Does PDF require business Report Number? | Coupling undecided — drives Option A/B/C/D | **PD-ART-01** + **PD-ART-08-coupling** (PD-ART-11) |
| P9 | Artifact identity: ReportVersion / Report / separate document | Architecture allows CanonicalDocument as separate document identity storing bytes (PD-REP-25) | **PD-ART-07** |
| P10 | Storage: CanonicalDocument/Blob | Technical capability exists; **must not** become clinical SoT | **PD-ART-07** |
| P11 | Retention duration | PD-REP-23: duration CONFIGURATION_REQUIRED when needed | Config after storage chosen |
| P12 | Audit for generation | Platform audit_log pattern; LMS PDF audit action **absent** | Required if implemented; action name in Closure |
| P13 | Generation failure | Report Status must not silently change (preserve Final/Released) | Carry forward integrity rule; detail in Closure |

### PDF configuration gate (if PDF/artifact in next slice)

```text
CONFIGURATION_REQUIRED = YES
```

At minimum when PDF in scope:

- Template identity / effective version  
- Branding  
- Signatory display rules (if any beyond Release metadata)  
- Retention duration (if stored)  
- Regeneration policy  

Renderer technology (e.g. QuestPDF elsewhere) is an **implementation choice after Closure**, not a product format invention — but service ownership (LaboratoryApi vs AuthService) needs PO/architecture alignment under AD-REP-06.

---

## 7. Staff download decision matrix

| # | Question | Repository evidence | Open PO choice |
| --- | --- | --- | --- |
| D1 | Staff-only initially? | Patient publication out of scope historically; Portal mock | **PD-ART-10** (patient) + recommend staff-first via **PD-ART-08** |
| D2 | Eligible states: Final / Released / both | Open; must align with artifact eligibility | **PD-ART-08** |
| D3 | Requires generated artifact? | No LMS bytes today; Pathology download requires attachment — technical parallel | Strong dependency: **yes for LMS download coherence** unless alternate attach policy (not proposed) |
| D4 | Multiple artifact versions downloadable? | No LMS artifacts yet | **PD-ART-09** |
| D5 | Authoritative artifact? | Open | **PD-ART-09** |
| D6 | Tenant/branch authorization? | Mirror Finalize/Release: JWT tenant + ValidateUserBranch + Report.OperatingBranchId | Carry forward pattern |
| D7 | Audit action? | Absent | Required in Closure if download implemented |
| D8 | Fail-closed on audit failure? | Governed mutations fail-closed; download is read of artifact — whether access is audited fail-closed is open | **PD-ART-09b** |
| D9 | Surfaces: detail / worklist / other | Detail is natural; worklist open | **PD-ART-09c** |
| D10 | Patient download out of scope? | Should be explicit | **PD-ART-10** |

### Download configuration gate

If download only streams an already-stored artifact under existing staff auth patterns:

```text
CONFIGURATION_REQUIRED = NO  (download subdomain alone)
```

If download depends on PDF/templates/retention that are not closed:

```text
CONFIGURATION_REQUIRED = YES  (inherited from artifact/numbering)
```

Permission catalogue code `lms.reports.download` already exists — wiring + grants remain separate (no role grants in prior slices).

---

## 8. Numbering / PDF / download dependency analysis

### Option 1 — Numbering → PDF → Download

| Aspect | Assessment |
| --- | --- |
| Advantages | Official PDF can display business number; number assignment independent of renderer; download always has numbered artifact |
| Disadvantages | Numbering blocked on CONFIGURATION_REQUIRED even if staff only need a draft PDF of snapshot content; orphan numbers if PDF never generated |
| Lifecycle impact | Number may exist before Release depending on PD-ART-02 |
| Failure | Need policy if number allocated then PDF fails |
| Amendments | Later amend may need new number or retain number — deferred |
| Artifact identity | Document can embed number at generation time |
| Configuration | **YES** for numbering + PDF |
| Migration | Existing Final/Released reports need backfill/assignment policy |
| Clinical/integrity risks | Premature numbers on never-Released reports if assigned at Final |

### Option 2 — PDF → Numbering → Download

| Aspect | Assessment |
| --- | --- |
| Advantages | Unblocks staff artifact/download sooner if PDF may omit business number; numbering config can lag |
| Disadvantages | First artifacts may lack official number; later stamping number onto PDF requires regeneration or overlay policy |
| Lifecycle impact | Downloadable artifact without business number |
| Failure | PDF failure leaves Status unchanged (good); numbering later must not rewrite clinical SoT |
| Amendments | Numbering-after-PDF complicates which artifact is “official” |
| Artifact identity | May need artifact version 2 when number added |
| Configuration | PDF **YES**; numbering deferred **YES** later |
| Migration | Renumbering already-downloaded PDFs is painful |
| Clinical/integrity risks | Two “official” artifacts (unnumbered then numbered) without clear authority |

### Option 3 — Numbering + PDF as one bounded slice → Download

| Aspect | Assessment |
| --- | --- |
| Advantages | Single Closure for official printed identity; download sees complete artifact; matches “REPORT ARTIFACT + NUMBERING FOUNDATION” cluster |
| Disadvantages | Larger slice; fully blocked until numbering **and** template config exist |
| Lifecycle impact | Cleaner official release document story |
| Failure | Transactional coupling of allocate-number + generate-bytes needs fail-closed design |
| Amendments | One policy surface for number+PDF together |
| Artifact identity | Clearer “first official artifact” definition |
| Configuration | **YES** (numbering + templates) |
| Migration | Joint backfill policy |
| Clinical/integrity risks | Scope creep if download/publication bundled accidentally |

### Option 4 — PDF without business Report Number → Download

| Aspect | Assessment |
| --- | --- |
| Advantages | Smallest path to staff-usable artifact; GUID (+ Order/Accession as **reference fields only**, not Report numbers) can appear on PDF if PO allows; download unblocked |
| Disadvantages | May fail regulatory/operational expectation for human Report numbers; later numbering forces Option 2 risks |
| Lifecycle impact | Does not change Release; adds artifact capability only |
| Failure | Status unchanged on PDF fail |
| Amendments | Numbering still open later |
| Artifact identity | Document without business Report number |
| Configuration | PDF templates **YES**; numbering **NO** for this slice |
| Migration | Lower |
| Clinical/integrity risks | Mislabeling Order/Accession as “Report No.” (explicitly forbidden) |

### Packaging Options A–D (review framing)

| Review option | Maps to | When coherent |
| --- | --- | --- |
| **A** Numbering → PDF → Download | Option 1 | PO requires business number **on** official PDF |
| **B** PDF → Numbering later | Option 2 / 4 then numbering | PO accepts temporary or permanent PDFs without business Report number |
| **C** Numbering + PDF together → Download | Option 3 | Official artifact must be numbered; want one Closure |
| **D** Other | e.g. Numbering-only first (no PDF); or PDF+Download without numbering forever | Must be justified; numbering-only does not unlock download |

**Do not select solely for technical ease.** Selection hinges primarily on **PD-ART-01** (is business Report Number required?) and **PD-ART-11** (must PDF display it?).

---

## 9. Security and audit considerations

| Concern | Numbering | PDF / artifact | Staff download |
| --- | --- | --- | --- |
| Permission | New or extend manage/finalize/release — **undecided**; do not create here | Generate permission **undecided** | `lms.reports.download` catalogue exists; wire later |
| Tenant boundary | Sequence + Report.TenantId | Generation in tenant context | JWT tenant owns Report |
| Operating branch | Scope per PD-ART-03; ValidateUserBranch pattern | Match Report.OperatingBranchId | Same |
| Patient boundary | Number not patient-visible by itself | Artifact may contain PHI — staff-only until publication slice | Staff-only unless PD-ART-10 reopens |
| Audit action | Assign-number action needed if implemented | Generate-artifact action needed | Download/access action needed |
| Fail-closed | Assignment must not partially commit inconsistently with Status | Status must remain Final/Released on failure | Access denial honest; audit policy per PD-ART-09b |
| Idempotency | Allocate-once per Report (or per policy) | Generate-once vs regenerate keys | Read may be non-mutating; still audit |
| Concurrency | Sequence allocation race-safe (LMS sequence patterns as **technical** reference) | Concurrent generate → exactly-one official artifact policy needed | Concurrent downloads OK |
| Artifact integrity | Number embedded only after policy | Hash/dedupe via CanonicalDocument identity pattern possible | Stream only associated document |
| Access control | No cross-tenant/branch | No Pathology LabReport bridge | No patient portal route |

**Production role grants:** remain out of scope (carry forward).

---

## 10. Configuration gate

### Per proposed subdomain

| Subdomain | Gate if included in next Closure |
| --- | --- |
| Business Report Numbering | `CONFIGURATION_REQUIRED = YES` (format, scope, reset, gaps/reuse) |
| PDF templates / branding / signatory display | `CONFIGURATION_REQUIRED = YES` |
| Artifact retention duration | `CONFIGURATION_REQUIRED = YES` when duration needed (PD-REP-23) |
| Staff download alone (artifact already exists + auth patterns) | `CONFIGURATION_REQUIRED = NO` |
| Renderer library choice | Implementation detail after Closure — not a substitute for template config |

### Combined slice gates (illustrative)

| If PO chooses… | Overall gate |
| --- | --- |
| Option A or C (numbering before/with PDF) | `CONFIGURATION_REQUIRED = YES` |
| Option B/D with PDF, numbering deferred | `CONFIGURATION_REQUIRED = YES` (templates); numbering gate deferred |
| Numbering-only, no PDF | `CONFIGURATION_REQUIRED = YES` (numbering); download **not** unlocked |
| Download-only without artifact | **Not coherent** — do not authorize |

```text
CONFIGURATION_GATE_PENDING
```

Exact YES/NO for the authorized slice is set in **Product Decision Closure**, not here.

---

## 11. Future-slice boundaries

Explicitly **outside** this decision package unless a PO choice proves a hard dependency (none required for staff artifact/download foundation):

| Keep separate |
| --- |
| Patient Portal publication |
| Patient 360 publication / LMS document discovery in 360 |
| NotificationHub / SMS / email / WhatsApp |
| Amendments |
| Unrelease / Revoke |
| Analytics / Reporting KPIs |
| Production role grants |
| Legacy Pathology migration / dual-write / bridge |
| Changing L-REP-02B Release to auto-generate PDF or numbers |

Do not solve these while deciding PDF / numbering / download.

---

## 12. Recommended bounded slice

**Label:** `PRODUCT DECISION RECOMMENDATION ONLY`  
**Not authorized. Not approved.**

### Recommendation summary

Recommend the Product Owner first answer **PD-ART-01** and **PD-ART-11** (must official PDF display a business Report Number?).

Then:

| If… | Recommended packaging |
| --- | --- |
| Business Report Number **required on official PDF** | **Option C** (Numbering + PDF/artifact as one Closure) → then Staff Download (same or immediate follow-on slice). Option A is acceptable if PO wants numbering UAT before PDF. |
| Business Report Number **not required** for first staff artifact | **Option D / Option 4**: PDF/artifact for **Released** reports (preferred eligibility candidate) without business Report Number → Staff Download; numbering later as its own CONFIGURATION_REQUIRED slice. |

### Smallest coherent next slice (engineering recommendation)

**Name:** Staff Report Artifact Foundation (+ optional Numbering co-requisite) and Staff Download  

| Field | Content |
| --- | --- |
| Why correct next | Certified lifecycle ends at Released metadata; staff still cannot obtain bytes; download catalogue exists but cannot wire without an artifact; publication/notify/amend are larger privacy/clinical gates |
| Why not premature | Discovery complete; L-REP-02B accepted and stable; dependencies are config/product, not missing upstream clinical states |
| Dependencies | Closed PD-ART-* for eligibility, generation mode, storage, download; config for templates (and numbering if co-requisite) |
| Unlocks | Staff download; later Patient 360 discovery / Portal / notify can consume artifacts without redefining Release |
| Deliberately does not solve | Patient visibility, notifications, Amendments, Unrelease, Pathology bridge, role grants, changing Release semantics |

### Preferred eligibility candidate (recommendation only)

Prefer **Released** as the first eligible state for official artifact generation and staff download, because:

- Final already means frozen content (L-REP-02A)  
- Released is the stamped “official” operational milestone (L-REP-02B) without patient visibility  
- Avoids implying Final reports are externally official  

This remains a **recommendation** until PD-ART-04 / PD-ART-08 are stamped.

### Explicit non-recommendation

Do **not** authorize download-only.  
Do **not** change Release to auto-PDF.  
Do **not** use Order/Accession/Barcode numbers as Report numbers.

---

## 13. Explicit unresolved decisions

All items in §14 Product Owner section. Highest impact:

1. Is a business Report Number required? (PD-ART-01)  
2. Must PDF display that number? (PD-ART-11) → drives Option A/B/C/D  
3. PDF/download eligibility: Final vs Released (PD-ART-04 / PD-ART-08)  
4. Generation mode and regeneration (PD-ART-05)  
5. Template / branding / signatory (PD-ART-06*)  
6. Artifact storage association model (PD-ART-07)  
7. Download artifact selection and audit (PD-ART-09*)  
8. Patient download remains separate (PD-ART-10)  
9. Numbering scope / gaps / immutability / aggregate vs version (PD-ART-02* / PD-ART-03*)  
10. Slice packaging Option A / B / C / D (PD-ART-12)  

---

## 14. Product Owner approval section

# PRODUCT OWNER DECISION REQUIRED

Product Owner must stamp choices below (outside Cursor).  
Do **not** treat RECOMMENDED rows as approved.  
Blank / unstated = **not decided**.

---

### PD-ART-01 — Business Report Number required?

Is a business Report Number required for Enterprise LMS Reports (separate from GUID)?

| Choice | Meaning |
| --- | --- |
| **A** | YES — required for the next official artifact foundation |
| **B** | NO — not required for the next staff artifact/download slice; may revisit later |
| **C** | YES later — required eventually, but **not** in the next slice |

**Product Owner selection:** ___________  

---

### PD-ART-02 — Number assignment timing

*Answer only if PD-ART-01 = A (or if C and next slice includes numbering).*

When is the business Report Number assigned?

| Choice | Meaning |
| --- | --- |
| **A** | At Final |
| **B** | At Released |
| **C** | At PDF / first official artifact generation (same transaction/policy as artifact) |
| **D** | Explicit separate numbering action (not Final/Release/PDF) |
| **E** | Other (describe): ___________ |

**Product Owner selection:** ___________  

---

### PD-ART-02b — Number immutability

| Choice | Meaning |
| --- | --- |
| **A** | Immutable once assigned |
| **B** | Mutable under governed correction only (future Amendment policy) |
| **C** | Other: ___________ |

**Product Owner selection:** ___________  

---

### PD-ART-02c — Number identifies

| Choice | Meaning |
| --- | --- |
| **A** | Report aggregate (one number per LmsReport) |
| **B** | Individual ReportVersion |
| **C** | Official artifact / document instance |
| **D** | Other: ___________ |

**Product Owner selection:** ___________  

---

### PD-ART-02d — Number assigned but PDF fails

| Choice | Meaning |
| --- | --- |
| **A** | Keep number; retry PDF later |
| **B** | Roll back number allocation (if technically possible under gap policy) |
| **C** | N/A — number only assigned after successful PDF |
| **D** | Other: ___________ |

**Product Owner selection:** ___________  

---

### PD-ART-02e — UI visibility of number before Release

| Choice | Meaning |
| --- | --- |
| **A** | Visible to staff as soon as assigned (even if Final) |
| **B** | Visible only when Status = Released |
| **C** | Visible only when official artifact exists |
| **D** | N/A — numbering not in next slice |

**Product Owner selection:** ___________  

---

### PD-ART-03 — Numbering sequence scope

| Choice | Meaning |
| --- | --- |
| **A** | Tenant-scoped sequence |
| **B** | Operating-branch-scoped sequence |
| **C** | Other justified scope: ___________ |
| **D** | N/A — numbering not in next slice |

**Product Owner selection:** ___________  

*Format values (prefix, width, date, reset) are **not** chosen here — supply in Closure/config after scope is stamped.*

---

### PD-ART-03b — Gaps and reuse

| Choice | Meaning |
| --- | --- |
| **A** | Gaps allowed; reuse forbidden |
| **B** | Gaps forbidden (must define compensation) |
| **C** | Reuse allowed under governed rules |
| **D** | N/A — numbering not in next slice |
| **E** | Other: ___________ |

**Product Owner selection:** ___________  

---

### PD-ART-04 — PDF / artifact eligibility

| Choice | Meaning |
| --- | --- |
| **A** | Released only |
| **B** | Final only |
| **C** | Final and Released |
| **D** | Other: ___________ |

**Product Owner selection:** ___________  

---

### PD-ART-05 — PDF generation mode

| Choice | Meaning |
| --- | --- |
| **A** | Explicit staff action, synchronous |
| **B** | Explicit staff action, asynchronous job |
| **C** | Automatic on Release (side effect — carefully bounded; does **not** change L-REP-02B metadata meaning) |
| **D** | Automatic on first download request (generate-on-read) |
| **E** | Other: ___________ |

**Product Owner selection:** ___________  

---

### PD-ART-05b — Regeneration

| Choice | Meaning |
| --- | --- |
| **A** | Generate once; regeneration forbidden |
| **B** | Regenerable; must be byte-identical for same template+snapshot |
| **C** | Regenerable; new artifact version if template/branding changes; prior artifacts retained |
| **D** | Other: ___________ |

**Product Owner selection:** ___________  

---

### PD-ART-06 — Template ownership

| Choice | Meaning |
| --- | --- |
| **A** | Tenant-level governed configuration (location TBD in Closure; values not invented here) |
| **B** | Branch-level governed configuration |
| **C** | Platform default only until hospital supplies config (`CONFIGURATION_REQUIRED` blocks go-live) |
| **D** | Other: ___________ |

**Product Owner selection:** ___________  

---

### PD-ART-06b — Signatory shown on PDF

| Choice | Meaning |
| --- | --- |
| **A** | Release actor (`ReleasedByUserId`) |
| **B** | Finalizer (`FinalizedByUserId`) |
| **C** | Configured laboratory signatory (CONFIGURATION_REQUIRED) |
| **D** | Ordering provider / responsible clinician (source mapping required) |
| **E** | No personal signatory block in first slice (metadata only in UI) |
| **F** | Other: ___________ |

**Product Owner selection:** ___________  

---

### PD-ART-07 — Artifact storage model

| Choice | Meaning |
| --- | --- |
| **A** | CanonicalDocument + Blob as downstream store associated to LMS Report/ReportVersion (**not** clinical SoT) |
| **B** | LaboratoryApi-owned blob/metadata without CanonicalDocument |
| **C** | Other: ___________ |

**Product Owner selection:** ___________  

---

### PD-ART-08 — Staff download eligibility

| Choice | Meaning |
| --- | --- |
| **A** | Released only, and only if artifact exists |
| **B** | Final or Released, if artifact exists |
| **C** | Same as PDF eligibility (PD-ART-04), if artifact exists |
| **D** | Other: ___________ |

**Product Owner selection:** ___________  

---

### PD-ART-09 — Download artifact selection

| Choice | Meaning |
| --- | --- |
| **A** | Single authoritative current official artifact only |
| **B** | Staff may download any retained artifact version; UI marks authoritative |
| **C** | Other: ___________ |

**Product Owner selection:** ___________  

---

### PD-ART-09b — Download audit fail-closed

| Choice | Meaning |
| --- | --- |
| **A** | Audit access; if audit write fails, deny download (fail-closed) |
| **B** | Audit best-effort; download may proceed if authorized (document honesty) |
| **C** | Other: ___________ |

**Product Owner selection:** ___________  

---

### PD-ART-09c — Download UI surfaces

| Choice | Meaning |
| --- | --- |
| **A** | Report detail only |
| **B** | Report detail + Reports worklist |
| **C** | Other LMS surface: ___________ |

**Product Owner selection:** ___________  

---

### PD-ART-10 — Patient download

| Choice | Meaning |
| --- | --- |
| **A** | Explicitly **OUT OF SCOPE** for this Closure (staff-only) |
| **B** | In scope (requires separate privacy/security decisions — not recommended in this package) |

**Product Owner selection:** ___________  

---

### PD-ART-11 — Must official PDF display business Report Number?

| Choice | Meaning |
| --- | --- |
| **A** | YES — PDF must include business Report Number |
| **B** | NO — PDF may omit business Report Number (GUID / Order / Accession may appear only as labeled non-Report-number references if desired) |
| **C** | N/A — PDF not in next slice |

**Product Owner selection:** ___________  

---

### PD-ART-12 — Slice packaging

| Choice | Meaning |
| --- | --- |
| **A** | Numbering first → PDF/artifact → Download |
| **B** | PDF/artifact first → Numbering later → Download after artifact |
| **C** | Numbering + PDF/artifact as one bounded slice → Download |
| **D** | PDF/artifact + Download without business Report Number; numbering separate later |
| **E** | Other justified packaging: ___________ |

**Product Owner selection:** ___________  

---

### PD-ART-13 — Production role grants

| Choice | Meaning |
| --- | --- |
| **A** | No production role grants in the next slice (catalogue/enforce only) — **consistent with prior LMS Report slices** |
| **B** | Role grants included (describe): ___________ |

**Product Owner selection:** ___________  

---

### Future capabilities confirmation (default OUT OF SCOPE)

Confirm these remain outside the next Closure unless explicitly overridden:

| ID | Capability | Default |
| --- | --- | --- |
| PD-ART-F01 | Patient Portal publication | OUT |
| PD-ART-F02 | Patient 360 publication | OUT |
| PD-ART-F03 | NotificationHub / SMS / email / WhatsApp | OUT |
| PD-ART-F04 | Amendments | OUT |
| PD-ART-F05 | Unrelease / Revoke | OUT |
| PD-ART-F06 | Analytics | OUT |
| PD-ART-F07 | Pathology migration / dual-write | OUT |

**Product Owner confirmation (OUT for all / list exceptions):** ___________  

---

### Product Owner signature block

| Field | Value |
| --- | --- |
| Product Owner name | ___________ |
| Date | ___________ |
| Decision method | Outside Cursor / ___________ |
| Result | APPROVED choices as marked / REJECTED / DEFER |

After approval, a **separate** Product Decision Closure document must stamp:

`PRODUCT_DECISIONS_CLOSED_<SLICE>_AUTHORIZED`

and set `CONFIGURATION_REQUIRED = YES|NO` for the authorized slice.

---

## Final stamps

```text
PRODUCT_DECISION_REVIEW_COMPLETE

NO_IMPLEMENTATION_STARTED

L_REP_02B_REMAINS_ACCEPTED

PRODUCT_OWNER_DECISION_REQUIRED

CONFIGURATION_GATE_PENDING

NEXT_GATE = PRODUCT_DECISION_CLOSURE
```

**STOP.**
