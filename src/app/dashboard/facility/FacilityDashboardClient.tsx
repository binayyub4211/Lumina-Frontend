'use client'

import dynamic from 'next/dynamic'

const FacilityDashboard = dynamic(
  () => import('@/src/components/dashboard/FacilityDashboard').then((mod) => mod.FacilityDashboard),
  { ssr: false },
)

export function FacilityDashboardClient() {
  return <FacilityDashboard />
}
