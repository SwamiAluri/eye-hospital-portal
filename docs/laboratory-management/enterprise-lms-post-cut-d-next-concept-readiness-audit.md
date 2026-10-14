# Enterprise LMS — Post CUT D Next-Concept Readiness Audit

**Date:** 2026-10-13  
**Mode:** REPOSITORY AUDIT / PRODUCT OWNER DECISION PREPARATION ONLY — no application code, test code, API, schema, permission, UI, or configuration changes  
**Baseline:** `ACCEPTED_L_REP_03_CUT_D` ([enterprise-lms-report-preview-patient360-acceptance-closure.md](./enterprise-lms-report-preview-patient360-acceptance-closure.md))

```text
ACCEPTED_L_REP_03_CUT_D
  ↓
THIS DOCUMENT — next-concept readiness audit + recommendation
  ↓
PRODUCT_OWNER selected Patient Portal publication (L-REP-04)
  ↓
PRODUCT_DECISIONS_CLOSED_L_REP_04_AUTHORIZED
  → see enterprise-lms-report-patient-portal-publication-product-decision-closure.md
  → readiness: enterprise-lms-report-patient-portal-publication-readiness-audit.md
  ↓
NEXT_GATE = PRODUCT_OWNER_RESOLVE_PENDING_DETAIL_THEN_FORMAL_CLOSURE
  (PD-ID directions approved; PENDING_DETAIL open; BLOCKER-PP-IDENTITY-01 OPEN; implementation NOT authorized)
```

---

## 1. Accepted baseline verification

| Stamp / boundary | Status |
| --- | --- |
| `ACCEPTED_L_REP_03_CUT_D` | **Verified** — whole-slice closure present |
| `ACCEPTED_L_REP_03_CUT_D_A` … `_D_C` | Preserved |
| `D_D_PRODUCT_OWNER_APPROVED` / `D_E_MANUAL_UAT_PASSED` | Preserved |
| `ACCEPTED_L_REP_02B` / `ACCEPTED_L_REP_03_CUT_A` / `_B` / `_C` | Frozen baselines |
| `PD-D-BRANCH = OPTION_B_APPROVED` | Binding |
| CUT C Download / Pathology / Patient Portal (as of CUT D) | Frozen / unchanged / Portal out of CUT D |
| CUT D deferred P2/P3 automated tests | **Deferred follow-up** — not treated as the next implementation concept |

CUT D next gate was `PRODUCT_OWNER_REVIEW_AND_READINESS_AUDIT_FOR_NEXT_CONCEPT`. This document satisfies that audit deliverable.

---

## 2. Evidence sources inspected

| Source | Role |
| --- | --- |
| CUT D acceptance + D-A…D-E / D-D docs | Certified Preview / P360 / currentness / tests / UAT |
| [enterprise-lms-post-release-report-lifecycle-discovery.md](./enterprise-lms-post-release-report-lifecycle-discovery.md) | Post–L-REP-02B candidate inventory + **discovery sequencing** (P1–P8) |
| [enterprise-lms-implementation-plan.md](./enterprise-lms-implementation-plan.md) | L0 traceability (partially stale vs later accepted slices) |
| `lms-capability-registry.ts` | Amendments / Referrals / Quality etc. still `not_implemented`; Reports implemented with “Patient publication not implemented” |
| CUT C / CUT D Product Decision closures | Explicit OUT items: Portal publication, NotificationHub for reports, Amendments, Unrelease, historical P360 artifacts |

**Note:** `enterprise-lms-implementation-plan.md` still lists Collection/Testing/Critical/Reporting as “Planned” in places and recommends L-ORD-01C Manual UAT — that matrix is **not current** relative to later accepted L-COL / L-TST / L-CRT / L-REP slices. Prefer slice acceptance closures and the post-Release lifecycle discovery for post–Report sequencing.

---

## 3. Candidate concepts (evidence-backed status)

