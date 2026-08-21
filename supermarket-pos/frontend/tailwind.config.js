/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#F7F6F2',
        ink: '#1B1D1B',
        ledger: {
          50: '#EAF2EF',
          100: '#CFE3DB',
          200: '#9FC7B7',
          300: '#6FA491',
          400: '#3D7F6C',
          500: '#1F5D4C',
          600: '#194A3D',
          700: '#123A30',
          800: '#0D2B24',
        },
        brass: {
          50: '#FBF3E3',
          100: '#F5E6C8',
          300: '#DDB768',
          500: '#C08A2E',
          600: '#9C6E22',
        },
        brick: {
          50: '#FBEBE9',
          500: '#B3403A',
          600: '#8F332E',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['"IBM Plex Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
    },
  },
  plugins: [],
};
