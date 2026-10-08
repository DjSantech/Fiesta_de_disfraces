import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

// En desarrollo el frontend llama /api/... y Vite lo reenvía al backend local.
// `npm run dev:lan` (mode "lan") expone la web en la red local con HTTPS autofirmado,
// necesario para usar la cámara (escáner de QR) desde un celular.
const apiProxy = {
  '/api': { target: process.env.API_PROXY_TARGET || 'http://localhost:4000', changeOrigin: true },
};

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), ...(mode === 'lan' ? [basicSsl()] : [])],
  // Permite caches separadas si corren varios servidores de Vite a la vez (VITE_CACHE_DIR).
  cacheDir: process.env.VITE_CACHE_DIR || 'node_modules/.vite',
  server: {
    port: Number(process.env.PORT) || 5173,
    proxy: apiProxy,
  },
  preview: {
    port: 4173,
    proxy: apiProxy,
  },
}));
