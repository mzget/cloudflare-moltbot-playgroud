import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import federation from '@originjs/vite-plugin-federation';

export default defineConfig({
  envPrefix: ['VITE_', 'PUBLIC_'],
  plugins: [
    react(),
    federation({
      name: 'oaktree_host',
      remotes: {
        simplicity_finance: process.env.PUBLIC_SIMPLICITY_REMOTE_URL ||
          (process.env.NODE_ENV === 'production'
            ? 'https://simplicity-3c9.pages.dev/assets/remoteEntry.js'
            : 'http://localhost:5173/assets/remoteEntry.js'),
      },
      shared: ['react', 'react-dom', 'zustand'],
    }),
  ],
  resolve: {
    dedupe: [
      'react',
      'react-dom',
      'zustand',
      '@tanstack/react-router',
      '@mui/joy',
      '@emotion/react',
      '@emotion/styled',
      'i18next',
      'react-i18next',
    ],
  },
  build: {
    target: 'esnext',
    modulePreload: false,
  },
  server: {
    port: 4321,
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
        },
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
        },
      },
    },
  },
});

