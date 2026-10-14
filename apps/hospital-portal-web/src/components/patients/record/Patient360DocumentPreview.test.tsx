import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('patient 360 document preview', () => {
  it('opens a centered Dialog with image zoom/pan controls and no Sheet', () => {
    const source = readFileSync(resolve(__dirname, 'Patient360DocumentPreview.tsx'), 'utf8');
    expect(source).toContain("from '@/components/ui/dialog'");
    expect(source).toContain('Document Preview');
    expect(source).toContain('size="4xl"');
    expect(source).toContain('Patient360ImageViewport');
    expect(source).toContain('Zoom in');
    expect(source).toContain('Zoom out');
    expect(source).toContain('Fit to screen');
    expect(source).toContain('onWheel');
    expect(source).toContain('onPointerDown');
    expect(source).toContain('cursor-grab');
    expect(source).toContain('runPatient360DocumentPrint');
    expect(source).toContain('Print document');
    expect(source).toContain('Download document');
    expect(source).not.toContain("from '@/components/ui/sheet'");
    expect(source).not.toContain('window.open(');
    expect(source).not.toContain('Allow pop-ups');
  });
});
