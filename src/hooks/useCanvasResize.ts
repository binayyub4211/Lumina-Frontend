import { useEffect, useRef, type RefObject } from 'react';
import { resizeScheduler } from '@/src/lib/canvas/resizeScheduler';
import { useDevicePixelRatio } from '@/src/hooks/useDevicePixelRatio';

export function useCanvasResize(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  drawFn: () => void
): { lastRedrawTimestamp: number; redrawsSkipped: number } {
  const dpr = useDevicePixelRatio();
  const statsRef = useRef({ lastRedrawTimestamp: 0, redrawsSkipped: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas?.parentElement) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        resizeScheduler.scheduleRedraw(drawFn);
      }
      statsRef.current = resizeScheduler.getStats();
    });

    observer.observe(canvas.parentElement);

    return () => {
      observer.disconnect();
      resizeScheduler.destroy();
    };
  }, [canvasRef, drawFn, dpr]);

  return statsRef.current;
}
