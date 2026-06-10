# Counsellor guide — estimates & handoff (Phase 15.2)

## Custom vs package

| Mode | When to use |
|------|-------------|
| **Custom** | Build line-by-line: procedure, IOL, investigations, optional quoted price override |
| **Package** | Select a pre-built bundle; procedure/IOL/investigations auto-fill |

Switch modes in the **Build estimate** card (Custom procedure | Package tabs). The **Quote** panel (right on desktop, bottom sheet on tablet) shows a read-only mode badge.

**Rules:**

- Changing **procedure** or **IOL** clears the package (toast) and switches to custom.
- Adding/removing **investigations** keeps the package.
- Doctor recommendation conflicts show a warning; you may continue or **Switch to recommended**.

## Discount

1. In Quote panel, choose **%** or **₹ Flat** (visible after estimate lines exist).
2. Enter value and **reason** (required when discount &gt; 0).
3. Cap shown live: min(tenant 50%, package cap, flat cap).

## Quoted procedure price

**Modify quoted procedure price** in Quote panel opens the override dialog. Requires reason and requester; audited in session history.

## Print / PDF handoff

1. Select procedure or package so estimate has lines.
2. **Print Estimate** → preview with hospital letterhead (SVG; PNG optional).
3. English + Telugu terms; valid **3 calendar days** (display only).
4. Download PDF or share on tablet.

## Workflow (3-phase session flow)

1. **Build Quote** — procedure or package tabs, RE/LE/Both eye, optional investigations  
2. **Patient Decision** — payment type, patient outcome, surgery schedule (when agreed)  
3. **Wrap-up** — optional notes and workflow flags; **Save Session** and **Print Estimate**

Use the **session flow** sidebar (desktop) or phase pills (tablet) to jump back to completed phases. **Next** in the footer validates the current phase before advancing.

**Save Session** validates procedure, eye, required sub-type/IOL, decision, and discount reason.

## Read-only / done / repeat

- **Done** sessions are read-only unless **Re-evaluate** or **Repeat counselling** (add-on surgery path).
- Coverage tab receives **final payable** after save for insurance workflows.

## In-flight sessions (migration)

Sessions started before the redesign retain saved data; reopen to see the new layout with the same underlying estimate state.
