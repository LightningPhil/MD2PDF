import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['packages/canvadoc-typesetter/src/**/*.test.ts']
  }
})
