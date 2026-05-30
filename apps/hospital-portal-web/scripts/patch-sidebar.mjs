import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sidebarPath = path.join(__dirname, '../src/components/Sidebar.tsx');
let content = fs.readFileSync(sidebarPath, 'utf8');

// Remove inline menu ref block
content = content.replace(
  /\r?\n  \/\/ Built once[\s\S]*?  const menuSections = menuSectionsRef\.current;/,
  "\n  const menuSections = SIDEBAR_MENU_SECTIONS;",
);

// Remove local MenuItem/MenuSection interfaces
content = content.replace(/\r?\ninterface MenuItem \{[\s\S]*?\}\r?\n\r?\ninterface MenuSection \{[\s\S]*?\}\r?\n/, '\n');

// Add import after logout import
if (!content.includes('SIDEBAR_MENU_SECTIONS')) {
  content = content.replace(
    "import { logoutEverywhere } from '@/lib/logout-everywhere';",
    "import { logoutEverywhere } from '@/lib/logout-everywhere';\nimport { SIDEBAR_MENU_SECTIONS } from '@/lib/navigation/sidebar-menu-sections';",
  );
}

// Remove useRef if no longer used
if (!content.includes('useRef')) {
  content = content.replace(
    "import { useState, useEffect, useRef, useMemo, memo } from 'react';",
    "import { useState, useEffect, useMemo, memo } from 'react';",
  );
}

fs.writeFileSync(sidebarPath, content);
console.log('Updated Sidebar.tsx');
