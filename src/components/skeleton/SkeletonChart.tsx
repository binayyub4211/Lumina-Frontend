'use client'

import { useMemo } from 'react'

export interface SkeletonChartProps {
  bars?: number
  height?: number
  className?: string
}

function randomHeights(count: number, seed: number): number[] {
  const heights: number[] = []
  let s = seed
  for (let i = 0; i < count; i++) {
    s = (s * 16807) % 2147483647
    heights.push(20 + (s % 60))
  }
  return heights
}

export function SkeletonChart({ bars = 12, height = 200, className = '' }: SkeletonChartProps) {
  const barHeights = useMemo(() => randomHeights(bars, 42), [bars])
  const barWidth = `${80 / bars}%`
  const midY = height * 0.6

  const pathD = useMemo(() => {
    const pts = barHeights.map((h, i) => {
      const x = (i / (bars - 1)) * 100
      const y = midY - (h - 20) * 1.5
      return `${x},${y}`
    })
    return `M${pts.join(' L')}`
  }, [barHeights, bars, midY])

  return (
    <div
      className={`rounded-lg border border-[#d8d0c1] bg-white p-4 ${className}`}
      aria-hidden="true"
    >
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        className="overflow-visible"
      >
        <path d={pathD} className="skeleton-chart-wave skeleton" fill="none" />
        {barHeights.map((h, i) => (
          <rect
            key={i}
            x={`${(i / bars) * 100 + 2}`}
            y={height - h}
            width={barWidth}
            height={h}
            rx="2"
            className="skeleton skeleton-chart-bar"
          />
        ))}
      </svg>
    </div>
  )
}
