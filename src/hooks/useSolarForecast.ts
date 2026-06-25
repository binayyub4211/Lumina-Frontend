'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchSolarForecast } from '@/src/lib/weather/openMeteoClient'

const REFRESH_INTERVAL_MS = 60 * 60 * 1000
const FORECAST_HOURS = 48

interface FacilitySolarConfig {
  lat: number
  lon: number
  regression: {
    intercept: number
    slope: number
  }
}

const FACILITY_SOLAR_CONFIG: Record<string, FacilitySolarConfig> = {
  'us-east': { lat: 39.8283, lon: -77.2322, regression: { intercept: 28, slope: 0.065 } },
  'us-west': { lat: 37.7749, lon: -122.4194, regression: { intercept: 32, slope: 0.07 } },
  'eu-west': { lat: 53.3498, lon: -6.2603, regression: { intercept: 24, slope: 0.06 } },
  'eu-central': { lat: 50.1109, lon: 8.6821, regression: { intercept: 25, slope: 0.06 } },
  'ap-southeast': { lat: 1.3521, lon: 103.8198, regression: { intercept: 35, slope: 0.055 } },
  'ap-northeast': { lat: 35.6762, lon: 139.6503, regression: { intercept: 30, slope: 0.062 } },
}

export interface SolarForecastState {
  hourlyIrradiance: number[]
  batteryEstimate: number[]
  lastUpdated: number | null
  isLoading: boolean
  error: string | null
  isUsingCachedForecast: boolean
  isUsingFallback: boolean
  refresh: () => Promise<void>
}

function clampBatteryCapacity(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function estimateBatteryCapacity(
  hourlyIrradiance: number[],
  regression: FacilitySolarConfig['regression'],
): number[] {
  let capacity = regression.intercept

  return hourlyIrradiance.slice(0, FORECAST_HOURS).map((irradiance) => {
    const generation = irradiance * regression.slope
    const hourlyLoad = irradiance > 0 ? 6 : 9
    capacity = clampBatteryCapacity(capacity + generation - hourlyLoad)
    return capacity
  })
}

export function useSolarForecast(facilityId: string): SolarForecastState {
  const facility = FACILITY_SOLAR_CONFIG[facilityId]
  const [hourlyIrradiance, setHourlyIrradiance] = useState<number[]>([])
  const [batteryEstimate, setBatteryEstimate] = useState<number[]>([])
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(Boolean(facility))
  const [error, setError] = useState<string | null>(null)
  const [isUsingCachedForecast, setIsUsingCachedForecast] = useState(false)
  const [isUsingFallback, setIsUsingFallback] = useState(false)

  const loadForecast = useCallback(
    async (forceRefresh = false) => {
      if (!facility) {
        setError(`No solar forecast configuration for facility ${facilityId}`)
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        const result = await fetchSolarForecast(facility.lat, facility.lon, { forceRefresh })
        setHourlyIrradiance(result.hourlyIrradiance)
        setBatteryEstimate(estimateBatteryCapacity(result.hourlyIrradiance, facility.regression))
        setLastUpdated(result.fetchedAt)
        setIsUsingCachedForecast(result.cached)
        setIsUsingFallback(result.fallback)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load solar forecast')
      } finally {
        setIsLoading(false)
      }
    },
    [facility, facilityId],
  )

  useEffect(() => {
    void loadForecast(false)
    const interval = window.setInterval(() => void loadForecast(false), REFRESH_INTERVAL_MS)
    return () => window.clearInterval(interval)
  }, [loadForecast])

  return useMemo(
    () => ({
      hourlyIrradiance,
      batteryEstimate,
      lastUpdated,
      isLoading,
      error,
      isUsingCachedForecast,
      isUsingFallback,
      refresh: () => loadForecast(true),
    }),
    [hourlyIrradiance, batteryEstimate, lastUpdated, isLoading, error, isUsingCachedForecast, isUsingFallback, loadForecast],
  )
}
