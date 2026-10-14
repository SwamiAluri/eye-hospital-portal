# Enterprise LMS Catalogue State Machine (L-CAT-01B)

## States

| Status | Editable definition? | Notes |
|---|---|---|
| Draft | Yes | Create / update draft only |
| Review | No (definition) | Awaiting approve or return |
| Approved | No | Ready for activation |
| Active | No | Historical definition frozen |
| Retired | No | Terminal for that version |
| Superseded | No | Replaced by newer version |

There is **no** formal `Rejected` state.

## Transitions

```text
Draft ──submit-review (manage)──► Review
Review ──approve (approve)──────► Approved
Review ──return-draft (manage|approve)──► Draft
Approved ──activate (approve)───► Active
Active ──retire (manage)────────► Retired
Active ──supersede (manage)─────► Superseded (+ new Draft v+1)
```

## Forbidden transitions (server-enforced)

- Draft → Active
- Draft → Approved
- Review → Active
- Active → Draft
- Arbitrary status assignment via HTTP body

## Return to Draft (decision)

PRD/UX mentions Reject/Return. Without a Rejected state, **Review → Draft** is implemented as `return-draft` with optional reason. This is revision, not a new terminal status.

## Activation side effect

If another version of the same item is still Active when a newer Approved version is activated, the prior Active version is marked **Superseded** and audited (`SUPERSEDE`), then the new version is activated (`ACTIVATE`).

## Capability matrix

| Transition | Permission |
|---|---|
| Create / update draft | `lms.catalogue.manage` |
| Submit review | `lms.catalogue.manage` |
| Return to draft | `lms.catalogue.manage` **or** `lms.catalogue.approve` |
| Approve | `lms.catalogue.approve` |
| Activate | `lms.catalogue.approve` |
| Retire | `lms.catalogue.manage` |
| Supersede | `lms.catalogue.manage` |

Role holders for these capabilities remain unresolved (PD-CAT-02).
