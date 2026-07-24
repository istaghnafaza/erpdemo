/**
 * Production entry — log PORT/HOST lalu start Nitro (Railway debugging).
 */
const port = process.env.PORT ?? "(unset)";
const host = process.env.HOST ?? process.env.NITRO_HOST ?? "(unset)";

console.log(`[SEPS] starting server host=${host} port=${port} node=${process.version}`);

await import("../.output/server/index.mjs");
