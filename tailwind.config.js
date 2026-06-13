/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 임시 컬러 토큰 — 디자인 시안 도착 후 교체
        primary: '#6A4FFC',
        accent: '#FFB84C',
        ink: '#0F1226',
      },
      fontFamily: {
        sans: ['Pretendard', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
