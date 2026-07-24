/**
 * Patch nf3 trace for Linux/Nixpacks: @vercel/nft is CJS but nf3 uses ESM named import.
 * @see https://github.com/unjs/nf3/issues — nodeFileTrace named export not found
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const target = join("node_modules", "nf3", "dist", "_chunks", "trace.mjs");

if (!existsSync(target)) {
  process.exit(0);
}

const broken = 'import { nodeFileTrace } from "@vercel/nft";';
const fixed = 'import nft from "@vercel/nft";\nconst { nodeFileTrace } = nft;';
const content = readFileSync(target, "utf8");

if (content.includes(fixed)) {
  console.log("[patch-nf3-nft] already patched");
  process.exit(0);
}

if (!content.includes(broken)) {
  console.warn("[patch-nf3-nft] unexpected trace.mjs — skipped");
  process.exit(0);
}

writeFileSync(target, content.replace(broken, fixed));
console.log("[patch-nf3-nft] patched nf3 for @vercel/nft CJS interop (SEPS build OK)");
