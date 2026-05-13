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
        // MakerWorks suite control-panel palette: charcoal shell, green operations accent
        brand: {
          50: '#e9fbf0',
          100: '#c9f5d9',
          200: '#96eab6',
          300: '#5fda8f',
          400: '#34cb70',
          500: '#20c465',
          600: '#159a4c',
          700: '#11783c',
          800: '#115f32',
          900: '#104e2d',
        },
        accent: {
          50: '#f3f5f7',
          100: '#c7ccd3',
          200: '#9aa0aa',
          300: '#757b86',
          400: '#5c606c',
          500: '#50525c',
          600: '#444852',
          700: '#343741',
          800: '#2b2d33',
          900: '#1f2026',
        },
        gunmetal: '#2b2d33',
        dark: '#1f2026',
      },
      boxShadow: {
        'soft': '0 35px 65px -25px rgba(0,0,0,0.65)'
      }
    },
  },
  plugins: [],
} satisfies Config
