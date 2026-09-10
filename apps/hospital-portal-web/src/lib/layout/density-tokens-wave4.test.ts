/**
 * Wave 4 — Card / table / opt-in control density token SoT.
 */
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { controlDensityFieldClass, controlDensityButtonClass } from './control-density';

const globalsPath = path.join(__dirname, '../../app/globals.css');
const css = fs.readFileSync(globalsPath, 'utf8');

function captureRootBlock(source: string): string {
  const fromRoot = source.indexOf(':root');
  const open = source.indexOf('{', fromRoot);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}') {
      depth--;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  throw new Error('unclosed :root');
}

function captureWorkstationBlock(source: string): string {
  const mq = source.match(
    /@media\s*\(\s*max-width:\s*1599\.98px\s*\)\s*\{[\s\S]*?:root\s*\{([\s\S]*?)\}/,
  );
  expect(mq).toBeTruthy();
  return mq![1];
}

function expectToken(block: string, name: string, value: string) {
  const re = new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*${value}`);
  expect(block, `${name} = ${value}`).toMatch(re);
}

describe('Wave 4 density tokens (globals.css)', () => {
  it('declares Card/table/control tokens at LARGE_DESKTOP SoT', () => {
    const root = captureRootBlock(css);
    expectToken(root, '--widget-pad', '24px');
    expectToken(root, '--table-header-height', '48px');
    expectToken(root, '--table-cell-pad', '16px');
    // Default control height stays 40; workstation opt-in token starts at 40 on desktop
    expectToken(root, '--control-height-workstation', '40px');
    expectToken(root, '--control-pad-x-workstation', '16px');
    expectToken(root, '--control-height-compact', '36px');
  });

  it('declares WORKSTATION overrides for Card/table and opt-in control height', () => {
    const ws = captureWorkstationBlock(css);
    expectToken(ws, '--widget-pad', '16px');
    expectToken(ws, '--table-header-height', '40px');
    expectToken(ws, '--table-cell-pad', '12px');
    expectToken(ws, '--control-height-workstation', '36px');
    expectToken(ws, '--control-pad-x-workstation', '12px');
    // Compact constant available; default Button/Input still not auto-bound
    expectToken(ws, '--control-height-compact', '36px');
  });
});

describe('opt-in control density helpers', () => {
  it('returns undefined for default density (no silent shrink)', () => {
    expect(controlDensityFieldClass('default')).toBeUndefined();
    expect(controlDensityFieldClass(undefined)).toBeUndefined();
    expect(controlDensityButtonClass('default', 'md')).toBeUndefined();
  });

  it('returns workstation classes only when density=workstation', () => {
    expect(controlDensityFieldClass('workstation')).toContain('--control-height-workstation');
    expect(controlDensityButtonClass('workstation', 'md')).toContain('--control-height-workstation');
    expect(controlDensityButtonClass('workstation', 'sm')).toBeUndefined();
    expect(controlDensityButtonClass('workstation', 'lg')).toBeUndefined();
  });
});
