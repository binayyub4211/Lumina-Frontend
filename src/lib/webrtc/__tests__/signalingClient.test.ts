/**
 * Tests for the WebRTC Signaling Client.
 *
 * Run: npx tsx src/lib/webrtc/__tests__/signalingClient.test.ts
 */

import { SignalingClient, type SignalingMessage } from '../signalingClient'

// ── WebSocket Mock ───────────────────────────────────────────────────────

interface MockWSInstance {
  readyState: number
  onopen: (() => void) | null
  onclose: (() => void) | null
  onerror: (() => void) | null
  onmessage: ((event: { data: string }) => void) | null
  sent: string[]
  url: string
}

const mockInstances: MockWSInstance[] = []

const OriginalWebSocket = globalThis.WebSocket

function installMock() {
  mockInstances.length = 0
  class MockWebSocket {
    static CONNECTING = 0
    static OPEN = 1
    static CLOSING = 2
    static CLOSED = 3

    readyState = 0
    onopen: (() => void) | null = null
    onclose: (() => void) | null = null
    onerror: (() => void) | null = null
    onmessage: ((event: { data: string }) => void) | null = null
    sent: string[] = []
    url: string

    constructor(url: string) {
      this.url = url
      mockInstances.push(this)
    }

    send(data: string) {
      if (this.readyState === 1) {
        this.sent.push(data)
      }
    }

    close() {
      this.readyState = 3
    }
  }
  ;(globalThis as unknown as Record<string, unknown>).WebSocket = MockWebSocket as unknown as typeof WebSocket
}

