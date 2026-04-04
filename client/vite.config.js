import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'https://taxiweb-backend.vercel.app',
        changeOrigin: true
      },
      '/socket.io': {
        target: 'https://taxiweb-backend.vercel.app',
        changeOrigin: true,
        ws: true
      }
    }
  }
})
