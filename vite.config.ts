import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? './' : '/',
  server: {
    port: 3000,
    host: '0.0.0.0',
    strictPort: true, // Fail if port 3000 is already in use
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  },
  build: {
    rollupOptions: {
      output: {
        inlineDynamicImports: true
      }
    }
  }
}));
