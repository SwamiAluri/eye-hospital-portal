import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

describe('cmdk CommandItem disabled styling', () => {
  it('only disables when data-disabled is true (not when false)', () => {
    const src = readFileSync(
      path.resolve(process.cwd(), 'src/components/ui/command.tsx'),
      'utf8',
    );
    expect(src).toContain('data-[disabled=true]:pointer-events-none');
    expect(src).not.toMatch(/data-\[disabled\]:pointer-events-none/);
  });
});
