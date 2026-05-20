import type { Config } from 'tailwindcss';
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#f8fafc',
          900: '#ffffff',
          800: '#f1f5f9',
          700: '#cbd5e1',
          600: '#94a3b8',
        },
        accent: { DEFAULT: '#7c5cff', soft: '#a78bfa' },
        up: '#ef4444',
        down: '#10b981',
      },
    },
  },
  plugins: [],
} satisfies Config;
