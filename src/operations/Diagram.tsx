import React, { Suspense, lazy } from 'react';
import { createPortal } from 'react-dom';

// Excalidraw is heavy, so it loads only when a diagram is shown or edited.
const Board = lazy(async () => {
  const [{ Excalidraw }] = await Promise.all([import('@excalidraw/excalidraw'), import('@excalidraw/excalidraw/index.css')]);
  const B: React.FC<{ value: string; readOnly?: boolean; onChange?: (v: string) => void }> = ({ value, readOnly, onChange }) => {
    // Excalidraw calls onChange on mount and on selection/scroll; only report real edits,
    // or a parent that sets state each time re-renders forever.
    const last = React.useRef(value);
    let elements: unknown[] = [];
    try { elements = value ? JSON.parse(value).elements ?? [] : []; } catch { /* corrupt scene: start blank */ }
    return (
      <Excalidraw
        initialData={{ elements: elements as never, scrollToContent: true }}
        viewModeEnabled={readOnly}
        UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false, export: false } }}
        onChange={readOnly ? undefined : els => {
          const live = els.filter(e => !e.isDeleted);
          const next = live.length ? JSON.stringify({ elements: live }) : '';
          if (next !== last.current) { last.current = next; onChange?.(next); }
        }}
      />
    );
  };
  return { default: B };
});

export const Diagram: React.FC<{ value: string; readOnly?: boolean; onChange?: (v: string) => void }> = props => {
  const [full, setFull] = React.useState(false);
  React.useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFull(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [full]);
  // Full screen is portaled to <body>: the page cards use backdrop-filter, which would
  // otherwise trap a fixed-position child inside the card. The board remounts from `value`.
  const box = (
    <div className={full ? 'fixed inset-0 z-[100] bg-white' : 'relative h-[480px] rounded-xl overflow-hidden border border-gray-200'} style={{ touchAction: 'none' }}>
      <button type="button" onClick={() => setFull(f => !f)} aria-pressed={full}
        className="absolute z-10 top-2 right-2 rounded-lg border border-gray-300 bg-white/90 px-2.5 py-1 text-xs font-bold text-gray-700 shadow-sm hover:bg-white"
        style={full ? { top: 12, right: 12 } : undefined}>
        {full ? 'Exit full screen (Esc)' : 'Full screen'}
      </button>
      <Suspense fallback={<p role="status" className="p-4 text-sm text-gray-400 font-bold">Loading diagram…</p>}>
        <Board {...props} />
      </Suspense>
    </div>
  );
  return full ? createPortal(box, document.body) : box;
};
