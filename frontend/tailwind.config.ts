import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        nunito: ['var(--font-nunito)', 'Nunito', 'sans-serif'],
        spectral: ['var(--font-spectral)', 'Spectral', 'serif'],
      },
      colors: {
        bg: {
          DEFAULT: 'var(--bg)',
          2: 'var(--bg2)',
        },
        surface: {
          DEFAULT: 'var(--surface)',
          2: 'var(--surface-2)',
        },
        sidebar: {
          DEFAULT: 'var(--sidebar)',
          bg: 'var(--sidebar-bg)',
          hover: 'var(--sidebar-hover)',
          border: 'var(--sidebar-border)',
          text: 'var(--sidebar-text)',
          'text-muted': 'var(--sidebar-text-muted)',
          2: 'var(--sidebar2)',
          3: 'var(--sidebar3)',
          active: 'var(--sidebar-active)',
        },
        border: {
          DEFAULT: 'var(--border)',
          2: 'var(--border2)',
        },
        text: {
          DEFAULT: 'var(--text)',
          muted: 'var(--text-muted)',
          2: 'var(--text2)',
          3: 'var(--text3)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          hover: 'var(--primary-hover)',
          light: 'var(--primary-light)',
        },
        accent: 'var(--accent)',
        success: 'var(--success)',
        danger: 'var(--danger)',
      },
      borderRadius: {
        card: '13px',
        btn: '9px',
        badge: '20px',
      },
      boxShadow: {
        card: '0 1px 4px rgba(0,0,0,0.06)',
        'card-hover': '0 6px 20px rgba(0,0,0,0.07)',
        'btn-primary': '0 3px 10px rgba(142,42,58,0.2)',
        'btn-primary-hover': '0 5px 16px rgba(142,42,58,0.3)',
      },
    },
  },
  plugins: [],
}

export default config
