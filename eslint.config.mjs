import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // The PWA service worker is emitted by Serwist into public/ at build
    // time. It is minified, third-party-runtime code; ESLint does not need
    // to lint it. Keep the rule permissive enough that future Serwist
    // filename variations (e.g. sw.js.map, workbox-*.js) do not regress.
    "public/sw.js",
    "public/sw.js.map",
    "public/workbox-*.js",
  ]),
]);

export default eslintConfig;
