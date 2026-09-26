import React, { useEffect, useState } from 'react';
import { useAppContext } from '../../store';
import { Assignment, CellWeight, ContentBlock, Enrollment, Invite, ReviewerSlot, Role, StageCriterion, User } from '../../types';
import { CELLS_KEY, PublicationKey, REVIEWER_SLOTS, STAGE_SLOTS, cellGroup, parseSetting, stageCells, stageCriteria } from '../../assessment/config';
import { assignmentCriteria, episodeAAssignments, finalResult, gradingProblems, outcomeLabel, reviewSummaries, scaleShares, splitEvenly } from '../../assessment/scoring';
import { DAY_NAMES, assignmentWeek, programProgress } from '../../assessment/outline';
import { convertSkillGrading, legacySkills } from '../../assessment/migrate';
import { useTraineeData } from '../../assessment/traineeData';
import { ConfirmModal } from '../ConfirmModal';
import { ContentBlocksEditor } from './ContentBlocksEditor';
import { AssignmentForm, OutlineEditor } from './OutlineEditor';
import { BandInputs, RubricPaste, VietnameseStatus } from './RubricTools';
import { PastedRubric, withVietnamese } from '../../assessment/rubricPaste';
import {
  BatchFilter, BenchmarkChip, OutcomeBadge, ProgressBar, STAGE_LABELS, bandLabel, batchNames, card, inBatch, input, primaryBtn, saveWith, secondaryBtn,
  sectionTitle, useBatchFilter,
} from './ui';

// Suggestions for a batch field: the batches already in use.
const BatchInput: React.FC<{ value: string; onChange: (v: string) => void }> = ({ value, onChange }) => {
  const { enrollments, invites } = useAppContext();
  return (
    <label className="text-xs font-bold text-gray-500 uppercase">Hiring batch
      <input value={value} onChange={e => onChange(e.target.value)} list="batch-names" maxLength={40} placeholder="e.g. Oct 2026" className={`${input} mt-1`} />
      <datalist id="batch-names">{batchNames(enrollments, invites).map(b => <option key={b} value={b} />)}</datalist>
    </label>
  );
};

type Tab = 'outline' | 'tracking' | 'enrollment' | 'people' | 'structure' | 'briefs';
// Grouped in the order an admin works: set the program up, add people,
// then follow results.
const TAB_GROUPS: { label: string; tabs: { id: Tab; label: string }[] }[] = [
  { label: 'Set up', tabs: [
    { id: 'outline', label: 'Program outline' },
    { id: 'structure', label: 'Grade formula' },
    { id: 'briefs', label: 'Stage briefs' },
  ] },
  { label: 'People', tabs: [
    { id: 'people', label: 'People & roles' },
    { id: 'enrollment', label: 'Enrollment & reviewers' },
  ] },
  { label: 'Results', tabs: [{ id: 'tracking', label: 'Tracking & publishing' }] },
];

const today = () => new Date().toISOString().slice(0, 10);

// --- Tracking ---------------------------------------------------------------

