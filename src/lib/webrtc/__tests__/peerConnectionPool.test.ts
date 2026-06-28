/**
 * Tests for the WebRTC Peer Connection Pool.
 *
 * Tests pool lifecycle, peer add/remove, data channel messaging, ICE timeout,
 * and mesh size limits.
 *
 * Run: npx tsx src/lib/webrtc/__tests__/peerConnectionPool.test.ts
 */

import { PeerConnectionPool, type PeerEvent } from '../peerConnectionPool'

// ── Mocks for RTCPeerConnection / RTCDataChannel ─────────────────────────

interface MockDataChannel {
  label: string
  readyState: RTCDataChannelState
  onmessage: ((event: { data: string }) => void) | null
  onerror: (() => void) | null
  sent: string[]
  close(): void
  send(data: string): void
}

const mockPCs: MockPeerConnectionClass[] = []

// Holds mutable state for each mock RTCPeerConnection
class MockPeerConnectionClass {
  _iceConnectionState: RTCIceConnectionState = 'new'
  oniceconnectionstatechange: (() => void) | null = null
  onicecandidate: ((event: { candidate: RTCIceCandidate | null }) => void) | null = null
  ondatachannel: ((event: { channel: MockDataChannel }) => void) | null = null
  _localDescription: RTCSessionDescriptionInit | null = null
  _remoteDescription: RTCSessionDescriptionInit | null = null
  dataChannels: MockDataChannel[] = []

  constructor() {
    mockPCs.push(this)
  }

  createDataChannel(label: string, _options?: RTCDataChannelInit): MockDataChannel {
    const ch: MockDataChannel = {
      label,
      readyState: 'open',
      onmessage: null,
      onerror: null,
      sent: [],
      close() {},
      send(data: string) {
        this.sent.push(data)
      },
    }
    this.dataChannels.push(ch)
    return ch
  }

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    const offer: RTCSessionDescriptionInit = { type: 'offer', sdp: 'mock-sdp' }
    this._localDescription = offer
    return offer
  }

  async createAnswer(): Promise<RTCSessionDescriptionInit> {
    const answer: RTCSessionDescriptionInit = { type: 'answer', sdp: 'mock-sdp' }
    this._localDescription = answer
    return answer
  }

  async setLocalDescription(desc: RTCSessionDescriptionInit): Promise<void> {
    this._localDescription = desc
  }

  async setRemoteDescription(desc: RTCSessionDescriptionInit): Promise<void> {
    this._remoteDescription = desc
  }

  async addIceCandidate(_candidate: RTCIceCandidate): Promise<void> {}

  close() {}
}

// Install / uninstall mocks
const OriginalRTCPeerConnection = (globalThis as unknown as Record<string, unknown>).RTCPeerConnection
const OriginalRTCIceCandidate = (globalThis as unknown as Record<string, unknown>).RTCIceCandidate

function installMocks() {
  mockPCs.length = 0

  // The mock class we install as globalThis.RTCPeerConnection.
  // It wraps MockPeerConnectionClass, forwarding all relevant properties.
  class MockRTCWrapper {
    private inner: MockPeerConnectionClass

    constructor() {
      this.inner = new MockPeerConnectionClass()
    }

    get iceConnectionState() { return this.inner._iceConnectionState }
    set iceConnectionState(v: RTCIceConnectionState) { this.inner._iceConnectionState = v }

    get oniceconnectionstatechange() { return this.inner.oniceconnectionstatechange }
    set oniceconnectionstatechange(v: (() => void) | null) { this.inner.oniceconnectionstatechange = v }

    get onicecandidate() { return this.inner.onicecandidate }
    set onicecandidate(v: ((event: { candidate: RTCIceCandidate | null }) => void) | null) { this.inner.onicecandidate = v }

    get ondatachannel() { return this.inner.ondatachannel }
    set ondatachannel(v: ((event: { channel: MockDataChannel }) => void) | null) { this.inner.ondatachannel = v }

    get localDescription() { return this.inner._localDescription }
    get remoteDescription() { return this.inner._remoteDescription }

    createDataChannel(label: string, options?: RTCDataChannelInit) {
      return this.inner.createDataChannel(label, options)
    }

    createOffer() { return this.inner.createOffer() }
    createAnswer() { return this.inner.createAnswer() }
    setLocalDescription(desc: RTCSessionDescriptionInit) { return this.inner.setLocalDescription(desc) }
    setRemoteDescription(desc: RTCSessionDescriptionInit) { return this.inner.setRemoteDescription(desc) }
    addIceCandidate(candidate: RTCIceCandidate) { return this.inner.addIceCandidate(candidate) }
    close() { this.inner.close() }
  }

  ;(globalThis as unknown as Record<string, unknown>).RTCPeerConnection = MockRTCWrapper as unknown as typeof RTCPeerConnection

  ;(globalThis as unknown as Record<string, unknown>).RTCIceCandidate = class {
    constructor(_init?: RTCIceCandidateInit) {}
  } as unknown as typeof RTCIceCandidate
}

