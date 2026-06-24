'use client'

import { useMemo } from 'react'
import { useSolarForecast } from '@/src/hooks/useSolarForecast'

export interface SolarBatteryGaugeProps {
  facilityId: string
  nodeLabel: string
}

function gaugeColor(level: number): string {
  if (level > 60) return '#16a34a'
  if (level >= 20) return '#ca8a04'
  return '#dc2626'
}

function formatLastUpdated(timestamp: number | null): string {
  if (!timestamp) return 'Not updated yet'
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000))
  if (minutes < 1) return 'Last updated: just now'
  return `Last updated: ${minutes} min ago`
}

export function SolarBatteryGauge({ facilityId, nodeLabel }: SolarBatteryGaugeProps) {
  const forecast = useSolarForecast(facilityId)
  const currentLevel = forecast.batteryEstimate[0] ?? 0
  const circumference = 2 * Math.PI * 42
  const strokeOffset = circumference - (currentLevel / 100) * circumference
  const color = gaugeColor(currentLevel)

  const sparklinePoints = useMemo(() => {
    if (forecast.batteryEstimate.length === 0) return ''
    return forecast.batteryEstimate
      .map((level, index) => {
        const x = (index / 47) * 220
        const y = 44 - (level / 100) * 40
        return `${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(' ')
  }, [forecast.batteryEstimate])

  return (
    <article className="rounded-lg border border-[#d8d0c1] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#6f5f48]">
            Solar Forecast
          </p>
          <h3 className="mt-1 text-sm font-semibold text-[#171512]">{nodeLabel}</h3>
        </div>
        <button
          type="button"
          className="rounded-md border border-[#cfc4b1] px-2 py-1 text-xs font-medium text-[#171512] transition hover:bg-[#f7f4ee] disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => void forecast.refresh()}
          disabled={forecast.isLoading}
          aria-label={`Refresh solar forecast for ${nodeLabel}`}
        >
          {forecast.isLoading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div className="mt-4 flex items-center gap-4">
        <svg width="112" height="112" viewBox="0 0 112 112" role="img" aria-label={`Estimated battery ${currentLevel}%`}>
          <circle cx="56" cy="56" r="42" fill="none" stroke="#ece5d8" strokeWidth="12" />
          <circle
            cx="56"
            cy="56"
            r="42"
            fill="none"
            stroke={color}
            strokeLinecap="round"
            strokeWidth="12"
            strokeDasharray={circumference}
            strokeDashoffset={strokeOffset}
            transform="rotate(-90 56 56)"
          />
          <text x="56" y="52" textAnchor="middle" className="fill-[#171512] text-xl font-semibold">
            {currentLevel}%
          </text>
          <text x="56" y="69" textAnchor="middle" className="fill-[#6f5f48] text-[10px] uppercase tracking-wide">
            battery
          </text>
        </svg>

        <div className="min-w-0 flex-1">
          <p className="text-xs text-[#6f5f48]">48-hour forecast, 1-hour resolution</p>
          <p className="mt-2 text-xs text-[#171512]">{formatLastUpdated(forecast.lastUpdated)}</p>
          {(forecast.isUsingCachedForecast || forecast.isUsingFallback) && (
            <p className="mt-2 rounded bg-[#fef3c7] px-2 py-1 text-xs text-[#854d0e]">
              {forecast.isUsingFallback ? 'Using historical solar averages' : 'Using cached forecast'}
            </p>
          )}
          {forecast.error && <p className="mt-2 text-xs text-[#b91c1c]">{forecast.error}</p>}
        </div>
      </div>

      <svg className="mt-4 h-14 w-full" viewBox="0 0 220 48" preserveAspectRatio="none" aria-hidden="true">
        <polyline fill="none" stroke="#d8d0c1" strokeWidth="1" points="0,44 220,44" />
        {sparklinePoints && <polyline fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" points={sparklinePoints} />}
      </svg>
    </article>
  )
}
