import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    proxy: {
      '/projects': {
        target: 'http://localhost:18780',
        changeOrigin: true,
      },
      '/gaia': {
        target: 'http://localhost:18780',
        changeOrigin: true,
      },
      '/flywheel': {
        target: 'http://localhost:18780',
        changeOrigin: true,
      },
      '/live': {
        target: 'ws://localhost:18780',
        ws: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    proxy: {
      '/projects': {
        target: 'http://localhost:18780',
        changeOrigin: true,
      },
      '/gaia': {
        target: 'http://localhost:18780',
        changeOrigin: true,
      },
      '/flywheel': {
        target: 'http://localhost:18780',
        changeOrigin: true,
      },
      '/live': {
        target: 'ws://localhost:18780',
        ws: true,
      },
    },
  },
});
