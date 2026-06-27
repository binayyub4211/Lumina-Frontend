"use client";

/**
 * Transaction queue for ordering and deduplicating submissions.
 * Prevents duplicate transactions via nonce-based tracking.
 */

export interface QueuedTransaction {
  nonce: string;
  contractId: string;
  method: string;
  args: unknown[];
  txXdr: string;
  timestamp: number;
  status: "queued" | "submitting" | "submitted" | "failed";
  retryCount: number;
}

const MAX_RETRY_ATTEMPTS = 3;
const SUBMISSION_TIMEOUT_MS = 30_000; // 30 seconds

export class TransactionQueue {
  private queue: Map<string, QueuedTransaction> = new Map();
  private processing = false;

  /**
   * Add a transaction to the queue
   */
  enqueue(tx: Omit<QueuedTransaction, "timestamp" | "status" | "retryCount">): boolean {
    // Prevent duplicates
    if (this.queue.has(tx.nonce)) {
      console.warn(`Transaction with nonce ${tx.nonce} already queued`);
      return false;
    }

    this.queue.set(tx.nonce, {
      ...tx,
      timestamp: Date.now(),
      status: "queued",
      retryCount: 0,
    });

    return true;
  }

  /**
   * Get transaction by nonce
   */
  get(nonce: string): QueuedTransaction | undefined {
    return this.queue.get(nonce);
  }

  /**
   * Update transaction status
   */
  updateStatus(
    nonce: string,
    status: QueuedTransaction["status"],
    incrementRetry = false
  ): boolean {
    const tx = this.queue.get(nonce);
    if (!tx) return false;

    tx.status = status;
    if (incrementRetry) {
      tx.retryCount++;
    }

    return true;
  }

  /**
   * Remove transaction from queue
   */
  remove(nonce: string): boolean {
    return this.queue.delete(nonce);
  }

  /**
   * Get all transactions with a specific status
   */
  getByStatus(status: QueuedTransaction["status"]): QueuedTransaction[] {
    return Array.from(this.queue.values()).filter((tx) => tx.status === status);
  }

  /**
   * Get all queued transactions ordered by timestamp
   */
  getAllQueued(): QueuedTransaction[] {
    return Array.from(this.queue.values())
      .filter((tx) => tx.status === "queued")
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Check if transaction has exceeded retry limit
   */
  shouldRetry(nonce: string): boolean {
    const tx = this.queue.get(nonce);
    if (!tx) return false;
    return tx.retryCount < MAX_RETRY_ATTEMPTS;
  }

  /**
   * Check if transaction has timed out
   */
  isTimedOut(nonce: string): boolean {
    const tx = this.queue.get(nonce);
    if (!tx) return false;
    return Date.now() - tx.timestamp > SUBMISSION_TIMEOUT_MS;
  }

  /**
   * Clear all transactions
   */
  clear(): void {
    this.queue.clear();
  }

  /**
   * Get queue size
   */
  size(): number {
    return this.queue.size;
  }

  /**
   * Check if queue is empty
   */
  isEmpty(): boolean {
    return this.queue.size === 0;
  }

  /**
   * Process queue with a submission handler
   */
  async processQueue(
    submitter: (tx: QueuedTransaction) => Promise<{ success: boolean; error?: string }>
  ): Promise<void> {
    if (this.processing) {
      console.warn("Queue is already being processed");
      return;
    }

    this.processing = true;

    try {
      const queued = this.getAllQueued();

      for (const tx of queued) {
        // Skip if timed out
        if (this.isTimedOut(tx.nonce)) {
          this.updateStatus(tx.nonce, "failed");
          continue;
        }

        // Skip if exceeded retry limit
        if (!this.shouldRetry(tx.nonce)) {
          this.updateStatus(tx.nonce, "failed");
          continue;
        }

        this.updateStatus(tx.nonce, "submitting");

        try {
          const result = await submitter(tx);

          if (result.success) {
            this.updateStatus(tx.nonce, "submitted");
          } else {
            if (this.shouldRetry(tx.nonce)) {
              this.updateStatus(tx.nonce, "queued", true);
            } else {
              this.updateStatus(tx.nonce, "failed");
            }
          }
        } catch (error) {
          console.error(`Failed to submit transaction ${tx.nonce}:`, error);
          
          if (this.shouldRetry(tx.nonce)) {
            this.updateStatus(tx.nonce, "queued", true);
          } else {
            this.updateStatus(tx.nonce, "failed");
          }
        }
      }
    } finally {
      this.processing = false;
    }
  }
}
