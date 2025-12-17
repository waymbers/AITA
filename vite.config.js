// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // This tells Vite to proxy all requests starting with /api
      '/api': {
        // To your backend server URL
        target: 'https://aita-ixi9.onrender.com',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})