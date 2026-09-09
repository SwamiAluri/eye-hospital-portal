import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AnesthetistSelect } from '@/components/counsellors-desk/AnesthetistSelect';
import type { AnesthetistOption } from '@/lib/counsellors-desk/anesthetist-name-match';

const staff: AnesthetistOption[] = [
  { id: '1', name: 'Dr. Priya Nair', employeeId: 'AN-200', jobTitle: 'Anaesthetist' },
];

describe('AnesthetistSelect', () => {
  it('shows manual name field only in other mode', () => {
    const listHtml = renderToStaticMarkup(
      <AnesthetistSelect
        staff={staff}
        mode="list"
        selectedStaffId="1"
        anesthetistName="Dr. Priya Nair"
        onSelectStaff={() => undefined}
        onSelectOther={() => undefined}
        onManualNameChange={() => undefined}
      />,
    );
    expect(listHtml).not.toContain('data-testid="anesthetist-manual-name"');

    const otherHtml = renderToStaticMarkup(
      <AnesthetistSelect
        staff={staff}
        mode="other"
        selectedStaffId={null}
        anesthetistName="Visiting"
        onSelectStaff={() => undefined}
        onSelectOther={() => undefined}
        onManualNameChange={() => undefined}
      />,
    );
    expect(otherHtml).toContain('data-testid="anesthetist-manual-name"');
    expect(otherHtml).toContain('Other / Not listed');
  });

  it('shows duplicate warning when other name matches staff', () => {
    const html = renderToStaticMarkup(
      <AnesthetistSelect
        staff={staff}
        mode="other"
        selectedStaffId={null}
        anesthetistName="dr. priya nair"
        onSelectStaff={vi.fn()}
        onSelectOther={vi.fn()}
        onManualNameChange={vi.fn()}
      />,
    );
    expect(html).toContain('anesthetist-duplicate-warning');
    expect(html).toContain('already exists');
    expect(html).toContain('Select existing');
    expect(html).toContain('AN-200');
  });

  it('renders loading and error states', () => {
    expect(
      renderToStaticMarkup(
        <AnesthetistSelect
          staff={[]}
          mode="list"
          selectedStaffId={null}
          anesthetistName=""
          loading
          onSelectStaff={vi.fn()}
          onSelectOther={vi.fn()}
          onManualNameChange={vi.fn()}
        />,
      ),
    ).toContain('Loading anaesthetists');

    expect(
      renderToStaticMarkup(
        <AnesthetistSelect
          staff={[]}
          mode="list"
          selectedStaffId={null}
          anesthetistName=""
          error="Unable to load anaesthetists."
          onRetry={vi.fn()}
          onSelectStaff={vi.fn()}
          onSelectOther={vi.fn()}
          onManualNameChange={vi.fn()}
        />,
      ),
    ).toContain('Unable to load anaesthetists');
  });
});
