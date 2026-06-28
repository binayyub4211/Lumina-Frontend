/**
 * Tests for the invalidation waterfall registry.
 *
 * Run: npx tsx src/lib/__tests__/invalidationRegistry.test.ts
 */

import {
  collectAffected,
  getInvalidationPlan,
  getRank,
  groupOfKey,
  isRegisteredGroup,
  runInvalidationWaterfall,
  MAX_DEPTH,
  type InvalidatingClient,
} from "../invalidationRegistry";

let failures = 0;
function check(label: string, cond: boolean) {
  if (cond) {
    console.log(`✅ ${label}`);
  } else {
    console.error(`❌ ${label}`);
    failures++;
  }
}

/**
 * Mock QueryClient that records the order and timing of invalidations.
 * Each invalidation resolves on a microtask so Promise.all-per-rank ordering
 * is exercised realistically.
 */
function createMockClient() {
  const order: string[] = [];
  const counts = new Map<string, number>();
  const client: InvalidatingClient = {
    async invalidateQueries({ queryKey }) {
      const group = String((queryKey as unknown[])[0]);
      order.push(group);
      counts.set(group, (counts.get(group) ?? 0) + 1);
      await Promise.resolve();
    },
  };
  return { client, order, counts };
}

async function main() {
  // --- Rank computation -----------------------------------------------------
  console.log("\nTest: topological ranks");
  check("nodes is rank 0", getRank("nodes") === 0);
  check("bandwidth is rank 1", getRank("bandwidth") === 1);
  check("alerts is rank 2", getRank("alerts") === 2);
  check("max observed depth within MAX_DEPTH", (getRank("alerts") ?? 0) + 1 <= MAX_DEPTH);
  check("unknown group has no rank", getRank("ghost") === undefined);

  // --- Group / key helpers --------------------------------------------------
  console.log("\nTest: key helpers");
  check("groupOfKey extracts first segment", groupOfKey(["nodes", "org-1"]) === "nodes");
  check("isRegisteredGroup true for nodes", isRegisteredGroup("nodes"));
  check("isRegisteredGroup false for ghost", !isRegisteredGroup("ghost"));

  // --- Affected set ---------------------------------------------------------
  console.log("\nTest: affected set");
  const affectedFromNodes = collectAffected("nodes");
  check(
    "nodes transition affects nodes+bandwidth+alerts",
    affectedFromNodes.size === 3 &&
      affectedFromNodes.has("nodes") &&
      affectedFromNodes.has("bandwidth") &&
      affectedFromNodes.has("alerts"),
  );
  const affectedFromBandwidth = collectAffected("bandwidth");
  check(
    "bandwidth transition affects bandwidth+alerts only",
    affectedFromBandwidth.size === 2 &&
      affectedFromBandwidth.has("bandwidth") &&
      affectedFromBandwidth.has("alerts") &&
      !affectedFromBandwidth.has("nodes"),
  );
  const affectedExclusive = collectAffected("nodes", true);
  check("excludeSource drops the source group", !affectedExclusive.has("nodes"));

  // --- Plan ordering --------------------------------------------------------
  console.log("\nTest: plan ordering");
  const leafToRoot = getInvalidationPlan("nodes");
  check(
    "leaf-to-root: alerts(2) → bandwidth(1) → nodes(0)",
    JSON.stringify(leafToRoot) === JSON.stringify([["alerts"], ["bandwidth"], ["nodes"]]),
  );
  const rootToLeaf = getInvalidationPlan("nodes", { direction: "root-to-leaf" });
  check(
    "root-to-leaf: nodes(0) → bandwidth(1) → alerts(2)",
    JSON.stringify(rootToLeaf) === JSON.stringify([["nodes"], ["bandwidth"], ["alerts"]]),
  );
  check("unregistered source yields empty plan", getInvalidationPlan("ghost").length === 0);

  // --- Waterfall execution --------------------------------------------------
  console.log("\nTest: waterfall execution");
  {
    const { client, order, counts } = createMockClient();
    const invalidated = await runInvalidationWaterfall(client, ["nodes", "org-1"]);
    check(
      "executes leaf-to-root by default",
      JSON.stringify(order) === JSON.stringify(["alerts", "bandwidth", "nodes"]),
    );
    check("returns invalidated groups in order", JSON.stringify(invalidated) === JSON.stringify(order));
    check(
      "no group invalidated more than once (no redundant re-fetch)",
      [...counts.values()].every((c) => c === 1),
    );
  }

  // --- Unregistered key falls back to a single plain invalidation -----------
  console.log("\nTest: unregistered key fallback");
  {
    const { client, order } = createMockClient();
    await runInvalidationWaterfall(client, ["wallet", "GABC"]);
    check("plain invalidation for unregistered group", JSON.stringify(order) === JSON.stringify(["wallet"]));
  }

  // --- Integration: 5 cascading transitions within budget ------------------
  console.log("\nTest: 5 cascading transitions");
  {
    const { client, counts } = createMockClient();
    const start = process.hrtime.bigint();
    for (let i = 0; i < 5; i++) {
      await runInvalidationWaterfall(client, ["nodes", `node-${i}`]);
    }
    const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
    check("5 transitions complete in < 100ms", elapsedMs < 100);
    check(
      "each group invalidated exactly once per transition (5 total)",
      counts.get("nodes") === 5 && counts.get("bandwidth") === 5 && counts.get("alerts") === 5,
    );
    console.log(`   (elapsed: ${elapsedMs.toFixed(2)}ms)`);
  }

  console.log("");
  if (failures > 0) {
    console.error(`❌ ${failures} assertion(s) failed`);
    process.exit(1);
  }
  console.log("✅ All invalidation registry tests passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
