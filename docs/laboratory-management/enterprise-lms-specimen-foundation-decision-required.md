# L-COL-01C — DECISION_REQUIRED — Complete Collection authorization binding

**Date:** 2026-10-10  
**Status:** **RESOLVED** — see [enterprise-lms-specimen-foundation-authorization-decision.md](./enterprise-lms-specimen-foundation-authorization-decision.md) (`PRODUCT_DECISION_APPROVED_L_COL_01C_AUTHORIZATION`)  
**Slice:** L-COL-01C Specimen Foundation + Complete Collection  
**Authoritative closure:** [enterprise-lms-specimen-receiving-decision-closure.md](./enterprise-lms-specimen-receiving-decision-closure.md)  
**Audit:** [enterprise-lms-specimen-foundation-implementation-audit.md](./enterprise-lms-specimen-foundation-implementation-audit.md)

---

## 1. Why implementation stopped

Task absolute stop conditions require stopping without implementing when:

> authorization semantics cannot be derived without inventing a rule

L-COL-01C cannot implement the Complete Collection mutation gate without inventing a Product Owner rule that is **not** contained in the approved closure.

---

## 2. What is already APPROVED (not in dispute)

From PD-COL-SPC-16 / §9 IN SCOPE:

| Item | Status |
|---|---|
| Permission **definitions** | `lms.specimens.view` · `lms.specimens.manage` · `lms.specimens.receive` |
| Role grants | **Forbidden** in this slice unless separately approved |
| Existing collection codes | `lms.collection.view\|manage\|collect` — **must not be modified** |
| Complete Collection business effect | Additive Specimen create (Collected) from eligible Completed CollectionTask |

---

## 3. Ambiguity (exact)

The approved closure **defines** specimen permission codes but does **not** state which code(s) authorize:

1. **Complete Collection** (mutation that creates Specimen)
2. **Specimen detail / read** (read-only view)
3. Whether Complete Collection also requires any `lms.collection.*` capability (e.g. `lms.collection.collect`) in addition to a specimen code

Existing L-COL-01B patterns bind each Collection mutation to an explicit code (or OR of two codes) in `CollectionFunctions` + `LaboratoryAuthz`. That pattern requires an unambiguous target code for Complete Collection — which the closure does not supply.

Analogy to other LMS areas is **insufficient** as product authority:

| Domain | Mutation codes | Why analogy fails for Specimens |
|---|---|---|
| Orders | `create` vs `manage` vs `view` | Specimens has `manage` + `receive`, no `create`/`collect` |
| Collection | `manage` vs `collect` vs `view` | Complete Collection is Specimen-birth, not a CollectionTask transition |
| Specimens (approved defs) | `view` / `manage` / `receive` | `receive` is Receiving (deferred); `manage` is not bound to Complete Collection in the closure |

Inventing any of the following would be a new product rule:

| Candidate (NOT approved) | Risk |
|---|---|
| A. `lms.specimens.manage` alone gates Complete Collection | Plausible but **not stated** |
| B. `lms.collection.collect` alone gates Complete Collection | Reuses collection code; ignores why `specimens.manage` exists |
| C. `lms.specimens.manage` **and** `lms.collection.collect` | Dual-gate; **not stated** |
| D. `lms.specimens.manage` **or** `lms.collection.collect` | OR-gate; **not stated** |
| E. `lms.specimens.receive` gates Complete Collection | Conflicts with Receiving-deferred meaning of `receive` |

---

## 4. Decision requested from Product Owner

Please approve **exactly one** binding for L-COL-01C implementation (definitions-only seeding remains; **no role grants**):

### Q1 — Complete Collection mutation gate

Which permission check must pass on the LaboratoryApi Complete Collection endpoint?

Reply with one of:

- **A** — `lms.specimens.manage` only  
- **B** — `lms.collection.collect` only  
- **C** — both `lms.specimens.manage` **and** `lms.collection.collect`  
- **D** — either `lms.specimens.manage` **or** `lms.collection.collect`  
- **E** — other (specify exact codes and AND/OR semantics)

### Q2 — Specimen read / detail gate

Which permission check must pass on Specimen detail (and any minimal list required by UI)?

Reply with one of:

- **V1** — `lms.specimens.view` only  
- **V2** — `lms.specimens.view` **or** `lms.specimens.manage`  
- **V3** — `lms.specimens.view` **or** `lms.collection.view`  
- **V4** — other (specify)

### Q3 — UI action visibility

Should the Complete Collection button visibility match the **same** permission(s) as Q1 (recommended: yes), or a different FE rule?

Reply: **Same as Q1** / **Different** (specify).

---

## 5. Constraints that remain fixed after the decision

- Do **not** modify `lms.collection.*` definition semantics  
- Do **not** seed role grants in L-COL-01C  
- Do **not** use `lms.specimens.receive` for Complete Collection unless Product Owner explicitly redefines Receiving boundary (not recommended; conflicts with deferred Receiving)  
- CollectionTask lifecycle / ownership remain unchanged  
- Complete Collection remains additive (does not transition CollectionTask)

---

## 6. Resume condition

When Product Owner answers Q1–Q3 in writing (this file or a successor closure addendum), L-COL-01C implementation may resume from the completed audit without re-opening unrelated product decisions.

**Until then: no schema, API, UI, permission seed, audit allowlist, or test implementation for L-COL-01C.**
