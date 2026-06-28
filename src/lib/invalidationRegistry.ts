/**
 * Invalidation Registry
 * ---------------------
 * A formal dependency graph (DAG) describing how TanStack Query cache groups
 * derive from one another. When a single node transitions state, downstream
 * queries — bandwidth history, alert rules — must be re-fetched in a
 * predictable, topologically-ordered "waterfall" rather than cascading in an
 * arbitrary order that can leave stale data visible for hundreds of ms.
 *
 * Each query group is identified by the first segment of its `queryKey`
 * (e.g. `['nodes', orgId]` → group `'nodes'`). The registry records which
 * groups each group is derived from; topological ranks are computed from those
 * edges so the waterfall can invalidate one rank at a time.
 *
 * Invariants enforced here:
 *   - Maximum dependency depth ≤ 5 levels.
 *   - The graph must be acyclic.
 *   - Each affected group is invalidated exactly once per transition, so a
 *     single transition never triggers redundant re-fetches.
 */

import type { QueryClient, QueryKey } from "@tanstack/react-query";

/** A node in the derived-query dependency graph. */
export interface QueryGroupDef {
  /** First segment of the queryKey identifying this group. */
  group: string;
  /** Groups this query is derived from (its parents/sources in the DAG). */
  dependsOn: string[];
}

/** Hard upper bound on dependency depth (Technical Invariants & Bounds). */
export const MAX_DEPTH = 5;

/**
 * The real Lumina monitoring dependency graph.
 *
 *   nodes (rank 0)            — per-node state, the source of every cascade
 *     └─ bandwidth (rank 1)   — derived from node id + status
 *          └─ alerts (rank 2) — alert rules re-evaluate on node status AND
 *                               recomputed bandwidth thresholds
 *
 * Adding a `topology` group derived from `nodes` (peer topology) is a one-line
 * change here — ranks recompute automatically.
 */
export const INVALIDATION_GRAPH: readonly QueryGroupDef[] = [
  { group: "nodes", dependsOn: [] },
  { group: "bandwidth", dependsOn: ["nodes"] },
  { group: "alerts", dependsOn: ["nodes", "bandwidth"] },
];

/** Direction of traversal across topological ranks. */
export type WaterfallDirection = "leaf-to-root" | "root-to-leaf";

export interface WaterfallOptions {
  /**
   * Order in which ranks are processed. Per the implementation blueprint the
   * default traverses from leaf to root (highest rank first), awaiting each
   * rank before proceeding to the next.
   */
  direction?: WaterfallDirection;
  /**
   * When false (default) the source group itself is also invalidated. When
   * true only the strictly-downstream dependents are invalidated.
   */
  excludeSource?: boolean;
}

interface CompiledGraph {
  /** group → its definition */
  defs: Map<string, QueryGroupDef>;
  /** group → topological rank (longest path from any root) */
  ranks: Map<string, number>;
  /** group → groups that directly depend on it (reverse edges) */
  dependents: Map<string, string[]>;
}

/**
 * Compile the declarative graph into rank + reverse-edge lookups, validating
 * the acyclicity and max-depth invariants. Throws on a misconfigured graph so
 * the failure surfaces at module load / test time, never silently in prod.
 */
function compileGraph(graph: readonly QueryGroupDef[]): CompiledGraph {
  const defs = new Map<string, QueryGroupDef>();
  for (const def of graph) {
    if (defs.has(def.group)) {
      throw new Error(`invalidationRegistry: duplicate group "${def.group}"`);
    }
    defs.set(def.group, def);
  }

  // Validate every dependency references a known group.
  for (const def of graph) {
    for (const parent of def.dependsOn) {
      if (!defs.has(parent)) {
        throw new Error(
          `invalidationRegistry: group "${def.group}" depends on unknown group "${parent}"`,
        );
      }
    }
  }

  // Compute rank = longest path from a root, with cycle detection.
  const ranks = new Map<string, number>();
  const visiting = new Set<string>();

  function rankOf(group: string): number {
    const cached = ranks.get(group);
    if (cached !== undefined) return cached;
    if (visiting.has(group)) {
      throw new Error(
        `invalidationRegistry: dependency cycle detected at group "${group}"`,
      );
    }
    visiting.add(group);
    const parents = defs.get(group)!.dependsOn;
    const rank =
      parents.length === 0
        ? 0
        : Math.max(...parents.map((p) => rankOf(p))) + 1;
    visiting.delete(group);
    if (rank + 1 > MAX_DEPTH) {
      throw new Error(
        `invalidationRegistry: dependency depth ${rank + 1} exceeds MAX_DEPTH (${MAX_DEPTH}) at group "${group}"`,
      );
    }
    ranks.set(group, rank);
    return rank;
  }

  for (const def of graph) rankOf(def.group);

  // Build reverse edges (dependents).
  const dependents = new Map<string, string[]>();
  for (const def of graph) dependents.set(def.group, []);
  for (const def of graph) {
    for (const parent of def.dependsOn) {
      dependents.get(parent)!.push(def.group);
    }
  }

  return { defs, ranks, dependents };
}

