import React, { useEffect, useState } from 'react';
import { useAppContext } from '../../store';
import { ContentBlock, Enrollment, Exercise, ReviewerSlot, Role, User } from '../../types';
import { REVIEWER_SLOTS } from '../../assessment/config';
import { episodeAModules, finalResult, outcomeLabel, weightIssues } from '../../assessment/scoring';
import { useTraineeData } from '../../assessment/traineeData';
import { ConfirmModal } from '../ConfirmModal';
import { ContentBlocksEditor } from './ContentBlocksEditor';
import { OutlineEditor } from './OutlineEditor';
import { BenchmarkChip, OutcomeBadge, card, input, primaryBtn, secondaryBtn, sectionTitle } from './ui';

type Tab = 'outline' | 'tracking' | 'enrollment' | 'people' | 'structure' | 'briefs';
const TABS: { id: Tab; label: string }[] = [
  { id: 'outline', label: 'Program outline' },
  { id: 'tracking', label: 'Tracking & publishing' },
  { id: 'enrollment', label: 'Enrollment & reviewers' },
  { id: 'structure', label: 'Episode A structure' },
  { id: 'briefs', label: 'Episode B & Pod briefs' },
  { id: 'people', label: 'People & roles' },
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

// --- Episode A structure --------------------------------------------------------

const ExerciseEditor: React.FC<{ exercise: Exercise; hasSubmissions: boolean }> = ({ exercise, hasSubmissions }) => {
  const { assignments } = useAppContext();
  const { upsertExercise, deleteExercise } = useAppContext();
  const [draft, setDraft] = useState(exercise);
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => setDraft(exercise), [JSON.stringify(exercise)]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(exercise);
  return (
    <div className="bg-gray-50 rounded-2xl p-3 space-y-2">
      <div className="grid grid-cols-[1fr_6rem_auto] gap-2 items-center">
        <div>
          <input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} aria-label="Grading line title" className={`${input} bg-surface`} />
          <p className="text-[10px] font-bold text-gray-400 mt-1 ml-1">
            {exercise.assignmentId ? `From assignment: ${assignments.find(a => a.id === exercise.assignmentId)?.title ?? exercise.assignmentId}` : 'Not linked to an assignment (legacy)'}
          </p>
        </div>
        <label className="flex items-center gap-1 text-xs font-bold text-gray-500">
          <input type="number" min={0} step="0.01" value={draft.weight} onChange={e => setDraft({ ...draft, weight: Number(e.target.value) })} aria-label="Weight" className={`${input} bg-surface`} />%
        </label>
        <button onClick={() => setConfirmDelete(true)} className="text-gray-400 hover:text-ember font-bold px-2" aria-label="Delete exercise">✕</button>
      </div>
      <textarea value={draft.instructions ?? ''} onChange={e => setDraft({ ...draft, instructions: e.target.value })} placeholder="Instructions for the trainee (Markdown)" className={`${input} bg-surface h-16`} />
      {dirty && <button onClick={() => upsertExercise(draft)} className={primaryBtn}>Save exercise</button>}
      <ConfirmModal
        open={confirmDelete}
        title={`Delete "${exercise.title}"?`}
        message={hasSubmissions ? 'Trainees have already submitted work for this exercise. Their submissions are kept, but this exercise will no longer count toward the module score.' : 'This removes the exercise from the module.'}
        confirmLabel="Delete"
        onConfirm={() => { deleteExercise(exercise.id); setConfirmDelete(false); }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
};

const StructureTab: React.FC = () => {
  const { modules, exercises, assessmentSubmissions, upsertExercise, setModuleWeight, updateModule } = useAppContext();
  const mods = episodeAModules(modules);
  if (!mods.length) return <p className={`${card} text-sm text-gray-500`}>Set up the assessment program first (button above).</p>;
  return (
    <div className="space-y-4">
      {mods.map(m => {
        const ex = exercises.filter(e => e.moduleId === m.id).sort((a, b) => a.order - b.order);
        const total = ex.reduce((s, e) => s + e.weight, 0);
        return (
          <div key={m.id} className={card}>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              {/* Renames the module itself (same as Curriculum Management), so
                  the name shown in "Counts toward module" changes everywhere. */}
              <label className="flex items-center gap-1 flex-1 min-w-[200px] font-black text-gray-800">
                {m.label}.
                <input defaultValue={m.title} key={m.title} aria-label="Module name"
                  onBlur={e => e.target.value.trim() && e.target.value.trim() !== m.title && updateModule(m.id, { title: e.target.value.trim() })}
                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                  className={`${input} flex-1 font-black`} />
              </label>
              <label className="flex items-center gap-2 text-xs font-bold text-gray-500">Weight in Episode A
                <input type="number" min={0} step="0.5" defaultValue={m.episodeAWeight ?? 0} key={m.episodeAWeight}
                  onBlur={e => Number(e.target.value) !== m.episodeAWeight && setModuleWeight(m.id, Number(e.target.value))} className={`${input} w-20`} />%
              </label>
            </div>
            <div className="space-y-2">
              {ex.map(e => <ExerciseEditor key={e.id} exercise={e} hasSubmissions={assessmentSubmissions.some(s => s.stage === 'A' && s.target === e.id)} />)}
            </div>
            <div className="flex items-center justify-between mt-3">
              <span className="text-[10px] text-gray-400">Add grading lines from an assignment in "Program outline".</span>
              <span className={`text-xs font-black ${Math.abs(total - 100) < 0.01 ? 'text-leaf' : 'text-ember'}`}>Line weights total {Math.round(total * 100) / 100}%</span>
            </div>
          </div>
        );
      })}
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
  const issues = weightIssues(assessmentConfig, modules, exercises);
  const trainees = users.filter(u => u.role === 'sound_designer').sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-6">
      {needsSetup && (
        <div className={`${card} flex flex-wrap items-center justify-between gap-4`}>
          <div>
            <h4 className="font-black text-gray-800">Set up the assessment program</h4>
            <p className="text-xs text-gray-500 max-w-xl">
              Creates the Episode A modules (weights 20/20/30/30), the default Week 1–4 outline with its assignments and grading lines, and the grading
              weights. If you ran setup before, existing exercises are kept and linked to the new assignments. Nothing that already exists is overwritten.
            </p>
          </div>
          <button disabled={setupBusy} onClick={async () => { setSetupBusy(true); try { await setupAssessmentProgram(); } finally { setSetupBusy(false); } }} className={primaryBtn}>
            {setupBusy ? 'Setting up…' : 'Set up assessment program'}
          </button>
        </div>
      )}
      {issues.length > 0 && (
        <div className="bg-rose rounded-[32px] p-5">
          <p className="text-xs font-black uppercase text-ember mb-1">Weights that don't total 100%</p>
          <ul className="text-sm text-ember font-bold">{issues.map(i => <li key={i.scope}>{i.scope}: {Math.round(i.total * 100) / 100}%</li>)}</ul>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`px-5 py-2 rounded-full font-bold text-sm transition-all ${
            tab === t.id ? 'bg-[#2E9DF7] text-white shadow-md' : 'bg-surface text-gray-500 hover:bg-gray-50'}`}>{t.label}</button>
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
      {tab === 'structure' && <StructureTab />}
      {tab === 'briefs' && <BriefsTab />}
      {tab === 'people' && <PeopleTab />}
    </div>
  );
};
