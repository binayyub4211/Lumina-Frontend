/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import {
  CacheFirst,
  ExpirationPlugin,
  NetworkFirst,
  Serwist,
} from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

// `<reference lib="webworker" />` already types `self` as
// `ServiceWorkerGlobalScope`, but Serwist injects the manifest under
// `self.__SW_MANIFEST` at build time. Augment the local binding so the
// reference in `Serwist({ precacheEntries: self.__SW_MANIFEST })` typechecks
// without a cast on the call site.
declare const self: ServiceWorkerGlobalScope &
  SerwistGlobalConfig & {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  };

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  // Document navigations failing offline fall back to the static /offline
  // route. Static asset fetches still hit the cache directly.
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
  runtimeCaching: [
    // POST /api/telemetry/*: NetworkFirst, no Background Sync. The
    // application-level IndexedDB queue in src/lib/offlineQueue.ts is the
    // single source of truth for telemetry replay. Background Sync here
    // would risk duplicate POSTs on a 5xx online (both the SW and the app
    // catch would queue the same payload). Trade-off: closing the tab
    // while offline discards in-flight telemetry until the next page load
    // — acceptable because the IndexedDB queue is drained on boot.
    {
      matcher: ({ url }) => url.pathname.startsWith("/api/telemetry/"),
      handler: new NetworkFirst({
        cacheName: "lumina-telemetry",
        networkTimeoutSeconds: 5,
        plugins: [
          {
            cacheWillUpdate: async ({ response }) => {
              if (response && response.status === 200) {
                return response;
              }
              return null;
            },
          },
        ],
      }),
    },
    // Generic API calls: NetworkFirst with a one-day cache TTL and a
    // bounded entry count so last-known good responses stay available
    // when the network drops.
    {
      matcher: ({ url }) => url.pathname.startsWith("/api/"),
      handler: new NetworkFirst({
        cacheName: "lumina-api",
        networkTimeoutSeconds: 4,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 32,
            maxAgeSeconds: 60 * 60 * 24,
            purgeOnQuotaError: true,
          }),
        ],
      }),
    },
    // Long-lived raster assets (icons, favicon): Cache-First so the UI
    // keeps its visual identity for weeks after the last online session.
    {
      matcher: ({ url }) =>
        url.pathname.startsWith("/icons/") ||
        url.pathname.startsWith("/favicon"),
      handler: new CacheFirst({
        cacheName: "lumina-icons",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 32,
            maxAgeSeconds: 60 * 60 * 24 * 30,
            purgeOnQuotaError: true,
          }),
        ],
      }),
    },
    ...defaultCache,
  ],
});

serwist.addEventListeners();
