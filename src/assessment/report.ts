// The batch report leadership gets as a CSV: one row per trainee, with the
// same numbers the roster cards show.
import { ProgramOutcome, User } from '../types';
import { Standing } from './standing';
import { Outcome, TraineeData, disagreements, roundScore, skillBreakdown } from './scoring';

type Cell = string | number | null | undefined;

// Spreadsheet apps run cells starting with = + - @ as formulas, and names
// are typed by users - so those get a leading apostrophe.
const csvCell = (v: Cell) => {
  if (v === null || v === undefined) return '';
  let s = String(v);
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const toCsv = (rows: Cell[][]) => rows.map(r => r.map(csvCell).join(',')).join('\r\n');

export interface ReportTrainee {
  designer: User;
  status: string; // as the roster badge says it
  standing: Standing | null;
  data: TraineeData;
  outcome: ProgramOutcome | undefined;
  progress: { done: number; total: number } | null;
}

const score = (v: number | null | undefined) => (v === null || v === undefined ? '' : roundScore(v).toFixed(2));
const day = (iso: string | undefined) => iso?.slice(0, 10) ?? '';

export const reportRows = (trainees: ReportTrainee[], showDA: boolean): Cell[][] => {
  const skillIds = trainees[0] ? skillBreakdown(trainees[0].data).map(r => [r.id, r.title] as const) : [];
  const stageCols = [['episodeA', 'Episode A'], ['episodeB', 'Episode B'], ['pod', 'Pod Trial'], ...(showDA ? [['da', 'Audio Description']] : [])] as const;
  const header = [
    'Name', 'Email', 'Batch', 'Pod', 'Start date', 'Status', 'Week', 'Progress',
    ...stageCols.map(([, l]) => l), 'Final (or so far)', 'Meets benchmark', 'Skills below minimum',
    'Overdue', 'Late hand-ins', 'Reviewer disagreements', 'Week 2 checkpoint', 'Offer decision', 'Decided on',
    ...skillIds.flatMap(([, t]) => stageCols.map(([, l]) => `${t} – ${l}`)),
  ];
  const body = trainees.map(({ designer, status, standing, data, outcome, progress }) => {
    const r = standing?.result;
    // A Week 4 decision's frozen scores, as on the card.
    const frozen = outcome?.decision ? outcome.snapshot : undefined;
    const live = (o: Outcome | undefined) => (o?.status === 'scored' ? o.value : null);
    const stage = (key: typeof stageCols[number][0]) => frozen ? frozen.stages.find(x => x.key === key)?.value : live(r?.[key]);
    const final = frozen ? frozen.final : r?.final.status === 'scored' ? r.final.value : standing?.scoreSoFar;
    const meets = frozen ? frozen.meetsBenchmark : r?.meetsBenchmark;
    const weak = frozen ? frozen.weakSkills ?? [] : r?.weakSkills ?? [];
    const skills = new Map(skillBreakdown(data).map(x => [x.id, x]));
    return [
      designer.name, designer.email, data.enrollment?.batch, designer.pod, data.enrollment?.startDate, status,
      standing && standing.week > 0 ? `${Math.min(standing.week, standing.totalWeeks)} of ${standing.totalWeeks}` : '',
      progress ? `${progress.done}/${progress.total}` : '',
      ...stageCols.map(([k]) => score(stage(k))),
      score(final), meets === undefined ? '' : meets ? 'Yes' : 'No',
      weak.map(w => `${w.stage} › ${w.title} ${w.value.toFixed(2)}`).join('; '),
      standing?.overdue.length ?? '', standing?.late.length ?? '', standing ? disagreements(data).length : '',
      outcome?.week2 ? (outcome.week2.decision === 'continue' ? 'Continue' : 'Released') : '',
      outcome?.decision === 'offered' ? 'Offered' : outcome?.decision === 'not_offered' ? 'No offer' : '',
      day(outcome?.decidedAt ?? outcome?.week2?.decidedAt),
      ...skillIds.flatMap(([id]) => stageCols.map(([k]) => score(skills.get(id)?.[k]))),
    ];
  });
  return [header, ...body];
};
