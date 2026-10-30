import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import federation from '@originjs/vite-plugin-federation';

// https://astro.build/config
export default defineConfig({
  integrations: [react()],
  trailingSlash: 'never',
  devToolbar: {
    enabled: false
  },
  vite: {
    plugins: [
      {
        ...federation({
          name: 'oaktree_host',
          remotes: {
            simplicity_finance: 'http://localhost:5173/assets/remoteEntry.js',
          },
          shared: ['react', 'react-dom', 'zustand'],
        }),
        apply(config, env) {
          return !env.isSsrBuild && !config.build?.ssr;
        },
      },
    ],
    build: {
      target: 'esnext',
      modulePreload: false,
    },
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
