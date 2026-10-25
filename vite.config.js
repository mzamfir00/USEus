import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves the app from /<repo>/; set by the deploy workflow.
  base: process.env.BASE_PATH || '/',
});
