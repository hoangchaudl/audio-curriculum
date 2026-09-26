import React, { Suspense, lazy, useEffect, useState } from 'react';

// Loaded when the first Markdown text is shown, not with the app.
const Markdown = lazy(() => import('react-markdown'));
import { AssessmentStage } from '../../types';
import { Outcome, outcomeLabel, roundScore } from '../../assessment/scoring';
import { SCORE_LABELS_5 } from '../../assessment/config';

export const STAGE_LABELS: Record<AssessmentStage, string> = {
  A: 'Episode A',
  B: 'Episode B (Final Episode Test)',
  P1: 'Pod Trial – Episode 1',
  P2: 'Pod Trial – Episode 2',
  DA: 'Audio Description (DA)',
};

export const card = 'bg-surface rounded-[32px] p-6 md:p-8 border border-gray-100 shadow-sm';
export const sectionTitle = 'text-sm font-black uppercase text-[#2E9DF7] tracking-widest';
export const input = 'w-full bg-gray-50 rounded-xl p-3 text-sm focus:ring-2 focus:ring-[#2E9DF7] font-medium';
export const primaryBtn =
  'bg-[#2E9DF7] text-white font-bold text-sm px-5 py-2.5 rounded-2xl shadow-[0_4px_0_#1b85df] active:shadow-none active:translate-y-[2px] transition-all disabled:opacity-50 disabled:shadow-none disabled:translate-y-0';
export const secondaryBtn = 'bg-gray-100 text-gray-700 font-bold text-sm px-4 py-2 rounded-2xl hover:bg-gray-200 transition-colors disabled:opacity-50';

// One save rule: every write reports "✓ Saved" (or a failure) in the
// corner via <SavedToast /> - through saveWith, or notifySave directly.
export const notifySave = (ok: boolean) => window.dispatchEvent(new CustomEvent('app-saved', { detail: ok }));

export const saveWith = async (work: Promise<unknown>): Promise<boolean> => {
  try {
    await work;
    notifySave(true);
    return true;
  } catch (error) {
    console.error('Save failed', error);
    notifySave(false);
    return false;
  }
};

// Live data that couldn't load (a listener was refused or lost).
export const notifySyncError = () => window.dispatchEvent(new Event('app-sync-error'));

export const SyncErrorBanner: React.FC = () => {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onError = () => setShow(true);
    window.addEventListener('app-sync-error', onError);
    return () => window.removeEventListener('app-sync-error', onError);
  }, []);
  if (!show) return null;
  return (
    <div role="alert" className="fixed top-3 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-xl flex flex-wrap items-center gap-3 bg-[#F4511E] text-white text-sm font-bold px-5 py-3 rounded-2xl shadow-lg">
      <span className="flex-1 min-w-[12rem]">Some data couldn't load, so this page may be out of date.</span>
      <button onClick={() => window.location.reload()} className="bg-white text-ember px-3 py-1 rounded-full text-xs font-black uppercase">Refresh</button>
      <button onClick={() => setShow(false)} aria-label="Dismiss" className="px-1 text-white/80 hover:text-white">✕</button>
    </div>
  );
};

export const SavedToast: React.FC = () => {
  const [state, setState] = useState<'ok' | 'fail' | null>(null);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const onSaved = (e: Event) => {
      setState((e as CustomEvent<boolean>).detail ? 'ok' : 'fail');
      clearTimeout(t);
      t = setTimeout(() => setState(null), 2000);
    };
    window.addEventListener('app-saved', onSaved);
    return () => { window.removeEventListener('app-saved', onSaved); clearTimeout(t); };
  }, []);
  if (!state) return null;
  return (
    <div role="status" className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-lg text-sm font-black ${
      state === 'ok' ? 'bg-[#3DDC97] text-[#0B3D2A]' : 'bg-[#F4511E] text-white'}`}>
      {state === 'ok' ? '✓ Saved' : "Couldn't save - check your connection and try again"}
    </div>
  );
};

// Program progress bar (see programProgress in assessment/outline.ts).
export const ProgressBar: React.FC<{ done: number; total: number; label?: string; size?: 'sm' | 'lg' }> = ({ done, total, label = 'Program progress', size = 'sm' }) => {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-[10px] font-black text-gray-500 mb-1.5 uppercase tracking-wide">
        <span>{label}</span>
        <span>{total ? `${done} of ${total} done · ${pct}%` : 'Nothing to do yet'}</span>
      </div>
      <div className={`${size === 'lg' ? 'h-4' : 'h-3'} bg-gray-100 rounded-full overflow-hidden`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className="h-full rounded-full bg-[#3DDC97] transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

// "3.80 / 5 · Production Ready" for scores, or the awaiting label.
export const OutcomeBadge: React.FC<{ outcome: Outcome; size?: 'sm' | 'lg' }> = ({ outcome, size = 'sm' }) => {
  if (outcome.status === 'awaiting') {
    return (
      <span className="inline-block bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wide">
        {outcomeLabel(outcome)}
      </span>
    );
  }
  // Band from the displayed (2-decimal) value, so "4.00" never reads as
  // "Functional" because the unrounded value was 3.9999 (e.g. 33.33% weights).
  const shown = roundScore(outcome.value);
  const band = SCORE_LABELS_5[Math.min(5, Math.max(1, Math.floor(shown + 1e-9)))];
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className={`font-black text-gray-800 ${size === 'lg' ? 'text-3xl' : 'text-base'}`}>{shown.toFixed(2)}</span>
      <span className="text-xs font-bold text-gray-400">/ 5</span>
      <span className="text-[10px] font-black uppercase tracking-wide text-leaf ml-1">{band}</span>
    </span>
  );
};

export const BenchmarkChip: React.FC<{ meets?: boolean; threshold: number }> = ({ meets, threshold }) =>
  meets === undefined ? null : (
    <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wide ${
      meets ? 'bg-[#3DDC97] text-[#0B3D2A]' : 'bg-[#F4511E]/20 text-ember'
    }`}>
      {meets ? '✓ Meeting benchmark' : `Below benchmark (${threshold})`}
    </span>
  );

