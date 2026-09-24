import { useAppContext } from '../store';
import { Publication } from '../types';
import { TraineeData } from './scoring';

type Sources = Pick<ReturnType<typeof useAppContext>,
  'assessmentConfig' | 'assignments' | 'exercises' | 'enrollments' | 'assessmentSubmissions' | 'assessmentReviews' | 'publications'>;

// One trainee's inputs for the scoring functions, from whatever the current
// user is allowed to load (admins: everything; trainees: their own data
// plus published reviews; reviewers: assigned work + own reviews).
export const traineeDataFrom = (s: Sources, traineeId: string | undefined): TraineeData & { publication?: Publication } => ({
  config: s.assessmentConfig,
  assignments: s.assignments,
  exercises: s.exercises,
  enrollment: s.enrollments.find(e => e.id === traineeId),
  submissions: s.assessmentSubmissions.filter(x => x.traineeId === traineeId),
  reviews: s.assessmentReviews.filter(r => r.traineeId === traineeId),
  publication: s.publications.find(p => p.id === traineeId),
});

export const useTraineeData = (traineeId: string | undefined) => traineeDataFrom(useAppContext(), traineeId);
