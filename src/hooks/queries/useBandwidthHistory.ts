import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../lib/api/client'

export function useBandwidthHistory(orgId?: string) {
  return useQuery({
    queryKey: ['bandwidth', orgId],
    queryFn: async () => {
      const response = await apiClient.get('/bandwidth', {
        params: orgId ? { orgId } : undefined,
      })
      return response.data
    },
    // Real-time chart: short stale-while-revalidate window (2s hard ceiling).
    staleTime: 2_000,
    gcTime: 30_000,
  })
}
