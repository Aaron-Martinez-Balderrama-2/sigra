import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function silenciarProxyOffline(proxy: { on: (event: string, cb: (...args: any[]) => void) => void }) {
  proxy.on('error', (_err, _req, res) => {
    if (res && !res.headersSent && typeof res.writeHead === 'function') {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, offline: true, mensaje: 'Backend apagado (Modo Offline activo)' }));
    }
  });
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4202,
    host: true,
    cors: true,
    proxy: {
      '/proxy-riesgo': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy-riesgo/, ''),
        configure: silenciarProxyOffline,
      },
      '/proxy-calificaciones': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy-calificaciones/, ''),
        configure: silenciarProxyOffline,
      },
      '/proxy-asistencia': {
        target: 'http://127.0.0.1:8081',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy-asistencia/, ''),
        configure: silenciarProxyOffline,
      },
    },
  },
  preview: {
    port: 4202,
    host: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
  },
});