### 3.1 Post–Report lifecycle (from discovery P1–P8)

| Candidate | Discovery ID | Status after CUT D | Evidence |
| --- | --- | --- | --- |
| Business Report Number | P2 | **Accepted** | `ACCEPTED_L_REP_03_CUT_A` |
| Official PDF generation | P1 | **Accepted** | `ACCEPTED_L_REP_03_CUT_B` |
| Staff Official PDF Download | P3 | **Accepted** | `ACCEPTED_L_REP_03_CUT_C` |
| Staff Patient 360 LMS discovery + Preview | P4 + CUT D Preview | **Accepted** | `ACCEPTED_L_REP_03_CUT_D` |
| **Patient Portal LMS Official PDF publication** | **P5** | **Not started** | Explicitly OUT of CUT B/C/D (`PD-D-14`); Portal `/results` remains non-LMS / mock per discovery; capability copy: “Patient publication not implemented” |
| Report notification / delivery | P6 | **Not started** | No Report Release notification intent; L-CRT intent pattern exists for Critical only; PD-REP-19 Release ≠ delivery |
| Report Amendments | P7 | **Not started** | Nav stub `results/amendments` = `not_implemented`; many open PDs; immutability constraints |
| Unrelease / Revoke | P8 | **Not started** | Highest policy risk; discovery recommends last or never |

### 3.2 Other LMS areas (capability registry / L0 plan)

| Candidate | Status | Notes |
| --- | --- | --- |
| Referrals / Quality / Analytics / Billing lab ledger | `not_implemented` / Planned | Parallel LMS tracks; not sequenced after Official PDF in post-Release discovery |
| Work Queue ownership | Deferred product decision | Open in L0 plan |
| Production role grants (`lms.reports.*`, catalogue, orders) | Deferred | Operational enablement, not a new Report lifecycle concept |
| CUT D P2/P3 test hardening | Deferred | Automated coverage follow-up only — **not** a product concept |

### 3.3 Discovery sequencing (still authoritative for Report domain)

From post-Release discovery §11 (**DISCOVERY RECOMMENDATION ONLY** — never approved as an implementation mandate):

1. Numbering / PDF → **done**  
2. Staff Download → **done**  
3. Patient 360 staff discovery → **done** (CUT D)  
4. **Patient Portal publication** → next in sequence  
5. Notification / delivery  
6. Amendments  
7. Unrelease / Revoke  

---

## 4. Comparison of strongest unimplemented candidates

| Criterion | A. Patient Portal LMS Official PDF publication (P5) | B. Report notification / delivery (P6) | C. Report Amendments (P7) |
| --- | --- | --- | --- |
| Operational / business value | High — closes patient self-service gap after staff can already view/download | High — clinician/patient awareness of Released reports | High — post-Release correction integrity |
| Dependency readiness | Official PDF + number + staff download + staff P360 exist | Artifact + trigger/visibility policy still open; may need publish decisions for patient channels | Needs supersession / claim / PDF / publish / notify policy first |
| Reuse | Portal routes exist but mock; LMS Official PDF content path exists for staff | L-CRT `PlatformNotificationClient` + NotificationHub patterns | Draft `AppendVersion` inspiration only |
| Risk to certified functionality | High if Release equated with publish; privacy/security | Medium if delivery honesty fails; must not mutate Release SoT | High — immutability / claim lifetime / downstream artifacts |
| Unresolved product decisions | Many (§9.D discovery) — **no closure exists** | Many (§9.E) — **no closure exists** | Many (§9.F) — **no closure exists** |
| Boundedness for one slice | Possible if strictly “publish current Official PDF to Portal” with withdrawal deferred | Possible if staff-only notify first | Hard to bound without decision closure |
| Explicit CUT D stance | Portal was **OUT** of CUT D — starting it requires a **new** Product Decision Closure | Also OUT of CUT D | Also OUT |

---

## 5. Recommendation (for Product Owner review — not implementation authorization)

### Recommended next concept

