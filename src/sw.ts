/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

declare let self: ServiceWorkerGlobalScope;

// `injectManifest` mode: vite-plugin-pwa will replace this with the
// real list of precached assets at build time.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Supabase REST + RPC: try the network first so live data wins, fall
// back to cache when offline so reads keep working. Short TTL — the
// user shouldn't see stale data for more than ~10 minutes.
registerRoute(
  ({ url }) => url.hostname.endsWith('.supabase.co') && url.pathname.startsWith('/rest/'),
  new NetworkFirst({
    cacheName: 'supabase-rest',
    networkTimeoutSeconds: 4,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 10 }),
    ],
  }),
);

// Storage (product images, PDFs) — these change rarely, cache-first is fine
registerRoute(
  ({ url }) => url.hostname.endsWith('.supabase.co') && url.pathname.startsWith('/storage/'),
  new CacheFirst({
    cacheName: 'supabase-storage',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 }),
    ],
  }),
);

// Google Fonts (Geist) — cache aggressively, they're versioned URLs
registerRoute(
  ({ url }) => url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts',
    plugins: [
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 }),
    ],
  }),
);

// `autoUpdate` registration in main.tsx posts SKIP_WAITING; the SW takes
// over immediately so users always run the latest build after navigating.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
