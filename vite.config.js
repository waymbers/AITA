import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // 1. Force absolute paths so Render finds your JS/CSS
  base: '/', 
  build: {
    // 2. Ensure the output folder matches your Render 'Publish Directory'
    outDir: 'dist',
    // 3. Generates a manifest to help debug asset loading if needed
    manifest: true,
  },
});