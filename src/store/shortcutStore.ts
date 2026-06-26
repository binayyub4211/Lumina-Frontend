import { create } from 'zustand';

export interface Shortcut {
  id: string;
  keys: string[]; // e.g., ['g', 'n'] or ['Ctrl', 'Shift', 'K']
  description: string;
  category: 'Navigation' | 'Actions' | 'Toggles';
  actionId: string; // Map to execution handlers
}

interface ShortcutState {
  shortcuts: Shortcut[];
  isHydrated: boolean;
  initialize: () => Promise<void>;
  rebindShortcut: (id: string, newKeys: string[]) => Promise<{ success: boolean; conflict?: string }>;
  resetToDefaults: () => Promise<void>;
}

export const DEFAULT_SHORTCUTS: Shortcut[] = [
  // Navigation (12)
  { id: 'nav-nodes', keys: ['g', 'n'], description: 'Go to Nodes', category: 'Navigation', actionId: 'NAV_NODES' },
  { id: 'nav-alerts', keys: ['g', 'a'], description: 'Go to Alerts', category: 'Navigation', actionId: 'NAV_ALERTS' },
  { id: 'nav-vaults', keys: ['g', 'v'], description: 'Go to Vesting Vaults', category: 'Navigation', actionId: 'NAV_VAULTS' },
  { id: 'nav-gov', keys: ['g', 'g'], description: 'Go to Governance Portal', category: 'Navigation', actionId: 'NAV_GOVERNANCE' },
  { id: 'nav-analytics', keys: ['g', 'c'], description: 'Go to Analytics & Compliance', category: 'Navigation', actionId: 'NAV_ANALYTICS' },
  { id: 'nav-settings', keys: ['g', 's'], description: 'Go to Settings', category: 'Navigation', actionId: 'NAV_SETTINGS' },
  { id: 'nav-node-detail', keys: ['g', 'n', 'd'], description: 'Go to Node Detail', category: 'Navigation', actionId: 'NAV_NODE_DETAIL' },
  { id: 'nav-dashboard', keys: ['g', 'd'], description: 'Go to Main Dashboard', category: 'Navigation', actionId: 'NAV_DASHBOARD' },
  { id: 'nav-history', keys: ['g', 'h'], description: 'Go to Claim History', category: 'Navigation', actionId: 'NAV_HISTORY' },
  { id: 'nav-streams', keys: ['g', 't'], description: 'Go to Token Streams', category: 'Navigation', actionId: 'NAV_STREAMS' },
  { id: 'nav-profile', keys: ['g', 'p'], description: 'Go to User Profile', category: 'Navigation', actionId: 'NAV_PROFILE' },
  { id: 'nav-help', keys: ['g', 'x'], description: 'Go to Documentation/Help', category: 'Navigation', actionId: 'NAV_HELP' },

  // Actions (10)
  { id: 'act-ack-alert', keys: ['a', 'a'], description: 'Acknowledge Active Alert', category: 'Actions', actionId: 'ACT_ACK_ALERT' },
  { id: 'act-ack-all', keys: ['a', 's'], description: 'Acknowledge All Alerts', category: 'Actions', actionId: 'ACT_ACK_ALL' },
  { id: 'act-claim-tokens', keys: ['c', 't'], description: 'Claim Available Tokens', category: 'Actions', actionId: 'ACT_CLAIM_TOKENS' },
  { id: 'act-vote-veto', keys: ['v', 'v'], description: 'Trigger Veto Vote on active action', category: 'Actions', actionId: 'ACT_VOTE_VETO' },
  { id: 'act-refresh-data', keys: ['r', 'd'], description: 'Refresh Dashboard Data', category: 'Actions', actionId: 'ACT_REFRESH_DATA' },
  { id: 'act-search', keys: ['/'], description: 'Focus Global Search', category: 'Actions', actionId: 'ACT_FOCUS_SEARCH' },
  { id: 'act-close-modals', keys: ['Escape'], description: 'Clear active inputs/modals', category: 'Actions', actionId: 'ACT_CLOSE' },
  { id: 'act-export-csv', keys: ['e', 'x'], description: 'Export Table Data to CSV', category: 'Actions', actionId: 'ACT_EXPORT_CSV' },
  { id: 'act-open-commander', keys: ['Control', 'Shift', 'K'], description: 'Open Shortcut Commander', category: 'Actions', actionId: 'ACT_COMMANDER' },
  { id: 'act-clear-filters', keys: ['f', 'c'], description: 'Clear Active Filters', category: 'Actions', actionId: 'ACT_CLEAR_FILTERS' },

  // Toggles (8)
  { id: 'tog-sidebar', keys: ['t', 's'], description: 'Toggle Sidebar', category: 'Toggles', actionId: 'TOGGLE_SIDEBAR' },
  { id: 'tog-theme', keys: ['t', 't'], description: 'Toggle Dark/Light Mode', category: 'Toggles', actionId: 'TOGGLE_THEME' },
  { id: 'tog-compact', keys: ['t', 'c'], description: 'Toggle Compact View Grid', category: 'Toggles', actionId: 'TOGGLE_COMPACT' },
  { id: 'tog-compliance-panel', keys: ['t', 'm'], description: 'Toggle KYC/Compliance Panel', category: 'Toggles', actionId: 'TOGGLE_COMPLIANCE' },
  { id: 'tog-notifications', keys: ['t', 'n'], description: 'Toggle Notification Center Overlay', category: 'Toggles', actionId: 'TOGGLE_NOTIFICATIONS' },
  { id: 'tog-vault-details', keys: ['t', 'v'], description: 'Toggle Detailed Vesting Graphs', category: 'Toggles', actionId: 'TOGGLE_VAULT_DETAILS' },
  { id: 'tog-realtime', keys: ['t', 'r'], description: 'Toggle Real-time Stream Updates', category: 'Toggles', actionId: 'TOGGLE_REALTIME' },
  { id: 'tog-expert-mode', keys: ['t', 'e'], description: 'Toggle Operator Expert Layout', category: 'Toggles', actionId: 'TOGGLE_EXPERT' }
];

