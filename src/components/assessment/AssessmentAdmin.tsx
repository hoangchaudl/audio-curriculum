import React, { useEffect, useState } from 'react';
import { useAppContext } from '../../store';
import { Assignment, CellWeight, ContentBlock, Enrollment, ReviewerSlot, Role, User } from '../../types';
import { CRITERIA, REVIEWER_SLOTS } from '../../assessment/config';
import { assignmentCriteria, episodeAAssignments, finalResult, gradingProblems, outcomeLabel, splitEvenly } from '../../assessment/scoring';
import { assignmentWeek } from '../../assessment/outline';
import { convertSkillGrading, legacySkills } from '../../assessment/migrate';
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
    { id: 'structure', label: 'Grade formula' },
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

// --- Grade formula ---------------------------------------------------------------
// Every number that turns reviewer scores into the final grade, in one place:
// stage weights + benchmark, each Episode A assignment's weight, and the
// Episode B / Pod reviewer tables. Criteria are edited on the assignment.

const round2 = (n: number) => Math.round(n * 100) / 100;
const TotalChip: React.FC<{ total: number; label: string }> = ({ total, label }) => {
  const ok = Math.abs(total - 100) < 0.01;
  return <span className={`text-xs font-black ${ok ? 'text-leaf' : 'text-ember'}`}>{ok ? '✓ ' : ''}{label} {round2(total)}%</span>;
};
const numInput = 'w-20 bg-gray-50 rounded-xl p-2 text-sm focus:ring-2 focus:ring-[#2E9DF7] font-bold';

