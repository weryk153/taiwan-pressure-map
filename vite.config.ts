import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  build: {
    // maplibre-gl 單一套件即 >1MB，無法再拆；其餘已分塊，故放寬警告門檻避免雜訊
    chunkSizeWarningLimit: 1200,
    rolldownOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('maplibre-gl') || id.includes('react-map-gl')) return 'maplibre'
          if (id.includes('recharts') || id.includes('d3-') || id.includes('victory-vendor')) return 'recharts'
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    passWithNoTests: true,
  },
})
