import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  base: mode === 'pages' ? (process.env.PAGES_BASE_PATH || '/MD2PDF/') : '/',
  server: {
    port: 3000, open: true,
    watch: { ignored: ['**/tmp/**', '**/output/**', '**/coverage/**', '**/docs/audit/**'] },
  },
  build: { target: 'es2020', outDir: 'dist' },
}));
