'use client';

import { counsellingSectionIds, counsellingSessionTokens } from '@/lib/counsellors-desk/counselling-session-tokens';
import { counsellingCopy } from '@/lib/counsellors-desk/counselling-copy';
import {
  CounsellingBadge,
  CounsellingCard,
  CounsellingCardContent,
  CounsellingCardHeader,
  CounsellingCardTitle,
} from '@/components/counsellors-desk/session/primitives';
import {
  CounsellingInvestigationsWorkspace,
  type CounsellingInvestigationsWorkspaceProps,
} from '@/components/counsellors-desk/session/CounsellingInvestigationsWorkspace';

export type CounsellingInvestigationsCardProps = Omit<
  CounsellingInvestigationsWorkspaceProps,
  'embedded'
>;

export function CounsellingInvestigationsCard(props: CounsellingInvestigationsCardProps) {
  const count = props.selectedInvestigations.size;

  return (
    <CounsellingCard
      id={counsellingSectionIds.investigations}
      className={`${counsellingSessionTokens.card} scroll-mt-24`}
    >
      <CounsellingCardHeader className={counsellingSessionTokens.cardHeader}>
        <div className="flex items-center gap-2">
          <CounsellingCardTitle className={counsellingSessionTokens.sectionTitle}>
            {counsellingCopy.investigations}
          </CounsellingCardTitle>
          <CounsellingBadge variant="outline" className="border-counselling-border text-[10px] text-counselling-muted-foreground">
            Optional
          </CounsellingBadge>
          {count > 0 && (
            <CounsellingBadge className="bg-counselling-accent text-[10px] text-counselling-primary hover:bg-counselling-accent">
              {count}
            </CounsellingBadge>
          )}
        </div>
      </CounsellingCardHeader>
      <CounsellingCardContent className={counsellingSessionTokens.cardBody}>
        <CounsellingInvestigationsWorkspace embedded {...props} />
      </CounsellingCardContent>
    </CounsellingCard>
  );
}
