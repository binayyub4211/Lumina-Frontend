'use client';

import { useRef, useState } from 'react';
import { useCanvasResize } from '@/src/hooks/useCanvasResize';

interface TopologyCanvasProps {
  drawFn: () => void;
  className?: string;
  debug?: boolean;
}

export function TopologyCanvas({ drawFn, className = '', debug = false }: TopologyCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [debugOverlay, setDebugOverlay] = useState(false);

  const stats = useCanvasResize(canvasRef, drawFn);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas ref={canvasRef} className={className} style={{ display: 'block' }} />
      {debug && (
        <div
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            background: 'rgba(0,0,0,0.7)',
            color: '#0f0',
            fontSize: 10,
            padding: '2px 6px',
            borderRadius: 4,
            fontFamily: 'monospace',
          }}
        >
          redraw: {stats.lastRedrawTimestamp.toFixed(0)}ms | skipped: {stats.redrawsSkipped}
        </div>
      )}
    </div>
  );
}
