import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { readFileSync } from 'fs'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))

export default defineConfig({
  // Relative paths, so the build also works when qBittorrent sits under a sub-path.
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(version),
    // Fixed at build time, so a normal build leaves the demo's sample data out completely.
    __DEMO__: JSON.stringify(!!process.env.VITE_DEMO_MODE),
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