// Every reviewer's scores and feedback for one trainee - what the trainee
// will see once a stage is published - so the coordinator can check them first.
const ReviewBreakdown: React.FC<{ traineeId: string }> = ({ traineeId }) => {
  const { users, exercises, assignments, assessmentConfig } = useAppContext();
  const summaries = reviewSummaries(useTraineeData(traineeId).reviews, exercises, assignments, assessmentConfig);
  if (!summaries.length) return <p className="text-xs text-gray-500">No reviews yet.</p>;
  return (
    <ul className="grid gap-2">
      {summaries.map(s => (
        <li key={s.key} className="bg-gray-50 rounded-2xl p-3 text-xs space-y-1">
          <p className="font-black text-gray-700">
            {STAGE_LABELS[s.stage]}{s.title ? ` · ${s.title}` : ''} · {REVIEWER_SLOTS.find(x => x.id === s.slot)?.label} ({users.find(u => u.id === s.reviewerUid)?.name ?? 'unknown account'})
            <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] uppercase ${s.status === 'draft' ? 'bg-sky text-navy' : 'bg-[#3DDC97]/20 text-leaf'}`}>{s.status === 'draft' ? 'Draft' : 'Submitted'}</span>
          </p>
          <p className="text-gray-600">{s.scores.map(x => `${x.label}: ${x.score}`).join(' · ') || 'No scores yet'}</p>
          {s.feedback ? <p className="text-navy bg-sky rounded-xl p-2 whitespace-pre-wrap">{s.feedback}</p> : <p className="text-gray-500">No feedback written.</p>}
        </li>
      ))}
    </ul>
  );
};

const TrackingRow: React.FC<{ enrollment: Enrollment }> = ({ enrollment }) => {
  const { users, setPublication, programOutline, assignments, videoProgress, assessmentConfig } = useAppContext();
  const [showReviews, setShowReviews] = useState(false);
  const data = useTraineeData(enrollment.traineeId);
  const progress = programProgress(programOutline, assignments, enrollment, enrollment.traineeId, videoProgress, data.submissions);
  const result = finalResult(data);
  const [open, setOpen] = useState(false);
  const [pendingPublish, setPendingPublish] = useState<PublicationKey | null>(null);
  const name = users.find(u => u.id === enrollment.traineeId)?.name ?? enrollment.traineeId;
  const w = assessmentConfig.stageWeights;
  // Stages weighted 0 don't count, so they aren't tracked here either.
  const stages = [
    { key: 'episodeA' as const, label: 'Episode A', outcome: result.episodeA, weight: w.episodeA },
    { key: 'episodeB' as const, label: 'Episode B', outcome: result.episodeB, weight: w.episodeB },
    { key: 'da' as const, label: 'Audio Description', outcome: result.da, weight: w.da ?? 0 },
    { key: 'pod' as const, label: 'Pod Trial', outcome: result.pod, weight: w.pod },
  ].filter(st => st.weight > 0);
  const missing = [...new Set(stages.map(st => st.outcome).flatMap(o => (o.status === 'awaiting' ? o.missing : [])))];

  const toggle = (key: PublicationKey, next: boolean) => {
    const stage = stages.find(s => s.key === key)!;
    // Publishing an incomplete stage is allowed but confirmed first.
    if (next && stage.outcome.status === 'awaiting') setPendingPublish(key);
    else setPublication(enrollment.traineeId, key, next);
  };

  return (
    <div className={card}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h4 className="font-black text-gray-800">{name}</h4>
          <p className="text-xs text-gray-400 font-bold">Starts {enrollment.startDate} · {enrollment.podEpisodesRequired} pod episode{enrollment.podEpisodesRequired === 1 ? '' : 's'}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-black uppercase text-gray-400">Final</span>
          <OutcomeBadge outcome={result.final} />
          <BenchmarkChip meets={result.meetsBenchmark} threshold={assessmentConfig.passThreshold} />
        </div>
      </div>
      <div className="mb-4"><ProgressBar done={progress.done} total={progress.total} /></div>
      <div className="mb-4">
        <button onClick={() => setShowReviews(o => !o)} aria-expanded={showReviews} className="text-xs font-black uppercase text-[#2E9DF7] hover:underline">
          {showReviews ? 'Hide' : 'Check'} reviewers' scores & feedback before publishing
        </button>
        {showReviews && <div className="mt-2"><ReviewBreakdown traineeId={enrollment.traineeId} /></div>}
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {stages.map(s => (
          <div key={s.key} className="bg-gray-50 rounded-2xl p-3 space-y-2">
            <p className="text-[10px] font-black uppercase text-gray-500">{s.label}</p>
            <OutcomeBadge outcome={s.outcome} />
            <label className="flex items-center gap-2 text-xs font-bold text-gray-600">
              <input type="checkbox" checked={!!data.publication?.[s.key]} onChange={e => toggle(s.key, e.target.checked)} />
              Published to trainee
            </label>
          </div>
        ))}
      </div>
      {missing.length > 0 && (
        <div className="mt-3">
          <button onClick={() => setOpen(o => !o)} className="text-xs font-black uppercase text-[#2E9DF7] hover:underline">
            {open ? 'Hide' : 'Show'} {missing.length} missing item{missing.length === 1 ? '' : 's'}
          </button>
          {open && <ul className="mt-2 grid sm:grid-cols-2 gap-1">{missing.map(m => <li key={m} className="text-xs text-gray-500">• {m}</li>)}</ul>}
        </div>
      )}
      <ConfirmModal
        open={pendingPublish !== null}
        title="Publish an incomplete stage?"
        message={`This stage is still "${outcomeLabel(stages.find(s => s.key === pendingPublish)?.outcome ?? result.final)}". Publishing shows the trainee what's there and locks reviewers' scores for it.`}
        confirmLabel="Publish anyway"
        onConfirm={() => { if (pendingPublish) setPublication(enrollment.traineeId, pendingPublish, true); setPendingPublish(null); }}
        onCancel={() => setPendingPublish(null)}
      />
    </div>
  );
};

// --- Enrollment ---------------------------------------------------------------

const EnrollmentRow: React.FC<{ traineeId: string }> = ({ traineeId }) => {
  const { users, enrollments, upsertEnrollment } = useAppContext();
  const existing = enrollments.find(e => e.id === traineeId);
  const [startDate, setStartDate] = useState(existing?.startDate ?? today());
  const [reviewers, setReviewers] = useState<Enrollment['reviewers']>(existing?.reviewers ?? {});
  const [pods, setPods] = useState<1 | 2>(existing?.podEpisodesRequired ?? 1);
  const [batch, setBatch] = useState(existing?.batch ?? '');
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    setStartDate(existing?.startDate ?? today());
    setReviewers(existing?.reviewers ?? {});
    setPods(existing?.podEpisodesRequired ?? 1);
    setBatch(existing?.batch ?? '');
  }, [existing?.startDate, existing?.podEpisodesRequired, existing?.batch, JSON.stringify(existing?.reviewers)]);

  const trainee = users.find(u => u.id === traineeId);
  const candidates = users.filter(u => u.id !== traineeId).sort((a, b) => a.name.localeCompare(b.name));
  const save = async () => {
    await upsertEnrollment(traineeId, { startDate, reviewers, podEpisodesRequired: pods, batch });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className={card}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h4 className="font-black text-gray-800">{trainee?.name}</h4>
          <p className="text-xs text-gray-400 font-bold">{trainee?.email} · {existing ? 'Enrolled' : 'Not enrolled'}</p>
        </div>
        <div className="flex items-center gap-2">
          {saved && <span className="text-xs font-bold text-leaf">Saved</span>}
          <button onClick={save} className={primaryBtn}>{existing ? 'Save' : 'Enroll'}</button>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <label className="text-xs font-bold text-gray-500 uppercase">Start date
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={`${input} mt-1`} />
        </label>
        <BatchInput value={batch} onChange={setBatch} />
        <label className="text-xs font-bold text-gray-500 uppercase">Pod episodes required
          <select value={pods} onChange={e => setPods(Number(e.target.value) as 1 | 2)} className={`${input} mt-1`}>
            <option value={1}>1 episode</option>
            <option value={2}>2 episodes (averaged)</option>
          </select>
        </label>
        {REVIEWER_SLOTS.map(slot => (
          <label key={slot.id} className="text-xs font-bold text-gray-500 uppercase">{slot.label}
            <select value={reviewers[slot.id] ?? ''} onChange={e => setReviewers(r => ({ ...r, [slot.id as ReviewerSlot]: e.target.value || undefined }))} className={`${input} mt-1`}>
              <option value="">— Not assigned —</option>
              {candidates.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role.replace('_', ' ')})</option>)}
            </select>
          </label>
        ))}
      </div>
      <p className="text-[10px] text-gray-400 mt-2">
        Assign the actual accounts. Trainer scores Episode A, B and Pod; Audio Engineer scores B and Pod; Key Sound Designer and Producer score Pod only (Producer: SFX & Music).
        Set producers and key sound designers to the Reviewer role first on "People & roles".
      </p>
    </div>
  );
};

// --- Invites --------------------------------------------------------------------
// Set someone up before they sign up: signing up with the invited email
// gives them the role, and a trainee invite enrolls them with these
// settings - no chasing new accounts afterwards.

const INVITE_ROLES: { id: Invite['role']; label: string }[] = [
  { id: 'sound_designer', label: 'Trainee (sound designer)' },
  { id: 'reviewer', label: 'Reviewer (producer / key sound designer)' },
  { id: 'audio_engineer', label: 'Audio engineer' },
];

const InvitePanel: React.FC = () => {
  const { users, invites, createInvite, deleteInvite } = useAppContext();
  const blank = { email: '', role: 'sound_designer' as Invite['role'], startDate: today(), pods: 1 as 1 | 2, reviewers: {} as Enrollment['reviewers'], batch: '' };
  const [f, setF] = useState(blank);
  const email = f.email.trim().toLowerCase();
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const taken = users.some(u => u.email?.toLowerCase() === email);
  const reviewerOptions = users.filter(u => u.role !== 'sound_designer').sort((a, b) => a.name.localeCompare(b.name));
  const send = async () => {
    const ok = await saveWith(createInvite({
      email, role: f.role,
      ...(f.role === 'sound_designer' ? { startDate: f.startDate, podEpisodesRequired: f.pods, reviewers: f.reviewers, ...(f.batch.trim() ? { batch: f.batch.trim() } : {}) } : {}),
    }));
    if (ok) setF(blank);
  };
  const pending = [...invites].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <div className={card}>
      <h4 className="font-black text-gray-800 mb-1">✉️ Invite by email</h4>
      <p className="text-xs text-gray-500 mb-4">
        Set someone up before they sign up. When they create their account with this email they get the role - and a trainee is enrolled
        with the start date and reviewers below. Share the site link with them yourself (no email is sent).
      </p>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="text-xs font-bold text-gray-500 uppercase">Email
          <input type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} placeholder="name@story.co" className={`${input} mt-1`} />
        </label>
        <label className="text-xs font-bold text-gray-500 uppercase">Role
          <select value={f.role} onChange={e => setF({ ...f, role: e.target.value as Invite['role'] })} className={`${input} mt-1`}>
            {INVITE_ROLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </label>
      </div>
      {f.role === 'sound_designer' && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
          <label className="text-xs font-bold text-gray-500 uppercase">Start date
            <input type="date" value={f.startDate} onChange={e => setF({ ...f, startDate: e.target.value })} className={`${input} mt-1`} />
          </label>
          <BatchInput value={f.batch} onChange={batch => setF({ ...f, batch })} />
          <label className="text-xs font-bold text-gray-500 uppercase">Pod episodes required
            <select value={f.pods} onChange={e => setF({ ...f, pods: Number(e.target.value) as 1 | 2 })} className={`${input} mt-1`}>
              <option value={1}>1 episode</option>
              <option value={2}>2 episodes (averaged)</option>
            </select>
          </label>
          {REVIEWER_SLOTS.map(slot => (
            <label key={slot.id} className="text-xs font-bold text-gray-500 uppercase">{slot.label}
              <select value={f.reviewers[slot.id] ?? ''} onChange={e => setF({ ...f, reviewers: { ...f.reviewers, [slot.id as ReviewerSlot]: e.target.value || undefined } })} className={`${input} mt-1`}>
                <option value="">— Not assigned —</option>
                {reviewerOptions.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role.replace('_', ' ')})</option>)}
              </select>
            </label>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3 mt-4">
        <button disabled={!validEmail || taken} onClick={send} className={primaryBtn}>Create invite</button>
        {taken && <span className="text-xs font-bold text-ember">That email already has an account - enroll them below or change their role on "People & roles".</span>}
      </div>

      {pending.length > 0 && (
        <div className="mt-5 border-t pt-4 space-y-2">
          <p className="text-[10px] font-black uppercase text-gray-400">Waiting to sign up ({pending.length})</p>
          {pending.map(inv => (
            <div key={inv.id} className="flex flex-wrap items-center gap-2 bg-gray-50 rounded-2xl px-3 py-2 text-sm">
              <span className="font-bold text-gray-800">{inv.email}</span>
              <span className="text-xs text-gray-500">{INVITE_ROLES.find(r => r.id === inv.role)?.label}{inv.startDate ? ` · starts ${inv.startDate}` : ''}{inv.batch ? ` · ${inv.batch}` : ''}</span>
              <button onClick={() => saveWith(deleteInvite(inv.id))} className="ml-auto text-xs font-bold text-gray-400 hover:text-ember">Cancel invite</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// --- Grade formula ---------------------------------------------------------------
// Every number that turns reviewer scores into the final grade, in one place:
// stage weights + benchmark, each Episode A assignment's weight, and the
// Episode B / Pod / DA criteria and reviewer tables. Episode A criteria are
// edited on each assignment.

const round2 = (n: number) => Math.round(n * 100) / 100;
const TotalChip: React.FC<{ total: number; label: string }> = ({ total, label }) => {
  const ok = Math.abs(total - 100) < 0.01;
  return <span className={`text-xs font-black ${ok ? 'text-leaf' : 'text-ember'}`}>{ok ? '✓ ' : ''}{label} {round2(total)}%</span>;
};
const numInput = 'w-20 bg-gray-50 rounded-xl p-2 text-sm focus:ring-2 focus:ring-[#2E9DF7] font-bold';

// A reviewer-table stage's criteria and weights. Each row is a criterion
// (name, and what each score 1-5 means); each cell is how much one
// reviewer's score on it counts. A blank cell = that reviewer doesn't score it.
const ReviewerTable: React.FC<{ title: string; stage: 'B' | 'P1' | 'DA' }> = ({ title, stage }) => {
  const { assessmentConfig: config, updateAssessmentConfig } = useAppContext();
  const group = cellGroup(stage);
  const cells = stageCells(config, stage);
  const criteria = stageCriteria(config, stage);
  const slots = REVIEWER_SLOTS.filter(r => STAGE_SLOTS[stage].includes(r.id));
  const [open, setOpen] = useState<string | null>(null);
  const [removing, setRemoving] = useState<StageCriterion | null>(null);
  const bands = config.bands?.[group];
  const save = (next: StageCriterion[], nextCells: CellWeight[] = cells, nextBands = bands) =>
    saveWith(updateAssessmentConfig({
      criteria: { ...config.criteria, [group]: next }, [CELLS_KEY[group]]: nextCells,
      bands: Object.fromEntries(Object.entries({ ...config.bands, [group]: nextBands }).filter(([, b]) => b?.some(Boolean))),
    }));
  // Stored without empty descriptions / outcome, and never with undefined fields.
  const tidy = (c: StageCriterion): StageCriterion => {
    const { levels, outcome, ...rest } = c;
    const clean = (levels ?? []).map(t => t.trim());
    return { ...rest, ...(clean.some(Boolean) ? { levels: clean } : {}), ...(outcome?.trim() ? { outcome: outcome.trim() } : {}) };
  };
  const patch = (id: string, change: Partial<StageCriterion>) => save(criteria.map(c => (c.id === id ? tidy({ ...c, ...change }) : c)));
  // A pasted table replaces the criteria. Existing ones are reused in order
  // (so scores given stay attached); a row's weighting is split evenly
  // between the reviewers who score that criterion (all, for a new one).
  const applyPaste = (r: PastedRubric) => {
    const next = r.criteria.map((c, i) => tidy({ id: criteria[i]?.id ?? `c_${Date.now().toString(36)}${i}`, title: c.title, levels: c.levels, outcome: c.outcome,
      ...(criteria[i]?.vi ? { vi: criteria[i].vi } : {}) }));
    const nextCells = next.flatMap((c, i) => {
      const had = cells.filter(x => x.criterion === c.id);
      const who = had.length ? had.map(x => x.slot) : slots.map(s => s.id);
      const w = r.criteria[i].weight;
      if (w === undefined) return had.length ? had : who.map(slot => ({ slot, criterion: c.id, weight: 0 }));
      const shares = splitEvenly(who.length).map(p => round2((p * w) / 100));
      return who.map((slot, j) => ({ slot, criterion: c.id, weight: shares[j] }));
    });
    save(next, nextCells, r.bands ?? bands);
  };
  // Vietnamese version (trainees can switch the rubric to VI): text only.
  const applyVietnamese = (r: PastedRubric) => {
    const next = withVietnamese(criteria, r);
    if (!next) return;
    saveWith(updateAssessmentConfig({
      criteria: { ...config.criteria, [group]: next },
      ...(r.bands ? { bandsVi: { ...config.bandsVi, [group]: r.bands } } : {}),
    }));
  };
  const removeVietnamese = () => saveWith(updateAssessmentConfig({
    criteria: { ...config.criteria, [group]: criteria.map(({ vi: _vi, ...c }) => c) },
    bandsVi: Object.fromEntries(Object.entries(config.bandsVi ?? {}).filter(([g]) => g !== group)),
  }));
  const setCell = (slot: ReviewerSlot, criterion: string, raw: string) => {
    const rest = cells.filter(c => !(c.slot === slot && c.criterion === criterion));
    save(criteria, raw === '' ? rest : [...rest, { slot, criterion, weight: Number(raw) }]);
  };
  const add = () => {
    const id = `c_${Date.now().toString(36)}`;
    save([...criteria, { id, title: 'New criterion' }], [...cells, ...slots.map(r => ({ slot: r.id, criterion: id, weight: 0 }))]);
    setOpen(id);
  };
  return (
    <div className={card}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h4 className="font-black text-gray-800">{title}</h4>
        <TotalChip total={cells.reduce((t, c) => t + c.weight, 0)} label="Table total" />
      </div>
      <p className="text-xs text-gray-500 mb-3">
        Each row is one criterion, scored 1–5. Each cell is how much one reviewer's score on it counts toward this stage; leave a cell blank if that reviewer doesn't score it.
        Use <b>Describe scores</b> to write what each score means - trainees and reviewers see it as the rubric.
      </p>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
        <div className="flex-1 min-w-72"><BandInputs key={(bands ?? []).join('|')} bands={bands} onSave={b => save(criteria, cells, b)} /></div>
        <div className="flex flex-col items-end gap-1">
          <RubricPaste onApply={applyPaste} />
          {criteria.length > 0 && <RubricPaste vietnamese={criteria.length} onApply={applyVietnamese} />}
        </div>
      </div>
      <div className="mb-3"><VietnameseStatus done={criteria.filter(c => c.vi).length} total={criteria.length} onRemove={removeVietnamese} /></div>
      <div className="overflow-x-auto">
        <table className="text-sm w-full">
          <thead><tr><th />{slots.map(r => <th key={r.id} className="text-[10px] font-black uppercase text-gray-400 px-2 pb-2 text-left">{r.label}</th>)}<th /></tr></thead>
          <tbody>
            {criteria.map(k => (
              <React.Fragment key={k.id}>
                <tr>
                  <td className="pr-3 py-1 min-w-52">
                    <input defaultValue={k.title} key={k.title} aria-label="Criterion name" placeholder="Criterion name"
                      onBlur={e => { const v = e.target.value.trim(); if (v && v !== k.title) patch(k.id, { title: v }); }}
                      className="w-full bg-gray-50 rounded-xl px-3 py-2 text-xs font-bold text-gray-700 focus:ring-2 focus:ring-[#2E9DF7]" />
                    <button onClick={() => setOpen(o => (o === k.id ? null : k.id))} className="text-[11px] font-bold text-[#2E9DF7] hover:underline mt-1 ml-1">
                      {open === k.id ? 'Hide scores' : `Describe scores${k.levels?.some(Boolean) ? ` (${k.levels.filter(Boolean).length}/5)` : ''}`}
                    </button>
                    {!cells.some(c => c.criterion === k.id) && <span className="text-[11px] font-bold text-ember ml-2">No reviewer scores this</span>}
                  </td>
                  {slots.map(r => {
                    const cell = cells.find(c => c.slot === r.id && c.criterion === k.id);
                    return (
                      <td key={r.id} className="px-2 py-1 align-top">
                        <span className="flex items-center gap-1 text-xs font-bold text-gray-500">
                          <input type="number" min={0} step="0.5" defaultValue={cell?.weight ?? ''} key={cell?.weight ?? 'na'} placeholder="N/A" aria-label={`${r.label} – ${k.title}`}
                            onBlur={e => { if (e.target.value !== String(cell?.weight ?? '')) setCell(r.id, k.id, e.target.value); }}
                            className={numInput} />%
                        </span>
                      </td>
                    );
                  })}
                  <td className="align-top py-1">
                    <button onClick={() => setRemoving(k)} disabled={criteria.length === 1} title={criteria.length === 1 ? 'A stage needs at least one criterion' : 'Remove criterion'}
                      aria-label={`Remove ${k.title}`} className="text-gray-400 hover:text-ember font-bold px-2 py-2 disabled:opacity-30">✕</button>
                  </td>
                </tr>
                {open === k.id && (
                  <tr>
                    <td colSpan={slots.length + 2} className="pb-3">
                      <div className="bg-gray-50 rounded-2xl p-3 space-y-2">
                      <textarea defaultValue={k.outcome ?? ''} key={k.outcome ?? ''} placeholder="What it assesses, e.g. the module learning outcome (optional)" aria-label={`${k.title} - what it assesses`}
                        onBlur={e => { if (e.target.value.trim() !== (k.outcome ?? '')) patch(k.id, { outcome: e.target.value }); }}
                        className={`${input} bg-surface h-14 text-xs`} />
                      <div className="grid gap-2 sm:grid-cols-5">
                        {[1, 2, 3, 4, 5].map(n => (
                          <label key={n} className="block">
                            <span className="text-[10px] font-black uppercase text-gray-400">{n} · {bandLabel(bands, n)}</span>
                            <textarea defaultValue={k.levels?.[n - 1] ?? ''} key={k.levels?.[n - 1] ?? ''} placeholder={`What a ${n} looks like`} aria-label={`${k.title} - score ${n} description`}
                              onBlur={e => { if (e.target.value.trim() !== (k.levels?.[n - 1] ?? '')) patch(k.id, { levels: [1, 2, 3, 4, 5].map(j => (j === n ? e.target.value : k.levels?.[j - 1] ?? '')) }); }}
                              className={`${input} bg-surface h-24 text-xs`} />
                          </label>
                        ))}
                      </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <button onClick={add} className={`${secondaryBtn} mt-3`}>+ Criterion</button>
      <ConfirmModal open={!!removing} title="Remove criterion?" danger confirmLabel="Remove"
        message={`"${removing?.title}" and its weights and score descriptions will be removed from this table. Scores reviewers already gave for it stay saved but no longer count.`}
        onConfirm={() => { if (removing) save(criteria.filter(c => c.id !== removing.id), cells.filter(c => c.criterion !== removing.id)); setRemoving(null); }}
        onCancel={() => setRemoving(null)} />
    </div>
  );
};

// Episode A assignments: rename, reweight, edit criteria, add, delete.
// Adding one can take its share from the others so the total stays 100%.
const AssignmentsCard: React.FC<{ onOpenOutline: () => void }> = ({ onOpenOutline }) => {
  const { assignments, exercises, programOutline, assessmentConfig: config, updateAssignment, saveAssignment, deleteAssignment, saveOutline } = useAppContext();
  const w = config.stageWeights;
  const epA = episodeAAssignments(assignments);
  const epATotal = epA.reduce((t, a) => t + (a.weight ?? 0), 0);
  const weeks = programOutline?.weeks ?? [];
  const [editing, setEditing] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Assignment | null>(null);
  const suggested = round2(100 / (epA.length + 1));
  const [draft, setDraft] = useState<{ title: string; weekId: string; dueDay: number; weight: number; rebalance: boolean } | null>(null);

  const where = (a: Assignment) => {
    const week = assignmentWeek(programOutline, a.id);
    return week ? `Week ${week} · due Day ${a.dueDay ?? 7} (${DAY_NAMES[(a.dueDay ?? 7) - 1]})` : 'Not in the outline';
  };
  const setWeights = (list: Assignment[], weights: number[]) =>
    Promise.all(list.map((a, i) => (a.weight === weights[i] ? Promise.resolve() : updateAssignment(a.id, { weight: weights[i] }))));

  const create = async () => {
    if (!draft || !programOutline) return;
    const id = `asg_${Date.now().toString(36)}`;
    const a: Assignment = { id, title: draft.title.trim(), stage: 'A', dueDay: draft.dueDay, weight: draft.weight, materials: [] };
    const ok = await saveWith((async () => {
      // Starts with one criterion worth 100% - rename or add more with Edit.
      await saveAssignment(a, [{ id: `ex_${Date.now().toString(36)}`, assignmentId: id, title: 'Overall', order: 1, weight: 100 }]);
      await saveOutline({ ...programOutline, weeks: weeks.map(wk => (wk.id === draft.weekId ? { ...wk, items: [...wk.items, { id: `oi_${id}`, kind: 'assignment' as const, assignmentId: id }] } : wk)) });
      if (draft.rebalance) await setWeights(epA, scaleShares(epA.map(x => x.weight ?? 0), Math.max(0, 100 - draft.weight)));
    })());
    if (ok) { setDraft(null); setEditing(id); }
  };

  return (
    <div className={card}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <h4 className="font-black text-gray-800">Episode A assignments</h4>
        <div className="flex items-center gap-3">
          {epA.length > 1 && Math.abs(epATotal - 100) >= 0.01 && (
            <button onClick={() => saveWith(setWeights(epA, scaleShares(epA.map(a => a.weight ?? 0), 100)))}
              className="text-xs font-bold text-[#2E9DF7] hover:underline">Make total 100%</button>
          )}
          {epA.length > 1 && (
            <button onClick={() => saveWith(setWeights(epA, splitEvenly(epA.length)))} className="text-xs font-bold text-[#2E9DF7] hover:underline">Split equally</button>
          )}
          <TotalChip total={epATotal} label="Assignments total" />
        </div>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        Episode A is {w.episodeA}% of the final grade, shared by these assignments. Rename or reweight them here; <b>Edit</b> changes the brief, due day and criteria.
        They also appear in <button onClick={onOpenOutline} className="font-bold text-[#2E9DF7] hover:underline">Program outline</button>.
      </p>

      <div className="space-y-2">
        {epA.map(a => {
          const criteria = assignmentCriteria(exercises, a.id);
          const open = editing === a.id;
          return (
            <div key={a.id} className="bg-gray-50 rounded-2xl p-3">
              <div className="flex flex-wrap items-center gap-3">
                <span aria-hidden="true">📝</span>
                <div className="flex-1 min-w-[220px]">
                  <input defaultValue={a.title} key={a.title} aria-label="Assignment name"
                    onBlur={e => { const v = e.target.value.trim(); if (!v) { e.target.value = a.title; return; } if (v !== a.title) saveWith(updateAssignment(a.id, { title: v })); }}
                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                    className={`${input} bg-surface font-bold`} />
                  <p className="text-[11px] font-bold text-gray-400 mt-1 ml-1">
                    {where(a)} · {criteria.length ? criteria.map(c => `${c.title || '(no name)'} ${c.weight}%`).join(' · ') : <span className="text-ember">no criteria yet</span>}
                  </p>
                </div>
                <label className="flex items-center gap-1 text-xs font-bold text-gray-500">
                  <input type="number" min={0} step="0.5" defaultValue={a.weight ?? 0} key={a.weight ?? 0} aria-label={`${a.title} weight in Episode A`}
                    onBlur={e => Number(e.target.value) !== (a.weight ?? 0) && saveWith(updateAssignment(a.id, { weight: Number(e.target.value) }))}
                    className={numInput} />%
                </label>
                <span className="text-[11px] font-bold text-gray-400 w-24">= {round2(((a.weight ?? 0) * w.episodeA) / 100)}% of final</span>
                <button onClick={() => setEditing(open ? null : a.id)} className={secondaryBtn}>{open ? 'Close' : 'Edit'}</button>
                <button onClick={() => setPendingDelete(a)} aria-label={`Delete ${a.title}`} className="text-gray-400 hover:text-ember font-bold px-2">✕</button>
              </div>
              {open && (
                <AssignmentForm initial={a} initialLines={assignmentCriteria(exercises, a.id)}
                  onSave={async (next, lines) => { if (await saveWith(saveAssignment(next, lines))) setEditing(null); }} onCancel={() => setEditing(null)} />
              )}
            </div>
          );
        })}
        {epA.length === 0 && <p className="text-sm text-gray-400">No Episode A assignments yet.</p>}
      </div>

      {draft ? (
        <div className="bg-sky rounded-2xl p-4 mt-3 space-y-3">
          <p className="text-sm font-black text-navy">New Episode A assignment</p>
          <div className="grid sm:grid-cols-[1fr_auto_auto] gap-2">
            <input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="e.g. Week 2 – 3rd assignment: foley" aria-label="New assignment name" className={`${input} bg-surface`} />
            <select value={draft.weekId} onChange={e => setDraft({ ...draft, weekId: e.target.value })} aria-label="Week" className={`${input} bg-surface w-auto`}>
              {weeks.map((wk, i) => <option key={wk.id} value={wk.id}>Week {i + 1}</option>)}
            </select>
            <select value={draft.dueDay} onChange={e => setDraft({ ...draft, dueDay: Number(e.target.value) })} aria-label="Due day" className={`${input} bg-surface w-auto`}>
              {[1, 2, 3, 4, 5, 6, 7].map(d => <option key={d} value={d}>Due Day {d} · {DAY_NAMES[d - 1]}</option>)}
            </select>
          </div>
          <label className="flex flex-wrap items-center gap-2 text-sm font-bold text-navy">
            Counts
            <input type="number" min={0} max={100} step="0.5" value={draft.weight} onChange={e => setDraft({ ...draft, weight: Number(e.target.value) })} aria-label="New assignment weight" className={`${numInput} bg-surface`} />
            % of Episode A
          </label>
          <label className="flex items-start gap-2 text-xs font-bold text-navy">
            <input type="checkbox" checked={draft.rebalance} onChange={e => setDraft({ ...draft, rebalance: e.target.checked })} className="mt-0.5" />
            <span>Take its {draft.weight}% from the other assignments, keeping their proportions, so Episode A still adds up to 100%
              {draft.rebalance && epA.length > 0 && (
                <span className="block font-medium mt-0.5">
                  → {epA.map((a, i) => `${a.title}: ${a.weight ?? 0}% → ${scaleShares(epA.map(x => x.weight ?? 0), Math.max(0, 100 - draft.weight))[i]}%`).join(' · ')}
                </span>
              )}
            </span>
          </label>
          <div className="flex gap-2">
            <button disabled={!draft.title.trim() || !draft.weekId} onClick={create} className={primaryBtn}>Add assignment</button>
            <button onClick={() => setDraft(null)} className={secondaryBtn}>Cancel</button>
          </div>
          <p className="text-[11px] text-navy/80">It starts with one criterion, "Overall" 100%. Open <b>Edit</b> afterwards to rename it or add more criteria.</p>
        </div>
      ) : (
        <button disabled={!weeks.length} onClick={() => setDraft({ title: '', weekId: weeks[0]?.id ?? '', dueDay: 5, weight: suggested, rebalance: true })} className={`${secondaryBtn} mt-3`}>+ New Episode A assignment</button>
      )}

      <ConfirmModal
        open={!!pendingDelete}
        title={`Delete "${pendingDelete?.title}"?`}
        message={`The assignment, its criteria and its place in the outline are deleted. Trainee submissions and scores are kept but no longer count. Its ${pendingDelete?.weight ?? 0}% is then left over - use "Make total 100%" to share it out.`}
        confirmLabel="Delete"
        danger
        onConfirm={() => { if (pendingDelete) saveWith(deleteAssignment(pendingDelete.id)); setPendingDelete(null); }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
};

const GradeFormulaTab: React.FC<{ onOpenOutline: () => void }> = ({ onOpenOutline }) => {
  const { assessmentConfig: config, updateAssessmentConfig } = useAppContext();
  const w = config.stageWeights;
  const stage = (key: keyof typeof w, label: string) => (
    <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
      {label}
      <input type="number" min={0} max={100} step="1" defaultValue={w[key]} key={w[key]} aria-label={`${label} share of final grade`}
        onBlur={e => {
          const n = parseSetting(e.target.value, 0, 100);
          if (n === null) e.target.value = String(w[key]);
          else if (n !== w[key]) saveWith(updateAssessmentConfig({ stageWeights: { ...w, [key]: n } }));
        }}
        className={numInput} />%
    </label>
  );
  return (
    <div className="space-y-4">
      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h4 className="font-black text-gray-800">Final grade</h4>
          <TotalChip total={w.episodeA + w.episodeB + w.pod + (w.da ?? 0)} label="Stages total" />
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          {stage('episodeA', 'Episode A')}
          {stage('episodeB', 'Episode B')}
          {stage('pod', 'Pod Trial')}
          {stage('da', 'Audio Description')}
          <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
            Benchmark
            <input type="number" min={1} max={5} step="0.1" defaultValue={config.passThreshold} key={config.passThreshold} aria-label="Benchmark score"
              onBlur={e => {
                const n = parseSetting(e.target.value, 1, 5);
                if (n === null) e.target.value = String(config.passThreshold);
                else if (n !== config.passThreshold) saveWith(updateAssessmentConfig({ passThreshold: n }));
              }}
              className={numInput} />/ 5
          </label>
        </div>
      </div>

      <AssignmentsCard onOpenOutline={onOpenOutline} />

      <ReviewerTable title={`Episode B criteria & reviewer table (${w.episodeB}% of final)`} stage="B" />
      <ReviewerTable title={`Pod Trial criteria & reviewer table (${w.pod}% of final, both episodes)`} stage="P1" />
      <ReviewerTable title={`Audio Description (DA) criteria & reviewer table (${w.da}% of final)`} stage="DA" />
    </div>
  );
};

// --- One-time conversion off the old skill modules -----------------------------

const ConvertSkillsCard: React.FC = () => {
  const { modules, moduleVideos, assignments, exercises, convertToAssignmentGrading } = useAppContext();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const skills = legacySkills(modules);
  if (!skills.length) return null;
  const preview = convertSkillGrading(modules, assignments, exercises);
  return (
    <div className="bg-sky rounded-[32px] p-6 space-y-3">
      <h4 className="font-black text-navy">Grading now lives on your assignments</h4>
      <p className="text-sm text-navy max-w-3xl">
        Convert once to move off the {skills.length} old skill module{skills.length === 1 ? '' : 's'} ({skills.map(m => m.title || '(no name)').join(', ')}).
        Every trainee's Episode A score stays exactly the same. The skill modules are then deleted, including their pages in the weekly outline.
      </p>
      <div className="bg-surface rounded-2xl p-4 overflow-x-auto">
        <table className="text-sm w-full">
          <thead><tr className="text-[10px] font-black uppercase text-gray-400 text-left"><th className="pb-2">Assignment</th><th className="pb-2">Weight in Episode A</th><th className="pb-2">Criteria</th></tr></thead>
          <tbody>
            {preview.assignments.map(a => (
              <tr key={a.id} className="border-t border-gray-100">
                <td className="py-2 pr-3 font-bold text-gray-800">{a.title}</td>
                <td className="py-2 pr-3 font-black text-navy">{a.weight}%</td>
                <td className="py-2 text-xs text-gray-600">{preview.criteria.filter(c => c.assignmentId === a.id).map(c => `${c.title} ${c.weight}`).join(' · ') || <span className="text-ember font-bold">none - add criteria after converting</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button disabled={busy} onClick={() => setConfirm(true)} className={primaryBtn}>{busy ? 'Converting…' : 'Convert and delete the skill modules'}</button>
      <ConfirmModal
        open={confirm}
        title="Convert grading and delete the skill modules?"
        message={`Assignments get the weights shown above, and ${skills.length} skill module${skills.length === 1 ? ' is' : 's are'} deleted. Submissions and reviews are kept. This can't be undone from the app.`}
        confirmLabel="Convert"
        danger
        onConfirm={async () => { setConfirm(false); setBusy(true); try { await saveWith(convertToAssignmentGrading(modules, moduleVideos)); } finally { setBusy(false); } }}
        onCancel={() => setConfirm(false)}
      />
    </div>
  );
};

// --- Briefs ---------------------------------------------------------------------

const BriefsTab: React.FC = () => {
  const { assessmentConfig, updateAssessmentConfig } = useAppContext();
  const [episodeB, setEpisodeB] = useState<ContentBlock[]>(assessmentConfig.stageContent?.episodeB ?? []);
  const [pod, setPod] = useState<ContentBlock[]>(assessmentConfig.stageContent?.pod ?? []);
  const [da, setDa] = useState<ContentBlock[]>(assessmentConfig.stageContent?.da ?? []);
  const [saved, setSaved] = useState(false);
  const save = async () => {
    await updateAssessmentConfig({ stageContent: { episodeB, pod, da } });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };
  return (
    <div className="space-y-4">
      <div className={card}>
        <h4 className={`${sectionTitle} mb-3`}>Episode B – Final Episode Test (Week 3)</h4>
        <ContentBlocksEditor blocks={episodeB} onChange={setEpisodeB} />
      </div>
      <div className={card}>
        <h4 className={`${sectionTitle} mb-3`}>Pod Trial (Week 4)</h4>
        <ContentBlocksEditor blocks={pod} onChange={setPod} />
      </div>
      <div className={card}>
        <h4 className={`${sectionTitle} mb-3`}>Audio Description (DA)</h4>
        <ContentBlocksEditor blocks={da} onChange={setDa} />
      </div>
      <div className="flex items-center gap-3">
        <button onClick={save} className={primaryBtn}>Save briefs</button>
        {saved && <span className="text-xs font-bold text-leaf">Saved</span>}
      </div>
    </div>
  );
};

// --- People & roles --------------------------------------------------------------

const ROLE_OPTIONS: { id: Role; label: string; help: string }[] = [
  { id: 'sound_designer', label: 'Sound Designer (trainee)', help: 'Can be enrolled and submit work.' },
  { id: 'reviewer', label: 'Reviewer', help: 'Producer / Key Sound Designer: reviews only what they are assigned. Not a trainee.' },
  { id: 'audio_engineer', label: 'Audio Engineer', help: 'Can be assigned as Audio Engineer; sees the full roster and curriculum.' },
  { id: 'admin', label: 'Admin', help: 'Full access: curriculum, enrollment, reviewer assignment and publishing.' },
];
const roleLabel = (role: Role) => ROLE_OPTIONS.find(o => o.id === role)?.label ?? role;

const PeopleTab: React.FC = () => {
  const { users, currentUser, enrollments, updateUserRole } = useAppContext();
  const [drafts, setDrafts] = useState<Record<string, Role>>({});
  const [pending, setPending] = useState<{ user: User; role: Role } | null>(null);
  const [filter, setFilter] = useState('');
  const sorted = [...users]
    .filter(u => `${u.name} ${u.email}`.toLowerCase().includes(filter.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Warnings that matter before the change goes through.
  const warning = (user: User, role: Role) => {
    if (role === 'admin') return `${user.name} will get full admin access, including publishing results and changing everyone's roles.`;
    if (user.role === 'sound_designer' && enrollments.some(e => e.id === user.id)) {
      return `${user.name} is enrolled as a trainee. As ${roleLabel(role)} they'll no longer see the trainee program pages (their enrollment and submissions are kept).`;
    }
    if (user.role === 'admin') return `${user.name} will lose admin access.`;
    return `${user.name} will become ${roleLabel(role)}.`;
  };

  return (
    <div className="space-y-4">
      <div className={card}>
        <h4 className={`${sectionTitle} mb-1`}>Account roles</h4>
        <p className="text-xs text-gray-500 mb-3">
          New sign-ups always start as Sound Designers. Set Producer and Key Sound Designer accounts to <strong>Reviewer</strong> so they aren't treated as trainees,
          then assign them on "Enrollment & reviewers".
        </p>
        <ul className="grid sm:grid-cols-2 gap-2 mb-4">
          {ROLE_OPTIONS.map(o => (
            <li key={o.id} className="bg-gray-50 rounded-2xl p-3 text-xs"><span className="font-black text-gray-700">{o.label}</span><span className="block text-gray-500">{o.help}</span></li>
          ))}
        </ul>
        <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search by name or email" className={input} aria-label="Search people" />
      </div>

      <div className={`${card} divide-y divide-gray-100 !py-2`}>
        {sorted.map(u => {
          const isSelf = u.id === currentUser?.id;
          const draft = drafts[u.id] ?? u.role;
          return (
            <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="font-bold text-gray-800 truncate">{u.name}{isSelf && <span className="text-xs text-gray-400 font-bold"> (you)</span>}</p>
                <p className="text-xs text-gray-400 font-medium truncate">{u.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={draft}
                  disabled={isSelf}
                  title={isSelf ? "You can't change your own role (so an admin can't lock themselves out)" : undefined}
                  onChange={e => setDrafts(d => ({ ...d, [u.id]: e.target.value as Role }))}
                  aria-label={`Role for ${u.name}`}
                  className={`${input} w-auto disabled:opacity-60`}
                >
                  {ROLE_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
                {!isSelf && draft !== u.role && (
                  <button onClick={() => setPending({ user: u, role: draft })} className={primaryBtn}>Save</button>
                )}
              </div>
            </div>
          );
        })}
        {sorted.length === 0 && <p className="text-sm text-gray-400 py-3">No matching accounts.</p>}
      </div>

      <ConfirmModal
        open={pending !== null}
        title={pending ? `Change ${pending.user.name} to ${roleLabel(pending.role)}?` : ''}
        message={pending ? warning(pending.user, pending.role) : ''}
        confirmLabel="Change role"
        danger={pending?.role === 'admin' || pending?.user.role === 'admin'}
        onConfirm={() => {
          if (pending) {
            updateUserRole(pending.user.id, pending.role);
            setDrafts(d => { const { [pending.user.id]: _, ...rest } = d; return rest; });
          }
          setPending(null);
        }}
        onCancel={() => setPending(null)}
      />
    </div>
  );
};

// --- Tab shell ------------------------------------------------------------------

export const AssessmentAdmin: React.FC<{ onEditModule: (moduleId: string) => void }> = ({ onEditModule }) => {
  const { users, enrollments, invites, modules, assignments, exercises, assessmentConfig, assessmentConfigSaved, setupAssessmentProgram, programOutline } = useAppContext();
  const [tab, setTab] = useState<Tab>('outline');
  const batches = batchNames(enrollments, invites);
  const [batch, setBatch] = useBatchFilter(batches);
  const [setupBusy, setSetupBusy] = useState(false);
  const needsSetup = !assessmentConfigSaved || !programOutline;
  // Before the one-time conversion the old data trips every check, and
  // converting fixes it - so only the conversion card shows until then.
  const problems = legacySkills(modules).length ? [] : gradingProblems(assessmentConfig, assignments, exercises);
  const trainees = users.filter(u => u.role === 'sound_designer').sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-6">
      {needsSetup && (
        <div className={`${card} flex flex-wrap items-center justify-between gap-4`}>
          <div>
            <h4 className="font-black text-gray-800">Set up the assessment program</h4>
            <p className="text-xs text-gray-500 max-w-xl">
              Creates the default Week 1–4 outline with its assignments (Episode A weights 40/10/20/30) and their criteria, and the grade formula.
              Nothing that already exists is overwritten.
            </p>
          </div>
          <button disabled={setupBusy} onClick={async () => { setSetupBusy(true); try { await setupAssessmentProgram(); } finally { setSetupBusy(false); } }} className={primaryBtn}>
            {setupBusy ? 'Setting up…' : 'Set up assessment program'}
          </button>
        </div>
      )}
      <ConvertSkillsCard />
      {problems.length > 0 && (
        <div className="bg-rose rounded-[32px] p-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase text-ember mb-1">⚠ {problems.length} problem{problems.length === 1 ? '' : 's'} with grading</p>
            <ul className="text-sm text-ember font-bold list-disc pl-5 space-y-0.5">{problems.map(p => <li key={p}>{p}</li>)}</ul>
          </div>
          {tab !== 'structure' && <button onClick={() => setTab('structure')} className={primaryBtn}>Open Grade formula</button>}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        {TAB_GROUPS.map(g => (
          <div key={g.label}>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5 pl-2">{g.label}</p>
            <div className="flex gap-2 flex-wrap">
              {g.tabs.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)} className={`px-5 py-2 rounded-full font-bold text-sm transition-all ${
                  tab === t.id ? 'bg-[#2E9DF7] text-white shadow-md' : 'bg-surface text-gray-500 hover:bg-gray-50'}`}>{t.label}</button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {tab === 'tracking' && (
        <div className="space-y-4">
          {enrollments.length === 0 && <p className={`${card} text-sm text-gray-500`}>No trainees enrolled yet - use "Enrollment & reviewers".</p>}
          <BatchFilter value={batch} onChange={setBatch} batches={batches} />
          {[...enrollments].filter(e => inBatch(e, batch)).sort((a, b) => (users.find(u => u.id === a.traineeId)?.name ?? '').localeCompare(users.find(u => u.id === b.traineeId)?.name ?? ''))
            .map(e => <TrackingRow key={e.id} enrollment={e} />)}
        </div>
      )}
      {tab === 'enrollment' && (
        <div className="space-y-4">
          <InvitePanel />
          {trainees.length === 0 && <p className={`${card} text-sm text-gray-500`}>No sound designer accounts yet.</p>}
          {trainees.map(t => <EnrollmentRow key={t.id} traineeId={t.id} />)}
        </div>
      )}
      {tab === 'outline' && <OutlineEditor onEditModule={onEditModule} />}
      {tab === 'structure' && <GradeFormulaTab onOpenOutline={() => setTab('outline')} />}
      {tab === 'briefs' && <BriefsTab />}
      {tab === 'people' && <PeopleTab />}
    </div>
  );
};
