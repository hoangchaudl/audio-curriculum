import React from 'react';
import { useAppContext } from '../../store';
import { useTraineeData } from '../../assessment/traineeData';
import { Outcome, episodeAModules, finalResult, moduleOutcome } from '../../assessment/scoring';
import { BenchmarkChip, OutcomeBadge, card, dateFor, formatDate, sectionTitle } from './ui';
import { assignmentApplies, assignmentStatus, dueLabel } from '../../assessment/outline';

const go = (hash: string) => { window.location.hash = hash; };

// Trainee home for the assessment program: the three weighted stages, the
// four-week schedule, and (once everything is published) the final grade.
export const ProgramOverview: React.FC = () => {
  const { currentUser, assessmentConfig: config, programOutline, assignments } = useAppContext();
  // Stage links go to the matching assignment page when the outline has one.
  const stageHash = (stage: 'B' | 'P1' | 'P2') => {
    const a = assignments.find(x => x.stage === stage);
    return a ? `#/assignment/${a.id}` : `#/episode/${stage}`;
  };
  const data = useTraineeData(currentUser?.id);
  const result = finalResult(data);
  const pub = data.publication;
  const start = data.enrollment?.startDate;
  const mods = episodeAModules(data.modules);
  const required = data.enrollment?.podEpisodesRequired ?? 1;

  if (!data.enrollment) {
    return (
      <main className="flex-1 flex items-center justify-center p-10 bg-page">
        <p className={`${card} text-sm font-bold text-gray-500 max-w-md text-center`}>
          You're not enrolled in the assessment program yet. A coordinator will enroll you and assign your reviewers.
        </p>
      </main>
    );
  }

  const ownVersions = (stage: string, target?: string) =>
    data.submissions.filter(s => s.stage === stage && (!target || s.target === target));
  const exercisesSubmitted = data.exercises.filter(e => mods.some(m => m.id === e.moduleId) && ownVersions('A', e.id).length > 0).length;
  const exercisesTotal = data.exercises.filter(e => mods.some(m => m.id === e.moduleId)).length;

  const StageCard: React.FC<{
    title: string; weight: number; weeks: string; published?: boolean; outcome: Outcome; status: string; onOpen?: () => void; children?: React.ReactNode;
  }> = ({ title, weight, weeks, published, outcome, status, onOpen, children }) => (
    <div className={`${card} flex flex-col gap-3`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{weeks}</p>
          <h3 className="text-lg font-black text-gray-800">{title}</h3>
        </div>
        <span className="bg-sky text-navy px-3 py-1 rounded-full text-xs font-black">{weight}%</span>
      </div>
      <div className="min-h-8">
        {published ? <OutcomeBadge outcome={outcome} size="lg" /> : (
          <p className="text-xs font-bold text-gray-500">{status}<span className="block text-gray-400 font-medium">Results not published yet</span></p>
        )}
      </div>
      {children}
      {onOpen && <button onClick={onOpen} className="self-start text-xs font-black uppercase text-[#2E9DF7] hover:underline">Open →</button>}
    </div>
  );

  const stageStatus = (stage: 'B' | 'P1' | 'P2') => {
    const v = ownVersions(stage);
    if (!v.length) return 'Not submitted yet';
    return v.some(s => s.isComplete) ? `Complete submission in (${v.length} version${v.length === 1 ? '' : 's'})` : `${v.length} draft version${v.length === 1 ? '' : 's'} – not marked complete`;
  };

  const allPublished = !!(pub?.episodeA && pub?.episodeB && pub?.pod);
  const schedule = [
    { weeks: 'Weeks 1–2', from: 1, to: 2, what: 'Episode A – build one complete training episode through the four modules' },
    { weeks: 'Week 3', from: 3, to: 3, what: 'Episode B – Final Episode Test on a different full episode, independently' },
    { weeks: 'Week 4', from: 4, to: 4, what: `Pod Trial – ${required === 2 ? 'two production episodes' : 'one production episode'}` },
  ];

  return (
    <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-page">
      <header className="min-h-20 bg-surface border-b flex items-center px-4 md:px-10 py-3 flex-shrink-0">
        <div>
          <h2 className="text-lg md:text-2xl font-black text-[#2E9DF7]">My Program</h2>
          <p className="text-xs text-gray-400 font-medium">4 weeks · 40 hours per week{start ? ` · starts ${formatDate(dateFor(start, 1))}` : ''}</p>
        </div>
      </header>

      <div className="flex-1 p-4 md:p-6 lg:p-10 overflow-y-auto">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="grid md:grid-cols-3 gap-6">
            <StageCard title="Episode A" weight={config.stageWeights.episodeA} weeks="Weeks 1–2" published={pub?.episodeA}
              outcome={result.episodeA} status={`${exercisesSubmitted} of ${exercisesTotal} exercises submitted`}>
              <ul className="space-y-1.5">
                {mods.map(m => (
                  <li key={m.id}>
                    <button onClick={() => go(`#/module/${m.id}`)} className="w-full flex items-center justify-between gap-2 text-left bg-gray-50 hover:bg-gray-100 rounded-xl px-3 py-2">
                      <span className="text-xs font-bold text-gray-700">{m.label}. {m.title}</span>
                      <span className="text-[10px] font-black text-gray-400 whitespace-nowrap">
                        {pub?.episodeA ? (moduleOutcome(data, m).status === 'scored' ? (moduleOutcome(data, m) as { value: number }).value.toFixed(2) : '–') : `${m.episodeAWeight ?? 0}%`}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </StageCard>
            <StageCard title="Episode B" weight={config.stageWeights.episodeB} weeks="Week 3 · Final Episode Test" published={pub?.episodeB}
              outcome={result.episodeB} status={stageStatus('B')} onOpen={() => go(stageHash('B'))} />
            <StageCard title="Pod Trial" weight={config.stageWeights.pod} weeks="Week 4" published={pub?.pod} outcome={result.pod}
              status={required === 2 ? `Ep 1: ${stageStatus('P1')} · Ep 2: ${stageStatus('P2')}` : stageStatus('P1')}>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => go(stageHash('P1'))} className="text-xs font-black uppercase text-[#2E9DF7] hover:underline">Episode 1 →</button>
                {required === 2 && <button onClick={() => go(stageHash('P2'))} className="text-xs font-black uppercase text-[#2E9DF7] hover:underline">Episode 2 →</button>}
              </div>
            </StageCard>
          </div>

          <section className={`${card} flex flex-wrap items-center justify-between gap-4`}>
            <div>
              <h3 className={sectionTitle}>Final grade</h3>
              <p className="text-xs text-gray-400 font-medium">
                Episode A × {config.stageWeights.episodeA}% + Episode B × {config.stageWeights.episodeB}% + Pod Trial × {config.stageWeights.pod}% · benchmark {config.passThreshold} / 5
              </p>
            </div>
            {allPublished ? (
              <div className="flex items-center gap-3"><OutcomeBadge outcome={result.final} size="lg" /><BenchmarkChip meets={result.meetsBenchmark} /></div>
            ) : (
              <p className="text-xs font-bold text-gray-400">Appears once all three stages are published</p>
            )}
          </section>

          {programOutline?.weeks.length ? (
            <section className={card}>
              <h3 className={`${sectionTitle} mb-1`}>Weekly milestones</h3>
              <p className="text-xs text-gray-400 font-medium mb-5">What to complete each week, and by when.</p>
              <div className="space-y-6">
                {programOutline.weeks.map((week, wi) => {
                  const weekNo = wi + 1;
                  const entries = week.items.flatMap(it => {
                    if (it.kind === 'assignment') {
                      const a = assignments.find(x => x.id === it.assignmentId);
                      if (!a || !assignmentApplies(a, data.enrollment)) return [];
                      return [{ key: it.id, day: a.dueDay ?? 7, title: a.title, description: undefined as string | undefined,
                        status: assignmentStatus(a, currentUser?.id, data.submissions), hash: `#/assignment/${a.id}` }];
                    }
                    if (it.kind === 'milestone') {
                      return [{ key: it.id, day: it.day ?? 7, title: it.title, description: it.description, status: null, hash: '' }];
                    }
                    return [];
                  }).sort((a, b) => a.day - b.day);
                  return (
                    <div key={week.id}>
                      <p className="text-xs font-black uppercase text-gray-500 mb-2">
                        {week.title}
                        {start && <span className="normal-case font-bold text-gray-400 ml-2">{formatDate(dateFor(start, weekNo))} – {formatDate(dateFor(start, weekNo, 5))}</span>}
                      </p>
                      {entries.length === 0 ? <p className="text-xs text-gray-400">Nothing due this week.</p> : (
                        <ol className="space-y-2">
                          {entries.map(e => (
                            <li key={e.key} className="bg-gray-50 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-start gap-3 min-w-0">
                                <span className="bg-[#F4511E]/15 text-ember rounded-xl px-2.5 py-1 text-[10px] font-black uppercase whitespace-nowrap">
                                  By {dueLabel(start, weekNo, e.day)}
                                </span>
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-gray-800">{e.hash ? '📝 ' : '🏁 '}{e.title}</p>
                                  {e.description && <p className="text-xs text-gray-500">{e.description}</p>}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {e.status && (
                                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                                    e.status === 'submitted' ? 'bg-[#3DDC97] text-[#0B3D2A]' : e.status === 'draft' ? 'bg-sky text-navy' : 'bg-gray-100 text-gray-500'}`}>
                                    {e.status === 'submitted' ? '✓ Submitted' : e.status === 'draft' ? 'Not marked complete' : 'To do'}
                                  </span>
                                )}
                                {e.hash && <button onClick={() => go(e.hash)} className="text-xs font-black uppercase text-[#2E9DF7] hover:underline">Open →</button>}
                              </div>
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ) : (
          <section className={card}>
            <h3 className={`${sectionTitle} mb-4`}>Schedule</h3>
            <ol className="space-y-3">
              {schedule.map(row => (
                <li key={row.weeks} className="flex gap-4 items-start">
                  <span className="w-32 flex-shrink-0 text-xs font-black uppercase text-gray-500">
                    {row.weeks}
                    {start && <span className="block normal-case font-bold text-gray-400">{formatDate(dateFor(start, row.from))} – {formatDate(dateFor(start, row.to, 5))}</span>}
                  </span>
                  <span className="text-sm font-medium text-gray-700">{row.what}</span>
                </li>
              ))}
            </ol>
          </section>
          )}
        </div>
      </div>
    </main>
  );
};
