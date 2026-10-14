# L-CRT-01 — Critical Results  
# Product Decision Package

**Date:** 2026-10-12  
**Mode:** PRODUCT DECISION PREPARATION ONLY — no application code, schema, migrations, APIs, UI, permissions seeding/grants, audit allowlist changes, Result status changes, L-TST/L-VER/L-AUTH changes, notifications, thresholds, or workflows modified  

**Discovery evidence:** [enterprise-lms-critical-results-discovery-audit.md](./enterprise-lms-critical-results-discovery-audit.md)

**Upstream certified boundary:**

```text
Draft → TechnicalVerified → ClinicallyAuthorized
ClinicallyAuthorized ≠ Final ≠ Released ≠ Patient-visible ≠ Critical workflow
Critical Results = separate slice L-CRT-01 (PD-AUTH-11 / PD-VER-19 / PD-TST-13)
```

**Decision status vocabulary (this package):**

| Label | Meaning |
|---|---|
| **OPEN** | Product Owner has not decided |
| **RECOMMENDED** | Engineering recommendation for PO consideration — **not approved** |
| **DECISION REQUIRED** | Blocking clarity needed before implementation authorization |
| **APPROVED** | Used **only** for already-closed upstream decisions (not new L-CRT stamps) |

**No PD-CRT / AD-CRT item in this document is APPROVED for L-CRT-01 implementation.**

---

## 1. Already certified behavior (do not reopen)

| Item | Status |
|---|---|
| L-COL-01B … L-COL-01E Collection → Specimen → Receiving → Barcode | **APPROVED EXISTING** |
| L-TST-01A Draft Result SoT | **APPROVED EXISTING** |
| L-VER-01 Draft → `TechnicalVerified` | **APPROVED EXISTING** |
| L-AUTH-01 `TechnicalVerified` → `ClinicallyAuthorized` | **APPROVED EXISTING** |
| Technical Verification ≠ Clinical Authorization ≠ Final/Released | **APPROVED EXISTING** |
| Critical Results remain L-CRT-01 (out of Testing/Verification/Authorization) | **APPROVED EXISTING** (PD-TST-13, PD-VER-19, PD-AUTH-11) |
| L-AUTH first slice has no Critical prerequisite | **APPROVED EXISTING** (PD-AUTH-11) — production sequencing may be revisited here |
| PD-LAB-CRIT-01 — events + ack + escalate via platform orchestration | **APPROVED EXISTING** (architecture) |
| PD-LAB-COM-01 (V3) — no Lab channel hard-wiring | **APPROVED EXISTING** |
| NOTIF-01 — critical is a core intent; ack via Laboratory API only | **APPROVED EXISTING** principle |
| Platform `audit_log` is audit SoT | **APPROVED EXISTING** |
| LaboratoryApi owns LMS Result domain | **APPROVED EXISTING** |
| Pathology LabReport is not LMS Result/Critical SoT | **APPROVED EXISTING** |
| No production role grants from decision docs | **APPROVED EXISTING** |
| Do not invent clinical thresholds / timers / recipient trees from medical knowledge | **APPROVED EXISTING** principle |
| OrderTest / Specimen / Collection / Receiving / Barcode not mutated by Result mutations | **APPROVED EXISTING** |

---

## 2. Discovery evidence summary

| Fact | Evidence |
|---|---|
| Result statuses | `Draft`, `TechnicalVerified`, `ClinicallyAuthorized` only |
| Critical entity / API / permission / ack / escalate | **Absent** |
| FE Critical route | Placeholder `not_implemented` |
| Catalogue critical hooks | Opaque `CriticalThresholdConfigRef` / interval / flag refs — **not** live evaluation |
| Notification transport | SignalR + internal push reusable; SMS/email incomplete / appointment-oriented |
| PRD-RES-04 | Detection + communication + escalation + acknowledgement + closure with evidence |
| PD-LAB-CRIT-02 | Thresholds, recipients, escalation timers, ack SLA — **still open**; historically blocks L7 |
| PRD binary | **Not in repository** — rely on certified extractions (**PRD FILE GAP**) |

