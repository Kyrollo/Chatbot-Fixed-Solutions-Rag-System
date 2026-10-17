// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const BACKEND_URL = process.env.VITE_BACKEND_URL || 'http://localhost:8012'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3012,
    host: true,
    proxy: {
      '/domains': BACKEND_URL,
      '/monitoring': BACKEND_URL,
      '/ingest': BACKEND_URL,
      '/retrieve': BACKEND_URL,
      '/generate': BACKEND_URL,
      '/query': BACKEND_URL,
      '/evaluate': BACKEND_URL,
      '/moderation': BACKEND_URL,
    }
  }
})