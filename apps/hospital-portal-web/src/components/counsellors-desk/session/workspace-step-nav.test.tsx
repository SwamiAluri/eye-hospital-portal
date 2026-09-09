import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { WorkspaceStepNav } from '@/components/counsellors-desk/session/WorkspaceStepNav';
import { counsellingTestIds } from '@/lib/counsellors-desk/counselling-session-tokens';

describe('WorkspaceStepNav (Wave 2E-2)', () => {
  it('renders waiting-list-style pill tabs', () => {
    const html = renderToStaticMarkup(
      <WorkspaceStepNav
        ariaLabel="Counselling workspace"
        data-testid={counsellingTestIds.counsellingPhaseNav}
        activeId="estimate"
        onSelect={vi.fn()}
        items={[
          { id: 'estimate', label: 'Quote', testId: 'counselling-phase-estimate' },
          { id: 'decision', label: 'Decision', testId: 'counselling-phase-decision' },
          { id: 'wrapup', label: 'Notes', testId: 'counselling-phase-wrapup' },
        ]}
      />,
    );
    expect(html).toContain('data-testid="counselling-phase-nav"');
    expect(html).toContain('aria-current="step"');
    expect(html).toContain('rounded-full');
  });

  it('marks active step with counselling primary pill', () => {
    const html = renderToStaticMarkup(
      <WorkspaceStepNav
        ariaLabel="Coverage workspace"
        activeId="policy"
        onSelect={vi.fn()}
        items={[{ id: 'policy', label: 'Policy', testId: 'coverage-step-policy' }]}
      />,
    );
    expect(html).toContain('bg-counselling-primary');
    expect(html).toContain('data-testid="coverage-step-policy"');
  });
});
