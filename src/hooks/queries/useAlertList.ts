import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../lib/api/client'

export function useAlertList(orgId?: string) {
  return useQuery({
    queryKey: ['alerts', orgId],
    queryFn: async () => {
      const response = await apiClient.get('/alerts', {
        params: orgId ? { orgId } : undefined,
      })
      return response.data
    },
    staleTime: 5000,
    gcTime: 30_000,
  })
}
