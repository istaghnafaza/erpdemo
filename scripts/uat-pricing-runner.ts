/**
 * UAT — pricing engine + Neon bundle seed
 * Run: npx tsx scripts/uat-pricing-runner.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}
loadEnvFile(join(root, ".env"));

import { calculateLinePrice, pickVolumeTier } from "../src/lib/pricing-engine.ts";
import {
  defaultCustomerTiers,
  defaultPricingSettings,
  defaultVolumeTiers,
} from "../src/lib/pricing-defaults.ts";
import { getPricingBundle, replaceVolumeTiers } from "../src/server/services/pricing.ts";
import { getDb } from "../src/server/db/index.ts";
import { tenants } from "../src/server/db/schema.ts";
import { eq } from "drizzle-orm";

const tenantId = randomUUID();

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

async function testEngine() {
  const bundle = {
    settings: defaultPricingSettings("test"),
    volume_tiers: defaultVolumeTiers("test").map((t, i) => ({ ...t, id: `v${i}` })),
    customer_tiers: defaultCustomerTiers("test").map((t, i) => ({ ...t, id: `c${i}` })),
    category_margins: [],
  };

  const tierT1 = pickVolumeTier(bundle.volume_tiers, 10, 650_000);
  assert(tierT1.tier_code === "T1", `Expected T1 for qty 10, got ${tierT1.tier_code}`);
  console.log("  ✓ pickVolumeTier — qty 10 → T1");

  const line = calculateLinePrice(
    {
      base_selling_price: 65_000,
      purchase_price: 58_000,
      qty: 10,
      customer_tier_discount_percent: 5,
    },
    bundle,
  );
  assert(line.volume_discount_percent === 3, "volume disc should be 3%");
  assert(line.customer_discount_percent === 5, "customer disc should be 5%");
  assert(line.effective_discount_percent === 8, "stack should be 8%");
  assert(line.unit_net_price >= line.floor_price, "must not go below floor");
  console.log(`  ✓ stack 3%+5% → net Rp ${line.unit_net_price} (floor ${line.floor_price})`);

  const soLine = calculateLinePrice(
    {
      base_selling_price: 65_000,
      purchase_price: 58_000,
      qty: 10,
      customer_tier_discount_percent: 5,
      is_so_line: true,
    },
    bundle,
  );
  assert(soLine.volume_discount_percent === 0, "SO line skips volume tier");
  assert(soLine.customer_discount_percent === 0, "SO line skips customer tier");
  assert(soLine.unit_net_price === 65_000, "SO line at base price");
  console.log("  ✓ SO line — no volume/customer discount, base price kept");

  const clamped = calculateLinePrice(
    {
      base_selling_price: 65_000,
      purchase_price: 58_000,
      qty: 200,
      customer_tier_discount_percent: 7,
    },
    bundle,
  );
  assert(clamped.clamped_to_floor || clamped.unit_net_price >= clamped.floor_price, "floor enforced");
  console.log("  ✓ floor price enforced on high discount");
}

async function testNeonBundle() {
  const db = getDb();
  const suffix = Date.now().toString(36);
  await db.insert(tenants).values({
    id: tenantId,
    name: "UAT Pricing",
    slug: `uat-pricing-${suffix}`,
    ownerEmail: `pricing-${suffix}@test.local`,
    plan: "trial",
    isActive: true,
    onboardingComplete: true,
  });

  const bundle = await getPricingBundle(tenantId);
  assert(bundle.volume_tiers.length === 4, "should seed 4 volume tiers");
  assert(bundle.customer_tiers.length === 5, "should seed 5 customer tiers");
  console.log("  ✓ getPricingBundle — default tiers seeded");

  const updated = bundle.volume_tiers.map((t) =>
    t.tier_code === "T1" ? { ...t, min_qty: 15, discount_percent: 4 } : t,
  );
  const saved = await replaceVolumeTiers(tenantId, updated);
  const t1 = saved.find((t) => t.tier_code === "T1");
  assert(t1?.min_qty === 15 && t1.discount_percent === 4, "T1 update failed");
  console.log("  ✓ replaceVolumeTiers — T1 min_qty 15, disc 4% persisted");

  await db.delete(tenants).where(eq(tenants.id, tenantId));
  console.log("  ✓ cleanup tenant");
}

async function main() {
  console.log("Pricing UAT");
  await testEngine();
  await testNeonBundle();
  console.log("\nAll pricing UAT passed.");
}

main().catch((err) => {
  console.error("  ✗", err.message ?? err);
  process.exit(1);
});
