/**
 * Ward Pre-Op Workspace v2 — Step ⑦ Pre-OT Nursing Preparation (Option B).
 *
 * The bedside step is the single home for the *true* bedside nursing acts only.
 * The former "WHO sign-in / readiness" mirror rows were removed — those facts are
 * owned by their source steps (Investigations/Consent/PAC/Vitals/Financial),
 * surfaced once by the readiness rail, and verified at the point of care by the OT
 * Surgical Safety Checklist (Form 1). Keeping them here was triple duplication.
 *
 * Shared by `BedsideSafetyPanel` (rendering) and `preop-readiness` (the bedside
 * count) so the panel and the step rail always agree on the same item set.
 */
export interface BedsideNurseItemMeta {
  key: string;
  label: string;
}

/** True nurse bedside acts stored in the ward checklist (Form 2). */
export const BEDSIDE_NURSE_WARD_ITEMS: BedsideNurseItemMeta[] = [
  { key: 'ward_check_in_time', label: 'Patient check-in recorded' },
  { key: 'preop_medication_given', label: 'Pre-op medication given' },
  { key: 'ward_dilatation_done', label: 'Dilatation done' },
  { key: 'preop_slit_lamp_done', label: 'Slit-lamp examination done' },
  { key: 'toric_iol_icl_marking', label: 'Toric IOL / ICL marking' },
  { key: 'informed_surgeon_anaesthesia_ot', label: 'Informed surgeon / anaesthetist / OT' },
];

/** Bedside prep re-homed from Consent (uiStep=bedside) — stored in pre-op completions. */
export const BEDSIDE_NURSE_REHOMED_ITEMS: BedsideNurseItemMeta[] = [
  { key: 'contact_lens_removed', label: 'Contact lens removed' },
  { key: 'valuables_removed', label: 'Valuables & jewellery removed' },
];

export const BEDSIDE_NURSE_WARD_KEYS = new Set(BEDSIDE_NURSE_WARD_ITEMS.map(i => i.key));
export const BEDSIDE_NURSE_REHOMED_KEYS = new Set(BEDSIDE_NURSE_REHOMED_ITEMS.map(i => i.key));
