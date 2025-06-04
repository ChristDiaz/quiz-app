import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // allow external IP access
    port: 5173,
    https: {
      key: fs.readFileSync('/etc/ssl/cloudflare/quizcraft-key.pem'),
      cert: fs.readFileSync('/etc/ssl/cloudflare/quizcraft.pem'),
    },
    allowedHosts: ['quizcraft.elatron.net'],
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