const ReviewerTable: React.FC<{ title: string; cells: CellWeight[]; onSave: (cells: CellWeight[]) => Promise<void> }> = ({ title, cells, onSave }) => {
  const slots = REVIEWER_SLOTS.filter(r => cells.some(c => c.slot === r.id));
  const criteria = CRITERIA.filter(k => cells.some(c => c.criterion === k.id));
  return (
    <div className={card}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h4 className="font-black text-gray-800">{title}</h4>
        <TotalChip total={cells.reduce((t, c) => t + c.weight, 0)} label="Table total" />
      </div>
      <p className="text-xs text-gray-500 mb-3">Each cell is how much one reviewer's score on one criterion counts toward this stage.</p>
      <div className="overflow-x-auto">
        <table className="text-sm">
          <thead><tr><th />{slots.map(r => <th key={r.id} className="text-[10px] font-black uppercase text-gray-400 px-2 pb-2 text-left">{r.label}</th>)}</tr></thead>
          <tbody>
            {criteria.map(k => (
              <tr key={k.id}>
                <td className="text-xs font-bold text-gray-700 pr-3 py-1">{k.label}</td>
                {slots.map(r => {
                  const cell = cells.find(c => c.slot === r.id && c.criterion === k.id);
                  return (
                    <td key={r.id} className="px-2 py-1">
                      {cell ? (
                        <span className="flex items-center gap-1 text-xs font-bold text-gray-500">
                          <input type="number" min={0} step="0.5" defaultValue={cell.weight} key={cell.weight} aria-label={`${r.label} – ${k.label}`}
                            onBlur={e => Number(e.target.value) !== cell.weight && saveWith(onSave(cells.map(c => (c === cell ? { ...c, weight: Number(e.target.value) } : c))))}
                            className={numInput} />%
                        </span>
                      ) : <span className="text-gray-300">–</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const GradeFormulaTab: React.FC<{ onOpenOutline: () => void }> = ({ onOpenOutline }) => {
  const { assignments, exercises, programOutline, assessmentConfig: config, updateAssessmentConfig, updateAssignment } = useAppContext();
  const w = config.stageWeights;
  const epA = episodeAAssignments(assignments);
  const epATotal = epA.reduce((t, a) => t + (a.weight ?? 0), 0);
  const stage = (key: keyof typeof w, label: string) => (
    <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
      {label}
      <input type="number" min={0} step="1" defaultValue={w[key]} key={w[key]} aria-label={`${label} share of final grade`}
        onBlur={e => Number(e.target.value) !== w[key] && saveWith(updateAssessmentConfig({ stageWeights: { ...w, [key]: Number(e.target.value) } }))}
        className={numInput} />%
    </label>
  );
  const where = (a: Assignment) => {
    const week = assignmentWeek(programOutline, a.id);
    return week ? `Week ${week} · Day ${a.dueDay ?? 7}` : 'Not in the outline';
  };
  return (
    <div className="space-y-4">
      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h4 className="font-black text-gray-800">Final grade</h4>
          <TotalChip total={w.episodeA + w.episodeB + w.pod} label="Stages total" />
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          {stage('episodeA', 'Episode A')}
          {stage('episodeB', 'Episode B')}
          {stage('pod', 'Pod Trial')}
          <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
            Benchmark
            <input type="number" min={1} max={5} step="0.1" defaultValue={config.passThreshold} key={config.passThreshold} aria-label="Benchmark score"
              onBlur={e => Number(e.target.value) !== config.passThreshold && saveWith(updateAssessmentConfig({ passThreshold: Number(e.target.value) }))}
              className={numInput} />/ 5
          </label>
        </div>
      </div>

      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
          <h4 className="font-black text-gray-800">Episode A - assignment weights</h4>
          <div className="flex items-center gap-3">
            {epA.length > 1 && (
              <button onClick={() => { const sh = splitEvenly(epA.length); saveWith(Promise.all(epA.map((a, i) => updateAssignment(a.id, { weight: sh[i] })))); }}
                className="text-xs font-bold text-[#2E9DF7] hover:underline">Split equally</button>
            )}
            <TotalChip total={epATotal} label="Assignments total" />
          </div>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Episode A is {w.episodeA}% of the final grade. Each assignment's score comes from its criteria - edit those on the assignment in{' '}
          <button onClick={onOpenOutline} className="font-bold text-[#2E9DF7] hover:underline">Program outline</button>.
        </p>
        {epA.length === 0 ? <p className="text-sm text-gray-400">No Episode A assignments yet - add one on a day in Program outline.</p> : (
          <div className="space-y-2">
            {epA.map(a => {
              const criteria = assignmentCriteria(exercises, a.id);
              return (
                <div key={a.id} className="bg-gray-50 rounded-2xl p-3 flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[200px]">
                    <p className="text-sm font-bold text-gray-800">📝 {a.title}</p>
                    <p className="text-[11px] font-bold text-gray-400">
                      {where(a)} · {criteria.length ? criteria.map(c => `${c.title || '(no name)'} ${c.weight}%`).join(' · ') : <span className="text-ember">no criteria yet</span>}
                    </p>
                  </div>
                  <label className="flex items-center gap-1 text-xs font-bold text-gray-500">
                    <input type="number" min={0} step="0.5" defaultValue={a.weight ?? 0} key={a.weight ?? 0} aria-label={`${a.title} weight in Episode A`}
                      onBlur={e => Number(e.target.value) !== (a.weight ?? 0) && saveWith(updateAssignment(a.id, { weight: Number(e.target.value) }))}
                      className={numInput} />% of Episode A
                  </label>
                  <span className="text-[11px] font-bold text-gray-400 w-28 text-right">= {round2(((a.weight ?? 0) * w.episodeA) / 100)}% of final</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ReviewerTable title={`Episode B reviewer table (${w.episodeB}% of final)`} cells={config.episodeBCells} onSave={cells => updateAssessmentConfig({ episodeBCells: cells })} />
      <ReviewerTable title={`Pod Trial reviewer table (${w.pod}% of final)`} cells={config.podCells} onSave={cells => updateAssessmentConfig({ podCells: cells })} />
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
  const { users, enrollments, modules, assignments, exercises, assessmentConfig, assessmentConfigSaved, setupAssessmentProgram, programOutline } = useAppContext();
  const [tab, setTab] = useState<Tab>('outline');
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
      {tab === 'structure' && <GradeFormulaTab onOpenOutline={() => setTab('outline')} />}
      {tab === 'briefs' && <BriefsTab />}
      {tab === 'people' && <PeopleTab />}
    </div>
  );
};