---

## 3. PRD / architecture requirements (for decision)

| ID | Requirement (summary) |
|---|---|
| PRD-RES-04 | Critical detection, communication, escalation, acknowledgement, closure with evidence |
| PRD-RES-02 | Persist abnormal/critical flags (live calc needs config) |
| PRD-WF-07 | Critical communication in workflow after TV / clinical auth path |
| V3 §12 / PD-LAB-CRIT-01 | Policy, qualifying result, event, recipient, attempt, ack, escalation, final communication status, audit |
| PD-LAB-CRIT-02 | Thresholds, recipients, timers, ack SLA — residual |
| NOTIF-01 / `lab.result.critical` | Core intent; ack via Lab API |
| Testing §13 extraction | Flag ≠ clinical contact; portal SMS alone never closes |

---

## 4. Configuration blockers

| Blocker | Classification | Impact on first slice |
|---|---|---|
| No governed numeric/qualitative critical thresholds | **CONFIGURATION_REQUIRED** | Blocks **automated** detection |
| No recipient / on-call matrix | **PRODUCT_DECISION_REQUIRED** (CRIT-02) | Blocks full escalation chain |
| No escalation timers / ack SLA | **PRODUCT_DECISION_REQUIRED** (CRIT-02) | Do not invent minutes |
| No critical MasterValue / rule versioning | **CONFIGURATION_REQUIRED** | Blocks config-driven engine |
| Opaque catalogue refs only | **AVAILABLE** as hooks | Insufficient for live evaluation |

**Honesty rule:** Do not authorize an implementation that claims automated critical detection while configuration is empty.

---

## 5. Proposed bounded first-slice decisions (NOT APPROVED)

### PD-CRT-01 — Detection mode for first slice

| Field | Content |
|---|---|
| **Status** | **OPEN** / **DECISION REQUIRED** / **RECOMMENDED** |
| **Question** | How is a result classified as critical in L-CRT-01? |
| **Options** | **(A)** Governed **manual** classification by authorized lab role (event created explicitly) · **(B)** Automated evaluation against governed threshold config (requires CONFIGURATION first) · **(C)** Hybrid (manual now; auto later) · **(D)** Import Pathology interpretation strings (**forbidden**) |
| **Recommendation** | **(A)** or **(C)** while thresholds are absent; **(B)** only after config + CRIT-02 closed |
| **Forbidden** | Invented hard-coded medical cutoffs; Pathology LabReport as SoT |

### PD-CRT-02 — Criticality model

| Field | Content |
|---|---|
| **Status** | **OPEN** / **RECOMMENDED** |
| **Question** | How is criticality represented relative to ResultStatus? |
| **Options** | **(A)** Orthogonal `CriticalResultEvent` (ResultStatus unchanged) · **(B)** New ResultStatus (e.g. Critical) · **(C)** Boolean/flag columns on `LmsResult` only · **(D)** Communication log only without Lab event (**forbidden** vs CRIT-01) |
| **Recommendation** | **(A)** — preserves Auth/Reporting boundaries; matches IA/V3 event concept |
| **Forbidden** | Replacing `ClinicallyAuthorized` with Critical; silent Final |

### PD-CRT-03 — Auth ↔ Critical sequencing

| Field | Content |
|---|---|
| **Status** | **OPEN** / **DECISION REQUIRED** |
| **Question** | How does Critical interact with Clinical Authorization? |
| **Options** | **(A)** Parallel — authorize independent of critical ack (detect anytime after chosen eligibility) · **(B)** Detect/notify only after ClinicallyAuthorized; ack before Reporting · **(C)** Block authorize until critical ack · **(D)** Detect from TechnicalVerified; authorize still independent |
| **Recommendation** | Prefer **(A)** or **(B)/(D)** for first slice; avoid inventing Auth prerequisite unless PO requires **(C)** (would reopen L-AUTH operational behavior) |
| **Note** | PD-AUTH-11 already approved Auth first slice without Critical prerequisite; this decision governs L-CRT production rule |

