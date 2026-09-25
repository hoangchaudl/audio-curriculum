import React, { useState } from 'react';
import { BookOpen, Check, FileText, Flag, Target } from 'lucide-react';
import { useAppContext } from '../../store';
import { PlanItem, programDay, weekPlan } from '../../assessment/outline';
import { card, sectionTitle } from './ui';

const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const go = (hash: string) => { if (hash) window.location.hash = hash; };

// The trainee's day-by-day plan for one week (their current week by
// default): lessons on the day they're planned, assignments on their due
// day, today highlighted. Lessons without a planned day sit under "Any day".
export const WeekPlan: React.FC<{ traineeId: string | undefined }> = ({ traineeId }) => {
  const { programOutline, assignments, modules, enrollments, videoProgress, assessmentSubmissions } = useAppContext();
  const enrollment = enrollments.find(e => e.id === traineeId);
  const weeks = programOutline?.weeks.length ?? 0;
  const current = Math.min(Math.max(programDay(enrollment?.startDate).week, 1), Math.max(weeks, 1)) - 1;
  const [weekIndex, setWeekIndex] = useState(current);
  if (!programOutline || !weeks) return null;
  const { days, anyDay } = weekPlan(programOutline, assignments, modules, enrollment, traineeId, videoProgress,
    assessmentSubmissions.filter(s => s.traineeId === traineeId), weekIndex);
  const week = programOutline.weeks[weekIndex];
  const hours = [...days.flatMap(d => d.items), ...anyDay].reduce((t, i) => t + (i.hours ?? 0), 0);

  const chip = (it: PlanItem) => {
    const tone = it.kind === 'assignment'
      ? (it.status === 'done' ? 'bg-[#3DDC97]/20 text-leaf' : it.status === 'late' ? 'bg-[#F4511E] text-white' : 'bg-[#F4511E]/10 text-ember border border-[#F4511E]/30')
      : it.kind === 'milestone' ? 'bg-[#3DDC97]/10 text-leaf'
      : it.status === 'done' ? 'bg-gray-50 text-gray-400 line-through decoration-2'
      : it.status === 'late' ? 'bg-[#F4511E]/10 text-ember'
      : 'bg-sky text-navy';
    const Icon = it.status === 'done' && it.kind !== 'milestone' ? Check : it.kind === 'assignment' ? FileText : it.kind === 'milestone' ? Flag : BookOpen;
    return (
      <button key={it.key} onClick={() => go(it.hash)} disabled={!it.hash}
        className={`w-full text-left rounded-xl px-2.5 py-2 text-xs font-bold leading-snug transition-transform enabled:hover:-translate-y-0.5 enabled:hover:shadow-md ${tone}`}>
        <Icon className="inline-block w-3 h-3 -mt-0.5 mr-1" strokeWidth={3} aria-hidden="true" />{it.title}
        {it.hours ? <span className="block text-[10px] font-black opacity-70 no-underline">{it.hours} h</span> : null}
        {it.kind === 'assignment' && it.status !== 'done' && <span className="block text-[10px] font-black opacity-80">{it.status === 'late' ? 'Overdue' : 'Due'}</span>}
      </button>
    );
  };

  return (
    <section className={card}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className={sectionTitle}>{weekIndex === current ? 'This week' : `Week ${weekIndex + 1}`}</h3>
          <p className="text-xs text-gray-400 font-medium">
            Week {weekIndex + 1}{days[0]?.date ? ` · ${days[0].date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${days[days.length - 1].date?.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : ''}
            {hours ? ` · about ${hours} h planned` : ''}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setWeekIndex(i => i - 1)} disabled={weekIndex === 0} aria-label="Previous week" className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 hover:bg-sky hover:text-navy disabled:opacity-30 font-black">‹</button>
          {weekIndex !== current && <button onClick={() => setWeekIndex(current)} className="text-xs font-bold text-[#2E9DF7] px-2 hover:underline">This week</button>}
          <button onClick={() => setWeekIndex(i => i + 1)} disabled={weekIndex === weeks - 1} aria-label="Next week" className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 hover:bg-sky hover:text-navy disabled:opacity-30 font-black">›</button>
        </div>
      </div>
      {week.goal && <p className="text-xs text-gray-600 mb-4"><b><Target className="inline-block w-4 h-4 -mt-0.5 mr-1" strokeWidth={2.5} aria-hidden="true" />Goal:</b> {week.goal}</p>}

      <div className={`grid gap-2 grid-cols-1 ${days.length === 7 ? 'sm:grid-cols-4 lg:grid-cols-7' : days.length === 6 ? 'sm:grid-cols-3 lg:grid-cols-6' : 'sm:grid-cols-5'}`}>
        {days.map(d => (
          <div key={d.day} className={`rounded-2xl p-2.5 space-y-1.5 min-h-24 ${d.isToday ? 'bg-[#2E9DF7]/10 ring-2 ring-[#2E9DF7]' : 'bg-gray-50/60'}`}>
            <p className={`text-[10px] font-black uppercase tracking-wide ${d.isToday ? 'text-[#2E9DF7]' : 'text-gray-400'}`}>
              {d.date ? `${DAY_SHORT[(d.date.getDay() + 6) % 7]} ${d.date.getDate()}` : `Day ${d.day}`}{d.isToday ? ' · Today' : ''}
            </p>
            {d.items.length ? d.items.map(chip) : <p className="text-[11px] text-gray-300 font-bold">—</p>}
          </div>
        ))}
      </div>
      {anyDay.length > 0 && (
        <div className="mt-3">
          <p className="text-[10px] font-black uppercase tracking-wide text-gray-400 mb-1.5">Any day this week</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{anyDay.map(chip)}</div>
        </div>
      )}
    </section>
  );
};
