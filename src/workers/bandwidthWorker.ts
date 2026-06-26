import { drawBandwidthChart } from '../components/dashboard/chart/d3Renderer'
import type { BandwidthDataPoint } from '../hooks/useBandwidthStream'

let canvas: OffscreenCanvas | null = null
let ctx: OffscreenCanvasRenderingContext2D | null = null
let width = 0
let height = 0

const dataBuffer: BandwidthDataPoint[] = []
const maxBufferCapacity = 300 // Keep last 300 seconds of data

// Track message arrival times for event rate calculation
let arrivalTimestamps: number[] = []
let isDecimated = false

// Frame loop controls
let needsRedraw = false

const localRaf = typeof requestAnimationFrame !== 'undefined'
  ? requestAnimationFrame
  : (cb: (...args: any[]) => void) => setTimeout(cb, 16)

function tick() {
  if (needsRedraw && ctx && canvas) {
    drawBandwidthChart(ctx, dataBuffer, width, height, isDecimated)
    needsRedraw = false
  }
  localRaf(tick)
}

// Start frame loop
tick()

self.onmessage = (e: MessageEvent) => {
  const { type } = e.data

  if (type === 'init') {
    canvas = e.data.canvas
    width = e.data.width
    height = e.data.height
    if (canvas) {
      ctx = canvas.getContext('2d')
      needsRedraw = true
    }
  } else if (type === 'resize') {
    width = e.data.width
    height = e.data.height
    if (canvas) {
      canvas.width = width
      canvas.height = height
      needsRedraw = true
    }
  } else if (type === 'data') {
    const now = Date.now()
    const points: BandwidthDataPoint[] = Array.isArray(e.data.data) ? e.data.data : [e.data.data]

    // Record arrivals
    points.forEach(() => {
      arrivalTimestamps.push(now)
    })

    // Filter arrival times within last 1 second
    arrivalTimestamps = arrivalTimestamps.filter((t) => now - t < 1000)
    const currentRate = arrivalTimestamps.length

    // Detect burst state
    if (points.length > 10 || currentRate > 10) {
      isDecimated = true
    } else if (currentRate < 5) {
      isDecimated = false
    }

    // Push new data points and enforce capacity
    points.forEach((pt) => {
      // Check for duplicates
      const exists = dataBuffer.some((d) => d.timestamp === pt.timestamp)
      if (!exists) {
        dataBuffer.push(pt)
      }
    })

    // Sort chronologically and evict oldest if capacity exceeded
    dataBuffer.sort((a, b) => a.timestamp - b.timestamp)
    while (dataBuffer.length > maxBufferCapacity) {
      dataBuffer.shift()
    }

    needsRedraw = true
  }
}
