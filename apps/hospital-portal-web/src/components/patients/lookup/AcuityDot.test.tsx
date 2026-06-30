import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AcuityDot } from './AcuityDot';

describe('AcuityDot', () => {
  it('renders sr-only label and test id for high acuity', () => {
    const html = renderToStaticMarkup(<AcuityDot acuity="high" />);
    expect(html).toContain('patient-hub-acuity-high');
    expect(html).toContain('High acuity');
    expect(html).toContain('bg-orange-500');
  });

  it('falls back to low acuity for unknown values', () => {
    const html = renderToStaticMarkup(<AcuityDot acuity="unknown" />);
    expect(html).toContain('patient-hub-acuity-unknown');
    expect(html).toContain('Low acuity');
    expect(html).toContain('bg-gray-300');
  });

  it('shows visible label when showLabel is true', () => {
    const html = renderToStaticMarkup(<AcuityDot acuity="critical" showLabel />);
    expect(html).toContain('Critical');
    expect(html).toContain('bg-red-500');
  });
});
