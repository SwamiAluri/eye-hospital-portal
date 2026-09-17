import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('completed session Finish UX (workflow corrections)', () => {
  it('does not apply pointer-events-none / opacity grey gate on session page content', () => {
    const src = readFileSync(
      resolve(__dirname, './CounsellingSessionPageContent.tsx'),
      'utf8',
    );
    expect(src).not.toContain('pointer-events-none select-none opacity-45');
    expect(src).not.toContain("navigationBlocked={true}");
    expect(src).toContain('navigationBlocked={false}');
  });
});