### PD-CRT-04 — Earliest evaluation eligibility

| Field | Content |
|---|---|
| **Status** | **OPEN** / **DECISION REQUIRED** |
| **Question** | At which ResultStatus may critical classification/detection occur? |
| **Options** | **(A)** Draft · **(B)** TechnicalVerified · **(C)** ClinicallyAuthorized · **(D)** TV and later · **(E)** CA only |
| **Recommendation** | Prefer **(D)** or **(E)** to avoid clinician alerts on incomplete Draft; PO clinical safety call |
| **Forbidden** | Silent evaluation inside Verify/Authorize without explicit Critical APIs |

### PD-CRT-05 — Version binding

| Field | Content |
|---|---|
| **Status** | **OPEN** / **RECOMMENDED** |
| **Question** | What version does a Critical event bind to? |
| **Options** | **(A)** Exact `ResultVersion` number at classification · **(B)** Verified version · **(C)** Authorized version · **(D)** Result aggregate only |
| **Recommendation** | **(A)** with immutable event history |
| **Forbidden** | Later version silently rewriting prior critical event |

### PD-CRT-06 — Acknowledgement authority

| Field | Content |
|---|---|
| **Status** | **OPEN** / **DECISION REQUIRED** |
| **Question** | Who may acknowledge a critical communication? |
| **Options** | **(A)** Ordering provider · **(B)** Any authorized clinician · **(C)** Laboratory authorized role · **(D)** A+B · **(E)** A+B+C with audit |
| **Recommendation** | Close with explicit permission code; prefer clinician ack with lab documentation fallback only if PO requires |
| **Forbidden** | Toast view = acknowledgement; SMS delivery = acknowledgement |

### PD-CRT-07 — Acknowledgement evidence

| Field | Content |
|---|---|
| **Status** | **OPEN** / **DECISION REQUIRED** |
| **Question** | What evidence closes acknowledgement? |
| **Options** | **(A)** Authenticated UI ack · **(B)** UI ack + mandatory comment · **(C)** UI ack + read-back fields (recipient, method, time) · **(D)** Phone-only with lab documentation |
| **Recommendation** | At least **(B)**; prefer **(C)** if PRD “recipient evidence / read-back” is in first-slice scope |
| **Note** | Portal SMS alone never closes (PRD extraction) |

### PD-CRT-08 — Escalation in first slice

| Field | Content |
|---|---|
| **Status** | **OPEN** / **DECISION REQUIRED** |
| **Question** | Is time-bound escalation in L-CRT-01 first slice? |
| **Options** | **(A)** Defer escalation matrix (event + notify + ack only) · **(B)** Single escalation target + timer from governed config · **(C)** Full multi-level chain (requires CRIT-02 closure) |
| **Recommendation** | **(A)** if CRIT-02 unfinished; **(B)** only with explicit PO values — **do not invent minutes** |
| **Forbidden** | Hard-coding 5/10/15/30 minutes without PO/config |

### PD-CRT-09 — Notification channels (first slice)

| Field | Content |
|---|---|
| **Status** | **OPEN** / **RECOMMENDED** |
| **Question** | Which channels are in L-CRT-01 first slice? |
| **Options** | **(A)** In-app via NotificationHub/orchestration only · **(B)** In-app + SMS · **(C)** In-app + SMS + email · **(D)** Full multi-channel day-1 |
| **Recommendation** | **(A)** first; expand channels after delivery/retry policy closed |
| **Architecture** | Lab emits intent; providers are infrastructure (PD-LAB-COM-01) |

### PD-CRT-10 — Permissions

