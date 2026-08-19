import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#00A63E', // primary green: Login/Send buttons, active labels
          hover: '#029139',
          soft: '#E7F7EE', // active nav pill + "Login with Google" background
          softHover: '#DCF2E4',
        },
        ink: {
          DEFAULT: '#1A1A1A', // primary text
          muted: '#6B7280', // secondary text / preview copy
          faint: '#9CA3AF', // placeholders, icons
        },
        line: {
          DEFAULT: '#E9EAEC', // card + row borders
          soft: '#F2F3F5',
        },
        field: '#F5F6F7', // login inputs, compose body area
        chipOrange: {
          bg: '#FFF3E6',
          text: '#D9822B',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(16, 24, 40, 0.04), 0 1px 3px rgba(16, 24, 40, 0.06)',
        pop: '0 8px 24px rgba(16, 24, 40, 0.12)',
      },
    },
  },
  plugins: [],
};

export default config;
