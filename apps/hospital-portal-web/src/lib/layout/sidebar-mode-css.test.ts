/**
 * Wave 4.1 — CSS-first sidebar mode rules must exist in globals.css.
 */
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const css = fs.readFileSync(
  path.join(__dirname, '../../app/globals.css'),
  'utf8',
);

describe('Wave 4.1 CSS-first sidebar width', () => {
  it('declares auto/expanded/collapsed sidebar mode width rules', () => {
    expect(css).toMatch(
      /\[data-testid=['"]app-sidebar['"]\]\[data-sidebar-mode=['"]auto['"]\]/,
    );
    expect(css).toMatch(/@media \(min-width:\s*1600px\)/);
    expect(css).toMatch(
      /\[data-testid=['"]app-sidebar['"]\]\[data-sidebar-mode=['"]expanded['"]\]/,
    );
    expect(css).toMatch(
      /\[data-testid=['"]app-sidebar['"]\]\[data-sidebar-mode=['"]collapsed['"]\]/,
    );
    expect(css).toContain('width: var(--sidebar-collapsed-width)');
    expect(css).toContain('width: var(--sidebar-expanded-width)');
  });
});
