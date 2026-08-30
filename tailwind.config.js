/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        marine: {
          DEFAULT: '#1E3A8A',
          50: '#EBF0FC',
          100: '#D2DEF7',
          400: '#3B5FC0',
          600: '#1E3A8A',
          700: '#172C68',
          900: '#0F1C42',
        },
        emeraude: {
          DEFAULT: '#047857',
          50: '#E7F6F1',
          100: '#C3EADE',
          400: '#0E9A72',
          600: '#047857',
          700: '#035C43',
        },
        or: {
          DEFAULT: '#B45309',
          50: '#FDF3E7',
          100: '#FAE1C2',
          400: '#D97A1F',
          600: '#B45309',
          700: '#8A3F07',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
