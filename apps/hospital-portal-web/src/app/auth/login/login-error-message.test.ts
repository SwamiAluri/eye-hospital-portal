import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('login error message (Lab UAT)', () => {
  it('does not append Create Admin User hint for Invalid credentials', () => {
    const src = readFileSync(join(__dirname, 'page.tsx'), 'utf8');
    expect(src).toContain("!lower.includes('invalid credentials')");
    expect(src).toContain('Database may be empty');
  });
});
