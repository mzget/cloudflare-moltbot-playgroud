import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  integrations: [react()],
  devToolbar: {
    enabled: false
  },
  vite: {
    optimizeDeps: {
      include: ['@ai-sdk/react', 'ai'],
    },
    server: {
      proxy: {
        '/api': {
          target: 'https://oaktree-backend.nattapon-r.workers.dev',
          changeOrigin: true,
          secure: false,
          configure: (proxy, _options) => {
            proxy.on('error', (err, _req, _res) => {
              console.error('Vite Proxy Error (API):', err);
            });
            proxy.on('proxyReq', (proxyReq, _req, _res) => {
              proxyReq.setHeader('Origin', 'https://oaktree-agent-frontend.pages.dev');
              proxyReq.setHeader('Referer', 'https://oaktree-agent-frontend.pages.dev/');
            });
          }
        },
        '/mcp': {
          target: 'https://oaktree-mcp.nattapon-r.workers.dev',
          changeOrigin: true,
          secure: false,
          ws: true,
          rewrite: (path) => path.replace(/^\/mcp/, ''),
          configure: (proxy, _options) => {
            proxy.on('error', (err, _req, _res) => {
              console.error('Vite Proxy Error (MCP):', err);
            });
            proxy.on('proxyReq', (proxyReq, _req, _res) => {
              proxyReq.setHeader('Origin', 'https://oaktree-agent-frontend.pages.dev');
              proxyReq.setHeader('Referer', 'https://oaktree-agent-frontend.pages.dev/');
            });
          }
        }
      }
    }
  },
});
