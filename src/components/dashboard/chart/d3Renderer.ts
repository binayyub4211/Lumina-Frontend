import type { BandwidthDataPoint } from '../../../hooks/useBandwidthStream'

export interface DecimatedDataPoint {
  timestamp: number
  min: number
  max: number
  avg: number
}

/**
 * Aggregates 1-second data points into 5-second buckets for decimated rendering
 */
export function aggregateData(data: BandwidthDataPoint[]): DecimatedDataPoint[] {
  if (data.length === 0) return []

  const bucketSizeMs = 5000
  const buckets = new Map<number, BandwidthDataPoint[]>()

  data.forEach((pt) => {
    const bucketKey = Math.floor(pt.timestamp / bucketSizeMs) * bucketSizeMs
    if (!buckets.has(bucketKey)) {
      buckets.set(bucketKey, [])
    }
    buckets.get(bucketKey)!.push(pt)
  })

  const aggregated: DecimatedDataPoint[] = []
  const sortedKeys = Array.from(buckets.keys()).sort((a, b) => a - b)

  sortedKeys.forEach((key) => {
    const points = buckets.get(key)!
    const values = points.map((p) => p.value)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length

    aggregated.push({
      timestamp: key,
      min,
      max,
      avg,
    })
  })

  return aggregated
}

/**
 * Renders the bandwidth usage chart on a Canvas 2D / OffscreenCanvas context
 */
export function drawBandwidthChart(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  data: BandwidthDataPoint[],
  width: number,
  height: number,
  isDecimated: boolean
): void {
  // Clear the canvas
  ctx.clearRect(0, 0, width, height)

  if (data.length === 0) {
    ctx.fillStyle = '#6f5f48'
    ctx.font = '14px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('Waiting for bandwidth data stream...', width / 2, height / 2)
    return
  }

  // Padding
  const paddingLeft = 45
  const paddingRight = 15
  const paddingTop = 20
  const paddingBottom = 30

  const chartWidth = width - paddingLeft - paddingRight
  const chartHeight = height - paddingTop - paddingBottom

  // Find dynamic Y limits
  let maxValue = 10 // Minimum range height
  if (isDecimated) {
    const aggregated = aggregateData(data)
    if (aggregated.length > 0) {
      maxValue = Math.max(...aggregated.map((d) => d.max), 10)
    }
  } else {
    maxValue = Math.max(...data.map((d) => d.value), 10)
  }
  const yMax = maxValue * 1.15 // 15% headroom

  // Helper to map values to Y coordinate
  const getY = (val: number) => {
    return height - paddingBottom - (val / yMax) * chartHeight
  }

  // Draw background grid lines & labels
  ctx.strokeStyle = '#ece5d8'
  ctx.lineWidth = 1
  ctx.fillStyle = '#6f5f48'
  ctx.font = '10px sans-serif'
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'

  const gridLineCount = 4
  for (let i = 0; i <= gridLineCount; i++) {
    const val = (yMax / gridLineCount) * i
    const y = getY(val)
    ctx.beginPath()
    ctx.moveTo(paddingLeft, y)
    ctx.lineTo(width - paddingRight, y)
    ctx.stroke()

    // Draw Y label
    ctx.fillText(`${val.toFixed(1)} Mb/s`, paddingLeft - 8, y)
  }

  // Draw visual content based on mode
  if (isDecimated) {
    // Decimated Rendering: 5-second aggregation windows
    const aggregated = aggregateData(data)
    if (aggregated.length === 0) return

    // Show a fixed window of the last 12 buckets (representing 60 seconds)
    const maxBuckets = 12
    const displayData = aggregated.slice(-maxBuckets)

    const barWidth = Math.max(8, (chartWidth / maxBuckets) * 0.4)
    const gap = (chartWidth / maxBuckets) * 0.6

    displayData.forEach((d, idx) => {
      const x = paddingLeft + idx * (barWidth + gap) + gap / 2

      // Draw range bar (min to max)
      const yMaxVal = getY(d.max)
      const yMinVal = getY(d.min)
      const barHeight = Math.max(2, yMinVal - yMaxVal)

      // Gradient for min-max range (vibrant/soft purple mix)
      const rangeGrad = ctx.createLinearGradient(x, yMaxVal, x, yMinVal)
      rangeGrad.addColorStop(0, 'rgba(179, 136, 255, 0.4)') // Soft Purple
      rangeGrad.addColorStop(1, 'rgba(79, 195, 247, 0.15)')  // Premium Blue

      ctx.fillStyle = rangeGrad
      ctx.beginPath()
      ctx.roundRect(x, yMaxVal, barWidth, barHeight, 4)
      ctx.fill()

      // Highlight the average point inside the range bar
      const yAvg = getY(d.avg)
      ctx.fillStyle = '#00E5FF' // Aqua Cyan for average
      ctx.beginPath()
      ctx.arc(x + barWidth / 2, yAvg, 4, 0, Math.PI * 2)
      ctx.fill()

      // Draw a subtle border around the average indicator for premium styling
      ctx.strokeStyle = '#FFFFFF'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(x + barWidth / 2, yAvg, 4, 0, Math.PI * 2)
      ctx.stroke()

      // Draw X axis timestamp label (middle of 5s bucket)
      if (idx % 2 === 0) {
        const timeStr = new Date(d.timestamp).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
        ctx.fillStyle = '#6f5f48'
        ctx.textAlign = 'center'
        ctx.fillText(timeStr, x + barWidth / 2, height - paddingBottom + 15)
      }
    })
  } else {
    // Normal Rendering: 1-second interval bars
    // Show last 60 points (60 seconds)
    const maxPoints = 60
    const displayData = data.slice(-maxPoints)

    const barWidth = Math.max(3, (chartWidth / maxPoints) * 0.7)
    const gap = (chartWidth / maxPoints) * 0.3

    displayData.forEach((d, idx) => {
      const x = paddingLeft + idx * (barWidth + gap) + gap / 2
      const y = getY(d.value)
      const barHeight = Math.max(1, height - paddingBottom - y)

      // Gradient color (Premium Blue to Aqua Cyan)
      const grad = ctx.createLinearGradient(x, y, x, height - paddingBottom)
      grad.addColorStop(0, '#4FC3F7') // Premium Blue
      grad.addColorStop(1, '#00E5FF') // Aqua Cyan

      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.roundRect(x, y, barWidth, barHeight, 2)
      ctx.fill()

      // Draw X label every 15 seconds
      if (idx % 15 === 0) {
        const timeStr = new Date(d.timestamp).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
        ctx.fillStyle = '#6f5f48'
        ctx.textAlign = 'center'
        ctx.fillText(timeStr, x + barWidth / 2, height - paddingBottom + 15)
      }
    })
  }

  // Draw chart border
  ctx.strokeStyle = '#d8d0c1'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(paddingLeft, paddingTop)
  ctx.lineTo(paddingLeft, height - paddingBottom)
  ctx.lineTo(width - paddingRight, height - paddingBottom)
  ctx.stroke()
}
