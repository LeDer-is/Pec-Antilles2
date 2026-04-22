/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        base: '#0B1120',
        raised: '#111827',
        surface: '#1F2937',
        emerald: '#10B981',
        amber: '#F59E0B',
        rose: '#EF4444',
        indigo: '#6366F1',
        sky: '#38BDF8',
      },
    },
  },
  plugins: [],
}
