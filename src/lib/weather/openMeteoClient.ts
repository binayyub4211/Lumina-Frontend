'use client'

import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

const FORECAST_HOURS = 48
const CACHE_TTL_MS = 30 * 60 * 1000
const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast'
const DB_NAME = 'lumina-solar-forecast-db'
const DB_VERSION = 1
const STORE_NAME = 'solarForecasts'
const REQUEST_TIMEOUT_MS = 450

export interface SolarForecastResponse {
  hourly: {
    time: string[]
    shortwave_radiation: number[]
  }
}

export interface SolarForecastResult {
  hourlyIrradiance: number[]
  fetchedAt: number
  cached: boolean
  fallback: boolean
}

interface SolarCacheRecord {
  key: string
  response: SolarForecastResponse
  timestamp: number
}

interface SolarForecastDb extends DBSchema {
  solarForecasts: {
    key: string
    value: SolarCacheRecord
  }
}

let dbPromise: Promise<IDBPDatabase<SolarForecastDb>> | null = null

function getSolarForecastDb(): Promise<IDBPDatabase<SolarForecastDb>> | null {
  if (typeof indexedDB === 'undefined') return null

  if (!dbPromise) {
    dbPromise = openDB<SolarForecastDb>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' })
        }
      },
    })
  }

  return dbPromise
}

function cacheKey(lat: number, lon: number): string {
  return `solar/${lat.toFixed(4)}/${lon.toFixed(4)}`
}

function normalizeForecast(response: SolarForecastResponse): number[] {
  const values = response.hourly.shortwave_radiation
  return Array.from({ length: FORECAST_HOURS }, (_, index) => {
    const value = values[index]
    return Number.isFinite(value) ? Math.max(0, value) : 0
  })
}

function historicalAverageForecast(): number[] {
  return Array.from({ length: FORECAST_HOURS }, (_, index) => {
    const hour = index % 24
    if (hour < 6 || hour > 18) return 0
    const daylightProgress = (hour - 6) / 12
    return Math.round(Math.sin(daylightProgress * Math.PI) * 520)
  })
}

async function readCachedForecast(key: string): Promise<SolarCacheRecord | null> {
  const db = await getSolarForecastDb()
  if (!db) return null
  return (await db.get(STORE_NAME, key)) ?? null
}

async function writeCachedForecast(record: SolarCacheRecord): Promise<void> {
  const db = await getSolarForecastDb()
  if (!db) return
  await db.put(STORE_NAME, record)
}

async function fetchWithTimeout(url: string): Promise<SolarForecastResponse> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) {
      throw new Error(`Open-Meteo request failed with ${response.status}`)
    }
    return (await response.json()) as SolarForecastResponse
  } finally {
    window.clearTimeout(timeout)
  }
}

export async function fetchSolarForecast(
  lat: number,
  lon: number,
  options: { forceRefresh?: boolean } = {},
): Promise<SolarForecastResult> {
  const key = cacheKey(lat, lon)
  const cached = await readCachedForecast(key)
  const now = Date.now()

  if (!options.forceRefresh && cached && now - cached.timestamp < CACHE_TTL_MS) {
    return {
      hourlyIrradiance: normalizeForecast(cached.response),
      fetchedAt: cached.timestamp,
      cached: true,
      fallback: false,
    }
  }

  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    hourly: 'shortwave_radiation',
    timezone: 'auto',
    forecast_days: '2',
  })

  try {
    const response = await fetchWithTimeout(`${OPEN_METEO_URL}?${params.toString()}`)
    const timestamp = Date.now()
    await writeCachedForecast({ key, response, timestamp })

    return {
      hourlyIrradiance: normalizeForecast(response),
      fetchedAt: timestamp,
      cached: false,
      fallback: false,
    }
  } catch {
    if (cached) {
      return {
        hourlyIrradiance: normalizeForecast(cached.response),
        fetchedAt: cached.timestamp,
        cached: true,
        fallback: false,
      }
    }

    return {
      hourlyIrradiance: historicalAverageForecast(),
      fetchedAt: now,
      cached: false,
      fallback: true,
    }
  }
}