const compiled = compileGraph(INVALIDATION_GRAPH);

/** Topological rank of a group, or undefined if it isn't registered. */
export function getRank(group: string): number | undefined {
  return compiled.ranks.get(group);
}

/** True when the group participates in the invalidation graph. */
export function isRegisteredGroup(group: string): boolean {
  return compiled.defs.has(group);
}

/** Extract the group identifier from a queryKey (its first string segment). */
export function groupOfKey(queryKey: QueryKey): string | undefined {
  const first = Array.isArray(queryKey) ? queryKey[0] : queryKey;
  return typeof first === "string" ? first : undefined;
}

/**
 * The set of groups affected by a transition of `sourceGroup`: the source
 * itself plus every group transitively derived from it.
 */
export function collectAffected(
  sourceGroup: string,
  excludeSource = false,
): Set<string> {
  const affected = new Set<string>();
  const stack = [sourceGroup];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (affected.has(current)) continue;
    affected.add(current);
    for (const dep of compiled.dependents.get(current) ?? []) {
      if (!affected.has(dep)) stack.push(dep);
    }
  }
  if (excludeSource) affected.delete(sourceGroup);
  return affected;
}

/**
 * Build an ordered invalidation plan: affected groups bucketed by rank and
 * returned as an array of ranks (each rank is a group list invalidated
 * together via Promise.all). Order honours {@link WaterfallOptions.direction}.
 */
export function getInvalidationPlan(
  sourceGroup: string,
  options: WaterfallOptions = {},
): string[][] {
  const { direction = "leaf-to-root", excludeSource = false } = options;
  if (!isRegisteredGroup(sourceGroup)) return [];

  const affected = collectAffected(sourceGroup, excludeSource);

  const byRank = new Map<number, string[]>();
  for (const group of affected) {
    const rank = compiled.ranks.get(group)!;
    const bucket = byRank.get(rank);
    if (bucket) bucket.push(group);
    else byRank.set(rank, [group]);
  }

  const rankNumbers = [...byRank.keys()].sort((a, b) =>
    direction === "leaf-to-root" ? b - a : a - b,
  );
  return rankNumbers.map((r) => byRank.get(r)!);
}

/** Minimal surface of QueryClient the waterfall needs — eases testing. */
export interface InvalidatingClient {
  invalidateQueries(filters: { queryKey: QueryKey }): Promise<void>;
}

/**
 * Run the invalidation waterfall for a mutated query key.
 *
 * Traverses the DAG one topological rank at a time. Within a rank all groups
 * are invalidated concurrently via Promise.all; the waterfall awaits the whole
 * rank before advancing, so derived data never refetches against a half-stale
 * upstream. Each affected group is invalidated exactly once, bounding
 * re-fetches per transition.
 *
 * Returns the flat list of groups that were invalidated, in execution order.
 */
export async function runInvalidationWaterfall(
  client: InvalidatingClient,
  mutatedKey: QueryKey,
  options: WaterfallOptions = {},
): Promise<string[]> {
  const sourceGroup = groupOfKey(mutatedKey);
  if (!sourceGroup || !isRegisteredGroup(sourceGroup)) {
    // Not part of the derived graph — fall back to a single plain invalidation.
    await client.invalidateQueries({ queryKey: mutatedKey });
    return sourceGroup ? [sourceGroup] : [];
  }

  const plan = getInvalidationPlan(sourceGroup, options);
  const invalidated: string[] = [];
  for (const rank of plan) {
    await Promise.all(
      rank.map((group) => {
        invalidated.push(group);
        return client.invalidateQueries({ queryKey: [group] });
      }),
    );
  }
  return invalidated;
}

/** Re-export for consumers that hold a real TanStack QueryClient. */
export type { QueryClient };
