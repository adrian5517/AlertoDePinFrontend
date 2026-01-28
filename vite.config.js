import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Slightly raise the warning limit while we split heavy vendors
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          // Split heavy vendor libraries into separate chunks
          react: ['react', 'react-dom'],
          mapbox: ['mapbox-gl'],
          ui: ['framer-motion', 'lucide-react'],
          charts: ['recharts'],
          socket: ['socket.io-client']
        }
      }
    }
  }
})
