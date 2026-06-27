import React from 'react';
import { useShortcutStore, Shortcut } from '../../store/shortcutStore';

interface CheatsheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutCheatsheet: React.FC<CheatsheetProps> = ({ isOpen, onClose }) => {
  const shortcuts = useShortcutStore((state) => state.shortcuts);

  if (!isOpen) return null;

  const categories: Record<Shortcut['category'], Shortcut[]> = {
    Navigation: shortcuts.filter((s) => s.category === 'Navigation'),
    Actions: shortcuts.filter((s) => s.category === 'Actions'),
    Toggles: shortcuts.filter((s) => s.category === 'Toggles'),
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-4xl max-h-[85vh] overflow-y-auto rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-slate-100">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>⌨️</span> Operator Control Center
            </h2>
            <p className="text-xs text-slate-400 mt-1">Press keys sequentially within 1s windows to trigger operations.</p>
          </div>
          <button 
            onClick={onClose}
            className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold hover:bg-slate-700 transition"
          >
            Esc Close
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {(Object.keys(categories) as Array<keyof typeof categories>).map((category) => (
            <div key={category} className="bg-slate-950/40 rounded-xl p-4 border border-slate-800/60">
              <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider mb-4 border-b border-slate-800 pb-2">
                {category}
              </h3>
              <div className="space-y-3">
                {categories[category].map((shortcut) => (
                  <div key={shortcut.id} className="flex items-center justify-between gap-4 text-xs">
                    <span className="text-slate-300 font-medium leading-tight">{shortcut.description}</span>
                    <div className="flex gap-1 shrink-0">
                      {shortcut.keys.map((key, i) => (
                        <kbd 
                          key={i} 
                          className="min-w-[20px] h-5 px-1.5 flex items-center justify-center bg-slate-800 text-white border-b-2 border-slate-950 rounded text-[10px] font-mono font-bold uppercase"
                        >
                          {key === ' ' ? 'Space' : key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};