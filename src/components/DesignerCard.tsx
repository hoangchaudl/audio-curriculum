import React, { useState } from 'react';
import { useAppContext } from '../store';
import { Category, User } from '../types';
import { traineeDataFrom } from '../assessment/traineeData';
import { Standing, StandingStatus, behindReasons, traineeStanding } from '../assessment/standing';
import { programProgress } from '../assessment/outline';
import { roundScore } from '../assessment/scoring';
import { BenchmarkChip, OutcomeBadge, ProgressBar, formatDate, saveWith } from './assessment/ui';
import { ConfirmModal } from './ConfirmModal';

export const STATUS_BADGE: Record<StandingStatus | 'not_enrolled', { label: string; cls: string }> = {
  passed: { label: '✓ Passed probation', cls: 'bg-[#3DDC97] text-[#0B3D2A]' },
  not_passed: { label: 'Below benchmark', cls: 'bg-[#F4511E] text-white' },
  behind: { label: '⚠ Falling behind', cls: 'bg-[#F4511E]/20 text-ember' },
  grading: { label: 'Finished · waiting for grades', cls: 'bg-sky text-navy' },
  on_track: { label: 'On track', cls: 'bg-[#3DDC97]/20 text-leaf' },
  upcoming: { label: 'Not started yet', cls: 'bg-gray-100 text-gray-500' },
  not_enrolled: { label: 'Not enrolled', cls: 'bg-gray-100 text-gray-500' },
};

// Sort order for the roster: who needs attention first.
export const STATUS_ORDER: (StandingStatus | 'not_enrolled')[] = ['behind', 'grading', 'passed', 'not_passed', 'on_track', 'upcoming', 'not_enrolled'];

const getInitials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();

// One sound designer in the admin roster, on the 1-5 probation program:
// week, progress, stage scores, final result vs the benchmark, what's
// overdue, and the full-time offer decision.
export const DesignerCard: React.FC<{
  designer: User;
  standing: Standing | null; // null = not enrolled
  accent: string;
  lockedCategories: Category[];
}> = ({ designer, standing, accent, lockedCategories }) => {
  const ctx = useAppContext();
  const { assessmentConfig: config, programOutline, assignments, videoProgress, assessmentSubmissions, programOutcomes, setProgramOutcome,
    setUserUnlockedCategories } = ctx;
  const [confirm, setConfirm] = useState<'offered' | 'not_offered' | null>(null);
  const data = traineeDataFrom(ctx, designer.id);
  const outcome = programOutcomes.find(o => o.id === designer.id);
  const badge = STATUS_BADGE[standing?.status ?? 'not_enrolled'];
  const w = config.stageWeights;
  const r = standing?.result;
  const stages = r ? [
    { label: 'Episode A', weight: w.episodeA, o: r.episodeA },
    { label: 'Episode B', weight: w.episodeB, o: r.episodeB },
    { label: 'Audio Desc.', weight: w.da ?? 0, o: r.da },
    { label: 'Pod Trial', weight: w.pod, o: r.pod },
  ].filter(s => s.weight > 0) : [];
  const progress = data.enrollment ? programProgress(programOutline, assignments, data.enrollment, designer.id, videoProgress, assessmentSubmissions) : null;
  const reasons = standing ? behindReasons(standing, config.passThreshold) : [];


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
          <p className="text-xs text-gray-500 font-bold truncate">{designer.pod || 'No pod'} • {designer.email}</p>
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
            {r!.final.status === 'scored' ? (
              <span className="flex items-center gap-2"><OutcomeBadge outcome={r!.final} /><BenchmarkChip meets={r!.meetsBenchmark} threshold={config.passThreshold} /></span>
            ) : (
              <span className="text-xs font-bold text-gray-500">
                {standing.scoreSoFar === null ? 'No scores yet' : `So far ${roundScore(standing.scoreSoFar).toFixed(2)} · needs ${config.passThreshold}`}
              </span>
            )}
          </div>

          {reasons.length > 0 && (
            <ul className="bg-rose rounded-2xl px-4 py-3 text-xs font-bold text-ember list-disc pl-7 space-y-0.5">
              {reasons.map(x => <li key={x}>{x}</li>)}
            </ul>
          )}

          {standing.late.length > 0 && (
            <ul className="bg-peach rounded-2xl px-4 py-3 text-xs font-bold text-ember list-disc pl-7 space-y-0.5">
              {standing.late.map(l => <li key={l.assignment.id}>{l.assignment.title} was handed in {l.days} day{l.days === 1 ? '' : 's'} late</li>)}
            </ul>
          )}

          {(standing.status === 'passed' || standing.status === 'not_passed') && (
            <div className={`rounded-2xl px-4 py-3 text-xs ${standing.status === 'passed' ? 'bg-[#3DDC97]/15 text-leaf' : 'bg-gray-50 text-gray-600'}`}>
              {outcome ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-black">
                    {outcome.decision === 'offered' ? '🎉 Full-time offer recorded' : 'Recorded: no full-time offer'} · {formatDate(new Date(outcome.decidedAt))}
                  </span>
                  <button onClick={() => saveWith(setProgramOutcome(designer.id, null))} className="font-bold text-gray-400 hover:text-ember">Undo</button>
                </div>
              ) : standing.status === 'passed' ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-black">Passed probation - recommend a full-time offer.</span>
                  <button onClick={() => setConfirm('offered')} className="bg-[#3DDC97] text-[#0B3D2A] font-black px-3 py-1.5 rounded-full">Record full-time offer</button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-black">Final score is below {config.passThreshold} - probation not passed.</span>
                  <button onClick={() => setConfirm('not_offered')} className="bg-gray-200 text-gray-700 font-black px-3 py-1.5 rounded-full">Record: no offer</button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {lockedCategories.length > 0 && (
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
        title={confirm === 'offered' ? `Record a full-time offer for ${designer.name}?` : `Record that ${designer.name} won't get an offer?`}
        message="This only records the decision here for coordinators - it isn't shown to the trainee or their reviewers, and no email is sent."
        confirmLabel="Record"
        onConfirm={() => { if (confirm) saveWith(setProgramOutcome(designer.id, confirm)); setConfirm(null); }}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
};
