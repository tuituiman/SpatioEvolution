import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Base path — กำหนดผ่าน .env: VITE_BASE_PATH=/SpatioEvolution/ สำหรับ GitHub Pages
  // หรือ VITE_BASE_PATH=/ สำหรับ Custom Domain
  base: process.env.VITE_BASE_PATH ?? 'https://tuituiman.github.io/SpatioEvolution/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  worker: {
    format: 'es',
  },
  // ── Vitest Configuration ──
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist'],
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        // แยก chunks เพื่อ performance
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) {
              return 'react-vendor'
            }
            if (id.includes('leaflet')) {
              return 'leaflet-vendor'
            }
            if (id.includes('xlsx')) {
              return 'vendor-xlsx'
            }
            if (id.includes('zustand')) {
              return 'zustand-vendor'
            }
            return 'vendor'
          }
        }
      }
    }
  }
})

