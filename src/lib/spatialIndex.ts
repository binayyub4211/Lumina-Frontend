import type { NodePosition, Viewport } from '@/src/types/network'

interface QuadtreeNode {
  x: number
  y: number
  w: number
  h: number
  nodes: NodePosition[]
  children: QuadtreeNode[] | null
}

const MAX_CAPACITY = 16
const MAX_DEPTH = 12

function subdivide(node: QuadtreeNode, depth: number): void {
  if (depth >= MAX_DEPTH) return
  const hw = node.w / 2
  const hh = node.h / 2
  node.children = [
    { x: node.x, y: node.y, w: hw, h: hh, nodes: [], children: null },
    { x: node.x + hw, y: node.y, w: hw, h: hh, nodes: [], children: null },
    { x: node.x, y: node.y + hh, w: hw, h: hh, nodes: [], children: null },
    { x: node.x + hw, y: node.y + hh, w: hw, h: hh, nodes: [], children: null },
  ]
  for (const n of node.nodes) {
    insertNodeIntoChildren(node.children!, n, depth + 1)
  }
  node.nodes = []
}

function insertNodeIntoChildren(
  children: QuadtreeNode[],
  node: NodePosition,
  depth: number,
): void {
  for (const child of children) {
    if (
      node.x >= child.x &&
      node.x < child.x + child.w &&
      node.y >= child.y &&
      node.y < child.y + child.h
    ) {
      insertNode(child, node, depth + 1)
      return
    }
  }
}

function insertNode(node: QuadtreeNode, point: NodePosition, depth: number): void {
  if (node.children) {
    insertNodeIntoChildren(node.children, point, depth)
    return
  }
  node.nodes.push(point)
  if (node.nodes.length > MAX_CAPACITY && depth < MAX_DEPTH) {
    subdivide(node, depth)
  }
}

function queryNode(
  node: QuadtreeNode,
  vx: number,
  vy: number,
  vw: number,
  vh: number,
  result: NodePosition[],
): void {
  if (
    vx + vw < node.x ||
    vx > node.x + node.w ||
    vy + vh < node.y ||
    vy > node.y + node.h
  ) {
    return
  }
  if (node.children) {
    for (const child of node.children) {
      queryNode(child, vx, vy, vw, vh, result)
    }
    return
  }
  for (const n of node.nodes) {
    if (n.x >= vx && n.x <= vx + vw && n.y >= vy && n.y <= vy + vh) {
      result.push(n)
    }
  }
}

export class SpatialIndex {
  private root: QuadtreeNode
  private nodeMap: Map<string, NodePosition> = new Map()
  private count = 0

  constructor(nodes: NodePosition[] = []) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    if (nodes.length === 0) {
      minX = -1000; minY = -1000; maxX = 1000; maxY = 1000
    } else {
      for (const n of nodes) {
        if (n.x < minX) minX = n.x
        if (n.y < minY) minY = n.y
        if (n.x > maxX) maxX = n.x
        if (n.y > maxY) maxY = n.y
      }
    }
    const w = maxX - minX || 1
    const h = maxY - minY || 1
    const pad = Math.max(w, h) * 0.1
    this.root = {
      x: minX - pad,
      y: minY - pad,
      w: w + pad * 2,
      h: h + pad * 2,
      nodes: [],
      children: null,
    }
    for (const n of nodes) {
      this.insert(n)
    }
  }

  insert(node: NodePosition): void {
    this.nodeMap.set(node.id, node)
    this.count++
    insertNode(this.root, node, 0)
  }

  remove(id: string): void {
    this.nodeMap.delete(id)
  }

  update(node: NodePosition): void {
    this.nodeMap.set(node.id, node)
  }

  queryViewport(viewport: Viewport): NodePosition[] {
    const vx = viewport.x
    const vy = viewport.y
    const vw = viewport.width / viewport.zoom
    const vh = viewport.height / viewport.zoom
    const result: NodePosition[] = []
    queryNode(this.root, vx, vy, vw, vh, result)
    return result
  }

  queryRect(x: number, y: number, w: number, h: number): NodePosition[] {
    const result: NodePosition[] = []
    queryNode(this.root, x, y, w, h, result)
    return result
  }

  get(id: string): NodePosition | undefined {
    return this.nodeMap.get(id)
  }

  getAll(): NodePosition[] {
    return Array.from(this.nodeMap.values())
  }

  get size(): number {
    return this.count
  }

  clear(): void {
    this.root.nodes = []
    this.root.children = null
    this.nodeMap.clear()
    this.count = 0
  }

  rebuild(nodes: NodePosition[]): void {
    this.clear()
    for (const n of nodes) {
      this.insert(n)
    }
  }
}
