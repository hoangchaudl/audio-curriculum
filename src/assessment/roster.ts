// Every sound designer's probation standing and the alerts built from it -
// shared by the admin dashboard and the leadership dashboard so both show
// the same numbers.
import { useAppContext } from '../store';
import { User } from '../types';
import { STATUS_BADGE, STATUS_ORDER, badgeKey } from '../components/DesignerCard';
import { ALL_BATCHES, NO_BATCH } from '../components/assessment/ui';
import { disagreements } from './scoring';
import { programProgress } from './outline';
import { reportRows, toCsv } from './report';
import { Standing, traineeStanding, waitingReviews, week2CheckpointDue } from './standing';
import { traineeDataFrom } from './traineeData';

export interface RosterRow { designer: User; standing: Standing | null }

export const useRoster = () => {
  const ctx = useAppContext();
  const { users, enrollments, programOutline, programOutcomes, assessmentConfig } = ctx;
  const dataOf = (id: string) => traineeDataFrom(ctx, id);
  const outcomeOf = (id: string) => programOutcomes.find(o => o.id === id);
  const enrollmentOf = (id: string) => enrollments.find(e => e.id === id);
  // Probation standing per designer (null = not enrolled), sorted so the
  // ones needing attention come first.
  const roster: RosterRow[] = users.filter(u => u.role === 'sound_designer').map(designer => ({
    designer,
    standing: enrollmentOf(designer.id) ? traineeStanding(dataOf(designer.id), programOutline, ctx.videoProgress) : null,
  }));
  const statusOf = (r: RosterRow) => badgeKey(r.designer, r.standing, outcomeOf(r.designer.id));
  const sortKey = (r: RosterRow) => STATUS_ORDER.indexOf(r.designer.status === 'released' ? 'released' : r.standing?.status ?? 'not_enrolled');
  roster.sort((a, b) => sortKey(a) - sortKey(b) || a.designer.name.localeCompare(b.designer.name));

  // Released trainees drop out of every alert; decided ones out of most.
  const active = roster.filter(r => r.designer.status !== 'released');
  const undecided = active.filter(r => r.standing && !outcomeOf(r.designer.id)?.decision);
  const behind = active.filter(r => r.standing?.status === 'behind');
  const awaitingDecision = active.filter(r => (r.standing?.status === 'passed' || r.standing?.status === 'not_passed') && !outcomeOf(r.designer.id)?.decision);
  const checkpointDue = active.filter(r => week2CheckpointDue(r.standing, outcomeOf(r.designer.id)));
  // Hand-ins still waiting for a reviewer's scores after REVIEW_LAG_DAYS.
  const waiting = undecided
    .flatMap(r => waitingReviews(dataOf(r.designer.id)).map(w => ({ ...w, trainee: r.designer.name })))
    .sort((a, b) => b.days - a.days);
  // Reviewers far apart on a criterion.
  const splits = undecided
    .map(r => ({ name: r.designer.name, n: disagreements(dataOf(r.designer.id)).length })).filter(x => x.n > 0);

  // A list of trainees as a CSV (no admin access needed to read it).
  const downloadReport = (rows: RosterRow[], batch: string) => {
    const csv = toCsv(reportRows(rows.map(({ designer, standing }) => {
      const data = dataOf(designer.id);
      const outcome = outcomeOf(designer.id);
      return {
        designer, standing, data, outcome,
        status: STATUS_BADGE[badgeKey(designer, standing, outcome)].label.replace(/^[^A-Za-z]+/, ''),
        progress: data.enrollment ? programProgress(programOutline, ctx.assignments, data.enrollment, designer.id, ctx.videoProgress, ctx.assessmentSubmissions) : null,
      };
    }), (assessmentConfig.stageWeights.da ?? 0) > 0));
    // BOM so Excel reads the Vietnamese names as UTF-8.
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    const name = (batch === ALL_BATCHES ? 'all' : batch === NO_BATCH ? 'no-batch' : batch).replace(/[^\w-]+/g, '-');
    Object.assign(document.createElement('a'), { href: url, download: `probation-report-${name}-${new Date().toISOString().slice(0, 10)}.csv` }).click();
    URL.revokeObjectURL(url);
  };

  return { roster, active, behind, awaitingDecision, checkpointDue, waiting, splits, outcomeOf, enrollmentOf, dataOf, statusOf, downloadReport };
};
