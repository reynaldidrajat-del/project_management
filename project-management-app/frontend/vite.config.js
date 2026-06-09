import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const backendUrl = 'http://localhost:5000';
const removeBrowserOrigin = (proxy) => {
  const removeOriginHeader = (proxyReq) => {
    proxyReq.removeHeader('Origin');
  };

  proxy.on('proxyReq', removeOriginHeader);
  proxy.on('proxyReqWs', removeOriginHeader);
};

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: ['.trycloudflare.com'],
    proxy: {
      '/api': {
        target: backendUrl,
        changeOrigin: true,
        configure: removeBrowserOrigin,
      },
      '/socket.io': {
        target: backendUrl,
        changeOrigin: true,
        ws: true,
        configure: removeBrowserOrigin,
      },
    },
  },
});
