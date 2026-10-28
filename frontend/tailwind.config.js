/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0f1420',
        panel: '#171e2e',
        edge: '#26304a',
        accent: '#f7b84f',
        accent2: '#4f8ff7',
        ok: '#34c98e',
        warn: '#f76d6d',
      },
    },
  },
  plugins: [],
}
