import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PatientHubClassificationTabs } from './PatientHubClassificationTabs';

describe('PatientHubClassificationTabs Slice B.1A', () => {
  it('shows only All and Active primary tabs mapped to all/current', () => {
    const html = renderToStaticMarkup(
      <PatientHubClassificationTabs
        activeTab="current"
        tabCounts={{ all: 277, current: 183, new: 21, discharged: 0, high_priority: 1 }}
        onTabChange={() => undefined}
      />,
    );
    expect(html).toContain('>All<');
    expect(html).toContain('>Active<');
    expect(html).toContain('277');
    expect(html).toContain('183');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('patient-hub-tab-current');
    expect(html).toContain('patient-hub-tab-all');
    expect(html).not.toContain('>Current<');
    expect(html).not.toContain('>New<');
    expect(html).not.toContain('>Discharged<');
    expect(html).not.toContain('>High priority<');
    expect(html).not.toContain('KPI');
    // Counts for hidden tabs must not appear as primary nav chrome
    expect(html).not.toContain('>21<');
  });

  it('keeps All selected when activeTab is all', () => {
    const html = renderToStaticMarkup(
      <PatientHubClassificationTabs
        activeTab="all"
        tabCounts={{ all: 10, current: 4 }}
        onTabChange={() => undefined}
      />,
    );
    expect(html).toContain('data-testid="patient-hub-tab-all"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('aria-selected="false"');
  });
});
