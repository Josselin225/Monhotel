/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fdf6ee',
          100: '#faebd6',
          200: '#f4d4a5',
          300: '#edb96a',
          400: '#e59a3c',
          500: '#d97d1e',
          600: '#c46115',
          700: '#a34a14',
          800: '#833b17',
          900: '#6b3216',
          950: '#3a1808',
        },
        hotel: {
          dark: '#1a1208',
          gold: '#c9973a',
          cream: '#fdf6ee',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Playfair Display', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
