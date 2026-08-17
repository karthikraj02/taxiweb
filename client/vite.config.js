import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * The previous config proxied /api and /socket.io to
 * https://taxiweb-backend.vercel.app — a hardcoded production URL — so local
 * development silently talked to the deployed backend. The target now comes
 * from VITE_API_URL and defaults to a local server.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_DEV_API_PROXY || 'http://localhost:5000';

  return {
    plugins: [react()],
    server: {
      port: 3000,
      proxy: {
        '/api': { target: apiTarget, changeOrigin: true },
        '/socket.io': { target: apiTarget, changeOrigin: true, ws: true },
        '/uploads': { target: apiTarget, changeOrigin: true },
      },
    },
    build: {
      sourcemap: mode !== 'production',
      rollupOptions: {
        output: {
          // Split the heavier vendors so the initial bundle stays small.
          manualChunks: {
            react: ['react', 'react-dom'],
            net: ['axios', 'socket.io-client'],
          },
        },
      },
    },
  };
});
