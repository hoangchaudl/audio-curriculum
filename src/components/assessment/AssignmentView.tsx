import React from 'react';
import { useAppContext } from '../../store';
import { Assignment } from '../../types';
import { useTraineeData } from '../../assessment/traineeData';
import { exerciseOutcome } from '../../assessment/scoring';
import { assignmentLines } from '../../assessment/outline';
import { SubmissionPanel } from './SubmissionPanel';
import { EpisodeView } from './EpisodeView';
import { OutcomeBadge, RubricTable, card, sectionTitle } from './ui';
import { AssignmentIntro } from './AssignmentIntro';

export const AssignmentView: React.FC<{ assignmentId: string }> = ({ assignmentId }) => {
  const { assignments, currentUser, exercises } = useAppContext();
  const data = useTraineeData(currentUser?.id);
  const assignment = assignments.find(a => a.id === assignmentId);
  if (!assignment) return <div className="p-10">Assignment not found</div>;

  // Episode B / Pod assignments are the existing episode pages plus this
  // assignment's header.
  if (assignment.stage !== 'A') {
    return <EpisodeView stage={assignment.stage} assignment={assignment} />;
  }

  const lines = assignmentLines(exercises, assignment.id);
  const published = !!data.publication?.episodeA;
  const gradedSubmissionId = published
    ? data.reviews.find(r => r.stage === 'A' && lines.some(l => l.id === r.target))?.submissionId
    : undefined;
  const disabledReason = !data.enrollment
    ? "You're not enrolled in the assessment program yet - ask a coordinator to enroll you."
    : published ? 'Episode A results are published; submissions are closed.' : undefined;

  return (
    <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-page">
      <header className="min-h-20 bg-surface border-b flex items-center px-4 md:px-10 py-3 flex-shrink-0">
        <div className="min-w-0">
          <h2 className="text-lg md:text-2xl font-black text-[#2E9DF7] truncate">{assignment.title}</h2>
          <p className="text-xs text-gray-400 font-medium mt-1">Episode A assignment · counts toward Episode A (20% of your final grade)</p>
        </div>
      </header>
      <div className="flex-1 p-4 md:p-6 lg:p-10 overflow-y-auto">
        <div className="max-w-4xl mx-auto space-y-6">
          <AssignmentIntro assignment={assignment} startDate={data.enrollment?.startDate} />

          <section className={card}>
            <h3 className={`${sectionTitle} mb-1`}>How it's graded</h3>
            <p className="text-xs text-gray-500 mb-4">
              This assignment counts {assignment.weight ?? 0}% of Episode A ({Math.round((assignment.weight ?? 0) * data.config.stageWeights.episodeA) / 100}% of your final grade). Your trainer scores it from 1 to 5 separately for each criterion below. Scores appear once the coordinator publishes Episode A.
            </p>
            <ul className="space-y-2">
              {lines.map(l => {
                const review = data.reviews.find(r => r.stage === 'A' && r.target === l.id);
                return (
                  <li key={l.id} className="bg-gray-50 rounded-2xl p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-bold text-sm text-gray-800">{l.title}</p>
                        <p className="text-[11px] text-gray-500 font-bold">{l.weight}% of this assignment</p>
                      </div>
                      {published && <OutcomeBadge outcome={exerciseOutcome(data, l, assignment.title)} />}
                    </div>
                    {published && review?.feedback && <p className="text-xs text-navy bg-sky rounded-xl p-2 mt-2 whitespace-pre-wrap">{review.feedback}</p>}
                  </li>
                );
              })}
              {lines.length === 0 && <li className="text-sm text-gray-400">No criteria set up yet.</li>}
            </ul>
            {lines.some(l => l.levels?.some(Boolean)) ? (
              <div className="mt-4">
                <p className="text-[10px] font-black uppercase text-gray-500 mb-1">Rubric - what each score means</p>
                <RubricTable lines={lines} />
              </div>
            ) : lines.length > 0 && <p className="text-[10px] text-gray-400 mt-3">Scale: 1 (lowest) to 5 (highest)</p>}
          </section>

          <section className={card}>
            <h3 className={`${sectionTitle} mb-3`}>Your submissions</h3>
            <SubmissionPanel stage="A" target={assignment.id} gradedSubmissionId={gradedSubmissionId} disabledReason={disabledReason} />
          </section>
        </div>
      </div>
    </main>
  );
};
