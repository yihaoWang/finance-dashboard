import type { Config } from 'tailwindcss';
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { 950: '#0a0a0b', 900: '#111113', 800: '#1a1a1d', 700: '#26262a' },
        accent: { DEFAULT: '#7c5cff', soft: '#a78bfa' },
        up: '#ef4444',
        down: '#10b981',
      },
    },
  },
  plugins: [],
} satisfies Config;
