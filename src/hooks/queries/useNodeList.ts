import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../lib/api/client'

export function useNodeList(orgId?: string) {
  return useQuery({
    queryKey: ['nodes', orgId],
    queryFn: async () => {
      const response = await apiClient.get('/nodes', {
        params: orgId ? { orgId } : undefined,
      })
      return response.data
    },
    staleTime: 5000,
  })
}
