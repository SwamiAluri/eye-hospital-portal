import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Patient360CommunicationView } from '@/components/patients/record/Patient360Communication';
import { Patient360SectionNav } from '@/components/patients/record/Patient360SectionNav';

describe('patient 360 communication presentation', () => {
  it('renders Care communication rows with source status and channel text', () => {
    const html = renderToStaticMarkup(
      <>
        <Patient360SectionNav active="care" onSelect={() => undefined} />
        <Patient360CommunicationView
          result={{
            state: 'ready',
            rows: [
              {
                id: 'c1',
                channel: 'sms',
                direction: 'outbound',
                subject: 'Appointment reminder',
                status: 'delivered',
                sender: 'Front desk',
                recipient: '9990001111',
                when: '2026-09-20 09:00',
                preview: 'Your visit is tomorrow.',
                message: 'Your visit is tomorrow.',
              },
            ],
          }}
        />
      </>,
    );

    expect(html).toContain('>Care<');
    expect(html).toContain('>Communication<');
    expect(html).toContain('>Channel<');
    expect(html).toContain('sms');
    expect(html).toContain('outbound');
    expect(html).toContain('>Status<');
    expect(html).toContain('delivered');
    expect(html).toContain('Your visit is tomorrow.');
    expect(html).toContain('<table');
    expect(html.match(/role="tab"/g)).toHaveLength(7);
    expect(html).not.toMatch(/Send message|Resend|No history|No communications recorded/i);
  });

  it('uses a no-data sentence only after a successful empty read', () => {
    const empty = renderToStaticMarkup(
      <Patient360CommunicationView result={{ state: 'ready', rows: [] }} />,
    );
    const denied = renderToStaticMarkup(
      <Patient360CommunicationView result={{ state: 'unauthorized', rows: [] }} />,
    );
    expect(empty).toContain('No communications recorded.');
    expect(denied).toContain('Communications are not available to this sign-in.');
    expect(denied).not.toContain('No communications recorded.');
  });
});
