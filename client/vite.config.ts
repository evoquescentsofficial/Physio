import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `vite build --mode demo` produces a single self-contained HTML file that runs the
// whole app against an in-browser data store (see src/api/demoAdapter.ts), for sharing
// a clickable preview without deploying the API.
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'demo' ? [viteSingleFile()] : [])],
  server: {
    port: 5173,
    // `shared/` sits outside the client root; allow Vite to serve it in dev.
    fs: { allow: ['..'] },
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
}));
