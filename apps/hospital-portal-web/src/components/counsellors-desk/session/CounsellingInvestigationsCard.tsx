'use client';

import { counsellingSectionIds } from '@/lib/counsellors-desk/counselling-session-tokens';
import {
  CounsellingInvestigationsWorkspace,
  type CounsellingInvestigationsWorkspaceProps,
} from '@/components/counsellors-desk/session/CounsellingInvestigationsWorkspace';

export type CounsellingInvestigationsCardProps = Omit<
  CounsellingInvestigationsWorkspaceProps,
  'embedded'
>;

/** Thin wrapper — investigations render as a flat workspace section (Wave 2D-3). */
export function CounsellingInvestigationsCard(props: CounsellingInvestigationsCardProps) {
  return (
    <div id={counsellingSectionIds.investigations} className="scroll-mt-24">
      <CounsellingInvestigationsWorkspace embedded {...props} />
    </div>
  );
}
