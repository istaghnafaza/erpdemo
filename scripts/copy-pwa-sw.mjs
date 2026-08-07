/**
 * vite-plugin-pwa emits sw.js + workbox-*.js to dist/, but Nitro serves static files
 * from .output/public — copy generated service worker assets after build.
 */
import { copyFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const distDir = "dist";
const publicDir = join(".output", "public");

if (!existsSync(distDir)) {
  console.warn("[copy-pwa-sw] dist/ missing — skipped");
  process.exit(0);
}

if (!existsSync(publicDir)) {
  console.warn("[copy-pwa-sw] .output/public missing — skipped");
  process.exit(0);
}

let copied = 0;
for (const name of readdirSync(distDir)) {
  if (name === "sw.js" || name.startsWith("workbox-")) {
    copyFileSync(join(distDir, name), join(publicDir, name));
    copied += 1;
    console.log(`[copy-pwa-sw] ${name} → .output/public/${name}`);
  }
}

if (copied === 0) {
  console.warn("[copy-pwa-sw] no service worker files found in dist/");
}
