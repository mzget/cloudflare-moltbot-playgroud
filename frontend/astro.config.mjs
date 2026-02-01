// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: process.env.NODE_ENV === 'production' ? {
        'react-dom/server': 'react-dom/server.edge'
      } : {}
    }
  },

  output: 'server',
  adapter: cloudflare({
    platformProxy: {
      enabled: true,
      persist: {
        path: '../.d1-data/v3'
      }
    }
  })
});