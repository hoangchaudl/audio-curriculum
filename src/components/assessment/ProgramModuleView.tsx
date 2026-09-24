import React, { useEffect, useRef } from 'react';
import { useAppContext } from '../../store';
import { useTraineeData } from '../../assessment/traineeData';
import { exerciseOutcome, moduleOutcome } from '../../assessment/scoring';
import { SCORE_LABELS_5 } from '../../assessment/config';
import { ContentBlocks } from './ContentBlocks';
import { SubmissionPanel } from './SubmissionPanel';
import { Md, OutcomeBadge, card, sectionTitle } from './ui';

// An Episode A module: admin-authored content (video optional) followed by
// the module's exercises, each with its own versioned submissions.
export const ProgramModuleView: React.FC<{ moduleId: string }> = ({ moduleId }) => {
  const { modules, exercises, currentUser, moduleVideos } = useAppContext();
  const data = useTraineeData(currentUser?.id);
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { scrollRef.current?.scrollTo(0, 0); }, [moduleId]);

  const mod = modules.find(m => m.id === moduleId);
  if (!mod) return <div className="p-10">Module not found</div>;

  const moduleExercises = exercises.filter(e => e.moduleId === mod.id).sort((a, b) => a.order - b.order);
  const legacyVideo = moduleVideos.find(v => v.moduleId === mod.id && v.url && v.url !== '#');
  const published = !!data.publication?.episodeA;
  const enrolled = !!data.enrollment;
  const disabledReason = !enrolled
    ? "You're not enrolled in the assessment program yet - ask a coordinator to enroll you."
    : published ? 'Episode A results are published; submissions are closed.' : undefined;

  return (
    <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-page">
      <header className="min-h-20 bg-surface border-b flex items-center justify-between gap-4 px-4 md:px-10 py-3 flex-shrink-0">
        <div className="min-w-0">
          <h2 className="text-lg md:text-2xl font-black text-[#2E9DF7] truncate">Module {mod.label || mod.order}: {mod.title}</h2>
          <p className="text-xs text-gray-400 font-medium mt-1">
            Episode A · Weeks 1–2 · {mod.episodeAWeight ?? 0}% of Episode A · {moduleExercises.length} exercise{moduleExercises.length === 1 ? '' : 's'}
          </p>
        </div>
        {published && enrolled && <OutcomeBadge outcome={moduleOutcome(data, mod)} />}
      </header>

      <div ref={scrollRef} className="flex-1 p-4 md:p-6 lg:p-10 overflow-y-auto">
        <div className="max-w-4xl mx-auto space-y-6">
          {mod.description && <div className={card}><Md>{mod.description}</Md></div>}
          <ContentBlocks blocks={mod.contentBlocks} startDate={data.enrollment?.startDate} />
          {legacyVideo && <ContentBlocks blocks={[{ id: 'legacy-video', type: 'video', url: legacyVideo.url, title: legacyVideo.title }]} />}

          <section className="space-y-4">
            <h3 className={sectionTitle}>Exercises</h3>
            {moduleExercises.length === 0 && <p className={`${card} text-sm text-gray-400`}>No exercises have been set up for this module yet.</p>}
            {moduleExercises.map((ex, i) => {
              const outcome = exerciseOutcome(data, ex, mod.title);
              const review = data.reviews.find(r => r.stage === 'A' && r.target === ex.id && r.reviewerSlot === 'trainer');
              return (
                <article key={ex.id} className={card}>
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Exercise {i + 1} · {ex.weight}% of module</p>
                      <h4 className="text-lg font-black text-gray-800">{ex.title}</h4>
                    </div>
                    {published && <OutcomeBadge outcome={outcome} />}
                  </div>
                  {ex.instructions && <div className="mb-4"><Md>{ex.instructions}</Md></div>}
                  {published && review?.feedback && (
                    <div className="bg-sky rounded-2xl p-4 mb-4">
                      <p className="text-[10px] font-black uppercase text-navy mb-1">Trainer feedback</p>
                      <p className="text-sm text-navy whitespace-pre-wrap">{review.feedback}</p>
                    </div>
                  )}
                  <SubmissionPanel stage="A" target={ex.id} gradedSubmissionId={published ? review?.submissionId : undefined} disabledReason={disabledReason} />
                </article>
              );
            })}
          </section>

          <section className={card}>
            <h3 className={`${sectionTitle} mb-3`}>How exercises are scored</h3>
            <p className="text-xs text-gray-500 mb-3">
              Your trainer scores each exercise from 1 to 5 on the revision they select. The module score is the weighted average of its exercises, and
              is only complete once every exercise is graded. Results appear here when the coordinator publishes Episode A.
            </p>
            <ol className="grid sm:grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map(n => (
                <li key={n} className="bg-gray-50 rounded-2xl p-3 text-center">
                  <p className="text-xl font-black text-gray-800">{n}</p>
                  <p className="text-[10px] font-black uppercase text-gray-500">{SCORE_LABELS_5[n]}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </main>
  );
};
