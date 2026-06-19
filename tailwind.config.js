/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // SpatioEvolution Design System
        spatio: {
          bg:        'var(--color-bg)',
          surface:   'var(--color-surface)',
          border:    'var(--color-border)',
          primary:   'var(--color-primary)',
          secondary: 'var(--color-secondary)',
          accent:    'var(--color-accent)',
          danger:    'var(--color-danger)',
          success:   'var(--color-success)',
          warning:   'var(--color-warning)',
          muted:     'var(--color-muted)',
          text:      'var(--color-text)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans Thai', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'fade-in':    'fadeIn 0.3s ease-out',
        'slide-up':   'slideUp 0.4s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0' },                   to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(10px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
      backdropBlur: { xs: '2px' },
    },
  },
  plugins: [],
}
