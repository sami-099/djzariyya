import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths so the app also works when served under a sub-path
  // (e.g. behind an ingress or reverse proxy).
  base: './',
  server: {
    // In development the front end runs on Vite's port and forwards API
    // calls to the Python server.
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
  test: {
    include: ['tests/**/*.test.js'],
  },
});
