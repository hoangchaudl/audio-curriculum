import React, { useState } from 'react';
import { QueueItem, Status, useQueue } from '../../assessment/reviewQueue';
import { useAppContext } from '../../store';
import { AssessmentReview, AssessmentScore, AssessmentStage, AssessmentSubmission, Exercise, ReviewerSlot } from '../../types';
import { REVIEWER_SLOTS, STAGE_SLOTS, allowedScoreKeys, cellGroup, gradesFirstComplete, publicationKey, stageCells, stageCriteria } from '../../assessment/config';
import { exerciseSubmissions, stageSubmissions } from '../../assessment/scoring';
import { STAGE_LABELS, bandLabel, card, input, primaryBtn, secondaryBtn } from './ui';

const STATUS_LABELS: Record<Status, string> = {
  'needs-review': 'Needs review',
  draft: 'Draft saved',
  done: 'Submitted',
  locked: 'Published (locked)',
  'awaiting-submission': 'Awaiting submission',
  'awaiting-complete': 'Awaiting complete submission',
};
const STATUS_STYLES: Record<Status, string> = {
  'needs-review': 'bg-[#F4511E]/20 text-ember',
  draft: 'bg-sky text-navy',
  done: 'bg-[#3DDC97]/20 text-leaf',
  locked: 'bg-gray-100 text-gray-500',
  'awaiting-submission': 'bg-gray-100 text-gray-500',
  'awaiting-complete': 'bg-gray-100 text-gray-500',
};

// Which version the review applies to. Episode B: always the first complete
// submission. Pod: a complete version (latest by default). Episode A: any
// version the trainer picks (latest by default).
const gradableVersions = (item: QueueItem) => {
  if (gradesFirstComplete(item.stage)) return item.versions.filter(v => v.isComplete).slice(0, 1);
  if (item.stage === 'A') return item.versions;
  return item.versions.filter(v => v.isComplete);
};

