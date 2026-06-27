import { useEffect, useRef, useState } from 'react';
import { useShortcutStore } from '../store/shortcutStore';

interface ActiveActionsMap {
  [actionId: string]: () => void;
}

export const useKeyboardCommander = (actions: ActiveActionsMap, openCheatsheet: () => void) => {
  const shortcuts = useShortcutStore((state) => state.shortcuts);
  const initialize = useShortcutStore((state) => state.initialize);
  
  const [currentChord, setCurrentChord] = useState<string[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore inputs unless executing specific functional keys like Escape
      if (
        (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) &&
        e.key !== 'Escape'
      ) {
        return;
      }

      // Check System Reserved: Ctrl+Shift+K
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openCheatsheet();
        setCurrentChord([]);
        return;
      }

      // System Reserved: Escape closes current sequence tracking
      if (e.key === 'Escape') {
        if (currentChord.length > 0) {
          e.preventDefault();
          setCurrentChord([]);
        }
        return;
      }

      // Skip isolated modifiers to avoid treating single structural keystrokes as chords
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

      e.preventDefault();

      // Clear structural timeouts to slide the window on key actions
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      const nextChord = [...currentChord, e.key.toLowerCase()];

      // Guard check: 3 keys maximum sequence bounds
      if (nextChord.length > 3) {
        setCurrentChord([]);
        return;
      }

      // Evaluation processing against registration maps
      const match = shortcuts.find(s => 
        s.keys.map(k => k.toLowerCase()).join(',') === nextChord.join(',')
      );

      const partialMatch = shortcuts.some(s => 
        s.keys.map(k => k.toLowerCase()).join(',').startsWith(nextChord.join(','))
      );

      if (match) {
        if (actions[match.actionId]) {
          actions[match.actionId]();
        } else {
          console.warn(`No runtime execution handler attached to action: ${match.actionId}`);
        }
        setCurrentChord([]);
      } else if (partialMatch) {
        setCurrentChord(nextChord);
        timeoutRef.current = setTimeout(() => {
          setCurrentChord([]); // Evict tracking on 1000ms window timeout
        }, 1000);
      } else {
        // Dead sequence pathing, clear tree tracking
        setCurrentChord([]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [currentChord, shortcuts, actions, openCheatsheet]);

  return { activeSequence: currentChord };
};