/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // OphthalmoCare auth pages (MD3) — scoped via oc-* classes
        oc: {
          primary: '#00478d',
          'primary-container': '#005eb8',
          'on-primary-container': '#c8daff',
          'on-primary': '#ffffff',
          secondary: '#00658d',
          'on-secondary': '#ffffff',
          tertiary: '#244879',
          background: '#f8f9ff',
          'on-background': '#0b1c30',
          surface: '#f8f9ff',
          'surface-container-low': '#eff4ff',
          'surface-container': '#e5eeff',
          'on-surface': '#0b1c30',
          'on-surface-variant': '#424752',
          outline: '#727783',
          'outline-variant': '#c2c6d4',
          error: '#ba1a1a',
          'error-container': '#ffdad6',
        },
        // Navy blue — sidebar and structural UI
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
        // Emerald green — accent, actions, success
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
        // Status colors for alerts, badges, notifications
        status: {
          critical: '#ef4444',
          warning: '#f59e0b',
          info:     '#3b82f6',
          success:  '#10b981',
        },
        /** shadcn semantic tokens — use inside `.counselling-session` (vars aliased in theme CSS) */
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        border: 'hsl(var(--border) / <alpha-value>)',
        input: 'hsl(var(--input) / <alpha-value>)',
        ring: 'hsl(var(--ring) / <alpha-value>)',
        muted: {
          DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
          foreground: 'hsl(var(--muted-foreground) / <alpha-value>)',
        },
        card: {
          DEFAULT: 'hsl(var(--card) / <alpha-value>)',
          foreground: 'hsl(var(--card-foreground) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
          foreground: 'hsl(var(--accent-foreground) / <alpha-value>)',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive) / <alpha-value>)',
          foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)',
        },
        /** Scoped counselling session semantics — use inside `.counselling-session` */
        counselling: {
          background: 'hsl(var(--counselling-background) / <alpha-value>)',
          foreground: 'hsl(var(--counselling-foreground) / <alpha-value>)',
          border: 'hsl(var(--counselling-border) / <alpha-value>)',
          input: 'hsl(var(--counselling-input) / <alpha-value>)',
          ring: 'hsl(var(--counselling-ring) / <alpha-value>)',
          primary: {
            DEFAULT: 'hsl(var(--counselling-primary) / <alpha-value>)',
            foreground: 'hsl(var(--counselling-primary-foreground) / <alpha-value>)',
          },
          muted: {
            DEFAULT: 'hsl(var(--counselling-muted) / <alpha-value>)',
            foreground: 'hsl(var(--counselling-muted-foreground) / <alpha-value>)',
          },
          card: {
            DEFAULT: 'hsl(var(--counselling-card) / <alpha-value>)',
            foreground: 'hsl(var(--counselling-card-foreground) / <alpha-value>)',
          },
          accent: {
            DEFAULT: 'hsl(var(--counselling-accent) / <alpha-value>)',
            foreground: 'hsl(var(--counselling-accent-foreground) / <alpha-value>)',
          },
          destructive: {
            DEFAULT: 'hsl(var(--counselling-destructive) / <alpha-value>)',
            foreground: 'hsl(var(--counselling-destructive-foreground) / <alpha-value>)',
          },
        },
      },
      fontFamily: {
        sans:    ['var(--font-inter)', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        heading: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        mono:    ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
      },
      spacing: {
        '128': '32rem',
        '144': '36rem',
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'card-hover': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
      },
    },
    screens: {
      'sm': '640px',   // Mobile landscape, tablet portrait
      'md': '768px',   // Tablet landscape
      'lg': '1024px',  // Desktop
      'xl': '1280px',  // Large desktop
      '2xl': '1536px', // Extra large desktop
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
