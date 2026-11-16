import path from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify('test'),
    __DEMO__: 'false',
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    // Component tests ask for jsdom at their top; the rest run in plain Node.
    setupFiles: ['src/test/setup.ts'],
  },
})
