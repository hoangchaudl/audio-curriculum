import React, { useState } from 'react';
import { useAppContext } from '../store';
import { Resource, RubricCriterion } from '../types';

const splitPeriodList = (text: string) => text.split('.').map(s => s.trim()).filter(Boolean);
const splitLines = (text: string) => text.split('\n').map(s => s.trim()).filter(Boolean);
const CATEGORIES = ['Onboarding', 'Intermediate', 'Advanced'] as const;

// Parses a rubric pasted as plain text (e.g. copied out of Notion) into
// structured criteria. Expected shape per sub-skill:
//   Rubric (1 = Just Starting · 4 = Strong · 3+ = pass)   <- optional note
//   Sub-skill 1: DX chain order
//   Score  What it looks like in the session              <- optional column label
//   1  Plugins in no deliberate order...
//   ...
//   4  Chain is correct and minimal...
// Lines that don't start a new score are treated as the previous
// descriptor wrapping onto the next line.
const parseRubricText = (text: string): { note?: string; criteria: RubricCriterion[] } => {
  const criteria: RubricCriterion[] = [];
  let note: string | undefined;
  let current: RubricCriterion | null = null;
  let lastLevel = -1;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\*\*/g, '').trim();
    if (!line) continue;
    const subMatch = line.match(/^sub-?skill\s*\d*\s*[:.\-]\s*(.+)$/i);
    const headerMatch = line.match(/^score[\t ]+(.+)/i);
    const levelMatch = line.match(/^([1-4])[\t.):]\s*(.+)/) || line.match(/^([1-4])\s+(.+)/);
    if (!current && /^rubric\b/i.test(line)) {
      const inParens = line.match(/\((.+)\)/);
      note = (inParens ? inParens[1] : line.replace(/^rubric\s*/i, '')).trim() || undefined;
    } else if (subMatch) {
      current = { id: `rc_${criteria.length + 1}_${Date.now()}`, title: subMatch[1].trim(), levels: ['', '', '', ''] };
      criteria.push(current);
      lastLevel = -1;
    } else if (current && headerMatch) {
      current.scoreLabel = headerMatch[1].trim();
    } else if (current && levelMatch) {
      lastLevel = parseInt(levelMatch[1]) - 1;
      current.levels[lastLevel] = levelMatch[2].trim();
    } else if (current && lastLevel >= 0) {
      current.levels[lastLevel] = `${current.levels[lastLevel]} ${line}`.trim();
    }
  }
  return { note, criteria };
};

// Admins just paste a link or type a book/article title, one per line - we
// infer the resource type instead of asking them to hand-write JSON.
const parseMaterialsText = (text: string): Resource[] =>
  text.split('\n').map(s => s.trim()).filter(Boolean).map(line => {
    const isUrl = /^(https?:\/\/|www\.)/i.test(line);
    if (!isUrl) return { type: 'book', title: line };
    const isVideo = /youtube\.com|youtu\.be|vimeo\.com/i.test(line);
    return { type: isVideo ? 'video' : 'article', title: line, url: line };
  });

const materialsToText = (materials: Resource[] = []) => materials.map(r => r.url || r.title).join('\n');

const CARD_THEMES = [
  { bg: '#BFE3FF', accent: '#2E9DF7' },
  { bg: '#FFE9A8', accent: '#F5A623' },
  { bg: '#BEF2D6', accent: '#2A9D6F' },
  { bg: '#E3D3FF', accent: '#8B5CF6' },
  { bg: '#FFD1DC', accent: '#EF4F82' },
  { bg: '#FFD9BE', accent: '#F4511E' },
];

const getInitials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();

