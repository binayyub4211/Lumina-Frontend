type DrawFn = () => void;

class ResizeScheduler {
  private pending: DrawFn[] = [];
  private rafId: number | null = null;
  private lastRedrawTimestamp = 0;
  private redrawsSkipped = 0;

  scheduleRedraw(drawFn: DrawFn): void {
    this.pending.push(drawFn);
    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(() => {
        if (this.pending.length > 0) {
          this.pending[this.pending.length - 1]();
          this.redrawsSkipped += this.pending.length - 1;
          this.lastRedrawTimestamp = performance.now();
          this.pending = [];
        }
        this.rafId = null;
      });
    }
  }

  getStats() {
    return {
      lastRedrawTimestamp: this.lastRedrawTimestamp,
      redrawsSkipped: this.redrawsSkipped,
    };
  }

  destroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.pending = [];
  }
}

export const resizeScheduler = new ResizeScheduler();
export { ResizeScheduler };
