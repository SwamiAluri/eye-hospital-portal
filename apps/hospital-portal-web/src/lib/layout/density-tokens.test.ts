/**
 * Wave 1 — density token SoT (text contract against globals.css).
 * Desktop values must match the audited Large Desktop UI.
 */
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const globalsPath = path.join(__dirname, '../../app/globals.css');
const css = fs.readFileSync(globalsPath, 'utf8');

function captureRootBlock(source: string): string {
  expect(source.includes('/* ── Layout / responsive density'), 'density token block marker').toBe(
    true,
  );
  // First :root in the file holds LARGE_DESKTOP SoT (workstation uses a nested :root in MQ).
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
  expect(mq, 'workstation @media (max-width: 1599.98px) :root').toBeTruthy();
  return mq![1];
}

function expectToken(block: string, name: string, value: string) {
  const re = new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*${value}`);
  expect(block, `${name} = ${value}`).toMatch(re);
}

describe('responsive density tokens (globals.css)', () => {
  it('declares LARGE_DESKTOP SoT on :root matching audited UI', () => {
    const root = captureRootBlock(css);
    expectToken(root, '--shell-pad', '12px');
    expectToken(root, '--shell-gap', '12px');
    expectToken(root, '--sidebar-collapsed-width', '64px');
    expectToken(root, '--sidebar-expanded-width', '240px');
    expectToken(root, '--sidebar-logo-size', '36px');
    expectToken(root, '--sidebar-section-icon-size', '20px');
    expectToken(root, '--sidebar-icon-size', '16px');
    expectToken(root, '--sidebar-item-pad-y', '10px');
    expectToken(root, '--topnav-height', '48px');
    expectToken(root, '--topnav-pad-x', '20px');
    expectToken(root, '--topnav-gap', '16px');
    expectToken(root, '--topnav-icon-size', '24px');
    expectToken(root, '--topnav-avatar-size', '32px');
  });

  it('declares WORKSTATION overrides under max-width 1599.98px', () => {
    const ws = captureWorkstationBlock(css);
    expectToken(ws, '--shell-pad', '8px');
    expectToken(ws, '--shell-gap', '8px');
    expectToken(ws, '--sidebar-logo-size', '32px');
    expectToken(ws, '--sidebar-section-icon-size', '18px');
    expectToken(ws, '--sidebar-icon-size', '16px');
    expectToken(ws, '--sidebar-item-pad-y', '8px');
    expectToken(ws, '--topnav-height', '40px');
    expectToken(ws, '--topnav-pad-x', '16px');
    expectToken(ws, '--topnav-gap', '12px');
    expectToken(ws, '--topnav-icon-size', '20px');
    expectToken(ws, '--topnav-avatar-size', '28px');
    // Widths stay constant; collapse/expand is structural, not resized
    expectToken(ws, '--sidebar-collapsed-width', '64px');
    expectToken(ws, '--sidebar-expanded-width', '240px');
  });
});
