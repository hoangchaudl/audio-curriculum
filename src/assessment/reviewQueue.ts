// The current account's review work (built from the enrollments where it
// holds a reviewer slot) - shared by the Review Queue page and the sidebar
// badge, kept out of the page's file so the page can load on demand.
import { useMemo } from 'react';
import { useAppContext } from '../store';
import { AssessmentReview, AssessmentStage, AssessmentSubmission, Exercise, ReviewerSlot } from '../types';
import { STAGE_SLOTS, publicationKey } from './config';
import { exerciseSubmissions, stageSubmissions } from './scoring';
import { STAGE_LABELS } from '../components/assessment/ui';

export type Status = 'needs-review' | 'draft' | 'done' | 'locked' | 'awaiting-submission' | 'awaiting-complete';

export interface QueueItem {
  key: string;
  traineeId: string;
  traineeName: string;
  stage: AssessmentStage;
  target: string;
  targetTitle: string;
  slot: ReviewerSlot;
  versions: AssessmentSubmission[];
  review?: AssessmentReview;
  // Episode A: the grading lines (one score each) of this assignment, and
  // their existing reviews. One queue item = one assignment submission.
  lines: Exercise[];
  lineReviews: AssessmentReview[];
  published: boolean;
  status: Status;
}

// Only work this account is assigned to review - built from enrollments
// where the current user holds a reviewer slot. firestore.rules enforce the
// same boundary, so nothing else is even loaded for non-admins.
export const useQueue = (): QueueItem[] => {
  const { currentUser, users, enrollments, modules, exercises, assignments, assessmentSubmissions, assessmentReviews, publications } = useAppContext();
  return useMemo(() => {
    const uid = currentUser?.id;
    if (!uid) return [];
    // Criteria of Episode A assignments, in assignment order.
    const epAIds = assignments.filter(a => a.stage === 'A').map(a => a.id);
    const epAExercises = exercises
      .filter(e => !!e.assignmentId && epAIds.includes(e.assignmentId))
      .sort((a, b) => epAIds.indexOf(a.assignmentId!) - epAIds.indexOf(b.assignmentId!) || a.order - b.order);
    const items: QueueItem[] = [];
    for (const e of enrollments) {
      const held = (Object.entries(e.reviewers) as [ReviewerSlot, string][]).filter(([, holder]) => holder === uid).map(([s]) => s);
      const stages: AssessmentStage[] = ['A', 'B', 'P1', ...(e.podEpisodesRequired === 2 ? ['P2' as const] : []),
        // Audio Description only once the program has a DA assignment.
        ...(assignments.some(a => a.stage === 'DA') ? ['DA' as const] : [])];
      for (const slot of held) {
        for (const stage of stages.filter(s => STAGE_SLOTS[s].includes(slot))) {
          const own = assessmentSubmissions.filter(s => s.traineeId === e.traineeId);
          // Episode A: one item per assignment, carrying all its criteria.
          const groups = stage === 'A'
            ? [...new Set(epAExercises.map(x => x.assignmentId!))].map(key => {
                const lines = epAExercises.filter(x => x.assignmentId === key);
                const title = assignments.find(a => a.id === key)?.title ?? lines[0].title;
                const versions = [...new Map(lines.flatMap(l => exerciseSubmissions(own, l)).map(v => [v.id, v])).values()].sort((a, b) => a.version - b.version);
                return { id: key, title, lines, versions };
              })
            : [{ id: 'episode', title: STAGE_LABELS[stage], lines: [] as Exercise[], versions: stageSubmissions(own, stage, 'episode') }];
          for (const t of groups) {
            const versions = t.versions;
            const lineReviews = assessmentReviews.filter(r => r.traineeId === e.traineeId && r.stage === 'A' && r.reviewerSlot === slot && t.lines.some(l => l.id === r.target));
            const review = stage === 'A' ? lineReviews[0]
              : assessmentReviews.find(r => r.traineeId === e.traineeId && r.stage === stage && r.target === t.id && r.reviewerSlot === slot);
            const published = !!publications.find(p => p.id === e.traineeId)?.[publicationKey(stage)];
            const allSubmitted = stage === 'A'
              ? t.lines.length > 0 && t.lines.every(l => lineReviews.find(r => r.target === l.id)?.status === 'submitted')
              : review?.status === 'submitted';
            const status: Status = !versions.length ? 'awaiting-submission'
              : stage !== 'A' && !versions.some(v => v.isComplete) ? 'awaiting-complete'
              : published ? 'locked'
              : allSubmitted ? 'done'
              : (stage === 'A' ? lineReviews.length > 0 : review?.status === 'draft') ? 'draft' : 'needs-review';
            items.push({
              key: `${e.traineeId}|${stage}|${t.id}|${slot}`, traineeId: e.traineeId,
              traineeName: users.find(u => u.id === e.traineeId)?.name ?? 'Trainee', stage, target: t.id, targetTitle: t.title,
              slot, versions, review, lines: t.lines, lineReviews, published, status,
            });
          }
        }
      }
    }
    return items;
  }, [currentUser?.id, users, enrollments, modules, exercises, assignments, assessmentSubmissions, assessmentReviews, publications]);
};

export const useReviewTodoCount = () => useQueue().filter(i => i.status === 'needs-review' || i.status === 'draft').length;
export const useHasReviewAssignments = () => {
  const { currentUser, enrollments } = useAppContext();
  return !!currentUser && enrollments.some(e => Object.values(e.reviewers).includes(currentUser.id));
};
