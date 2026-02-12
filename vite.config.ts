import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: './',
  server: {
    port: 5173,
    open: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
  },
  resolve: {
    alias: {
      'canvadoc-typesetter': path.resolve(__dirname, 'src/canvadoc-typesetter/index.ts'),
    },
  },
});
