import React, { useState } from 'react';
import { useAppContext } from '../store';
import { Category, User } from '../types';
import { traineeDataFrom } from '../assessment/traineeData';
import { Standing, StandingStatus, behindReasons, traineeStanding } from '../assessment/standing';
import { programProgress } from '../assessment/outline';
import { DISAGREEMENT_GAP, Outcome, SkillRow, disagreements, roundScore, scoreSnapshot, skillBreakdown, stageSubmissions } from '../assessment/scoring';
import { REVIEWER_SLOTS } from '../assessment/config';
import { BenchmarkChip, OutcomeBadge, ProgressBar, STAGE_LABELS, formatDate, saveWith } from './assessment/ui';
import { ReviewBreakdown } from './assessment/AssessmentAdmin';
import { AssessmentStage, AssessmentSubmission, ProgramOutcome } from '../types';
import { ConfirmModal } from './ConfirmModal';

export const STATUS_BADGE: Record<StandingStatus | 'not_enrolled' | 'released', { label: string; cls: string }> = {
  released: { label: 'Released', cls: 'bg-gray-200 text-gray-700' },
  passed: { label: '✓ Passed probation', cls: 'bg-[#3DDC97] text-[#0B3D2A]' },
  not_passed: { label: 'Below benchmark', cls: 'bg-[#F4511E] text-white' },
  behind: { label: '⚠ Falling behind', cls: 'bg-[#F4511E]/20 text-ember' },
  grading: { label: 'Finished · waiting for grades', cls: 'bg-sky text-navy' },
  on_track: { label: 'On track', cls: 'bg-[#3DDC97]/20 text-leaf' },
  upcoming: { label: 'Not started yet', cls: 'bg-gray-100 text-gray-500' },
  not_enrolled: { label: 'Not enrolled', cls: 'bg-gray-100 text-gray-500' },
};

// Which badge a trainee gets: released, else a Week 4 decision's frozen
// result, else their live standing.
export const badgeKey = (designer: User, standing: Standing | null, outcome: ProgramOutcome | undefined) =>
  designer.status === 'released' ? 'released' as const
    : outcome?.decision && outcome.snapshot ? (outcome.snapshot.meetsBenchmark ? 'passed' as const : 'not_passed' as const)
    : standing?.status ?? 'not_enrolled' as const;

// Sort order for the roster: who needs attention first.
export const STATUS_ORDER: (StandingStatus | 'not_enrolled' | 'released')[] = ['behind', 'grading', 'passed', 'not_passed', 'on_track', 'upcoming', 'not_enrolled', 'released'];

// Change between the last two stages a skill was scored in (A -> B -> Pod)
// that counts as a real move rather than noise.
const TREND_STEP = 0.25;
const trend = (row: SkillRow) => {
  const vals = [row.episodeA, row.episodeB, row.pod].filter((v): v is number => v !== null);
  if (vals.length < 2) return null;
  const diff = vals[vals.length - 1] - vals[vals.length - 2];
  return diff >= TREND_STEP ? { icon: '▲', label: 'improving', cls: 'text-leaf' }
    : diff <= -TREND_STEP ? { icon: '▼', label: 'slipping', cls: 'text-ember' }
    : { icon: '→', label: 'steady', cls: 'text-gray-400' };
};

