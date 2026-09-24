import React, { useState } from 'react';
import { useAppContext } from '../../store';
import { Assignment, AssessmentStage, Exercise, OutlineItem, OutlineWeek, ProgramOutline } from '../../types';
import { episodeAModules } from '../../assessment/scoring';
import { assignmentLines } from '../../assessment/outline';
import { ConfirmModal } from '../ConfirmModal';
import { card, input, primaryBtn, secondaryBtn } from './ui';

const uid = (p: string) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const dayOption = (d: number) => `Day ${d} (${DAY_NAMES[d - 1]} if the week starts Monday)`;
const STAGE_OPTIONS: { id: AssessmentStage; label: string }[] = [
  { id: 'A', label: 'Episode A (graded per module)' },
  { id: 'B', label: 'Episode B – final episode test' },
  { id: 'P1', label: 'Pod Trial – episode 1' },
  { id: 'P2', label: 'Pod Trial – episode 2 (only if 2 required)' },
];

// --- Assignment form ------------------------------------------------------------

const AssignmentForm: React.FC<{
  initial: Assignment;
  initialLines: Exercise[];
  onSave: (a: Assignment, lines: Exercise[]) => Promise<void>;
  onCancel: () => void;
}> = ({ initial, initialLines, onSave, onCancel }) => {
  const { modules } = useAppContext();
  const epA = episodeAModules(modules);
  const [a, setA] = useState(initial);
  const [lines, setLines] = useState(initialLines);
  const [busy, setBusy] = useState(false);
  const setLine = (i: number, patch: Partial<Exercise>) => setLines(ls => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  return (
    <div className="bg-gray-50 rounded-2xl p-4 space-y-3 mt-2">
      <div className="grid sm:grid-cols-2 gap-2">
        <input value={a.title} onChange={e => setA({ ...a, title: e.target.value })} placeholder="Assignment title" aria-label="Assignment title" className={`${input} bg-surface sm:col-span-2`} />
        <select value={a.stage} onChange={e => setA({ ...a, stage: e.target.value as AssessmentStage })} aria-label="Graded as" className={`${input} bg-surface`}>
          {STAGE_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        <select value={a.dueDay ?? ''} onChange={e => setA({ ...a, dueDay: e.target.value ? Number(e.target.value) : undefined })} aria-label="Due day" className={`${input} bg-surface`}>
          <option value="">No due day</option>
          {[1, 2, 3, 4, 5, 6, 7].map(d => <option key={d} value={d}>Due {dayOption(d)}</option>)}
        </select>
      </div>
      <textarea value={a.instructions ?? ''} onChange={e => setA({ ...a, instructions: e.target.value })}
        placeholder="What to submit (Markdown)" aria-label="Instructions" className={`${input} bg-surface h-20`} />

      <div className="space-y-2">
        <p className="text-[10px] font-black uppercase text-gray-500">Materials links</p>
        {a.materials.map((m, i) => (
          <div key={i} className="grid grid-cols-[9rem_1fr_auto] gap-2">
            <input value={m.label} onChange={e => setA({ ...a, materials: a.materials.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} placeholder="Label" aria-label="Material label" className={`${input} bg-surface`} />
            <input value={m.url} onChange={e => setA({ ...a, materials: a.materials.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })} placeholder="https://drive.google.com/..." aria-label="Material URL" className={`${input} bg-surface`} />
            <button type="button" onClick={() => setA({ ...a, materials: a.materials.filter((_, j) => j !== i) })} className="text-gray-400 hover:text-ember font-bold px-2" aria-label="Remove material">✕</button>
          </div>
        ))}
        <button type="button" onClick={() => setA({ ...a, materials: [...a.materials, { label: 'Materials', url: '' }] })} className={secondaryBtn}>+ Materials link</button>
      </div>

      {a.stage === 'A' && (
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase text-gray-500">Graded for (one 1–5 score per line)</p>
          {lines.map((l, i) => (
            <div key={l.id} className="grid grid-cols-[1fr_1fr_6rem_auto] gap-2 items-center">
              <select value={l.moduleId} onChange={e => setLine(i, { moduleId: e.target.value })} aria-label="Module" className={`${input} bg-surface`}>
                {epA.map(m => <option key={m.id} value={m.id}>{m.label}. {m.title}</option>)}
              </select>
              <input value={l.title} onChange={e => setLine(i, { title: e.target.value })} placeholder="What's scored" aria-label="Line title" className={`${input} bg-surface`} />
              <label className="flex items-center gap-1 text-xs font-bold text-gray-500">
                <input type="number" min={0} step="0.01" value={l.weight} onChange={e => setLine(i, { weight: Number(e.target.value) })} aria-label="Weight in module" className={`${input} bg-surface`} />%
              </label>
              <button type="button" onClick={() => setLines(ls => ls.filter((_, j) => j !== i))} className="text-gray-400 hover:text-ember font-bold px-2" aria-label="Remove line">✕</button>
            </div>
          ))}
          <button type="button" disabled={!epA.length} onClick={() => setLines(ls => [...ls, {
            id: uid('ex'), moduleId: epA[0].id, assignmentId: a.id, title: a.title || 'Part', order: ls.length + 1, weight: 0,
          }])} className={secondaryBtn}>+ Grading line</button>
          <p className="text-[10px] text-gray-400">Weight = this line's share of its module. Check each module totals 100% under "Episode A structure".</p>
        </div>
      )}

      <div className="flex gap-2">
        <button disabled={busy || !a.title.trim() || (a.stage === 'A' && lines.length === 0)} onClick={async () => {
          setBusy(true);
          try { await onSave({ ...a, title: a.title.trim(), materials: a.materials.filter(m => m.url.trim()) }, lines); } finally { setBusy(false); }
        }} className={primaryBtn}>Save assignment</button>
        <button onClick={onCancel} className={secondaryBtn}>Cancel</button>
      </div>
    </div>
  );
};

// --- Outline editor -------------------------------------------------------------

export const OutlineEditor: React.FC<{ onEditModule: (moduleId: string) => void }> = ({ onEditModule }) => {
  const { programOutline, modules, assignments, exercises, saveOutline, saveAssignment, deleteAssignment } = useAppContext();
  const [editing, setEditing] = useState<string | null>(null); // item id being edited, or `new:<weekId>`
  const [adding, setAdding] = useState<{ weekId: string; kind: 'content' | 'milestone' } | null>(null);
  const [contentPick, setContentPick] = useState('');
  const [milestone, setMilestone] = useState({ title: '', day: 5, description: '' });
  const [pendingDelete, setPendingDelete] = useState<{ weekId: string; item: OutlineItem } | null>(null);

  if (!programOutline) return <p className={`${card} text-sm text-gray-500`}>Set up the assessment program first (button above) to create the default weekly outline.</p>;
  const outline: ProgramOutline = programOutline;
  const save = (weeks: OutlineWeek[]) => saveOutline({ ...outline, weeks });
  const placedModules = new Set(outline.weeks.flatMap(w => w.items.flatMap(i => (i.kind === 'content' ? [i.moduleId] : []))));

  const moveItem = (wi: number, ii: number, dir: -1 | 1) => {
    const weeks = outline.weeks.map(w => ({ ...w, items: [...w.items] }));
    const item = weeks[wi].items[ii];
    const target = ii + dir;
    if (target >= 0 && target < weeks[wi].items.length) {
      [weeks[wi].items[ii], weeks[wi].items[target]] = [weeks[wi].items[target], item];
    } else if (weeks[wi + dir]) {
      // Past the top/bottom of a week: move into the neighbouring week.
      weeks[wi].items.splice(ii, 1);
      if (dir === -1) weeks[wi - 1].items.push(item); else weeks[wi + 1].items.unshift(item);
    } else return;
    save(weeks);
  };
  const moveToWeek = (wi: number, ii: number, toWeekId: string) => {
    const weeks = outline.weeks.map(w => ({ ...w, items: [...w.items] }));
    const [item] = weeks[wi].items.splice(ii, 1);
    weeks.find(w => w.id === toWeekId)!.items.push(item);
    save(weeks);
  };
  const addItem = (weekId: string, item: OutlineItem) =>
    save(outline.weeks.map(w => (w.id === weekId ? { ...w, items: [...w.items, item] } : w)));
  const removeItem = (weekId: string, itemId: string) =>
    save(outline.weeks.map(w => (w.id === weekId ? { ...w, items: w.items.filter(i => i.id !== itemId) } : w)));

  const itemTitle = (it: OutlineItem) =>
    it.kind === 'content' ? modules.find(m => m.id === it.moduleId)?.title ?? '(missing module)'
      : it.kind === 'assignment' ? assignments.find(a => a.id === it.assignmentId)?.title ?? '(missing assignment)'
      : it.title;

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500 px-2">
        This is exactly what trainees see in their sidebar, week by week. Assignment due days also appear as milestones on their My Program page.
      </p>
      {outline.weeks.map((week, wi) => (
        <div key={week.id} className={card}>
          <div className="flex items-center gap-2 mb-3">
            <input defaultValue={week.title} key={week.title} aria-label="Week title"
              onBlur={e => e.target.value.trim() && e.target.value !== week.title && save(outline.weeks.map(w => (w.id === week.id ? { ...w, title: e.target.value.trim() } : w)))}
              className={`${input} font-black text-gray-800 max-w-xs`} />
            <span className="text-[10px] font-black uppercase text-gray-400">Week {wi + 1}</span>
            {week.items.length === 0 && outline.weeks.length > 1 && (
              <button onClick={() => save(outline.weeks.filter(w => w.id !== week.id))} className="ml-auto text-xs font-bold text-gray-400 hover:text-ember">Remove empty week</button>
            )}
          </div>

          <ol className="space-y-2">
            {week.items.map((it, ii) => {
              const asg = it.kind === 'assignment' ? assignments.find(a => a.id === it.assignmentId) : undefined;
              return (
                <li key={it.id} className="bg-gray-50 rounded-2xl p-2 pl-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex flex-col">
                      <button onClick={() => moveItem(wi, ii, -1)} disabled={wi === 0 && ii === 0} aria-label="Move up" className="text-gray-400 hover:text-[#2E9DF7] disabled:opacity-30 text-[10px] leading-none px-1">▲</button>
                      <button onClick={() => moveItem(wi, ii, 1)} disabled={wi === outline.weeks.length - 1 && ii === week.items.length - 1} aria-label="Move down" className="text-gray-400 hover:text-[#2E9DF7] disabled:opacity-30 text-[10px] leading-none px-1">▼</button>
                    </div>
                    <span className="text-lg" aria-hidden="true">{it.kind === 'content' ? '📖' : it.kind === 'assignment' ? '📝' : '🏁'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-800 truncate">{itemTitle(it)}</p>
                      <p className="text-[10px] font-bold uppercase text-gray-400">
                        {it.kind === 'content' ? 'Content' : it.kind === 'milestone' ? `Milestone${it.day ? ` · day ${it.day}` : ''}`
                          : `Assignment · ${STAGE_OPTIONS.find(o => o.id === asg?.stage)?.label ?? ''}${asg?.dueDay ? ` · due day ${asg.dueDay}` : ''}`}
                      </p>
                    </div>
                    <select value={week.id} onChange={e => moveToWeek(wi, ii, e.target.value)} aria-label="Move to week" className={`${input} w-auto bg-surface text-xs`}>
                      {outline.weeks.map(w => <option key={w.id} value={w.id}>{w.title}</option>)}
                    </select>
                    {it.kind === 'content' && <button onClick={() => onEditModule(it.moduleId)} className={secondaryBtn}>Edit content</button>}
                    {it.kind === 'assignment' && <button onClick={() => setEditing(editing === it.id ? null : it.id)} className={secondaryBtn}>{editing === it.id ? 'Close' : 'Edit'}</button>}
                    <button onClick={() => setPendingDelete({ weekId: week.id, item: it })} aria-label="Remove" className="text-gray-400 hover:text-ember font-bold px-2">✕</button>
                  </div>
                  {it.kind === 'milestone' && it.description && <p className="text-xs text-gray-500 ml-12 mt-1">{it.description}</p>}
                  {it.kind === 'assignment' && asg && editing === it.id && (
                    <AssignmentForm initial={asg} initialLines={assignmentLines(exercises, asg.id)}
                      onSave={async (a, lines) => { await saveAssignment(a, lines); setEditing(null); }} onCancel={() => setEditing(null)} />
                  )}
                </li>
              );
            })}
            {week.items.length === 0 && <li className="text-xs text-gray-400 px-2">Empty week.</li>}
          </ol>

          {editing === `new:${week.id}` && (
            <AssignmentForm
              initial={{ id: uid('asg'), title: '', stage: 'A', materials: [], dueDay: 5 }}
              initialLines={[]}
              onSave={async (a, lines) => {
                await saveAssignment(a, lines);
                await addItem(week.id, { id: uid('oi'), kind: 'assignment', assignmentId: a.id });
                setEditing(null);
              }}
              onCancel={() => setEditing(null)} />
          )}

          {adding?.weekId === week.id && adding.kind === 'content' && (
            <div className="flex flex-wrap gap-2 mt-3">
              <select value={contentPick} onChange={e => setContentPick(e.target.value)} aria-label="Module to add" className={`${input} w-auto flex-1`}>
                <option value="">Choose a module to show in this week…</option>
                {[...modules].sort((a, b) => a.title.localeCompare(b.title)).map(m => (
                  <option key={m.id} value={m.id} disabled={placedModules.has(m.id)}>{m.title}{placedModules.has(m.id) ? ' (already placed)' : ''}</option>
                ))}
              </select>
              <button disabled={!contentPick} onClick={() => { addItem(week.id, { id: uid('oi'), kind: 'content', moduleId: contentPick }); setAdding(null); setContentPick(''); }} className={primaryBtn}>Add</button>
              <button onClick={() => setAdding(null)} className={secondaryBtn}>Cancel</button>
            </div>
          )}
          {adding?.weekId === week.id && adding.kind === 'milestone' && (
            <div className="grid sm:grid-cols-[1fr_auto] gap-2 mt-3">
              <input value={milestone.title} onChange={e => setMilestone({ ...milestone, title: e.target.value })} placeholder="e.g. Session organised and dialogue imported" aria-label="Milestone title" className={input} />
              <select value={milestone.day} onChange={e => setMilestone({ ...milestone, day: Number(e.target.value) })} aria-label="Milestone day" className={`${input} w-auto`}>
                {[1, 2, 3, 4, 5, 6, 7].map(d => <option key={d} value={d}>By {dayOption(d)}</option>)}
              </select>
              <input value={milestone.description} onChange={e => setMilestone({ ...milestone, description: e.target.value })} placeholder="Details (optional)" aria-label="Milestone details" className={`${input} sm:col-span-2`} />
              <div className="flex gap-2">
                <button disabled={!milestone.title.trim()} onClick={() => {
                  addItem(week.id, { id: uid('ms'), kind: 'milestone', title: milestone.title.trim(), day: milestone.day, ...(milestone.description.trim() ? { description: milestone.description.trim() } : {}) });
                  setAdding(null); setMilestone({ title: '', day: 5, description: '' });
                }} className={primaryBtn}>Add milestone</button>
                <button onClick={() => setAdding(null)} className={secondaryBtn}>Cancel</button>
              </div>
            </div>
          )}

          {!adding && editing !== `new:${week.id}` && (
            <div className="flex flex-wrap gap-2 mt-3">
              <button onClick={() => setAdding({ weekId: week.id, kind: 'content' })} className={secondaryBtn}>+ Content</button>
              <button onClick={() => setEditing(`new:${week.id}`)} className={secondaryBtn}>+ Assignment</button>
              <button onClick={() => setAdding({ weekId: week.id, kind: 'milestone' })} className={secondaryBtn}>+ Milestone</button>
            </div>
          )}
        </div>
      ))}

      <button onClick={() => save([...outline.weeks, { id: uid('wk'), title: `Week ${outline.weeks.length + 1}`, items: [] }])} className={secondaryBtn}>+ Add week</button>

      <ConfirmModal
        open={pendingDelete !== null}
        title={pendingDelete?.item.kind === 'assignment' ? 'Delete this assignment?' : 'Remove from the outline?'}
        message={pendingDelete?.item.kind === 'assignment'
          ? 'The assignment and its grading lines are deleted. Trainee submissions and any scores already given are kept in the database but no longer count.'
          : pendingDelete?.item.kind === 'content'
            ? 'The module is only removed from this week - its content is not deleted.'
            : 'The milestone is removed.'}
        confirmLabel={pendingDelete?.item.kind === 'assignment' ? 'Delete' : 'Remove'}
        onConfirm={async () => {
          const p = pendingDelete;
          setPendingDelete(null);
          if (!p) return;
          if (p.item.kind === 'assignment') await deleteAssignment(p.item.assignmentId);
          else await removeItem(p.weekId, p.item.id);
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
};
