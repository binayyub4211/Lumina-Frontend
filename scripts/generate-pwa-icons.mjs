// One-shot script: generates the PWA icons used by the manifest from the
// committed SVG sources. Re-run whenever a source changes. Output PNGs are
// committed so they can be served statically from /public without any
// runtime dependency.
import { readFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const iconDir = resolve(root, "public", "icons");
const sourceDir = iconDir;

if (!existsSync(iconDir)) {
  mkdirSync(iconDir, { recursive: true });
}

const targets = [
  { source: "source.svg", name: "icon-192x192.png", size: 192 },
  { source: "source.svg", name: "icon-512x512.png", size: 512 },
  { source: "source.svg", name: "apple-touch-icon.png", size: 180 },
  { source: "source.svg", name: "favicon-32x32.png", size: 32 },
  { source: "source.svg", name: "favicon-16x16.png", size: 16 },
  {
    source: "source-maskable.svg",
    name: "icon-maskable-512x512.png",
    size: 512,
  },
];

await Promise.all(
  targets.map(async ({ source, name, size }) => {
    const sourcePath = resolve(sourceDir, source);
    if (!existsSync(sourcePath)) {
      throw new Error(`Missing SVG source at ${sourcePath}`);
    }
    const svg = readFileSync(sourcePath);
    const out = resolve(iconDir, name);
    await sharp(svg, { density: 384 })
      .resize(size, size, {
        fit: "contain",
        background: { r: 15, g: 118, b: 110, alpha: 1 },
      })
      .png({ compressionLevel: 9 })
      .toFile(out);
    console.log(`wrote ${out}`);
  }),
);

console.log("PWA icons generated.");
