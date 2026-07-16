import React, { useState } from 'react';
import { useAppContext } from '../store';

export const AdminDashboard: React.FC = () => {
  const { users, modules, submissions, grades, videoTasks, updateModule } = useAppContext();
  const [activeTab, setActiveTab] = useState<'designers' | 'engineers' | 'modules'>('modules');
  
  const designers = users.filter(u => u.role === 'sound_designer');
  const engineers = users.filter(u => u.role === 'audio_engineer');

  const [editingModule, setEditingModule] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});

  const handleEditClick = (mod: any) => {
    setEditingModule(mod.id);
    setEditForm({ ...mod });
  };

  const handleSaveModule = () => {
    if (editingModule) {
      updateModule(editingModule, editForm);
      setEditingModule(null);
    }
  };

  const newVideosCount = videoTasks.filter(vt => vt.status === 'completed').length;

  return (
    <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#FDFDFB]">
      <header className="h-20 bg-white border-b flex items-center justify-between px-10 flex-shrink-0">
        <h2 className="text-2xl font-black text-[#2E9DF7]">Director Dashboard</h2>
        <div className="flex items-center gap-4">
          <div className="relative cursor-pointer hover:bg-gray-50 p-2 rounded-full transition-colors" title="Notifications" onClick={() => setActiveTab('engineers')}>
            <span className="text-xl">🔔</span>
            {newVideosCount > 0 && (
              <span className="absolute top-1 right-1 bg-red-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                {newVideosCount}
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-10 space-y-8">
        {/* Tabs */}
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('modules')}
            className={`px-6 py-2 rounded-full font-bold transition-all ${
              activeTab === 'modules'
                ? 'bg-[#3DDC97] text-white shadow-md'
                : 'bg-white text-gray-500 hover:bg-gray-50'
            }`}
          >
            Curriculum (Modules)
          </button>
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
                            {task.status === 'completed' && task.videoUrl && (
                              <a href={task.videoUrl} target="_blank" rel="noreferrer" className="inline-block mt-2 text-xs font-bold text-[#2E9DF7] bg-[#E0F2FE] px-3 py-1.5 rounded-full hover:bg-[#2E9DF7] hover:text-white transition-colors">
                                ▶ Watch Video
                              </a>
                            )}
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
        {activeTab === 'modules' && (
          <div className="space-y-6">
            <h3 className="text-lg font-black uppercase text-gray-800 tracking-wider">Curriculum Management</h3>
            <div className="grid gap-6">
              {modules.sort((a, b) => a.order - b.order).map((mod) => (
                <div key={mod.id} className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                  {editingModule === mod.id ? (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Title</label>
                        <input
                          type="text"
                          value={editForm.title || ''}
                          onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                          className="w-full bg-gray-50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-[#3DDC97] transition-all font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description</label>
                        <textarea
                          value={editForm.description || ''}
                          onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                          className="w-full bg-gray-50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-[#3DDC97] transition-all font-medium h-20"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Text Content</label>
                        <textarea
                          value={editForm.textContent || ''}
                          onChange={(e) => setEditForm({ ...editForm, textContent: e.target.value })}
                          className="w-full bg-gray-50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-[#3DDC97] transition-all font-medium h-24"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Learning Objectives (comma separated)</label>
                        <input
                          type="text"
                          value={editForm.objectives?.join(', ') || ''}
                          onChange={(e) => setEditForm({ ...editForm, objectives: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean) })}
                          className="w-full bg-gray-50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-[#3DDC97] transition-all font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Outcomes (comma separated)</label>
                        <input
                          type="text"
                          value={editForm.outcomes?.join(', ') || ''}
                          onChange={(e) => setEditForm({ ...editForm, outcomes: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean) })}
                          className="w-full bg-gray-50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-[#3DDC97] transition-all font-medium"
                        />
                      </div>
                      
                      {/* Very basic additional materials editor (JSON string for simplicity in prototype) */}
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Additional Materials (JSON format)</label>
                        <textarea
                          value={JSON.stringify(editForm.additionalMaterials || [], null, 2)}
                          onChange={(e) => {
                            try {
                              const parsed = JSON.parse(e.target.value);
                              setEditForm({ ...editForm, additionalMaterials: parsed });
                            } catch (err) {
                              // Ignore invalid JSON while typing
                            }
                          }}
                          className="w-full bg-gray-50 border-none rounded-xl p-3 text-xs focus:ring-2 focus:ring-[#3DDC97] transition-all font-mono h-32"
                        />
                        <p className="text-[10px] text-gray-400 mt-1">Note: Must be valid JSON. e.g. [{`{"type": "video", "title": "Example", "url": "https://..."}`}]</p>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={handleSaveModule}
                          className="bg-[#3DDC97] text-white font-bold py-2 px-6 rounded-xl hover:bg-[#2A8F62] transition-colors"
                        >
                          Save Changes
                        </button>
                        <button
                          onClick={() => setEditingModule(null)}
                          className="bg-gray-200 text-gray-700 font-bold py-2 px-6 rounded-xl hover:bg-gray-300 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <span className="bg-[#E0F2FE] text-[#1E40AF] px-3 py-1 rounded-full text-xs font-black uppercase">
                            Module {mod.label || mod.order.toString().padStart(2, '0')}
                          </span>
                          <h4 className="font-bold text-lg">{mod.title}</h4>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{mod.description}</p>
                        
                        <div className="flex gap-4 text-xs font-bold text-gray-400 uppercase">
                          <span>{mod.objectives?.length || 0} Objectives</span>
                          <span>{mod.additionalMaterials?.length || 0} Resources</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleEditClick(mod)}
                        className="bg-white border-2 border-[#E0F2FE] text-[#2E9DF7] hover:bg-[#E0F2FE] font-bold py-2 px-4 rounded-xl transition-colors"
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
};
