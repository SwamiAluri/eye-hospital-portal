import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Patient360CareJourneys } from '@/components/patients/record/Patient360Care';
import { Patient360TimelineView } from '@/components/patients/record/Patient360Timeline';

describe('patient 360 care presentation', () => {
  it('shows visit and appointment context without counsellor operational actions', () => {
    const html = renderToStaticMarkup(
      <Patient360CareJourneys
        patientId="p1"
        counselling={{ state: 'ready', rows: [] }}
        bundle={{
          appointments: {
            state: 'ready',
            rows: [{ id: 'a1', title: 'Review', detail: null, provider: 'Dr Sen', status: 'Scheduled', when: '2026-10-01 09:00' }],
          },
          visits: {
            state: 'ready',
            rows: [{
              id: 'v1',
              title: 'OPD',
              status: 'completed',
              when: '2026-09-28 10:00',
              provider: 'Dr Sen',
              station: 'Optometry',
              checkInTime: '2026-09-28 10:00',
              encounterHref: '/dashboard/patients/p1/encounter/v1',
            }],
          },
          consents: { state: 'ready', rows: [] },
        }}
      />,
    );
    expect(html).toContain('Visits &amp; encounters');
    expect(html).toContain('Appointments');
    expect(html).toContain('Open Counselling');
    expect(html).toContain('Open encounter');
    expect(html).toContain('Scheduled');
    expect(html).not.toMatch(/Assign|ReQueue|Start session/i);
  });
});

describe('patient 360 timeline presentation', () => {
  it('renders source-labeled events in the supplied order', () => {
    const html = renderToStaticMarkup(
      <Patient360TimelineView
        result={{
          state: 'ready',
          sourcesUnavailable: [],
          events: [
            {
              id: 'e1',
              at: '2026-09-02 09:00',
              sortAt: 2,
              type: 'Visit',
              description: 'OPD · completed',
              source: 'Front desk',
              actor: null,
              href: '/dashboard/patients/p1/encounter/v1',
            },
          ],
        }}
      />,
    );
    expect(html).toContain('>Timeline<');
    expect(html).toContain('Front desk');
    expect(html).toContain('>Source<');
    expect(html).toContain('OPD · completed');
    expect(html).toContain('Open related record');
    expect(html).toContain('02 Sep 2026 09:00');
    expect(html).not.toMatch(/Coming Soon|sample event|fake/i);
  });

  it('hides midnight on date-only events and keeps supplied order', () => {
    const html = renderToStaticMarkup(
      <Patient360TimelineView
        result={{
          state: 'ready',
          sourcesUnavailable: [],
          events: [
            {
              id: 'later',
              at: '2026-02-05 00:00',
              sortAt: 2,
              type: 'Note',
              description: 'Later note',
              source: 'Clinical',
              actor: null,
              href: null,
            },
            {
              id: 'earlier',
              at: '2026-02-04T00:00:00',
              sortAt: 1,
              type: 'Visit',
              description: 'Earlier visit',
              source: 'Front desk',
              actor: null,
              href: null,
            },
          ],
        }}
      />,
    );
    expect(html).toContain('05 Feb 2026');
    expect(html).toContain('04 Feb 2026');
    expect(html).not.toContain('00:00');
    expect(html.indexOf('Later note')).toBeLessThan(html.indexOf('Earlier visit'));
  });

  it('stays honest when no source is ready', () => {
    const html = renderToStaticMarkup(
      <Patient360TimelineView result={{ state: 'unavailable', events: [], sourcesUnavailable: ['Visits'] }} />,
    );
    expect(html).toContain('Timeline is not available in Patient 360.');
  });
});
