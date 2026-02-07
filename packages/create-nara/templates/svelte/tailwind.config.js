/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./resources/**/*.{svelte,html,js,ts}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter var', 'Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        serif: ['Playfair Display', 'Georgia', 'Cambria', 'Times New Roman', 'Times', 'serif'],
      },
      colors: {
        // Primary brand color (Emerald/Green - main theme)
        primary: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
          950: '#022c22',
        },
        // Secondary accent color (Amber/Gold)
        secondary: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
          950: '#451a03',
        },
        // Accent color (Purple - for secondary actions, users page)
        accent: {
          50: '#faf5ff',
          100: '#f3e8ff',
          200: '#e9d5ff',
          300: '#d8b4fe',
          400: '#c084fc',
          500: '#a855f7',
          600: '#9333ea',
          700: '#7c3aed',
          800: '#6b21a8',
          900: '#581c87',
          950: '#3b0764',
        },
        // Info color (Cyan - for profile, info states)
        info: {
          50: '#ecfeff',
          100: '#cffafe',
          200: '#a5f3fc',
          300: '#67e8f9',
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
          700: '#0e7490',
          800: '#155e75',
          900: '#164e63',
          950: '#083344',
        },
        // Warning color (Orange - for warnings, pending states)
        warning: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
          950: '#431407',
        },
        // Danger color (Red - for errors, delete actions)
        danger: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
          950: '#450a0a',
        },
        // Success color (alias to primary for consistency)
        success: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
          950: '#022c22',
        },
        // Surface colors for backgrounds
        surface: {
          light: '#f8f8f8',
          dark: '#0a0a0a',
          card: {
            light: '#f1f5f9',  // slate-100
            dark: '#0f0f0f',
          }
        },
      },
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: 'none',
            color: 'inherit',
            a: {
              color: 'var(--color-primary-500, #10b981)',
              '&:hover': {
                color: 'var(--color-primary-600, #059669)',
              },
            },
            h1: {
              color: 'inherit',
            },
            h2: {
              color: 'inherit',
            },
            h3: {
              color: 'inherit',
            },
            h4: {
              color: 'inherit',
            },
            'h5, h6': {
              color: 'inherit',
            },
            'ul, ol': {
              'padding-left': '1.25em',
            },
            'ul > li': {
              position: 'relative',
              'padding-left': '1.5em'
            },
            'ol > li': {
              'padding-left': '0.5em',
            },
            // Blockquote styling
            blockquote: {
              fontWeight: '400',
              fontStyle: 'italic',
              quotes: '"\\201C""\\201D""\\2018""\\2019"',
              borderLeftWidth: '0.25rem',
              borderLeftColor: '#e5e7eb',
              paddingLeft: '1em',
              marginTop: '1.6em',
              marginBottom: '1.6em',
              p: {
                marginTop: '0.8em',
                marginBottom: '0.8em',
              }
            },
            // Code block styling
            'pre, code': {
              backgroundColor: '#f3f4f6',
              borderRadius: '0.375rem',
              padding: '0.2em 0.4em',
              fontSize: '0.875em',
            },
            pre: {
              padding: '1em',
              overflowX: 'auto',
              code: {
                backgroundColor: 'transparent',
                borderWidth: '0',
                borderRadius: '0',
                padding: '0',
                fontWeight: '400',
                fontSize: 'inherit',
                color: 'inherit',
                fontFamily: 'inherit',
              },
            },
            // Table styling
            table: {
              width: '100%',
              marginTop: '2em',
              marginBottom: '2em',
              fontSize: '0.875em',
              lineHeight: '1.7142857',
              borderCollapse: 'collapse',
              'thead, tbody tr': {
                borderBottomWidth: '1px',
                borderBottomColor: '#e5e7eb',
              },
              'thead th': {
                fontWeight: '600',
                textAlign: 'left',
                paddingBottom: '0.5em',
                paddingTop: '0.5em',
                paddingLeft: '0.75em',
                paddingRight: '0.75em',
              },
              'tbody td': {
                paddingTop: '0.5em',
                paddingBottom: '0.5em',
                paddingLeft: '0.75em',
                paddingRight: '0.75em',
              },
            },
            // Horizontal rule
            hr: {
              borderColor: '#e5e7eb',
              marginTop: '3em',
              marginBottom: '3em',
            },
            // Strong and emphasis
            strong: {
              fontWeight: '600',
              color: 'inherit',
            },
            em: {
              fontStyle: 'italic',
              color: 'inherit',
            },
            // Images
            img: {
              marginTop: '2em',
              marginBottom: '2em',
              borderRadius: '0.375rem',
            },
          },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