function uninstallMocks() {
  if (OriginalRTCPeerConnection) {
    (globalThis as unknown as Record<string, unknown>).RTCPeerConnection = OriginalRTCPeerConnection
  }
  if (OriginalRTCIceCandidate) {
    (globalThis as unknown as Record<string, unknown>).RTCIceCandidate = OriginalRTCIceCandidate
  }
}

// ── Test helpers ──────────────────────────────────────────────────────────

let failures = 0
function check(label: string, cond: boolean) {
  if (cond) {
    console.log(`  ✅ ${label}`)
  } else {
    console.error(`  ❌ ${label}`)
    failures++
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────

async function runTests() {
  installMocks()

  console.log('\nTest: Pool construction and initial state')
  {
    const pool = new PeerConnectionPool()
    check('peerCount starts at 0', pool.peerCount === 0)
    check('connectedPeers is empty', pool.connectedPeers.length === 0)
    check('failedPeers is empty', pool.failedPeers.length === 0)
    pool.destroy()
  }

  console.log('\nTest: Add peer as offerer creates connection + data channels + offer')
  {
    mockPCs.length = 0
    const pool = new PeerConnectionPool()

    const result = await pool.addPeerAsOfferer('peer-1')
    check('offer has type offer', result.offer.type === 'offer')
    check('peerCount is 1', pool.peerCount === 1)
    check('peer-1 is not yet connected (waiting for ICE)', !pool.connectedPeers.includes('peer-1'))

    pool.destroy()
  }

  console.log('\nTest: Add peer as answerer')
  {
    mockPCs.length = 0
    const pool = new PeerConnectionPool()

    const result = await pool.addPeerAsAnswerer('peer-2', {
      type: 'offer',
      sdp: 'remote-offer',
    })
    check('answer has type answer', result.answer.type === 'answer')
    check('peerCount is 1', pool.peerCount === 1)

    pool.destroy()
  }

  console.log('\nTest: Complete offer/answer exchange between two peers')
  {
    mockPCs.length = 0
    const pool = new PeerConnectionPool()

    const { offer } = await pool.addPeerAsOfferer('peer-1')
    const { answer } = await pool.addPeerAsAnswerer('peer-2', offer)
    await pool.applyAnswer('peer-1', answer)

    check('both peers present', pool.peerCount === 2)
    pool.destroy()
  }

  console.log('\nTest: Max peer limit enforcement')
  {
    mockPCs.length = 0
    const pool = new PeerConnectionPool({ maxPeers: 2 })

    await pool.addPeerAsOfferer('peer-1')
    await pool.addPeerAsOfferer('peer-2')

    try {
      await pool.addPeerAsOfferer('peer-3')
      check('third peer rejected when pool is full', false)
    } catch {
      check('third peer rejected when pool is full', true)
    }

    check('pool still has 2 peers', pool.peerCount === 2)
    pool.destroy()
  }

  console.log('\nTest: Duplicate peer rejection')
  {
    mockPCs.length = 0
    const pool = new PeerConnectionPool()
    await pool.addPeerAsOfferer('peer-1')

    try {
      await pool.addPeerAsOfferer('peer-1')
      check('duplicate peer rejected', false)
    } catch {
      check('duplicate peer rejected', true)
    }

    pool.destroy()
  }

  console.log('\nTest: Peer failed event on ICE timeout')
  {
    mockPCs.length = 0
    const pool = new PeerConnectionPool({ iceTimeoutMs: 50 })
    const events: PeerEvent[] = []
    pool.on((e) => events.push(e))

    await pool.addPeerAsOfferer('peer-1')

    await new Promise((r) => setTimeout(r, 100))
    check('peer-failed event emitted after ICE timeout', events.some((e) => e.type === 'peer-failed' && e.peerId === 'peer-1'))
    check('failedPeers includes peer-1', pool.failedPeers.includes('peer-1'))

    pool.destroy()
  }

  console.log('\nTest: Pool destroy cleans up all peers')
  {
    mockPCs.length = 0
    const pool = new PeerConnectionPool()
    await pool.addPeerAsOfferer('peer-1')
    await pool.addPeerAsOfferer('peer-2')

    pool.destroy()
    check('peerCount is 0 after destroy', pool.peerCount === 0)
    check('connectedPeers is empty after destroy', pool.connectedPeers.length === 0)
  }

  console.log('\nTest: Peer connected via ICE state change')
  {
    mockPCs.length = 0
    const pool = new PeerConnectionPool()

    await pool.addPeerAsOfferer('peer-1')

    // Trigger ICE connected on the inner mock (this changes the wrapper's getter)
    const inner = mockPCs[0]
    inner._iceConnectionState = 'connected'
    inner.oniceconnectionstatechange?.()

    check('peer-1 is connected after ICE', pool.connectedPeers.includes('peer-1'))

    pool.destroy()
  }

  console.log('\nTest: Broadcast realtime to connected peers')
  {
    mockPCs.length = 0
    const pool = new PeerConnectionPool()

    await pool.addPeerAsOfferer('peer-1')

    // Connect peer-1 via ICE
    const inner = mockPCs[0]
    inner._iceConnectionState = 'connected'
    inner.oniceconnectionstatechange?.()

    check('peer-1 is connected after ICE', pool.connectedPeers.includes('peer-1'))

    // Broadcast a status update
    const update = { nodeId: 'node-a', timestamp: Date.now(), powerSource: 'solar' }
    pool.broadcastRealtime(update)

    // Verify the message was sent via the realtime data channel
    const dataChannel = inner.dataChannels.find((c) => c.label === 'lumina-realtime')
    check('realtime data channel created', dataChannel !== undefined)
    check('message sent via realtime channel', (dataChannel?.sent.length ?? 0) >= 1)
    if (dataChannel && dataChannel.sent.length >= 1) {
      const sent = JSON.parse(dataChannel.sent[0])
      check('sent update has correct nodeId', sent.nodeId === 'node-a')
      check('sent update has correct powerSource', sent.powerSource === 'solar')
    }

    pool.destroy()
  }

  console.log('\nTest: Remove peer')
  {
    mockPCs.length = 0
    const pool = new PeerConnectionPool()
    await pool.addPeerAsOfferer('peer-1')

    const events: PeerEvent[] = []
    pool.on((e) => events.push(e))

    pool.removePeer('peer-1')
    check('peerCount is 0 after remove', pool.peerCount === 0)
    check('peer-removed event emitted', events.some((e) => e.type === 'peer-removed' && e.peerId === 'peer-1'))

    pool.destroy()
  }

  // Cleanup
  uninstallMocks()

  console.log('')
  if (failures > 0) {
    console.error(`❌ ${failures} assertion(s) failed`)
    process.exit(1)
  }
  console.log('✅ All peer connection pool tests passed')
}

runTests().catch((err) => {
  console.error('Test execution failed:', err)
  process.exit(1)
})
