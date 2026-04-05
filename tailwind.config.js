/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
      colors: {
        navy: {
          50:  '#eef1f8',
          100: '#d5ddf0',
          200: '#aabae0',
          300: '#7a91ce',
          400: '#4f6abb',
          500: '#3451a8',
          600: '#243a8a',
          700: '#1a2c6e',
          800: '#111f52',
          900: '#0c1539',
          950: '#070d24',
        },
        amber: {
          400: '#fbbf24',
          500: '#f59e0b',
        }
      },
    },
  },
  plugins: [],
}
