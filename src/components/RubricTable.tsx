import React from 'react';
import { RubricCriterion } from '../types';

// One table per sub-skill, four descriptor rows (scores 1-4) each.
// Three ways to use it:
//   - plain display (no selected/onSelect): designers reading expectations
//   - highlight (selected, no onSelect): showing an already-given grade
//   - interactive (selected + onSelect): engineer picking a level per
//     sub-skill while grading
export const RubricTable: React.FC<{
  criteria: RubricCriterion[];
  note?: string;
  selected?: Record<string, 1 | 2 | 3 | 4>;
  onSelect?: (criterionId: string, score: 1 | 2 | 3 | 4) => void;
}> = ({ criteria, note, selected, onSelect }) => (
  <div className="space-y-4">
    {note && (
      <p className="text-xs font-bold text-gray-500">{note}</p>
    )}
    {criteria.map((criterion, i) => (
      <div key={criterion.id} className="border-2 border-black rounded-xl overflow-hidden bg-white">
        <div className="bg-[#E0F2FE] px-4 py-2.5 border-b-2 border-black flex items-center justify-between gap-3 flex-wrap">
          <span className="text-xs font-black uppercase tracking-wide text-[#1E40AF]">
            Sub-skill {i + 1}: {criterion.title}
          </span>
          {criterion.scoreLabel && (
            <span className="text-[10px] font-bold text-[#1E40AF]/70">{criterion.scoreLabel}</span>
          )}
        </div>
        <div className="divide-y divide-black/10">
          {criterion.levels.map((descriptor, li) => {
            const level = (li + 1) as 1 | 2 | 3 | 4;
            const isSelected = selected?.[criterion.id] === level;
            const passing = level >= 3;
            const row = (
              <div
                className={`flex items-start gap-3 px-4 py-2.5 text-left w-full transition-colors ${
                  isSelected ? (passing ? 'bg-[#3DDC97]/25' : 'bg-[#F4511E]/15') :
                  onSelect ? 'hover:bg-gray-50' : ''
                }`}
              >
                <span className={`flex-shrink-0 w-6 h-6 rounded-full border-2 border-black flex items-center justify-center text-[10px] font-black mt-0.5 ${
                  isSelected ? (passing ? 'bg-[#3DDC97] text-black' : 'bg-[#F4511E] text-white') : 'bg-gray-100 text-gray-600'
                }`}>
                  {level}
                </span>
                <span className={`text-sm leading-relaxed ${isSelected ? 'text-black font-medium' : 'text-gray-600'}`}>
                  {descriptor}
                </span>
              </div>
            );
            return onSelect ? (
              <button key={li} onClick={() => onSelect(criterion.id, level)} className="block w-full cursor-pointer">
                {row}
              </button>
            ) : (
              <div key={li}>{row}</div>
            );
          })}
        </div>
      </div>
    ))}
  </div>
);
