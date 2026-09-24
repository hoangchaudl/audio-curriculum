import React, { useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import { AssessmentStage } from '../../types';
import { Outcome, outcomeLabel, roundScore } from '../../assessment/scoring';
import { SCORE_LABELS_5 } from '../../assessment/config';

export const STAGE_LABELS: Record<AssessmentStage, string> = {
  A: 'Episode A',
  B: 'Episode B (Final Episode Test)',
  P1: 'Pod Trial – Episode 1',
  P2: 'Pod Trial – Episode 2',
};

export const card = 'bg-surface rounded-[32px] p-6 md:p-8 border border-gray-100 shadow-sm';
export const sectionTitle = 'text-sm font-black uppercase text-[#2E9DF7] tracking-widest';
export const input = 'w-full bg-gray-50 rounded-xl p-3 text-sm focus:ring-2 focus:ring-[#2E9DF7] font-medium';
export const primaryBtn =
  'bg-[#2E9DF7] text-white font-bold text-sm px-5 py-2.5 rounded-2xl shadow-[0_4px_0_#1b85df] active:shadow-none active:translate-y-[2px] transition-all disabled:opacity-50 disabled:shadow-none disabled:translate-y-0';
export const secondaryBtn = 'bg-gray-100 text-gray-700 font-bold text-sm px-4 py-2 rounded-2xl hover:bg-gray-200 transition-colors disabled:opacity-50';

// One save rule for admin screens: every write goes through saveWith, which
// shows "✓ Saved" (or a failure) in the corner via <SavedToast />.
export const saveWith = async (work: Promise<unknown>): Promise<boolean> => {
  try {
    await work;
    window.dispatchEvent(new CustomEvent('app-saved', { detail: true }));
    return true;
  } catch (error) {
    console.error('Save failed', error);
    window.dispatchEvent(new CustomEvent('app-saved', { detail: false }));
    return false;
  }
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

export const BenchmarkChip: React.FC<{ meets?: boolean }> = ({ meets }) =>
  meets === undefined ? null : (
    <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wide ${
      meets ? 'bg-[#3DDC97] text-[#0B3D2A]' : 'bg-[#F4511E]/20 text-ember'
    }`}>
      {meets ? '✓ Meeting benchmark' : 'Below benchmark (3.5)'}
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
    <Markdown
      components={{ a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noreferrer" /> }}
    >
      {children}
    </Markdown>
  </div>
);

export const isHttpUrl = (s: string) => /^https?:\/\/\S+\.\S+/i.test(s.trim());
