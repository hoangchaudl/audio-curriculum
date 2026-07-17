import React, { useState } from 'react';
import { useAppContext } from '../store';
import { Grade, Module, Submission, User } from '../types';
import { groupOutline } from '../outline';
import { RubricTable } from './RubricTable';

// "Who's been waiting longest" used to only be answerable by the queue's
// sort order (oldest first) - nothing on the card itself said how long ago
// a submission came in.
const timeAgo = (iso?: string): string | null => {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

// Shared by both the cross-module Review Queue and the per-module Student
// Submissions list below it - grading a submission looks the same either way,
// only whether the module name needs to be shown (queue: yes, since it's not
// implied by context) differs. When the module defines structured
// rubricCriteria, grading is a per-sub-skill matrix and the overall score is
// the lowest sub-skill score; otherwise it falls back to the single 1-4 pick.
const SubmissionCard: React.FC<{
  sub: Submission;
  student?: User;
  grade?: Grade;
  module?: Module;
  moduleLabel?: string;
  score?: 1 | 2 | 3 | 4;
  feedback?: string;
  criterionScores?: Record<string, 1 | 2 | 3 | 4>;
  onScoreChange: (score: 1 | 2 | 3 | 4) => void;
  onFeedbackChange: (feedback: string) => void;
  onCriterionScore: (criterionId: string, score: 1 | 2 | 3 | 4) => void;
  onGrade: () => void;
}> = ({ sub, student, grade, module, moduleLabel, score, feedback, criterionScores, onScoreChange, onFeedbackChange, onCriterionScore, onGrade }) => (
  <div className="bg-white rounded-2xl p-6 border-[3px] border-black flex flex-col gap-4">
    <div className="flex justify-between items-center gap-2 flex-wrap">
      <div className="flex items-center gap-3">
        {student?.avatarBase64 ? (
          <img src={student.avatarBase64} alt="Avatar" className="w-10 h-10 rounded-full border-2 border-black object-cover" />
        ) : (
          <div className="w-10 h-10 rounded-full border-2 border-black bg-[#2E9DF7] flex items-center justify-center text-white font-black text-xs flex-shrink-0">
            {student?.name.substring(0, 2).toUpperCase()}
          </div>
        )}
        <div>
          <p className="text-sm font-bold">{student?.name}</p>
          <p className="text-[10px] text-gray-400 font-bold uppercase">{student?.pod}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {sub.status !== 'graded' && timeAgo(sub.submittedAt) && (
          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wide" title={sub.submittedAt ? new Date(sub.submittedAt).toLocaleString() : undefined}>
            Submitted {timeAgo(sub.submittedAt)}
          </span>
        )}
        {moduleLabel && (
          <span className="bg-[#E0F2FE] text-[#1E40AF] border-2 border-black px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
            {moduleLabel}
          </span>
        )}
        {sub.status === 'graded' ? (
          <span className="bg-[#3DDC97]/30 text-[#2A8F62] border-2 border-black px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">Graded</span>
        ) : (
          <span className="bg-[#F4511E]/20 text-[#C53914] border-2 border-black px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">Needs Review</span>
        )}
      </div>
    </div>

    <div className="bg-gray-100 p-4 rounded-xl">
      <p className="text-xs text-gray-500 mb-1 font-bold">Homework Link:</p>
      <a href={sub.driveLink} target="_blank" rel="noreferrer" className="text-sm text-[#2E9DF7] font-medium hover:underline break-all">
        {sub.driveLink}
      </a>
    </div>

    {sub.status === 'graded' && grade ? (
      <div className="bg-[#E0F2FE] p-4 rounded-xl space-y-3">
        <div className="flex justify-between">
          <span className="text-xs font-black text-[#1E40AF]">Score: {grade.score}/4</span>
        </div>
        {module?.rubricCriteria && grade.criterionScores && grade.criterionScores.length > 0 && (
          <RubricTable
            criteria={module.rubricCriteria}
            selected={Object.fromEntries(grade.criterionScores.map(c => [c.criterionId, c.score]))}
          />
        )}
        <p className="text-sm text-[#1E40AF] italic">"{grade.feedback}"</p>
      </div>
    ) : module?.rubricCriteria && module.rubricCriteria.length > 0 ? (
      <div className="border-t-2 border-black/10 pt-4 mt-2 space-y-4">
        <p className="text-xs font-black text-gray-500 uppercase tracking-wide">
          Grade each sub-skill — the overall score is the lowest one
        </p>
        <RubricTable
          criteria={module.rubricCriteria}
          note={module.rubricNote}
          selected={criterionScores}
          onSelect={onCriterionScore}
        />
        <div className="flex gap-4 items-stretch">
          <div className="flex-1">
            <textarea
              placeholder="Provide constructive feedback..."
              value={feedback || ''}
              onChange={(e) => onFeedbackChange(e.target.value)}
              className="w-full bg-gray-100 rounded-xl p-3 text-sm focus:ring-2 focus:ring-[#3DDC97] min-h-[80px]"
            />
          </div>
          <button
            onClick={onGrade}
            disabled={!feedback || module.rubricCriteria.some(c => !criterionScores?.[c.id])}
            className="bg-[#2E9DF7] text-white font-black uppercase text-xs tracking-wide px-6 py-4 rounded-xl border-2 border-black hover:bg-black transition-colors disabled:opacity-40 disabled:hover:bg-[#2E9DF7] flex flex-col items-center justify-center gap-1"
          >
            Submit Grade
            {module.rubricCriteria.every(c => criterionScores?.[c.id]) && (
              <span className="text-[10px] normal-case font-bold opacity-80">
                Overall: {Math.min(...module.rubricCriteria.map(c => criterionScores![c.id]))}/4
              </span>
            )}
          </button>
        </div>
      </div>
    ) : (
      <div className="border-t-2 border-black/10 pt-4 mt-2 space-y-4">
        {/* Legacy plain-text rubric (modules without structured sub-skills)
            used to only be visible under the Module Tasks tab, so grading
            here meant either memorizing the bar or tab-switching mid-review. */}
        {module?.rubric && (
          <div className="bg-gray-100 rounded-xl p-4">
            <p className="text-xs font-black text-gray-500 uppercase tracking-wide mb-1.5">Grading Rubric</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{module.rubric}</p>
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-4 sm:items-start">
        <div className="w-full sm:w-32">
          <select
            value={score || ''}
            onChange={(e) => onScoreChange(parseInt(e.target.value) as 1 | 2 | 3 | 4)}
            className="w-full bg-gray-100 rounded-xl p-3 text-sm font-bold text-gray-700"
          >
            <option value="" disabled>Score (1-4)</option>
            <option value="1">1 - Needs Work</option>
            <option value="2">2 - Fair</option>
            <option value="3">3 - Good</option>
            <option value="4">4 - Excellent</option>
          </select>
        </div>
        <div className="flex-1">
          <textarea
            placeholder="Provide constructive feedback..."
            value={feedback || ''}
            onChange={(e) => onFeedbackChange(e.target.value)}
            className="w-full bg-gray-100 rounded-xl p-3 text-sm focus:ring-2 focus:ring-[#3DDC97] min-h-[80px]"
          />
        </div>
        <button
          onClick={onGrade}
          disabled={!score || !feedback}
          className="bg-[#2E9DF7] text-white font-black uppercase text-xs tracking-wide px-6 py-4 rounded-xl border-2 border-black hover:bg-black transition-colors disabled:opacity-40 disabled:hover:bg-[#2E9DF7] h-full self-stretch flex items-center"
        >
          Submit Grade
        </button>
        </div>
      </div>
    )}
  </div>
);

const moduleLabelFor = (mod?: Module) => mod ? (mod.label || mod.order.toString().padStart(2, '0')) + ' — ' + mod.title : 'Unknown module';

export const EngineerDashboard: React.FC<{ moduleId: string }> = ({ moduleId }) => {
  const { modules, users, submissions, grades, videoTasks, gradeHomework, updateVideoTask } = useAppContext();
  const [tab, setTab] = useState<'queue' | 'module'>('queue');

  // Shared across both tabs - submission ids are unique regardless of which
  // module they belong to, so one set of in-progress grading state works for
  // whichever tab the engineer is grading from.
  const [score, setScore] = useState<Record<string, 1 | 2 | 3 | 4>>({});
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  // Per-submission, per-sub-skill picks for modules graded against a
  // structured rubric (subId -> criterionId -> score).
  const [criterionScores, setCriterionScores] = useState<Record<string, Record<string, 1 | 2 | 3 | 4>>>({});

  const setCriterionScore = (subId: string, criterionId: string, s: 1 | 2 | 3 | 4) => {
    setCriterionScores(prev => ({ ...prev, [subId]: { ...prev[subId], [criterionId]: s } }));
  };

  const handleGrade = (subId: string, subModule?: Module) => {
    if (!feedback[subId]) return;
    const criteria = subModule?.rubricCriteria;
    if (criteria && criteria.length > 0) {
      const picks = criterionScores[subId] || {};
      if (criteria.some(c => !picks[c.id])) return;
      // The rubric's pass bar is per sub-skill, so the overall grade is the
      // weakest sub-skill - a strong chain order shouldn't hide audible
      // artifacts.
      const overall = Math.min(...criteria.map(c => picks[c.id])) as 1 | 2 | 3 | 4;
      gradeHomework(subId, overall, feedback[subId], criteria.map(c => ({ criterionId: c.id, score: picks[c.id] })));
    } else if (score[subId]) {
      gradeHomework(subId, score[subId], feedback[subId]);
    }
  };

  const pendingSubmissions = submissions
    .filter(s => s.status === 'submitted')
    .sort((a, b) => new Date(a.submittedAt || 0).getTime() - new Date(b.submittedAt || 0).getTime());
  const pendingModuleCount = new Set(pendingSubmissions.map(s => s.moduleId)).size;

  const mod = modules.find(m => m.id === moduleId);
  const modSubmissions = submissions.filter(s => s.moduleId === moduleId);
  const videoTask = videoTasks.find(t => t.moduleId === moduleId);
  const [videoUrl, setVideoUrl] = useState(videoTask?.videoUrl || '');

  // Persists both status and URL together, from whichever control the
  // engineer used last - previously the URL field only updated local state
  // and was silently dropped unless the status dropdown was also touched.
  // Only ever updates an admin-assigned task (see the "no task assigned yet"
  // state below) - firestore.rules reserves creating a videoTasks doc for
  // admins, so there's nothing to save until one exists.
  const handleSaveVideo = (status: 'pending' | 'in_progress' | 'completed' = videoTask?.status || 'pending') => {
    if (!videoTask) return;
    updateVideoTask(videoTask.id, status, videoUrl);
  };

  return (
    <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#F5FAFF]">
      <header className="min-h-20 bg-white border-b-[3px] border-black flex items-center justify-between flex-wrap px-4 md:px-10 py-3 flex-shrink-0 gap-4">
        <div className="min-w-0">
          <h2 className="text-2xl font-black text-black truncate">
            {tab === 'queue' ? 'Review Queue' : `Module ${mod ? (mod.label || mod.order.toString().padStart(2, '0')) : ''} Tasks`}
          </h2>
          <p className="text-xs text-gray-500 font-bold">
            {tab === 'queue'
              ? `${pendingSubmissions.length} pending across ${pendingModuleCount} module${pendingModuleCount === 1 ? '' : 's'}`
              : `Submissions: ${modSubmissions.length} • Pending Review: ${modSubmissions.filter(s => s.status === 'submitted').length}`}
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => setTab('queue')}
            className={`relative px-5 py-2.5 rounded-full font-black uppercase text-xs tracking-wider border-2 border-black transition-colors ${
              tab === 'queue' ? 'bg-[#2E9DF7] text-white' : 'bg-white text-black hover:bg-gray-50'
            }`}
          >
            Review Queue
            {pendingSubmissions.length > 0 && (
              <span className="absolute -top-2 -right-2 bg-[#F4511E] text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-black">
                {pendingSubmissions.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab('module')}
            className={`px-5 py-2.5 rounded-full font-black uppercase text-xs tracking-wider border-2 border-black transition-colors ${
              tab === 'module' ? 'bg-[#2E9DF7] text-white' : 'bg-white text-black hover:bg-gray-50'
            }`}
          >
            Module Tasks
          </button>
        </div>
      </header>

      <div className="flex-1 p-4 md:p-6 lg:p-10 flex flex-col gap-6 overflow-y-auto">
        {tab === 'queue' ? (
          pendingSubmissions.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 border-[3px] border-black text-center">
              <p className="text-lg font-black text-black mb-1">You're all caught up 🎧</p>
              <p className="text-sm text-gray-500 font-medium">Nothing waiting on you across any module right now.</p>
            </div>
          ) : (
            pendingSubmissions.map(sub => {
              const student = users.find(u => u.id === sub.userId);
              const subModule = modules.find(m => m.id === sub.moduleId);
              return (
                <SubmissionCard
                  key={sub.id}
                  sub={sub}
                  student={student}
                  module={subModule}
                  moduleLabel={moduleLabelFor(subModule)}
                  score={score[sub.id]}
                  feedback={feedback[sub.id]}
                  criterionScores={criterionScores[sub.id]}
                  onScoreChange={(s) => setScore({ ...score, [sub.id]: s })}
                  onFeedbackChange={(f) => setFeedback({ ...feedback, [sub.id]: f })}
                  onCriterionScore={(cId, s) => setCriterionScore(sub.id, cId, s)}
                  onGrade={() => handleGrade(sub.id, subModule)}
                />
              );
            })
          )
        ) : !mod ? (
          <div className="p-10">Module not found</div>
        ) : (
          <>
            <div className="bg-white rounded-2xl p-8 border-[3px] border-black">
              <h3 className="text-lg font-black text-black mb-4 flex items-center gap-2">
                <span className="w-8 h-8 rounded-full border-2 border-black bg-[#E0F2FE] flex items-center justify-center text-sm">📘</span>
                Module Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {mod.objectives && (
                  <div className="bg-gray-100 p-4 rounded-xl">
                    <h4 className="text-xs font-black text-gray-500 uppercase mb-2">Objectives</h4>
                    <ul className="list-disc pl-4 text-sm text-gray-700 space-y-1">
                      {mod.objectives.map((obj, i) => <li key={i}>{obj}</li>)}
                    </ul>
                  </div>
                )}
                {mod.outcomes && (
                  <div className="bg-gray-100 p-4 rounded-xl">
                    <h4 className="text-xs font-black text-gray-500 uppercase mb-2">Outcomes</h4>
                    <ul className="list-disc pl-4 text-sm text-gray-700 space-y-1">
                      {mod.outcomes.map((out, i) => <li key={i}>{out}</li>)}
                    </ul>
                  </div>
                )}
                {mod.outline && (
                  <div className="bg-gray-100 p-4 rounded-xl col-span-2">
                    <h4 className="text-xs font-black text-gray-500 uppercase mb-3">Outline</h4>
                    <ol className="space-y-3">
                      {groupOutline(mod.outline).map((lesson, i) => (
                        <li key={i}>
                          <div className="flex items-center gap-3 text-sm text-gray-800">
                            <span className="flex-shrink-0 w-6 h-6 bg-white border-2 border-black rounded-full flex items-center justify-center text-[10px] font-black text-[#1E40AF]">
                              {i + 1}
                            </span>
                            <span className="font-bold">{lesson.title}</span>
                          </div>
                          {lesson.items.length > 0 && (
                            <ul className="mt-1.5 ml-9 pl-4 list-disc space-y-1">
                              {lesson.items.map((item, j) => (
                                <li key={j} className="text-sm text-gray-600">{item}</li>
                              ))}
                            </ul>
                          )}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                {(mod.rubricCriteria?.length || mod.rubric) && (
                  <div className="bg-gray-100 p-4 rounded-xl col-span-2">
                    <h4 className="text-xs font-black text-gray-500 uppercase mb-2">Grading Rubric</h4>
                    {mod.rubricCriteria && mod.rubricCriteria.length > 0 ? (
                      <RubricTable criteria={mod.rubricCriteria} note={mod.rubricNote} />
                    ) : (
                      <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{mod.rubric}</p>
                    )}
                  </div>
                )}
                {!mod.objectives && !mod.outcomes && !mod.outline && !mod.rubric && !mod.rubricCriteria?.length && !mod.additionalMaterials && (
                  <p className="text-sm text-gray-500 italic col-span-2">No detailed module information provided.</p>
                )}
                {mod.additionalMaterials && mod.additionalMaterials.length > 0 && (
                  <div className="bg-gray-100 p-4 rounded-xl col-span-2 mt-4">
                    <h4 className="text-xs font-black text-[#2A8F62] uppercase mb-3 flex items-center gap-2">
                      <span className="text-base">📚</span> Additional Materials
                    </h4>
                    <ul className="space-y-2">
                      {mod.additionalMaterials.map((material, idx) => (
                        <li key={idx} className="flex items-center justify-between p-3 bg-white rounded-xl">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="text-sm">
                                {material.type === 'video' ? '🎥' : material.type === 'book' ? '📖' : '📄'}
                              </span>
                              <span className="text-xs font-bold text-gray-800">{material.title}</span>
                            </div>
                            {material.author && (
                              <span className="text-[10px] text-gray-500 font-medium ml-6">By {material.author}</span>
                            )}
                          </div>
                          {material.url && (
                            <a
                              href={material.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] font-black text-black bg-white border-2 border-black px-2 py-1 rounded-full hover:bg-[#2E9DF7] hover:text-white transition-colors"
                            >
                              View
                            </a>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-8 border-[3px] border-black">
              <h3 className="text-lg font-black text-black mb-2 flex items-center gap-2">
                <span className="w-8 h-8 rounded-full border-2 border-black bg-[#E0F2FE] flex items-center justify-center text-sm">📹</span>
                Video Task Tracker
              </h3>
              {videoTask?.title && (
                <p className="text-xs text-gray-500 font-bold mb-4">Assigned task: {videoTask.title}</p>
              )}
              {videoTask ? (
                <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      placeholder="Video URL (e.g. YouTube/Drive)"
                      className="w-full bg-gray-100 rounded-xl p-4 text-xs focus:ring-2 focus:ring-[#3DDC97] transition-all"
                    />
                  </div>
                  <select
                    value={videoTask?.status || 'pending'}
                    onChange={(e) => handleSaveVideo(e.target.value as any)}
                    className="bg-gray-100 rounded-xl p-4 text-xs font-bold text-gray-700"
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                  <button
                    onClick={() => handleSaveVideo()}
                    disabled={!videoUrl.trim()}
                    className="bg-[#2E9DF7] text-white font-black uppercase text-xs tracking-wide px-5 py-4 rounded-xl border-2 border-black hover:bg-black transition-colors disabled:opacity-40 disabled:hover:bg-[#2E9DF7]"
                  >
                    Save Link
                  </button>
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">No video task has been assigned to you for this module yet - check with an admin.</p>
              )}
            </div>

            <div className="space-y-6">
              <h3 className="text-lg font-black text-black flex items-center gap-2">
                <span className="w-8 h-8 rounded-full border-2 border-black bg-[#FEE2E2] flex items-center justify-center text-sm">📝</span>
                Student Submissions
              </h3>

              {modSubmissions.length === 0 ? (
                <p className="text-gray-400 font-medium italic">No submissions for this module yet.</p>
              ) : (
                modSubmissions.map(sub => {
                  const student = users.find(u => u.id === sub.userId);
                  const grade = grades.find(g => g.submissionId === sub.id);
                  return (
                    <SubmissionCard
                      key={sub.id}
                      sub={sub}
                      student={student}
                      grade={grade}
                      module={mod}
                      score={score[sub.id]}
                      feedback={feedback[sub.id]}
                      criterionScores={criterionScores[sub.id]}
                      onScoreChange={(s) => setScore({ ...score, [sub.id]: s })}
                      onFeedbackChange={(f) => setFeedback({ ...feedback, [sub.id]: f })}
                      onCriterionScore={(cId, s) => setCriterionScore(sub.id, cId, s)}
                      onGrade={() => handleGrade(sub.id, mod)}
                    />
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
};
