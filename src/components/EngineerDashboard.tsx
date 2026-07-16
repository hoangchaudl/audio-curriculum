import React, { useState } from 'react';
import { useAppContext } from '../store';

export const EngineerDashboard: React.FC<{ moduleId: string }> = ({ moduleId }) => {
  const { modules, users, submissions, grades, videoTasks, currentUser, gradeHomework, updateVideoTask } = useAppContext();
  
  const mod = modules.find(m => m.id === moduleId);
  const modSubmissions = submissions.filter(s => s.moduleId === moduleId);
  const videoTask = videoTasks.find(t => t.moduleId === moduleId);

  const [score, setScore] = useState<Record<string, 1 | 2 | 3 | 4>>({});
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [videoUrl, setVideoUrl] = useState(videoTask?.videoUrl || '');

  if (!mod) return <div className="p-10">Module not found</div>;

  const handleGrade = (subId: string) => {
    if (score[subId] && feedback[subId]) {
      gradeHomework(subId, score[subId], feedback[subId]);
    }
  };

  const handleUpdateVideo = (status: 'not_started' | 'in_progress' | 'uploaded') => {
    const taskId = videoTask ? videoTask.id : `vt_${Date.now()}`;
    updateVideoTask(taskId, status, videoUrl);
  };

  return (
    <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
      <header className="h-20 bg-white border-b flex items-center justify-between px-10 flex-shrink-0">
        <div>
          <h2 className="text-2xl font-black text-[#2E9DF7]">Module {mod.label || mod.order.toString().padStart(2, '0')} Tasks</h2>
          <p className="text-xs text-gray-400 font-medium">
            Submissions: {modSubmissions.length} • Pending Review: {modSubmissions.filter(s => s.status === 'submitted').length}
          </p>
        </div>
      </header>

      <div className="flex-1 p-10 flex flex-col gap-8 overflow-y-auto">
        <div className="bg-white rounded-[32px] p-8 border border-gray-100 shadow-sm">
           <h3 className="text-lg font-black text-[#2E9DF7] mb-4 flex items-center gap-2">
             <span className="w-8 h-8 rounded-full bg-[#E0F2FE] flex items-center justify-center text-sm">📘</span>
             Module Details
           </h3>
           <div className="grid grid-cols-2 gap-6">
             {mod.objectives && (
               <div className="bg-gray-50 p-4 rounded-2xl">
                 <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Objectives</h4>
                 <ul className="list-disc pl-4 text-sm text-gray-700 space-y-1">
                   {mod.objectives.map((obj, i) => <li key={i}>{obj}</li>)}
                 </ul>
               </div>
             )}
             {mod.outcomes && (
               <div className="bg-gray-50 p-4 rounded-2xl">
                 <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Outcomes</h4>
                 <ul className="list-disc pl-4 text-sm text-gray-700 space-y-1">
                   {mod.outcomes.map((out, i) => <li key={i}>{out}</li>)}
                 </ul>
               </div>
             )}
             {mod.outline && (
               <div className="bg-gray-50 p-4 rounded-2xl col-span-2">
                 <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Outline</h4>
                 <div className="flex flex-wrap gap-2">
                   {mod.outline.map((item, i) => (
                     <span key={i} className="bg-white border border-gray-200 px-3 py-1 rounded-full text-xs font-bold text-gray-600">{item}</span>
                   ))}
                 </div>
               </div>
             )}
             {mod.rubric && (
               <div className="bg-gray-50 p-4 rounded-2xl col-span-2">
                 <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Grading Rubric</h4>
                 <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{mod.rubric}</p>
               </div>
             )}
             {!mod.objectives && !mod.outcomes && !mod.outline && !mod.rubric && !mod.additionalMaterials && (
                <p className="text-sm text-gray-500 italic col-span-2">No detailed module information provided.</p>
             )}
             {mod.additionalMaterials && mod.additionalMaterials.length > 0 && (
               <div className="bg-gray-50 p-4 rounded-2xl col-span-2 mt-4">
                 <h4 className="text-xs font-bold text-[#3DDC97] uppercase mb-3 flex items-center gap-2">
                   <span className="text-base">📚</span> Additional Materials
                 </h4>
                 <ul className="space-y-2">
                   {mod.additionalMaterials.map((material, idx) => (
                     <li key={idx} className="flex items-center justify-between p-3 bg-white rounded-xl shadow-sm border border-gray-100">
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
                           className="text-[10px] font-bold text-[#2E9DF7] bg-[#E0F2FE] px-2 py-1 rounded-full hover:bg-[#2E9DF7] hover:text-white transition-colors"
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

        <div className="bg-white rounded-[32px] p-8 border border-gray-100 shadow-sm">
          <h3 className="text-lg font-black text-[#2E9DF7] mb-6 flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-[#E0F2FE] flex items-center justify-center text-sm">📹</span> 
            Video Task Tracker
          </h3>
          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <input 
                type="text" 
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="Video URL (e.g. YouTube/Drive)" 
                className="w-full bg-gray-50 border-none rounded-2xl p-4 text-xs focus:ring-2 focus:ring-[#2E9DF7] transition-all"
              />
            </div>
            <select 
              value={videoTask?.status || 'pending'}
              onChange={(e) => handleUpdateVideo(e.target.value as any)}
              className="bg-gray-50 border-none rounded-2xl p-4 text-xs font-bold text-gray-700"
            >
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        <div className="space-y-6">
          <h3 className="text-lg font-black text-[#F4511E] flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-[#FEE2E2] flex items-center justify-center text-sm text-[#F4511E]">📝</span>
            Student Submissions
          </h3>
          
          {modSubmissions.length === 0 ? (
            <p className="text-gray-400 font-medium italic">No submissions for this module yet.</p>
          ) : (
            modSubmissions.map(sub => {
              const student = users.find(u => u.id === sub.userId);
              const grade = grades.find(g => g.submissionId === sub.id);
              
              return (
                <div key={sub.id} className="bg-white rounded-[32px] p-6 shadow-sm border-2 border-gray-50 flex flex-col gap-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      {student?.avatarBase64 ? (
                        <img src={student.avatarBase64} alt="Avatar" className="w-10 h-10 rounded-full object-cover shadow-sm" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-[#2E9DF7] flex items-center justify-center text-white font-bold text-xs shadow-sm flex-shrink-0">
                          {student?.name.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-bold">{student?.name}</p>
                        <p className="text-[10px] text-gray-400 font-bold uppercase">{student?.pod}</p>
                      </div>
                    </div>
                    <div>
                      {sub.status === 'graded' ? (
                        <span className="bg-[#3DDC97]/20 text-[#2A8F62] px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">Graded</span>
                      ) : (
                        <span className="bg-[#F4511E]/20 text-[#C53914] px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider animate-pulse">Needs Review</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-2xl">
                    <p className="text-xs text-gray-500 mb-1 font-bold">Homework Link:</p>
                    <a href={sub.driveLink} target="_blank" rel="noreferrer" className="text-sm text-[#2E9DF7] font-medium hover:underline break-all">
                      {sub.driveLink}
                    </a>
                  </div>

                  {sub.status === 'graded' && grade ? (
                    <div className="bg-[#E0F2FE] p-4 rounded-2xl border border-[#2E9DF7]/20">
                      <div className="flex justify-between mb-2">
                        <span className="text-xs font-bold text-[#1E40AF]">Score: {grade.score}/4</span>
                      </div>
                      <p className="text-sm text-[#1E40AF] italic">"{grade.feedback}"</p>
                    </div>
                  ) : (
                    <div className="flex gap-4 items-start border-t border-dashed pt-4 mt-2">
                      <div className="w-32">
                        <select 
                          value={score[sub.id] || ''}
                          onChange={(e) => setScore({ ...score, [sub.id]: parseInt(e.target.value) as any })}
                          className="w-full bg-gray-50 border-none rounded-2xl p-3 text-sm font-bold text-gray-700"
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
                          value={feedback[sub.id] || ''}
                          onChange={(e) => setFeedback({ ...feedback, [sub.id]: e.target.value })}
                          className="w-full bg-gray-50 border-none rounded-2xl p-3 text-sm focus:ring-2 focus:ring-[#2E9DF7] min-h-[80px]"
                        />
                      </div>
                      <button 
                        onClick={() => handleGrade(sub.id)}
                        disabled={!score[sub.id] || !feedback[sub.id]}
                        className="bg-[#2E9DF7] text-white font-bold px-6 py-4 rounded-2xl shadow-[0_4px_0_#1b85df] active:shadow-none active:translate-y-[2px] transition-all text-sm disabled:opacity-50 disabled:active:shadow-[0_4px_0_#1b85df] disabled:active:translate-y-0 h-full self-stretch flex items-center"
                      >
                        Submit Grade
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </main>
  );
};
