/**
 * Wave 5 — page composition density tokens (desktop SoT preserved).
 */
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const css = fs.readFileSync(path.join(__dirname, '../../app/globals.css'), 'utf8');

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

describe('Wave 5 page composition density tokens', () => {
  it('declares LARGE_DESKTOP page composition SoT', () => {
    const root = captureRootBlock(css);
    expectToken(root, '--page-pad', '24px');
    expectToken(root, '--page-section-gap', '24px');
    expectToken(root, '--page-header-pad-y', '16px');
    expectToken(root, '--page-header-pad-x', '24px');
    expectToken(root, '--page-content-pad', '16px');
    expectToken(root, '--kpi-pad', '20px');
    expectToken(root, '--kpi-gap', '16px');
    expectToken(root, '--toolbar-gap', '12px');
    expectToken(root, '--worklist-row-min-h', '56px');
    expectToken(root, '--worklist-row-pad-y', '10px');
    expectToken(root, '--page-title-size', '1.25rem');
    expectToken(root, '--kpi-value-size', '1.5rem');
  });

  it('declares WORKSTATION page composition overrides', () => {
    const ws = captureWorkstationBlock(css);
    expectToken(ws, '--page-pad', '12px');
    expectToken(ws, '--page-section-gap', '12px');
    expectToken(ws, '--page-header-pad-y', '10px');
    expectToken(ws, '--page-header-pad-x', '16px');
    expectToken(ws, '--page-content-pad', '12px');
    expectToken(ws, '--kpi-pad', '12px');
    expectToken(ws, '--kpi-gap', '10px');
    expectToken(ws, '--toolbar-gap', '8px');
    expectToken(ws, '--worklist-row-min-h', '48px');
    expectToken(ws, '--worklist-row-pad-y', '8px');
    expectToken(ws, '--page-title-size', '1.125rem');
    expectToken(ws, '--kpi-value-size', '1.25rem');
  });

  it('exposes staff page utility classes', () => {
    expect(css).toContain('.staff-page');
    expect(css).toContain('.staff-page-stack');
    expect(css).toContain('.staff-page-header');
    expect(css).toContain('.staff-kpi-pad');
    expect(css).toContain('.staff-worklist-row');
    expect(css).toContain('.staff-kpi-value');
    expect(css).toContain('.staff-section-mb');
  });
});
