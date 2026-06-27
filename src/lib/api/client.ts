import axios from 'axios'
import { useWorkspaceStore } from '../../store/workspaceStore'

export const apiClient = axios.create({
  baseURL: '/api',
})

// Request interceptor to inject X-Org-Id based on current active workspace
apiClient.interceptors.request.use((config) => {
  const activeOrg = useWorkspaceStore.getState().activeOrg
  const orgId = config.params?.orgId || config.headers?.['X-Org-Id'] || activeOrg?.id
  if (orgId) {
    config.headers['X-Org-Id'] = orgId
  }
  return config
})
