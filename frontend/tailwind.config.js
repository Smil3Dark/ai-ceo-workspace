/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0a0a0a',
        panel: '#141417',
        edge: '#2a2a33',
        accent: '#ff2d95',
        accent2: '#007ba7',
        ok: '#34c98e',
        warn: '#f76d6d',
      },
    },
  },
  plugins: [],
}
