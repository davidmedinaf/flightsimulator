import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base so the same build works on Vercel (served from /) and on
// GitHub Pages (served from /flightsimulator/).
export default defineConfig({
  base: './',
  plugins: [react()],
});
