import node from '@astrojs/node';
import react from '@astrojs/react';
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: process.env.SITE_URL ?? 'https://dessenius.be',
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [react()],
  trailingSlash: 'never',
  server: { host: true, port: 4321 },
  vite: { ssr: { noExternal: ['@nd/markdown', '@nd/tokens', '@nd/pb-types'] } },
});
