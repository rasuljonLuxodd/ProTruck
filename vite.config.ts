import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

export default defineConfig({
  plugins: [
    react(),
    /**
     * Service worker for offline support.
     *
     * `injectManifest` strategy: we own the SW source (src/sw.ts), Vite
     * bundles it, and the plugin only injects the precache manifest.
     * (`generateSW` template-builds it from JSON, but workbox-build emits
     * absolute file paths into the template — which then breaks when the
     * project lives at a path containing an apostrophe, e.g. "Burxon's".)
     */
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico'],
      manifest: {
        name: 'ProTrack',
        short_name: 'ProTrack',
        description: 'Production, sales, debts and expenses for small manufacturing',
        theme_color: '#18181b',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
      },
      devOptions: {
        // Keep the SW off in dev — it would interfere with HMR and cache
        // stale chunks across hot reloads. Production build enables it.
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
});
