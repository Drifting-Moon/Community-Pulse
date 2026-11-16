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
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
      '/volunteers': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
      '/dispatch': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
      '/ingest': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
      '/ingest-audio': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
      '/chat': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
      '/admin/auth': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
})
