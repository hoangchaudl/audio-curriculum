import React, { useEffect, useState } from 'react';
import { useAppContext } from '../../store';
import { ContentBlock, Enrollment, Exercise, ReviewerSlot, Role, User } from '../../types';
import { REVIEWER_SLOTS } from '../../assessment/config';
import { episodeAModules, finalResult, gradingProblems, outcomeLabel, splitEvenly } from '../../assessment/scoring';
import { useTraineeData } from '../../assessment/traineeData';
import { ConfirmModal } from '../ConfirmModal';
import { ContentBlocksEditor } from './ContentBlocksEditor';
import { OutlineEditor } from './OutlineEditor';
import { BenchmarkChip, OutcomeBadge, card, input, primaryBtn, saveWith, secondaryBtn, sectionTitle } from './ui';

type Tab = 'outline' | 'tracking' | 'enrollment' | 'people' | 'structure' | 'briefs';
// Grouped in the order an admin works: set the program up, add people,
// then follow results.
const TAB_GROUPS: { label: string; tabs: { id: Tab; label: string }[] }[] = [
  { label: 'Set up', tabs: [
    { id: 'outline', label: 'Program outline' },
    { id: 'structure', label: 'Grading' },
    { id: 'briefs', label: 'Episode B & Pod briefs' },
  ] },
  { label: 'People', tabs: [
    { id: 'people', label: 'People & roles' },
    { id: 'enrollment', label: 'Enrollment & reviewers' },
  ] },
  { label: 'Results', tabs: [{ id: 'tracking', label: 'Tracking & publishing' }] },
];

const today = () => new Date().toISOString().slice(0, 10);

// --- Tracking ---------------------------------------------------------------

