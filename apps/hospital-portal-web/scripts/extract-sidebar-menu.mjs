import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sidebarPath = path.join(__dirname, '../src/components/Sidebar.tsx');
const lines = fs.readFileSync(sidebarPath, 'utf8').split(/\r?\n/);
const menuStart = lines.findIndex((l) => l.includes('menuSectionsRef.current = ['));
const menuEnd = lines.findIndex((l, i) => i > menuStart && l.trim() === '];');
const arrayBody = lines.slice(menuStart + 1, menuEnd).join('\n');
const iconImports = lines.slice(7, 73).join('\n');
const types = lines.slice(74, 93).join('\n');
const outPath = path.join(__dirname, '../src/lib/navigation/sidebar-menu-sections.tsx');
const out = [
  "'use client';",
  '',
  "import React from 'react';",
  iconImports,
  '',
  types,
  '',
  'export const SIDEBAR_MENU_SECTIONS: MenuSection[] = [',
  arrayBody,
  '];',
  '',
  'export type { MenuItem, MenuSection };',
  '',
].join('\n');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, out);
console.log('Wrote', outPath, 'lines', out.split('\n').length);
