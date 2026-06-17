export interface NodePosition {
  id: string
  x: number
  y: number
  z?: number
  r?: number
  label?: string
  color?: string
  metadata?: Record<string, string | number | boolean | null>
}

export interface Edge {
  id: string
  source: string
  target: string
  weight?: number
  color?: string
  dashed?: boolean
  metadata?: Record<string, string | number | boolean | null>
}

export interface TopologyData {
  nodes: NodePosition[]
  edges: Edge[]
}

export interface Viewport {
  x: number
  y: number
  zoom: number
  width: number
  height: number
}

export type RenderMode = 'webgl2' | 'canvas2d'

export interface MeshTopologyConfig {
  nodeRadius: number
  edgeWidth: number
  lodDotRadius: number
  lodNodeThreshold: number
  lodEdgeThreshold: number
  colorNodeDefault: string
  colorEdgeDefault: string
  colorSelected: string
  colorBackground: string
  physicsEnabled: boolean
}

export const DEFAULT_MESH_CONFIG: MeshTopologyConfig = {
  nodeRadius: 6,
  edgeWidth: 1.5,
  lodDotRadius: 2,
  lodNodeThreshold: 0.5,
  lodEdgeThreshold: 0.3,
  colorNodeDefault: '#0f766e',
  colorEdgeDefault: '#94a3b8',
  colorSelected: '#f59e0b',
  colorBackground: '#f7f4ee',
  physicsEnabled: true,
}

export interface PickResult {
  nodeId: string | null
  x: number
  y: number
}