// Lightweight IndexedDB helper wrappers
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('lumina-keyboard-config', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('shortcuts');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const useShortcutStore = create<ShortcutState>((set, get) => ({
  shortcuts: DEFAULT_SHORTCUTS,
  isHydrated: false,

  initialize: async () => {
    try {
      const db = await openDB();
      const tx = db.transaction('shortcuts', 'readonly');
      const store = tx.objectStore('shortcuts');
      const req = store.get('bindings');
      
      req.onsuccess = () => {
        if (req.result) {
          set({ shortcuts: req.result, isHydrated: true });
        } else {
          set({ shortcuts: DEFAULT_SHORTCUTS, isHydrated: true });
        }
      };
    } catch {
      set({ shortcuts: DEFAULT_SHORTCUTS, isHydrated: true });
    }
  },

  rebindShortcut: async (id, newKeys) => {
    const { shortcuts } = get();
    
    // Check duplication conflicts
    const conflict = shortcuts.find(s => s.id !== id && s.keys.join(',') === newKeys.join(','));
    if (conflict) {
      return { success: false, conflict: conflict.description };
    }

    const updated = shortcuts.map(s => s.id === id ? { ...s, keys: newKeys } : s);
    set({ shortcuts: updated });

    try {
      const db = await openDB();
      const tx = db.transaction('shortcuts', 'readwrite');
      tx.objectStore('shortcuts').put(updated, 'bindings');
    } catch (e) {
      console.error("Failed persisting shortcuts to IndexedDB", e);
    }
    
    return { success: true };
  },

  resetToDefaults: async () => {
    set({ shortcuts: DEFAULT_SHORTCUTS });
    const db = await openDB();
    const tx = db.transaction('shortcuts', 'readwrite');
    tx.objectStore('shortcuts').put(DEFAULT_SHORTCUTS, 'bindings');
  }
}));