module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        'bg': '#151719',
        white: '#F2EFE8',
        zinc: {
          50: '#fafaf9',
          100: '#F2EFE8',
          200: '#dedbd4',
          300: '#c7c4bd',
          400: '#A3A39D',
          500: '#8b8c88',
          600: '#737672',
          700: '#45494B',
          800: '#34383C',
          900: '#202326',
          950: '#151719',
        },
      }
    },
  },
  plugins: [],
}
