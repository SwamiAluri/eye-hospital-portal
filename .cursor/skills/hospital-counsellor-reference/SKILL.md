---
name: hospital-counsellor-reference
description: Use the existing Counsellor/Counselling implementation as the Hospital Portal staff-UI quality benchmark for new or changed UI across every module; inspect only the smallest relevant reference.
---

# Counsellor UI Reference

The existing Counsellor module is the project's **reference implementation for polished staff UX**. It is not a replacement architecture and it is not the source of truth for other domains.

## Reference locations

Start with:
- `apps/hospital-portal-web/src/components/counsellors-desk`
- related counselling routes under `apps/hospital-portal-web/src/app`
- existing counselling API/hooks only when interaction behavior needs comparison

Search for one representative screen/component that is closest to the target interaction. Do not load the whole counselling module.

## What to learn from the reference

Compare:
- page/workspace hierarchy
- information density
- primary/secondary action hierarchy
- modal, sheet, drawer, and detail-pane behavior
- form layout and validation
- loading, empty, error, retry, and success feedback
- status presentation
- patient/workflow context placement
- spacing and alignment
- keyboard/focus behavior
- responsive workstation behavior
- concise healthcare-oriented copy
- polished finish and consistency

## What NOT to copy

Do not copy counselling-specific:
- business rules
- session/recording concepts
- permissions
- API contracts
- domain statuses
- patient workflow assumptions
- counselling-only colors/themes

The target domain's SoT, permissions, terminology, domain kit, and scoped visual system remain authoritative.

## Rule

For every staff UI/design change, ask:

> “Would this screen look and behave like a first-class Hospital Portal module at the same quality bar as Counsellor?”

If not, improve it using existing target-domain primitives before introducing anything new.
