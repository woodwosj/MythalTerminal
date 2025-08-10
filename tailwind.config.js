/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/renderer/**/*.{html,js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gray: {
          900: '#1e1e1e',
          800: '#2a2a2a',
          700: '#3a3a3a',
          600: '#4a4a4a',
          500: '#5a5a5a',
          400: '#6a6a6a',
          300: '#8a8a8a',
          200: '#e0e0e0',
        }
      }
    },
  },
  plugins: [],
}