| Field | Content |
|---|---|
| **Status** | **OPEN** / **DECISION REQUIRED** |
| **Question** | What permission codes govern Critical Results? |
| **Options** | **(A)** New family e.g. `lms.results.critical.view` / `.manage` / `.acknowledge` / `.configure` · **(B)** Reuse `lms.testing.*` / `lms.results.authorize` · **(C)** Single `lms.results.critical` |
| **Recommendation** | **(A)** least-privilege split; catalog seed only; **no production role grants** in first implement |
| **Forbidden** | Silent role grants; deciding names without PO |

### PD-CRT-11 — Duplicate / repeat policy

| Field | Content |
|---|---|
| **Status** | **OPEN** / **RECOMMENDED** |
| **Question** | How many critical events/notifications per Result/Version? |
| **Options** | **(A)** One open event per ResultVersion; notify deduped by event id · **(B)** One event per Result · **(C)** New event on each classification attempt · **(D)** New event when value/version changes to/from critical |
| **Recommendation** | **(A)** + **(D)** for amendments future; align INT-01 dedupe |
| **Forbidden** | Unbounded duplicate clinician spam |

### PD-CRT-12 — Reporting / release interaction

| Field | Content |
|---|---|
| **Status** | **OPEN** / **DECISION REQUIRED** |
| **Question** | Does unacknowledged critical block future Reporting/Final/Release? |
| **Options** | **(A)** Yes — hard gate · **(B)** Soft warning only · **(C)** Independent · **(D)** Defer decision until Reporting slice |
| **Recommendation** | **(D)** for L-CRT-01 implementation boundary, with recorded intent preference **(A)** for later Reporting PO gate |
| **Forbidden** | Implementing Final/Released inside L-CRT-01 |

### PD-CRT-13 — Patient visibility

| Field | Content |
|---|---|
| **Status** | **OPEN** / **RECOMMENDED** |
| **Question** | Are patients notified of / shown critical alerts in first slice? |
| **Options** | **(A)** Out of scope · **(B)** Patient portal badge · **(C)** Patient SMS |
| **Recommendation** | **(A)** |
| **Forbidden** | Silent patient disclosure without PO |

### PD-CRT-14 — Abnormal vs critical scope

| Field | Content |
|---|---|
| **Status** | **OPEN** / **RECOMMENDED** |
| **Question** | Does L-CRT-01 implement abnormal flag calculation? |
| **Options** | **(A)** Critical event workflow only; abnormal deferred · **(B)** Combined abnormal+critical engine · **(C)** Persist manual flags without calc |
| **Recommendation** | **(A)** (or **(C)** if PO wants persist-only) |
| **Forbidden** | Treating reference intervals as critical thresholds |

### PD-CRT-15 — Configuration ownership

| Field | Content |
|---|---|
| **Status** | **OPEN** / **DECISION REQUIRED** |
| **Question** | What becomes the Critical Rule SoT when automation is desired? |
| **Options** | **(A)** New LMS critical-rule tables versioned with catalogue · **(B)** Resolve opaque `CriticalThresholdConfigRef` to external masters · **(C)** MasterValue-based rules · **(D)** Manual-only forever |
| **Recommendation** | Close ownership before Option B automation; first slice may proceed with PD-CRT-01 **(A)** without masters |

### PD-CRT-16 — Failure / outage behavior

| Field | Content |
|---|---|
| **Status** | **OPEN** / **DECISION REQUIRED** |
| **Question** | What happens when notify/ack infrastructure fails? |
| **Options** | **(A)** Fail-closed mutation (event state not advanced as “sent/acked”) · **(B)** Queue for retry with explicit failed status · **(C)** Best-effort silent |
| **Recommendation** | **(A)** + **(B)**; forbid **(C)** |
| **Forbidden** | Inventing retry counts/backoff without PO; treating SMS failure as closed |

### PD-CRT-17 — Analytics

| Field | Content |
|---|---|
| **Status** | **OPEN** / **RECOMMENDED** |
| **Question** | Are Critical analytics/KPIs in first slice? |
| **Options** | **(A)** Out of scope · **(B)** Unresolved critical event count only · **(C)** Full time-to-ack suite |
| **Recommendation** | **(A)** |
| **Forbidden** | Fake overview counts |

