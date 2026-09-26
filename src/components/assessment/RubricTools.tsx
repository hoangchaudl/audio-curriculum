import React, { useState } from 'react';
import { ClipboardPaste } from 'lucide-react';
import { PastedRubric, htmlTableRows, parseRubricRows, tsvRows } from '../../assessment/rubricPaste';
import { input, primaryBtn, secondaryBtn } from './ui';

// Names for scores 1-5 (e.g. "Fail (<50)" … "Distinction (70+)"). Blank =
// "Score n". Saved when a box loses focus.
export const BandInputs: React.FC<{ bands?: string[]; onSave: (bands: string[]) => void }> = ({ bands, onSave }) => (
  <div>
    <p className="text-[10px] font-black uppercase text-gray-500 mb-1">Score names (optional) - e.g. Fail, Low Pass, High Pass, Merit, Distinction</p>
    <div className="grid gap-2 grid-cols-2 sm:grid-cols-5">
      {[1, 2, 3, 4, 5].map(n => (
        <input key={`${n}:${bands?.[n - 1] ?? ''}`} defaultValue={bands?.[n - 1] ?? ''} placeholder={`Score ${n}`} aria-label={`Name for score ${n}`}
          onBlur={e => { if (e.target.value.trim() !== (bands?.[n - 1] ?? '')) onSave([1, 2, 3, 4, 5].map(k => (k === n ? e.target.value : bands?.[k - 1] ?? '').trim())); }}
          className={`${input} bg-surface text-xs`} />
      ))}
    </div>
  </div>
);

// "Paste table": paste a rubric copied from Word, Google Docs/Sheets or a
// web page; shows what was found before replacing the criteria.
// With `vietnamese` (the number of criteria): paste the Vietnamese version
// of the same table - same rows, same order - which only adds text for
// trainees who switch the rubric to VI.
export const RubricPaste: React.FC<{ onApply: (r: PastedRubric) => void; vietnamese?: number }> = ({ onApply, vietnamese }) => {
  const [open, setOpen] = useState(false);
  const [found, setFound] = useState<PastedRubric | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const read = (rows: string[][]) => {
    const r = parseRubricRows(rows);
    const wrongCount = r && vietnamese !== undefined && r.criteria.length !== vietnamese;
    setFound(r && !wrongCount ? r : null);
    setFailed(!r ? "Couldn't find a table with a criterion and five score columns - check the columns and paste again."
      : wrongCount ? `Found ${r.criteria.length} rows, but this rubric has ${vietnamese} criteria - paste the same table, in the same order.` : null);
  };
  const close = () => { setOpen(false); setFound(null); setFailed(null); };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1.5 text-xs font-bold text-[#2E9DF7] hover:underline">
        <ClipboardPaste className="w-4 h-4" strokeWidth={2.5} aria-hidden="true" />{vietnamese !== undefined ? 'Paste Vietnamese table (VI)' : 'Paste table'}
      </button>
    );
  }
  return (
    <div className="bg-sky/60 rounded-2xl p-3 space-y-2">
      <p className="text-xs text-navy">
        {vietnamese !== undefined ? <><b>Vietnamese version:</b> paste the same rubric table translated - same rows, same order. Only the text is used (criterion, what it assesses, the five descriptions and score names); weights and scores stay as they are. Trainees can then switch the rubric between EN and VI. </> : null}
        Copy your rubric table (from Word, Google Docs/Sheets or a web page) and paste it below. Columns: <b>criterion</b>, optionally <b>what it assesses / ILO</b> and <b>weighting</b>, then the <b>five score descriptions</b> (lowest first). A header row names the scores.
      </p>
      <textarea autoFocus placeholder="Paste here (Ctrl/⌘ + V)" aria-label="Paste rubric table" className={`${input} bg-surface h-20 text-xs`}
        onPaste={e => {
          e.preventDefault();
          const html = e.clipboardData.getData('text/html');
          const rows = html ? htmlTableRows(html) : [];
          read(rows.length ? rows : tsvRows(e.clipboardData.getData('text/plain')));
        }}
        onChange={e => read(tsvRows(e.target.value))} />
      {failed && <p className="text-xs font-bold text-ember">{failed}</p>}
      {found && (
        <div className="text-xs text-navy space-y-1">
          <p><b>{found.criteria.length} criteria:</b> {found.criteria.map(c => `${c.title}${c.weight !== undefined ? ` (${c.weight}%)` : ''}`).join(' · ')}</p>
          {found.bands && <p><b>Scores:</b> {found.bands.map((b, i) => `${i + 1} ${b}`).join(' · ')}</p>}
          <p className="text-gray-500">{vietnamese !== undefined
            ? 'This adds the Vietnamese text to the criteria below, in order (replacing any earlier Vietnamese version).'
            : 'This replaces the criteria below (existing ones are updated in order, so scores already given stay attached).'}</p>
        </div>
      )}
      <div className="flex gap-2">
        <button type="button" disabled={!found} onClick={() => { if (found) onApply(found); close(); }} className={primaryBtn}>Use this table</button>
        <button type="button" onClick={close} className={secondaryBtn}>Cancel</button>
      </div>
    </div>
  );
};

// How much of a rubric has a Vietnamese version, with a way to remove it.
export const VietnameseStatus: React.FC<{ done: number; total: number; onRemove: () => void }> = ({ done, total, onRemove }) =>
  done === 0 ? null : (
    <p className="text-xs font-bold text-leaf flex flex-wrap items-center gap-2">
      VI: Vietnamese added for {done} of {total} criteria{done < total ? ' (the rest show in English)' : ''}
      <button type="button" onClick={onRemove} className="text-gray-500 hover:text-ember underline">Remove Vietnamese</button>
    </p>
  );
