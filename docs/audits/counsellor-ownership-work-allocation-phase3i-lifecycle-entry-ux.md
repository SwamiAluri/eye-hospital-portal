# Phase 3I — Lifecycle Entry UX (Waiting List CTAs + Ownership Gate + Read-Only)

| Field | Value |
|-------|--------|
| **Date** | 2026-09-16 |
| **Slice** | Phase 3I Lifecycle Entry UX (bounded; **not** Slice 4) |
| **Status** | **IMPLEMENTED** — automated tests green — ready for manual UAT |

---

## Statement

Lifecycle entry actions (Assign / Open / View / Continue / Re-evaluate / Start Repeat) are owner-aware on the Waiting List. Assign eligibility extends to **Done + NULL** and **RepeatCounselling + NULL** (server-derived). Other-owner sessions are **View + FE read-only** only — no Assign-to-me / Reassign. Re-evaluate Auth sync remains deferred.

**FE ownership read-only is UX enforcement only; backend owner ACL remains deferred to Slice 4.**

---

## Locked product decisions (implemented)

| Decision | Implementation |
|----------|----------------|
| A — Other counsellor owner | View only; no Assign; workspace read-only; no Re-eval / Start Repeat |
| NULL Assign extension | Pending \| Done \| Repeat + NULL only (not Processed) |
| Re-evaluate Auth sync | **Not implemented** — known deferred issue |

---

## Lifecycle CTA matrix (implemented)

| State | Owner | Grid CTA |
|-------|-------|----------|
| Pending | NULL | Assign |
| Pending | Current | Open |
| Pending | Other | View |
| Processed | Current | Continue |
| Processed | Other / NULL | View |
| Done | Current | Re-evaluate |
| Done | NULL | Assign |
| Done | Other | View |
| Repeat | Current | Start Repeat |
| Repeat | NULL | Assign |
| Repeat | Other | View |
| AddOn / SurgeryDone | Any | View |
| OtReturned / PreAuth | — | Preserved |

---

## Known deferred issues

1. **Re-evaluate Auth synchronization** — Azure/FE only; Auth queue may still project Done after refresh  
2. **Reassign (Slice 6)** — other-owner ownership transfer  
3. **Backend owner ACL (Slice 4)**  
4. **Requeue → CounselorId NULL (Slice 8)**  

---

## Manual UAT checklist

1. Counsellor + Pending + NULL → Assign  
2. Counsellor + Pending + NULL row click → Assign dialog directly (no toast)  
3. Counsellor + Pending + self → Open  
4. Counsellor + Pending + peer → View  
5. Counsellor + Done + self → Re-evaluate  
6. Counsellor + Done + NULL → Assign then Re-evaluate  
7. Counsellor + Done + peer → View / read-only  
8. Counsellor + Repeat + self → Start Repeat  
9. Counsellor + Repeat + NULL → Assign then Start Repeat  
10. Counsellor + Repeat + peer → View / read-only  
11. Processed + current → Continue  
12. Processed + peer → View / read-only  
13. Admin + Pending + NULL → Assign counsellor  
14. Admin does not get Assign to me unless independently counsellor  
15. Same-branch counsellor picker  
16. Current counsellor excluded from peer list  
17. Assigned rows show no Assign  
18. Other-owner rows cannot be reassigned  
19. Non-owner workspace mutation controls are read-only  
20. Owner workspace remains operational (workflow rules)  
21. SurgeryDone remains read-only  
22. OT Returned behavior preserved  
23. PreAuth behavior preserved  
24. Waiting List remains shared after assignment  

**STOP** — do not start Slice 4 until manual UAT is explicitly approved.