// Week/day are 1-based offsets from the enrollment start date.
export const dateFor = (startDate: string | undefined, week: number, day = 1) => {
  if (!startDate) return null;
  const d = new Date(`${startDate}T00:00:00`);
  d.setDate(d.getDate() + (week - 1) * 7 + (day - 1));
  return d;
};

export const formatDate = (d: Date | null) =>
  d ? d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : null;

// Safe Markdown (react-markdown never renders raw HTML by default).
export const Md: React.FC<{ children: string }> = ({ children }) => (
  <div className="text-sm text-gray-700 leading-relaxed space-y-2 [&_h1]:text-lg [&_h1]:font-black [&_h2]:font-black [&_h3]:font-bold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-[#2E9DF7] [&_a]:underline [&_strong]:text-gray-800">
    <Suspense fallback={<p className="whitespace-pre-wrap">{children}</p>}>
      <Markdown
        components={{ a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noreferrer" /> }}
      >
        {children}
      </Markdown>
    </Suspense>
  </div>
);

export const isHttpUrl = (s: string) => /^https?:\/\/\S+\.\S+/i.test(s.trim());

// A rubric's name for score n: the admin's band ("Merit (60+)") or "Score n".
export const bandLabel = (bands: string[] | undefined, n: number) => bands?.[n - 1]?.trim() || `Score ${n}`;

// Rubric table: one row per criterion (with what it assesses and its
// weighting when set), one column per score 1-5 with the admin's
// description of that level.
export const RubricTable: React.FC<{ lines: { id: string; title: string; levels?: string[]; outcome?: string; note?: string }[]; bands?: string[] }> = ({ lines, bands }) => {
  const outcomes = lines.some(l => l.outcome);
  const notes = lines.some(l => l.note);
  return (
  <div className="overflow-x-auto">
    <table className="w-full text-xs border-separate border-spacing-1 min-w-[720px]">
      <thead>
        <tr className="text-[10px] font-black uppercase text-gray-500">
          <th className="text-left px-2 py-1 w-36">Criterion</th>
          {outcomes && <th className="text-left px-2 py-1 w-48">What it assesses</th>}
          {notes && <th className="text-left px-2 py-1">Weighting</th>}
          {[1, 2, 3, 4, 5].map(n => <th key={n} className="text-left px-2 py-1">{n} · {bandLabel(bands, n)}</th>)}
        </tr>
      </thead>
      <tbody>
        {lines.map(l => (
          <tr key={l.id} className="align-top">
            <td className="bg-sky text-navy rounded-xl px-3 py-2 font-black">{l.title}</td>
            {outcomes && <td className="bg-gray-50 rounded-xl px-3 py-2 text-gray-600 whitespace-pre-wrap">{l.outcome || <span className="text-gray-300">–</span>}</td>}
            {notes && <td className="bg-gray-50 rounded-xl px-3 py-2 font-black text-gray-600">{l.note}</td>}
            {[1, 2, 3, 4, 5].map(n => (
              <td key={n} className="bg-gray-50 rounded-xl px-3 py-2 text-gray-700 whitespace-pre-wrap">{l.levels?.[n - 1] || <span className="text-gray-300">–</span>}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
  );
};
