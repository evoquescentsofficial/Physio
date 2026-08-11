/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#dbe7fe',
          200: '#bfd6fe',
          300: '#93bafc',
          400: '#5f97f8',
          500: '#3b76f0',
          600: '#2559e4',
          700: '#1d45c9',
          800: '#1e3aa3',
          900: '#1c3380',
          950: '#0f1c4d',
        },
        ink: {
          50: '#f4f6fb',
          100: '#e7eaf3',
          200: '#cbd2e3',
          300: '#9fabc9',
          400: '#6c7ba7',
          500: '#4c5c8a',
          600: '#3a4670',
          700: '#2e3859',
          800: '#1f2742',
          900: '#141a30',
          950: '#0a0e1f',
        },
      },
      boxShadow: {
        soft: '0 1px 2px 0 rgba(15, 28, 77, 0.06), 0 1px 3px 0 rgba(15, 28, 77, 0.08)',
        card: '0 4px 16px -4px rgba(15, 28, 77, 0.12), 0 2px 6px -2px rgba(15, 28, 77, 0.08)',
      },
    },
  },
  plugins: [],
};
