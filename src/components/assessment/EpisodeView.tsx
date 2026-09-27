import React from 'react';
import { useAppContext } from '../../store';
import { useTraineeData } from '../../assessment/traineeData';
import { daOutcome, episodeBOutcome, podEpisodeOutcome } from '../../assessment/scoring';
import { REVIEWER_SLOTS, STAGE_SLOTS, cellGroup, publicationKey, stageCells, stageCriteria } from '../../assessment/config';
import { ContentBlocks } from './ContentBlocks';
import { SubmissionPanel } from './SubmissionPanel';
import { OutcomeBadge, RubricTable, STAGE_LABELS, card, sectionTitle } from './ui';
import { Assignment } from '../../types';
import { AssignmentIntro } from './AssignmentIntro';

// Trainee page for a reviewer-table stage: Episode B (final test), one
// Pod Trial episode, or Audio Description (DA).
export const EpisodeView: React.FC<{ stage: 'B' | 'P1' | 'P2' | 'DA'; assignment?: Assignment }> = ({ stage, assignment }) => {
  const { currentUser, assessmentConfig } = useAppContext();
  const data = useTraineeData(currentUser?.id);
  const isPod = stage === 'P1' || stage === 'P2';
  const cells = stageCells(assessmentConfig, stage);
  const slots = STAGE_SLOTS[stage].filter(s => cells.some(c => c.slot === s));
  const criteria = stageCriteria(assessmentConfig, stage);
  const published = !!data.publication?.[publicationKey(stage)];
  const content = assessmentConfig.stageContent;
  const blocks = stage === 'B' ? content?.episodeB : stage === 'DA' ? content?.da : content?.pod;
  const notRequired = stage === 'P2' && (data.enrollment?.podEpisodesRequired ?? 1) < 2;
  const outcome = stage === 'B' ? episodeBOutcome(data) : stage === 'DA' ? daOutcome(data) : podEpisodeOutcome(data, stage === 'P1' ? 1 : 2);
  const w = assessmentConfig.stageWeights;
  const reviews = data.reviews.filter(r => r.stage === stage && r.status === 'submitted');

  const disabledReason = !data.enrollment
    ? "You're not enrolled in the assessment program yet - ask a coordinator to enroll you."
    : notRequired ? 'Only one pod episode is required for you.'
    : published ? 'Results are published; submissions are closed.' : undefined;

  return (
    <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-page">
      <header className="min-h-20 bg-surface border-b flex items-center justify-between gap-4 px-4 md:px-10 py-3 flex-shrink-0">
        <div className="min-w-0">
          <h2 className="text-lg md:text-2xl font-black text-[#2E9DF7] truncate">{assignment?.title ?? STAGE_LABELS[stage]}</h2>
          <p className="text-xs text-gray-400 font-medium mt-1">
            {stage === 'B' ? `${w.episodeB}% of your final grade · work independently on a new full episode`
              : stage === 'DA' ? `${w.da}% of your final grade · recreate a picture-led scene as audio only`
              : `Pod Trial is ${w.pod}% of your final grade${(data.enrollment?.podEpisodesRequired ?? 1) === 2 ? ' (average of both episodes)' : ''}`}
          </p>
        </div>
        {published && <OutcomeBadge outcome={outcome} />}
      </header>

      <div className="flex-1 p-4 md:p-6 lg:p-10 overflow-y-auto">
        <div className="max-w-4xl mx-auto space-y-6">
          {assignment && <AssignmentIntro assignment={assignment} startDate={data.enrollment?.startDate} />}
          <ContentBlocks blocks={blocks} startDate={data.enrollment?.startDate} />

          <section className={card}>
            <h3 className={`${sectionTitle} mb-1`}>Grading rubric</h3>
            <p className="text-xs text-gray-500 mb-4">
              Each reviewer scores every criterion independently from 1 to 5. The percentages are each cell's share of this stage.
              {isPod && ' The producer scores SFX and Music against the creative brief.'}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] font-black uppercase text-gray-500">
                    <th className="text-left py-2 pr-3">Criterion</th>
                    {slots.map(s => <th key={s} className="text-right py-2 px-2">{REVIEWER_SLOTS.find(r => r.id === s)?.label}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {criteria.map(c => (
                    <tr key={c.id}>
                      <td className="py-2 pr-3 font-bold text-gray-700">{c.title}</td>
                      {slots.map(s => {
                        const w = cells.find(x => x.slot === s && x.criterion === c.id)?.weight;
                        return <td key={s} className="py-2 px-2 text-right font-bold text-gray-600">{w === undefined ? 'N/A' : `${w}%`}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {criteria.some(c => c.levels?.some(Boolean) || c.outcome) && (
              <div className="mt-5">
                <p className="text-[10px] font-black uppercase text-gray-500 mb-1">Rubric - what each score means</p>
                <RubricTable lines={criteria.map(c => ({ ...c, note: `${Math.round(cells.filter(x => x.criterion === c.id).reduce((t, x) => t + x.weight, 0) * 100) / 100}%` }))}
                  bands={assessmentConfig.bands?.[cellGroup(stage)]} bandsVi={assessmentConfig.bandsVi?.[cellGroup(stage)]} />
              </div>
            )}
          </section>

          {published && reviews.some(r => r.feedback) && (
            <section className={card}>
              <h3 className={`${sectionTitle} mb-3`}>Feedback</h3>
              <ul className="space-y-3">
                {reviews.filter(r => r.feedback).map(r => (
                  <li key={r.id} className="bg-sky rounded-2xl p-4">
                    <p className="text-[10px] font-black uppercase text-navy mb-1">{REVIEWER_SLOTS.find(s => s.id === r.reviewerSlot)?.label}</p>
                    <p className="text-sm text-navy whitespace-pre-wrap">{r.feedback}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className={card}>
            <h3 className={`${sectionTitle} mb-3`}>Your submissions</h3>
            <SubmissionPanel stage={stage} target="episode" askComplete disabledReason={disabledReason} />
          </section>
        </div>
      </div>
    </main>
  );
};
