import { useAppContext } from '../store';
import { Publication } from '../types';
import { TraineeData } from './scoring';

// Collects one trainee's inputs for the scoring functions from whatever the
// current user is allowed to load (admins: everything; trainees: their own
// data plus published reviews; reviewers: assigned work + own reviews).
export const useTraineeData = (traineeId: string | undefined): TraineeData & { publication?: Publication } => {
  const { assessmentConfig, assignments, exercises, enrollments, assessmentSubmissions, assessmentReviews, publications } = useAppContext();
  return {
    config: assessmentConfig,
    assignments,
    exercises,
    enrollment: enrollments.find(e => e.id === traineeId),
    submissions: assessmentSubmissions.filter(s => s.traineeId === traineeId),
    reviews: assessmentReviews.filter(r => r.traineeId === traineeId),
    publication: publications.find(p => p.id === traineeId),
  };
};