### PD-CRT-18 — Amendment boundary (future)

| Field | Content |
|---|---|
| **Status** | **OPEN** / **RECOMMENDED** |
| **Question** | How do amendments interact with critical events? |
| **Options** | **(A)** Historical events immutable; new version may open new event · **(B)** Mutate prior event · **(C)** Defer detail to L-AMD with **(A)** as intent |
| **Recommendation** | **(C)** with intent **(A)** |
| **Forbidden** | Implementing Amendments in L-CRT-01 |

---

## 6. Architecture decisions (NOT APPROVED)

| ID | Topic | Recommendation (not approved) | Status |
|---|---|---|---|
| **AD-CRT-01** | Domain ownership | LaboratoryApi owns Critical event SoT | **RECOMMENDED** |
| **AD-CRT-02** | Aggregate | New Result-centric Critical event entity (not Pathology LabReport) | **RECOMMENDED** |
| **AD-CRT-03** | Comms boundary | Lab emits intents; NotificationService delivers | **RECOMMENDED** |
| **AD-CRT-04** | Ack path | Ack only via LaboratoryApi | **RECOMMENDED** (aligns NOTIF-01) |
| **AD-CRT-05** | Audit resource | Distinct critical event resource + new allowlisted actions at implement | **RECOMMENDED** |
| **AD-CRT-06** | UI surface | Real queue bound to events; flip capability when implemented — no mock rows | **RECOMMENDED** |
| **AD-CRT-07** | Pathology | Remain **RED** SoT | **RECOMMENDED** |
| **AD-CRT-08** | Upstream mutation ban | No OrderTest/Specimen/Collection/Receiving/Barcode mutation | **RECOMMENDED** |
| **AD-CRT-09** | Idempotency | Dedicated ops for create/notify/ack/escalate | **RECOMMENDED** |
| **AD-CRT-10** | No Critical ResultStatus in first slice | Keep Critical orthogonal to ResultStatus | **RECOMMENDED** |

---

## 7. Recommended first-slice scope (NOT APPROVED)

### IN SCOPE (if PO accepts Option CR-A / PD-CRT-01 A or C)

- Critical Result **event** model bound to Result + ResultVersion  
- Governed **manual** critical classification (authorized role)  
- Critical staff work queue (real events, not mocks)  
- In-app notification **intent** emission via platform orchestration  
- Acknowledgement via Laboratory API with evidence fields per PD-CRT-07  
- Platform audit actions (allowlist at implementation time)  
- Permission catalog entries (no production role grants)  
- Idempotency / concurrency patterns aligned with Result domain  
- Automated tests for event/ack/boundary honesty  

### OUT OF SCOPE (default)

- Automated threshold evaluation without governed configuration  
- Invented timers / recipient hierarchies  
- Final / Released / Published / PDF / patient communication  
- Full multi-level escalation matrix (unless CRIT-02 closed)  
- Abnormal flag calculation engine  
- Amendments / Instrument / Runs / QC / Autoverification  
- Referral / Billing / Pathology migration  
- Production role grants  
- Changes to L-COL / L-TST / L-VER / L-AUTH certified transitions  
- New Critical `ResultStatus` replacing ClinicallyAuthorized  
- Analytics KPI suite / fake counts  

### Explicitly preserved

```text
Draft → TechnicalVerified → ClinicallyAuthorized
```

---

## 8. Implementation boundaries (after future closure only)

When (and only when) a Decision Closure stamps approval:

1. Implement only approved PD-CRT / AD-CRT choices.  
2. Do not expand into Reporting/Amendments/Instrument.  
3. Do not invent thresholds/timers/recipients not stamped.  
4. Do not grant production roles.  
5. Do not treat Pathology as SoT.  
6. Do not mutate upstream Collection/Specimen/Receiving/Barcode/OrderTest lifecycles.  
7. Automated tests + Pre-UAT + Manual UAT required before Acceptance.  

