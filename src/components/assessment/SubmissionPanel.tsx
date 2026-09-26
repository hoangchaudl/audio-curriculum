import React, { useState } from 'react';
import { useAppContext } from '../../store';
import { AssessmentStage } from '../../types';
import { stageSubmissions } from '../../assessment/scoring';
import { gradesFirstComplete } from '../../assessment/config';
import { input, isHttpUrl, primaryBtn, secondaryBtn } from './ui';
import { ConfirmModal } from '../ConfirmModal';

// A trainee's submission history for one exercise/episode, plus a form to
// add a new revision. History is append-only: nothing here edits or
// removes an earlier version.
export const SubmissionPanel: React.FC<{
  stage: AssessmentStage;
  target: string;
  // Episode B / Pod: the trainee marks which version is complete.
  askComplete?: boolean;
  // Version the grade applies to (only known once results are published).
  gradedSubmissionId?: string;
  disabledReason?: string;
}> = ({ stage, target, askComplete, gradedSubmissionId, disabledReason }) => {
  const { currentUser, assessmentSubmissions, submitAssessmentVersion } = useAppContext();
  // Released at a checkpoint: history stays visible, submitting is closed.
  if (currentUser?.status === 'released') disabledReason = 'Your place in the program has ended, so submissions are closed. Your earlier versions and results stay here.';
  const [links, setLinks] = useState([{ label: 'Session', url: '' }]);
  const [note, setNote] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const versions = stageSubmissions(assessmentSubmissions.filter(s => s.traineeId === currentUser?.id), stage, target);
  const filled = links.filter(l => l.url.trim());
  const invalid = filled.some(l => !isHttpUrl(l.url));
  const firstComplete = versions.find(v => v.isComplete);
  // Episode B / Audio Description are graded on the first complete version
  // only, so marking one complete is final - confirm it first.
  const [confirmComplete, setConfirmComplete] = useState(false);
  const needsConfirm = askComplete && isComplete && gradesFirstComplete(stage) && !firstComplete;
  const alreadyGraded = askComplete && gradesFirstComplete(stage) && !!firstComplete;

  const submit = async () => {
    if (!filled.length || invalid) return;
    setBusy(true);
    setMessage(null);
    try {
      await submitAssessmentVersion(stage, target, filled.map(l => ({ label: l.label.trim() || 'Link', url: l.url.trim() })), askComplete ? isComplete : true, note);
      setLinks([{ label: 'Session', url: '' }]);
      setNote('');
      setIsComplete(false);
      setMessage({ kind: 'ok', text: `Version ${Math.max(0, ...versions.map(v => v.version)) + 1} submitted. Earlier versions are kept.` });
    } catch (err) {
      console.error(err);
      setMessage({ kind: 'error', text: 'Could not submit. Check your connection and try again.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {versions.length > 0 && (
        <ol className="space-y-2">
          {[...versions].reverse().map(v => (
            <li key={v.id} className="bg-gray-50 rounded-2xl p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="font-black text-gray-800">v{v.version}</span>
                <span className="text-xs text-gray-400 font-bold">{new Date(v.submittedAt).toLocaleString()}</span>
                {askComplete && v.isComplete && <span className="bg-[#3DDC97]/20 text-leaf px-2 py-0.5 rounded-full text-[10px] font-black uppercase">Complete</span>}
                {askComplete && gradesFirstComplete(stage) && v.id === firstComplete?.id && (
                  <span className="bg-sky text-navy px-2 py-0.5 rounded-full text-[10px] font-black uppercase">Graded version</span>
                )}
                {v.id === gradedSubmissionId && !gradesFirstComplete(stage) && (
                  <span className="bg-sky text-navy px-2 py-0.5 rounded-full text-[10px] font-black uppercase">Graded version</span>
                )}
              </div>
              <ul className="flex flex-wrap gap-x-4 gap-y-1">
                {v.links.map((l, i) => (
                  <li key={i}><a href={l.url} target="_blank" rel="noreferrer" className="text-xs font-bold text-[#2E9DF7] underline break-all">{l.label}</a></li>
                ))}
              </ul>
              {v.note && <p className="text-xs text-gray-500 mt-1 whitespace-pre-wrap">{v.note}</p>}
            </li>
          ))}
        </ol>
      )}

      {disabledReason ? (
        <p className="text-xs font-bold text-gray-400 bg-gray-50 rounded-2xl p-3">{disabledReason}</p>
      ) : (
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">
            {versions.length ? `Submit revision v${Math.max(...versions.map(v => v.version)) + 1}` : 'Submit your work'}
          </p>
          {links.map((l, i) => (
            <div key={i} className="grid grid-cols-[7rem_1fr_auto] gap-2">
              <input value={l.label} maxLength={100} onChange={e => setLinks(ls => ls.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} aria-label="Link label" className={input} />
              <input value={l.url} maxLength={2000} onChange={e => setLinks(ls => ls.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
                placeholder="https://drive.google.com/... or https://f.io/..." aria-label="Link URL"
                className={`${input} ${l.url && !isHttpUrl(l.url) ? 'ring-2 ring-[#F4511E]' : ''}`} />
              {links.length > 1 ? (
                <button type="button" onClick={() => setLinks(ls => ls.filter((_, j) => j !== i))} className="text-gray-400 hover:text-ember font-bold px-2" aria-label="Remove link">✕</button>
              ) : <span />}
            </div>
          ))}
          {invalid && <p className="text-[10px] font-bold text-ember">Links must start with http:// or https://</p>}
          <div className="flex flex-wrap gap-2">
            {links.length < 10 && <button type="button" onClick={() => setLinks(ls => [...ls, { label: 'Review', url: '' }])} className={secondaryBtn}>+ Another link</button>}
          </div>
          <textarea value={note} maxLength={5000} onChange={e => setNote(e.target.value)} placeholder="Notes for your reviewer (optional)" className={`${input} h-16`} />
          {askComplete && (
            <label className="flex items-start gap-2 text-xs font-bold text-gray-600">
              <input type="checkbox" checked={isComplete} onChange={e => setIsComplete(e.target.checked)} className="mt-0.5" />
              <span>
                This is my complete submission.
                {gradesFirstComplete(stage) && <span className="block font-medium text-gray-400">This stage is graded on your first complete submission; later revisions are kept separately.</span>}
              </span>
            </label>
          )}
          {alreadyGraded && (
            <p className="text-[11px] font-bold text-gray-500 bg-gray-50 rounded-xl px-3 py-2">
              You already submitted a complete version (v{firstComplete!.version}) - that's the one that's graded. New revisions are kept but won't change your score.
            </p>
          )}
          <button onClick={() => (needsConfirm ? setConfirmComplete(true) : submit())} disabled={busy || !filled.length || invalid} className={primaryBtn}>
            {busy ? 'Submitting…' : versions.length ? 'Submit new revision' : 'Submit'}
          </button>
          {message && <p className={`text-xs font-bold ${message.kind === 'ok' ? 'text-leaf' : 'text-ember'}`}>{message.text}</p>}
        </div>
      )}
      <ConfirmModal
        open={confirmComplete}
        title="Submit this as your complete version?"
        message="This stage is graded on your first complete submission only. You can still add revisions afterwards, but they won't change your score. Make sure everything is finished and exported before you submit."
        confirmLabel="Yes, it's complete"
        onConfirm={() => { setConfirmComplete(false); submit(); }}
        onCancel={() => setConfirmComplete(false)}
      />
    </div>
  );
};
