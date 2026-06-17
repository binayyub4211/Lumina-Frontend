import type { NodePosition, Edge } from '@/src/types/network'

interface LayoutMessage {
  type: 'init' | 'step' | 'stop'
  nodes?: NodePosition[]
  edges?: Edge[]
  config?: {
    repulsion: number
    attraction: number
    damping: number
    maxIterations: number
    convergenceThreshold: number
    centerGravity: number
    maxDisplacement: number
  }
}

let nodes: NodePosition[] = []
let edges: Edge[] = []
const adjList = new Map<string, string[]>()
let velocities = new Map<string, { vx: number; vy: number }>()
let iteration = 0
let running = false

const DEFAULT_CONFIG = {
  repulsion: 800,
  attraction: 0.005,
  damping: 0.85,
  maxIterations: 300,
  convergenceThreshold: 0.5,
  centerGravity: 0.01,
  maxDisplacement: 50,
}

let config = { ...DEFAULT_CONFIG }

function buildAdjacencyList(): void {
  adjList.clear()
  for (const e of edges) {
    if (!adjList.has(e.source)) adjList.set(e.source, [])
    if (!adjList.has(e.target)) adjList.set(e.target, [])
    adjList.get(e.source)!.push(e.target)
    adjList.get(e.target)!.push(e.source)
  }
}

function step(): boolean {
  if (nodes.length === 0) return true
  const {
    repulsion: repForce,
    attraction: attForce,
    damping: damp,
    centerGravity: gravity,
    maxDisplacement: maxDisp,
    convergenceThreshold,
  } = config

  let cx = 0, cy = 0
  for (const n of nodes) { cx += n.x; cy += n.y }
  cx /= nodes.length; cy /= nodes.length

  const forces = new Map<string, { fx: number; fy: number }>()
  for (const n of nodes) forces.set(n.id, { fx: 0, fy: 0 })

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j]
      let dx = a.x - b.x, dy = a.y - b.y
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
    const neighbors = adjList.get(n.id)
    if (!neighbors) continue
    for (const nbId of neighbors) {
      const nb = nodes.find((nd) => nd.id === nbId)
      if (!nb) continue
      const dx = nb.x - n.x, dy = nb.y - n.y
      const dist = Math.sqrt(dx * dx + dy * dy) || 1
      const force = (dist * dist) * attForce
      forces.get(n.id)!.fx += (dx / dist) * force
      forces.get(n.id)!.fy += (dy / dist) * force
    }
  }

  let totalMovement = 0
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
    n.x += vel.vx; n.y += vel.vy
    velocities.set(n.id, vel)
    totalMovement += mag
  }

  return totalMovement / nodes.length < convergenceThreshold
}

function handleInit(msg: LayoutMessage): void {
  nodes = (msg.nodes || []).map((n) => ({
    ...n,
    x: n.x ?? (Math.random() - 0.5) * 400,
    y: n.y ?? (Math.random() - 0.5) * 400,
  }))
  edges = msg.edges || []
  velocities = new Map()
  iteration = 0
  running = true
  if (msg.config) config = { ...DEFAULT_CONFIG, ...msg.config }
  buildAdjacencyList()
  postMessage({ type: 'nodes', nodes: nodes.map((n) => ({ ...n })), iteration })
}

function handleStep(): void {
  if (!running) return
  const converged = step()
  iteration++
  postMessage({
    type: 'nodes',
    nodes: nodes.map((n) => ({ ...n })),
    iteration,
    converged: converged || iteration >= config.maxIterations,
  })
  if (converged || iteration >= config.maxIterations) {
    running = false
    postMessage({ type: 'done' })
  }
}

self.onmessage = (e: MessageEvent<LayoutMessage>) => {
  switch (e.data.type) {
    case 'init':
      handleInit(e.data)
      break
    case 'step':
      handleStep()
      break
    case 'stop':
      running = false
      break
  }
}
