'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import type { NodePosition, Edge, TopologyData } from '@/src/types/network'

export interface LayoutConfig {
  repulsion: number
  attraction: number
  damping: number
  maxIterations: number
  convergenceThreshold: number
  centerGravity: number
  maxDisplacement: number
}

export const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  repulsion: 800,
  attraction: 0.005,
  damping: 0.85,
  maxIterations: 300,
  convergenceThreshold: 0.5,
  centerGravity: 0.01,
  maxDisplacement: 50,
}

export interface MeshLayoutState {
  nodes: NodePosition[]
  isRunning: boolean
  progress: number
}

export function useMeshLayout(config: Partial<LayoutConfig> = {}) {
  const cfg = useMemo(
    () => ({ ...DEFAULT_LAYOUT_CONFIG, ...config }),
    [config],
  )
  const [state, setState] = useState<MeshLayoutState>({
    nodes: [],
    isRunning: false,
    progress: 0,
  })
  const nodesRef = useRef<NodePosition[]>([])
  const edgesRef = useRef<Edge[]>([])
  const velocitiesRef = useRef<Map<string, { vx: number; vy: number }>>(
    new Map(),
  )
  const iterationRef = useRef(0)
  const rafRef = useRef<number>(0)
  const adjListRef = useRef<Map<string, string[]>>(new Map())

  const buildAdjacencyList = useCallback((edges: Edge[]) => {
    const adj = new Map<string, string[]>()
    for (const e of edges) {
      if (!adj.has(e.source)) adj.set(e.source, [])
      if (!adj.has(e.target)) adj.set(e.target, [])
      adj.get(e.source)!.push(e.target)
      adj.get(e.target)!.push(e.source)
    }
    adjListRef.current = adj
  }, [])

  const computeForces = useCallback((cfg: LayoutConfig) => {
    const nodes = nodesRef.current
    if (nodes.length === 0) return true
    const adj = adjListRef.current
    const velocities = velocitiesRef.current
    let totalMovement = 0

    const repForce = cfg.repulsion
    const attForce = cfg.attraction
    const damp = cfg.damping
    const gravity = cfg.centerGravity
    const maxDisp = cfg.maxDisplacement

    let cx = 0, cy = 0
    for (const n of nodes) {
      cx += n.x; cy += n.y
    }
    cx /= nodes.length; cy /= nodes.length

    const forces = new Map<string, { fx: number; fy: number }>()
    for (const n of nodes) {
      forces.set(n.id, { fx: 0, fy: 0 })
    }

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]
        const b = nodes[j]
        let dx = a.x - b.x
        let dy = a.y - b.y
        let dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < 1) { dist = 1; dx = 1; dy = 0 }
        const force = repForce / (dist * dist)
        forces.get(a.id)!.fx += (dx / dist) * force
        forces.get(a.id)!.fy += (dy / dist) * force
        forces.get(b.id)!.fx -= (dx / dist) * force
        forces.get(b.id)!.fy -= (dy / dist) * force
      }
    }

    for (const n of nodes) {
      const neighbors = adj.get(n.id)
      if (!neighbors) continue
      for (const neighborId of neighbors) {
        const nb = nodes.find((nd) => nd.id === neighborId)
        if (!nb) continue
        const dx = nb.x - n.x
        const dy = nb.y - n.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const force = (dist * dist) * attForce
        forces.get(n.id)!.fx += (dx / dist) * force
        forces.get(n.id)!.fy += (dy / dist) * force
      }
    }

    for (const n of nodes) {
      const f = forces.get(n.id)!
      f.fx += (cx - n.x) * gravity
      f.fy += (cy - n.y) * gravity

      const vel = velocities.get(n.id) || { vx: 0, vy: 0 }
      vel.vx = (vel.vx + f.fx) * damp
      vel.vy = (vel.vy + f.fy) * damp

      const mag = Math.sqrt(vel.vx * vel.vx + vel.vy * vel.vy)
      if (mag > maxDisp) {
        vel.vx = (vel.vx / mag) * maxDisp
        vel.vy = (vel.vy / mag) * maxDisp
      }

      n.x += vel.vx
      n.y += vel.vy
      velocities.set(n.id, vel)
      totalMovement += mag
    }

    return totalMovement / nodes.length < cfg.convergenceThreshold
  }, [])

  const step = useCallback((cfg: LayoutConfig) => {
    if (iterationRef.current >= cfg.maxIterations) return true
    const converged = computeForces(cfg)
    iterationRef.current++
    return converged
  }, [computeForces])

  const stopSimulation = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
    setState((prev) => ({ ...prev, isRunning: false }))
  }, [])

  const runSimulation = useCallback((
    data: TopologyData,
    onUpdate?: (nodes: NodePosition[]) => void,
  ) => {
    stopSimulation()

    const initialNodes = data.nodes.map((n) => ({
      ...n,
      x: n.x ?? (Math.random() - 0.5) * 400,
      y: n.y ?? (Math.random() - 0.5) * 400,
    }))
    nodesRef.current = initialNodes
    edgesRef.current = data.edges
    velocitiesRef.current = new Map()
    buildAdjacencyList(data.edges)
    iterationRef.current = 0

    setState((prev) => ({
      ...prev,
      nodes: initialNodes,
      isRunning: true,
      progress: 0,
    }))

    const tick = () => {
      const converged = step(cfg)
      const progress = Math.min(
        iterationRef.current / cfg.maxIterations,
        1,
      )

      const currentNodes = nodesRef.current.map((n) => ({ ...n }))
      setState({
        nodes: currentNodes,
        isRunning: !converged && iterationRef.current < cfg.maxIterations,
        progress,
      })
      onUpdate?.(currentNodes)

      if (!converged && iterationRef.current < cfg.maxIterations) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        setState((prev) => ({ ...prev, isRunning: false, progress: 1 }))
      }
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [cfg, step, buildAdjacencyList, stopSimulation])

  const setNodePositions = useCallback((nodes: NodePosition[]) => {
    nodesRef.current = nodes
    setState((prev) => ({ ...prev, nodes }))
  }, [])

  return {
    ...state,
    runSimulation,
    stopSimulation,
    setNodePositions,
  }
}
