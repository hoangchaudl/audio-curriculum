import React from 'react';
import { useAppContext } from '../../store';
import { Assignment } from '../../types';
import { assignmentWeek, dueLabel } from '../../assessment/outline';
import { Md, card } from './ui';

// Header shared by every assignment page: week, due date, instructions and
// materials links.
export const AssignmentIntro: React.FC<{ assignment: Assignment; startDate?: string }> = ({ assignment, startDate }) => {
  const { programOutline } = useAppContext();
  const week = assignmentWeek(programOutline, assignment.id);
  const due = dueLabel(startDate, week, assignment.dueDay);
  return (
    <div className={`${card} space-y-4`}>
      <div className="flex flex-wrap gap-2">
        {week && <span className="bg-sky text-navy px-3 py-1 rounded-full text-[10px] font-black uppercase">Week {week}</span>}
        {due && <span className="bg-[#F4511E]/15 text-ember px-3 py-1 rounded-full text-[10px] font-black uppercase">Due {due}</span>}
      </div>
      {assignment.instructions && <Md>{assignment.instructions}</Md>}
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
