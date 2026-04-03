import type { Config } from 'tailwindcss'

export default {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './pages/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Modern dark trooper palette: graphite base, ice-blue accents, steel neutrals
        brand: {
          50: '#f1f6ff',
          100: '#dbe7ff',
          200: '#b8d1ff',
          300: '#8fb5ff',
          400: '#6494ff',
          500: '#3f76ff',
          600: '#2a60e6',
          700: '#234dbe',
          800: '#1f4396',
          900: '#1c3a78',
        },
        accent: {
          50: '#f8fafc',
          100: '#eef2f7',
          200: '#d7dde6',
          300: '#b2bccb',
          400: '#8b97a9',
          500: '#6b778b',
          600: '#556074',
          700: '#414a5a',
          800: '#2e3441',
          900: '#1e232c',
        },
        gunmetal: '#1b1f2b',
        dark: '#050409',
      },
      boxShadow: {
        'soft': '0 35px 65px -25px rgba(0,0,0,0.65)'
      }
    },
  },
  plugins: [],
} satisfies Config
