/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'cnc-cyan': '#06b6d4',
        'cnc-blue': '#3b82f6',
        'cnc-dark': '#0f1117',
        'cnc-surface': '#1a1d27',
        'cnc-border': '#2a2d3a',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
}