function uninstallMock() {
  globalThis.WebSocket = OriginalWebSocket
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
  installMock()

  console.log('\nTest: SignalingClient construction')
  {
    const client = new SignalingClient({
      baseUrl: 'wss://example.com',
      clusterId: 'cluster-1',
    })
    check('isConnected false before connect', !client.isConnected)
    client.destroy()
  }

  console.log('\nTest: SignalingClient connect sends join message')
  {
    mockInstances.length = 0
    const client = new SignalingClient({
      baseUrl: 'wss://example.com',
      clusterId: 'cluster-1',
    })
    client.connect()

    await new Promise((r) => setTimeout(r, 10))
    check('WebSocket created', mockInstances.length >= 1)
    const ws = mockInstances[0]
    check('URL contains cluster param', ws.url.includes('cluster=cluster-1'))

    // Simulate connection opening
    ws.readyState = 1
    ws.onopen?.()
    await new Promise((r) => setTimeout(r, 10))

    check('join message sent on open', ws.sent.length >= 1)
    if (ws.sent.length >= 1) {
      const joinMsg: SignalingMessage = JSON.parse(ws.sent[0])
      check('join message type is join', joinMsg.type === 'join')
      check('join message clusterId matches', joinMsg.clusterId === 'cluster-1')
    }

    client.destroy()
  }

  console.log('\nTest: SignalingClient relays SDP offers')
  {
    mockInstances.length = 0
    const client = new SignalingClient({
      baseUrl: 'wss://example.com',
      clusterId: 'cluster-1',
    })
    client.connect()
    await new Promise((r) => setTimeout(r, 10))
    const ws = mockInstances[0]
    ws.readyState = 1
    ws.onopen?.()
    await new Promise((r) => setTimeout(r, 10))
    ws.sent = [] // clear join

    client.sendOffer('peer-2', { type: 'offer', sdp: 'test-sdp' } as RTCSessionDescriptionInit)
    check('offer sent to signaling', ws.sent.length >= 1)

    if (ws.sent.length >= 1) {
      const offerMsg: SignalingMessage = JSON.parse(ws.sent[0])
      check('offer type is offer', offerMsg.type === 'offer')
      check('offer to is peer-2', offerMsg.to === 'peer-2')
      check('offer payload contains sdp', (offerMsg.payload as Record<string, string>)?.sdp === 'test-sdp')
    }

    client.destroy()
  }

  console.log('\nTest: SignalingClient relays ICE candidates')
  {
    mockInstances.length = 0
    const client = new SignalingClient({
      baseUrl: 'wss://example.com',
      clusterId: 'cluster-1',
    })
    client.connect()
    await new Promise((r) => setTimeout(r, 10))
    const ws = mockInstances[0]
    ws.readyState = 1
    ws.onopen?.()
    await new Promise((r) => setTimeout(r, 10))
    ws.sent = []

    const candidate: RTCIceCandidateInit = {
      candidate: 'candidate:1',
      sdpMid: '0',
      sdpMLineIndex: 0,
    }
    client.sendIceCandidate('peer-2', candidate)
    check('ICE candidate sent', ws.sent.length >= 1)

    if (ws.sent.length >= 1) {
      const iceMsg: SignalingMessage = JSON.parse(ws.sent[0])
      check('ICE type is ice-candidate', iceMsg.type === 'ice-candidate')
      check('ICE to is peer-2', iceMsg.to === 'peer-2')
    }

    client.destroy()
  }

  console.log('\nTest: SignalingClient dispatches incoming messages to listeners')
  {
    mockInstances.length = 0
    const client = new SignalingClient({
      baseUrl: 'wss://example.com',
      clusterId: 'cluster-1',
    })
    const received: SignalingMessage[] = []
    client.on((msg) => received.push(msg))

    client.connect()
    await new Promise((r) => setTimeout(r, 10))
    const ws = mockInstances[0]
    ws.readyState = 1
    ws.onopen?.()
    await new Promise((r) => setTimeout(r, 10))

    const incomingOffer: SignalingMessage = {
      type: 'offer',
      from: 'peer-3',
      clusterId: 'cluster-1',
      payload: { type: 'offer', sdp: 'remote-sdp' },
    }
    ws.onmessage?.({ data: JSON.stringify(incomingOffer) })

    check('listener received incoming offer', received.length >= 1)
    if (received.length >= 1) {
      check('received message type is offer', received[0].type === 'offer')
      check('received message from peer-3', received[0].from === 'peer-3')
    }

    client.destroy()
  }

  console.log('\nTest: SignalingClient max message size enforcement')
  {
    mockInstances.length = 0
    const client = new SignalingClient({
      baseUrl: 'wss://example.com',
      clusterId: 'cluster-1',
      maxMessageSize: 100,
    })
    client.connect()
    await new Promise((r) => setTimeout(r, 10))
    const ws = mockInstances[0]
    ws.readyState = 1
    ws.onopen?.()
    await new Promise((r) => setTimeout(r, 10))
    ws.sent = []

    const sentBefore = ws.sent.length
    client.sendAnswer('peer-2', { type: 'answer', sdp: 'x'.repeat(200) } as RTCSessionDescriptionInit)
    check('oversized message not sent', ws.sent.length === sentBefore)

    client.destroy()
  }

  console.log('\nTest: SignalingClient disconnect sends leave')
  {
    mockInstances.length = 0
    const client = new SignalingClient({
      baseUrl: 'wss://example.com',
      clusterId: 'cluster-1',
    })
    client.connect()
    await new Promise((r) => setTimeout(r, 10))
    const ws = mockInstances[0]
    ws.readyState = 1
    ws.onopen?.()
    await new Promise((r) => setTimeout(r, 10))
    ws.sent = []

    client.disconnect()
    check('leave message sent on disconnect', ws.sent.length >= 1)
    if (ws.sent.length >= 1) {
      const leaveMsg: SignalingMessage = JSON.parse(ws.sent[0])
      check('leave message type is leave', leaveMsg.type === 'leave')
    }

    client.destroy()
  }

  // Cleanup
  uninstallMock()

  console.log('')
  if (failures > 0) {
    console.error(`❌ ${failures} assertion(s) failed`)
    process.exit(1)
  }
  console.log('✅ All signaling client tests passed')
}

runTests().catch((err) => {
  console.error('Test execution failed:', err)
  process.exit(1)
})
