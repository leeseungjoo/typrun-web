import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/',  // 운영 배포 경로: https://typrun.com/ (루트)
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/typrain_api': {
        target: 'https://typrun.com',
        changeOrigin: true,
        secure: true,
      },
    },
  },
});
