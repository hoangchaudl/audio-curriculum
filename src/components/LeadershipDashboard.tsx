import React, { useEffect, useRef, useState } from 'react';
import { useAppContext } from '../store';
import { DISAGREEMENT_GAP, Outcome, roundScore } from '../assessment/scoring';
import { programProgress } from '../assessment/outline';
import { REVIEW_LAG_DAYS, behindReasons, slotName } from '../assessment/standing';
import { RosterRow, useRoster } from '../assessment/roster';
import { AdminHeader } from './AdminHeader';
import { DesignerCard, STATUS_BADGE } from './DesignerCard';
import { NO_BATCH } from './assessment/ui';

// Read-only overview for StoryCo leadership: every hiring batch with its
// dates and headcount, what needs attention, and each batch's trainees.
// firestore.rules let leadership read all of this and write nothing.

const DAY = 24 * 60 * 60 * 1000;
const dateOf = (iso: string) => new Date(`${iso}T00:00:00`);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);
const shortDate = (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const dayMonth = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const OFFERED_BADGE = { label: '🎉 Offered', cls: 'bg-[#3DDC97] text-[#0B3D2A]' };
const score = (v: number | null | undefined) => (v === null || v === undefined ? '–' : roundScore(v).toFixed(2));
const scoredValue = (o: Outcome | undefined) => (o?.status === 'scored' ? o.value : null);

const panel = 'bg-surface rounded-3xl border border-gray-100 shadow-sm';
const th = 'px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider text-gray-400 whitespace-nowrap';
const td = 'px-3 py-2.5 whitespace-nowrap';

interface Batch {
  key: string; // batch name, or NO_BATCH
  name: string;
  rows: RosterRow[];
  start: Date;
  end: Date; // last day of the program for the latest starter
}

// Where a batch is in the program today, as a label and an elapsed share.
const batchNow = (b: Batch, weeks: number, now: Date) => {
  if (now < b.start) return { label: `Starts ${shortDate(b.start)}`, share: 0 };
  if (now > b.end) return { label: `Finished ${shortDate(b.end)}`, share: 1 };
  const week = Math.min(weeks, Math.floor((now.getTime() - b.start.getTime()) / (7 * DAY)) + 1);
  return { label: `Week ${week} of ${weeks}`, share: (now.getTime() - b.start.getTime()) / (b.end.getTime() + DAY - b.start.getTime()) };
};

const Kpi: React.FC<{ label: string; value: string | number; hint?: string; tone?: string }> = ({ label, value, hint, tone = 'text-gray-900' }) => (
  <div className={`${panel} px-5 py-4`}>
    <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">{label}</p>
    <p className={`text-3xl font-black tabular-nums mt-1 ${tone}`}>{value}</p>
    {hint && <p className="text-xs font-bold text-gray-400 mt-0.5">{hint}</p>}
  </div>
);

const Count: React.FC<{ n: number; label: string; cls: string }> = ({ n, label, cls }) =>
  n === 0 ? null : <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${cls}`}><b className="tabular-nums">{n}</b>{label}</span>;

// One trainee's full card (skills, evidence, decisions) in a modal.
const TraineeDialog: React.FC<{ row: RosterRow | null; onClose: () => void }> = ({ row, onClose }) => {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (row && !d.open) d.showModal();
    if (!row && d.open) d.close();
  }, [row]);
  return (
    <dialog ref={ref} aria-label={row ? `${row.designer.name} - details` : 'Trainee details'}
      onCancel={e => { e.preventDefault(); onClose(); }}
      className="m-auto bg-transparent p-0 max-w-xl w-[calc(100%-2rem)] max-h-[90vh] backdrop:bg-black/50">
      {row && (
        <div className="space-y-2">
          <div className="flex justify-end">
            <button onClick={onClose} className="bg-surface text-gray-700 font-bold text-sm px-4 py-2 rounded-full shadow">Close</button>
          </div>
          <DesignerCard designer={row.designer} standing={row.standing} accent="#2E9DF7" lockedCategories={[]} readOnly />
        </div>
      )}
    </dialog>
  );
};

export const LeadershipDashboard: React.FC = () => {
  const ctx = useAppContext();
  const { assessmentConfig: config, programOutline, assignments, videoProgress, assessmentSubmissions } = ctx;
  const { roster, behind, awaitingDecision, checkpointDue, waiting, splits, outcomeOf, enrollmentOf, statusOf, downloadReport } = useRoster();
  const now = new Date();
  const weeks = programOutline?.weeks.length || 4;
  const showDA = (config.stageWeights.da ?? 0) > 0;

  // Hiring batches from the enrollments, newest start first.
  const enrolled = roster.filter(r => r.standing);
  const byBatch = new Map<string, RosterRow[]>();
  for (const r of enrolled) {
    const key = enrollmentOf(r.designer.id)?.batch?.trim() || NO_BATCH;
    byBatch.set(key, [...(byBatch.get(key) ?? []), r]);
  }
  const batches: Batch[] = [...byBatch].map(([key, rows]) => {
    const starts = rows.map(r => enrollmentOf(r.designer.id)!.startDate).sort();
    return { key, name: key === NO_BATCH ? 'No batch' : key, rows, start: dateOf(starts[0]), end: addDays(dateOf(starts[starts.length - 1]), weeks * 7 - 1) };
  }).sort((a, b) => b.start.getTime() - a.start.getTime());
  const [picked, setPicked] = useState<string | null>(null);
  // Default: the newest batch that has started (else the next to start).
  const selected = batches.find(b => b.key === picked) ?? batches.find(b => b.start <= now) ?? batches[0];
  const [detail, setDetail] = useState<RosterRow | null>(null);

  // Program-wide numbers.
  const decisionOf = (r: RosterRow) => outcomeOf(r.designer.id);
  const offered = enrolled.filter(r => decisionOf(r)?.decision === 'offered').length;
  const released = enrolled.filter(r => r.designer.status === 'released').length;
  const decided = enrolled.filter(r => decisionOf(r)?.decision || decisionOf(r)?.week2?.decision === 'release').length;
  const inProgram = enrolled.filter(r => r.designer.status !== 'released' && !decisionOf(r)?.decision && r.standing!.status !== 'upcoming').length;
  const notEnrolled = roster.length - enrolled.length;

  const counts = (rows: RosterRow[]) => {
    const is = (k: string) => rows.filter(r => statusOf(r) === k && !decisionOf(r)?.decision).length;
    return {
      onTrack: is('on_track'), behind: is('behind'), grading: is('grading'), upcoming: is('upcoming'),
      awaiting: rows.filter(r => r.designer.status !== 'released' && !decisionOf(r)?.decision && (r.standing!.status === 'passed' || r.standing!.status === 'not_passed')).length,
      offered: rows.filter(r => decisionOf(r)?.decision === 'offered').length,
      released: rows.filter(r => r.designer.status === 'released').length,
    };
  };

  const userName = (id: string) => ctx.users.find(u => u.id === id)?.name ?? 'a reviewer';
  const attention = [
    { title: 'Falling behind', icon: '⚠', tone: 'text-ember',
      items: behind.map(r => {
        const n = r.standing!.overdue.length;
        return { who: r.designer.name, what: [...(n ? [`${n} overdue assignment${n === 1 ? '' : 's'}`] : []),
          ...behindReasons({ ...r.standing!, overdue: [] }, config.passThreshold)].join(' · ') || 'Falling behind' };
      }) },
    { title: `Waiting over ${REVIEW_LAG_DAYS} days for scores`, icon: '⏳', tone: 'text-ember',
      items: waiting.map(w => ({ who: w.trainee, what: `${w.title} - ${userName(w.reviewerUid)} (${slotName(w.slot)}), ${w.days} days` })) },
    { title: `Reviewers ${DISAGREEMENT_GAP}+ points apart`, icon: '⚖', tone: 'text-navy',
      items: splits.map(x => ({ who: x.name, what: `${x.n} criteri${x.n === 1 ? 'on' : 'a'} to calibrate` })) },
    { title: 'Week 2 checkpoint not recorded', icon: '🚦', tone: 'text-navy',
      items: checkpointDue.map(r => ({ who: r.designer.name, what: `Week ${Math.min(r.standing!.week, weeks)}` })) },
    { title: 'Offer decision pending', icon: '🎓', tone: 'text-leaf',
      items: awaitingDecision.map(r => ({ who: r.designer.name, what: r.standing!.status === 'passed' ? 'passed probation' : 'below benchmark' })) },
  ].filter(g => g.items.length);
  const attentionCount = attention.reduce((t, g) => t + g.items.length, 0);

  const stageCols = [['episodeA', 'Ep A'], ['episodeB', 'Ep B'], ...(showDA ? [['da', 'DA']] : []), ['pod', 'Pod']] as [('episodeA' | 'episodeB' | 'da' | 'pod'), string][];

  return (
    <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-page">
      <AdminHeader>
        <span className="text-xs font-bold text-gray-500 hidden md:inline">As of {shortDate(now)}</span>
      </AdminHeader>

      <div className="flex-1 overflow-y-auto px-4 md:px-10 py-6 md:py-8 space-y-8 max-w-7xl w-full mx-auto">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Probation program overview</h1>
          <p className="text-sm text-gray-500 font-medium mt-1">
            {weeks}-week program. Pass = final score {config.passThreshold}+ / 5{config.skillFloor ? ` with every skill ${config.skillFloor}+` : ''} → full-time offer.
          </p>
        </div>

        {/* Program-wide numbers */}
        <section aria-label="Program totals" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Kpi label="Batches" value={batches.length} />
          <Kpi label="Trainees enrolled" value={enrolled.length} hint={notEnrolled ? `+${notEnrolled} not enrolled yet` : undefined} />
          <Kpi label="In program now" value={inProgram} />
          <Kpi label="Needs attention" value={behind.length} tone={behind.length ? 'text-ember' : 'text-gray-900'} hint="falling behind" />
          <Kpi label="Offered" value={offered} tone="text-leaf" />
          <Kpi label="Offer rate" value={decided ? `${Math.round((offered / decided) * 100)}%` : '–'} hint={decided ? `${offered} of ${decided} decided (${released} released)` : 'no decisions yet'} />
        </section>

        {/* Needs attention */}
        <section aria-labelledby="attention-title">
          <h2 id="attention-title" className="text-sm font-black uppercase tracking-wider text-gray-700 mb-3">
            Needs attention {attentionCount > 0 && <span className="ml-1 bg-[#F4511E] text-white text-[10px] px-2 py-0.5 rounded-full align-middle">{attentionCount}</span>}
          </h2>
          {attention.length === 0 ? (
            <p className={`${panel} px-5 py-4 text-sm text-gray-500`}>Nothing right now - everyone is on track and reviews are up to date.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {attention.map(g => (
                <div key={g.title} className={`${panel} p-4`}>
                  <p className={`text-xs font-black uppercase tracking-wide mb-2 ${g.tone}`}>
                    <span aria-hidden="true">{g.icon}</span> {g.title} · {g.items.length}
                  </p>
                  <ul className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {g.items.map((it, i) => (
                      <li key={i} className="text-sm leading-snug"><b className="text-gray-900">{it.who}</b> <span className="text-gray-500">- {it.what}</span></li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
          <p className="text-[11px] text-gray-400 font-medium mt-2">Coordinators act on these in the admin dashboard.</p>
        </section>

          {/* Hiring batches */}
        <section className={panel} aria-labelledby="batches-title">
          <div className="px-5 pt-5 pb-3">
            <h2 id="batches-title" className="text-sm font-black uppercase tracking-wider text-gray-700">Hiring batches</h2>
            <p className="text-xs text-gray-400 font-medium">Pick a batch to see its trainees below.</p>
          </div>
          {batches.length === 0 ? <p className="px-5 pb-5 text-sm text-gray-500">No trainees enrolled yet.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-y border-gray-100 bg-gray-50/60">
                  <tr><th className={th}>Batch</th><th className={th}>Dates</th><th className={`${th} text-right`}>Trainees</th><th className={th}>Now</th><th className={th}>Status</th></tr>
                </thead>
                <tbody>
                  {batches.map(b => {
                    const n = batchNow(b, weeks, now);
                    const c = counts(b.rows);
                    const on = b.key === selected?.key;
                    return (
                      <tr key={b.key} className={`border-b border-gray-50 last:border-0 ${on ? 'bg-sky/60' : 'hover:bg-gray-50'}`}>
                        <td className={td}>
                          <button onClick={() => setPicked(b.key)} aria-pressed={on} className="font-black text-gray-900 hover:text-[#2E9DF7] text-left">{b.name}</button>
                        </td>
                        <td className={`${td} text-gray-600 tabular-nums`}>{shortDate(b.start)} – {shortDate(b.end)}</td>
                        <td className={`${td} text-right font-black tabular-nums`}>{b.rows.length}</td>
                        <td className={`${td} min-w-[9rem]`}>
                          <p className="text-xs font-bold text-gray-600">{n.label}</p>
                          <div className="h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden" aria-hidden="true">
                            <div className="h-full bg-[#2E9DF7] rounded-full" style={{ width: `${Math.round(n.share * 100)}%` }} />
                          </div>
                        </td>
                        <td className={`${td} whitespace-normal`}>
                          <div className="flex flex-wrap gap-1">
                            <Count n={c.onTrack} label="on track" cls="bg-[#3DDC97]/20 text-leaf" />
                            <Count n={c.behind} label="behind" cls="bg-[#F4511E]/20 text-ember" />
                            <Count n={c.grading} label="grading" cls="bg-sky text-navy" />
                            <Count n={c.awaiting} label="to decide" cls="bg-sky text-navy" />
                            <Count n={c.offered} label="offered" cls="bg-[#3DDC97] text-[#0B3D2A]" />
                            <Count n={c.released} label="released" cls="bg-gray-200 text-gray-700" />
                            <Count n={c.upcoming} label="not started" cls="bg-gray-100 text-gray-500" />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>


        {/* The selected batch's trainees */}
        {selected && (
          <section className={panel} aria-labelledby="trainees-title">
            <div className="flex flex-wrap items-end justify-between gap-3 px-5 pt-5 pb-3">
              <div>
                <h2 id="trainees-title" className="text-sm font-black uppercase tracking-wider text-gray-700">{selected.name} · trainees</h2>
                <p className="text-xs text-gray-400 font-medium">
                  {selected.rows.length} trainee{selected.rows.length === 1 ? '' : 's'} · {shortDate(selected.start)} – {shortDate(selected.end)} · click a name for skills, evidence and decisions
                </p>
              </div>
              <button onClick={() => downloadReport(selected.rows, selected.key)} className="text-xs font-bold text-navy bg-sky px-4 py-2 rounded-full hover:bg-[#2E9DF7]/20">
                Download report (CSV)
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-y border-gray-100 bg-gray-50/60">
                  <tr>
                    <th className={th}>Trainee</th><th className={th}>Pod</th><th className={th}>Start</th><th className={th}>Ends</th><th className={th}>Progress</th>
                    {stageCols.map(([, l]) => <th key={l} className={`${th} text-right`}>{l}</th>)}
                    <th className={`${th} text-right`}>Final</th><th className={th}>Status</th><th className={th}>Decision</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.rows.map(r => {
                    const e = enrollmentOf(r.designer.id)!;
                    const s = r.standing!;
                    const o = decisionOf(r);
                    const frozen = o?.decision ? o.snapshot : undefined;
                    const stage = (k: typeof stageCols[number][0]) => frozen ? frozen.stages.find(x => x.key === k)?.value ?? null : scoredValue(s.result[k]);
                    const final = frozen ? frozen.final : scoredValue(s.result.final);
                    const meets = frozen ? frozen.meetsBenchmark : s.result.meetsBenchmark;
                    const p = programProgress(programOutline, assignments, e, r.designer.id, videoProgress, assessmentSubmissions);
                    const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
                    // A recorded offer is the headline status once it exists.
                    const badge = o?.decision === 'offered' ? OFFERED_BADGE : STATUS_BADGE[statusOf(r)];
                    const decision = o?.decision === 'offered' ? `Offered · ${dayMonth(o.decidedAt!)}`
                      : o?.decision === 'not_offered' ? `No offer · ${dayMonth(o.decidedAt!)}`
                      : o?.week2?.decision === 'release' ? `Released wk 2 · ${dayMonth(o.week2.decidedAt)}`
                      : o?.week2?.decision === 'continue' ? `Continued wk 2 · ${dayMonth(o.week2.decidedAt)}` : '–';
                    return (
                      <tr key={r.designer.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                        <td className={td}>
                          <button onClick={() => setDetail(r)} className="text-left">
                            <span className="block font-black text-gray-900 hover:text-[#2E9DF7]">{r.designer.name}</span>
                            <span className="block text-xs text-gray-400">{r.designer.email}</span>
                          </button>
                        </td>
                        <td className={`${td} text-gray-600`}>{r.designer.pod || '–'}</td>
                        <td className={`${td} text-gray-600 tabular-nums`}>{shortDate(dateOf(e.startDate))}</td>
                        <td className={`${td} text-gray-600 tabular-nums`}>{shortDate(addDays(dateOf(e.startDate), weeks * 7 - 1))}</td>
                        <td className={`${td} min-w-[8rem]`}>
                          <p className="text-xs font-bold text-gray-600 tabular-nums">
                            {s.status === 'upcoming' ? 'Not started' : s.ended ? 'Finished' : `Week ${s.week}`} · {pct}%
                          </p>
                          <div className="h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden" aria-hidden="true">
                            <div className="h-full bg-[#3DDC97] rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </td>
                        {stageCols.map(([k]) => <td key={k} className={`${td} text-right tabular-nums text-gray-700`}>{score(stage(k))}</td>)}
                        <td className={`${td} text-right tabular-nums`}>
                          {final !== null && final !== undefined
                            ? <b className={meets ? 'text-leaf' : 'text-ember'}>{score(final)}</b>
                            : <span className="text-gray-400" title="Weighted average of the stages scored so far">{s.scoreSoFar === null ? '–' : `${score(s.scoreSoFar)}*`}</span>}
                        </td>
                        <td className={td}><span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide ${badge.cls}`}>{badge.label}</span></td>
                        <td className={`${td} text-xs font-bold text-gray-600`}>{decision}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="px-5 py-3 text-[11px] text-gray-400 font-medium border-t border-gray-50">
              * score so far - weighted average of the stages scored to date. Scores after a Week 4 decision are the ones recorded with it.
            </p>
          </section>
        )}
      </div>

      <TraineeDialog row={detail} onClose={() => setDetail(null)} />
    </main>
  );
};
