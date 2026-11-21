import React, { Suspense, lazy } from 'react';

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

export const Diagram: React.FC<{ value: string; readOnly?: boolean; onChange?: (v: string) => void }> = props => (
  <div className="h-[480px] rounded-xl overflow-hidden border border-gray-200" style={{ touchAction: 'none' }}>
    <Suspense fallback={<p role="status" className="p-4 text-sm text-gray-400 font-bold">Loading diagram…</p>}>
      <Board {...props} />
    </Suspense>
  </div>
);
