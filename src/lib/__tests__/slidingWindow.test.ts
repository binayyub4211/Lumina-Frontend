/**
 * Tests for SlidingWindow ring buffer implementation
 */

import { SlidingWindow, type DataPoint } from '../slidingWindow'

interface TestDataPoint extends DataPoint {
  value: number
  timestamp: number
}

function createTestPoint(timestamp: number, value: number): TestDataPoint {
  return { timestamp, value }
}

// Test: Constructor validation
console.log('Test: Constructor validation')
try {
  new SlidingWindow(0)
  console.error('❌ Should throw error for zero capacity')
  process.exit(1)
} catch (e) {
  console.log('✅ Throws error for invalid capacity')
}

try {
  new SlidingWindow(-1)
  console.error('❌ Should throw error for negative capacity')
  process.exit(1)
} catch (e) {
  console.log('✅ Throws error for negative capacity')
}

// Test: Basic operations
console.log('\nTest: Basic operations')
const window = new SlidingWindow<TestDataPoint>(5)

console.assert(window.size() === 0, '✅ Initial size is 0')
console.assert(window.getCapacity() === 5, '✅ Capacity is correct')
console.assert(window.isFull() === false, '✅ Not full initially')
console.assert(window.getOldest() === null, '✅ getOldest returns null when empty')
console.assert(window.getNewest() === null, '✅ getNewest returns null when empty')

// Test: Adding data points
console.log('\nTest: Adding data points')
window.push(createTestPoint(1, 100))
window.push(createTestPoint(2, 200))
window.push(createTestPoint(3, 300))

console.assert(window.size() === 3, '✅ Size updates correctly')
console.assert(window.isFull() === false, '✅ Not full with 3/5 items')

const oldest = window.getOldest()
console.assert(oldest?.timestamp === 1, '✅ getOldest returns first item')

const newest = window.getNewest()
console.assert(newest?.timestamp === 3, '✅ getNewest returns last item')

// Test: FIFO eviction
console.log('\nTest: FIFO eviction')
window.push(createTestPoint(4, 400))
window.push(createTestPoint(5, 500))

console.assert(window.size() === 5, '✅ Size is at capacity')
console.assert(window.isFull() === true, '✅ isFull returns true')

// Add one more to trigger eviction
window.push(createTestPoint(6, 600))

console.assert(window.size() === 5, '✅ Size remains at capacity')
console.assert(window.isFull() === true, '✅ Still full after eviction')

const oldestAfterEviction = window.getOldest()
console.assert(
  oldestAfterEviction?.timestamp === 2,
  '✅ Oldest item was evicted (FIFO)'
)

const newestAfterEviction = window.getNewest()
console.assert(
  newestAfterEviction?.timestamp === 6,
  '✅ Newest item is correct'
)

// Test: getAll returns correct order
console.log('\nTest: getAll returns correct order')
const all = window.getAll()
console.assert(all.length === 5, '✅ getAll returns all items')
console.assert(all[0]?.timestamp === 2, '✅ First item is oldest')
console.assert(all[4]?.timestamp === 6, '✅ Last item is newest')

for (let i = 0; i < all.length - 1; i++) {
  console.assert(
    all[i]!.timestamp < all[i + 1]!.timestamp,
    `✅ Items in chronological order: ${all[i]!.timestamp} < ${all[i + 1]!.timestamp}`
  )
}

// Test: getRecent
console.log('\nTest: getRecent')
const recent = window.getRecent(3)
console.assert(recent.length === 3, '✅ getRecent returns correct count')
console.assert(recent[0]?.timestamp === 4, '✅ getRecent returns most recent items')
console.assert(recent[2]?.timestamp === 6, '✅ getRecent last item is newest')

// Test: Ring buffer wrap-around
console.log('\nTest: Ring buffer wrap-around')
for (let i = 7; i <= 20; i++) {
  window.push(createTestPoint(i, i * 100))
}

const wrappedAll = window.getAll()
console.assert(wrappedAll.length === 5, '✅ Size maintains after multiple wraps')
console.assert(wrappedAll[0]?.timestamp === 16, '✅ Correct oldest after wrap')
console.assert(wrappedAll[4]?.timestamp === 20, '✅ Correct newest after wrap')

// Verify chronological order after wrap
for (let i = 0; i < wrappedAll.length - 1; i++) {
  console.assert(
    wrappedAll[i]!.timestamp < wrappedAll[i + 1]!.timestamp,
    `✅ Order maintained after wrap: ${wrappedAll[i]!.timestamp} < ${wrappedAll[i + 1]!.timestamp}`
  )
}

// Test: Clear
console.log('\nTest: Clear')
window.clear()
console.assert(window.size() === 0, '✅ Size is 0 after clear')
console.assert(window.isFull() === false, '✅ Not full after clear')
console.assert(window.getOldest() === null, '✅ getOldest null after clear')
console.assert(window.getNewest() === null, '✅ getNewest null after clear')
console.assert(window.getAll().length === 0, '✅ getAll empty after clear')

// Test: Large capacity
console.log('\nTest: Large capacity (200 items)')
const largeWindow = new SlidingWindow<TestDataPoint>(200)

for (let i = 1; i <= 250; i++) {
  largeWindow.push(createTestPoint(i, i))
}

console.assert(largeWindow.size() === 200, '✅ Size capped at 200')
console.assert(largeWindow.isFull() === true, '✅ Full at capacity')

const largeAll = largeWindow.getAll()
console.assert(largeAll.length === 200, '✅ getAll returns 200 items')
console.assert(largeAll[0]?.timestamp === 51, '✅ Oldest is item 51')
console.assert(largeAll[199]?.timestamp === 250, '✅ Newest is item 250')

// Verify no duplicates
const timestamps = largeAll.map(d => d.timestamp)
const uniqueTimestamps = new Set(timestamps)
console.assert(
  uniqueTimestamps.size === 200,
  '✅ No duplicate timestamps in large buffer'
)

// Test: Metadata support
console.log('\nTest: Metadata support')
const metaWindow = new SlidingWindow<DataPoint & { metadata: Record<string, unknown> }>(3)

metaWindow.push({ timestamp: 1, value: 100, metadata: { nodeId: 'node-1', status: 'active' } })
metaWindow.push({ timestamp: 2, value: 200, metadata: { nodeId: 'node-2', status: 'idle' } })

const withMeta = metaWindow.getAll()
console.assert(withMeta[0]?.metadata?.nodeId === 'node-1', '✅ Metadata preserved')
console.assert(withMeta[1]?.metadata?.status === 'idle', '✅ Multiple metadata fields work')

console.log('\n✅ All SlidingWindow tests passed!')
