import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#d95338',
          hover: '#c0442b',
          container: '#fbeae6',
          50: '#fef2f0',
          100: '#fbeae6',
          200: '#f5cfc4',
          300: '#eeb09e',
          400: '#e2856e',
          500: '#d95338',
          600: '#c0442b',
          700: '#a13722',
          800: '#832f1f',
          900: '#6d2b1e',
          950: '#3f1409',
        },
        secondary: '#545f73',
        tertiary: {
          DEFAULT: '#2a674c',
          light: '#448064',
          bg: '#b1f0ce',
        },
        background: '#fcfbfa',
        surface: {
          DEFAULT: '#fcfbfa',
          dim: '#f4f1ec',
          container: '#ede9e2',
          'container-high': '#e5e0d7',
          card: '#ffffff',
        },
        onSurface: '#1b1c1a',
        onSurfaceVariant: '#59413c',
        outline: '#8c716b',
        outlineVariant: '#e0bfb8',
        // Custom colors from design
        charcoal: {
          DEFAULT: '#181615',
          muted: '#625d57',
        },
        terracotta: {
          DEFAULT: '#d95338',
          hover: '#c0442b',
        },
        forest: {
          DEFAULT: '#1f5f45',
          light: '#eaf5f0',
        },
        gold: {
          DEFAULT: '#c59849',
          light: '#fdf8ee',
        },
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'sans-serif'],
        serif: ['Playfair Display', 'serif'],
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        lg: '0.5rem',
        xl: '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'luxury': '0 24px 60px -12px rgba(24, 22, 21, 0.09), 0 4px 16px -2px rgba(24, 22, 21, 0.04)',
        'glass': '0 20px 40px rgba(0, 0, 0, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.35)',
        'glow-terra': '0 8px 24px -4px rgba(217, 83, 56, 0.35)',
      },
      animation: {
        'ping': 'ping 1s cubic-bezier(0, 0, 0.2, 1) infinite',
      },
      keyframes: {
        ping: {
          '75%, 100%': {
            transform: 'scale(2)',
            opacity: '0',
          },
        },
      },
    },
  },
  plugins: [],
}
export default config
