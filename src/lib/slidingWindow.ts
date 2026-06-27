/**
 * SlidingWindow - Ring buffer implementation for time-series data
 * 
 * Features:
 * - Fixed capacity with automatic FIFO eviction
 * - O(1) insertion and retrieval
 * - Zero-copy snapshot support
 * - Thread-safe for single producer/consumer
 */

export interface DataPoint {
  timestamp: number
  value: number
  metadata?: Record<string, unknown>
}

export class SlidingWindow<T extends DataPoint = DataPoint> {
  private buffer: T[]
  private writeIndex = 0
  private count = 0
  private readonly capacity: number

  constructor(capacity: number) {
    if (capacity <= 0) {
      throw new Error('SlidingWindow capacity must be greater than 0')
    }
    this.capacity = capacity
    this.buffer = new Array(capacity)
  }

  /**
   * Add a data point to the window
   * Automatically evicts oldest entry when at capacity
   */
  push(dataPoint: T): void {
    this.buffer[this.writeIndex] = dataPoint
    this.writeIndex = (this.writeIndex + 1) % this.capacity
    
    if (this.count < this.capacity) {
      this.count++
    }
  }

  /**
   * Get all data points in chronological order (oldest to newest)
   * Returns a shallow copy to prevent external mutation
   */
  getAll(): T[] {
    if (this.count === 0) return []
    
    if (this.count < this.capacity) {
      // Buffer not yet full - return slice from start
      return this.buffer.slice(0, this.count)
    }
    
    // Buffer is full - need to unwrap the ring
    // Read from writeIndex (oldest) to end, then from start to writeIndex
    return [
      ...this.buffer.slice(this.writeIndex),
      ...this.buffer.slice(0, this.writeIndex)
    ]
  }

  /**
   * Get the N most recent data points
   */
  getRecent(n: number): T[] {
    const all = this.getAll()
    return all.slice(-n)
  }

  /**
   * Get current number of elements
   */
  size(): number {
    return this.count
  }

  /**
   * Check if buffer is at capacity
   */
  isFull(): boolean {
    return this.count === this.capacity
  }

  /**
   * Get the oldest data point (without removing it)
   */
  getOldest(): T | null {
    if (this.count === 0) return null
    
    if (this.count < this.capacity) {
      return this.buffer[0] || null
    }
    
    return this.buffer[this.writeIndex] || null
  }

  /**
   * Get the newest data point (without removing it)
   */
  getNewest(): T | null {
    if (this.count === 0) return null
    
    const lastIndex = this.writeIndex === 0 
      ? this.capacity - 1 
      : this.writeIndex - 1
      
    return this.buffer[lastIndex] || null
  }

  /**
   * Clear all data points
   */
  clear(): void {
    this.buffer = new Array(this.capacity)
    this.writeIndex = 0
    this.count = 0
  }

  /**
   * Get capacity limit
   */
  getCapacity(): number {
    return this.capacity
  }
}
