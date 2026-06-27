import { drawBandwidthChart, aggregateData } from '../chart/d3Renderer'
import type { BandwidthDataPoint } from '../../../hooks/useBandwidthStream'

interface MockGradient {
  addColorStop: (offset: number, color: string) => void
}

function createMockContext(): any {
  const grad: MockGradient = {
    addColorStop: () => {},
  }

  return {
    clearRect: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    fill: () => {},
    rect: () => {},
    roundRect: () => {},
    arc: () => {},
    fillText: () => {},
    createLinearGradient: () => grad,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
  }
}

// Helper to run assertions
function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`)
  }
}

console.log('--- Starting BandwidthChart Burst Performance Tests ---')

// Test 1: Data aggregation logic
try {
  console.log('\nTest 1: Verification of 5-second bucket aggregation')
  const baseTime = 1718000000000 // Fixed timestamp
  const testData: BandwidthDataPoint[] = []

  // Generate 50 points (1-second intervals)
  for (let i = 0; i < 50; i++) {
    testData.push({
      timestamp: baseTime + i * 1000,
      value: i + 1, // values 1 to 50
    })
  }

  const aggregated = aggregateData(testData)
  
  // 50 seconds divided by 5-second windows should yield 10 buckets
  console.log(`- Created ${aggregated.length} aggregated buckets (expected: 10)`)
  assert(aggregated.length === 10, 'Must aggregate into 10 buckets')

  // Check the first bucket values (should contain values 1 to 5)
  const firstBucket = aggregated[0]
  assert(firstBucket !== undefined, 'First bucket should exist')
  assert(firstBucket.min === 1, 'First bucket min should be 1')
  assert(firstBucket.max === 5, 'First bucket max should be 5')
  assert(firstBucket.avg === 3, 'First bucket avg should be 3')

  console.log('✅ Aggregation logic verified successfully')
} catch (err: any) {
  console.error('❌ Test 1 failed:', err.message)
  process.exit(1)
}

// Test 2: Burst rendering performance
try {
  console.log('\nTest 2: Burst rendering performance measurement')
  const baseTime = Date.now()
  const burstData: BandwidthDataPoint[] = []

  // Generate 50 catch-up points
  for (let i = 0; i < 50; i++) {
    burstData.push({
      timestamp: baseTime + i * 1000,
      value: Math.random() * 100,
    })
  }

  const mockCtx = createMockContext()

  // Warm up V8 JIT compiler to ensure accurate execution measurement
  for (let i = 0; i < 20; i++) {
    drawBandwidthChart(mockCtx, burstData, 800, 400, true)
  }

  const start = performance.now()

  // Draw in decimated mode
  drawBandwidthChart(mockCtx, burstData, 800, 400, true)

  const duration = performance.now() - start
  console.log(`- 50-point catch-up burst render took: ${duration.toFixed(4)} ms`)

  // Assert render time is well below 50ms
  assert(duration < 50, `Render time (${duration.toFixed(2)}ms) must be under 50ms`)
  console.log('✅ Burst rendering performance assertion passed (< 50ms)')
} catch (err: any) {
  console.error('❌ Test 2 failed:', err.message)
  process.exit(1)
}

console.log('\n✅ All BandwidthChart performance tests passed successfully!')