const TrackingRow: React.FC<{ enrollment: Enrollment }> = ({ enrollment }) => {
  const { users, setPublication } = useAppContext();
  const data = useTraineeData(enrollment.traineeId);
  const result = finalResult(data);
  const [open, setOpen] = useState(false);
  const [pendingPublish, setPendingPublish] = useState<'episodeA' | 'episodeB' | 'pod' | null>(null);
  const name = users.find(u => u.id === enrollment.traineeId)?.name ?? enrollment.traineeId;
  const stages = [
    { key: 'episodeA' as const, label: 'Episode A', outcome: result.episodeA },
    { key: 'episodeB' as const, label: 'Episode B', outcome: result.episodeB },
    { key: 'pod' as const, label: 'Pod Trial', outcome: result.pod },
  ];
  const missing = [...new Set([result.episodeA, result.episodeB, result.pod].flatMap(o => (o.status === 'awaiting' ? o.missing : [])))];

  const toggle = (key: 'episodeA' | 'episodeB' | 'pod', next: boolean) => {
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
          <BenchmarkChip meets={result.meetsBenchmark} />
        </div>
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
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
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    setStartDate(existing?.startDate ?? today());
    setReviewers(existing?.reviewers ?? {});
    setPods(existing?.podEpisodesRequired ?? 1);
  }, [existing?.startDate, existing?.podEpisodesRequired, JSON.stringify(existing?.reviewers)]);

  const trainee = users.find(u => u.id === traineeId);
  const candidates = users.filter(u => u.id !== traineeId).sort((a, b) => a.name.localeCompare(b.name));
  const save = async () => {
    await upsertEnrollment(traineeId, { startDate, reviewers, podEpisodesRequired: pods });
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

// --- Grading (Episode A skills and their scores) --------------------------------
// The one place Episode A skills are named, ordered, weighted and deleted.
// A skill is an Episode A module; each score is one 1-5 grade a reviewer
// gives, coming from an assignment (an `Exercise` in the data model).

const uidEx = () => `ex_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

const ScoreRow: React.FC<{ exercise: Exercise; hasSubmissions: boolean }> = ({ exercise, hasSubmissions }) => {
  const { assignments, upsertExercise, deleteExercise } = useAppContext();
  const [showInstructions, setShowInstructions] = useState(!!exercise.instructions);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const save = (patch: Partial<Exercise>) => saveWith(upsertExercise({ ...exercise, ...patch }));
  const from = assignments.find(a => a.id === exercise.assignmentId)?.title;
  return (
    <div className="bg-gray-50 rounded-2xl p-3 space-y-2">
      <div className="grid grid-cols-[1fr_1fr_6rem_auto] gap-2 items-center">
        {/* Blank names are refused: the field snaps back instead of saving. */}
        <input defaultValue={exercise.title} key={exercise.title} placeholder="What's judged, e.g. SFX" aria-label="Score name"
          onBlur={e => {
            const v = e.target.value.trim();
            if (!v) { e.target.value = exercise.title; return; }
            if (v !== exercise.title) save({ title: v });
          }}
          className={`${input} bg-surface ${exercise.title.trim() ? '' : 'ring-2 ring-[#F4511E]'}`} />
        <span className="text-xs font-bold text-gray-500 truncate" title={from}>{from ?? 'Not linked to an assignment'}</span>
        <label className="flex items-center gap-1 text-xs font-bold text-gray-500">
          <input type="number" min={0} step="0.01" defaultValue={exercise.weight} key={exercise.weight} aria-label="Share of skill"
            onBlur={e => Number(e.target.value) !== exercise.weight && save({ weight: Number(e.target.value) })}
            className={`${input} bg-surface`} />%
        </label>
        <button onClick={() => setConfirmDelete(true)} className="text-gray-400 hover:text-ember font-bold px-2" aria-label="Delete score">✕</button>
      </div>
      {showInstructions ? (
        <textarea defaultValue={exercise.instructions ?? ''} key={exercise.instructions ?? ''} placeholder="Instructions for the trainee (Markdown)"
          onBlur={e => e.target.value !== (exercise.instructions ?? '') && save({ instructions: e.target.value })}
          className={`${input} bg-surface h-16`} />
      ) : (
        <button onClick={() => setShowInstructions(true)} className="text-[10px] font-bold uppercase text-gray-400 hover:text-[#2E9DF7] ml-1">+ Instructions for the trainee</button>
      )}
      <ConfirmModal
        open={confirmDelete}
        title={`Delete the score "${exercise.title || 'unnamed'}"?`}
        message={hasSubmissions ? 'Trainees already submitted work for this score. Their submissions are kept, but it will no longer count toward the skill.' : 'This removes the score from the skill.'}
        confirmLabel="Delete"
        onConfirm={() => { saveWith(deleteExercise(exercise.id)); setConfirmDelete(false); }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
};

const AddScore: React.FC<{ moduleId: string; nextOrder: number; remaining: number }> = ({ moduleId, nextOrder, remaining }) => {
  const { assignments, upsertExercise } = useAppContext();
  const options = assignments.filter(a => a.stage === 'A');
  const [assignmentId, setAssignmentId] = useState('');
  const [title, setTitle] = useState('');
  const add = async () => {
    const ok = await saveWith(upsertExercise({ id: uidEx(), moduleId, assignmentId, title: title.trim(), order: nextOrder, weight: Math.max(0, Math.round(remaining * 100) / 100) }));
    if (ok) { setTitle(''); setAssignmentId(''); }
  };
  if (!options.length) return <p className="text-[10px] text-gray-400">Create an Episode A assignment in "Program outline" first.</p>;
  return (
    <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="New score, e.g. SFX" aria-label="New score name" className={`${input} bg-surface`} />
      <select value={assignmentId} onChange={e => setAssignmentId(e.target.value)} aria-label="Comes from assignment" className={`${input} bg-surface`}>
        <option value="">From which assignment?</option>
        {options.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
      </select>
      <button disabled={!title.trim() || !assignmentId} onClick={add} className={secondaryBtn}>+ Score</button>
    </div>
  );
};

const GradingTab: React.FC = () => {
  const { modules, exercises, assessmentSubmissions, assessmentConfig, upsertExercise, setModuleWeight, updateModule, deleteModule, programOutline, saveOutline } = useAppContext();
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const mods = episodeAModules(modules);
  if (!mods.length) return <p className={`${card} text-sm text-gray-500`}>Set up the assessment program first (button above).</p>;
  const epAShare = assessmentConfig.stageWeights.episodeA;
  const skillTotal = mods.reduce((s, m) => s + (m.episodeAWeight ?? 0), 0);
  const round = (n: number) => Math.round(n * 100) / 100;
  // Swap order values with the neighbour (both writes, one toast).
  const move = (i: number, dir: -1 | 1) => {
    const a = mods[i], b = mods[i + dir];
    if (b) saveWith(Promise.all([updateModule(a.id, { order: b.order }), updateModule(b.id, { order: a.order })]));
  };
  const toDelete = mods.find(m => m.id === pendingDelete);
  return (
    <div className="space-y-4">
      <div className={`${card} flex flex-wrap items-center justify-between gap-3`}>
        <p className="text-sm text-gray-600 max-w-2xl">
          <b>Episode A is {epAShare}% of the final grade.</b> It's made of the skills below, and each skill is made of <b>scores</b>. A score is one 1–5 grade a reviewer gives, based on one assignment.
        </p>
        <span className={`text-xs font-black ${Math.abs(skillTotal - 100) < 0.01 ? 'text-leaf' : 'text-ember'}`}>Skills total {round(skillTotal)}% of Episode A</span>
      </div>
      {mods.map((m, i) => {
        const ex = exercises.filter(e => e.moduleId === m.id).sort((a, b) => a.order - b.order);
        const total = ex.reduce((s, e) => s + e.weight, 0);
        const weight = m.episodeAWeight ?? 0;
        return (
          <div key={m.id} className={`${card} ${ex.length === 0 || !m.title.trim() ? 'ring-2 ring-[#F4511E]' : ''}`}>
            <div className="flex items-center gap-3">
              <div className="flex flex-col">
                <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move skill up" className="text-gray-400 hover:text-[#2E9DF7] disabled:opacity-30 text-[10px] leading-none px-1">▲</button>
                <button onClick={() => move(i, 1)} disabled={i === mods.length - 1} aria-label="Move skill down" className="text-gray-400 hover:text-[#2E9DF7] disabled:opacity-30 text-[10px] leading-none px-1">▼</button>
              </div>
              <span className="font-black text-gray-800 whitespace-nowrap">Skill {i + 1}</span>
              <input defaultValue={m.title} key={m.title} placeholder="Name this skill" aria-label="Skill name"
                onBlur={e => {
                  const v = e.target.value.trim();
                  if (!v) { e.target.value = m.title; return; }
                  if (v !== m.title) saveWith(updateModule(m.id, { title: v }));
                }}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                className={`${input} flex-1 min-w-0 font-black ${m.title.trim() ? '' : 'ring-2 ring-[#F4511E]'}`} />
              <button onClick={() => setPendingDelete(m.id)} disabled={ex.length > 0}
                title={ex.length > 0 ? 'Delete its scores first' : 'Delete this skill'}
                className="text-xs font-bold text-gray-400 hover:text-ember disabled:opacity-30 disabled:hover:text-gray-400 whitespace-nowrap">Delete skill</button>
            </div>
            <label className="flex flex-wrap items-center gap-2 text-xs font-bold text-gray-500 mt-2 mb-4 ml-9">
              Share of Episode A
              <input type="number" min={0} step="0.5" defaultValue={weight} key={weight} aria-label="Share of Episode A"
                onBlur={e => Number(e.target.value) !== weight && saveWith(setModuleWeight(m.id, Number(e.target.value)))}
                className="w-20 bg-gray-50 rounded-xl p-2 text-sm focus:ring-2 focus:ring-[#2E9DF7] font-medium" />%
              <span className="text-gray-400">= {round(weight * epAShare / 100)}% of the final grade</span>
            </label>

            {ex.length > 0 ? (
              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_1fr_6rem_auto] gap-2 text-[10px] font-bold uppercase text-gray-400 px-3">
                  <span>Score</span><span>From assignment</span><span>Share of skill</span><span className="w-6" />
                </div>
                {ex.map(e => <ScoreRow key={e.id} exercise={e} hasSubmissions={assessmentSubmissions.some(s => s.stage === 'A' && s.target === e.id)} />)}
              </div>
            ) : (
              <p className="text-sm font-bold text-ember mb-2">No scores yet, so no trainee can finish Episode A. Add a score below, or delete this skill.</p>
            )}

            <div className="mt-3 space-y-2">
              <AddScore moduleId={m.id} nextOrder={ex.length + 1} remaining={100 - total} />
              <div className="flex items-center justify-between gap-2">
                {ex.length > 1 ? (
                  <button onClick={() => { const shares = splitEvenly(ex.length); saveWith(Promise.all(ex.map((e, j) => upsertExercise({ ...e, weight: shares[j] })))); }}
                    className="text-xs font-bold text-[#2E9DF7] hover:underline">Split equally</button>
                ) : <span />}
                {ex.length > 0 && (
                  <span className={`text-xs font-black ${Math.abs(total - 100) < 0.01 ? 'text-leaf' : 'text-ember'}`}>
                    {Math.abs(total - 100) < 0.01 ? '✓ ' : ''}Scores total {round(total)}%
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
      <ConfirmModal
        open={!!toDelete}
        title={`Delete ${toDelete?.title.trim() ? `"${toDelete.title}"` : 'this skill'}?`}
        message="The skill is removed from Episode A and from the curriculum. Give its share to the other skills afterwards so they total 100%."
        confirmLabel="Delete"
        danger
        onConfirm={() => {
          if (toDelete) {
            // Also take it out of the weekly outline so no "(missing module)" row is left behind.
            const outline = programOutline && { ...programOutline, weeks: programOutline.weeks.map(w => ({ ...w, items: w.items.filter(it => !(it.kind === 'content' && it.moduleId === toDelete.id)) })) };
            saveWith(Promise.all([deleteModule(toDelete.id), ...(outline ? [saveOutline(outline)] : [])]));
          }
          setPendingDelete(null);
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
};

// --- Briefs ---------------------------------------------------------------------

const BriefsTab: React.FC = () => {
  const { assessmentConfig, updateAssessmentConfig } = useAppContext();
  const [episodeB, setEpisodeB] = useState<ContentBlock[]>(assessmentConfig.stageContent?.episodeB ?? []);
  const [pod, setPod] = useState<ContentBlock[]>(assessmentConfig.stageContent?.pod ?? []);
  const [saved, setSaved] = useState(false);
  const save = async () => {
    await updateAssessmentConfig({ stageContent: { episodeB, pod } });
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
  { id: 'audio_engineer', label: 'Audio Engineer', help: 'Can be assigned as Audio Engineer; sees the full curriculum and legacy grading.' },
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
  const { users, enrollments, modules, exercises, assessmentConfig, assessmentConfigSaved, setupAssessmentProgram, programOutline } = useAppContext();
  const [tab, setTab] = useState<Tab>('outline');
  const [setupBusy, setSetupBusy] = useState(false);
  const needsSetup = !assessmentConfigSaved || episodeAModules(modules).length === 0 || !programOutline;
  const problems = gradingProblems(assessmentConfig, modules, exercises);
  const trainees = users.filter(u => u.role === 'sound_designer').sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-6">
      {needsSetup && (
        <div className={`${card} flex flex-wrap items-center justify-between gap-4`}>
          <div>
            <h4 className="font-black text-gray-800">Set up the assessment program</h4>
            <p className="text-xs text-gray-500 max-w-xl">
              Creates the Episode A skills (weights 20/20/30/30), the default Week 1–4 outline with its assignments and scores, and the grading
              weights. If you ran setup before, existing scores are kept and linked to the new assignments. Nothing that already exists is overwritten.
            </p>
          </div>
          <button disabled={setupBusy} onClick={async () => { setSetupBusy(true); try { await setupAssessmentProgram(); } finally { setSetupBusy(false); } }} className={primaryBtn}>
            {setupBusy ? 'Setting up…' : 'Set up assessment program'}
          </button>
        </div>
      )}
      {problems.length > 0 && (
        <div className="bg-rose rounded-[32px] p-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase text-ember mb-1">⚠ {problems.length} problem{problems.length === 1 ? '' : 's'} with grading</p>
            <ul className="text-sm text-ember font-bold list-disc pl-5 space-y-0.5">{problems.map(p => <li key={p}>{p}</li>)}</ul>
          </div>
          {tab !== 'structure' && <button onClick={() => setTab('structure')} className={primaryBtn}>Fix in Grading</button>}
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
          {[...enrollments].sort((a, b) => (users.find(u => u.id === a.traineeId)?.name ?? '').localeCompare(users.find(u => u.id === b.traineeId)?.name ?? ''))
            .map(e => <TrackingRow key={e.id} enrollment={e} />)}
        </div>
      )}
      {tab === 'enrollment' && (
        <div className="space-y-4">
          {trainees.length === 0 && <p className={`${card} text-sm text-gray-500`}>No sound designer accounts yet.</p>}
          {trainees.map(t => <EnrollmentRow key={t.id} traineeId={t.id} />)}
        </div>
      )}
      {tab === 'outline' && <OutlineEditor onEditModule={onEditModule} />}
      {tab === 'structure' && <GradingTab />}
      {tab === 'briefs' && <BriefsTab />}
      {tab === 'people' && <PeopleTab />}
    </div>
  );
};
