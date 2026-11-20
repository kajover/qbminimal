import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { readFileSync } from 'fs'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))

// main.tsx imports the app only once the language has loaded, so its text comes out translated.
// Without this the browser would ask for the app's code only then, one step after the other; these
// links fetch it alongside the first script, without running it early.
function preloadApp(): Plugin {
  return {
    name: 'preload-app',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(_html, { bundle }) {
        if (!bundle) return
        const chunks = Object.values(bundle).filter(c => c.type === 'chunk')
        const app = chunks.find(c => c.facadeModuleId?.endsWith('/src/App.tsx'))
        if (!app) return
        // The app's chunk and the shared ones it needs, but not the first script, already loading.
        const files = new Set<string>()
        const add = (file: string) => {
          const chunk = chunks.find(c => c.fileName === file)
          if (!chunk || chunk.isEntry || files.has(file)) return
          files.add(file)
          chunk.imports.forEach(add)
        }
        add(app.fileName)
        return [...files].map(file => ({ tag: 'link', attrs: { rel: 'modulepreload', crossorigin: true, href: `./${file}` }, injectTo: 'head' as const }))
      },
    },
  }
}

export default defineConfig({
  // Relative paths, so the build also works when qBittorrent sits under a sub-path.
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(version),
    // Fixed at build time, so a normal build leaves the demo's sample data out completely.
    __DEMO__: JSON.stringify(!!process.env.VITE_DEMO_MODE),
  },
  plugins: [react(), tailwindcss(), preloadApp()],
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