**This package does not authorize implementation.**

---

## 9. UAT considerations (future — not executed now)

| Scenario | Intent |
|---|---|
| Classify critical (manual) on eligible ResultVersion | Event created; audit written |
| Duplicate classify / double-click | Idempotent; no duplicate open event |
| Acknowledge with evidence | Event advances; unauthorized user blocked |
| Notification failure | UI/API does not show false “closed/sent” success |
| Authorize still works per PD-CRT-03 choice | No accidental Auth breakage |
| ClinicallyAuthorized ≠ Final/Released/patient-visible | Honesty copy preserved |
| Placeholder Critical route replaced only when real | No mock rows |
| Android / desktop staff UI | Match prior Auth UAT quality bar when UI in scope |
| SMS-alone never closes | If SMS later enabled, ack still required via Lab API |

---

## 10. Residual CRIT-02 alignment

This package **re-surfaces** (does not silently close) historical **PD-LAB-CRIT-02**:

| CRIT-02 item | Handling in L-CRT-01 first slice |
|---|---|
| Thresholds | Block auto-detect unless config + PD-CRT-01 B |
| Recipients | Required for multi-recipient notify/escalate — PD-CRT-06/08/09 |
| Escalation timers | PD-CRT-08 — no invented minutes |
| Ack SLA | PD-CRT-07/08 |

PO may close a **subset** for first slice and leave the remainder FUTURE.

---

## 11. Risks if PO skips decisions

| Skip | Risk |
|---|---|
| Detection mode | False safety from hard-coded cutoffs |
| Event vs status | Corrupts Auth/Reporting lifecycle |
| Ack authority | Wrong actor closes safety event |
| Escalation timers invented | Alert fatigue / legal exposure |
| Channel hard-wire | Violates PD-LAB-COM-01 |
| Pathology reuse | Wrong clinical SoT |
| Fake queue/KPI | UAT/honesty failure |

---

## 12. Product Owner decision gate

**Required PO actions:**

1. Review discovery audit + this package.  
2. Decide PD-CRT-01 … PD-CRT-18 (or explicitly defer numbered items with FUTURE label).  
3. Decide AD-CRT-01 … AD-CRT-10.  
4. Stamp a separate **Decision Closure** document.  
5. Only then authorize implementation.

**Recommended closure outcomes (examples — not stamped):**

- First slice = manual CriticalResultEvent + in-app notify + Lab API ack  
- Automated thresholds = CONFIGURATION_REQUIRED / FUTURE  
- Escalation timers = FUTURE unless PO supplies governed values  
- Reporting gate = FUTURE Reporting decision  
- Auth remains independent for first slice unless PO chooses otherwise  

---

## 13. Hard stop

```text
DISCOVERY_COMPLETE_READY_FOR_PRODUCT_OWNER_DECISION
       ↓
PRODUCT OWNER DECISION  ← YOU ARE HERE (package only)
       ↓
DECISION CLOSURE
       ↓
AUTHORIZED IMPLEMENTATION
```

**Do not:**

- implement L-CRT-01  
- modify `LmsResult` / add Critical entities/status  
- add notification/ack/escalation APIs  
- add thresholds or configuration masters  
- seed permissions / grant roles / change audit allowlists  
- modify L-AUTH-01 / L-VER-01 / L-TST-01A / Collection slices  
- start Reporting / Final / Release / Amendments / Instrument / Referral / Billing  

**No Product Owner approval is claimed by this document.**

---

## 14. Files

| File | Role |
|---|---|
| [enterprise-lms-critical-results-discovery-audit.md](./enterprise-lms-critical-results-discovery-audit.md) | Evidence audit |
| `enterprise-lms-critical-results-decision-package.md` | This decision-preparation artifact |

**Package status:** READY FOR PRODUCT OWNER REVIEW — **NOT APPROVED**
