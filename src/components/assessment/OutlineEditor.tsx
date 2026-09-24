import React, { useState } from 'react';
import { useAppContext } from '../../store';
import { Assignment, AssessmentStage, Exercise, OutlineItem, OutlineWeek, ProgramOutline } from '../../types';
import { splitEvenly } from '../../assessment/scoring';
import { DAY_NAMES, assignmentLines, itemDay } from '../../assessment/outline';
import { ConfirmModal } from '../ConfirmModal';
import { card, input, primaryBtn, saveWith, secondaryBtn } from './ui';

const uid = (p: string) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
// `input` is full-width; the per-item day/week pickers stay compact.
const smallSelect = 'bg-surface rounded-xl px-2 py-1.5 text-xs font-bold text-gray-600 focus:ring-2 focus:ring-[#2E9DF7]';
const round = (n: number) => Math.round(n * 100) / 100;
const dayOption = (d: number) => `Day ${d} · ${DAY_NAMES[d - 1]}`;
const STAGE_OPTIONS: { id: AssessmentStage; label: string }[] = [
  { id: 'A', label: 'Episode A – scored on its criteria' },
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
  const { assignments, assessmentConfig } = useAppContext();
  const [a, setA] = useState(initial);
  // A new Episode A assignment starts with one criterion worth 100%.
  const [lines, setLines] = useState(initialLines.length || initial.stage !== 'A' ? initialLines
    : [{ id: uid('ex'), assignmentId: initial.id, title: '', order: 1, weight: 100 }]);
  const othersWeight = assignments.filter(x => x.stage === 'A' && x.id !== a.id).reduce((t, x) => t + (x.weight ?? 0), 0);
  const lineTotal = lines.reduce((t, l) => t + l.weight, 0);
  const linesOk = Math.abs(lineTotal - 100) < 0.01;
  const [busy, setBusy] = useState(false);
  const setLine = (i: number, patch: Partial<Exercise>) => setLines(ls => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  return (
    <div className="bg-gray-50 rounded-2xl p-4 space-y-3 mt-2">
      <div className="grid sm:grid-cols-2 gap-2">
        <input value={a.title} onChange={e => setA({ ...a, title: e.target.value })} placeholder="Assignment title" aria-label="Assignment title" className={`${input} bg-surface sm:col-span-2`} />
        <select value={a.stage} onChange={e => setA({ ...a, stage: e.target.value as AssessmentStage })} aria-label="Graded as" className={`${input} bg-surface`}>
          {STAGE_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        <select value={a.dueDay ?? 7} onChange={e => setA({ ...a, dueDay: Number(e.target.value) })} aria-label="Due day" className={`${input} bg-surface`}>
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

      {a.stage === 'A' ? (
        <div className="bg-surface rounded-2xl p-4 space-y-3">
          <p className="text-[10px] font-black uppercase text-gray-500">How it's graded</p>
          <label className="flex flex-wrap items-center gap-2 text-sm font-bold text-gray-700">
            Counts
            <input type="number" min={0} step="0.5" value={a.weight ?? 0} onChange={e => setA({ ...a, weight: Number(e.target.value) })}
              aria-label="Weight in Episode A" className="w-20 bg-gray-50 rounded-xl p-2 text-sm focus:ring-2 focus:ring-[#2E9DF7] font-bold" />
            % of Episode A
            <span className="text-xs font-bold text-gray-400">= {round(((a.weight ?? 0) * assessmentConfig.stageWeights.episodeA) / 100)}% of the final grade · other Episode A assignments use {round(othersWeight)}%, so {round(100 - othersWeight)}% is left</span>
          </label>

          <div className="space-y-2">
            <p className="text-xs font-bold text-gray-500">Criteria - each is one 1–5 score the trainer gives for this submission</p>
            {lines.map((l, i) => (
              <div key={l.id} className="grid grid-cols-[1fr_6rem_auto] gap-2 items-center">
                <input value={l.title} onChange={e => setLine(i, { title: e.target.value })} placeholder="What's judged, e.g. Workflow" aria-label="Criterion name"
                  className={`${input} ${l.title.trim() ? '' : 'ring-2 ring-[#F4511E]'}`} />
                <label className="flex items-center gap-1 text-xs font-bold text-gray-500">
                  <input type="number" min={0} step="0.01" value={l.weight} onChange={e => setLine(i, { weight: Number(e.target.value) })} aria-label="Share of assignment" className={input} />%
                </label>
                <button type="button" onClick={() => setLines(ls => ls.filter((_, j) => j !== i))} className="text-gray-400 hover:text-ember font-bold px-2" aria-label="Remove criterion">✕</button>
              </div>
            ))}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-2">
                <button type="button" onClick={() => setLines(ls => [...ls, { id: uid('ex'), assignmentId: a.id, title: '', order: ls.length + 1, weight: ls.length ? 0 : 100 }])} className={secondaryBtn}>+ Criterion</button>
                {lines.length > 1 && (
                  <button type="button" onClick={() => { const sh = splitEvenly(lines.length); setLines(ls => ls.map((l, i) => ({ ...l, weight: sh[i] }))); }} className="text-xs font-bold text-[#2E9DF7] hover:underline">Split equally</button>
                )}
              </div>
              {lines.length > 0 && (
                <span className={`text-xs font-black ${linesOk ? 'text-leaf' : 'text-ember'}`}>{linesOk ? '✓ ' : ''}Criteria total {round(lineTotal)}%</span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <p className="text-xs text-gray-500 bg-surface rounded-2xl p-3">
          Graded with the {a.stage === 'B' ? 'Episode B' : 'Pod Trial'} reviewer table - see the <b>Grade formula</b> tab.
        </p>
      )}

      <div className="flex gap-2">
        <button disabled={busy || !a.title.trim() || (a.stage === 'A' && (lines.length === 0 || lines.some(l => !l.title.trim())))}
          title={a.stage === 'A' && (lines.length === 0 || lines.some(l => !l.title.trim())) ? 'Give every criterion a name' : undefined} onClick={async () => {
          setBusy(true);
          try { await onSave({ ...a, title: a.title.trim(), materials: a.materials.filter(m => m.url.trim()) }, lines.map((l, i) => ({ ...l, title: l.title.trim(), order: i + 1 }))); } finally { setBusy(false); }
        }} className={primaryBtn}>Save assignment</button>
        <button onClick={onCancel} className={secondaryBtn}>Cancel</button>
      </div>
    </div>
  );
};

// --- Outline editor -------------------------------------------------------------

export const OutlineEditor: React.FC<{ onEditModule: (moduleId: string) => void }> = ({ onEditModule }) => {
  const { programOutline, modules, assignments, exercises, assessmentConfig, saveOutline, saveAssignment, deleteAssignment } = useAppContext();
  const [editing, setEditing] = useState<string | null>(null); // assignment item id being edited
  // The day slot the admin clicked "+ Add" on, and what they're adding there.
  const [adding, setAdding] = useState<{ weekId: string; day: number; kind?: 'content' | 'assignment' | 'milestone' } | null>(null);
  const [contentPick, setContentPick] = useState('');
  const [milestone, setMilestone] = useState({ title: '', description: '' });
  const [pendingDelete, setPendingDelete] = useState<{ weekId: string; item: OutlineItem } | null>(null);

  if (!programOutline) return <p className={`${card} text-sm text-gray-500`}>Set up the assessment program first (button above) to create the default weekly outline.</p>;
  const outline: ProgramOutline = programOutline;
  const save = (weeks: OutlineWeek[]) => saveWith(saveOutline({ ...outline, weeks }));
  const placedModules = new Set(outline.weeks.flatMap(w => w.items.flatMap(i => (i.kind === 'content' ? [i.moduleId] : []))));

  const updateItem = (weekId: string, itemId: string, patch: Partial<OutlineItem>) =>
    save(outline.weeks.map(w => (w.id === weekId ? { ...w, items: w.items.map(i => (i.id === itemId ? { ...i, ...patch } as OutlineItem : i)) } : w)));
  const moveToWeek = (fromWeekId: string, item: OutlineItem, toWeekId: string) =>
    save(outline.weeks.map(w => (
      w.id === fromWeekId ? { ...w, items: w.items.filter(i => i.id !== item.id) }
        : w.id === toWeekId ? { ...w, items: [...w.items, item] } : w)));
  // An assignment's day is its due day, so moving it rewrites the assignment.
  const setDay = (weekId: string, it: OutlineItem, day: number) => {
    if (it.kind === 'assignment') {
      const asg = assignments.find(a => a.id === it.assignmentId);
      if (asg) saveWith(saveAssignment({ ...asg, dueDay: day }, assignmentLines(exercises, asg.id)));
    } else updateItem(weekId, it.id, { day });
  };
  const moveWeek = (wi: number, dir: -1 | 1) => {
    const weeks = [...outline.weeks];
    if (!weeks[wi + dir]) return;
    [weeks[wi], weeks[wi + dir]] = [weeks[wi + dir], weeks[wi]];
    // Default "Week N" titles follow the new position; custom titles stay.
    save(weeks.map((w, i) => (/^Week \d+$/.test(w.title) ? { ...w, title: `Week ${i + 1}` } : w)));
  };
  // Swap with the neighbour on the same day - the order trainees see.
  const moveWithinDay = (week: OutlineWeek, it: OutlineItem, dir: -1 | 1) => {
    const sameDay = week.items.filter(x => itemDay(x, assignments) === itemDay(it, assignments));
    const other = sameDay[sameDay.findIndex(x => x.id === it.id) + dir];
    if (!other) return;
    const items = [...week.items];
    const i = items.findIndex(x => x.id === it.id), j = items.findIndex(x => x.id === other.id);
    [items[i], items[j]] = [items[j], items[i]];
    save(outline.weeks.map(w => (w.id === week.id ? { ...w, items } : w)));
  };
  // "Counts 40% of Episode A → 8% of final · Workflow 50% · Dialogue 50%"
  const gradingSummary = (asg: Assignment) => {
    const w = assessmentConfig.stageWeights;
    if (asg.stage !== 'A') {
      const share = asg.stage === 'B' ? w.episodeB : w.pod;
      return `${asg.stage === 'B' ? 'Episode B' : 'Pod Trial'} · ${share}% of the final grade${asg.stage !== 'B' ? ' (shared by the pod episodes)' : ''}`;
    }
    const criteria = assignmentLines(exercises, asg.id);
    return `Counts ${asg.weight ?? 0}% of Episode A → ${round(((asg.weight ?? 0) * w.episodeA) / 100)}% of final`
      + (criteria.length ? ` · ${criteria.map(c => `${c.title || '(no name)'} ${c.weight}%`).join(' · ')}` : ' · ⚠ no criteria yet');
  };
  const addItem = (weekId: string, item: OutlineItem) =>
    save(outline.weeks.map(w => (w.id === weekId ? { ...w, items: [...w.items, item] } : w)));
  const removeItem = (weekId: string, itemId: string) =>
    save(outline.weeks.map(w => (w.id === weekId ? { ...w, items: w.items.filter(i => i.id !== itemId) } : w)));

  const itemTitle = (it: OutlineItem) =>
    it.kind === 'content' ? modules.find(m => m.id === it.moduleId)?.title ?? '(missing module)'
      : it.kind === 'assignment' ? assignments.find(a => a.id === it.assignmentId)?.title ?? '(missing assignment)'
      : it.title;
  const closeAdd = () => { setAdding(null); setContentPick(''); setMilestone({ title: '', description: '' }); };

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500 px-2">
        Each week is laid out day by day - put content, assignments and milestones on the day they happen, and use ▲▼ to order things within a day.
        Trainees see exactly this order in their sidebar. Grading lives on each assignment (click Edit). Day 1 is the trainee's start day (Mon if they start on a Monday).
      </p>
      {outline.weeks.map((week, wi) => {
        const byDay = (d: number) => week.items.filter(it => itemDay(it, assignments) === d);
        // Weekdays always show; the weekend only when something is on it.
        const days = [1, 2, 3, 4, 5, 6, 7].filter(d => d <= 5 || byDay(d).length > 0 || adding?.weekId === week.id && adding.day === d);
        return (
        <div key={week.id} className={card}>
          <div className="flex items-center gap-2 mb-4">
            <input defaultValue={week.title} key={week.title} aria-label="Week title"
              onBlur={e => e.target.value.trim() && e.target.value !== week.title && save(outline.weeks.map(w => (w.id === week.id ? { ...w, title: e.target.value.trim() } : w)))}
              className={`${input} font-black text-gray-800 max-w-xs`} />
            <span className="text-[10px] font-black uppercase text-gray-400">Week {wi + 1}</span>
            {/* Reordering weeks renumbers them, so trainees' due dates move with the week. */}
            <div className="flex gap-1 ml-2">
              <button onClick={() => moveWeek(wi, -1)} disabled={wi === 0} aria-label="Move week earlier" title="Move week earlier" className="w-7 h-7 rounded-full bg-gray-100 text-gray-500 hover:bg-sky hover:text-navy disabled:opacity-30 text-xs font-black">▲</button>
              <button onClick={() => moveWeek(wi, 1)} disabled={wi === outline.weeks.length - 1} aria-label="Move week later" title="Move week later" className="w-7 h-7 rounded-full bg-gray-100 text-gray-500 hover:bg-sky hover:text-navy disabled:opacity-30 text-xs font-black">▼</button>
            </div>
            {week.items.length === 0 && outline.weeks.length > 1 && (
              <button onClick={() => save(outline.weeks.filter(w => w.id !== week.id))} className="ml-auto text-xs font-bold text-gray-400 hover:text-ember">Remove empty week</button>
            )}
          </div>

          <ol className="space-y-1">
            {days.map(day => {
              const items = byDay(day);
              const addingHere = adding?.weekId === week.id && adding.day === day;
              return (
                <li key={day} className="grid grid-cols-[4.5rem_1fr] gap-3 border-t border-gray-100 first:border-t-0 py-2">
                  <div className="pt-2">
                    <p className="text-xs font-black text-gray-700">Day {day}</p>
                    <p className="text-[10px] font-bold uppercase text-gray-400">{DAY_NAMES[day - 1]}</p>
                  </div>
                  <div className="space-y-2 min-w-0">
                    {items.map((it, ii) => {
                      const asg = it.kind === 'assignment' ? assignments.find(a => a.id === it.assignmentId) : undefined;
                      return (
                        <div key={it.id} className={`rounded-2xl p-2 pl-3 ${it.kind === 'assignment' ? 'bg-[#F4511E]/10' : it.kind === 'milestone' ? 'bg-[#3DDC97]/10' : 'bg-gray-50'}`}>
                          <div className="flex flex-wrap items-center gap-2">
                            {items.length > 1 && (
                              <div className="flex flex-col">
                                <button onClick={() => moveWithinDay(week, it, -1)} disabled={ii === 0} aria-label="Move earlier in the day" className="text-gray-400 hover:text-[#2E9DF7] disabled:opacity-30 text-[10px] leading-none px-1">▲</button>
                                <button onClick={() => moveWithinDay(week, it, 1)} disabled={ii === items.length - 1} aria-label="Move later in the day" className="text-gray-400 hover:text-[#2E9DF7] disabled:opacity-30 text-[10px] leading-none px-1">▼</button>
                              </div>
                            )}
                            <span className="text-lg" aria-hidden="true">{it.kind === 'content' ? '📖' : it.kind === 'assignment' ? '📝' : '🏁'}</span>
                            <div className="flex-1 min-w-[140px]">
                              <p className="text-sm font-bold text-gray-800 truncate">{itemTitle(it)}</p>
                              <p className="text-[10px] font-bold uppercase text-gray-400">
                                {it.kind === 'content' ? 'Content' : it.kind === 'milestone' ? 'Milestone' : 'Assignment · due this day'}
                              </p>
                              {asg && <p className={`text-[11px] font-bold mt-0.5 ${asg.stage === 'A' && !assignmentLines(exercises, asg.id).length ? 'text-ember' : 'text-gray-600'}`}>{gradingSummary(asg)}</p>}
                            </div>
                            <select value={day} onChange={e => setDay(week.id, it, Number(e.target.value))} aria-label="Move to day" className={smallSelect}>
                              {[1, 2, 3, 4, 5, 6, 7].map(d => <option key={d} value={d}>Day {d} · {DAY_NAMES[d - 1]}</option>)}
                            </select>
                            <select value={week.id} onChange={e => moveToWeek(week.id, it, e.target.value)} aria-label="Move to week" className={smallSelect}>
                              {outline.weeks.map(w => <option key={w.id} value={w.id}>{w.title}</option>)}
                            </select>
                            {it.kind === 'content' && <button onClick={() => onEditModule(it.moduleId)} className={secondaryBtn}>Edit content</button>}
                            {it.kind === 'assignment' && <button onClick={() => setEditing(editing === it.id ? null : it.id)} className={secondaryBtn}>{editing === it.id ? 'Close' : 'Edit'}</button>}
                            <button onClick={() => setPendingDelete({ weekId: week.id, item: it })} aria-label="Remove" className="text-gray-400 hover:text-ember font-bold px-2">✕</button>
                          </div>
                          {it.kind === 'milestone' && it.description && <p className="text-xs text-gray-500 ml-8 mt-1">{it.description}</p>}
                          {it.kind === 'assignment' && asg && editing === it.id && (
                            <AssignmentForm initial={asg} initialLines={assignmentLines(exercises, asg.id)}
                              onSave={async (a, lines) => { if (await saveWith(saveAssignment(a, lines))) setEditing(null); }} onCancel={() => setEditing(null)} />
                          )}
                        </div>
                      );
                    })}

                    {!addingHere ? (
                      <button onClick={() => { closeAdd(); setAdding({ weekId: week.id, day }); }}
                        className="text-[11px] font-bold text-gray-400 hover:text-[#2E9DF7] px-1 py-1">+ Add on day {day}</button>
                    ) : !adding.kind ? (
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => setAdding({ ...adding, kind: 'content' })} className={secondaryBtn}>📖 Content</button>
                        <button onClick={() => setAdding({ ...adding, kind: 'assignment' })} className={secondaryBtn}>📝 Assignment due this day</button>
                        <button onClick={() => setAdding({ ...adding, kind: 'milestone' })} className={secondaryBtn}>🏁 Milestone</button>
                        <button onClick={closeAdd} className="text-xs font-bold text-gray-400 px-2">Cancel</button>
                      </div>
                    ) : adding.kind === 'content' ? (
                      <div className="flex flex-wrap gap-2">
                        <select value={contentPick} onChange={e => setContentPick(e.target.value)} aria-label="Module to add" className={`${input} w-auto flex-1`}>
                          <option value="">Choose a module for day {day}…</option>
                          {[...modules].sort((a, b) => a.title.localeCompare(b.title)).map(m => (
                            <option key={m.id} value={m.id} disabled={placedModules.has(m.id)}>{m.title}{placedModules.has(m.id) ? ' (already placed)' : ''}</option>
                          ))}
                        </select>
                        <button disabled={!contentPick} onClick={() => { addItem(week.id, { id: uid('oi'), kind: 'content', moduleId: contentPick, day }); closeAdd(); }} className={primaryBtn}>Add</button>
                        <button onClick={closeAdd} className={secondaryBtn}>Cancel</button>
                      </div>
                    ) : adding.kind === 'milestone' ? (
                      <div className="space-y-2">
                        <input value={milestone.title} onChange={e => setMilestone({ ...milestone, title: e.target.value })} placeholder="e.g. Session organised and dialogue imported" aria-label="Milestone title" className={input} />
                        <input value={milestone.description} onChange={e => setMilestone({ ...milestone, description: e.target.value })} placeholder="Details (optional)" aria-label="Milestone details" className={input} />
                        <div className="flex gap-2">
                          <button disabled={!milestone.title.trim()} onClick={() => {
                            addItem(week.id, { id: uid('ms'), kind: 'milestone', title: milestone.title.trim(), day, ...(milestone.description.trim() ? { description: milestone.description.trim() } : {}) });
                            closeAdd();
                          }} className={primaryBtn}>Add milestone</button>
                          <button onClick={closeAdd} className={secondaryBtn}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <AssignmentForm
                        initial={{ id: uid('asg'), title: '', stage: 'A', materials: [], dueDay: day }}
                        initialLines={[]}
                        onSave={async (a, lines) => {
                          if (!(await saveWith(saveAssignment(a, lines)))) return;
                          await addItem(week.id, { id: uid('oi'), kind: 'assignment', assignmentId: a.id });
                          closeAdd();
                        }}
                        onCancel={closeAdd} />
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
        );
      })}

      <button onClick={() => save([...outline.weeks, { id: uid('wk'), title: `Week ${outline.weeks.length + 1}`, items: [] }])} className={secondaryBtn}>+ Add week</button>
      <ConfirmModal
        open={pendingDelete !== null}
        title={pendingDelete?.item.kind === 'assignment' ? 'Delete this assignment?' : 'Remove from the outline?'}
        message={pendingDelete?.item.kind === 'assignment'
          ? 'The assignment and its scores are deleted. Trainee submissions and any scores already given are kept in the database but no longer count.'
          : pendingDelete?.item.kind === 'content'
            ? 'The module is only removed from this week - its content is not deleted.'
            : 'The milestone is removed.'}
        confirmLabel={pendingDelete?.item.kind === 'assignment' ? 'Delete' : 'Remove'}
        onConfirm={async () => {
          const p = pendingDelete;
          setPendingDelete(null);
          if (!p) return;
          if (p.item.kind === 'assignment') await saveWith(deleteAssignment(p.item.assignmentId));
          else await removeItem(p.weekId, p.item.id);
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
};