**Patient Portal LMS Official PDF Publication**  
(Working ID: **L-REP-04 — Patient Portal Official PDF Publication**; confirmed by Product Owner via PD-PP-12)

### Rationale

1. **Repository sequencing evidence:** Post–L-REP-02B lifecycle discovery places Portal publication (P5) immediately after completed staff Download + Patient 360 discovery.  
2. **Capability gap is explicit:** Staff Preview/Download/P360 are accepted; Reports capability text still states patient publication is not implemented; Portal results remain non-LMS.  
3. **Reuse path exists without inventing Official PDF:** Current pointer + CanonicalDocument + authenticated content patterns already exist for staff; Portal needs a **separate privacy/publication boundary**, not a second PDF generator.  
4. **Alternates remain valid:** Notification (P6) is the strongest staff-side alternate if Product Owner defers all patient-facing work; Amendments (P7) should wait until publication/notify/supersession policies are clearer.

### What this recommendation is **not**

- Not authorization to implement  
- Not a silent default for publish timing, withdrawal, permissions, or channels  
- Not a reopen of CUT D / CUT C / Pathology  

---

## 6. Readiness package for recommended concept (decision-first)

**Companion decision package:** [enterprise-lms-report-patient-portal-publication-decision-package.md](./enterprise-lms-report-patient-portal-publication-decision-package.md)

### 6.1 Intended user / operational problem

Patients (and optionally patient-portal proxies) need governed access to the **current** LMS Official PDF after clinical Release + successful Official PDF generation, without treating metadata Release as automatic patient visibility (PD-REP-08 / PD-REP-19 principles).

### 6.2 Reuse (do not duplicate)

| Asset | Reuse posture |
| --- | --- |
| `LmsReport.CurrentOfficialArtifactId` + Succeeded artifact | Currentness SoT (MODEL A) |
| LaboratoryApi Download / content eligibility | Staff pattern — Portal must not bypass LMS authz with a weaker gate |
| CanonicalDocument LMS association | Bytes ownership — do not create a second document solely for Portal unless PO decides otherwise |
| Patient Portal `/patient/results` surface | Replace mock with real LMS publish model when decisions close |
| Staff Patient 360 Laboratory LMS rows | Remain staff discovery; do not merge Pathology SoT |

### 6.3 Proposed bounded scope (subject to Product Decision Closure)

**In (candidate):** Explicit publish (and possibly unpublish/withdraw) of the **current** LMS Official PDF to Patient Portal; patient-authenticated content access; audit; coexistence labeling vs any future Pathology portal docs.

**Out (candidate until separately decided):** Staff Preview/Download changes; Pathology changes; NotificationHub auto-delivery; Amendments; Unrelease; historical artifact Portal browser; SAS/public Blob; production role-grant campaigns; new Report Number / Finalize / Release semantics.

### 6.4 Decisions requiring Product Owner approval

**Update (2026-10-13):** PD-PP-01…12 are **APPROVED** and closed in  
[enterprise-lms-report-patient-portal-publication-product-decision-closure.md](./enterprise-lms-report-patient-portal-publication-product-decision-closure.md).  
Decision package retained as review history: [enterprise-lms-report-patient-portal-publication-decision-package.md](./enterprise-lms-report-patient-portal-publication-decision-package.md).

### 6.5 Business rules that must not be invented

Closed by Product Decision Closure where applicable. Residual: Patient Portal authenticated identity ↔ exact PatientId linkage is **absent** in repository evidence (`BLOCKER-PP-IDENTITY-01` in readiness audit) — do not invent Portal auth.

### 6.6 Regression boundaries to preserve

CUT C Download; CUT D Preview/P360; L-REP-02B Release metadata-only meaning; Pathology; NotificationHub not becoming Report SoT; no SAS/public Blob.  
Patient Portal publication remains a **separate prospective slice**, not part of accepted CUT D.

### 6.7 Tests / UAT / acceptance (after future authorization)

