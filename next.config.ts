import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  // The Serwist worker source is authored in TypeScript under app/sw.ts so
  // it can live next to the rest of the App Router tree. Serwist compiles
  // it down to public/sw.js during `next build`.
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  // Disable the worker in development so HMR bundles are never cached —
  // the service worker would otherwise pin stale chunks and break the
  // Next.js dev server. Production builds always include the worker.
  disable: process.env.NODE_ENV !== "production",
  reloadOnOnline: false,
  cacheOnNavigation: true,
  // Cap is enforced at build time by Serwist; the SW never inspects it.
  maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
});

const nextConfig: NextConfig = {
  // Reserved for future app-specific options.
};

export default withSerwist(nextConfig);
