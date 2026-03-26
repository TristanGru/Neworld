/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary:         'var(--color-primary)',
        'primary-hover': 'var(--color-primary-hover)',
        'primary-dim':   'var(--color-primary-dim)',
        'primary-muted': 'var(--color-primary-muted)',
        bg:              'var(--color-bg)',
        'bg-panel':      'var(--color-bg-panel)',
        'bg-sidebar':    'var(--color-bg-sidebar)',
        'bg-elevated':   'var(--color-bg-elevated)',
        'bg-input':      'var(--color-bg-input)',
        border:          'var(--color-border)',
        'border-strong': 'var(--color-border-strong)',
        'text-base':     'var(--color-text)',
        'text-muted':    'var(--color-text-muted)',
        'text-subtle':   'var(--color-text-subtle)',
        accent:          'var(--color-accent)',
        'entity-mark':   'var(--color-entity-mark)',
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        prose:   ['var(--font-prose)',   'Georgia', 'serif'],
        ui:      ['var(--font-ui)',      'system-ui', 'sans-serif'],
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },
    },
  },
  plugins: [],
}
