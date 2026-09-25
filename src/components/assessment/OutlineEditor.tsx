import React, { useState } from 'react';
import { CalendarPlus } from 'lucide-react';
import { DEFAULT_WEEK_GOALS } from '../../assessment/config';
import { useAppContext } from '../../store';
import { Assignment, AssessmentStage, Exercise, OutlineItem, OutlineWeek, ProgramOutline } from '../../types';
import { splitEvenly } from '../../assessment/scoring';
import { DAY_NAMES, assignmentLines, itemDay, normalizeWeek, spreadDays, weekGroups, weekLabel } from '../../assessment/outline';
import { ConfirmModal } from '../ConfirmModal';
import { card, input, primaryBtn, saveWith, secondaryBtn } from './ui';

const uid = (p: string) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
// `input` is full-width; the per-item day/week pickers stay compact.
const smallSelect = 'bg-surface rounded-xl px-2 py-1.5 text-xs font-bold text-gray-600 focus:ring-2 focus:ring-[#2E9DF7]';
const round = (n: number) => Math.round(n * 100) / 100;
const PROGRAM_WEEKS = 4;
const dayOption = (d: number) => `Day ${d} · ${DAY_NAMES[d - 1]}`;
const STAGE_OPTIONS: { id: AssessmentStage; label: string }[] = [
  { id: 'A', label: 'Episode A – scored on its criteria' },
  { id: 'B', label: 'Episode B – final episode test' },
  { id: 'P1', label: 'Pod Trial – episode 1' },
  { id: 'P2', label: 'Pod Trial – episode 2 (only if 2 required)' },
  { id: 'DA', label: 'Audio Description (DA) – one submission, reviewer table' },
];

// --- Assignment form ------------------------------------------------------------

