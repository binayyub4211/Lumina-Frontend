# ThroughputChart - Quick Start Guide

## Installation Complete ✅

The ThroughputChart component and all dependencies have been successfully installed and tested.

## Quick Usage

### 1. Basic Integration

```tsx
import { ThroughputChart } from '@/src/components/charts/ThroughputChart'

export default function NetworkDashboard() {
  return (
    <div className="p-8">
      <ThroughputChart
        wsUrl="ws://your-server.com/throughput-stream"
        title="Network Throughput"
        height={400}
      />
    </div>
  )
}
```

### 2. With Performance Tracking

```tsx
<ThroughputChart
  wsUrl="ws://your-server.com/throughput-stream"
  title="Network Throughput Monitor"
  height={500}
  enablePerformanceTracking={true}
/>
```

### 3. Custom Styling

```tsx
<ThroughputChart
  wsUrl="ws://your-server.com/throughput-stream"
  title="Custom Chart"
  height={600}
  lineColor="#ef4444"
  gridColor="#f3f4f6"
/>
```

## WebSocket Message Format

Your WebSocket server should send messages in this format:

```typescript
{
  "timestamp": 1234567890000,      // Unix timestamp in milliseconds
  "packetsForwarded": 150,         // Number of packets
  "throughput": 850.5,             // Packets per second
  "nodeId": "node-1"               // Optional: Node identifier
}
```

## Testing the Implementation

### 1. Run Unit Tests
```bash
npm run test:sliding-window
```

### 2. Run All Tests
```bash
npm run test:all
```

### 3. Type Check
```bash
npm run typecheck
```

### 4. Build for Production
```bash
npm run build
```

## Demo Page

To see the component in action with a mock WebSocket server:

```bash
npm run dev
```

Then navigate to: http://localhost:3000/throughput-demo

The demo page includes:
- Mock WebSocket server
- Adjustable message rate (10-500 msg/s)
- Performance metrics display
- Real-time statistics
- Visual connection status

## Performance Guarantees

✅ **Throttled Rendering**: Max 1 render per 500ms
✅ **Buffer Limit**: 200 data points maximum
✅ **Zero Message Loss**: All messages captured
✅ **First Message Instant**: No latency on initial data
✅ **Frame Budget**: Monitored to stay < 16ms
✅ **Memory Efficient**: Fixed allocation, no leaks

## Component Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `wsUrl` | `string` | *required* | WebSocket server URL |
| `title` | `string` | `"Network Throughput"` | Chart title |
| `height` | `number` | `400` | Chart height in pixels |
| `enablePerformanceTracking` | `boolean` | `false` | Show performance metrics |
| `lineColor` | `string` | `"#0f766e"` | Chart line color |
| `gridColor` | `string` | `"#e5e7eb"` | Grid line color |

## Architecture Overview

```
WebSocket Stream (200+ msg/s)
         ↓
useDataThrottle (batches messages)
         ↓
SlidingWindow (ring buffer, 200 max)
         ↓
React Re-render (max 1 per 500ms)
         ↓
Recharts (visual update)
```

## Troubleshooting

### Chart not updating?
- Verify WebSocket URL is correct
- Check browser console for connection errors
- Ensure WebSocket server is running

### Performance warnings?
- Reduce message rate if possible
- Increase throttle interval
- Reduce buffer size

### Memory issues?
- Check for memory leaks in browser DevTools
- Verify component unmounts correctly
- Check WebSocket cleanup

## File Structure

```
src/
├── components/
│   └── charts/
│       ├── ThroughputChart.tsx       # Main component
│       └── AnalyticsTimeSeries.tsx   # Existing chart
├── hooks/
│   ├── useDataThrottle.ts            # Throttling logic
│   ├── useWebSocket.ts               # WebSocket connection
│   └── __tests__/
│       └── useDataThrottle.test.tsx  # Hook tests
├── lib/
│   ├── slidingWindow.ts              # Ring buffer
│   └── __tests__/
│       └── slidingWindow.test.ts     # Unit tests
└── types/
    └── network.ts                    # Type definitions

app/
└── throughput-demo/
    └── page.tsx                      # Demo page

tests/
└── e2e/
    └── throughput-chart.spec.ts      # E2E tests
```

## Documentation

📖 **Full Implementation Guide**: See `THROUGHPUT_CHART_IMPLEMENTATION.md`
📊 **Test Results**: See `TEST_RESULTS.md`

## Support

For issues or questions:
1. Check the full implementation documentation
2. Review test cases for usage examples
3. Try the demo page to see expected behavior
4. Check browser console for error messages

## Next Steps

1. ✅ Integration complete - component ready to use
2. ⏭️ Connect to your real WebSocket server
3. ⏭️ Customize styling to match your design
4. ⏭️ Deploy to staging for testing
5. ⏭️ Monitor performance in production

**Status**: 🚀 Ready for Production Use
