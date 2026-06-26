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
    staleTime: 5000,
  })
}
