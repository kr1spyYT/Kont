module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        'bg': '#09090B',
        white: '#F6F2E8',
        zinc: {
          50: '#faf8f2',
          100: '#F6F2E8',
          200: '#e7dfce',
          300: '#c9c0ae',
          400: '#a69f91',
          500: '#827c72',
          600: '#625d55',
          700: '#413d36',
          800: '#302b24',
          900: '#18171a',
          950: '#0c0c10',
        },
      }
    },
  },
  plugins: [],
}
