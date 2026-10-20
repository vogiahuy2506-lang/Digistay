import type { Config } from 'tailwindcss'
import plugin from 'tailwindcss/plugin'
import { cssVar, radii, roles, themeVariables } from './src/styles/tokens'

// Role colors from src/styles/tokens.ts: `bg-panel`, `text-muted`, `border-line`,
// `bg-ok-soft text-ok`, ... Values live in CSS variables, so they follow the
// nearest `data-theme` and keep opacity modifiers (`bg-fg/5`).
const roleColors = Object.fromEntries(
  roles.map((role) => [role, `rgb(var(${cssVar(role)}) / <alpha-value>)`]),
)

const themeBase = plugin(({ addBase }) => {
  addBase({
    ':root, [data-theme="light"]': themeVariables('light'),
    '[data-theme="dark"]': themeVariables('dark'),
    ':root, [data-surface="admin"]': { '--ds-r-ctl': radii.admin.ctl, '--ds-r-box': radii.admin.box },
    '[data-surface="site"]': { '--ds-r-ctl': radii.site.ctl, '--ds-r-box': radii.site.box },
  })
})

const config: Config = {
  // Dark mode is opt-in per subtree (the dashboard), never from the OS setting:
  // pages that still use hard-coded colors must not flip half-way.
  darkMode: ['selector', '[data-theme="dark"]'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ...roleColors,

        // Primary
        'primary': '#a93119',
        'on-primary': '#ffffff',
        'primary-container': '#cb492f',
        'primary-fixed': '#ffdad3',
        'primary-fixed-dim': '#ffb4a4',
        'on-primary-fixed': '#3e0500',
        'on-primary-fixed-variant': '#8b1b05',

        // Secondary
        'secondary': '#545f73',
        'on-secondary': '#ffffff',
        'secondary-container': '#d5e0f8',
        'secondary-fixed': '#d8e3fb',
        'on-secondary-fixed': '#111c2d',
        'on-secondary-fixed-variant': '#3c475a',
        'secondary-fixed-dim': '#bcc7de',

        // Tertiary
        'tertiary': '#2a674c',
        'tertiary-container': '#448064',
        'on-tertiary': '#ffffff',
        'tertiary-fixed': '#b1f0ce',
        'tertiary-fixed-dim': '#95d4b3',
        'on-tertiary-fixed': '#002114',
        'on-tertiary-fixed-variant': '#0e5138',

        // Surface
        'surface': '#fbf9f6',
        'surface-bright': '#fbf9f6',
        'surface-container': '#efeeeb',
        'surface-container-low': '#f5f3f0',
        'surface-container-lowest': '#ffffff',
        'surface-container-high': '#eae8e5',
        'surface-container-highest': '#e4e2df',
        'surface-dim': '#dbdad7',
        'surface-variant': '#e4e2df',
        'surface-tint': '#ac331b',

        // Background
        'background': '#fbf9f6',

        // On Surface
        'on-surface': '#1b1c1a',
        'on-surface-variant': '#59413c',
        'on-background': '#1b1c1a',
        'inverse-surface': '#30312f',
        'inverse-on-surface': '#f2f0ed',
        'inverse-primary': '#ffb4a4',

        // Outline
        'outline': '#8c716b',
        'outline-variant': '#e0bfb8',

        // Error
        'error': '#ba1a1a',
        'error-container': '#ffdad6',
        'on-error': '#ffffff',
        'on-error-container': '#93000a',

        // Terracotta palette (from HTML design)
        terracotta: {
          DEFAULT: '#d95338',
          50: '#fdf6f3',
          100: '#fbe9e3',
          200: '#f8d4c9',
          300: '#f2b5a3',
          400: '#e8876e',
          500: '#d95338',
          600: '#c54127',
          700: '#a5331c',
          800: '#842c1b',
          900: '#6d271a',
        },
        // Sand palette (from HTML design)
        sand: {
          50: '#fdfbf9',
          100: '#f7f4ee',
          200: '#efe8dc',
          300: '#e2d7c5',
          400: '#cbbda6',
          500: '#a8987f',
          600: '#6d6156',
          700: '#544a40',
          800: '#433d36',
          900: '#23201d',
        },
      },
      fontFamily: {
        // Loaded with next/font in src/app/layout.tsx.
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        'display-hero': ['Plus Jakarta Sans', 'sans-serif'],
        'headline-xl': ['Plus Jakarta Sans', 'sans-serif'],
        'headline-xl-mobile': ['Plus Jakarta Sans', 'sans-serif'],
        'headline-lg': ['Plus Jakarta Sans', 'sans-serif'],
        'headline-lg-mobile': ['Plus Jakarta Sans', 'sans-serif'],
        'headline-md': ['Plus Jakarta Sans', 'sans-serif'],
        'headline-sm': ['Plus Jakarta Sans', 'sans-serif'],
        'title-md': ['Plus Jakarta Sans', 'sans-serif'],
        'body-lg': ['Plus Jakarta Sans', 'sans-serif'],
        'body-md': ['Plus Jakarta Sans', 'sans-serif'],
        'body-sm': ['Plus Jakarta Sans', 'sans-serif'],
        'label-lg': ['Plus Jakarta Sans', 'sans-serif'],
        'label-md': ['Plus Jakarta Sans', 'sans-serif'],
        'label-caps': ['Plus Jakarta Sans', 'sans-serif'],
        serif: ['var(--font-playfair)', 'Playfair Display', 'Georgia', 'serif'],
      },
      fontSize: {
        // Redesign type scale (system page 1c). Headings use font-serif on the
        // hotel website; the dashboard stays on font-sans.
        display: ['80px', { lineHeight: '88px', letterSpacing: '-0.025em' }],
        h1: ['52px', { lineHeight: '60px', letterSpacing: '-0.02em' }],
        h2: ['36px', { lineHeight: '44px' }],
        h3: ['24px', { lineHeight: '32px' }],
        lead: ['17px', { lineHeight: '28px' }],
        body: ['15px', { lineHeight: '24px' }],
        small: ['13px', { lineHeight: '20px' }],
        label: ['11px', { lineHeight: '16px', letterSpacing: '0.14em' }],

        'display-hero': ['56px', { lineHeight: '64px', letterSpacing: '-0.03em', fontWeight: '700' }],
        'display-hero-mobile': ['36px', { lineHeight: '44px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'headline-xl': ['40px', { lineHeight: '48px', letterSpacing: '-0.025em', fontWeight: '700' }],
        'headline-xl-mobile': ['28px', { lineHeight: '36px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'headline-lg': ['32px', { lineHeight: '40px', letterSpacing: '-0.02em', fontWeight: '600' }],
        'headline-lg-mobile': ['24px', { lineHeight: '32px', letterSpacing: '-0.015em', fontWeight: '600' }],
        'headline-md': ['24px', { lineHeight: '32px', letterSpacing: '-0.015em', fontWeight: '600' }],
        'headline-sm': ['20px', { lineHeight: '28px', letterSpacing: '-0.01em', fontWeight: '600' }],
        'title-md': ['16px', { lineHeight: '24px', letterSpacing: '-0.005em', fontWeight: '600' }],
        'body-lg': ['18px', { lineHeight: '28px', fontWeight: '400' }],
        'body-md': ['15px', { lineHeight: '22px', fontWeight: '400' }],
        'body-sm': ['13px', { lineHeight: '18px', fontWeight: '400' }],
        'label-lg': ['14px', { lineHeight: '20px', letterSpacing: '0.01em', fontWeight: '600' }],
        'label-md': ['12px', { lineHeight: '16px', letterSpacing: '0.02em', fontWeight: '600' }],
        'label-caps': ['11px', { lineHeight: '16px', letterSpacing: '0.06em', fontWeight: '700' }],
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        'lg': '0.5rem',
        'xl': '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
        'full': '9999px',
        // Buttons and inputs / cards and panels; values depend on data-surface.
        'ctl': 'var(--ds-r-ctl)',
        'box': 'var(--ds-r-box)',
      },
      spacing: {
        'space-xs': '0.25rem',
        'space-sm': '0.5rem',
        'space-md': '1rem',
        'space-lg': '1.5rem',
        'space-xl': '2.5rem',
        'gutter': '1.5rem',
        'gutter-sm': '1rem',
        'gutter-lg': '2rem',
        'margin': '2rem',
        'margin-sm': '1rem',
        'margin-lg': '3rem',
      },
      gap: {
        'gutter': '1.5rem',
        'gutter-sm': '1rem',
        'gutter-lg': '2rem',
      },
      padding: {
        'gutter': '1.5rem',
        'gutter-sm': '1rem',
        'gutter-lg': '2rem',
        'margin': '2rem',
        'margin-sm': '1rem',
        'margin-lg': '3rem',
      },
      boxShadow: {
        '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        'luxury': '0 24px 60px -12px rgba(24, 22, 21, 0.09), 0 4px 16px -2px rgba(24, 22, 21, 0.04)',
        'subtle': '0 1px 3px rgba(0,0,0,0.02), 0 6px 18px rgba(78, 56, 42, 0.04)',
        'card': '0 4px 20px -2px rgba(60, 42, 30, 0.05), 0 2px 6px -1px rgba(0,0,0,0.02)',
        'card-hover': '0 18px 36px -4px rgba(217, 83, 56, 0.12), 0 8px 18px -4px rgba(60, 42, 30, 0.06)',
        'glow': '0 0 25px -4px rgba(217, 83, 56, 0.35)',
        // Not `raised` / `panel`: those are color names, and `shadow-<color>`
        // would also match the shadow-color utility.
        'lift': 'var(--ds-shadow-raised)',
        'drawer': '-24px 0 48px -32px rgb(0 0 0 / 0.35)',
      },
      transitionDuration: {
        '160': '160ms',
        '250': '250ms',
      },
      transitionTimingFunction: {
        // One curve for the whole system (system page 1c, "Chuyển động").
        'ds': 'cubic-bezier(0.2, 0.7, 0.2, 1)',
      },
      animation: {
        'ping': 'ping 1s cubic-bezier(0, 0, 0.2, 1) infinite',
        'bounce': 'bounce 2s infinite',
        'pulse': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        ping: {
          '75%, 100%': { transform: 'scale(2)', opacity: '0' },
        },
        bounce: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
    },
  },
  plugins: [themeBase],
}
export default config