export const AdminDashboard: React.FC = () => {
  const {
    users, modules, moduleVideos, submissions, grades, videoTasks,
    updateModule, updateUserRole, createModule, deleteModule, upsertModuleVideo, deleteModuleVideo, createVideoTask,
  } = useAppContext();
  const [activeTab, setActiveTab] = useState<'designers' | 'engineers' | 'modules'>('modules');

  // Per-engineer draft for the "assign a video task" form on the Engineers
  // tab - keyed by engineer id so each card's inputs are independent.
  const [assignDraft, setAssignDraft] = useState<Record<string, { moduleId: string; title: string }>>({});
  const getAssignDraft = (engineerId: string) => assignDraft[engineerId] || { moduleId: modules[0]?.id || '', title: '' };
  const setAssignField = (engineerId: string, field: 'moduleId' | 'title', value: string) => {
    setAssignDraft(d => ({ ...d, [engineerId]: { ...getAssignDraft(engineerId), [field]: value } }));
  };
  const handleAssignTask = (engineerId: string) => {
    const draft = getAssignDraft(engineerId);
    if (!draft.moduleId || !draft.title.trim()) return;
    createVideoTask(engineerId, draft.moduleId, draft.title.trim());
    setAssignDraft(d => ({ ...d, [engineerId]: { moduleId: draft.moduleId, title: '' } }));
  };

  const designers = users.filter(u => u.role === 'sound_designer');
  const engineers = users.filter(u => u.role === 'audio_engineer');

  const [editingModule, setEditingModule] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [objectivesText, setObjectivesText] = useState('');
  const [outcomesText, setOutcomesText] = useState('');
  const [materialsText, setMaterialsText] = useState('');
  const [outlineText, setOutlineText] = useState('');
  const [rubricCriteria, setRubricCriteria] = useState<RubricCriterion[]>([]);
  const [rubricPaste, setRubricPaste] = useState('');
  const [videoType, setVideoType] = useState<'internal' | 'external'>('external');
  const [videoTitle, setVideoTitle] = useState('');
  const [videoUrl, setVideoUrl] = useState('');

  const handleEditClick = (mod: any) => {
    setEditingModule(mod.id);
    setEditForm({ ...mod });
    setObjectivesText((mod.objectives || []).join('. '));
    setOutcomesText((mod.outcomes || []).join('. '));
    setMaterialsText(materialsToText(mod.additionalMaterials));
    setOutlineText((mod.outline || []).join('\n'));
    setRubricCriteria(mod.rubricCriteria || []);
    setRubricPaste('');
    const video = moduleVideos.find(v => v.moduleId === mod.id);
    setVideoType(video?.type || 'external');
    setVideoTitle(video?.title || '');
    setVideoUrl(video?.url || '');
  };

  const handleAddModule = async () => {
    const newModule = await createModule();
    setActiveTab('modules');
    handleEditClick(newModule);
  };

  const handleDeleteModule = (mod: { id: string; title: string }) => {
    if (confirm(`Delete "${mod.title}"? This removes the module and its video for everyone - existing submissions/grades for it are kept but will no longer show curriculum details.`)) {
      deleteModule(mod.id);
    }
  };

  const handleSaveModule = () => {
    if (editingModule) {
      const parsedOrder = Number(editForm.order);
      const fallbackOrder = modules.find(m => m.id === editingModule)?.order ?? 1;
      updateModule(editingModule, {
        ...editForm,
        order: parsedOrder > 0 ? parsedOrder : fallbackOrder,
        outline: splitLines(outlineText),
        objectives: splitPeriodList(objectivesText),
        outcomes: splitPeriodList(outcomesText),
        additionalMaterials: parseMaterialsText(materialsText),
        // Drop sub-skills the admin left completely blank rather than saving
        // empty tables.
        rubricCriteria: rubricCriteria.filter(c => c.title.trim() || c.levels.some(l => l.trim())),
      });
      if (videoUrl.trim()) {
        upsertModuleVideo(editingModule, { type: videoType, url: videoUrl.trim(), title: videoTitle.trim() || 'Module Video' });
      } else {
        deleteModuleVideo(editingModule);
      }
      setEditingModule(null);
    }
  };

  const addCriterion = () =>
    setRubricCriteria([...rubricCriteria, { id: `rc_${rubricCriteria.length + 1}_${Date.now()}`, title: '', levels: ['', '', '', ''] }]);
  const removeCriterion = (idx: number) => setRubricCriteria(rubricCriteria.filter((_, i) => i !== idx));
  const patchCriterion = (idx: number, patch: Partial<RubricCriterion>) =>
    setRubricCriteria(rubricCriteria.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  const setCriterionLevel = (idx: number, levelIdx: number, value: string) =>
    setRubricCriteria(rubricCriteria.map((c, i) => {
      if (i !== idx) return c;
      const levels = [...c.levels] as RubricCriterion['levels'];
      levels[levelIdx] = value;
      return { ...c, levels };
    }));

  const handleImportRubric = () => {
    const { note, criteria } = parseRubricText(rubricPaste);
    if (criteria.length === 0) {
      alert('Could not find any "Sub-skill N: ..." sections in the pasted text.');
      return;
    }
    setRubricCriteria(criteria);
    if (note) setEditForm({ ...editForm, rubricNote: note });
    setRubricPaste('');
  };

  const newVideosCount = videoTasks.filter(vt => vt.status === 'completed').length;

  return (
    <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#F5FAFF]">
      <header className="border-b-[3px] border-black bg-white px-4 md:px-10 py-6 flex-shrink-0">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <span className="inline-block bg-[#FFD84D] border-2 border-black text-black text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full mb-2">
              Director Command Page
            </span>
            <h2 className="text-4xl font-black text-black uppercase tracking-tight leading-none">Mission Control</h2>
            <p className="text-sm text-gray-600 font-semibold mt-1.5">Curriculum, designers, and engineers at a glance.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="bg-black text-white text-xs font-black uppercase tracking-wider px-4 py-2 rounded-full whitespace-nowrap">
              {designers.length} Designers / {engineers.length} Engineers / {modules.length} Modules
            </span>
            <div
              className="relative cursor-pointer border-2 border-black bg-white p-2 rounded-full hover:bg-gray-50 transition-colors"
              title="Notifications"
              onClick={() => setActiveTab('engineers')}
            >
              <span className="text-xl block leading-none">🔔</span>
              {newVideosCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-[#F4511E] text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-black">
                  {newVideosCount}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-10 space-y-8">
        {/* Tabs */}
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => setActiveTab('modules')}
            className={`px-6 py-2 rounded-full font-black uppercase text-xs tracking-wider border-[3px] border-black transition-all ${
              activeTab === 'modules'
                ? 'bg-[#3DDC97] text-black shadow-[3px_3px_0_#000]'
                : 'bg-white text-black hover:bg-gray-50'
            }`}
          >
            Curriculum
          </button>
          <button
            onClick={() => setActiveTab('designers')}
            className={`px-6 py-2 rounded-full font-black uppercase text-xs tracking-wider border-[3px] border-black transition-all ${
              activeTab === 'designers'
                ? 'bg-[#2E9DF7] text-black shadow-[3px_3px_0_#000]'
                : 'bg-white text-black hover:bg-gray-50'
            }`}
          >
            Sound Designers
          </button>
          <button
            onClick={() => setActiveTab('engineers')}
            className={`px-6 py-2 rounded-full font-black uppercase text-xs tracking-wider border-[3px] border-black transition-all ${
              activeTab === 'engineers'
                ? 'bg-[#F4511E] text-black shadow-[3px_3px_0_#000]'
                : 'bg-white text-black hover:bg-gray-50'
            }`}
          >
            Audio Engineers
          </button>
        </div>

        {activeTab === 'designers' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-lg font-black uppercase text-black tracking-wider flex items-center gap-2">
                📋 Designer Progress Overview
              </h3>
              <span className="flex items-center gap-1.5 bg-white border-2 border-black rounded-full px-3 py-1 text-xs font-black text-[#2A8F62]">
                <span className="w-2 h-2 rounded-full bg-[#3DDC97]"></span> LIVE
              </span>
            </div>
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {designers.map((designer, i) => {
                const theme = CARD_THEMES[i % CARD_THEMES.length];
                const userSubmissions = submissions.filter(s => s.userId === designer.id);
                const progress = Math.round((userSubmissions.length / modules.length) * 100);
                const userGrades = grades.filter(g => userSubmissions.some(s => s.id === g.submissionId));
                const averageScore = userGrades.length > 0
                  ? (userGrades.reduce((acc, g) => acc + g.score, 0) / userGrades.length).toFixed(1)
                  : 'N/A';

                return (
                  <div key={designer.id} className="rounded-2xl border-[3px] border-black overflow-hidden bg-white flex flex-col">
                    <div className="relative p-5 pb-12" style={{ background: theme.bg }}>
                      <div className="absolute top-3 right-3 flex gap-1.5">
                        <span className="w-5 h-5 bg-white border-2 border-black rounded"></span>
                        <span className="w-5 h-5 bg-white border-2 border-black rounded"></span>
                        <span className="w-5 h-5 bg-white border-2 border-black rounded"></span>
                      </div>
                      <div
                        className="w-14 h-14 rounded-2xl border-[3px] border-black flex items-center justify-center text-white font-black text-sm relative"
                        style={{ background: theme.accent }}
                      >
                        {getInitials(designer.name)}
                        <span className="absolute top-3.5 left-3.5 w-1.5 h-1.5 bg-white rounded-full"></span>
                        <span className="absolute top-3.5 right-3.5 w-1.5 h-1.5 bg-white rounded-full"></span>
                      </div>
                    </div>

                    <div className="relative -mt-7 mx-4 mb-4 bg-white border-[3px] border-black rounded-xl p-4 flex-1 flex flex-col gap-4">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <h4 className="font-black text-base leading-tight">{designer.name}</h4>
                          <p className="text-xs text-gray-500 font-bold">{designer.pod || 'No Pod Assigned'} • {designer.email}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-xl font-black" style={{ color: theme.accent }}>{averageScore}</div>
                          <div className="text-[9px] text-gray-400 font-black uppercase tracking-wide">Avg Score</div>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          if (confirm(`Promote ${designer.name} to Audio Engineer? They'll be able to view and grade every designer's submissions.`)) {
                            updateUserRole(designer.id, 'audio_engineer');
                          }
                        }}
                        className="self-start text-[10px] font-black uppercase tracking-wide text-gray-600 bg-white border-2 border-black px-2.5 py-1 rounded-full hover:bg-black hover:text-white transition-colors"
                      >
                        Promote to Engineer
                      </button>

                      <div>
                        <div className="flex justify-between text-[10px] font-black text-gray-500 mb-1.5 uppercase tracking-wide">
                          <span>Course Progress</span>
                          <span>{progress}%</span>
                        </div>
                        <div className="h-3 bg-gray-100 rounded-full overflow-hidden border-2 border-black">
                          <div className="h-full rounded-full" style={{ width: `${progress}%`, background: theme.accent }}></div>
                        </div>
                      </div>

                      <div className="pt-3 border-t-2 border-black/10 flex gap-2 flex-wrap">
                        {modules.sort((a, b) => a.order - b.order).map(mod => {
                          const sub = userSubmissions.find(s => s.moduleId === mod.id);
                          const grade = sub ? grades.find(g => g.submissionId === sub.id) : null;

                          let badgeColor = 'bg-gray-100 text-gray-400 border-black/20';
                          let scoreText = '-';
                          if (sub?.status === 'graded') {
                            badgeColor = 'bg-[#3DDC97]/30 text-[#2A8F62] border-black';
                            scoreText = grade?.score.toString() || '?';
                          } else if (sub?.status === 'submitted') {
                            badgeColor = 'bg-[#2E9DF7]/20 text-[#1E40AF] border-black';
                            scoreText = 'Rev';
                          }

                          return (
                            <div key={mod.id} className={`w-9 h-9 rounded-lg border-2 flex items-center justify-center text-xs font-black ${badgeColor}`} title={mod.title}>
                              {scoreText}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'engineers' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-lg font-black uppercase text-black tracking-wider flex items-center gap-2">
                🎬 Engineer Video Tasks
              </h3>
              <span className="flex items-center gap-1.5 bg-white border-2 border-black rounded-full px-3 py-1 text-xs font-black text-[#2A8F62]">
                <span className="w-2 h-2 rounded-full bg-[#3DDC97]"></span> LIVE
              </span>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              {engineers.map((engineer, i) => {
                const theme = CARD_THEMES[i % CARD_THEMES.length];
                const assignedTasks = videoTasks.filter(vt => vt.engineerId === engineer.id);
                const completedCount = assignedTasks.filter(vt => vt.status === 'completed').length;
                const totalCount = assignedTasks.length;

                return (
                  <div key={engineer.id} className="rounded-2xl border-[3px] border-black overflow-hidden bg-white flex flex-col">
                    <div className="relative p-5 pb-12" style={{ background: theme.bg }}>
                      <div className="absolute top-3 right-3 flex gap-1.5">
                        <span className="w-5 h-5 bg-white border-2 border-black rounded"></span>
                        <span className="w-5 h-5 bg-white border-2 border-black rounded"></span>
                        <span className="w-5 h-5 bg-white border-2 border-black rounded"></span>
                      </div>
                      <div
                        className="w-14 h-14 rounded-2xl border-[3px] border-black flex items-center justify-center text-white font-black text-sm relative"
                        style={{ background: theme.accent }}
                      >
                        {getInitials(engineer.name)}
                        <span className="absolute top-3.5 left-3.5 w-1.5 h-1.5 bg-white rounded-full"></span>
                        <span className="absolute top-3.5 right-3.5 w-1.5 h-1.5 bg-white rounded-full"></span>
                      </div>
                    </div>

                    <div className="relative -mt-7 mx-4 mb-4 bg-white border-[3px] border-black rounded-xl p-4 flex-1 flex flex-col gap-4">
                      <div className="flex justify-between items-center gap-2">
                        <div>
                          <h4 className="font-black text-base leading-tight">{engineer.name}</h4>
                          <p className="text-xs text-gray-500 font-bold">{engineer.email}</p>
                        </div>
                        <div className="border-2 border-black px-3 py-1.5 rounded-xl flex-shrink-0" style={{ background: theme.bg }}>
                          <span className="font-black text-sm">{completedCount} / {totalCount}</span>
                          <span className="text-[9px] font-black uppercase tracking-wide ml-1.5 opacity-70">Done</span>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          if (confirm(`Move ${engineer.name} back to Sound Designer? They'll lose access to the roster and grading tools.`)) {
                            updateUserRole(engineer.id, 'sound_designer');
                          }
                        }}
                        className="self-start text-[10px] font-black uppercase tracking-wide text-gray-600 bg-white border-2 border-black px-2.5 py-1 rounded-full hover:bg-black hover:text-white transition-colors"
                      >
                        Move to Designer
                      </button>

                      <div className="space-y-2.5">
                        {assignedTasks.map(task => (
                          <div key={task.id} className="flex justify-between items-center p-3 bg-gray-50 border-2 border-black/10 rounded-xl gap-2">
                            <div>
                              <p className="font-bold text-sm">{task.title}</p>
                              <p className="text-xs text-gray-500 font-medium">Assigned: {new Date(task.assignedAt).toLocaleDateString()}</p>
                              {task.status === 'completed' && task.videoUrl && (
                                <a href={task.videoUrl} target="_blank" rel="noreferrer" className="inline-block mt-2 text-xs font-black text-black bg-[#2E9DF7]/20 border-2 border-black px-3 py-1 rounded-full hover:bg-[#2E9DF7] hover:text-white transition-colors">
                                  ▶ Watch Video
                                </a>
                              )}
                            </div>
                            <div className="flex-shrink-0">
                              {task.status === 'completed' && <span className="bg-[#3DDC97]/30 text-[#2A8F62] border-2 border-black px-2.5 py-1 rounded-full text-[10px] font-black uppercase">Completed</span>}
                              {task.status === 'in_progress' && <span className="bg-[#2E9DF7]/20 text-[#1E40AF] border-2 border-black px-2.5 py-1 rounded-full text-[10px] font-black uppercase">In Progress</span>}
                              {task.status === 'pending' && <span className="bg-gray-200 text-gray-600 border-2 border-black px-2.5 py-1 rounded-full text-[10px] font-black uppercase">Pending</span>}
                            </div>
                          </div>
                        ))}
                        {assignedTasks.length === 0 && (
                          <p className="text-sm text-gray-400 italic text-center py-4 font-semibold">No video tasks assigned.</p>
                        )}
                      </div>

                      <div className="pt-3 border-t-2 border-black/10 space-y-2">
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-wide">Assign a Video Task</p>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <select
                            value={getAssignDraft(engineer.id).moduleId}
                            onChange={(e) => setAssignField(engineer.id, 'moduleId', e.target.value)}
                            className="flex-1 bg-gray-50 border-2 border-black rounded-lg p-2 text-xs font-medium"
                          >
                            {modules.sort((a, b) => a.order - b.order).map(mod => (
                              <option key={mod.id} value={mod.id}>{mod.label || mod.order.toString().padStart(2, '0')} — {mod.title}</option>
                            ))}
                          </select>
                          <input
                            type="text"
                            value={getAssignDraft(engineer.id).title}
                            onChange={(e) => setAssignField(engineer.id, 'title', e.target.value)}
                            placeholder="Task title, e.g. Record intro walkthrough"
                            className="flex-1 bg-gray-50 border-2 border-black rounded-lg p-2 text-xs font-medium"
                          />
                          <button
                            onClick={() => handleAssignTask(engineer.id)}
                            disabled={!getAssignDraft(engineer.id).title.trim()}
                            className="bg-[#2E9DF7] text-white font-black uppercase text-[10px] tracking-wide px-4 py-2 rounded-lg border-2 border-black hover:bg-black transition-colors disabled:opacity-40 disabled:hover:bg-[#2E9DF7] whitespace-nowrap"
                          >
                            + Assign
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {activeTab === 'modules' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-lg font-black uppercase text-black tracking-wider flex items-center gap-2">
                📚 Curriculum Management
              </h3>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 bg-white border-2 border-black rounded-full px-3 py-1 text-xs font-black text-[#2A8F62]">
                  <span className="w-2 h-2 rounded-full bg-[#3DDC97]"></span> LIVE
                </span>
                <button
                  onClick={handleAddModule}
                  className="bg-[#3DDC97] text-black font-black uppercase text-xs tracking-wide px-4 py-2 rounded-full border-2 border-black hover:bg-black hover:text-white transition-colors"
                >
                  + Add Module
                </button>
              </div>
            </div>
            <div className="grid gap-6">
              {modules.sort((a, b) => a.order - b.order).map((mod, i) => {
                const theme = CARD_THEMES[i % CARD_THEMES.length];
                return (
                <div key={mod.id} className="bg-white rounded-2xl p-6 border-[3px] border-black">
                  {editingModule === mod.id ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-black text-gray-500 uppercase mb-1">Category</label>
                          <select
                            value={editForm.category || 'Onboarding'}
                            onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                            className="w-full bg-gray-50 border-2 border-black rounded-xl p-3 text-sm focus:ring-2 focus:ring-[#3DDC97] transition-all font-medium"
                          >
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-black text-gray-500 uppercase mb-1">Order</label>
                          <input
                            type="number"
                            value={editForm.order ?? ''}
                            onChange={(e) => setEditForm({ ...editForm, order: e.target.value })}
                            className="w-full bg-gray-50 border-2 border-black rounded-xl p-3 text-sm focus:ring-2 focus:ring-[#3DDC97] transition-all font-medium"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-black text-gray-500 uppercase mb-1">Label (optional)</label>
                          <input
                            type="text"
                            value={editForm.label || ''}
                            onChange={(e) => setEditForm({ ...editForm, label: e.target.value })}
                            placeholder="e.g. A, 4"
                            className="w-full bg-gray-50 border-2 border-black rounded-xl p-3 text-sm focus:ring-2 focus:ring-[#3DDC97] transition-all font-medium"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-black text-gray-500 uppercase mb-1">Title</label>
                        <input
                          type="text"
                          value={editForm.title || ''}
                          onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                          className="w-full bg-gray-50 border-2 border-black rounded-xl p-3 text-sm focus:ring-2 focus:ring-[#3DDC97] transition-all font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-black text-gray-500 uppercase mb-1">Description</label>
                        <textarea
                          value={editForm.description || ''}
                          onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                          className="w-full bg-gray-50 border-2 border-black rounded-xl p-3 text-sm focus:ring-2 focus:ring-[#3DDC97] transition-all font-medium h-14"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-black text-gray-500 uppercase mb-1">Text Content</label>
                        <textarea
                          value={editForm.textContent || ''}
                          onChange={(e) => setEditForm({ ...editForm, textContent: e.target.value })}
                          className="w-full bg-gray-50 border-2 border-black rounded-xl p-3 text-sm focus:ring-2 focus:ring-[#3DDC97] transition-all font-medium h-16"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-black text-gray-500 uppercase mb-1">Outline (one step per line)</label>
                        <textarea
                          value={outlineText}
                          onChange={(e) => setOutlineText(e.target.value)}
                          placeholder={'1. Intro to EQ\n2. Subtractive vs Additive EQ'}
                          className="w-full bg-gray-50 border-2 border-black rounded-xl p-3 text-sm focus:ring-2 focus:ring-[#3DDC97] transition-all font-medium h-20"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-black text-gray-500 uppercase mb-1">Learning Objectives (period separated)</label>
                        <textarea
                          value={objectivesText}
                          onChange={(e) => setObjectivesText(e.target.value)}
                          className="w-full bg-gray-50 border-2 border-black rounded-xl p-3 text-base focus:ring-2 focus:ring-[#3DDC97] transition-all font-medium h-24"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-black text-gray-500 uppercase mb-1">Outcomes (period separated)</label>
                        <textarea
                          value={outcomesText}
                          onChange={(e) => setOutcomesText(e.target.value)}
                          className="w-full bg-gray-50 border-2 border-black rounded-xl p-3 text-base focus:ring-2 focus:ring-[#3DDC97] transition-all font-medium h-24"
                        />
                      </div>
                      <div className="border-2 border-dashed border-black/30 rounded-xl p-4 space-y-4">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <p className="text-xs font-black text-gray-500 uppercase">Grading Rubric (sub-skills)</p>
                          <button
                            onClick={addCriterion}
                            className="bg-white border-2 border-black text-black font-black uppercase text-[10px] tracking-wide px-3 py-1.5 rounded-full hover:bg-black hover:text-white transition-colors"
                          >
                            + Add Sub-skill
                          </button>
                        </div>
                        <div>
                          <label className="block text-xs font-black text-gray-500 uppercase mb-1">Scale Note</label>
                          <input
                            type="text"
                            value={editForm.rubricNote || ''}
                            onChange={(e) => setEditForm({ ...editForm, rubricNote: e.target.value })}
                            placeholder="1 = Just Starting · 4 = Strong · 3+ = pass"
                            className="w-full bg-gray-50 border-2 border-black rounded-xl p-3 text-sm focus:ring-2 focus:ring-[#3DDC97] transition-all font-medium"
                          />
                        </div>
                        {rubricCriteria.map((criterion, ci) => (
                          <div key={criterion.id} className="border-2 border-black rounded-xl p-3 space-y-2 bg-gray-50">
                            <div className="flex gap-2 items-center">
                              <span className="flex-shrink-0 text-[10px] font-black uppercase text-gray-400">Sub-skill {ci + 1}</span>
                              <input
                                type="text"
                                value={criterion.title}
                                onChange={(e) => patchCriterion(ci, { title: e.target.value })}
                                placeholder="Title, e.g. DX chain order"
                                className="flex-1 bg-white border-2 border-black rounded-xl p-2.5 text-sm font-bold focus:ring-2 focus:ring-[#3DDC97] transition-all"
                              />
                              <input
                                type="text"
                                value={criterion.scoreLabel || ''}
                                onChange={(e) => patchCriterion(ci, { scoreLabel: e.target.value })}
                                placeholder="Column label, e.g. What it looks like on playback"
                                className="flex-1 bg-white border-2 border-black rounded-xl p-2.5 text-xs font-medium focus:ring-2 focus:ring-[#3DDC97] transition-all"
                              />
                              <button
                                onClick={() => removeCriterion(ci)}
                                className="flex-shrink-0 text-[10px] font-black uppercase text-[#B23A2E] bg-white border-2 border-black px-2.5 py-2 rounded-full hover:bg-[#B23A2E] hover:text-white transition-colors"
                              >
                                ✕
                              </button>
                            </div>
                            {criterion.levels.map((level, li) => (
                              <div key={li} className="flex gap-2 items-start">
                                <span className="flex-shrink-0 w-6 h-6 bg-white border-2 border-black rounded-full flex items-center justify-center text-[10px] font-black text-gray-600 mt-1.5">
                                  {li + 1}
                                </span>
                                <textarea
                                  value={level}
                                  onChange={(e) => setCriterionLevel(ci, li, e.target.value)}
                                  placeholder={`What a score of ${li + 1} looks like...`}
                                  className="flex-1 bg-white border-2 border-black rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-[#3DDC97] transition-all h-14"
                                />
                              </div>
                            ))}
                          </div>
                        ))}
                        <div>
                          <label className="block text-xs font-black text-gray-500 uppercase mb-1">Import from pasted text</label>
                          <textarea
                            value={rubricPaste}
                            onChange={(e) => setRubricPaste(e.target.value)}
                            placeholder={'Paste from Notion, e.g.:\nRubric (1 = Just Starting · 4 = Strong · 3+ = pass)\nSub-skill 1: DX chain order\nScore\tWhat it looks like in the session\n1\tPlugins in no deliberate order...\n2\t...'}
                            className="w-full bg-gray-50 border-2 border-black rounded-xl p-3 text-xs focus:ring-2 focus:ring-[#3DDC97] transition-all font-medium h-24"
                          />
                          <button
                            onClick={handleImportRubric}
                            disabled={!rubricPaste.trim()}
                            className="mt-2 bg-[#E0F2FE] border-2 border-black text-[#1E40AF] font-black uppercase text-[10px] tracking-wide px-4 py-2 rounded-full hover:bg-black hover:text-white transition-colors disabled:opacity-40"
                          >
                            Parse & Fill Sub-skills
                          </button>
                          <p className="text-[10px] text-gray-400 mt-1">Replaces the sub-skills above with what's parsed from the pasted text. Nothing is saved until you hit Save Changes.</p>
                        </div>
                        <div>
                          <label className="block text-xs font-black text-gray-500 uppercase mb-1">Plain-text Rubric (legacy fallback)</label>
                          <textarea
                            value={editForm.rubric || ''}
                            onChange={(e) => setEditForm({ ...editForm, rubric: e.target.value })}
                            placeholder={'Only shown when no sub-skills are defined above.'}
                            className="w-full bg-gray-50 border-2 border-black rounded-xl p-3 text-sm focus:ring-2 focus:ring-[#3DDC97] transition-all font-medium h-16"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-black text-gray-500 uppercase mb-1">Homework Link (Drive folder)</label>
                          <input
                            type="text"
                            value={editForm.homeworkLink || ''}
                            onChange={(e) => setEditForm({ ...editForm, homeworkLink: e.target.value })}
                            placeholder="https://drive.google.com/..."
                            className="w-full bg-gray-50 border-2 border-black rounded-xl p-3 text-sm focus:ring-2 focus:ring-[#3DDC97] transition-all font-medium"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-black text-gray-500 uppercase mb-1">Homework Description</label>
                          <input
                            type="text"
                            value={editForm.homeworkDescription || ''}
                            onChange={(e) => setEditForm({ ...editForm, homeworkDescription: e.target.value })}
                            className="w-full bg-gray-50 border-2 border-black rounded-xl p-3 text-sm focus:ring-2 focus:ring-[#3DDC97] transition-all font-medium"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-black text-gray-500 uppercase mb-1">Additional Materials (one link or book title per line)</label>
                        <textarea
                          value={materialsText}
                          onChange={(e) => setMaterialsText(e.target.value)}
                          placeholder={'https://example.com/great-article\nThe Sound Effects Bible'}
                          className="w-full bg-gray-50 border-2 border-black rounded-xl p-3 text-base focus:ring-2 focus:ring-[#3DDC97] transition-all font-medium h-32"
                        />
                        <p className="text-[10px] text-gray-400 mt-1">Paste a link or type a book/article title on each line - we'll sort out the type automatically.</p>
                      </div>

                      <div className="border-2 border-dashed border-black/30 rounded-xl p-4 space-y-3">
                        <p className="text-xs font-black text-gray-500 uppercase">Module Video</p>
                        <div className="grid grid-cols-[auto_1fr] gap-3">
                          <select
                            value={videoType}
                            onChange={(e) => setVideoType(e.target.value as 'internal' | 'external')}
                            className="bg-gray-50 border-2 border-black rounded-xl p-3 text-sm font-medium"
                          >
                            <option value="external">External (YouTube/link)</option>
                            <option value="internal">Internal (hosted file)</option>
                          </select>
                          <input
                            type="text"
                            value={videoUrl}
                            onChange={(e) => setVideoUrl(e.target.value)}
                            placeholder="https://youtube.com/watch?v=..."
                            className="w-full bg-gray-50 border-2 border-black rounded-xl p-3 text-sm focus:ring-2 focus:ring-[#3DDC97] transition-all font-medium"
                          />
                        </div>
                        <input
                          type="text"
                          value={videoTitle}
                          onChange={(e) => setVideoTitle(e.target.value)}
                          placeholder="Video title"
                          className="w-full bg-gray-50 border-2 border-black rounded-xl p-3 text-sm focus:ring-2 focus:ring-[#3DDC97] transition-all font-medium"
                        />
                        <p className="text-[10px] text-gray-400">Leave the URL blank and save to remove the video from this module.</p>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={handleSaveModule}
                          className="bg-[#3DDC97] text-black font-black py-2 px-6 rounded-xl border-2 border-black hover:bg-[#2A8F62] hover:text-white transition-colors"
                        >
                          Save Changes
                        </button>
                        <button
                          onClick={() => setEditingModule(null)}
                          className="bg-gray-200 text-gray-700 font-black py-2 px-6 rounded-xl border-2 border-black hover:bg-gray-300 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex gap-4 min-w-0">
                        <div
                          className="w-12 h-12 rounded-xl border-[3px] border-black flex items-center justify-center text-black font-black text-sm flex-shrink-0"
                          style={{ background: theme.bg }}
                        >
                          {mod.label || mod.order.toString().padStart(2, '0')}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-black text-lg leading-tight">{mod.title}</h4>
                          <p className="text-sm text-gray-600 mt-1 mb-2">{mod.description}</p>
                          <div className="flex gap-2 flex-wrap">
                            <span className="bg-gray-100 border-2 border-black px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide">
                              {mod.objectives?.length || 0} Objectives
                            </span>
                            <span className="bg-gray-100 border-2 border-black px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide">
                              {mod.additionalMaterials?.length || 0} Resources
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleEditClick(mod)}
                          className="bg-white border-[3px] border-black text-black hover:bg-black hover:text-white font-black py-2 px-4 rounded-xl transition-colors uppercase text-xs tracking-wide"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteModule(mod)}
                          className="bg-white border-[3px] border-black text-[#B23A2E] hover:bg-[#B23A2E] hover:text-white font-black py-2 px-4 rounded-xl transition-colors uppercase text-xs tracking-wide"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="bg-black text-white text-[11px] font-mono px-6 py-3 rounded-full flex flex-wrap gap-x-8 gap-y-1 justify-center border-[3px] border-black">
          <span>{designers.length} designers tracked</span>
          <span>{engineers.length} engineers tracked</span>
          <span>{submissions.length} submissions received</span>
          <span>{grades.length} graded</span>
        </div>
      </div>
    </main>
  );
};
