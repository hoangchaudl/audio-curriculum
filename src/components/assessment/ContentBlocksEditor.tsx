import React from 'react';
import { ContentBlock } from '../../types';
import { input, secondaryBtn } from './ui';

const newId = () => `blk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

const TEMPLATES: Record<ContentBlock['type'], () => ContentBlock> = {
  richText: () => ({ id: newId(), type: 'richText', markdown: '' }),
  schedule: () => ({ id: newId(), type: 'schedule', title: 'Schedule', items: [{ week: 1, day: 1, task: '', hours: 8 }] }),
  milestone: () => ({ id: newId(), type: 'milestone', title: '', week: 1 }),
  expectation: () => ({ id: newId(), type: 'expectation', text: '' }),
  video: () => ({ id: newId(), type: 'video', url: '', title: '' }),
};

const TYPE_LABELS: Record<ContentBlock['type'], string> = {
  richText: 'Rich text',
  schedule: 'Schedule',
  milestone: 'Milestone',
  expectation: 'Progress expectation',
  video: 'Video (optional)',
};

const num = (v: string, min = 1) => Math.max(min, parseInt(v, 10) || min);

// Admin editor for mixed-media content. Weeks/days are relative to each
// trainee's start date, so one schedule works for every cohort.
export const ContentBlocksEditor: React.FC<{ blocks: ContentBlock[]; onChange: (blocks: ContentBlock[]) => void }> = ({ blocks, onChange }) => {
  const update = (id: string, patch: Partial<ContentBlock>) =>
    onChange(blocks.map(b => (b.id === id ? ({ ...b, ...patch } as ContentBlock) : b)));
  const move = (i: number, dir: -1 | 1) => {
    const next = [...blocks];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {blocks.map((block, i) => (
        <div key={block.id} className="border-2 border-dashed border-gray-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-black uppercase text-gray-500">{TYPE_LABELS[block.type]}</p>
            <div className="flex gap-1">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="text-gray-400 hover:text-[#2E9DF7] disabled:opacity-30 px-1" aria-label="Move up">▲</button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === blocks.length - 1} className="text-gray-400 hover:text-[#2E9DF7] disabled:opacity-30 px-1" aria-label="Move down">▼</button>
              <button type="button" onClick={() => onChange(blocks.filter(b => b.id !== block.id))} className="text-gray-400 hover:text-ember px-2 font-bold" aria-label="Remove block">✕</button>
            </div>
          </div>

          {block.type === 'richText' && (
            <textarea value={block.markdown} onChange={e => update(block.id, { markdown: e.target.value })}
              placeholder={'## What to do this week\n- Point one\n- Point two\n\n**Bold**, *italic*, [links](https://...)'}
              className={`${input} h-32 font-mono text-xs`} />
          )}

          {block.type === 'expectation' && (
            <input value={block.text} onChange={e => update(block.id, { text: e.target.value })}
              placeholder="e.g. By end of Week 1 you should have a clean, organised session with dialogue imported" className={input} />
          )}

          {block.type === 'milestone' && (
            <div className="grid grid-cols-[1fr_auto_auto] gap-2">
              <input value={block.title} onChange={e => update(block.id, { title: e.target.value })} placeholder="Milestone title" className={input} />
              <label className="flex items-center gap-1 text-xs font-bold text-gray-500">Week
                <input type="number" min={1} value={block.week} onChange={e => update(block.id, { week: num(e.target.value) })} className={`${input} w-16`} />
              </label>
              <label className="flex items-center gap-1 text-xs font-bold text-gray-500">Day
                <input type="number" min={1} max={7} value={block.day ?? ''} onChange={e => update(block.id, { day: e.target.value ? num(e.target.value) : undefined })} className={`${input} w-16`} />
              </label>
              <textarea value={block.description ?? ''} onChange={e => update(block.id, { description: e.target.value })}
                placeholder="What's due (Markdown)" className={`${input} col-span-3 h-16`} />
            </div>
          )}

          {block.type === 'video' && (
            <div className="grid grid-cols-2 gap-2">
              <input value={block.url} onChange={e => update(block.id, { url: e.target.value })} placeholder="https://youtube.com/watch?v=... or any link" className={input} />
              <input value={block.title ?? ''} onChange={e => update(block.id, { title: e.target.value })} placeholder="Title (optional)" className={input} />
            </div>
          )}

          {block.type === 'schedule' && (
            <div className="space-y-2">
              <input value={block.title ?? ''} onChange={e => update(block.id, { title: e.target.value })} placeholder="Schedule title" className={input} />
              {block.items.map((item, j) => {
                const setItem = (patch: Partial<typeof item>) =>
                  update(block.id, { items: block.items.map((it, k) => (k === j ? { ...it, ...patch } : it)) });
                return (
                  <div key={j} className="grid grid-cols-[4rem_4rem_1fr_4.5rem_auto] gap-2 items-center">
                    <input type="number" min={1} aria-label="Week" value={item.week} onChange={e => setItem({ week: num(e.target.value) })} className={input} />
                    <input type="number" min={1} max={7} aria-label="Day" value={item.day ?? ''} onChange={e => setItem({ day: e.target.value ? num(e.target.value) : undefined })} className={input} placeholder="Day" />
                    <input value={item.task} onChange={e => setItem({ task: e.target.value })} placeholder="Task" className={input} />
                    <input type="number" min={0} aria-label="Hours" value={item.hours ?? ''} onChange={e => setItem({ hours: e.target.value ? num(e.target.value, 0) : undefined })} className={input} placeholder="Hrs" />
                    <button type="button" onClick={() => update(block.id, { items: block.items.filter((_, k) => k !== j) })} className="text-gray-400 hover:text-ember font-bold px-1" aria-label="Remove row">✕</button>
                  </div>
                );
              })}
              <button type="button" onClick={() => update(block.id, { items: [...block.items, { week: block.items.at(-1)?.week ?? 1, task: '' }] })} className={secondaryBtn}>+ Row</button>
              <p className="text-[10px] text-gray-400">Week and day count from each trainee's start date (week 1, day 1 = start).</p>
            </div>
          )}
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        {(Object.keys(TEMPLATES) as ContentBlock['type'][]).map(type => (
          <button key={type} type="button" onClick={() => onChange([...blocks, TEMPLATES[type]()])} className={secondaryBtn}>
            + {TYPE_LABELS[type]}
          </button>
        ))}
      </div>
    </div>
  );
};
