import React, { useEffect, useRef, useState } from 'react';
import { useAppContext } from '../../store';
import { ContentBlocks } from './ContentBlocks';
import { lessonContext, Step } from '../../assessment/outline';
import { youTubeId } from '../../videoClip';
import { Md, ProgressBar, card, sectionTitle } from './ui';

const go = (hash: string) => { window.location.hash = hash; };
const MATERIAL_ICON: Record<string, string> = { video: '🎥', book: '📖', article: '📄' };

// A lesson in the week-by-week program: video and lesson text on the left;
// where it sits in the week, what it teaches and its materials on the
// right; previous / next at the bottom. Submitting happens on assignment
// pages.
export const ContentPageView: React.FC<{ moduleId: string }> = ({ moduleId }) => {
  const { modules, moduleVideos, programOutline, assignments, enrollments, currentUser, videoProgress, markVideoWatched, unmarkVideoWatched } = useAppContext();
  const scrollRef = useRef<HTMLDivElement>(null);
  // Videos on this page played to the end (clips count at their end time).
  const [finished, setFinished] = useState<string[]>([]);
  useEffect(() => { scrollRef.current?.scrollTo(0, 0); setFinished([]); }, [moduleId]);

  const mod = modules.find(m => m.id === moduleId);
  if (!mod) return <div className="p-10">Lesson not found</div>;

  const enrollment = enrollments.find(e => e.id === currentUser?.id);
  const ctx = lessonContext(programOutline, assignments, modules, enrollment, currentUser?.id, videoProgress, mod.id);
  const video = moduleVideos.find(v => v.moduleId === mod.id && v.url && v.url !== '#');
  const done = videoProgress.some(v => v.moduleId === mod.id && v.userId === currentUser?.id);

  // Watching every YouTube video on the page marks the lesson complete
  // (the button still works for lessons without videos).
  const videoIds = [
    ...(video && youTubeId(video.url) ? ['module-video'] : []),
    ...(mod.contentBlocks ?? []).flatMap(b => (b.type === 'video' && youTubeId(b.url) ? [b.id] : [])),
  ];
  const onVideoEnded = (id: string) => {
    const next = finished.includes(id) ? finished : [...finished, id];
    setFinished(next);
    if (!done && videoIds.every(v => next.includes(v))) markVideoWatched(mod.id);
  };

  const doneButton = (
    <button
      onClick={() => (done ? unmarkVideoWatched(mod.id) : markVideoWatched(mod.id))}
      aria-pressed={done}
      className={`flex-shrink-0 text-xs font-black uppercase tracking-wide px-5 py-2.5 rounded-full transition-colors ${
        done ? 'bg-[#3DDC97] text-[#0B3D2A] hover:bg-[#3DDC97]/80' : 'bg-[#2E9DF7] text-white shadow-[0_4px_0_#1b85df] active:shadow-none active:translate-y-[2px]'
      }`}
    >
      {done ? '✓ Completed' : 'Mark as complete'}
    </button>
  );

  const navCard = (step: Step | null, dir: 'prev' | 'next') => step ? (
    <button onClick={() => go(step.hash)}
      className={`${card} group !p-5 flex-1 min-w-0 text-left transition-all hover:!bg-[#2E9DF7] hover:!border-[#2E9DF7] hover:shadow-lg hover:-translate-y-0.5 focus-visible:ring-4 focus-visible:ring-[#2E9DF7]/40 ${dir === 'next' ? 'sm:text-right' : ''}`}>
      <span className="block text-[10px] font-black uppercase tracking-widest text-gray-400 group-hover:text-white/80">{dir === 'prev' ? '← Previous' : 'Next →'}</span>
      <span className="block text-sm font-black text-gray-800 truncate mt-1 group-hover:text-white">{step.kind === 'assignment' ? '📝 ' : ''}{step.title}</span>
    </button>
  ) : <span className="flex-1 hidden sm:block" />;

  const bulletList = (items: string[], icon: string) => (
    <ul className="space-y-2.5">
      {items.map((x, i) => (
        <li key={i} className="flex gap-2.5 text-sm text-gray-700 leading-snug">
          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-sky text-navy text-[10px] font-black flex items-center justify-center mt-0.5">{icon}</span>
          <span>{x}</span>
        </li>
      ))}
    </ul>
  );

  return (
    <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-page">
      <header className="bg-surface border-b px-4 md:px-10 py-4 flex-shrink-0 flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          {ctx && (
            <p className="text-[11px] font-black uppercase tracking-widest text-[#2E9DF7] truncate">
              Week {ctx.week}{ctx.section ? ` · ${ctx.section}` : ''}
              <span className="text-gray-400"> · Lesson {ctx.lessonNumber} of {ctx.lessonCount}</span>
            </p>
          )}
          <h2 className="text-xl md:text-3xl font-black text-gray-800 mt-1">{mod.title}</h2>
        </div>
        {doneButton}
      </header>

      <div ref={scrollRef} className="flex-1 p-4 md:p-6 lg:p-10 overflow-y-auto">
        <div className="max-w-6xl mx-auto grid gap-6 lg:gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6 min-w-0">
            {video && (
              <ContentBlocks blocks={[{ id: 'module-video', type: 'video', url: video.url, title: video.title, start: video.start, end: video.end }]} onVideoEnded={onVideoEnded} />
            )}
            {mod.description && (
              <section className={card}>
                <h3 className={`${sectionTitle} mb-3`}>About this lesson</h3>
                <div className="text-[15px]"><Md>{mod.description}</Md></div>
              </section>
            )}
            <ContentBlocks blocks={mod.contentBlocks} startDate={enrollment?.startDate} onVideoEnded={onVideoEnded} />
            {!video && !mod.description && !mod.contentBlocks?.length && (
              <section className={`${card} text-center text-sm text-gray-400`}>This lesson's material is on its way - check the materials on the right, or move on to the next item.</section>
            )}
            {ctx && (ctx.prev || ctx.next) && (
              <nav className="flex flex-col sm:flex-row gap-4" aria-label="Lesson navigation">
                {navCard(ctx.prev, 'prev')}
                {navCard(ctx.next, 'next')}
              </nav>
            )}
          </div>

          <aside className="space-y-6 lg:sticky lg:top-0 self-start">
            {ctx && (
              <section className={card}>
                <ProgressBar done={ctx.lessonsDone} total={ctx.lessonCount} label={`Week ${ctx.week} lessons`} />
                <p className="text-xs text-gray-500 mt-3">
                  {done ? '✓ You\'ve completed this lesson.' : videoIds.length ? 'Watch the video to the end to complete this lesson.' : 'Mark this lesson complete when you\'ve finished it.'}
                </p>
              </section>
            )}
            {mod.objectives?.length ? (
              <section className={card}>
                <h3 className={`${sectionTitle} mb-4`}>What you'll learn</h3>
                {bulletList(mod.objectives, '✓')}
              </section>
            ) : null}
            {mod.outcomes?.length ? (
              <section className={card}>
                <h3 className={`${sectionTitle} mb-4`}>By the end, you'll be able to</h3>
                {bulletList(mod.outcomes, '→')}
              </section>
            ) : null}
            {mod.additionalMaterials?.length ? (
              <section className={card}>
                <h3 className={`${sectionTitle} mb-3`}>Materials</h3>
                <ul className="space-y-2">
                  {mod.additionalMaterials.map((m, i) => (
                    <li key={i}>
                      {m.url ? (
                        <a href={m.url} target="_blank" rel="noreferrer" className="flex items-start gap-3 bg-gray-50 hover:bg-gray-100 rounded-2xl p-3 text-sm font-bold text-gray-800">
                          <span aria-hidden="true">{MATERIAL_ICON[m.type] ?? '📄'}</span>
                          <span className="min-w-0">{m.title}{m.author && <span className="block text-xs font-medium text-gray-500">By {m.author}</span>}</span>
                        </a>
                      ) : (
                        <div className="flex items-start gap-3 bg-gray-50 rounded-2xl p-3 text-sm font-bold text-gray-800">
                          <span aria-hidden="true">{MATERIAL_ICON[m.type] ?? '📖'}</span>
                          <span className="min-w-0">{m.title}{m.author && <span className="block text-xs font-medium text-gray-500">By {m.author}</span>}</span>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </aside>
        </div>
      </div>
    </main>
  );
};
