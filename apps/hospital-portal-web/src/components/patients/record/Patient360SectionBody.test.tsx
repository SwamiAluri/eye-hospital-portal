import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Patient360SectionBody } from '@/components/patients/record/Patient360SectionBody';
import { Patient360SectionNav } from '@/components/patients/record/Patient360SectionNav';

describe('patient 360 shell presentation', () => {
  it('renders seven sections with accessible tab semantics', () => {
    const html = renderToStaticMarkup(
      <>
        <Patient360SectionNav active="care" onSelect={() => undefined} />
        <Patient360SectionBody section="care" />
      </>,
    );

    expect(html).toContain('aria-label="Patient record"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('>Care<');
    expect(html).not.toContain('Care is not available in Patient 360.');
    expect(html).not.toMatch(/Coming Soon|No documents|No history|No counselling|No bills/i);
    for (const label of ['Overview', 'Clinical', 'Documents', 'Coverage', 'Administration', 'Timeline']) {
      expect(html).toContain(`>${label}<`);
    }
  });

  it('does not use the section body as the overview content', () => {
    const html = renderToStaticMarkup(<Patient360SectionBody section="overview" />);
    expect(html).toBe('');
  });
});
