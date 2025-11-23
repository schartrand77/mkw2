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
        // Dark Side palette: deep black, crimson, gunmetal, desaturated steel
        brand: {
          50: '#fff1f2',
          100: '#ffe4e6',
          200: '#fecdd3',
          300: '#fda4af',
          400: '#fb7185',
          500: '#f43f5e',
          600: '#e11d48',
          700: '#be123c',
          800: '#9f1239',
          900: '#881337',
        },
        accent: {
          50: '#f7f7fb',
          100: '#ededf5',
          200: '#dcdceb',
          300: '#b7b8d1',
          400: '#8e8fae',
          500: '#6c6d8c',
          600: '#565872',
          700: '#45465b',
          800: '#2f2f3f',
          900: '#1e1e28',
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
