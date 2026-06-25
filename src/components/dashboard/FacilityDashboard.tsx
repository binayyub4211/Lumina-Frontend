"use client";

import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { NodeList } from '@/src/components/network/NodeList'
import { AlertFeed } from '@/src/components/dashboard/AlertFeed'
import { ActivityLogList } from '@/src/components/activity/ActivityLogList'
import { SkeletonCard } from '@/src/components/skeleton/SkeletonCard'
import { SkeletonChart } from '@/src/components/skeleton/SkeletonChart'
import { SolarBatteryGauge } from '@/src/components/node/SolarBatteryGauge'
import { useSkeletonTiming } from '@/src/hooks/useSkeletonTiming'
import { useActivityLogSubscription } from '@/src/hooks/useActivityLogSubscription'
import type { NodePosition } from '@/src/types/network'
import { getNodePowerSource } from '@/src/hooks/useNodeStatus'

interface DashboardStore {
  nodesReady: boolean;
  alertsReady: boolean;
  metricsReady: boolean;
  setNodesReady: () => void;
  setAlertsReady: () => void;
  setMetricsReady: () => void;
}

const useDashboardStore = create<DashboardStore>((set) => ({
  nodesReady: false,
  alertsReady: false,
  metricsReady: false,
  setNodesReady: () => set({ nodesReady: true }),
  setAlertsReady: () => set({ alertsReady: true }),
  setMetricsReady: () => set({ metricsReady: true }),
}));

const MOCK_NODES: NodePosition[] = Array.from({ length: 12 }, (_, i) => ({
  id: `node-${i + 1}`,
  x: Math.random() * 800,
  y: Math.random() * 600,
  z: Math.random() * 100,
  label: `Validator ${String.fromCharCode(65 + i)}`,
  color: ["#0f766e", "#9a3412", "#2563eb", "#7c3aed", "#db2777", "#ca8a04"][
    i % 6
  ],
  metadata: {
    description: `Network node ${i + 1}`,
    location: [
      "us-east",
      "eu-west",
      "ap-southeast",
      "us-west",
      "eu-central",
      "ap-northeast",
    ][i % 6],
    ownerName: `Org ${String.fromCharCode(65 + i)}`,
    firmwareVersion: `v${Math.floor(Math.random() * 5)}.${Math.floor(Math.random() * 10)}`,
    hardwareModel: ["X1", "P2", "Z3", "Q4"][i % 4],
    ipAddress: `10.0.${Math.floor(i / 4)}.${(i % 4) * 64 + 1}`,
    uptime: `${Math.floor(Math.random() * 365)}d ${Math.floor(Math.random() * 24)}h`,
    powerSource: (i % 4 === 0 ? 'grid' : i % 3 === 0 ? 'battery' : 'solar'),
  },
}));

// Convert NodePosition to FlatNetworkNode for tree view
const convertToFlatNodes = (nodes: NodePosition[]): FlatNetworkNode[] => {
  return nodes.map((node, i) => ({
    id: node.id,
    name: node.label || node.id,
    type: "node",
    status: ["healthy", "warning", "critical"][i % 3] as
      | "healthy"
      | "warning"
      | "critical",
    region: node.metadata?.location?.split("-")[0] || "Uncategorized",
    facility: node.metadata?.location || "Uncategorized",
    rack: `Rack-${Math.floor(i / 3) + 1}`,
    node: node.label || node.id,
  }));
};

function NodeSectionSkeleton() {
  return (
    <div className="rounded-lg border border-[#d8d0c1] bg-white">
      <div className="flex items-center justify-between border-b border-[#d8d0c1] px-5 py-3">
        <div>
          <div
            className="skeleton skeleton-text skeleton-text--lg"
            style={{ width: 60, height: 16, margin: 0 }}
          />
          <div
            className="skeleton skeleton-text skeleton-text--sm"
            style={{ width: 100, height: 12, margin: "4px 0 0" }}
          />
        </div>
      </div>
      <div className="space-y-2 p-3">
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonCard key={i} variant="node" />
        ))}
      </div>
    </div>
  );
}

function AlertSectionSkeleton() {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div
          className="skeleton skeleton-text skeleton-text--md"
          style={{ width: 80, height: 16, margin: 0 }}
        />
        <div
          className="skeleton"
          style={{ width: 24, height: 20, borderRadius: 9999 }}
        />
      </div>
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="mb-3">
          <SkeletonCard variant="alert" />
        </div>
      ))}
    </div>
  );
}

