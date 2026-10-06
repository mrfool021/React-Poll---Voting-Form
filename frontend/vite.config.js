import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In local development (`npm run dev`) forward /api calls to the Express API.
// In Docker the Nginx proxy container does this routing instead.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': process.env.VITE_DEV_API || 'http://localhost:3000',
    },
  },
});
