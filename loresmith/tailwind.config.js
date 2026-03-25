/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary)',
        'primary-hover': 'var(--color-primary-hover)',
        secondary: 'var(--color-secondary)',
        accent: 'var(--color-accent)',
        bg: 'var(--color-bg)',
        'bg-panel': 'var(--color-bg-panel)',
        'bg-sidebar': 'var(--color-bg-sidebar)',
        border: 'var(--color-border)',
        'text-base': 'var(--color-text)',
        'text-muted': 'var(--color-text-muted)',
        'entity-mark': 'var(--color-entity-mark)',
      },
      fontFamily: {
        prose: ['var(--font-prose)', 'Georgia', 'serif'],
        ui: ['var(--font-ui)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
