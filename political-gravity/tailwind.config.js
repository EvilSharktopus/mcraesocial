/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Syne', 'system-ui', 'sans-serif'],
        sans:    ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        pg: {
          bg:        'var(--pg-bg)',
          surface:   'var(--pg-surface)',
          surface2:  'var(--pg-surface2)',
          border:    'var(--pg-border)',
          border2:   'var(--pg-border2)',
          text:      'var(--pg-text)',
          muted:     'var(--pg-muted)',
          dim:       'var(--pg-dim)',
          faint:     'var(--pg-faint)',
          primary:   'var(--pg-primary)',
          'primary-hover': 'var(--pg-primary-hover)',
          'on-primary':    'var(--pg-on-primary)',
        },
      },
      keyframes: {
        'settle-pulse': {
          '0%':   { boxShadow: '0 0 0 8px var(--pg-primary-ring)' },
          '100%': { boxShadow: '0 0 0 0px var(--pg-primary-ring)' },
        },
        'end-bump': {
          '0%, 100%': { transform: 'translateX(-50%) translateY(-50%) scale(1)' },
          '40%':      { transform: 'translateX(-50%) translateY(-50%) scale(0.85)' },
          '70%':      { transform: 'translateX(-50%) translateY(-50%) scale(1.05)' },
        },
      },
      animation: {
        'settle-pulse': 'settle-pulse 0.6s ease-out forwards',
        'end-bump':     'end-bump 0.25s ease-out',
      },
    },
  },
  plugins: [],
}
