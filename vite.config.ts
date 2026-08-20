import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Star Electronics dev server.
const BACKEND_URL = process.env.VITE_BACKEND_URL || 'http://localhost:8788';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: BACKEND_URL,
        changeOrigin: true,
        secure: true,
      },
    },
  },
});
