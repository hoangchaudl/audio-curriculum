import React, { useState } from 'react';
import { useAppContext } from '../store';

export const ModuleView: React.FC<{ moduleId: string }> = ({ moduleId }) => {
  const { modules, currentUser, submissions, moduleVideos, grades, submitHomework } = useAppContext();
  const [linkInput, setLinkInput] = useState('');
  
  const mod = modules.find(m => m.id === moduleId);
  const sub = submissions.find(s => s.moduleId === moduleId && s.userId === currentUser?.id);
  const video = moduleVideos.find(v => v.moduleId === moduleId);
  const grade = sub ? grades.find(g => g.submissionId === sub.id) : null;

  if (!mod) return <div className="p-10">Module not found</div>;

  const handleSubmit = () => {
    if (linkInput.trim()) {
      submitHomework(moduleId, linkInput);
      setLinkInput('');
    }
  };

  const completedCount = submissions.filter(s => s.userId === currentUser?.id && s.status === 'graded').length;
  const progressPercent = Math.round((completedCount / modules.length) * 100);

  return (
    <main className="flex-1 flex flex-col min-w-0">
      {/* Top Navbar */}
      <header className="h-20 bg-white border-b flex items-center justify-between px-10 flex-shrink-0">
        <div>
          <h2 className="text-2xl font-black text-[#2E9DF7]">Module {mod.label || mod.order.toString().padStart(2, '0')}: {mod.title}</h2>
          <p className="text-xs text-gray-400 font-medium flex items-center gap-2 mt-1">
            Estimated Time: 3 Weeks • Status:{' '}
            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
              sub?.status === 'graded' ? 'bg-[#3DDC97]/20 text-[#2A8F62]' :
              sub?.status === 'submitted' ? 'bg-[#2E9DF7]/20 text-[#1E40AF]' :
              sub?.status === 'in_progress' ? 'bg-[#F4511E]/20 text-[#C53914]' :
              'bg-gray-100 text-gray-500'
            }`}>
              {sub ? sub.status.replace('_', ' ') : 'Not Started'}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase font-bold text-gray-400">Your Pod</span>
            <span className="text-sm font-bold">{currentUser?.pod || 'Unassigned'}</span>
          </div>
          <div className="w-12 h-12 bg-[#F4511E] rounded-full flex items-center justify-center shadow-lg cursor-pointer relative flex-shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M12 22a2 2 0 0 0 2-2H10a2 2 0 0 0 2 2zm6-6V10c0-3.07-1.63-5.64-4.5-6.32V3c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 4.36 6 6.92 6 10v6l-2 2v1h16v-1l-2-2z"/></svg>
            <span className="absolute top-0 right-0 w-4 h-4 bg-[#3DDC97] border-2 border-white rounded-full"></span>
          </div>
        </div>
      </header>

      {/* Page Layout */}
      <div className="flex-1 p-10 flex gap-8 overflow-y-auto">
        {/* Content Section */}
        <div className="flex-1 space-y-6">
          {video ? (
            <div className="aspect-video bg-[#2D2D2D] rounded-[40px] shadow-2xl relative overflow-hidden flex items-center justify-center">
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none"></div>
              <button className="w-20 h-20 bg-[#2E9DF7] rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(46,157,247,0.5)] hover:scale-105 transition-transform">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
              </button>
              <div className="absolute bottom-6 left-8 text-white pointer-events-none">
                <p className="text-xs font-bold uppercase tracking-wider opacity-80">Video Tutorial</p>
                <h3 className="text-lg font-bold">{video.title}</h3>
              </div>
            </div>
          ) : (
            <div className="aspect-video bg-gray-100 rounded-[40px] shadow-sm relative overflow-hidden flex items-center justify-center border-2 border-dashed border-gray-300">
               <p className="text-gray-400 font-bold">Video coming soon</p>
            </div>
          )}

          {/* Module Description */}
          <div className="bg-white rounded-[32px] p-8 border border-gray-100 shadow-sm">
            <h4 className="text-sm font-black uppercase text-[#2E9DF7] mb-3 tracking-widest">About this Module</h4>
            <p className="text-gray-600 leading-relaxed whitespace-pre-wrap mb-6">
              {mod.textContent}
            </p>
            
            {(mod.objectives || mod.outcomes) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-gray-100">
                {mod.objectives && mod.objectives.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 tracking-widest">Objectives</h4>
                    <ul className="list-disc pl-5 space-y-2 text-sm text-gray-700">
                      {mod.objectives.map((obj, i) => (
                        <li key={i}>{obj}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {mod.outcomes && mod.outcomes.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 tracking-widest">Outcomes</h4>
                    <ul className="list-disc pl-5 space-y-2 text-sm text-gray-700">
                      {mod.outcomes.map((out, i) => (
                        <li key={i}>{out}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Additional Materials */}
          {mod.additionalMaterials && mod.additionalMaterials.length > 0 && (
            <div className="bg-white rounded-[32px] p-8 border border-gray-100 shadow-sm">
              <h4 className="text-sm font-black uppercase text-[#3DDC97] mb-4 tracking-widest flex items-center gap-2">
                <span className="text-xl">📚</span> Additional Materials
              </h4>
              <ul className="space-y-3">
                {mod.additionalMaterials.map((material, idx) => (
                  <li key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">
                          {material.type === 'video' ? '🎥' : material.type === 'book' ? '📖' : '📄'}
                        </span>
                        <span className="text-sm font-bold text-gray-800">{material.title}</span>
                      </div>
                      {material.author && (
                        <span className="text-xs text-gray-500 font-medium ml-7">By {material.author}</span>
                      )}
                    </div>
                    {material.url && (
                      <a 
                        href={material.url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-xs font-bold text-[#2E9DF7] bg-[#E0F2FE] px-3 py-1.5 rounded-full hover:bg-[#2E9DF7] hover:text-white transition-colors"
                      >
                        View Link
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Right Interaction Panel (Gadget Pocket Style) */}
        <div className="w-80 space-y-6 flex-shrink-0">
          {/* Progress Pocket */}
          <div className="bg-[#F5F9FF] border-4 border-white rounded-[40px] p-6 shadow-xl relative">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-10 bg-white rounded-full border-4 border-[#F5F9FF] flex items-center justify-center shadow-sm">
              <span className="text-[10px] font-black text-[#2E9DF7] tracking-tighter uppercase">Gadget Pocket</span>
            </div>
            
            <div className="pt-4 space-y-4">
              <div>
                <div className="flex justify-between text-xs font-bold mb-2">
                  <span className="text-gray-500">Course Completion</span>
                  <span className="text-[#3DDC97]">{progressPercent}%</span>
                </div>
                <div className="w-full h-3 bg-white rounded-full overflow-hidden">
                  <div className="h-full bg-[#3DDC97] rounded-full transition-all duration-1000" style={{ width: `${progressPercent}%` }}></div>
                </div>
              </div>

              <div className="flex gap-2 justify-center">
                {[1, 2, 3, 4].map(star => (
                  <div key={star} className={`w-8 h-8 rounded-full flex items-center justify-center text-xs shadow-sm ${grade && grade.score >= star ? 'bg-white' : 'bg-[#E0F2FE] border border-dashed border-[#2E9DF7] opacity-50'}`}>
                    ⭐
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Homework Materials */}
          {mod.homeworkLink && (
            <div className="bg-[#E0F2FE] rounded-[40px] p-6 shadow-sm border-2 border-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#2E9DF7] rounded-full opacity-10 translate-x-8 -translate-y-8 pointer-events-none"></div>
              <h4 className="text-sm font-black mb-3 uppercase text-[#1E40AF] flex items-center gap-2">
                <span className="text-xl">📁</span> Assignment Materials
              </h4>
              <p className="text-[11px] text-[#1E40AF]/80 mb-4 font-medium leading-relaxed">
                {mod.homeworkDescription || 'Download the files needed for this module\'s homework.'}
              </p>
              <a 
                href={mod.homeworkLink} 
                target="_blank" 
                rel="noreferrer"
                className="block w-full bg-white text-[#2E9DF7] text-center font-bold py-3 rounded-2xl shadow-sm hover:shadow-md transition-shadow text-xs border border-[#2E9DF7]/20"
              >
                Open Google Drive
              </a>
            </div>
          )}

          {/* Submission Card */}
          <div className="bg-white rounded-[40px] p-6 shadow-lg border-2 border-gray-50">
            <h4 className="text-sm font-black text-center mb-4 uppercase text-[#F4511E]">Submit Homework</h4>
            <p className="text-[11px] text-gray-400 text-center mb-6">Paste your Google Drive link with the .WAV bounce of the exercise.</p>
            
            <input 
              type="text" 
              value={linkInput}
              onChange={(e) => setLinkInput(e.target.value)}
              placeholder="drive.google.com/share/..." 
              disabled={sub?.status === 'graded'}
              className="w-full bg-gray-50 border-none rounded-2xl p-4 text-xs mb-4 focus:ring-2 focus:ring-[#2E9DF7] transition-all disabled:opacity-50"
            />
            
            <button 
              onClick={handleSubmit}
              disabled={sub?.status === 'graded' || !linkInput.trim()}
              className="w-full bg-[#F4511E] text-white font-bold py-4 rounded-2xl shadow-[0_6px_0_#C53914] active:shadow-none active:translate-y-[2px] transition-all text-sm disabled:opacity-50 disabled:active:shadow-[0_6px_0_#C53914] disabled:active:translate-y-0"
            >
              {sub?.status === 'graded' ? 'Graded' : sub ? 'Resubmit' : 'Send to Engineer'}
            </button>
            
            {sub && (
              <div className="mt-6 pt-6 border-t border-dashed">
                <div className="flex flex-col gap-2">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Current Submission</p>
                  <a href={sub.driveLink} target="_blank" rel="noreferrer" className="text-xs font-bold text-[#2E9DF7] truncate hover:underline">
                    {sub.driveLink}
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Status Message */}
          {grade && (
             <div className="bg-[#3DDC97]/10 p-4 rounded-3xl border border-[#3DDC97]/20 flex flex-col gap-2">
               <div className="flex items-center gap-3">
                 <span className="text-xl">✨</span>
                 <p className="text-[11px] font-bold text-[#2A8F62]">Nice work — This module was graded {grade.score}/4!</p>
               </div>
               {grade.feedback && (
                 <p className="text-xs text-[#2A8F62] italic border-t border-[#3DDC97]/20 pt-2 mt-1">"{grade.feedback}"</p>
               )}
             </div>
          )}
        </div>
      </div>
    </main>
  );
};
