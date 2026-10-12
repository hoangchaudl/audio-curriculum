import React, { useState } from 'react';
import { QuizQuestion } from '../../types';
import { QUIZ_AI_PROMPT, parseQuizCsv } from '../../assessment/quizCsv';
import { card, input, primaryBtn, secondaryBtn, sectionTitle } from './ui';

const LETTERS = 'ABCD';

// Admin: questions come from a CSV (upload or paste), usually written by an AI.
export const QuizEditor: React.FC<{ questions: QuizQuestion[]; onChange: (questions: QuizQuestion[]) => void }> = ({ questions, onChange }) => {
  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);
  const parsed = text.trim() ? parseQuizCsv(text) : null;
  const apply = (next: QuizQuestion[]) => { onChange(next); setText(''); };
  return (
    <div className="space-y-3">
      <div className="bg-sky rounded-2xl p-3 text-xs text-navy space-y-2">
        <p><b>Quick way:</b> copy the prompt, paste it into ChatGPT / Claude / Gemini with the lesson text after it, then upload or paste the CSV it gives back.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={secondaryBtn}
            onClick={() => navigator.clipboard.writeText(QUIZ_AI_PROMPT).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })}>
            {copied ? '✓ Prompt copied' : 'Copy AI prompt'}
          </button>
          <label className={`${secondaryBtn} cursor-pointer`}>
            Upload CSV
            <input type="file" accept=".csv,.tsv,.txt,text/csv" className="hidden"
              onChange={e => { e.target.files?.[0]?.text().then(setText); e.target.value = ''; }} />
          </label>
        </div>
        <p className="opacity-80">Columns: question, option_a, option_b, option_c, option_d, answer (e.g. B, or A;C), explanation.</p>
      </div>
      <textarea value={text} onChange={e => setText(e.target.value)} placeholder="…or paste the CSV here" aria-label="Quiz CSV" className={`${input} h-24 font-mono text-xs`} />
      {parsed && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-gray-600">
            {parsed.questions.length} question{parsed.questions.length === 1 ? '' : 's'} ready
            {parsed.errors.length > 0 && <span className="text-ember"> · {parsed.errors.length} row{parsed.errors.length === 1 ? '' : 's'} skipped</span>}
          </p>
          {parsed.errors.length > 0 && <ul className="text-xs text-ember list-disc pl-5">{parsed.errors.map(e => <li key={e}>{e}</li>)}</ul>}
          <div className="flex gap-2">
            {questions.length > 0 && <button type="button" disabled={!parsed.questions.length} onClick={() => apply([...questions, ...parsed.questions])} className={secondaryBtn}>Add to the {questions.length} questions</button>}
            <button type="button" disabled={!parsed.questions.length} onClick={() => apply(parsed.questions)} className={primaryBtn}>{questions.length ? 'Replace all questions' : 'Use these questions'}</button>
          </div>
        </div>
      )}
      {questions.length > 0 && (
        <ol className="space-y-2">
          {questions.map((q, i) => (
            <li key={i} className="bg-gray-50 rounded-2xl p-3 text-xs">
              <div className="flex gap-2">
                <p className="flex-1 font-bold text-gray-800">{i + 1}. {q.q}</p>
                <button type="button" onClick={() => onChange(questions.filter((_, j) => j !== i))} className="text-gray-400 hover:text-ember font-bold px-1" aria-label={`Remove question ${i + 1}`}>✕</button>
              </div>
              <ul className="mt-1 space-y-0.5">
                {q.options.map((o, k) => (
                  <li key={k} className={q.correct.includes(k) ? 'text-leaf font-bold' : 'text-gray-600'}>{LETTERS[k]}. {o}{q.correct.includes(k) ? ' ✓' : ''}</li>
                ))}
              </ul>
              {q.explain && <p className="text-gray-500 mt-1 italic">{q.explain}</p>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};

// Trainee: answer, check, see what was right and why. Nothing is saved.
// onChecked: the trainee checked their answers (a quiz page counts as done).
export const QuizView: React.FC<{ title?: string; questions: QuizQuestion[]; onChecked?: () => void }> = ({ title, questions, onChecked }) => {
  const [picked, setPicked] = useState<number[][]>(() => questions.map(() => []));
  const [checked, setChecked] = useState(false);
  const right = (i: number) => {
    const a = [...picked[i]].sort(), c = [...questions[i].correct].sort();
    return a.length === c.length && a.every((x, j) => x === c[j]);
  };
  const score = questions.filter((_, i) => right(i)).length;
  const toggle = (i: number, k: number) => setPicked(p => p.map((sel, j) => {
    if (j !== i) return sel;
    if (questions[i].correct.length === 1) return [k];
    return sel.includes(k) ? sel.filter(x => x !== k) : [...sel, k];
  }));
  if (!questions.length) return null;
  return (
    <div className={card}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h4 className={sectionTitle}>📝 {title || 'Quick check'}</h4>
        {checked && <span className={`text-sm font-black ${score === questions.length ? 'text-leaf' : 'text-navy'}`}>{score} / {questions.length} correct</span>}
      </div>
      <ol className="space-y-5">
        {questions.map((q, i) => {
          const multi = q.correct.length > 1;
          return (
            <li key={i}>
              <p className="font-bold text-gray-800 mb-2">{i + 1}. {q.q}{multi && <span className="text-xs font-bold text-gray-400"> (pick all that apply)</span>}</p>
              <div className="space-y-1.5">
                {q.options.map((o, k) => {
                  const on = picked[i].includes(k);
                  const tone = !checked ? (on ? 'bg-sky text-navy' : 'bg-gray-50 text-gray-700 hover:bg-gray-100')
                    : q.correct.includes(k) ? 'bg-[#3DDC97]/20 text-leaf' : on ? 'bg-rose text-ember' : 'bg-gray-50 text-gray-500';
                  return (
                    <label key={k} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium cursor-pointer ${tone}`}>
                      <input type={multi ? 'checkbox' : 'radio'} name={`q${i}`} checked={on} disabled={checked} onChange={() => toggle(i, k)} />
                      {o}{checked && q.correct.includes(k) ? ' ✓' : ''}
                    </label>
                  );
                })}
              </div>
              {checked && (
                <p className={`text-xs font-bold mt-2 ${right(i) ? 'text-leaf' : 'text-ember'}`}>
                  {right(i) ? 'Correct' : 'Not quite'}{q.explain ? <span className="font-medium text-gray-600"> - {q.explain}</span> : null}
                </p>
              )}
            </li>
          );
        })}
      </ol>
      <div className="mt-5">
        {checked
          ? <button onClick={() => { setChecked(false); setPicked(questions.map(() => [])); }} className={secondaryBtn}>Try again</button>
          : <button onClick={() => { setChecked(true); onChecked?.(); }} disabled={picked.some(p => !p.length)} className={primaryBtn}>Check answers</button>}
      </div>
    </div>
  );
};
