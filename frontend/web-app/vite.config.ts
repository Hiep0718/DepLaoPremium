import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    basicSsl(),
  ],
  server: {
    host: '0.0.0.0', // Expose to LAN
    proxy: {
      '/api/messages': 'http://127.0.0.1:3001',
      '/api/ai-chat': 'http://127.0.0.1:3002',
      '/socket.io': {
        target: 'http://127.0.0.1:3001',
        ws: true
      },
      '/api': 'http://127.0.0.1:8082',
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