const ReviewPanel: React.FC<{ item: QueueItem; onDone: () => void }> = ({ item, onDone }) => {
  const { saveReview, assessmentConfig, modules, assignments } = useAppContext();
  const isA = item.stage === 'A';
  const options = gradableVersions(item);
  const [submissionId, setSubmissionId] = useState(item.review?.submissionId && options.some(o => o.id === item.review!.submissionId)
    ? item.review.submissionId : options.at(-1)?.id ?? '');
  // Episode B/Pod: criterion -> score. Episode A: grading line id -> score.
  const [scores, setScores] = useState<Record<string, AssessmentScore | undefined>>(
    isA ? Object.fromEntries(item.lineReviews.map(r => [r.target, r.scores.exercise])) : { ...(item.review?.scores ?? {}) },
  );
  const [feedback, setFeedback] = useState(item.review?.feedback ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const keys: string[] = isA ? item.lines.map(l => l.id) : allowedScoreKeys(item.stage, item.slot, assessmentConfig);
  const criteria = stageCriteria(assessmentConfig, item.stage);
  // Score names ("Merit (60+)") from the assignment (Episode A) or stage.
  const bands = isA ? assignments.find(a => a.id === item.lines[0]?.assignmentId)?.bands : assessmentConfig.bands?.[cellGroup(item.stage)];
  const outcomeOf = (k: string) => (isA ? item.lines.find(x => x.id === k) : criteria.find(c => c.id === k))?.outcome;
  const cells = stageCells(assessmentConfig, item.stage);
  const complete = keys.every(k => scores[k]);
  const selected = item.versions.find(v => v.id === submissionId);
  const laterRevisions = gradesFirstComplete(item.stage) ? item.versions.filter(v => v.version > (options[0]?.version ?? Infinity)) : [];
  const locked = item.published;

  // The admin's description of score n for this criterion.
  const levelText = (k: string, n: number) => (isA ? item.lines.find(x => x.id === k) : criteria.find(c => c.id === k))?.levels?.[n - 1];
  const keyLabel = (k: string) => {
    if (isA) {
      const l = item.lines.find(x => x.id === k);
      return `${l?.title ?? 'Criterion'} (${l?.weight ?? 0}% of this assignment)`;
    }
    const w = cells.find(c => c.slot === item.slot && c.criterion === k)?.weight;
    return `${criteria.find(c => c.id === k)?.title ?? k} (${w}%)`;
  };

  const save = async (status: AssessmentReview['status']) => {
    setBusy(true);
    setError('');
    try {
      if (isA) {
        // One review per grading line, all against the same submission.
        await Promise.all(item.lines.map(l => saveReview(item.traineeId, 'A', l.id, item.slot, submissionId,
          scores[l.id] ? { exercise: scores[l.id] } : {}, status, feedback)));
      } else {
        await saveReview(item.traineeId, item.stage, item.target, item.slot, submissionId,
          Object.fromEntries(keys.flatMap(k => (scores[k] ? [[k, scores[k]]] : []))) as AssessmentReview['scores'], status, feedback);
      }
      if (status === 'submitted') onDone();
    } catch (err) {
      console.error(err);
      setError('Could not save - this stage may have been published, or your assignment changed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 pt-4 border-t space-y-4">
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">
          {gradesFirstComplete(item.stage) ? 'Graded version (first complete submission)' : 'Version to grade'}
        </p>
        {gradesFirstComplete(item.stage) ? (
          <p className="text-sm font-bold text-gray-700">v{options[0]?.version}</p>
        ) : (
          <select value={submissionId} onChange={e => setSubmissionId(e.target.value)} disabled={locked} className={`${input} w-auto`}>
            {options.map(v => <option key={v.id} value={v.id}>v{v.version} · {new Date(v.submittedAt).toLocaleDateString()}</option>)}
          </select>
        )}
        {selected && (
          <ul className="flex flex-wrap gap-x-4 mt-2">
            {selected.links.map((l, i) => <li key={i}><a href={l.url} target="_blank" rel="noreferrer" className="text-xs font-bold text-[#2E9DF7] underline">{l.label}</a></li>)}
          </ul>
        )}
        {selected?.note && <p className="text-xs text-gray-500 mt-1 whitespace-pre-wrap">Trainee note: {selected.note}</p>}
        {laterRevisions.length > 0 && (
          <p className="text-[11px] text-gray-400 mt-2">
            Later revisions (kept, not graded): {laterRevisions.map(v => (
              <a key={v.id} href={v.links[0]?.url} target="_blank" rel="noreferrer" className="underline mr-2">v{v.version}</a>
            ))}
          </p>
        )}
      </div>

      <div className="space-y-3">
        {keys.map(k => (
          <div key={k}>
            <p className="text-xs font-bold text-gray-700">{keyLabel(k)}</p>
            {outcomeOf(k) && <p className="text-[11px] text-gray-500 whitespace-pre-wrap">{outcomeOf(k)}</p>}
            <div className="mb-1.5" />
            <div className={[1, 2, 3, 4, 5].some(n => levelText(k, n)) ? 'grid gap-1.5 sm:grid-cols-5 text-left' : 'flex flex-wrap gap-1.5'} role="radiogroup" aria-label={keyLabel(k)}>
              {([1, 2, 3, 4, 5] as AssessmentScore[]).map(n => (
                <button key={n} type="button" role="radio" aria-checked={scores[k] === n} disabled={locked}
                  onClick={() => setScores(s => ({ ...s, [k]: n }))}
                  className={`px-3 py-2 rounded-xl text-xs font-black text-left transition-colors ${
                    scores[k] === n ? 'bg-[#2E9DF7] text-white shadow-md' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}>
                  {bands?.some(b => b.trim()) ? `${n} · ${bandLabel(bands, n)}` : n}
                  {levelText(k, n) && <span className="block text-[10px] font-medium leading-snug mt-0.5 whitespace-pre-wrap">{levelText(k, n)}</span>}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <textarea value={feedback} onChange={e => setFeedback(e.target.value)} disabled={locked}
        placeholder="Feedback for the trainee (shown once results are published)" className={`${input} h-24`} />

      {locked ? (
        <p className="text-xs font-bold text-gray-400">This stage has been published - scores are locked.</p>
      ) : (
        <div className="flex flex-wrap gap-2 items-center">
          <button onClick={() => save('submitted')} disabled={busy || !complete || !submissionId} className={primaryBtn}>Submit review</button>
          <button onClick={() => save('draft')} disabled={busy || !submissionId} className={secondaryBtn}>Save draft</button>
          {!complete && <span className="text-[11px] text-gray-400">Score every criterion to submit.</span>}
          {error && <span className="text-xs font-bold text-ember">{error}</span>}
        </div>
      )}
    </div>
  );
};

export const ReviewerQueue: React.FC = () => {
  const items = useQueue();
  const [filter, setFilter] = useState<'todo' | 'all'>('todo');
  const [open, setOpen] = useState<string | null>(null);
  const visible = filter === 'todo' ? items.filter(i => i.status === 'needs-review' || i.status === 'draft') : items;
  const todoCount = items.filter(i => i.status === 'needs-review' || i.status === 'draft').length;

  return (
    <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-page">
      <header className="min-h-20 bg-surface border-b flex items-center justify-between flex-wrap gap-4 px-4 md:px-10 py-3 flex-shrink-0">
        <div>
          <h2 className="text-lg md:text-2xl font-black text-[#2E9DF7]">Review Queue</h2>
          <p className="text-xs text-gray-400 font-medium">Only work you're assigned to review · scores 1–5 · editable until published</p>
        </div>
        <div className="flex gap-2">
          {(['todo', 'all'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-5 py-2 rounded-full font-bold text-sm transition-all ${
              filter === f ? 'bg-[#2E9DF7] text-white shadow-md' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>
              {f === 'todo' ? `To review (${todoCount})` : `All (${items.length})`}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 p-4 md:p-6 lg:p-10 overflow-y-auto">
        <div className="max-w-4xl mx-auto space-y-4">
          {items.length === 0 && <p className={`${card} text-sm font-bold text-gray-500 text-center`}>You haven't been assigned to review any trainees yet.</p>}
          {items.length > 0 && visible.length === 0 && <p className={`${card} text-sm font-bold text-gray-500 text-center`}>You're all caught up 🎧</p>}
          {visible.map(item => (
            <article key={item.key} className={card}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                    {STAGE_LABELS[item.stage]} · as {REVIEWER_SLOTS.find(s => s.id === item.slot)?.label}
                  </p>
                  <h3 className="font-black text-gray-800">{item.traineeName}</h3>
                  <p className="text-xs font-bold text-gray-500 truncate">{item.targetTitle}{item.versions.length ? ` · ${item.versions.length} version${item.versions.length === 1 ? '' : 's'}` : ''}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${STATUS_STYLES[item.status]}`}>{STATUS_LABELS[item.status]}</span>
                  {!item.status.startsWith('awaiting') && (
                    <button onClick={() => setOpen(o => (o === item.key ? null : item.key))} className={secondaryBtn}>
                      {open === item.key ? 'Close' : item.status === 'locked' || item.status === 'done' ? 'View' : 'Review'}
                    </button>
                  )}
                </div>
              </div>
              {open === item.key && <ReviewPanel item={item} onDone={() => setOpen(null)} />}
            </article>
          ))}
        </div>
      </div>
    </main>
  );
};