// Every skill by stage, so a reviewer sees what the single average hides.
const SkillTable: React.FC<{ rows: SkillRow[]; showDA: boolean; floor: number }> = ({ rows, showDA, floor }) => {
  const cols = [['episodeA', 'Ep A'], ['episodeB', 'Ep B'], ['pod', 'Pod'], ...(showDA ? [['da', 'DA']] : [])] as [keyof SkillRow, string][];
  const cell = (v: number | null, floored: boolean) => (
    <td className={`px-1.5 py-1 text-right tabular-nums ${v !== null && floored && floor && roundScore(v) < floor - 1e-9 ? 'text-ember font-black' : ''}`}>
      {v === null ? '–' : roundScore(v).toFixed(2)}
    </td>
  );
  return (
    <table className="w-full text-[11px] font-bold text-gray-700">
      <caption className="sr-only">Score per skill and stage</caption>
      <thead>
        <tr className="text-[10px] uppercase text-gray-400">
          <th scope="col" className="text-left font-black py-1">Skill</th>
          {cols.map(([, label]) => <th key={label} scope="col" className="text-right font-black px-1.5">{label}</th>)}
          <th scope="col" className="w-5"><span className="sr-only">Trend</span></th>
        </tr>
      </thead>
      <tbody>
        {rows.map(r => {
          const t = trend(r);
          return (
            <tr key={r.id} className="border-t border-gray-100">
              <th scope="row" className="text-left font-bold py-1 pr-1 truncate max-w-[9rem]" title={r.title}>{r.title}</th>
              {cols.map(([key]) => <React.Fragment key={key}>{cell(r[key] as number | null, key !== 'episodeA')}</React.Fragment>)}
              <td className={`text-center ${t?.cls ?? ''}`} title={t?.label}>{t ? <><span aria-hidden="true">{t.icon}</span><span className="sr-only">{t.label}</span></> : ''}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

// What the trainee handed in: the latest version of each assignment, with its links.
const HandIns: React.FC<{ submissions: AssessmentSubmission[]; titleOf: (stage: AssessmentStage, target: string) => string }> = ({ submissions, titleOf }) => {
  const latest = [...new Map(submissions.map(s => [`${s.stage}|${s.target}`, s])).keys()]
    .map(k => { const [stage, target] = k.split('|') as [AssessmentStage, string]; return stageSubmissions(submissions, stage, target).at(-1)!; })
    .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
  if (!latest.length) return <p className="text-xs text-gray-500">Nothing handed in yet.</p>;
  return (
    <ul className="grid gap-1.5">
      {latest.map(s => (
        <li key={s.id} className="bg-gray-50 rounded-2xl px-3 py-2 text-xs">
          <p className="font-black text-gray-700">{titleOf(s.stage, s.target)} · v{s.version}{s.isComplete ? '' : ' (not marked complete)'} · {formatDate(new Date(s.submittedAt))}</p>
          <p className="flex flex-wrap gap-x-3">
            {s.links.map((l, i) => <a key={i} href={l.url} target="_blank" rel="noreferrer" className="font-bold text-[#2E9DF7] underline break-all">{l.label}</a>)}
          </p>
          {s.note && <p className="text-gray-500 whitespace-pre-wrap mt-1">{s.note}</p>}
        </li>
      ))}
    </ul>
  );
};

const getInitials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();

// One sound designer in the admin roster, on the 1-5 probation program:
// week, progress, stage scores, final result vs the benchmark, what's
// overdue, and the full-time offer decision.
export const DesignerCard: React.FC<{
  designer: User;
  standing: Standing | null; // null = not enrolled
  accent: string;
  lockedCategories: Category[];
  // Leadership: sees everything, records and changes nothing.
  readOnly?: boolean;
}> = ({ designer, standing, accent, lockedCategories, readOnly }) => {
  const ctx = useAppContext();
  const { assessmentConfig: config, programOutline, assignments, videoProgress, assessmentSubmissions, programOutcomes, setProgramOutcome,
    setWeek2Checkpoint, setUserUnlockedCategories } = ctx;
  const [confirm, setConfirm] = useState<'offered' | 'not_offered' | 'release' | null>(null);
  const [showEvidence, setShowEvidence] = useState(false);
  // Optional reason recorded with each checkpoint decision (admins only).
  const [week2Note, setWeek2Note] = useState('');
  const [finalNote, setFinalNote] = useState('');
  const released = designer.status === 'released';
  const data = traineeDataFrom(ctx, designer.id);
  const outcome = programOutcomes.find(o => o.id === designer.id);
  // After the Week 4 decision, show the scores it was based on (frozen with
  // it), not today's recalculation - weights or the benchmark may have
  // changed since. Decisions recorded before snapshots existed show live scores.
  const frozen = outcome?.decision ? outcome.snapshot : undefined;
  const decidedStatus = frozen ? (frozen.meetsBenchmark ? 'passed' : 'not_passed') : undefined;
  const badge = STATUS_BADGE[badgeKey(designer, standing, outcome)];
  const split = standing ? disagreements(data) : [];
  const w = config.stageWeights;
  const r = standing?.result;
  const LABELS = { episodeA: 'Episode A', episodeB: 'Episode B', da: 'Audio Desc.', pod: 'Pod Trial' } as const;
  const scored = (value: number | null): Outcome => (value === null ? { status: 'awaiting', reason: 'assessment', missing: [] } : { status: 'scored', value });
  const stages = frozen
    ? frozen.stages.map(x => ({ label: LABELS[x.key], weight: x.weight, o: scored(x.value) })).filter(s => s.weight > 0)
    : r ? [
      { label: 'Episode A', weight: w.episodeA, o: r.episodeA },
      { label: 'Episode B', weight: w.episodeB, o: r.episodeB },
      { label: 'Audio Desc.', weight: w.da ?? 0, o: r.da },
      { label: 'Pod Trial', weight: w.pod, o: r.pod },
    ].filter(s => s.weight > 0) : [];
  const skills = standing ? skillBreakdown(data).filter(r => [r.episodeA, r.episodeB, r.pod, r.da].some(v => v !== null)) : [];
  const titleOf = (stage: AssessmentStage, target: string) => stage === 'A'
    ? assignments.find(a => a.id === target)?.title ?? ctx.exercises.find(e => e.id === target)?.title ?? 'Episode A assignment'
    : STAGE_LABELS[stage];
  const progress = data.enrollment ? programProgress(programOutline, assignments, data.enrollment, designer.id, videoProgress, assessmentSubmissions) : null;
  // Once decided, "falling behind" no longer applies.
  const reasons = standing && !outcome?.decision ? behindReasons(standing, config.passThreshold) : [];


  const weekLine = !standing ? null
    : standing.status === 'upcoming' ? `Starts ${formatDate(new Date(`${data.enrollment!.startDate}T00:00:00`))}`
    : standing.ended ? `Finished all ${standing.totalWeeks} weeks`
    : `Week ${standing.week} of ${standing.totalWeeks}`;

  return (
    <div className="rounded-[32px] border border-gray-100 shadow-sm bg-surface p-5 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-black text-sm flex-shrink-0" style={{ background: accent }}>
          {getInitials(designer.name)}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-black text-base leading-tight">{designer.name}</h4>
          <p className="text-xs text-gray-500 font-bold truncate">{data.enrollment?.batch ? `${data.enrollment.batch} • ` : ''}{designer.pod || 'No pod'} • {designer.email}</p>
          {weekLine && <p className="text-[11px] text-gray-400 font-bold mt-0.5">{weekLine}</p>}
        </div>
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide whitespace-nowrap ${badge.cls}`}>{badge.label}</span>
      </div>

      {!standing ? (
        <p className="text-xs text-gray-500">Not enrolled in the probation program - enroll them in <b>Assessment (1–5) → Enrollment & reviewers</b>.</p>
      ) : (
        <>
          {progress && <ProgressBar done={progress.done} total={progress.total} />}

          <div className="grid grid-cols-2 gap-2">
            {stages.map(s => (
              <div key={s.label} className="bg-gray-50 rounded-2xl px-3 py-2">
                <p className="text-[10px] font-black uppercase text-gray-400">{s.label} · {s.weight}%</p>
                <p className="text-sm font-black text-gray-800">{s.o.status === 'scored' ? roundScore(s.o.value).toFixed(2) : '–'}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
            <span className="text-[10px] font-black uppercase text-gray-400">Final</span>
            {frozen ? (
              <span className="flex items-center gap-2">
                {frozen.final === null ? <span className="text-xs font-bold text-gray-500">No final score</span> : <OutcomeBadge outcome={scored(frozen.final)} />}
                <BenchmarkChip meets={frozen.meetsBenchmark} threshold={frozen.passThreshold} />
              </span>
            ) : r!.final.status === 'scored' ? (
              <span className="flex items-center gap-2"><OutcomeBadge outcome={r!.final} /><BenchmarkChip meets={r!.meetsBenchmark} threshold={config.passThreshold} /></span>
            ) : (
              <span className="text-xs font-bold text-gray-500">
                {standing.scoreSoFar === null ? 'No scores yet' : `So far ${roundScore(standing.scoreSoFar).toFixed(2)} · needs ${config.passThreshold}`}
              </span>
            )}
          </div>

          {frozen && (
            <p className="text-[11px] font-bold text-gray-500 -mt-2">
              As recorded with the decision on {formatDate(new Date(outcome!.decidedAt!))} - later changes to weights or the benchmark don't apply.
              {frozen.weakSkills?.length ? ` Below the ${frozen.skillFloor} skill minimum: ${frozen.weakSkills.map(w => `${w.stage} › ${w.title} ${w.value.toFixed(2)}`).join(', ')}.` : ''}
            </p>
          )}

          {skills.length > 0 && <SkillTable rows={skills} showDA={(w.da ?? 0) > 0} floor={config.skillFloor ?? 0} />}

          <div>
            <button onClick={() => setShowEvidence(o => !o)} aria-expanded={showEvidence} className="text-xs font-black uppercase text-[#2E9DF7] hover:underline">
              {showEvidence ? 'Hide' : 'Show'} evidence: hand-ins, scores & feedback
            </button>
            {showEvidence && (
              <div className="mt-2 space-y-3">
                <HandIns submissions={data.submissions} titleOf={titleOf} />
                <ReviewBreakdown traineeId={designer.id} />
              </div>
            )}
          </div>

          {reasons.length > 0 && (
            <ul className="bg-rose rounded-2xl px-4 py-3 text-xs font-bold text-ember list-disc pl-7 space-y-0.5">
              {reasons.map(x => <li key={x}>{x}</li>)}
            </ul>
          )}

          {split.length > 0 && (
            <div className="bg-sky rounded-2xl px-4 py-3 text-xs font-bold text-navy">
              <p className="font-black mb-0.5">Reviewers {DISAGREEMENT_GAP}+ points apart - worth a calibration chat before publishing:</p>
              <ul className="list-disc pl-5 space-y-0.5">
                {split.map(x => (
                  <li key={`${x.stage}|${x.title}`}>
                    {x.stage} › {x.title}: {x.scores.map(s => `${REVIEWER_SLOTS.find(r => r.id === s.slot)?.label ?? s.slot} ${s.score}`).join(', ')}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {standing.late.length > 0 && (
            <ul className="bg-peach rounded-2xl px-4 py-3 text-xs font-bold text-ember list-disc pl-7 space-y-0.5">
              {standing.late.map(l => <li key={l.assignment.id}>{l.assignment.title} was handed in {l.days} day{l.days === 1 ? '' : 's'} late</li>)}
            </ul>
          )}

          {(standing.week >= 2 || standing.ended) && (outcome?.week2 || (!outcome?.decision && !readOnly)) && (
            <div className="rounded-2xl px-4 py-3 text-xs bg-gray-50 text-gray-700 space-y-2">
              {outcome?.week2 ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-black">
                      Week 2 checkpoint: {outcome.week2.decision === 'continue' ? '✓ Continue' : 'Released - lessons closed, grades still visible'} · {formatDate(new Date(outcome.week2.decidedAt))}
                    </span>
                    {!readOnly && <button onClick={() => saveWith(setWeek2Checkpoint(designer.id, null))} className="font-bold text-gray-500 hover:text-ember">Undo</button>}
                  </div>
                  {outcome.week2.note && <p className="text-gray-500 whitespace-pre-wrap">{outcome.week2.note}</p>}
                </>
              ) : (
                <>
                  <p className="font-black">Week 2 checkpoint - continue or release?</p>
                  <textarea value={week2Note} onChange={e => setWeek2Note(e.target.value)} maxLength={2000} placeholder="Reason (optional, admins and leadership only)"
                    aria-label="Week 2 checkpoint reason" className="w-full bg-surface rounded-xl p-2 text-xs h-14" />
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => saveWith(setWeek2Checkpoint(designer.id, 'continue', week2Note)).then(ok => ok && setWeek2Note(''))}
                      className="bg-[#3DDC97] text-[#0B3D2A] font-black px-3 py-1.5 rounded-full">Continue</button>
                    <button onClick={() => setConfirm('release')} className="bg-gray-200 text-gray-700 font-black px-3 py-1.5 rounded-full">Release</button>
                  </div>
                </>
              )}
            </div>
          )}

          {outcome?.week2?.decision !== 'release' && (outcome?.decision || standing.status === 'passed' || standing.status === 'not_passed') && (
            <div className={`rounded-2xl px-4 py-3 text-xs ${(decidedStatus ?? standing.status) === 'passed' ? 'bg-[#3DDC97]/15 text-leaf' : 'bg-gray-50 text-gray-600'}`}>
              {outcome?.decision ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-black">
                    {outcome.decision === 'offered' ? '🎉 Full-time offer recorded' : 'Recorded: no full-time offer - lessons closed, grades still visible'} · {formatDate(new Date(outcome.decidedAt!))}
                  </span>
                  {!readOnly && <button onClick={() => saveWith(setProgramOutcome(designer.id, null))} className="font-bold text-gray-500 hover:text-ember">Undo</button>}
                  {outcome.note && <p className="w-full whitespace-pre-wrap opacity-80">{outcome.note}</p>}
                </div>
              ) : readOnly ? null : (
                <textarea value={finalNote} onChange={e => setFinalNote(e.target.value)} maxLength={2000} placeholder="Reason (optional, admins and leadership only)"
                  aria-label="Week 4 decision reason" className="w-full bg-surface rounded-xl p-2 text-xs h-14 mb-2 text-gray-700" />
              )}
              {outcome?.decision ? null : standing.status === 'passed' ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-black">Passed probation - recommend a full-time offer.</span>
                  {!readOnly && <button onClick={() => setConfirm('offered')} className="bg-[#3DDC97] text-[#0B3D2A] font-black px-3 py-1.5 rounded-full">Record full-time offer</button>}
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-black">
                    {r!.weakSkills.length ? `A skill is below the ${config.skillFloor} minimum` : `Final score is below ${config.passThreshold}`} - probation not passed.
                  </span>
                  {!readOnly && <button onClick={() => setConfirm('not_offered')} className="bg-gray-200 text-gray-700 font-black px-3 py-1.5 rounded-full">Record: no offer</button>}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {!readOnly && lockedCategories.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-black text-gray-400 uppercase">Locked:</span>
          {lockedCategories.map(cat => {
            const unlocked = designer.unlockedCategories?.includes(cat.id) ?? false;
            return (
              <button key={cat.id} aria-pressed={unlocked}
                onClick={() => setUserUnlockedCategories(designer.id, unlocked
                  ? (designer.unlockedCategories ?? []).filter(id => id !== cat.id)
                  : [...(designer.unlockedCategories ?? []), cat.id])}
                title={unlocked ? `${designer.name} can see ${cat.name}. Click to lock again.` : `Unlock ${cat.name} for ${designer.name}`}
                className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full ${unlocked ? 'bg-[#3DDC97]/20 text-leaf' : 'bg-gray-100 text-gray-500 hover:bg-sky hover:text-navy'}`}>
                {unlocked ? '🔓' : '🔒'} {cat.name}
              </button>
            );
          })}
        </div>
      )}


      <ConfirmModal
        open={confirm !== null}
        title={confirm === 'release' ? `Release ${designer.name} at the Week 2 checkpoint?`
          : confirm === 'offered' ? `Record a full-time offer for ${designer.name}?` : `Record that ${designer.name} won't get an offer?`}
        message={confirm === 'offered'
          ? "This only records the decision here for coordinators and leadership - it isn't shown to the trainee or their reviewers, and no email is sent."
          : `${designer.name}'s lessons, schedule and submissions close right away; they can still see their grades and reviewers' feedback. The decision and reason are only visible to admins and leadership, and no email is sent. You can undo this.`}
        confirmLabel={confirm === 'release' ? 'Release' : 'Record'}
        onConfirm={() => {
          if (confirm === 'release') saveWith(setWeek2Checkpoint(designer.id, 'release', week2Note)).then(ok => ok && setWeek2Note(''));
          else if (confirm) saveWith(setProgramOutcome(designer.id, confirm, finalNote, scoreSnapshot(data))).then(ok => ok && setFinalNote(''));
          setConfirm(null);
        }}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
};
