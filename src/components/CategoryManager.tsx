import React, { useState } from 'react';
import { useAppContext } from '../store';
import { Category } from '../types';
import { sortCategories } from '../access';
import { ConfirmModal } from './ConfirmModal';

// Admin-only card on the Curriculum tab: create, rename, reorder, lock and
// delete the categories that group modules into sidebar sections.
export const CategoryManager: React.FC = () => {
  const { categories, modules, createCategory, updateCategory, moveCategory, deleteCategory } = useAppContext();
  const [newName, setNewName] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [pendingDelete, setPendingDelete] = useState<Category | null>(null);
  const sorted = sortCategories(categories);

  const add = () => {
    if (!newName.trim()) return;
    createCategory(newName);
    setNewName('');
  };

  // Renames save when the field loses focus (or on Enter), so typing
  // doesn't write to Firestore on every keystroke.
  const commitRename = (cat: Category) => {
    const name = drafts[cat.id]?.trim();
    if (name && name !== cat.name) updateCategory(cat.id, { name });
    setDrafts(d => { const { [cat.id]: _, ...rest } = d; return rest; });
  };

  return (
    <div className="bg-surface rounded-[32px] p-6 border border-gray-100 shadow-sm space-y-4">
      <div>
        <h4 className="text-sm font-black uppercase text-[#2E9DF7] tracking-widest">Categories</h4>
        <p className="text-xs text-gray-400 font-medium mt-1">
          Sidebar sections, in order. A locked category is hidden from sound designers until you unlock it for them on the Sound Designers tab.
        </p>
      </div>

      <ul className="space-y-2">
        {sorted.map((cat, i) => {
          const moduleCount = modules.filter(m => m.category === cat.id).length;
          return (
            <li key={cat.id} className="flex items-center gap-2 bg-gray-50 rounded-2xl p-2 pl-3">
              <div className="flex flex-col">
                <button onClick={() => moveCategory(cat.id, -1)} disabled={i === 0} aria-label={`Move ${cat.name} up`} className="text-gray-400 hover:text-[#2E9DF7] disabled:opacity-30 text-[10px] leading-none px-1">▲</button>
                <button onClick={() => moveCategory(cat.id, 1)} disabled={i === sorted.length - 1} aria-label={`Move ${cat.name} down`} className="text-gray-400 hover:text-[#2E9DF7] disabled:opacity-30 text-[10px] leading-none px-1">▼</button>
              </div>
              <input
                value={drafts[cat.id] ?? cat.name}
                onChange={(e) => setDrafts(d => ({ ...d, [cat.id]: e.target.value }))}
                onBlur={() => commitRename(cat)}
                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                aria-label="Category name"
                className="flex-1 min-w-0 bg-transparent rounded-xl px-2 py-1.5 text-sm font-bold text-gray-800 focus:bg-surface focus:ring-2 focus:ring-[#2E9DF7]"
              />
              <span className="text-[10px] font-bold uppercase text-gray-400 whitespace-nowrap">{moduleCount} module{moduleCount === 1 ? '' : 's'}</span>
              <button
                onClick={() => updateCategory(cat.id, { restricted: !cat.restricted })}
                title={cat.restricted ? 'Locked: hidden from designers unless unlocked. Click to open to everyone.' : 'Open to everyone. Click to lock.'}
                className={`text-[10px] font-bold uppercase tracking-wide px-3 py-1.5 rounded-full transition-colors whitespace-nowrap ${
                  cat.restricted ? 'bg-[#F4511E]/20 text-ember hover:bg-[#F4511E]/30' : 'bg-[#3DDC97]/20 text-leaf hover:bg-[#3DDC97]/30'
                }`}
              >
                {cat.restricted ? '🔒 Locked' : '🔓 Open'}
              </button>
              <button
                onClick={() => setPendingDelete(cat)}
                disabled={moduleCount > 0}
                title={moduleCount > 0 ? 'Move or delete its modules first' : 'Delete category'}
                className="text-gray-400 font-bold text-sm px-2 py-1 rounded-xl hover:text-ember hover:bg-rose disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400 transition-colors"
              >
                ✕
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
          placeholder="New category name"
          className="flex-1 bg-gray-50 rounded-xl p-3 text-sm focus:ring-2 focus:ring-[#2E9DF7] font-medium"
        />
        <button
          onClick={add}
          disabled={!newName.trim()}
          className="bg-[#2E9DF7] text-white font-bold text-sm px-5 rounded-2xl transition-all shadow-[0_4px_0_#1b85df] active:shadow-none active:translate-y-[2px] disabled:opacity-50 disabled:shadow-none disabled:translate-y-0"
        >
          + Add
        </button>
      </div>

      <ConfirmModal
        open={pendingDelete !== null}
        title={`Delete "${pendingDelete?.name}"?`}
        message="This removes the empty category from the sidebar and the module editor."
        confirmLabel="Delete"
        onConfirm={() => { if (pendingDelete) deleteCategory(pendingDelete.id); setPendingDelete(null); }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
};
