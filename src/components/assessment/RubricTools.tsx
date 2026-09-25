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
export const RubricPaste: React.FC<{ onApply: (r: PastedRubric) => void }> = ({ onApply }) => {
  const [open, setOpen] = useState(false);
  const [found, setFound] = useState<PastedRubric | null>(null);
  const [failed, setFailed] = useState(false);
  const read = (rows: string[][]) => { const r = parseRubricRows(rows); setFound(r); setFailed(!r); };
  const close = () => { setOpen(false); setFound(null); setFailed(false); };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1.5 text-xs font-bold text-[#2E9DF7] hover:underline">
        <ClipboardPaste className="w-4 h-4" strokeWidth={2.5} aria-hidden="true" />Paste table
      </button>
    );
  }
  return (
    <div className="bg-sky/60 rounded-2xl p-3 space-y-2">
      <p className="text-xs text-navy">
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
      {failed && <p className="text-xs font-bold text-ember">Couldn't find a table with a criterion and five score columns - check the columns and paste again.</p>}
      {found && (
        <div className="text-xs text-navy space-y-1">
          <p><b>{found.criteria.length} criteria:</b> {found.criteria.map(c => `${c.title}${c.weight !== undefined ? ` (${c.weight}%)` : ''}`).join(' · ')}</p>
          {found.bands && <p><b>Scores:</b> {found.bands.map((b, i) => `${i + 1} ${b}`).join(' · ')}</p>}
          <p className="text-gray-500">This replaces the criteria below (existing ones are updated in order, so scores already given stay attached).</p>
        </div>
      )}
      <div className="flex gap-2">
        <button type="button" disabled={!found} onClick={() => { if (found) onApply(found); close(); }} className={primaryBtn}>Use this table</button>
        <button type="button" onClick={close} className={secondaryBtn}>Cancel</button>
      </div>
    </div>
  );
};
