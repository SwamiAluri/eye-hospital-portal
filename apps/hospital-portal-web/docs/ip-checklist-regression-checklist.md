# IP Checklist Manual Regression Checklist (Forms 1–5)

Walk each form with the role matrix below. Sign off in QA tracker.

## Form 1 — OT Surgical Safety

| Step | Role | Pass |
|------|------|------|
| Before Anaesthesia complete | OT Nurse | ☐ |
| WHO timeout sign (surgeon + nurse) | Surgeon + OT Nurse | ☐ |
| WHO supervisor override | Admin / override permission | ☐ |
| After Surgery complete | OT Nurse | ☐ |
| Billing gate on Accept in OT | Billing / Emergency FC | ☐ |

## Form 2 — Ward Checklist (P2)

| Step | Role | Pass |
|------|------|------|
| Ward items toggle | Nurse | ☐ |
| Copied P0 rows show `source=copied_from_counsellor` | Nurse | ☐ |
| `fellow_workup_done` shows completed_by_role | Nurse / Counsellor | ☐ |

## Form 3 — Ward Investigation (P1)

| Step | Role | Pass |
|------|------|------|
| Manual items (BP, consent, dilatation) | Nurse | ☐ |
| LIS webhook auto-complete | Integration (API key) | ☐ |
| Imaging webhook auto-complete | Integration (API key) | ☐ |

## Form 4 — Pre-op Medication Log

| Step | Role | Pass |
|------|------|------|
| Add drug + administer dose | Nurse | ☐ |
| SentToOT soft gate when doses missing | Nurse | ☐ |

## Form 5 — Anaesthesia Monitoring

| Step | Role | Pass |
|------|------|------|
| Pre-op review | Anaesthetist | ☐ |
| Intra-op readings | Anaesthetist | ☐ |
| "Monitoring empty" badge on End Surgery (no block) | OT Nurse | ☐ |
| Discharge clearance | Anaesthetist | ☐ |

## Journey gates

| Transition | Expected gate | Pass |
|------------|---------------|------|
| Expected → Admitted | P0/P1/P2 soft warnings | ☐ |
| Admitted → ReadyForSurgery | PAC soft warn | ☐ |
| ReadyForSurgery → SentToOT | Med-log doses warn | ☐ |
| Discharge | Anaesthesia clearance + nurse summary | ☐ |
