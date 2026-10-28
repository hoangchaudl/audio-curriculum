import React from 'react';
import { useAppContext } from '../../store';
import { Assignment } from '../../types';
import { assignmentDueLabel, assignmentWeek } from '../../assessment/outline';
import { Md, RubricLangToggle, card, useRubricLang } from './ui';

// Header shared by every assignment page: week, due date, instructions and
// materials links.
export const AssignmentIntro: React.FC<{ assignment: Assignment; startDate?: string }> = ({ assignment, startDate }) => {
  const { programOutline } = useAppContext();
  const week = assignmentWeek(programOutline, assignment.id);
  const due = assignmentDueLabel(assignment, startDate, week);
  const [lang, setLang] = useRubricLang();
  const hasVi = !!assignment.instructionsVi?.trim();
  const instructions = hasVi && (lang === 'vi' || !assignment.instructions?.trim()) ? assignment.instructionsVi : assignment.instructions;
  return (
    <div className={`${card} space-y-4`}>
      <div className="flex flex-wrap gap-2">
        {week && <span className="bg-sky text-navy px-3 py-1 rounded-full text-[10px] font-black uppercase">Week {week}</span>}
        {due && <span className="bg-[#F4511E]/15 text-ember px-3 py-1 rounded-full text-[10px] font-black uppercase">{due}</span>}
        {assignment.hours ? <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-[10px] font-black uppercase">⏱ Takes about {assignment.hours} h</span> : null}
      </div>
      {hasVi && assignment.instructions?.trim() && <RubricLangToggle lang={lang} onChange={setLang} />}
      {instructions && <Md>{instructions}</Md>}
      {assignment.materials.length > 0 && (
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Materials</p>
          <ul className="flex flex-wrap gap-2">
            {assignment.materials.map((m, i) => (
              <li key={i}>
                <a href={m.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 bg-sky text-navy font-bold text-xs px-3 py-2 rounded-xl hover:bg-[#2E9DF7] hover:text-white transition-colors">
                  📁 {m.label || 'Materials'}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
