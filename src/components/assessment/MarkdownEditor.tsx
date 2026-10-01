import React, { useRef, useState } from 'react';
import { Md, TEXT_COLORS, input } from './ui';

type Edit = (sel: string) => { text: string; cursor?: number };

const wrap = (before: string, after = before, fallback = 'text'): Edit => sel => ({ text: `${before}${sel || fallback}${after}` });
// Prefix every selected line (or the current empty spot) with a marker.
const lines = (prefix: (i: number) => string): Edit => sel => ({
  text: (sel || '').split('\n').map((l, i) => `${prefix(i)}${l}`).join('\n'),
});

// Markdown textarea with a formatting toolbar and preview. Colors use the
// `[text](#color-red)` link form that Md renders as colored text.
export const MarkdownEditor: React.FC<{ value: string; onChange: (v: string) => void; placeholder?: string }> = ({ value, onChange, placeholder }) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);

  const apply = (edit: Edit, block = false) => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    let { text } = edit(value.slice(s, e));
    // Block formats (headings, lists, quotes) must start on their own line.
    if (block && s > 0 && value[s - 1] !== '\n') text = `\n${text}`;
    onChange(value.slice(0, s) + text + value.slice(e));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + text.length, s + text.length); });
  };

  const btn = 'px-2 py-1 rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-100 hover:text-[#2E9DF7]';
  const tools: [string, string, () => void, string?][] = [
    ['B', 'Bold', () => apply(wrap('**')), 'font-black'],
    ['I', 'Italic', () => apply(wrap('*')), 'italic'],
    ['H2', 'Heading', () => apply(lines(() => '## '), true)],
    ['H3', 'Subheading', () => apply(lines(() => '### '), true)],
    ['• List', 'Bulleted list', () => apply(lines(() => '- '), true)],
    ['1. List', 'Numbered list', () => apply(lines(i => `${i + 1}. `), true)],
    ['❝ Callout', 'Callout box', () => apply(lines(() => '> '), true)],
    ['— Divider', 'Section divider', () => apply(() => ({ text: '\n---\n' }), true)],
    ['🔗 Link', 'Link', () => apply(sel => ({ text: `[${sel || 'link text'}](https://)` }))],
  ];

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-0.5 bg-gray-50 rounded-xl p-1">
        {tools.map(([label, title, run, cls]) => (
          <button key={title} type="button" title={title} aria-label={title} onClick={run} disabled={preview} className={`${btn} ${cls ?? ''} disabled:opacity-30`}>{label}</button>
        ))}
        <span className="mx-1 h-4 w-px bg-gray-200" aria-hidden="true" />
        {Object.entries(TEXT_COLORS).map(([name, cls]) => (
          <button key={name} type="button" title={`${name} text`} aria-label={`${name} text`} disabled={preview}
            onClick={() => apply(sel => ({ text: `[${sel || 'text'}](#color-${name})` }))}
            className={`${btn} ${cls} disabled:opacity-30`}>A</button>
        ))}
        <button type="button" onClick={() => setPreview(p => !p)} aria-pressed={preview}
          className={`ml-auto ${btn} ${preview ? 'bg-[#2E9DF7] text-white hover:bg-[#2E9DF7] hover:text-white' : ''}`}>
          {preview ? 'Edit' : 'Preview'}
        </button>
      </div>
      {preview
        ? <div className="border border-gray-100 rounded-xl p-4 min-h-32">{value.trim() ? <Md>{value}</Md> : <p className="text-xs text-gray-400">Nothing to preview yet.</p>}</div>
        : <textarea ref={ref} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={`${input} h-48 font-mono text-xs`} />}
    </div>
  );
};