export const AssignmentForm: React.FC<{
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
            <p className="text-xs font-bold text-gray-500">Criteria - each is one 1–5 score the trainer gives for this submission. Describe what each score looks like for that criterion; trainees and reviewers see it as a rubric table.</p>
            {lines.map((l, i) => (
              <div key={l.id} className="bg-gray-50 rounded-2xl p-3 space-y-2">
              <div className="grid grid-cols-[1fr_6rem_auto] gap-2 items-center">
                <input value={l.title} onChange={e => setLine(i, { title: e.target.value })} placeholder="What's judged, e.g. Workflow" aria-label="Criterion name"
                  className={`${input} ${l.title.trim() ? '' : 'ring-2 ring-[#F4511E]'}`} />
                <label className="flex items-center gap-1 text-xs font-bold text-gray-500">
                  <input type="number" min={0} step="0.01" value={l.weight} onChange={e => setLine(i, { weight: Number(e.target.value) })} aria-label="Share of assignment" className={input} />%
                </label>
                <button type="button" onClick={() => setLines(ls => ls.filter((_, j) => j !== i))} className="text-gray-400 hover:text-ember font-bold px-2" aria-label="Remove criterion">✕</button>
              </div>
              <div className="grid gap-2 sm:grid-cols-5">
                {[1, 2, 3, 4, 5].map(n => (
                  <label key={n} className="block">
                    <span className="text-[10px] font-black uppercase text-gray-400">Score {n}</span>
                    <textarea value={l.levels?.[n - 1] ?? ''} placeholder={`What a ${n} looks like`} aria-label={`${l.title || 'Criterion'} - score ${n} description`}
                      onChange={e => { const levels = [1, 2, 3, 4, 5].map(k => (k === n ? e.target.value : l.levels?.[k - 1] ?? '')); setLine(i, { levels }); }}
                      className={`${input} bg-surface h-24 text-xs`} />
                  </label>
                ))}
              </div>
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
          Graded with the {a.stage === 'B' ? 'Episode B' : a.stage === 'DA' ? 'Audio Description' : 'Pod Trial'} reviewer table - see the <b>Grade formula</b> tab.
        </p>
      )}

      <div className="flex gap-2">
        <button disabled={busy || !a.title.trim() || (a.stage === 'A' && (lines.length === 0 || lines.some(l => !l.title.trim())))}
          title={a.stage === 'A' && (lines.length === 0 || lines.some(l => !l.title.trim())) ? 'Give every criterion a name' : undefined} onClick={async () => {
          setBusy(true);
          try { await onSave({ ...a, title: a.title.trim(), materials: a.materials.filter(m => m.url.trim()) }, lines.map((l, i) => {
            const { levels, ...rest } = l;
            const clean = (levels ?? []).map(t => t.trim());
            return { ...rest, title: l.title.trim(), order: i + 1, ...(clean.some(Boolean) ? { levels: clean } : {}) };
          })); } finally { setBusy(false); }
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
  // Where the admin clicked "+ Add" (a section, or null = not in a section), and what they're adding.
  const [adding, setAdding] = useState<{ weekId: string; sectionId: string | null; kind?: 'content' | 'assignment' | 'milestone' } | null>(null);
  const [contentPick, setContentPick] = useState('');
  const [milestone, setMilestone] = useState({ title: '', description: '', day: 5 });
  const [pendingDelete, setPendingDelete] = useState<{ weekId: string; item: OutlineItem } | null>(null);

  if (!programOutline) return <p className={`${card} text-sm text-gray-500`}>Set up the assessment program first (button above) to create the default weekly outline.</p>;
  const outline: ProgramOutline = programOutline;
  const save = (weeks: OutlineWeek[]) => saveWith(saveOutline({ ...outline, weeks }));
  const placedModules = new Set(outline.weeks.flatMap(w => w.items.flatMap(i => (i.kind === 'content' ? [i.moduleId] : []))));

  // Every edit works on the week in display order (see normalizeWeek).
  const editWeek = (weekId: string, change: (w: OutlineWeek) => OutlineWeek) =>
    save(outline.weeks.map(w => (w.id === weekId ? change(normalizeWeek(w, assignments)) : w)));
  const sameGroup = (a: OutlineItem, b: OutlineItem, w: OutlineWeek) => {
    const known = new Set((w.sections ?? []).map(s => s.id));
    const key = (i: OutlineItem) => (i.sectionId && known.has(i.sectionId) ? i.sectionId : '');
    return key(a) === key(b);
  };
  const moveInGroup = (weekId: string, it: OutlineItem, dir: -1 | 1) => editWeek(weekId, w => {
    const group = w.items.filter(x => sameGroup(x, it, w));
    const other = group[group.findIndex(x => x.id === it.id) + dir];
    if (!other) return w;
    const items = [...w.items];
    const i = items.findIndex(x => x.id === it.id), j = items.findIndex(x => x.id === other.id);
    [items[i], items[j]] = [items[j], items[i]];
    return { ...w, items };
  });
  const setSection = (weekId: string, it: OutlineItem, sectionId: string) => editWeek(weekId, w => {
    const { sectionId: _, ...rest } = it;
    const moved = (sectionId ? { ...rest, sectionId } : rest) as OutlineItem;
    return { ...w, items: [...w.items.filter(x => x.id !== it.id), moved] };
  });
  const moveToWeek = (fromWeekId: string, it: OutlineItem, toWeekId: string) => {
    const { sectionId: _, ...loose } = it;
    save(outline.weeks.map(w => (
      w.id === fromWeekId ? { ...w, items: w.items.filter(i => i.id !== it.id) }
        : w.id === toWeekId ? { ...normalizeWeek(w, assignments), items: [...normalizeWeek(w, assignments).items, loose as OutlineItem] } : w)));
  };
  const moveWeek = (wi: number, dir: -1 | 1) => {
    const weeks = [...outline.weeks];
    if (!weeks[wi + dir]) return;
    [weeks[wi], weeks[wi + dir]] = [weeks[wi + dir], weeks[wi]];
    save(weeks);
  };
  // An assignment's day is its due day, so changing it rewrites the assignment.
  const setDay = (weekId: string, it: OutlineItem, day: number) => {
    if (it.kind === 'assignment') {
      const asg = assignments.find(a => a.id === it.assignmentId);
      if (asg) saveWith(saveAssignment({ ...asg, dueDay: day }, assignmentLines(exercises, asg.id)));
    } else editWeek(weekId, w => ({ ...w, items: w.items.map(i => (i.id === it.id ? { ...i, day } as OutlineItem : i)) }));
  };
  // A lesson's planned day (null = any day that week) and estimated hours;
  // unset values are removed rather than stored empty.
  const setLessonPlan = (weekId: string, it: OutlineItem, patch: { day?: number | null; hours?: number | null }) =>
    editWeek(weekId, w => ({ ...w, items: w.items.map(i => {
      if (i.id !== it.id || i.kind !== 'content') return i;
      const next: Record<string, unknown> = { ...i, ...patch };
      for (const k of ['day', 'hours']) if (next[k] === null || next[k] === undefined || Number.isNaN(next[k])) delete next[k];
      return next as OutlineItem;
    }) }));
  // Gives every lesson without a planned day a recommended one, spreading
  // them evenly over Mon-Fri in outline order. Lessons already planned stay put.
  const planUnplanned = (week: OutlineWeek) => {
    const unplanned = weekGroups(week, assignments).flatMap(g => g.items).filter(i => i.kind === 'content' && !i.day).map(i => i.id);
    const days = spreadDays(unplanned.length);
    editWeek(week.id, w => ({ ...w, items: w.items.map(i => (unplanned.includes(i.id) ? { ...i, day: days[unplanned.indexOf(i.id)] } as OutlineItem : i)) }));
  };
  const addSection = (weekId: string) => editWeek(weekId, w => ({ ...w, sections: [...(w.sections ?? []), { id: uid('sec'), title: 'New section' }] }));
  const renameSection = (weekId: string, sectionId: string, title: string) =>
    editWeek(weekId, w => ({ ...w, sections: (w.sections ?? []).map(sec => (sec.id === sectionId ? { ...sec, title } : sec)) }));
  const moveSection = (weekId: string, si: number, dir: -1 | 1) => editWeek(weekId, w => {
    const sections = [...(w.sections ?? [])];
    if (!sections[si + dir]) return w;
    [sections[si], sections[si + dir]] = [sections[si + dir], sections[si]];
    return { ...w, sections };
  });
  // Removing a section keeps its items - they move to "Not in a section".
  const removeSection = (weekId: string, sectionId: string) => editWeek(weekId, w => ({
    ...w,
    sections: (w.sections ?? []).filter(sec => sec.id !== sectionId),
    items: w.items.map(i => { if (i.sectionId !== sectionId) return i; const { sectionId: _, ...rest } = i; return rest as OutlineItem; }),
  }));
  // Weeks used to be renamed to group content; turn such a title into a section.
  const titleToSection = (week: OutlineWeek, wi: number) => editWeek(week.id, w => {
    const id = uid('sec');
    return { ...w, title: weekLabel(wi), sections: [{ id, title: week.title }, ...(w.sections ?? [])],
      items: w.items.map(i => (i.kind === 'content' && !i.sectionId ? { ...i, sectionId: id } : i)) };
  });
  const addItem = (weekId: string, item: OutlineItem) => editWeek(weekId, w => ({ ...w, items: [...w.items, item] }));
  const removeItem = (weekId: string, itemId: string) => editWeek(weekId, w => ({ ...w, items: w.items.filter(i => i.id !== itemId) }));

  // "Counts 40% of Episode A → 8% of final · Workflow 50% · Dialogue 50%"
  const gradingSummary = (asg: Assignment) => {
    const w = assessmentConfig.stageWeights;
    if (asg.stage !== 'A') {
      if (asg.stage === 'B') return `Episode B · ${w.episodeB}% of the final grade`;
      if (asg.stage === 'DA') return `Audio Description · ${w.da}% of the final grade`;
      return `Pod Trial · ${w.pod}% of the final grade (shared by the pod episodes)`;
    }
    const criteria = assignmentLines(exercises, asg.id);
    return `Counts ${asg.weight ?? 0}% of Episode A → ${round(((asg.weight ?? 0) * w.episodeA) / 100)}% of final`
      + (criteria.length ? ` · ${criteria.map(c => `${c.title || '(no name)'} ${c.weight}%`).join(' · ')}` : ' · ⚠ no criteria yet');
  };
  const itemTitle = (it: OutlineItem) =>
    it.kind === 'content' ? modules.find(m => m.id === it.moduleId)?.title ?? '(missing module)'
      : it.kind === 'assignment' ? assignments.find(a => a.id === it.assignmentId)?.title ?? '(missing assignment)'
      : it.title;
  const closeAdd = () => { setAdding(null); setContentPick(''); setMilestone({ title: '', description: '', day: 5 }); };
  const withSection = (item: OutlineItem, sectionId: string | null) => (sectionId ? { ...item, sectionId } : item) as OutlineItem;

  const itemRow = (week: OutlineWeek, it: OutlineItem, ii: number, count: number) => {
    const asg = it.kind === 'assignment' ? assignments.find(a => a.id === it.assignmentId) : undefined;
    const day = itemDay(it, assignments);
    return (
      <div key={it.id} className={`rounded-2xl p-2 pl-3 ${it.kind === 'assignment' ? 'bg-[#F4511E]/10' : it.kind === 'milestone' ? 'bg-[#3DDC97]/10' : 'bg-gray-50'}`}>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-col">
            <button onClick={() => moveInGroup(week.id, it, -1)} disabled={ii === 0} aria-label="Move up" className="text-gray-400 hover:text-[#2E9DF7] disabled:opacity-30 text-[10px] leading-none px-1">▲</button>
            <button onClick={() => moveInGroup(week.id, it, 1)} disabled={ii === count - 1} aria-label="Move down" className="text-gray-400 hover:text-[#2E9DF7] disabled:opacity-30 text-[10px] leading-none px-1">▼</button>
          </div>
          <span className="text-lg" aria-hidden="true">{it.kind === 'content' ? '📖' : it.kind === 'assignment' ? '📝' : '🏁'}</span>
          <div className="flex-1 min-w-[160px]">
            <p className="text-sm font-bold text-gray-800 truncate">{itemTitle(it)}</p>
            <p className="text-[10px] font-bold uppercase text-gray-400">{it.kind === 'content' ? 'Content' : it.kind === 'milestone' ? 'Milestone' : 'Assignment'}</p>
            {asg && <p className={`text-[11px] font-bold mt-0.5 ${asg.stage === 'A' && !assignmentLines(exercises, asg.id).length ? 'text-ember' : 'text-gray-600'}`}>{gradingSummary(asg)}</p>}
          </div>
          {it.kind === 'content' ? (
            <>
              <select value={it.day ?? ''} onChange={e => setLessonPlan(week.id, it, { day: e.target.value ? Number(e.target.value) : null })} aria-label="Planned day" className={smallSelect}>
                <option value="">Plan: any day</option>
                {[1, 2, 3, 4, 5, 6, 7].map(d => <option key={d} value={d}>Plan: {dayOption(d)}</option>)}
              </select>
              <label className="flex items-center gap-1 text-xs font-bold text-gray-500">
                <input type="number" min={0} step="0.5" defaultValue={it.hours ?? ''} key={it.hours ?? ''} placeholder="–" aria-label="Estimated hours"
                  onBlur={e => { const v = e.target.value === '' ? null : Number(e.target.value); if (v !== (it.hours ?? null)) setLessonPlan(week.id, it, { hours: v }); }}
                  className="w-14 bg-surface rounded-xl px-2 py-1.5 text-xs font-bold text-gray-600 focus:ring-2 focus:ring-[#2E9DF7]" />h
              </label>
            </>
          ) : (
            <select value={day} onChange={e => setDay(week.id, it, Number(e.target.value))} aria-label={it.kind === 'assignment' ? 'Due day' : 'Milestone day'} className={smallSelect}>
              {[1, 2, 3, 4, 5, 6, 7].map(d => <option key={d} value={d}>{it.kind === 'assignment' ? 'Due' : 'By'} {dayOption(d)}</option>)}
            </select>
          )}
          <select value={it.sectionId && (week.sections ?? []).some(sec => sec.id === it.sectionId) ? it.sectionId : ''} onChange={e => setSection(week.id, it, e.target.value)} aria-label="Section" className={smallSelect}>
            {(week.sections ?? []).map(sec => <option key={sec.id} value={sec.id}>{sec.title || 'Untitled section'}</option>)}
            <option value="">No section</option>
          </select>
          <select value={week.id} onChange={e => moveToWeek(week.id, it, e.target.value)} aria-label="Move to week" className={smallSelect}>
            {outline.weeks.map((w, n) => <option key={w.id} value={w.id}>{weekLabel(n)}</option>)}
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
  };

  const addArea = (week: OutlineWeek, sectionId: string | null) => {
    const here = adding?.weekId === week.id && adding.sectionId === sectionId;
    if (!here) {
      return <button onClick={() => { closeAdd(); setAdding({ weekId: week.id, sectionId }); }} className="text-[11px] font-bold text-gray-400 hover:text-[#2E9DF7] px-1 py-1">+ Add here</button>;
    }
    if (!adding.kind) {
      return (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setAdding({ ...adding, kind: 'content' })} className={secondaryBtn}>📖 Content</button>
          <button onClick={() => setAdding({ ...adding, kind: 'assignment' })} className={secondaryBtn}>📝 Assignment</button>
          <button onClick={() => setAdding({ ...adding, kind: 'milestone' })} className={secondaryBtn}>🏁 Milestone</button>
          <button onClick={closeAdd} className="text-xs font-bold text-gray-400 px-2">Cancel</button>
        </div>
      );
    }
    if (adding.kind === 'content') {
      return (
        <div className="flex flex-wrap gap-2">
          <select value={contentPick} onChange={e => setContentPick(e.target.value)} aria-label="Module to add" className={`${input} w-auto flex-1`}>
            <option value="">Choose a module…</option>
            {[...modules].sort((a, b) => a.title.localeCompare(b.title)).map(m => (
              <option key={m.id} value={m.id} disabled={placedModules.has(m.id)}>{m.title}{placedModules.has(m.id) ? ' (already placed)' : ''}</option>
            ))}
          </select>
          <button disabled={!contentPick} onClick={() => { addItem(week.id, withSection({ id: uid('oi'), kind: 'content', moduleId: contentPick }, sectionId)); closeAdd(); }} className={primaryBtn}>Add</button>
          <button onClick={closeAdd} className={secondaryBtn}>Cancel</button>
        </div>
      );
    }
    if (adding.kind === 'milestone') {
      return (
        <div className="space-y-2">
          <div className="grid sm:grid-cols-[1fr_auto] gap-2">
            <input value={milestone.title} onChange={e => setMilestone({ ...milestone, title: e.target.value })} placeholder="e.g. Session organised and dialogue imported" aria-label="Milestone title" className={input} />
            <select value={milestone.day} onChange={e => setMilestone({ ...milestone, day: Number(e.target.value) })} aria-label="Milestone day" className={`${input} w-auto`}>
              {[1, 2, 3, 4, 5, 6, 7].map(d => <option key={d} value={d}>By {dayOption(d)}</option>)}
            </select>
          </div>
          <input value={milestone.description} onChange={e => setMilestone({ ...milestone, description: e.target.value })} placeholder="Details (optional)" aria-label="Milestone details" className={input} />
          <div className="flex gap-2">
            <button disabled={!milestone.title.trim()} onClick={() => {
              addItem(week.id, withSection({ id: uid('ms'), kind: 'milestone', title: milestone.title.trim(), day: milestone.day, ...(milestone.description.trim() ? { description: milestone.description.trim() } : {}) }, sectionId));
              closeAdd();
            }} className={primaryBtn}>Add milestone</button>
            <button onClick={closeAdd} className={secondaryBtn}>Cancel</button>
          </div>
        </div>
      );
    }
    return (
      <AssignmentForm
        initial={{ id: uid('asg'), title: '', stage: 'A', materials: [], dueDay: 5 }}
        initialLines={[]}
        onSave={async (a, lines) => {
          if (!(await saveWith(saveAssignment(a, lines)))) return;
          await addItem(week.id, withSection({ id: uid('oi'), kind: 'assignment', assignmentId: a.id }, sectionId));
          closeAdd();
        }}
        onCancel={closeAdd} />
    );
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500 px-2">
        The program is 4 weeks. Inside each week, group content into <b>sections</b> (e.g. "StoryCo General Onboarding") and use ▲▼ to order
        sections and the items in them - trainees see exactly this in their sidebar. Give lessons a planned day (and hours) to build each trainee's day-by-day plan; assignments and milestones have a due day. Grading lives on each assignment (click Edit).
      </p>
      {outline.weeks.slice(0, DEFAULT_WEEK_GOALS.length).some(w => !w.goal) && (
        <div className="bg-[#3DDC97]/15 rounded-2xl px-4 py-3 text-xs text-gray-700 flex flex-wrap items-center justify-between gap-2">
          <span>Some weeks have no goal yet. Fill the empty ones with the program's standard weekly goals (you can edit them after).</span>
          <button onClick={() => save(outline.weeks.map((w, i) => (!w.goal && DEFAULT_WEEK_GOALS[i] ? { ...w, goal: DEFAULT_WEEK_GOALS[i] } : w)))} className={secondaryBtn}>
            Fill in standard weekly goals
          </button>
        </div>
      )}
      {(() => {
        const unplaced = modules.filter(m => !placedModules.has(m.id)).sort((a, b) => a.title.localeCompare(b.title));
        return unplaced.length > 0 && (
          <div className="bg-sky rounded-2xl px-4 py-3 text-xs text-navy">
            <b>Not in any week, so trainees don't see them ({unplaced.length}):</b> {unplaced.map(m => m.title).join(' · ')}.
            <span className="block mt-0.5 opacity-80">Use <b>+ Add here → Content</b> in a week to show one, or leave it out on purpose.</span>
          </div>
        );
      })()}
      {outline.weeks.map((week, wi) => {
        const groups = weekGroups(week, assignments);
        const sections = week.sections ?? [];
        const loose = groups[groups.length - 1].items;
        const legacyTitle = !/^Week \d+$/.test(week.title) && !sections.length ? week.title : null;
        return (
          <div key={week.id} className={card}>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <h4 className="text-lg font-black text-gray-800">{weekLabel(wi)}</h4>
              <div className="flex gap-1">
                <button onClick={() => moveWeek(wi, -1)} disabled={wi === 0} aria-label="Swap with the week before" title="Swap with the week before" className="w-7 h-7 rounded-full bg-gray-100 text-gray-500 hover:bg-sky hover:text-navy disabled:opacity-30 text-xs font-black">▲</button>
                <button onClick={() => moveWeek(wi, 1)} disabled={wi === outline.weeks.length - 1} aria-label="Swap with the week after" title="Swap with the week after" className="w-7 h-7 rounded-full bg-gray-100 text-gray-500 hover:bg-sky hover:text-navy disabled:opacity-30 text-xs font-black">▼</button>
              </div>
              {(() => {
                const n = groups.flatMap(g => g.items).filter(i => i.kind === 'content' && !i.day).length;
                return n > 0 && (
                  <button onClick={() => planUnplanned(week)} title="Give each lesson without a planned day a recommended day, spread evenly Mon–Fri"
                    className="text-xs font-bold text-[#2E9DF7] hover:underline">
                    <CalendarPlus className="inline-block w-4 h-4 -mt-0.5 mr-1" strokeWidth={2.5} aria-hidden="true" />Plan {n} unplanned lesson{n === 1 ? '' : 's'} across Mon–Fri
                  </button>
                );
              })()}
              {legacyTitle && (
                <button onClick={() => titleToSection(week, wi)} className="ml-auto text-xs font-bold text-[#2E9DF7] hover:underline">
                  Make "{legacyTitle}" a section of this week
                </button>
              )}
              {/* The program is 4 weeks; weeks beyond that (left over from
                  before) can be removed once they're empty. */}
              {wi >= PROGRAM_WEEKS && (
                <button onClick={() => save(outline.weeks.filter(w => w.id !== week.id))} disabled={week.items.length > 0}
                  title={week.items.length ? 'Move or remove its items first' : 'Remove this extra week'}
                  className="ml-auto text-xs font-bold text-ember hover:underline disabled:text-gray-400 disabled:no-underline">
                  {week.items.length ? `Extra week - move its ${week.items.length} item${week.items.length === 1 ? '' : 's'} out to remove it` : 'Remove extra week'}
                </button>
              )}
            </div>

            <label className="block mb-4">
              <span className="text-[10px] font-black uppercase text-gray-400">🎯 Goal for this week (shown to trainees on My Program)</span>
              <textarea defaultValue={week.goal ?? ''} key={week.goal ?? ''} placeholder="What should trainees be able to do by the end of this week?" aria-label={`${weekLabel(wi)} goal`}
                onBlur={e => { const v = e.target.value.trim(); if (v !== (week.goal ?? '')) editWeek(week.id, w => { const { goal: _, ...rest } = w; return v ? { ...rest, goal: v } : rest; }); }}
                className={`${input} mt-1 h-16`} />
            </label>

            <div className="space-y-4">
              {groups.slice(0, -1).map(({ section, items }, si) => (
                <div key={section!.id} className="border-l-4 border-sky pl-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <input defaultValue={section!.title} key={section!.title} placeholder="Section name" aria-label="Section name"
                      onBlur={e => e.target.value.trim() && e.target.value.trim() !== section!.title && renameSection(week.id, section!.id, e.target.value.trim())}
                      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                      className={`${input} font-black max-w-sm`} />
                    <button onClick={() => moveSection(week.id, si, -1)} disabled={si === 0} aria-label="Move section up" className="text-gray-400 hover:text-[#2E9DF7] disabled:opacity-30 text-xs font-black px-1">▲</button>
                    <button onClick={() => moveSection(week.id, si, 1)} disabled={si === sections.length - 1} aria-label="Move section down" className="text-gray-400 hover:text-[#2E9DF7] disabled:opacity-30 text-xs font-black px-1">▼</button>
                    <button onClick={() => removeSection(week.id, section!.id)} title="Remove the section - its items stay in the week" className="ml-auto text-xs font-bold text-gray-400 hover:text-ember">Remove section</button>
                  </div>
                  {items.map((it, ii) => itemRow(week, it, ii, items.length))}
                  {items.length === 0 && <p className="text-xs text-gray-400 px-1">Empty section.</p>}
                  {addArea(week, section!.id)}
                </div>
              ))}

              {(loose.length > 0 || !sections.length) && (
                <div className="space-y-2">
                  {sections.length > 0 && <p className="text-[10px] font-black uppercase text-gray-400 px-1">Not in a section (shown after the sections)</p>}
                  {loose.map((it, ii) => itemRow(week, it, ii, loose.length))}
                  {loose.length === 0 && <p className="text-xs text-gray-400 px-1">Nothing in this week yet.</p>}
                  {addArea(week, null)}
                </div>
              )}

              <button onClick={() => addSection(week.id)} className={secondaryBtn}>+ New section</button>
            </div>
          </div>
        );
      })}
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