See L-REP-04 readiness audit and implementation specification for the binding test/UAT matrices. Acceptance only after blocker clearance + implementation authorization + implementation + UAT.

### 6.8 Dependencies and blockers

| Item | Status |
| --- | --- |
| Official PDF + number + current pointer | Ready (accepted) |
| Product Decision Closure for Portal publication | **Closed** — `PRODUCT_DECISIONS_CLOSED_L_REP_04_AUTHORIZED` |
| Implementation readiness audit | **Complete** — [enterprise-lms-report-patient-portal-publication-readiness-audit.md](./enterprise-lms-report-patient-portal-publication-readiness-audit.md) |
| Patient Portal real results API integration | Not started |
| Patient Portal identity linkage | **BLOCKER-PP-IDENTITY-01** — blocks safe implementation |

### 6.9 Exact next gate

```text
NEXT_GATE = PRODUCT_OWNER_RESOLVE_PENDING_DETAIL_THEN_FORMAL_CLOSURE
```

**Product Owner action required:**

1. ~~Confirm or reject the recommended next concept~~ — **Confirmed** (L-REP-04).  
2. ~~Complete Product Decision Review~~ — **Closed** (PD-PP-01…12).  
3. Directional **PD-ID-01…12** approvals recorded; resolve blocking **PENDING_DETAIL** then formal identity closure ([decision package](./enterprise-lms-patient-portal-identity-decision-package.md)). `L-PORTAL-01` = direction approved, formal closure pending details.  
4. Only after identity Product Decision Closure + identity implementation authorization + acceptance: issue **implementation authorization** for L-REP-04.

---

## 7. Deferred CUT D follow-ups (not the next concept)

| ID | Item | Priority |
| --- | --- | --- |
| P2-1 | Preview RTL interaction tests | Deferred |
| P2-2 | Explicit SAS/public URL negative assert | Deferred |
| P2-3 | CanonicalDocument non-delete Verify on regen | Deferred |
| P3-1 | Postgres concurrency suite | Deferred |

Product Owner may prioritize these as a small test-only slice later; they are **not** recommended as the next product concept.

---

## 8. Status stamps

```text
ACCEPTED_L_REP_03_CUT_D
POST_CUT_D_NEXT_CONCEPT_READINESS_AUDIT_COMPLETE
RECOMMENDED_NEXT_CONCEPT = PATIENT_PORTAL_LMS_OFFICIAL_PDF_PUBLICATION
WORKING_ID = L-REP-04
PRODUCT_DECISIONS_CLOSED_L_REP_04_AUTHORIZED
L_REP_04_IMPLEMENTATION_READINESS_AUDIT_COMPLETE
READINESS = BLOCKED_PENDING_PRODUCT_OR_POLICY_DECISION
PRODUCT_OWNER_DIRECTIONAL_APPROVALS_RECORDED_PD-ID-01_THROUGH_PD-ID-12
L_PORTAL_01 = DIRECTION_APPROVED_FORMAL_CLOSURE_PENDING_DETAILS
PRODUCT_DECISION_CLOSURE = NOT_CREATED
IMPLEMENTATION_NOT_AUTHORIZED
RUNTIME_AND_TEST_CODE_UNCHANGED
CUT_C_UNCHANGED
LEGACY_PATHOLOGY_UNCHANGED
PATIENT_PORTAL_BEHAVIOR_UNCHANGED_BY_THIS_AUDIT
NEXT_GATE = PRODUCT_OWNER_RESOLVE_PENDING_DETAIL_THEN_FORMAL_CLOSURE
```

---

## 9. Mandatory stop

**STOP.** L-REP-04 Product Decisions closed; L-PORTAL-01 directional PD-ID approvals recorded with blocking PENDING_DETAIL open.  
Do **not** implement Portal identity or L-REP-04 until formal identity closure, identity implementation authorization, and (for L-REP-04) separate authorization after identity acceptance.
