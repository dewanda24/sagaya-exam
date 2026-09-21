/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Core Design Tokens
        primary: {
          50: 'var(--color-primary-50, #eff6ff)',
          100: 'var(--color-primary-100, #dbeafe)',
          200: 'var(--color-primary-200, #bfdbfe)',
          300: 'var(--color-primary-300, #93c5fd)',
          400: 'var(--color-primary-400, #60a5fa)',
          500: 'var(--color-primary-500, #3b82f6)',
          600: 'var(--color-primary-600, #2563eb)',
          700: 'var(--color-primary-700, #1d4ed8)',
          800: 'var(--color-primary-800, #1e40af)',
          900: 'var(--color-primary-900, #1e3a8a)',
          DEFAULT: 'var(--color-primary, #2563eb)',
          foreground: 'var(--color-primary-foreground, #ffffff)',
        },
        secondary: {
          DEFAULT: 'var(--color-secondary, #f1f5f9)',
          foreground: 'var(--color-secondary-foreground, #0f172a)',
        },
        background: 'var(--color-background, #f8fafc)',
        surface: {
          DEFAULT: 'var(--color-surface, #ffffff)',
          elevated: 'var(--color-surface-elevated, #ffffff)',
          subtle: 'var(--color-surface-subtle, #f8fafc)',
        },
        text: {
          primary: 'var(--color-text-primary, #0f172a)',
          secondary: 'var(--color-text-secondary, #475569)',
          muted: 'var(--color-text-muted, #64748b)',
          inverse: 'var(--color-text-inverse, #ffffff)',
        },
        border: {
          DEFAULT: 'var(--color-border, #e2e8f0)',
          hover: 'var(--color-border-hover, #cbd5e1)',
          focus: 'var(--color-border-focus, #3b82f6)',
        },
        divider: 'var(--color-divider, #f1f5f9)',
        success: {
          bg: 'var(--color-success-bg, #ecfdf5)',
          border: 'var(--color-success-border, #a7f3d0)',
          text: 'var(--color-success-text, #047857)',
          DEFAULT: 'var(--color-success, #10b981)',
          foreground: 'var(--color-success-foreground, #ffffff)',
        },
        warning: {
          bg: 'var(--color-warning-bg, #fffbeb)',
          border: 'var(--color-warning-border, #fde68a)',
          text: 'var(--color-warning-text, #b45309)',
          DEFAULT: 'var(--color-warning, #f59e0b)',
          foreground: 'var(--color-warning-foreground, #ffffff)',
        },
        danger: {
          bg: 'var(--color-danger-bg, #fef2f2)',
          border: 'var(--color-danger-border, #fecaca)',
          text: 'var(--color-danger-text, #b91c1c)',
          DEFAULT: 'var(--color-danger, #ef4444)',
          foreground: 'var(--color-danger-foreground, #ffffff)',
        },
        info: {
          bg: 'var(--color-info-bg, #eff6ff)',
          border: 'var(--color-info-border, #bfdbfe)',
          text: 'var(--color-info-text, #1d4ed8)',
          DEFAULT: 'var(--color-info, #3b82f6)',
          foreground: 'var(--color-info-foreground, #ffffff)',
        },
        disabled: {
          DEFAULT: 'var(--color-disabled, #e2e8f0)',
          text: 'var(--color-disabled-text, #94a3b8)',
        },
      },
      fontFamily: {
        sans: ['var(--font-plus-jakarta)', 'Plus Jakarta Sans', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        sm: 'var(--radius-sm, 6px)',
        md: 'var(--radius-md, 10px)',
        lg: 'var(--radius-lg, 14px)',
        full: 'var(--radius-full, 9999px)',
      },
      boxShadow: {
        subtle: 'var(--shadow-subtle, 0 1px 2px 0 rgba(0, 0, 0, 0.05))',
        sm: 'var(--shadow-sm, 0 1px 3px 0 rgba(0, 0, 0, 0.07), 0 1px 2px -1px rgba(0, 0, 0, 0.07))',
        md: 'var(--shadow-md, 0 4px 6px -1px rgba(0, 0, 0, 0.07), 0 2px 4px -2px rgba(0, 0, 0, 0.07))',
        elevated: 'var(--shadow-elevated, 0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.08))',
      },
      minHeight: {
        touch: '44px',
      },
      minWidth: {
        touch: '44px',
      },
    },
  },
  plugins: [],
};
