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
          DEFAULT: '#f7f3ee',
          2: '#f0ebe3',
        },
        surface: '#ffffff',
        sidebar: {
          DEFAULT: '#1a2e1e',
          2: '#243b29',
          active: '#3a6b44',
        },
        border: {
          DEFAULT: '#e8e0d4',
          2: '#d4c8b8',
        },
        text: {
          DEFAULT: '#1a1209',
          2: '#6b5c45',
          3: '#a89478',
        },
        primary: {
          DEFAULT: '#059669',
          dark: '#047857',
          light: '#d1fae5',
        },
      },
      borderRadius: {
        card: '13px',
        btn: '9px',
        badge: '20px',
      },
      boxShadow: {
        card: '0 1px 4px rgba(0,0,0,0.06)',
        'card-hover': '0 6px 20px rgba(0,0,0,0.07)',
        'btn-primary': '0 3px 10px rgba(5,150,105,0.2)',
        'btn-primary-hover': '0 5px 16px rgba(5,150,105,0.3)',
      },
    },
  },
  plugins: [],
}

export default config
