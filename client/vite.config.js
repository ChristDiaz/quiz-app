import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'

const httpsKeyPath = '/etc/ssl/cloudflare/quizcraft-key.pem'
const httpsCertPath = '/etc/ssl/cloudflare/quizcraft.pem'
const apiProxyTarget = process.env.VITE_PROXY_TARGET || 'http://localhost:5000'
const httpsConfig =
  fs.existsSync(httpsKeyPath) && fs.existsSync(httpsCertPath)
    ? {
        key: fs.readFileSync(httpsKeyPath),
        cert: fs.readFileSync(httpsCertPath),
      }
    : undefined

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react()],
  server: {
    host: true, // allow external IP access
    port: 5173,
    https: httpsConfig,
    allowedHosts: ['quizcraft.elatron.net'],
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
        secure: false,
      },
      '/generated-media': {
        target: apiProxyTarget,
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
