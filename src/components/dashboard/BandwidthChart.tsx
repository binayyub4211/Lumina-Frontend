'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useBandwidthStream, type BandwidthDataPoint } from '../../hooks/useBandwidthStream'
import { drawBandwidthChart } from './chart/d3Renderer'

export interface BandwidthChartProps {
  wsUrl: string
  title?: string
  height?: number
  enablePerformanceTracking?: boolean
}

export function BandwidthChart({
  wsUrl,
  title = 'Bandwidth Usage',
  height = 300,
  enablePerformanceTracking = false,
}: BandwidthChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const workerRef = useRef<Worker | null>(null)
  const [dimensions, setDimensions] = useState({ width: 400, height })
  const [useWorker, setUseWorker] = useState(false)
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')

  // Main thread fallback state
  const mainThreadDataRef = useRef<BandwidthDataPoint[]>([])
  const mainThreadArrivalTimestamps = useRef<number[]>([])
  const [mainThreadDecimated, setMainThreadDecimated] = useState(false)

  // Statistics
  const [stats, setStats] = useState({
    current: 0,
    average: 0,
    peak: 0,
    pointsCount: 0,
  })

  // Update statistics
  const updateStats = useCallback((newData: BandwidthDataPoint[]) => {
    if (newData.length === 0) return
    const values = newData.map((d) => d.value)
    const current = values[values.length - 1]
    const average = values.reduce((sum, v) => sum + v, 0) / values.length
    const peak = Math.max(...values)
    setStats({
      current,
      average,
      peak,
      pointsCount: newData.length,
    })
  }, [])

  // Handle incoming data
  const handleDataPoint = useCallback(
    (point: BandwidthDataPoint) => {
      if (workerRef.current && useWorker) {
        // Send to worker
        workerRef.current.postMessage({
          type: 'data',
          data: point,
        })

        // Also track locally just for stats calculation (throttled/non-blocking)
        const localData = mainThreadDataRef.current
        const exists = localData.some((d) => d.timestamp === point.timestamp)
        if (!exists) {
          localData.push(point)
          if (localData.length > 300) localData.shift()
        }
        updateStats(localData)
      } else {
        // Fallback main thread rendering
        const localData = mainThreadDataRef.current
        const exists = localData.some((d) => d.timestamp === point.timestamp)
        if (!exists) {
          localData.push(point)
          if (localData.length > 300) localData.shift()
        }

        // Measure event rate on main thread to decide decimation
        const now = Date.now()
        mainThreadArrivalTimestamps.current.push(now)
        mainThreadArrivalTimestamps.current = mainThreadArrivalTimestamps.current.filter((t) => now - t < 1000)
        const rate = mainThreadArrivalTimestamps.current.length

        let decimated = mainThreadDecimated
        if (rate > 10) {
          decimated = true
        } else if (rate < 5) {
          decimated = false
        }
        setMainThreadDecimated(decimated)

        updateStats(localData)

        // Draw immediately on main thread canvas
        const canvas = canvasRef.current
        if (canvas) {
          const ctx = canvas.getContext('2d')
          if (ctx) {
            drawBandwidthChart(ctx, localData, dimensions.width, dimensions.height, decimated)
          }
        }
      }
    },
    [useWorker, dimensions, updateStats, mainThreadDecimated]
  )

  // Connect to WebSocket stream
  const ws = useBandwidthStream({
    wsUrl,
    onMessage: handleDataPoint,
  })

  // Sync connection state
  useEffect(() => {
    if (ws.state === 'connected') {
      setConnectionState('connected')
    } else if (ws.state === 'connecting') {
      setConnectionState('connecting')
    } else {
      setConnectionState('disconnected')
    }
  }, [ws.state])

  // Initialize Worker & Canvas size
  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    // Get exact container dimensions
    const rect = container.getBoundingClientRect()
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
    const w = rect.width || 400
    const h = height

    setDimensions({ width: w, height: h })

    // Check OffscreenCanvas support
    const supportsOffscreen = typeof HTMLCanvasElement.prototype.transferControlToOffscreen === 'function'

    if (supportsOffscreen && !workerRef.current) {
      try {
        const worker = new Worker(
          new URL('../../workers/bandwidthWorker.ts', import.meta.url),
          { type: 'module' }
        )

        canvas.width = w * dpr
        canvas.height = h * dpr

        const offscreen = canvas.transferControlToOffscreen()
        worker.postMessage(
          {
            type: 'init',
            canvas: offscreen,
            width: w * dpr,
            height: h * dpr,
          },
          [offscreen]
        )

        workerRef.current = worker
        setUseWorker(true)
      } catch (err) {
        console.warn('Failed to initialize OffscreenCanvas worker, falling back to main thread:', err)
        setUseWorker(false)
      }
    } else if (!supportsOffscreen) {
      setUseWorker(false)
    }

    // Handle resize
    const handleResize = () => {
      if (!containerRef.current) return
      const newRect = containerRef.current.getBoundingClientRect()
      const newW = newRect.width || 400

      setDimensions({ width: newW, height: h })

      if (workerRef.current && useWorker) {
        workerRef.current.postMessage({
          type: 'resize',
          width: newW * dpr,
          height: h * dpr,
        })
      } else if (canvasRef.current) {
        canvasRef.current.width = newW * dpr
        canvasRef.current.height = h * dpr
        const ctx = canvasRef.current.getContext('2d')
        if (ctx) {
          drawBandwidthChart(ctx, mainThreadDataRef.current, newW, h, mainThreadDecimated)
        }
      }
    }

    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      if (workerRef.current) {
        workerRef.current.terminate()
        workerRef.current = null
      }
    }
  }, [height, useWorker])

  // Trigger main thread draw if dimensions change in fallback mode
  useEffect(() => {
    if (!useWorker && canvasRef.current) {
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      if (ctx) {
        drawBandwidthChart(ctx, mainThreadDataRef.current, dimensions.width, dimensions.height, mainThreadDecimated)
      }
    }
  }, [dimensions, useWorker, mainThreadDecimated])

  return (
    <div ref={containerRef} className="rounded-lg border border-[#d8d0c1] bg-white p-4">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[#171512]">{title}</h3>
          <div className="mt-1 flex items-center gap-4 text-xs text-[#6f5f48]">
            <span className="flex items-center gap-1">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  connectionState === 'connected'
                    ? 'bg-green-500'
                    : connectionState === 'connecting'
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
                }`}
              />
              {connectionState === 'connected' ? 'Live' : connectionState === 'connecting' ? 'Connecting' : 'Disconnected'}
            </span>
            <span>{stats.pointsCount} / 300 points</span>
            {enablePerformanceTracking && (
              <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                {useWorker ? 'Worker Offscreen' : 'Main Thread Fallback'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Rendering Surface */}
      <div style={{ position: 'relative', width: '100%', height: dimensions.height }}>
        <canvas
          ref={canvasRef}
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
          }}
        />
      </div>

      {/* Stats footer */}
      {stats.pointsCount > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-4 border-t border-[#ece5d8] pt-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#6f5f48]">
              Current
            </p>
            <p className="mt-1 text-lg font-semibold text-[#1a1410]">
              {stats.current.toFixed(2)}
            </p>
            <p className="text-xs text-[#6f5f48]">Mb/s</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#6f5f48]">
              Average
            </p>
            <p className="mt-1 text-lg font-semibold text-[#1a1410]">
              {stats.average.toFixed(2)}
            </p>
            <p className="text-xs text-[#6f5f48]">Mb/s</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#6f5f48]">
              Peak
            </p>
            <p className="mt-1 text-lg font-semibold text-[#1a1410]">
              {stats.peak.toFixed(2)}
            </p>
            <p className="text-xs text-[#6f5f48]">Mb/s</p>
          </div>
        </div>
      )}
    </div>
  )
}
