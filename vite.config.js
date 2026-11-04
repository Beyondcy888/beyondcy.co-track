import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173, // must match the Supabase redirect URL http://localhost:5173/**
    strictPort: true,
  },
  build: {
    rolldownOptions: {
      output: {
        // libraries change rarely: separate chunks stay cached between deploys
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom)[\\/]/, priority: 3 },
            { name: 'supabase', test: /node_modules[\\/]@supabase[\\/]/, priority: 2 },
            { name: 'vendor', test: /node_modules[\\/]/, priority: 1 },
          ],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
});