export function FacilityDashboard() {
  const { events: activityEvents } = useActivityLogSubscription(10_000)
  const [nodesData, setNodesData] = useState<NodePosition[] | null>(null)
  const setNodesReady = useDashboardStore((s) => s.setNodesReady)
  const setAlertsReady = useDashboardStore((s) => s.setAlertsReady)
  const setMetricsReady = useDashboardStore((s) => s.setMetricsReady)
  const solarNodes = (nodesData ?? []).filter((node) => getNodePowerSource(node) !== 'grid')

  const nodesSkeleton = useSkeletonTiming(
    () => useDashboardStore.getState().nodesReady,
    useDashboardStore.subscribe,
  );
  const alertsSkeleton = useSkeletonTiming(
    () => useDashboardStore.getState().alertsReady,
    useDashboardStore.subscribe,
  );
  const metricsSkeleton = useSkeletonTiming(
    () => useDashboardStore.getState().metricsReady,
    useDashboardStore.subscribe,
  );

  useEffect(() => {
    const nodesTimer = setTimeout(() => {
      setNodesData(MOCK_NODES);
      setNodesReady();
    }, 800);
    const alertsTimer = setTimeout(() => {
      setAlertsReady();
    }, 1200);
    const metricsTimer = setTimeout(() => {
      setMetricsReady();
    }, 2000);
    return () => {
      clearTimeout(nodesTimer);
      clearTimeout(alertsTimer);
      clearTimeout(metricsTimer);
    };
  }, [setNodesReady, setAlertsReady, setMetricsReady]);

  return (
    <main className="min-h-screen bg-[#f7f4ee] text-[#171512]">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-5 sm:px-8 lg:px-10">
        <header className="flex flex-col gap-4 border-b border-[#d8d0c1] pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#6f5f48]">
              Facility Monitor
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-[#171512] sm:text-4xl">
              Network Dashboard
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={`rounded px-3 py-1.5 text-sm font-medium transition ${
                viewMode === "list"
                  ? "bg-[#0f766e] text-white"
                  : "bg-[#f7f4ee] text-[#6f5f48] hover:bg-[#ece5d8]"
              }`}
              onClick={() => setViewMode("list")}
            >
              List View
            </button>
            <button
              type="button"
              className={`rounded px-3 py-1.5 text-sm font-medium transition ${
                viewMode === "tree"
                  ? "bg-[#0f766e] text-white"
                  : "bg-[#f7f4ee] text-[#6f5f48] hover:bg-[#ece5d8]"
              }`}
              onClick={() => setViewMode("tree")}
            >
              Tree View
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-6 py-6 lg:grid-cols-3">
          <section className="lg:col-span-2">
            <h2 className="sr-only">Node List</h2>
            {nodesSkeleton.showSkeleton ? (
              <>
                {nodesSkeleton.timedOut && (
                  <div className="skeleton-timeout">
                    <span>Taking longer than expected</span>
                  </div>
                )}
                <NodeSectionSkeleton />
              </>
            ) : (
              <div className="skeleton-fade-active">
                {viewMode === "list" ? (
                  <NodeList nodes={nodesData ?? []} maxDisplay={10} />
                ) : (
                  <div className="h-[600px]">
                    {hierarchicalData ? (
                      <TreeView
                        data={hierarchicalData}
                        width={960}
                        height={600}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[#6f5f48]">
                        No hierarchical data available
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="lg:col-span-1">
            <h2 className="sr-only">Alerts</h2>
            {alertsSkeleton.showSkeleton ? (
              <>
                {alertsSkeleton.timedOut && (
                  <div className="skeleton-timeout">
                    <span>Taking longer than expected</span>
                  </div>
                )}
                <AlertSectionSkeleton />
              </>
            ) : (
              <div className="skeleton-fade-active">
                <AlertFeed />
              </div>
            )}
          </section>
        </div>

        {solarNodes.length > 0 && (
          <section className="mb-6">
            <h2 className="text-lg font-semibold text-[#171512] mb-4">Solar Battery Forecasts</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {solarNodes.slice(0, 3).map((node) => (
                <SolarBatteryGauge
                  key={node.id}
                  facilityId={String(node.metadata?.location ?? 'us-east')}
                  nodeLabel={node.label ?? node.id}
                />
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="text-lg font-semibold text-[#171512] mb-4">
            Network Metrics
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {["Latency", "Throughput", "Packet Loss", "Uptime"].map(
              (metric) => (
                <div key={metric}>
                  {metricsSkeleton.showSkeleton ? (
                    <SkeletonCard variant="metric" />
                  ) : (
                    <div className="skeleton-fade-active rounded-lg border border-[#d8d0c1] bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-[#6f5f48]">
                        {metric}
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-[#171512]">
                        {metric === "Latency" && "24ms"}
                        {metric === "Throughput" && "1,247/s"}
                        {metric === "Packet Loss" && "0.02%"}
                        {metric === "Uptime" && "99.97%"}
                      </p>
                      <p className="mt-1 text-xs text-[#6f5f48]">
                        {metric === "Latency" && "12ms avg"}
                        {metric === "Throughput" && "Peak: 2,100/s"}
                        {metric === "Packet Loss" && "Last 24h"}
                        {metric === "Uptime" && "30d rolling"}
                      </p>
                    </div>
                  )}
                </div>
              ),
            )}
          </div>

          <div className="mt-6">
            <ActivityLogList events={activityEvents} />
          </div>

          <div className="mt-6">
            {metricsSkeleton.showSkeleton ? (
              <SkeletonChart bars={16} height={220} />
            ) : (
              <div className="skeleton-fade-active rounded-lg border border-[#d8d0c1] bg-white p-4">
                <h3 className="text-sm font-semibold text-[#171512] mb-4">
                  Throughput Over Time
                </h3>
                <SkeletonChart bars={16} height={220} />
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
