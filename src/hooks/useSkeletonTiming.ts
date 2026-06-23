'use client'

import { useEffect, useRef, useState } from 'react'

const MIN_DISPLAY_MS = 300
const MAX_DISPLAY_MS = 10_000

export function useSkeletonTiming(
  getReady: () => boolean,
  subscribe: (listener: () => void) => () => void,
): { showSkeleton: boolean; timedOut: boolean } {
  const [showSkeleton, setShowSkeleton] = useState(true)
  const [timedOut, setTimedOut] = useState(false)

  const dataReadyRef = useRef(false)
  const startTimeRef = useRef(Date.now())
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const getReadyRef = useRef(getReady)
  const subscribeRef = useRef(subscribe)
  getReadyRef.current = getReady
  subscribeRef.current = subscribe

  useEffect(() => {
    const maxTimer = setTimeout(() => {
      if (!dataReadyRef.current) {
        setTimedOut(true)
      }
    }, MAX_DISPLAY_MS)
    maxTimerRef.current = maxTimer

    const unsub = subscribeRef.current(() => {
      if (dataReadyRef.current) return

      const ready = getReadyRef.current()
      if (ready) {
        dataReadyRef.current = true
        clearTimeout(maxTimer)

        const elapsed = Date.now() - startTimeRef.current
        const remaining = Math.max(0, MIN_DISPLAY_MS - elapsed)

        timerRef.current = setTimeout(() => {
          setShowSkeleton(false)
        }, remaining)
      }
    })

    if (getReadyRef.current()) {
      dataReadyRef.current = true
      clearTimeout(maxTimer)
      const elapsed = Date.now() - startTimeRef.current
      const remaining = Math.max(0, MIN_DISPLAY_MS - elapsed)
      timerRef.current = setTimeout(() => {
        setShowSkeleton(false)
      }, remaining)
    }

    return () => {
      unsub()
      if (timerRef.current) clearTimeout(timerRef.current)
      if (maxTimerRef.current) clearTimeout(maxTimerRef.current)
    }
  }, [])

  return { showSkeleton, timedOut }
}
