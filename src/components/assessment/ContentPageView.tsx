import React, { useEffect, useRef } from 'react';
import { useAppContext } from '../../store';
import { ContentBlocks } from './ContentBlocks';
import { Md, card, sectionTitle } from './ui';

// A module shown as a content item in the week-by-week program: reading
// material only (text, content blocks, optional video, objectives,
// materials). Submitting happens on the week's assignment pages.
export const ContentPageView: React.FC<{ moduleId: string }> = ({ moduleId }) => {
  const { modules, moduleVideos, programOutline, enrollments, currentUser, videoProgress, markVideoWatched, unmarkVideoWatched } = useAppContext();
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { scrollRef.current?.scrollTo(0, 0); }, [moduleId]);

  const mod = modules.find(m => m.id === moduleId);
  if (!mod) return <div className="p-10">Content not found</div>;

  const weekIndex = programOutline?.weeks.findIndex(w => w.items.some(i => i.kind === 'content' && i.moduleId === moduleId)) ?? -1;
  const video = moduleVideos.find(v => v.moduleId === mod.id && v.url && v.url !== '#');
  const startDate = enrollments.find(e => e.id === currentUser?.id)?.startDate;
  const done = videoProgress.some(v => v.moduleId === mod.id && v.userId === currentUser?.id);
  const list = (title: string, items?: string[]) => items?.length ? (
    <div>
      <h4 className="text-xs font-bold text-gray-500 uppercase mb-2 tracking-widest">{title}</h4>
      <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
    </div>
  ) : null;

  return (
    <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-page">
      <header className="min-h-20 bg-surface border-b flex items-center justify-between gap-4 px-4 md:px-10 py-3 flex-shrink-0">
        <div className="min-w-0">
          <h2 className="text-lg md:text-2xl font-black text-[#2E9DF7] truncate">{mod.title}</h2>
          {weekIndex >= 0 && <p className="text-xs text-gray-400 font-medium mt-1">{programOutline!.weeks[weekIndex].title} · content</p>}
        </div>
        <button
          onClick={() => (done ? unmarkVideoWatched(mod.id) : markVideoWatched(mod.id))}
          aria-pressed={done}
          className={`flex-shrink-0 text-xs font-black uppercase tracking-wide px-4 py-2 rounded-full transition-colors ${
            done ? 'bg-[#3DDC97] text-[#0B3D2A] hover:bg-[#3DDC97]/80' : 'bg-gray-100 text-gray-600 hover:bg-[#3DDC97]/20 hover:text-leaf'
          }`}
        >
          {done ? '✓ Done' : 'Mark as done'}
        </button>
      </header>
      <div ref={scrollRef} className="flex-1 p-4 md:p-6 lg:p-10 overflow-y-auto">
        <div className="max-w-4xl mx-auto space-y-6">
          {video && <ContentBlocks blocks={[{ id: 'module-video', type: 'video', url: video.url, title: video.title, start: video.start, end: video.end }]} />}
          {mod.description && <div className={card}><Md>{mod.description}</Md></div>}
          <ContentBlocks blocks={mod.contentBlocks} startDate={startDate} />
          {(mod.objectives?.length || mod.outcomes?.length) ? (
            <div className={`${card} grid md:grid-cols-2 gap-6`}>
              {list('Objectives', mod.objectives)}
              {list('Learning outcomes', mod.outcomes)}
            </div>
          ) : null}
          {mod.additionalMaterials?.length ? (
            <div className={card}>
              <h4 className={`${sectionTitle} mb-3`}>Materials</h4>
              <ul className="space-y-2">
                {mod.additionalMaterials.map((m, i) => (
                  <li key={i} className="bg-gray-50 rounded-2xl p-3 text-sm font-bold text-gray-800">
                    {m.url ? <a href={m.url} target="_blank" rel="noreferrer" className="underline hover:text-[#2E9DF7]">{m.title}</a> : m.title}
                    {m.author && <span className="block text-xs font-medium text-gray-500">By {m.author}</span>}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
};
