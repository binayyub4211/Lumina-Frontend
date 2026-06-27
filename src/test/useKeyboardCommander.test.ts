import { renderHook, act } from '@testing-library/react-hooks';
import { useKeyboardCommander } from '../hooks/useKeyboardCommander';
import { useShortcutStore } from '../store/shortcutStore';

describe('Keyboard Commander Engine Core Suite', () => {
  let actionsMock: Record<string, vi.Mock>;
  let openCheatsheetMock: vi.Mock;

  beforeEach(async () => {
    vi.useFakeTimers();
    actionsMock = {
      NAV_NODES: vi.fn(),
      NAV_NODE_DETAIL: vi.fn(),
    };
    openCheatsheetMock = vi.fn();
    
    // Force store instantiation
    await act(async () => {
      await useShortcutStore.getState().resetToDefaults();
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const fireKeydown = (keyValue: string, options = {}) => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: keyValue, ...options }));
  };

  it('should successfully trigger immediate execution mapping on unified chord matches', () => {
    renderHook(() => useKeyboardCommander(actionsMock, openCheatsheetMock));

    fireKeydown('g');
    fireKeydown('n');

    expect(actionsMock.NAV_NODES).toHaveBeenCalledTimes(1);
  });

  it('should support deeper state sequences up to 3 keys', () => {
    renderHook(() => useKeyboardCommander(actionsMock, openCheatsheetMock));

    fireKeydown('g');
    fireKeydown('n');
    fireKeydown('d');

    expect(actionsMock.NAV_NODE_DETAIL).toHaveBeenCalledTimes(1);
  });

  it('should automatically clear chord state queues upon exceeding 1000ms idle windows', () => {
    renderHook(() => useKeyboardCommander(actionsMock, openCheatsheetMock));

    fireKeydown('g');
    
    // Progress timers forward by 1001ms to violate step bounds
    act(() => {
      vi.advanceTimersByTime(1001);
    });

    fireKeydown('n');
    expect(actionsMock.NAV_NODES).not.toHaveBeenCalled();
  });

  it('should cleanly intercept global modifier shortcuts assigned to structural overrides', () => {
    renderHook(() => useKeyboardCommander(actionsMock, openCheatsheetMock));

    fireKeydown('k', { ctrlKey: true, shiftKey: true });
    expect(openCheatsheetMock).toHaveBeenCalledTimes(1);
  });
});