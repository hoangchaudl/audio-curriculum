import React, { useState } from 'react';
import { useAppContext } from '../store';

export const AdminDashboard: React.FC = () => {
  const { users, modules, submissions, grades, videoTasks } = useAppContext();
  const [activeTab, setActiveTab] = useState<'designers' | 'engineers'>('designers');

  const designers = users.filter(u => u.role === 'sound_designer');
  const engineers = users.filter(u => u.role === 'audio_engineer');

  return (
    <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#FDFDFB]">
      <header className="h-20 bg-white border-b flex items-center px-10 flex-shrink-0">
        <h2 className="text-2xl font-black text-[#2E9DF7]">Director Dashboard</h2>
      </header>

      <div className="flex-1 overflow-y-auto p-10 space-y-8">
        {/* Tabs */}
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('designers')}
            className={`px-6 py-2 rounded-full font-bold transition-all ${
              activeTab === 'designers'
                ? 'bg-[#2E9DF7] text-white shadow-md'
                : 'bg-white text-gray-500 hover:bg-gray-50'
            }`}
          >
            Sound Designers
          </button>
          <button
            onClick={() => setActiveTab('engineers')}
            className={`px-6 py-2 rounded-full font-bold transition-all ${
              activeTab === 'engineers'
                ? 'bg-[#F4511E] text-white shadow-md'
                : 'bg-white text-gray-500 hover:bg-gray-50'
            }`}
          >
            Audio Engineers
          </button>
        </div>

        {activeTab === 'designers' && (
          <div className="space-y-6">
            <h3 className="text-lg font-black uppercase text-gray-800 tracking-wider">Designer Progress Overview</h3>
            <div className="grid gap-6">
              {designers.map(designer => {
                const userSubmissions = submissions.filter(s => s.userId === designer.id);
                const progress = Math.round((userSubmissions.length / modules.length) * 100);
                const userGrades = grades.filter(g => userSubmissions.some(s => s.id === g.submissionId));
                const averageScore = userGrades.length > 0
                  ? (userGrades.reduce((acc, g) => acc + g.score, 0) / userGrades.length).toFixed(1)
                  : 'N/A';

                return (
                  <div key={designer.id} className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col gap-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="font-bold text-lg">{designer.name}</h4>
                        <p className="text-sm text-gray-500">{designer.pod || 'No Pod Assigned'} • {designer.email}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-black text-[#3DDC97]">{averageScore} <span className="text-sm text-gray-400 font-medium">Avg Score</span></div>
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex justify-between text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">
                        <span>Course Progress</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-[#2E9DF7] rounded-full" style={{ width: `${progress}%` }}></div>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t flex gap-2 flex-wrap">
                      {modules.sort((a, b) => a.order - b.order).map(mod => {
                        const sub = userSubmissions.find(s => s.moduleId === mod.id);
                        const grade = sub ? grades.find(g => g.submissionId === sub.id) : null;
                        
                        let badgeColor = 'bg-gray-100 text-gray-400 border-gray-200';
                        let scoreText = '-';
                        if (sub?.status === 'graded') {
                          badgeColor = 'bg-[#3DDC97]/20 text-[#2A8F62] border-[#3DDC97]/30';
                          scoreText = grade?.score.toString() || '?';
                        } else if (sub?.status === 'submitted') {
                          badgeColor = 'bg-[#E0F2FE] text-[#1E40AF] border-[#2E9DF7]/30';
                          scoreText = 'Rev';
                        }

                        return (
                          <div key={mod.id} className={`w-10 h-10 rounded-xl border flex items-center justify-center text-xs font-bold ${badgeColor}`} title={mod.title}>
                            {scoreText}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'engineers' && (
          <div className="space-y-6">
            <h3 className="text-lg font-black uppercase text-gray-800 tracking-wider">Engineer Video Tasks</h3>
            <div className="grid gap-6">
              {engineers.map(engineer => {
                const assignedTasks = videoTasks.filter(vt => vt.engineerId === engineer.id);
                const completedCount = assignedTasks.filter(vt => vt.status === 'completed').length;
                const totalCount = assignedTasks.length;

                return (
                  <div key={engineer.id} className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                    <div className="flex justify-between items-center mb-6">
                      <div>
                        <h4 className="font-bold text-lg">{engineer.name}</h4>
                        <p className="text-sm text-gray-500">{engineer.email}</p>
                      </div>
                      <div className="bg-[#FFF4ED] px-4 py-2 rounded-2xl">
                        <span className="font-black text-[#F4511E]">{completedCount} / {totalCount}</span>
                        <span className="text-xs text-[#F4511E]/70 font-bold ml-2">Tasks Completed</span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {assignedTasks.map(task => (
                        <div key={task.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl">
                          <div>
                            <p className="font-bold text-sm">{task.title}</p>
                            <p className="text-xs text-gray-500 font-medium">Assigned: {new Date(task.assignedAt).toLocaleDateString()}</p>
                          </div>
                          <div>
                            {task.status === 'completed' && <span className="bg-[#3DDC97]/20 text-[#2A8F62] px-3 py-1 rounded-full text-xs font-bold">Completed</span>}
                            {task.status === 'in_progress' && <span className="bg-[#E0F2FE] text-[#1E40AF] px-3 py-1 rounded-full text-xs font-bold">In Progress</span>}
                            {task.status === 'pending' && <span className="bg-gray-200 text-gray-600 px-3 py-1 rounded-full text-xs font-bold">Pending</span>}
                          </div>
                        </div>
                      ))}
                      {assignedTasks.length === 0 && (
                        <p className="text-sm text-gray-400 italic text-center py-4">No video tasks assigned.</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </main>
  );
};
