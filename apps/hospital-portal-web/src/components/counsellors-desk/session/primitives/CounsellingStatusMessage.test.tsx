import { isValidElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AlertCircle, CheckCircle2, Info, Loader2 } from 'lucide-react';

import {
  CounsellingStatusMessage,
  type CounsellingStatusTone,
} from './CounsellingStatusMessage';

const TONES: CounsellingStatusTone[] = [
  'info',
  'success',
  'warning',
  'error',
  'loading',
];

describe('CounsellingStatusMessage', () => {
  it('renders every supported tone without throwing (Icon is a valid element type)', () => {
    for (const tone of TONES) {
      expect(() =>
        renderToStaticMarkup(
          <CounsellingStatusMessage tone={tone} title={`Status: ${tone}`} />,
        ),
      ).not.toThrow();

      const html = renderToStaticMarkup(
        <CounsellingStatusMessage tone={tone} title={`Status: ${tone}`} />,
      );
      expect(html).toContain(`Status: ${tone}`);
      expect(html).toMatch(/role="(status|alert)"/);
    }
  });

  it('resolves lucide icon exports used by tone map (guards undefined import)', () => {
    for (const Icon of [Info, CheckCircle2, AlertCircle, Loader2]) {
      // lucide-react icons are forwardRef objects (typeof "object"), never undefined
      expect(Icon).toBeTruthy();
      expect(Icon).not.toBeTypeOf('undefined');
      expect(() => renderToStaticMarkup(<Icon aria-hidden />)).not.toThrow();
      expect(isValidElement(<Icon aria-hidden />)).toBe(true);
    }
  });

  it('renders description and action slots', () => {
    const html = renderToStaticMarkup(
      <CounsellingStatusMessage
        tone="error"
        title="Could not load counsellors."
        description="Network error"
        action={<button type="button">Retry</button>}
      />,
    );
    expect(html).toContain('Could not load counsellors.');
    expect(html).toContain('Network error');
    expect(html).toContain('Retry');
    expect(html).toContain('role="alert"');
  });

  it('loading tone uses status role and does not use alert', () => {
    const html = renderToStaticMarkup(
      <CounsellingStatusMessage tone="loading" title="Loading counsellors…" />,
    );
    expect(html).toContain('role="status"');
    expect(html).not.toContain('role="alert"');
    expect(html).toContain('Loading counsellors…');
  });

  /**
   * Regression for Slice 6 Reassign crash: callers must not pass an unknown
   * tone such as "muted" (TONE_ICON[tone] → undefined → invalid element type).
   */
  it('throws Element type is invalid when Icon resolves to undefined (muted-tone failure mode)', () => {
    const Broken = CounsellingStatusMessage as unknown as (props: {
      tone?: string;
      title: string;
    }) => ReactElement;

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(() =>
        renderToStaticMarkup(
          <Broken tone="muted" title="Loading counsellors…" />,
        ),
      ).toThrow(/Element type is invalid|invalid.*undefined/i);
    } finally {
      errorSpy.mockRestore();
    }
  });
});
