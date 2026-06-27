/**
 * useDataThrottle - Generic throttling hook for high-frequency data streams
 * 
 * Features:
 * - Accumulates messages between render intervals
 * - Zero message loss - all data is captured
 * - First message triggers immediate render
 * - Subsequent messages batched until interval expires
 * - Uses requestAnimationFrame for optimal rendering
 * - Automatic flush on unmount
 */

import { useCallback, useEffect, useRef, useState } from 'react'

export interface ThrottleConfig {
  /** Minimum interval between renders in milliseconds */
  intervalMs: number
  /** Maximum buffer size before forcing a flush */
  maxBufferSize?: number
  /** Enable performance monitoring */
  enablePerformanceTracking?: boolean
}

export interface ThrottleMetrics {
  messagesReceived: number
  rendersTriggered: number
  messagesPerRender: number
  lastRenderDuration: number
}

export function useDataThrottle<T>(config: ThrottleConfig) {
  const { intervalMs, maxBufferSize = 1000, enablePerformanceTracking = false } = config

  const [data, setData] = useState<T[]>([])
  const [metrics, setMetrics] = useState<ThrottleMetrics>({
    messagesReceived: 0,
    rendersTriggered: 0,
    messagesPerRender: 0,
    lastRenderDuration: 0,
  })

  // Internal buffer for accumulating messages
  const bufferRef = useRef<T[]>([])
  const lastFlushTimeRef = useRef<number>(0)
  const rafIdRef = useRef<number | null>(null)
  const metricsRef = useRef<ThrottleMetrics>(metrics)
  const isFirstMessageRef = useRef(true)

  // Flush accumulated data to state (triggers render)
  const flush = useCallback(() => {
    if (bufferRef.current.length === 0) return

    const startMark = enablePerformanceTracking ? performance.now() : 0

    // Move buffer data to state
    const flushedData = bufferRef.current
    bufferRef.current = []
    lastFlushTimeRef.current = Date.now()

    setData(flushedData)

    // Update metrics
    if (enablePerformanceTracking) {
      const duration = performance.now() - startMark
      
      metricsRef.current = {
        messagesReceived: metricsRef.current.messagesReceived,
        rendersTriggered: metricsRef.current.rendersTriggered + 1,
        messagesPerRender: flushedData.length,
        lastRenderDuration: duration,
      }
      setMetrics(metricsRef.current)

      // Log warning if render is slow
      if (duration > 16) {
        console.warn(
          `[useDataThrottle] Slow render detected: ${duration.toFixed(2)}ms ` +
          `(${flushedData.length} messages)`
        )
      }
    }

    // Cancel any pending RAF
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }
  }, [enablePerformanceTracking])

  // Schedule a flush using requestAnimationFrame
  const scheduleFlush = useCallback(() => {
    // Don't schedule if already scheduled
    if (rafIdRef.current !== null) return

    const timeSinceLastFlush = Date.now() - lastFlushTimeRef.current

    if (timeSinceLastFlush >= intervalMs) {
      // Interval has elapsed, flush immediately on next frame
      rafIdRef.current = requestAnimationFrame(flush)
    } else {
      // Schedule flush after remaining interval time
      const remainingTime = intervalMs - timeSinceLastFlush
      setTimeout(() => {
        rafIdRef.current = requestAnimationFrame(flush)
      }, remainingTime)
    }
  }, [intervalMs, flush])

  // Push a single message into the buffer
  const push = useCallback((message: T) => {
    bufferRef.current.push(message)

    // Update metrics
    if (enablePerformanceTracking) {
      metricsRef.current.messagesReceived++
    }

    // First message triggers immediate render
    if (isFirstMessageRef.current) {
      isFirstMessageRef.current = false
      rafIdRef.current = requestAnimationFrame(flush)
      return
    }

    // Force flush if buffer is at max capacity
    if (bufferRef.current.length >= maxBufferSize) {
      rafIdRef.current = requestAnimationFrame(flush)
      return
    }

    // Otherwise schedule next flush
    scheduleFlush()
  }, [flush, maxBufferSize, scheduleFlush, enablePerformanceTracking])

  // Push multiple messages at once
  const pushBatch = useCallback((messages: T[]) => {
    if (messages.length === 0) return

    bufferRef.current.push(...messages)

    // Update metrics
    if (enablePerformanceTracking) {
      metricsRef.current.messagesReceived += messages.length
    }

    // First message triggers immediate render
    if (isFirstMessageRef.current) {
      isFirstMessageRef.current = false
      rafIdRef.current = requestAnimationFrame(flush)
      return
    }

    // Force flush if buffer exceeds max capacity
    if (bufferRef.current.length >= maxBufferSize) {
      rafIdRef.current = requestAnimationFrame(flush)
      return
    }

    // Otherwise schedule next flush
    scheduleFlush()
  }, [flush, maxBufferSize, scheduleFlush, enablePerformanceTracking])

  // Manually trigger a flush
  const forceFlush = useCallback(() => {
    flush()
  }, [flush])

  // Reset the throttle state
  const reset = useCallback(() => {
    bufferRef.current = []
    lastFlushTimeRef.current = 0
    isFirstMessageRef.current = true
    setData([])
    
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }

    if (enablePerformanceTracking) {
      const resetMetrics: ThrottleMetrics = {
        messagesReceived: 0,
        rendersTriggered: 0,
        messagesPerRender: 0,
        lastRenderDuration: 0,
      }
      metricsRef.current = resetMetrics
      setMetrics(resetMetrics)
    }
  }, [enablePerformanceTracking])

  // Cleanup on unmount - flush remaining data
  useEffect(() => {
    return () => {
      if (bufferRef.current.length > 0) {
        // Flush any remaining buffered data before unmounting
        flush()
      }
      
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
      }
    }
  }, [flush])

  return {
    /** Current batch of data (updated on flush) */
    data,
    /** Add a single message to the buffer */
    push,
    /** Add multiple messages to the buffer */
    pushBatch,
    /** Manually trigger a flush */
    forceFlush,
    /** Reset all state */
    reset,
    /** Performance metrics (only if tracking enabled) */
    metrics: enablePerformanceTracking ? metrics : null,
  }
}
