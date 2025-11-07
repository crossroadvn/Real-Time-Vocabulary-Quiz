import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// AI-ASSISTED: Base Vite config generated via AI template; adjusted for env vars manually.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/socket.io': {
        target: process.env.VITE_REALTIME_URL ?? 'http://localhost:4000',
        ws: true,
      },
    },
  },
});

