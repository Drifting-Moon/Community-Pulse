import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), VitePWA({ registerType: 'autoUpdate' })],
  server: {
    host: true,
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/needs': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/volunteers': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/dispatch': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/ingest': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/ingest-audio': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/chat': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
