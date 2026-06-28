/**
 * Tests for the Network Sync Zustand Store.
 *
 * Run: npx tsx src/store/__tests__/networkSyncStore.test.ts
 */

import { useNetworkSyncStore } from '../networkSyncStore'

let failures = 0
function check(label: string, cond: boolean) {
  if (cond) {
    console.log(`  ✅ ${label}`)
  } else {
    console.error(`  ❌ ${label}`)
    failures++
  }
}

async function runTests() {
  console.log('\nTest: Initial state')
  {
    const state = useNetworkSyncStore.getState()
    check('clusterId is null initially', state.clusterId === null)
    check('peers is empty initially', Object.keys(state.peers).length === 0)
    check('webrtcActive is false initially', !state.webrtcActive)
    check('pollingIntervalMs is 0 initially', state.pollingIntervalMs === 0)
  }

  console.log('\nTest: setClusterId')
  {
    useNetworkSyncStore.getState().setClusterId('cluster-1')
    check('clusterId set to cluster-1', useNetworkSyncStore.getState().clusterId === 'cluster-1')
    useNetworkSyncStore.getState().setClusterId(null)
  }

  console.log('\nTest: addPeer')
  {
    const store = useNetworkSyncStore.getState()
    store.addPeer('peer-1', 'webrtc')
    const state = useNetworkSyncStore.getState()
    check('peer-1 exists in peers', state.peers['peer-1'] !== undefined)
    check('peer-1 mode is webrtc', state.peers['peer-1']?.mode === 'webrtc')
    check('peer-1 lastStatusAt is null initially', state.peers['peer-1']?.lastStatusAt === null)
    check('peer-1 latencyMs is null initially', state.peers['peer-1']?.latencyMs === null)
  }

  console.log('\nTest: updatePeerMode')
  {
    const store = useNetworkSyncStore.getState()
    store.updatePeerMode('peer-1', 'polling')
    check('peer-1 mode changed to polling', useNetworkSyncStore.getState().peers['peer-1']?.mode === 'polling')
    store.updatePeerMode('peer-1', 'webrtc')
  }

  console.log('\nTest: updatePeerStatus')
  {
    const store = useNetworkSyncStore.getState()
    store.updatePeerStatus('peer-1', 42)
    const state = useNetworkSyncStore.getState()
    check('peer-1 latencyMs is 42', state.peers['peer-1']?.latencyMs === 42)
    check('peer-1 lastStatusAt is set', state.peers['peer-1']?.lastStatusAt !== null)
    check('peer-1 lastStatusAt is ISO date string', /^\d{4}-\d{2}-\d{2}T/.test(state.peers['peer-1']?.lastStatusAt ?? ''))
  }

  console.log('\nTest: updatePeerMode for unknown peer is no-op')
  {
    const before = useNetworkSyncStore.getState()
    before.updatePeerMode('ghost-peer', 'webrtc')
    const after = useNetworkSyncStore.getState()
    check('ghost peer not added', after.peers['ghost-peer'] === undefined)
  }

  console.log('\nTest: removePeer')
  {
    const store = useNetworkSyncStore.getState()
    store.removePeer('peer-1')
    check('peer-1 removed', useNetworkSyncStore.getState().peers['peer-1'] === undefined)
  }

  console.log('\nTest: setWebrtcActive')
  {
    const store = useNetworkSyncStore.getState()
    store.setWebrtcActive(true)
    check('webrtcActive is true', useNetworkSyncStore.getState().webrtcActive)
    store.setWebrtcActive(false)
    check('webrtcActive is false again', !useNetworkSyncStore.getState().webrtcActive)
  }

  console.log('\nTest: setPollingInterval')
  {
    const store = useNetworkSyncStore.getState()
    store.setPollingInterval(2_000)
    check('pollingIntervalMs is 2000', useNetworkSyncStore.getState().pollingIntervalMs === 2_000)
    store.setPollingInterval(0)
    check('pollingIntervalMs reset to 0', useNetworkSyncStore.getState().pollingIntervalMs === 0)
  }

  console.log('\nTest: Multiple peers')
  {
    const store = useNetworkSyncStore.getState()
    store.addPeer('peer-a', 'webrtc')
    store.addPeer('peer-b', 'polling')
    store.addPeer('peer-c', 'disconnected')
    const state = useNetworkSyncStore.getState()
    check('3 peers present', Object.keys(state.peers).length === 3)
    check('peer-a mode webrtc', state.peers['peer-a']?.mode === 'webrtc')
    check('peer-b mode polling', state.peers['peer-b']?.mode === 'polling')
    check('peer-c mode disconnected', state.peers['peer-c']?.mode === 'disconnected')

    // Cleanup
    store.removePeer('peer-a')
    store.removePeer('peer-b')
    store.removePeer('peer-c')
    check('all peers cleaned up', Object.keys(useNetworkSyncStore.getState().peers).length === 0)
  }

  console.log('')
  if (failures > 0) {
    console.error(`❌ ${failures} assertion(s) failed`)
    process.exit(1)
  }
  console.log('✅ All network sync store tests passed')
}

runTests().catch((err) => {
  console.error('Test execution failed:', err)
  process.exit(1)
})
