// Design Tokens for Hospital Portal
// JS/TS palette used by generateCSSVariables() and by some TS consumers.
// Runtime UI color is primarily Tailwind (tailwind.config.js) + domain CSS.
// generateCSSVariables() is exported but not injected at runtime (ThemeProvider
// no longer writes #theme-variables). Loaded CSS does not consume --color-* /
// --spacing-* / --radius-* / --shadow-* / --transition-* from this generator.

export const tokens = {
  // Color Palette
  colors: {
    // Navy — sidebar, structural UI
    navy: {
      50:  '#f0f4ff',
      100: '#e0e9ff',
      200: '#c0d0f5',
      300: '#94aee8',
      400: '#6488d4',
      500: '#3b63bb',
      600: '#2a4fa3',
      700: '#1e3d8a',
      800: '#162d6e',
      900: '#0f1e3c',
      950: '#080e1e',
    },
    // Primary — emerald green, actions, accent
    primary: {
      50:  '#ecfdf5',
      100: '#d1fae5',
      200: '#a7f3d0',
      300: '#6ee7b7',
      400: '#34d399',
      500: '#10b981',
      600: '#059669',
      700: '#047857',
      800: '#065f46',
      900: '#064e3b',
    },
    // Neutral - Gray scale
    neutral: {
      50: '#f9fafb',
      100: '#f3f4f6',
      200: '#e5e7eb',
      300: '#d1d5db',
      400: '#9ca3af',
      500: '#6b7280',
      600: '#4b5563',
      700: '#374151',
      800: '#1f2937',
      900: '#111827',
      950: '#030712'
    },
    // Semantic Colors
    success: {
      50: '#f0fdf4',
      100: '#dcfce7',
      200: '#bbf7d0',
      300: '#86efac',
      400: '#4ade80',
      500: '#22c55e',
      600: '#16a34a',
      700: '#15803d',
      800: '#166534',
      900: '#14532d'
    },
    warning: {
      50: '#fffbeb',
      100: '#fef3c7',
      200: '#fde68a',
      300: '#fcd34d',
      400: '#fbbf24',
      500: '#f59e0b',
      600: '#d97706',
      700: '#b45309',
      800: '#92400e',
      900: '#78350f'
    },
    error: {
      50: '#fef2f2',
      100: '#fee2e2',
      200: '#fecaca',
      300: '#fca5a5',
      400: '#f87171',
      500: '#ef4444',
      600: '#dc2626',
      700: '#b91c1c',
      800: '#991b1b',
      900: '#7f1d1d'
    },
    info: {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#3b82f6',
      600: '#2563eb',
      700: '#1d4ed8',
      800: '#1e40af',
      900: '#1e3a8a'
    }
  },

  // Typography
  typography: {
    fontFamily: {
      sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace']
    },
    fontSize: {
      xs: '0.75rem',      // 12px
      sm: '0.875rem',     // 14px
      base: '1rem',       // 16px
      lg: '1.125rem',     // 18px
      xl: '1.25rem',      // 20px
      '2xl': '1.5rem',    // 24px
      '3xl': '1.875rem',  // 30px
      '4xl': '2.25rem',   // 36px
      '5xl': '3rem'       // 48px
    },
    fontWeight: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700'
    },
    lineHeight: {
      tight: '1.25',
      normal: '1.5',
      relaxed: '1.75'
    }
  },

  // Spacing
  spacing: {
    0: '0',
    px: '1px',
    0.5: '0.125rem',   // 2px
    1: '0.25rem',      // 4px
    1.5: '0.375rem',   // 6px
    2: '0.5rem',       // 8px
    2.5: '0.625rem',   // 10px
    3: '0.75rem',      // 12px
    3.5: '0.875rem',   // 14px
    4: '1rem',         // 16px
    5: '1.25rem',      // 20px
    6: '1.5rem',       // 24px
    7: '1.75rem',      // 28px
    8: '2rem',         // 32px
    9: '2.25rem',      // 36px
    10: '2.5rem',      // 40px
    12: '3rem',        // 48px
    14: '3.5rem',      // 56px
    16: '4rem',        // 64px
    20: '5rem',        // 80px
    24: '6rem',        // 96px
    28: '7rem',        // 112px
    32: '8rem'         // 128px
  },

  // Border Radius
  borderRadius: {
    none: '0',
    sm: '0.125rem',    // 2px
    DEFAULT: '0.25rem', // 4px
    md: '0.375rem',    // 6px
    lg: '0.5rem',      // 8px
    xl: '0.75rem',     // 12px
    '2xl': '1rem',     // 16px
    '3xl': '1.5rem',   // 24px
    full: '9999px'
  },

  // Shadows
  shadows: {
    none: 'none',
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
    '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
    inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)'
  },

  // Transitions
  transitions: {
    duration: {
      fast: '150ms',
      DEFAULT: '200ms',
      slow: '300ms',
      slower: '500ms'
    },
    timing: {
      DEFAULT: 'cubic-bezier(0.4, 0, 0.2, 1)',
      linear: 'linear',
      in: 'cubic-bezier(0.4, 0, 1, 1)',
      out: 'cubic-bezier(0, 0, 0.2, 1)',
      inOut: 'cubic-bezier(0.4, 0, 0.2, 1)'
    }
  },

  // Z-Index
  zIndex: {
    auto: 'auto',
    0: '0',
    10: '10',
    20: '20',
    30: '30',
    40: '40',
    50: '50',
    dropdown: '100',
    sticky: '200',
    fixed: '300',
    modal: '400',
    popover: '500',
    tooltip: '600'
  },

  // Breakpoints
  breakpoints: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px'
  }
} as const;

