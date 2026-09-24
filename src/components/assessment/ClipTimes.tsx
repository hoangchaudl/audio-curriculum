import React, { useState } from 'react';
import { clipLabel, clipProblem, formatClipTime, parseClipTime } from '../../videoClip';

// "Only play part of this video" - start/end typed as 12:30. Leave both
// blank for the whole video. Reports seconds (or undefined) on blur.
export const ClipTimes: React.FC<{ start?: number; end?: number; onChange: (start?: number, end?: number) => void }> = ({ start, end, onChange }) => {
  const [from, setFrom] = useState(formatClipTime(start));
  const [to, setTo] = useState(formatClipTime(end));
  const s = parseClipTime(from), e = parseClipTime(to);
  const problem = clipProblem(s, e);
  const commit = () => { if (!problem) onChange(s, e); };
  const box = 'w-24 bg-gray-50 rounded-xl p-2 text-sm font-bold focus:ring-2 focus:ring-[#2E9DF7]';
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-gray-500">
      <span>YouTube only - play just part of it:</span>
      <input value={from} onChange={ev => setFrom(ev.target.value)} onBlur={commit} placeholder="Start 12:30" aria-label="Clip start" className={box} />
      <span>to</span>
      <input value={to} onChange={ev => setTo(ev.target.value)} onBlur={commit} placeholder="End 18:00" aria-label="Clip end" className={box} />
      {problem ? <span className="text-ember">{problem}</span>
        : clipLabel(s, e) ? <span className="text-leaf">✓ {clipLabel(s, e)}</span>
        : <span className="text-gray-400">Blank = whole video</span>}
    </div>
  );
};
