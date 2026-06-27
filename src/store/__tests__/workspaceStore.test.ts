import { useWorkspaceStore } from '../workspaceStore'
import { withOrgScope } from '../../utils/withOrgScope'

// Simple mock for TanStack React Query useQuery
const mockUseQuery = (config: any) => {
  return {
    queryKey: config.queryKey,
    queryFn: config.queryFn,
  }
}

// Simple mock for Axios Client response behavior
const mockData: Record<string, any> = {
  'org-a': { nodes: [{ id: 'node-a', name: 'Node A' }] },
  'org-b': { nodes: [{ id: 'node-b', name: 'Node B' }] },
  'org-c': { nodes: [{ id: 'node-c', name: 'Node C' }] },
}

const mockApiClient = {
  get: async (url: string, config?: any) => {
    // Prioritize headers, then params, then activeOrg ID
    const orgId = config?.headers?.['X-Org-Id'] || config?.params?.orgId || useWorkspaceStore.getState().activeOrg?.id
    const data = mockData[orgId || ''] || { nodes: [] }
    return { data }
  }
}

// Scoped hook under test (representing useNodeList)
function testUseNodeList(orgId?: string) {
  return mockUseQuery({
    queryKey: ['nodes', orgId],
    queryFn: async () => {
      // Prioritize explicit orgId, falling back to dynamic activeOrg
      const activeOrg = useWorkspaceStore.getState().activeOrg
      const targetOrgId = orgId || activeOrg?.id
      
      const headers: Record<string, string> = {}
      if (targetOrgId) {
        headers['X-Org-Id'] = targetOrgId
      }
      
      const response = await mockApiClient.get('/nodes', {
        headers,
        params: orgId ? { orgId } : undefined,
      })
      return response.data
    }
  })
}

// Custom assertions helper
function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`)
  }
}

console.log('--- Starting WorkspaceStore Multi-Tenant Scoping Tests ---')

// Mock environment initialization
const mockOrgs = [
  { id: 'org-a', name: 'Kynova Org A', slug: 'org-a' },
  { id: 'org-b', name: 'Kynova Org B', slug: 'org-b' },
  { id: 'org-c', name: 'Kynova Org C', slug: 'org-c' },
]
const mockPermissions = {
  'org-a': 15, // full: READ(1) + CREATE(2) + UPDATE(4) + DELETE(8) = 15
  'org-b': 1,  // read-only: READ(1) = 1
  'org-c': 3,  // read + create: READ(1) + CREATE(2) = 3
}

// Initialize the store
useWorkspaceStore.getState().initializeOrgs(mockOrgs, mockPermissions)

async function runTests() {
  // Test 1: Workspace store active organization switching
  try {
    console.log('\nTest 1: Workspace store switching')
    
    const store = useWorkspaceStore.getState()
    assert(store.activeOrg?.slug === 'org-a', 'Default selection should be the first organization (org-a)')
    assert(store.activePermissionMask === 15, 'Org A mask should be 15')

    // Switch to org-b
    store.switchWorkspace('org-b')
    const storeAfterB = useWorkspaceStore.getState()
    assert(storeAfterB.activeOrg?.slug === 'org-b', 'Active organization slug should be org-b')
    assert(storeAfterB.activePermissionMask === 1, 'Org B mask should be 1')

    console.log('✅ Workspace switcher state verified')
  } catch (err: any) {
    console.error('❌ Test 1 failed:', err.message)
    process.exit(1)
  }

  // Test 2: Scoped mutation permission mask gating (withOrgScope HOC)
  try {
    console.log('\nTest 2: Scoped mutation permission mask gating')
    
    const READ = 1
    const CREATE = 2
    const UPDATE = 4
    const DELETE = 8

    let mutationExecuted = false
    const mutateAction = () => {
      mutationExecuted = true
    }

    // Switch back to org-b (read-only: mask = 1)
    useWorkspaceStore.getState().switchWorkspace('org-b')

    let accessDeniedMessage = ''
    const onAccessDenied = (msg: string) => {
      accessDeniedMessage = msg
    }

    // Wrap mutate action with CREATE scope
    const guardedCreateAction = withOrgScope(CREATE, mutateAction, onAccessDenied)
    
    // Try executing - should deny access since Org B has only mask 1
    mutationExecuted = false
    guardedCreateAction()
    assert(!mutationExecuted, 'Mutation action should NOT execute when permission mask is missing CREATE bit')
    assert(accessDeniedMessage.includes('Permission denied'), 'Access denied callback should be triggered')
    console.log('- Mutation correctly blocked on Org B (Read-Only)')

    // Switch to org-c (read + create: mask = 3)
    useWorkspaceStore.getState().switchWorkspace('org-c')
    
    mutationExecuted = false
    accessDeniedMessage = ''
    guardedCreateAction()
    assert(mutationExecuted, 'Mutation action SHOULD execute when permission mask contains CREATE bit')
    assert(accessDeniedMessage === '', 'Access denied callback should NOT be triggered')
    console.log('- Mutation allowed on Org C (Read + Create)')

    // Wrap mutate action with UPDATE scope (requires bit 4)
    const guardedUpdateAction = withOrgScope(UPDATE, mutateAction, onAccessDenied)
    
    mutationExecuted = false
    accessDeniedMessage = ''
    guardedUpdateAction()
    assert(!mutationExecuted, 'Mutation action should NOT execute when mask lacks UPDATE bit')
    console.log('- Mutation correctly blocked on Org C for Update')

    console.log('✅ Scoped permission masks gated correctly')
  } catch (err: any) {
    console.error('❌ Test 2 failed:', err.message)
    process.exit(1)
  }

  // Test 3: Query cache keys and dynamic X-Org-Id header injection switching rapidly
  try {
    console.log('\nTest 3: Query client isolation & rapid workspace switching')

    // Switch to org-a
    useWorkspaceStore.getState().switchWorkspace('org-a')
    const queryA = testUseNodeList('org-a')
    assert(queryA.queryKey[1] === 'org-a', 'Query key must incorporate org-a')
    
    const dataA = await queryA.queryFn()
    assert(dataA.nodes[0].id === 'node-a', 'Queries for Org A must return Org A data')

    // Switch rapidly to org-b
    useWorkspaceStore.getState().switchWorkspace('org-b')
    const queryB = testUseNodeList('org-b')
    assert(queryB.queryKey[1] === 'org-b', 'Query key must incorporate org-b')
    
    const dataB = await queryB.queryFn()
    assert(dataB.nodes[0].id === 'node-b', 'Queries for Org B must return Org B data')

    // Verify that data from Org B does not overwrite or resolve for Query A
    const dataA_Rechecked = await queryA.queryFn()
    assert(dataA_Rechecked.nodes[0].id === 'node-a', 'Re-evaluation of Org A query must still yield Org A data')

    console.log('✅ Dynamic request header X-Org-Id and Query key scoping verified')
  } catch (err: any) {
    console.error('❌ Test 3 failed:', err.message)
    process.exit(1)
  }

  console.log('\n✅ All multi-tenant workspace switching tests passed successfully!')
}

runTests().catch((err) => {
  console.error('Test execution failed:', err)
  process.exit(1)
})
