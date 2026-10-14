---
name: hospital-task-routing
description: Classify Hospital Portal work into FAST, CONTROLLED, or HEAVY execution and select only the smallest sufficient workflow; use at the start of implementation tasks in this repository.
---

# Hospital Task Routing

The goal is maximum implementation speed **without reducing safety or correctness**.

## Classification

### FAST
Choose when the request is localized and the architecture/workflow already exists:
- styling, spacing, typography, copy, icons
- existing component behavior
- small accessibility fixes
- existing API wiring
- one or a few directly related files
- small bug with an obvious existing flow

FAST does not require brainstorming, a written plan, subagents, worktrees, or a mandatory TDD red/green cycle. It still requires targeted inspection and verification.

### CONTROLLED
Choose when there is meaningful implementation design but no architectural change:
- multi-file feature inside one domain
- new component composed from existing primitives
- API/client additions that preserve existing contracts
- meaningful state/workflow changes within one domain
- multiple tests or browser checks

Use a short plan and the smallest relevant implementation/test skills.

### HEAVY
Choose when the task affects:
- architecture or service boundaries
- DB schema or migrations
- API contracts used by multiple consumers
- multiple domains/services
- clinical or financial state transitions
- authorization/security model
- destructive operations
- major redesign or migration

Use the full applicable Superpowers process and approval gates.

## Speed rules

1. Never search the entire repository unless targeted search cannot answer the question.
2. Never open large files speculatively.
3. Start from the route/component/API named by the task.
4. Search existing consumers/usages before creating abstractions.
5. For UI work, inspect one relevant Counsellor implementation as the quality benchmark, not the whole module.
6. Reuse existing APIs, hooks, stores, primitives, domain kits, permissions, and realtime patterns.
7. Stop once acceptance criteria and proportional verification are satisfied.

## Escalation

If implementation reveals hidden cross-domain, security, clinical, financial, schema, or contract complexity, stop the FAST/CONTROLLED path, reclassify upward, and apply the heavier workflow.
