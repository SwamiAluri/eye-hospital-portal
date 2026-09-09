import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CounsellingSessionLayout } from '@/components/counsellors-desk/session/CounsellingSessionLayout';
import { CounsellingAdditionalOptionsSection } from '@/components/counsellors-desk/session/CounsellingWorkflowSections';
import { vi } from 'vitest';

describe('CounsellingSessionLayout (Wave 2E-5RR)', () => {
  it('uses left-column scroll for quote/decision by default', () => {
    const html = renderToStaticMarkup(
      <CounsellingSessionLayout workspace={<div>ws</div>} quotePanel={<div>q</div>} />,
    );
    expect(html).toContain('overflow-y-auto');
    expect(html).toContain('counselling-hidden-scroll');
  });

  it('disables left-column scroll on desktop when workspaceScroll is false (Notes)', () => {
    const html = renderToStaticMarkup(
      <CounsellingSessionLayout
        workspaceScroll={false}
        workspace={<div>ws</div>}
        quotePanel={<div>q</div>}
      />,
    );
    expect(html).toContain('lg:overflow-hidden');
    expect(html).toContain('lg:h-full');
    expect(html).toContain('max-lg:overflow-y-auto');
  });
});

describe('Additional options selection chrome (Wave 2E-5RR)', () => {
  it('uses bordered pill rows with soft green selection', () => {
    const html = renderToStaticMarkup(
      <CounsellingAdditionalOptionsSection
        embedded
        wantToSeeDoctor
        setWantToSeeDoctor={vi.fn()}
        interestedToUpgrade
        setInterestedToUpgrade={vi.fn()}
        notRequiredPreAuth={false}
        setNotRequiredPreAuth={vi.fn()}
        isReadOnly={false}
        markDirty={vi.fn()}
      />,
    );
    expect(html).toContain('bg-emerald-50');
    expect(html).toContain('rounded-lg');
    expect(html).toContain('border-counselling-border/80');
    expect(html).toContain('space-y-1.5');
    expect(html).toContain('font-medium');
    expect(html).not.toContain('border-l-4');
    expect(html).not.toContain('border-l-counselling-primary');
    expect(html).not.toContain('ring-inset');
    expect(html).not.toContain('focus-ring');
  });
});
