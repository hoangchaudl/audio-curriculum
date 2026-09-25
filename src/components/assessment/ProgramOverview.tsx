import React from 'react';
import { useAppContext } from '../../store';
import { useTraineeData } from '../../assessment/traineeData';
import { Outcome, assignmentCriteria, assignmentOutcome, episodeAAssignments, finalResult } from '../../assessment/scoring';
import { lessonPace, PACE_CHECK_DAY } from '../../assessment/standing';
import { WeekPlan } from './WeekPlan';
import { BenchmarkChip, OutcomeBadge, ProgressBar, card, dateFor, formatDate, sectionTitle } from './ui';
import { assignmentApplies, assignmentStatus, assignmentWeek, dueLabel, nextSteps, programProgress, weekLabel } from '../../assessment/outline';

const go = (hash: string) => { window.location.hash = hash; };

// Trainee home for the assessment program: the three weighted stages, the
// four-week schedule, and (once everything is published) the final grade.
export const ProgramOverview: React.FC = () => {
  const { currentUser, assessmentConfig: config, programOutline, assignments, videoProgress, modules } = useAppContext();
  // The welcome guide stays open until the trainee first closes it.
  const [welcomeSeen, setWelcomeSeen] = React.useState(() => { try { return localStorage.getItem('programWelcomeSeen') === '1'; } catch { return false; } });
  const markWelcomeSeen = () => { setWelcomeSeen(true); try { localStorage.setItem('programWelcomeSeen', '1'); } catch { /* storage blocked */ } };
  // Stage links go to the matching assignment page when the outline has one.
  const stageHash = (stage: 'B' | 'P1' | 'P2' | 'DA') => {
    const a = assignments.find(x => x.stage === stage);
    return a ? `#/assignment/${a.id}` : `#/episode/${stage}`;
  };
  const data = useTraineeData(currentUser?.id);
  const result = finalResult(data);
  const pub = data.publication;
  const start = data.enrollment?.startDate;
  const epA = episodeAAssignments(data.assignments);
  const required = data.enrollment?.podEpisodesRequired ?? 1;
  // "Weeks 1–2" from where the stage's assignments sit in the outline.
  const weeksOf = (stages: string[], fallback: string) => {
    const ws = [...new Set(assignments.filter(a => stages.includes(a.stage)).map(a => assignmentWeek(programOutline, a.id)).filter((w): w is number => !!w))].sort((x, y) => x - y);
    return !ws.length ? fallback : ws.length === 1 ? `Week ${ws[0]}` : `Weeks ${ws[0]}–${ws[ws.length - 1]}`;
  };

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
  const epASubmitted = epA.filter(a => ownVersions('A', a.id).length > 0 || assignmentCriteria(data.exercises, a.id).some(e => ownVersions('A', e.id).length > 0)).length;

  const StageCard: React.FC<{
    title: string; weight: number; weeks: string; published?: boolean; outcome: Outcome; status: string; onOpen?: () => void; children?: React.ReactNode;
    task?: string; about: string;
  }> = ({ title, weight, weeks, published, outcome, status, onOpen, children, task, about }) => (
    <div className={`${card} flex flex-col gap-3`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{weeks}</p>
          <h3 className="text-lg font-black text-gray-800">{title}</h3>
          {task && <p className="text-xs font-black text-[#2E9DF7] mt-0.5">{task}</p>}
        </div>
        <span className="bg-sky text-navy px-3 py-1 rounded-full text-xs font-black">{weight}%</span>
      </div>
      <p className="text-xs text-gray-600 leading-relaxed">{about}</p>
      <div className="min-h-8">
        {published ? <OutcomeBadge outcome={outcome} size="lg" /> : (
          <p className="text-xs font-bold text-gray-500">{status}<span className="block text-gray-400 font-medium">Results not published yet</span></p>
        )}
      </div>
      {children}
      {onOpen && <button onClick={onOpen} className="self-start text-xs font-black uppercase text-[#2E9DF7] hover:underline">Open →</button>}
    </div>
  );

  const stageStatus = (stage: 'B' | 'P1' | 'P2' | 'DA') => {
    const v = ownVersions(stage);
    if (!v.length) return 'Not submitted yet';
    return v.some(s => s.isComplete) ? `Complete submission in (${v.length} version${v.length === 1 ? '' : 's'})` : `${v.length} draft version${v.length === 1 ? '' : 's'} – not marked complete`;
  };

  const sw = config.stageWeights;
  // Audio Description counts once it has a weight (and an assignment).
  const hasDA = (sw.da ?? 0) > 0;
  const allPublished = !!(pub?.episodeA && pub?.episodeB && pub?.pod && (!hasDA || pub?.da));
  const stageList = [`Episode A (${sw.episodeA}%)`, `Episode B (${sw.episodeB}%)`, ...(hasDA ? [`Audio Description (${sw.da}%)`] : []), `the Pod Trial (${sw.pod}%)`];
  const schedule = [
    { weeks: 'Weeks 1–2', from: 1, to: 2, what: 'Episode A – build one complete training episode through the Episode A assignments' },
    { weeks: 'Week 3', from: 3, to: 3, what: 'Episode B – Final Episode Test on a different full episode, independently' },
    { weeks: 'Week 4', from: 4, to: 4, what: `Pod Trial – ${required === 2 ? 'two production episodes' : 'one production episode'}` },
  ];

  return (
    <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-page">
      <header className="min-h-20 bg-surface border-b flex items-center px-4 md:px-10 py-3 flex-shrink-0">
        <div>
          <h2 className="text-lg md:text-2xl font-black text-[#2E9DF7]">My Program</h2>
          <p className="text-xs text-gray-400 font-medium">{programOutline?.weeks.length || 4} weeks · 40 hours per week{start ? ` · starts ${formatDate(dateFor(start, 1))}` : ''}</p>
        </div>
      </header>

      <div className="flex-1 p-4 md:p-6 lg:p-10 overflow-y-auto">
        <div className="max-w-5xl mx-auto space-y-6">
          {(() => {
            const { overdue, next } = nextSteps(programOutline, assignments, modules, data.enrollment, currentUser?.id, videoProgress, data.submissions);
            const pace = lessonPace(programOutline, assignments, data.enrollment?.startDate, currentUser?.id, videoProgress);
            const when = (d?: Date) => (d ? d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : '');
            const daysLeft = (d?: Date) => (d ? Math.ceil((d.getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000) : null);
            return (
              <section className="space-y-3">
                {pace.length > 0 && (
                  <div className="bg-[#F4511E]/10 border-2 border-[#F4511E]/30 rounded-[32px] p-5 space-y-1">
                    <p className="text-xs font-black uppercase text-ember">📖 Behind on lessons</p>
                    {pace.map(p => (
                      <p key={p.week} className="text-sm font-bold text-gray-800">
                        {p.current
                          ? `Week ${p.week}: ${p.done} of ${p.total} lessons done. Try to finish at least half of this week's lessons by Day ${PACE_CHECK_DAY} so you're ready for the assignment.`
                          : `Week ${p.week} still has ${p.total - p.done} of ${p.total} lessons to finish - catch up so they don't pile up.`}
                      </p>
                    ))}
                    <p className="text-[11px] text-gray-500">Your coordinator can see this too - reach out if you're stuck.</p>
                  </div>
                )}
                {overdue.length > 0 && (
                  <div className="bg-rose rounded-[32px] p-5 space-y-2">
                    <p className="text-xs font-black uppercase text-ember">⚠ Overdue - submit as soon as you can</p>
                    {overdue.map(o => (
                      <button key={o.hash} onClick={() => go(o.hash)} className="w-full flex flex-wrap items-center justify-between gap-2 bg-surface rounded-2xl px-4 py-3 text-left hover:shadow-md transition-shadow">
                        <span className="text-sm font-bold text-gray-800">📝 {o.title}</span>
                        <span className="text-xs font-black text-ember">was due {when(o.due)} · Open →</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className={`${card} flex flex-wrap items-center justify-between gap-3`}>
                  {next ? (
                    <>
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-widest text-[#2E9DF7]">▶ Up next · Week {next.week}</p>
                        <p className="text-lg font-black text-gray-800">{next.kind === 'assignment' ? '📝 ' : '📖 '}{next.title}</p>
                        {next.kind === 'assignment' && next.due && (
                          <p className="text-xs font-bold text-gray-500">
                            Due {when(next.due)}{(() => { const d = daysLeft(next.due); return d === null ? '' : d <= 0 ? ' · today' : d === 1 ? ' · tomorrow' : ` · in ${d} days`; })()}
                          </p>
                        )}
                      </div>
                      <button onClick={() => go(next.hash)} className="bg-[#2E9DF7] text-white font-bold text-sm px-5 py-2.5 rounded-2xl shadow-[0_4px_0_#1b85df] active:shadow-none active:translate-y-[2px]">
                        {next.kind === 'assignment' ? 'Open assignment' : 'Start lesson'}
                      </button>
                    </>
                  ) : (
                    <p className="text-sm font-bold text-leaf">🎉 You've done everything in the program so far - your reviewers will score your work.</p>
                  )}
                </div>
              </section>
            );
          })()}

          <WeekPlan traineeId={currentUser?.id} />

          {/* The page guide opens by default on the first visit, then folds away. */}
          <details open={!welcomeSeen} onToggle={e => { if (!(e.target as HTMLDetailsElement).open) markWelcomeSeen(); }} className="bg-sky rounded-[32px] p-6 md:p-8 text-navy group">
            <summary className="cursor-pointer list-none flex items-center justify-between gap-2">
              <span className="text-lg font-black">Welcome to your training program</span>
              <span className="text-xs font-bold opacity-70 group-open:hidden">About this page ›</span>
              <span className="text-xs font-bold opacity-70 hidden group-open:inline">Hide</span>
            </summary>
            <div className="mt-2">
            <p className="text-sm font-medium mb-4">
              Over {programOutline?.weeks.length || 4} weeks you'll learn the StoryCo workflow and prove it on real episodes. This page is your home base - here's what's on it:
            </p>
            <ul className="grid sm:grid-cols-2 gap-3 text-sm">
              <li className="bg-surface/70 rounded-2xl p-3"><b>📊 Your progress</b><br />How much of the program you've finished: lessons you've watched or marked done, plus assignments you've submitted.</li>
              <li className="bg-surface/70 rounded-2xl p-3"><b>🗓️ Weekly milestones</b><br />What's due each week and by which day. Open an assignment to read the brief and submit your work.</li>
              <li className="bg-surface/70 rounded-2xl p-3"><b>📝 How you're graded</b><br />{stageList.length} stages - {stageList.slice(0, -1).join(', ')} and {stageList[stageList.length - 1]}. Reviewers score your work from 1 to 5.</li>
              <li className="bg-surface/70 rounded-2xl p-3"><b>🏁 Final grade</b><br />Your overall score, shown once your coordinator publishes every stage. The goal is {config.passThreshold} / 5 or higher.</li>
            </ul>
            </div>
          </details>
          {(() => {
            const p = programProgress(programOutline, assignments, data.enrollment, currentUser?.id, videoProgress, data.submissions);
            return p.total > 0 && (
              <section className={card}>
                <ProgressBar done={p.done} total={p.total} label="Your progress" size="lg" />
                <div className="flex flex-wrap gap-2 mt-4">
                  {p.weeks.filter(w => w.total > 0).map(w => (
                    <span key={w.id} className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${w.done === w.total ? 'bg-[#3DDC97] text-[#0B3D2A]' : 'bg-gray-100 text-gray-500'}`}>
                      {w.done === w.total ? '✓ ' : ''}{w.title} · {w.done}/{w.total}
                    </span>
                  ))}
                </div>
                <p className="text-[11px] text-gray-400 font-medium mt-3">Counts content you've marked done and assignments you've submitted.</p>
              </section>
            );
          })()}
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
                        {weekLabel(wi)}
                        {start && <span className="normal-case font-bold text-gray-400 ml-2">{formatDate(dateFor(start, weekNo))} – {formatDate(dateFor(start, weekNo, 5))}</span>}
                      </p>
                      {week.goal && (
                        <p className="bg-sky text-navy rounded-2xl px-4 py-3 text-sm font-medium mb-2">
                          <span className="font-black">🎯 Goal: </span>{week.goal}
                        </p>
                      )}
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

          <div>
            <h3 className={`${sectionTitle} mb-1 px-2`}>How you're graded</h3>
            <p className="text-sm text-gray-600 font-medium mb-1 px-2">Your final grade combines {stageList.length} stages, each assessing a different part of your progress.</p>
            <p className="text-xs text-gray-400 font-medium mb-3 px-2">The percentage is each stage's share of your final grade. Scores appear here once your coordinator publishes them.</p>
          <div className={`grid md:grid-cols-2 ${hasDA ? 'xl:grid-cols-4' : 'xl:grid-cols-3'} gap-6`}>
            <StageCard title="Episode A" weight={config.stageWeights.episodeA} weeks={weeksOf(['A'], 'Weeks 1–2')} published={pub?.episodeA}
              outcome={result.episodeA} status={`${epASubmitted} of ${epA.length} assignments submitted`}
              about="Your guided practice episode, built step by step through the dialogue, SFX, background and music assignments. This assesses how well you apply the techniques taught in the course.">
              <ul className="space-y-1.5">
                {epA.map(a => {
                  const o = assignmentOutcome(data, a);
                  return (
                    <li key={a.id}>
                      <button onClick={() => go(`#/assignment/${a.id}`)} className="w-full flex items-center justify-between gap-2 text-left bg-gray-50 hover:bg-gray-100 rounded-xl px-3 py-2">
                        <span className="text-xs font-bold text-gray-700">{a.title}</span>
                        <span className="text-[10px] font-black text-gray-400 whitespace-nowrap">
                          {pub?.episodeA ? (o.status === 'scored' ? o.value.toFixed(2) : '–') : `${a.weight ?? 0}%`}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </StageCard>
            <StageCard title="Episode B" weight={config.stageWeights.episodeB} weeks={weeksOf(['B'], 'Week 3')} published={pub?.episodeB}
              outcome={result.episodeB} status={stageStatus('B')} onOpen={() => go(stageHash('B'))}
              task="Finish a Full Episode"
              about="Complete a new episode independently, from dialogue preparation through SFX, backgrounds and music. This assesses whether you can bring the full workflow together." />
            {hasDA && (
              <StageCard title="Audio Description" weight={sw.da} weeks={weeksOf(['DA'], 'DA')} published={pub?.da}
                outcome={result.da} status={stageStatus('DA')} onOpen={() => go(stageHash('DA'))}
                task="Adapt a Session for Audio Description"
                about="Adapt an existing session for listening without picture. Adjust pacing, pauses and sound transitions so the story remains clear and engaging." />
            )}
            <StageCard title="Pod Trial" weight={config.stageWeights.pod} weeks={weeksOf(['P1', 'P2'], 'Week 4')} published={pub?.pod} outcome={result.pod}
              status={required === 2 ? `Ep 1: ${stageStatus('P1')} · Ep 2: ${stageStatus('P2')}` : stageStatus('P1')}
              about={`Complete ${required === 2 ? 'two assigned pod episodes, each' : 'one assigned pod episode,'} 2–3 minutes, with a key sound designer providing QC. This assesses production quality, communication, reliability and your ability to apply feedback.`}>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => go(stageHash('P1'))} className="text-xs font-black uppercase text-[#2E9DF7] hover:underline">Episode 1 →</button>
                {required === 2 && <button onClick={() => go(stageHash('P2'))} className="text-xs font-black uppercase text-[#2E9DF7] hover:underline">Episode 2 →</button>}
              </div>
            </StageCard>
          </div>
          </div>

          <section className={`${card} flex flex-wrap items-center justify-between gap-4`}>
            <div>
              <h3 className={sectionTitle}>Final grade</h3>
              <p className="text-xs text-gray-400 font-medium">
                Episode A × {sw.episodeA}% + Episode B × {sw.episodeB}%{hasDA ? ` + Audio Description × ${sw.da}%` : ''} + Pod Trial × {sw.pod}% · benchmark {config.passThreshold} / 5
              </p>
            </div>
            {allPublished ? (
              <div className="flex items-center gap-3"><OutcomeBadge outcome={result.final} size="lg" /><BenchmarkChip meets={result.meetsBenchmark} /></div>
            ) : (
              <p className="text-xs font-bold text-gray-400">Appears once every stage is published</p>
            )}
          </section>
        </div>
      </div>
    </main>
  );
};
