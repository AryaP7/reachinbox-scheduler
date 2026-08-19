import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#0b0f19',
          card: '#111827',
          raised: '#1a2234',
          border: '#232d42',
        },
        accent: {
          DEFAULT: '#6366f1',
          hover: '#4f46e5',
          soft: '#312e81',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