// CSS Custom Properties Generator
// Not injected by ThemeProvider. dark-mode.css is the only consumer of these
// --color-* names, and that file is not imported. Kept for a future dark-mode
// project. Do not treat this output as the live design-token source of truth.
export function generateCSSVariables(theme: 'light' | 'dark' = 'light'): string {
  const isDark = theme === 'dark';
  
  return `
    :root {
      /* Primary Colors */
      --color-primary-50: ${tokens.colors.primary[50]};
      --color-primary-100: ${tokens.colors.primary[100]};
      --color-primary-200: ${tokens.colors.primary[200]};
      --color-primary-300: ${tokens.colors.primary[300]};
      --color-primary-400: ${tokens.colors.primary[400]};
      --color-primary-500: ${tokens.colors.primary[500]};
      --color-primary-600: ${tokens.colors.primary[600]};
      --color-primary-700: ${tokens.colors.primary[700]};
      --color-primary-800: ${tokens.colors.primary[800]};
      --color-primary-900: ${tokens.colors.primary[900]};

      /* Background & Surface */
      --color-bg-primary: ${isDark ? tokens.colors.neutral[900] : '#ffffff'};
      --color-bg-secondary: ${isDark ? tokens.colors.neutral[800] : tokens.colors.neutral[50]};
      --color-bg-tertiary: ${isDark ? tokens.colors.neutral[700] : tokens.colors.neutral[100]};
      --color-surface: ${isDark ? tokens.colors.neutral[800] : '#ffffff'};
      --color-surface-hover: ${isDark ? tokens.colors.neutral[700] : tokens.colors.neutral[50]};

      /* Text Colors */
      --color-text-primary: ${isDark ? tokens.colors.neutral[50] : tokens.colors.neutral[900]};
      --color-text-secondary: ${isDark ? tokens.colors.neutral[300] : tokens.colors.neutral[600]};
      --color-text-muted: ${isDark ? tokens.colors.neutral[400] : tokens.colors.neutral[500]};
      --color-text-inverted: ${isDark ? tokens.colors.neutral[900] : '#ffffff'};

      /* Border Colors */
      --color-border: ${isDark ? tokens.colors.neutral[700] : tokens.colors.neutral[200]};
      --color-border-strong: ${isDark ? tokens.colors.neutral[600] : tokens.colors.neutral[300]};
      --color-border-focus: ${tokens.colors.primary[500]};

      /* Semantic Colors */
      --color-success: ${tokens.colors.success[500]};
      --color-success-bg: ${isDark ? 'rgba(34, 197, 94, 0.1)' : tokens.colors.success[50]};
      --color-warning: ${tokens.colors.warning[500]};
      --color-warning-bg: ${isDark ? 'rgba(245, 158, 11, 0.1)' : tokens.colors.warning[50]};
      --color-error: ${tokens.colors.error[500]};
      --color-error-bg: ${isDark ? 'rgba(239, 68, 68, 0.1)' : tokens.colors.error[50]};
      --color-info: ${tokens.colors.info[500]};
      --color-info-bg: ${isDark ? 'rgba(59, 130, 246, 0.1)' : tokens.colors.info[50]};

      /* Shadows */
      --shadow-sm: ${isDark ? '0 1px 2px 0 rgb(0 0 0 / 0.3)' : tokens.shadows.sm};
      --shadow-md: ${isDark ? '0 4px 6px -1px rgb(0 0 0 / 0.4)' : tokens.shadows.md};
      --shadow-lg: ${isDark ? '0 10px 15px -3px rgb(0 0 0 / 0.5)' : tokens.shadows.lg};

      /* Spacing */
      --spacing-1: ${tokens.spacing[1]};
      --spacing-2: ${tokens.spacing[2]};
      --spacing-3: ${tokens.spacing[3]};
      --spacing-4: ${tokens.spacing[4]};
      --spacing-5: ${tokens.spacing[5]};
      --spacing-6: ${tokens.spacing[6]};
      --spacing-8: ${tokens.spacing[8]};

      /* Border Radius */
      --radius-sm: ${tokens.borderRadius.sm};
      --radius-md: ${tokens.borderRadius.md};
      --radius-lg: ${tokens.borderRadius.lg};
      --radius-xl: ${tokens.borderRadius.xl};

      /* Transitions */
      --transition-fast: ${tokens.transitions.duration.fast};
      --transition-default: ${tokens.transitions.duration.DEFAULT};
      --transition-slow: ${tokens.transitions.duration.slow};
    }
  `;
}

export type TokenColors = typeof tokens.colors;
export type TokenSpacing = typeof tokens.spacing;
export default tokens;
