import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

// The client bundle is public (Vercel), so a secret in a VITE_* variable is a leak.
// The API token lives only in Keychain/secure storage, pasted in Settings -> Token.
const noTokenInBundle = {
  name: 'declyne-no-token-in-bundle',
  configResolved(config: { env: Record<string, unknown> }) {
    for (const key of Object.keys(config.env)) {
      if (/^VITE_.*(TOKEN|SECRET|PASSWORD)/i.test(key) || /^VITE_.*_KEY$/i.test(key)) {
        throw new Error(
          `${key} is set, and every VITE_* variable is compiled into the public JS bundle. ` +
            'Remove it from .env.local / Vercel. Scripts read DECLYNE_API_TOKEN instead.',
        );
      }
    }
  },
};

export default defineConfig({
  plugins: [
    noTokenInBundle,
    react(),
    tailwind(),
    VitePWA({
      registerType: 'autoUpdate',
      // Use the manifest.json already in public/ rather than generating one.
      manifest: false,
      workbox: {
        // Cache the app shell and all static chunks on install.
        // Exclude large brand assets (mascot-charcoal is 2.2MB, splash screens
        // are device-specific) — they're served from the network on demand.
        globPatterns: ['**/*.{js,css,html,ico,svg,woff2}', 'brand/favicon-*.png', 'brand/icon-512.png', 'brand/apple-touch-icon-v2.png'],
        // API calls always go to the network; the worker only caches statics.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // Google Fonts stylesheets — stale-while-revalidate (updates in bg).
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            // Google Fonts actual font files — cache-first, immutable.
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // API calls — always network, never cache.
            urlPattern: /^https:\/\/declyne-api\.bocas-joshua\.workers\.dev\/api\/.*/i,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@declyne/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'es2022',
  },
  server: {
    port: Number(process.env['PORT'] ?? 5173),
    strictPort: false,
  },
});
