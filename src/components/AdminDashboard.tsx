import React, { useEffect, useRef, useState } from 'react';
import { useAppContext } from '../store';
import { Module, Resource, Role } from '../types';
import { AdminHeader } from './AdminHeader';
import { ClipboardCheck } from 'lucide-react';
import { useHasReviewAssignments, useReviewTodoCount } from '../assessment/reviewQueue';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { ConfirmModal } from './ConfirmModal';
import { CategoryManager } from './CategoryManager';
import { AssessmentAdmin } from './assessment/AssessmentAdmin';
import { ContentBlocksEditor } from './assessment/ContentBlocksEditor';
import { sortCategories } from '../access';
import { saveWith } from './assessment/ui';
import { ClipTimes } from './assessment/ClipTimes';
import { DesignerCard, STATUS_ORDER } from './DesignerCard';
import { behindReasons, traineeStanding } from '../assessment/standing';
import { traineeDataFrom } from '../assessment/traineeData';

const splitLines = (text: string) => text.split('\n').map(s => s.trim()).filter(Boolean);

// What a lesson needs before a trainee gets value out of it - the lesson
// text, what it's teaching, and what it's teaching toward. Grading lives on
// assignments, and a video is optional.
const getMissingContentFields = (mod: Module): string[] => {
  const missing: string[] = [];
  if (!mod.description?.trim()) missing.push('Content');
  if (!mod.objectives?.length) missing.push('Objectives');
  if (!mod.outcomes?.length) missing.push('Outcomes');
  return missing;
};

// Admins give each material a display title plus an optional link - we still
// infer the resource type from the URL instead of asking for it.
const inferMaterialType = (url: string): Resource['type'] => {
  if (!url) return 'book';
  return /youtube\.com|youtu\.be|vimeo\.com/i.test(url) ? 'video' : 'article';
};

interface MaterialRow { title: string; url: string; }

const materialsToRows = (materials: Resource[] = []): MaterialRow[] =>
  // Older entries used the raw URL as the title - show those with an empty
  // title box so admins can type a proper one.
  materials.map(r => ({ title: r.title === r.url ? '' : r.title, url: r.url || '' }));

const rowsToMaterials = (rows: MaterialRow[]): Resource[] =>
  rows
    .map(r => ({ title: r.title.trim(), url: r.url.trim() }))
    .filter(r => r.title || r.url)
    .map(r => ({
      type: inferMaterialType(r.url),
      title: r.title || r.url,
      ...(r.url ? { url: r.url } : {}),
    }));

// Cycles through the three brand colors only (blue / orange / green).
const CARD_THEMES = [
  { bg: 'var(--color-sky)', accent: '#2E9DF7' },
  { bg: 'var(--color-peach)', accent: '#F4511E' },
  { bg: 'var(--color-mint)', accent: '#3DDC97' },
];

const getInitials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();

export const AdminDashboard: React.FC<{ focusModuleId?: string; focusNonce?: number; onPreview: (role: Role) => void }> = ({ focusModuleId, focusNonce, onPreview }) => {
  const hasReviews = useHasReviewAssignments();
  const reviewTodo = useReviewTodoCount();
  const {
    users, categories, modules, moduleVideos, enrollments, programOutline, programOutcomes, assessmentConfig,
    updateModule, updateUserRole, createModule, deleteModule, upsertModuleVideo, deleteModuleVideo,
    setUserUnlockedCategories,
  } = useAppContext();
  const lockedCategories = sortCategories(categories).filter(c => c.restricted);
  const [activeTab, setActiveTab] = useState<'designers' | 'modules' | 'assessment'>('modules');

  const designers = users.filter(u => u.role === 'sound_designer');
  // Probation standing per designer (null = not enrolled), sorted so the
  // ones needing attention come first.
  const ctx = useAppContext();
  const roster = designers.map(designer => ({
    designer,
    standing: enrollments.some(e => e.id === designer.id) ? traineeStanding(traineeDataFrom(ctx, designer.id), programOutline, ctx.videoProgress) : null,
  })).sort((a, b) => STATUS_ORDER.indexOf(a.standing?.status ?? 'not_enrolled') - STATUS_ORDER.indexOf(b.standing?.status ?? 'not_enrolled') || a.designer.name.localeCompare(b.designer.name));
  const behind = roster.filter(r => r.standing?.status === 'behind');
  const awaitingDecision = roster.filter(r => (r.standing?.status === 'passed' || r.standing?.status === 'not_passed') && !programOutcomes.some(o => o.id === r.designer.id));
  const engineers = users.filter(u => u.role === 'audio_engineer');
  // The retired 1-4 homework system's data (read-only archive), as a JSON
  // download - see firestore.rules.
  const [exporting, setExporting] = useState(false);
  const exportLegacy = async () => {
    setExporting(true);
    try {
      const read = async (name: string) => (await getDocs(collection(db, name))).docs.map(d => d.data());
      const data = { exportedAt: new Date().toISOString(), submissions: await read('submissions'), grades: await read('grades'), videoTasks: await read('videoTasks') };
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = Object.assign(document.createElement('a'), { href: url, download: `legacy-homework-${data.exportedAt.slice(0, 10)}.json` });
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Legacy export failed', error);
      alert('Could not export the legacy data - check your connection and try again.');
    } finally {
      setExporting(false);
    }
  };

  const [editingModule, setEditingModule] = useState<string | null>(null);
  const [moduleQuery, setModuleQuery] = useState('');
  const [onlyIncomplete, setOnlyIncomplete] = useState(false);
  const [collapsedCats, setCollapsedCats] = useState<string[]>([]);
  const [editForm, setEditForm] = useState<any>({});
  const [objectivesText, setObjectivesText] = useState('');
  const [outcomesText, setOutcomesText] = useState('');
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [outlineText, setOutlineText] = useState('');
  const [videoType, setVideoType] = useState<'internal' | 'external'>('external');
  const [videoTitle, setVideoTitle] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [videoClip, setVideoClip] = useState<{ start?: number; end?: number }>({});

  // Replaces the native confirm()/alert() popups previously used for
  // destructive actions (delete a lesson) with the app's own branded
  // modal, rendered once at the bottom of this component.
  const [pendingConfirm, setPendingConfirm] = useState<{ kind: 'delete-module'; mod: Module } | null>(null);

  const handleEditClick = (mod: any) => {
    setEditingModule(mod.id);
    setEditForm({ ...mod });
    setObjectivesText((mod.objectives || []).join('\n'));
    setOutcomesText((mod.outcomes || []).join('\n'));
    setMaterials(materialsToRows(mod.additionalMaterials));
    setOutlineText((mod.outline || []).join('\n'));
    const video = moduleVideos.find(v => v.moduleId === mod.id);
    setVideoType(video?.type || 'external');
    setVideoTitle(video?.title || '');
    setVideoUrl(video?.url || '');
    setVideoClip({ start: video?.start, end: video?.end });
  };

  // Dirty-tracks the open editor so switching what's being edited (Edit on
  // another card, a sidebar quick-jump, Add Module) can warn before wiping
  // out in-progress work instead of silently overwriting editForm. The ref
  // tells "editingModule itself just changed - this is a fresh load, not an
  // edit" apart from "some field changed while the same module stayed open."
  const loadedModuleRef = useRef<string | null>(null);
  const [isEditDirty, setIsEditDirty] = useState(false);
  useEffect(() => {
    if (loadedModuleRef.current !== editingModule) {
      loadedModuleRef.current = editingModule;
      setIsEditDirty(false);
      return;
    }
    if (editingModule) setIsEditDirty(true);
  }, [editingModule, editForm, objectivesText, outcomesText, outlineText, materials, videoType, videoTitle, videoUrl, videoClip]);

  const [discardConfirmAction, setDiscardConfirmAction] = useState<(() => void) | null>(null);
  const requestEditChange = (action: () => void) => {
    if (isEditDirty) {
      setDiscardConfirmAction(() => action);
    } else {
      action();
    }
  };

  // Clicking a module in the sidebar used to do nothing here - the list
  // highlighted and showed statuses like it was live navigation, but
  // AdminDashboard ignored the selected id entirely. focusNonce (bumped by
  // App.tsx on every sidebar module click) lets us tell "the admin just
  // clicked a module" apart from "focusModuleId happens to hold some value
  // because that's what a fresh mount was handed" - only the former should
  // jump into editing it.
  useEffect(() => {
    if (!focusNonce || !focusModuleId) return;
    const mod = modules.find(m => m.id === focusModuleId);
    if (!mod) return;
    setActiveTab('modules');
    requestEditChange(() => handleEditClick(mod));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNonce]);

  const handleAddModule = () => requestEditChange(async () => {
    const newModule = await createModule();
    setActiveTab('modules');
    handleEditClick(newModule);
  });

  const handleDeleteModule = (mod: Module) => setPendingConfirm({ kind: 'delete-module', mod });

  const handleSaveModule = () => {
    if (editingModule) {
      const parsedOrder = Number(editForm.order);
      const current = modules.find(m => m.id === editingModule);
      const fallbackOrder = current?.order ?? 1;
      saveWith(updateModule(editingModule, {
        ...editForm,
        // A blank title would leave a nameless module in every list.
        title: editForm.title?.trim() || current?.title || 'New Module',
        order: parsedOrder > 0 ? parsedOrder : fallbackOrder,
        outline: splitLines(outlineText),
        objectives: splitLines(objectivesText),
        outcomes: splitLines(outcomesText),
        additionalMaterials: rowsToMaterials(materials),
        // Drop sub-skills the admin left completely blank rather than saving
        // empty tables.
      }));
      if (videoUrl.trim()) {
        upsertModuleVideo(editingModule, { type: videoType, url: videoUrl.trim(), title: videoTitle.trim() || 'Module Video', ...videoClip });
      } else {
        deleteModuleVideo(editingModule);
      }
      setEditingModule(null);
    }
  };

  const addMaterial = () => setMaterials([...materials, { title: '', url: '' }]);
  const removeMaterial = (idx: number) => setMaterials(materials.filter((_, i) => i !== idx));
  const patchMaterial = (idx: number, patch: Partial<MaterialRow>) =>
    setMaterials(materials.map((m, i) => (i === idx ? { ...m, ...patch } : m)));


  // Curriculum tab: modules grouped under their category (sidebar order),
  // filtered by the search box / "needs work" toggle. Modules whose category
  // was deleted land in "Uncategorized" so they can't go missing.
  const moduleQ = moduleQuery.trim().toLowerCase();
  const filtering = !!moduleQ || onlyIncomplete;
  const sortedModules = [...modules].sort((a, b) => a.order - b.order);
  const shownModules = sortedModules.filter(m =>
    (!onlyIncomplete || getMissingContentFields(m).length > 0) &&
    (!moduleQ || `${m.title} ${m.label ?? ''} ${m.description ?? ''}`.toLowerCase().includes(moduleQ)));
  const sortedCats = sortCategories(categories);
  const moduleGroups = [
    ...sortedCats.map(c => ({ id: c.id, name: c.name, restricted: c.restricted, all: sortedModules.filter(m => m.category === c.id) })),
    { id: '__uncategorized', name: 'Uncategorized', restricted: false, all: sortedModules.filter(m => !sortedCats.some(c => c.id === m.category)) },
  ]
    .map(g => ({ ...g, mods: g.all.filter(m => shownModules.includes(m)) }))
    .filter(g => g.mods.length > 0);
  const toggleCat = (id: string) => setCollapsedCats(c => (c.includes(id) ? c.filter(x => x !== id) : [...c, id]));

  return (
    <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-page">
      <AdminHeader onPreview={onPreview}>
        {hasReviews && (
          <button onClick={() => { window.location.hash = '#/review'; }} className="flex items-center gap-1.5 text-xs font-bold text-navy bg-sky px-4 py-2 rounded-full hover:bg-[#2E9DF7]/20">
            <ClipboardCheck className="w-4 h-4" strokeWidth={2.5} aria-hidden="true" />Review Queue{reviewTodo ? ` (${reviewTodo})` : ''}
          </button>
        )}
        <span className="bg-sky text-navy text-xs font-bold px-4 py-2 rounded-full whitespace-nowrap hidden md:inline">
          {designers.length} Designers · {engineers.length} Engineers · {modules.length} Lessons
        </span>
      </AdminHeader>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-10 space-y-8">
        {/* Alerts for coordinators, on every tab: who's falling behind, and
            who finished probation and is waiting for an offer decision. */}
        {(behind.length > 0 || awaitingDecision.length > 0) && (
          <div className="space-y-3">
            {behind.length > 0 && (
              <div className="bg-rose rounded-[32px] p-5 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase text-ember mb-1">⚠ {behind.length} sound designer{behind.length === 1 ? ' is' : 's are'} falling behind</p>
                  <ul className="text-sm text-ember font-bold space-y-0.5">
                    {behind.map(({ designer, standing }) => (
                      <li key={designer.id}><b>{designer.name}</b> - {[
                        ...(standing!.overdue.length ? [`${standing!.overdue.length} overdue assignment${standing!.overdue.length === 1 ? '' : 's'}`] : []),
                        ...behindReasons({ ...standing!, overdue: [] }, assessmentConfig.passThreshold),
                      ].join(' · ')}</li>
                    ))}
                  </ul>
                </div>
                {activeTab !== 'designers' && <button onClick={() => setActiveTab('designers')} className="bg-[#F4511E] text-white font-bold text-sm px-5 py-2 rounded-2xl">View</button>}
              </div>
            )}
            {awaitingDecision.length > 0 && (
              <div className="bg-[#3DDC97]/15 rounded-[32px] p-5 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-bold text-leaf">
                  🎓 Probation finished for {awaitingDecision.map(r => `${r.designer.name} (${r.standing!.status === 'passed' ? 'passed' : 'below benchmark'})`).join(', ')} - record the full-time offer decision.
                </p>
                {activeTab !== 'designers' && <button onClick={() => setActiveTab('designers')} className="bg-[#3DDC97] text-[#0B3D2A] font-bold text-sm px-5 py-2 rounded-2xl">View</button>}
              </div>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => setActiveTab('modules')}
            className={`px-6 py-2 rounded-full font-bold transition-all ${
              activeTab === 'modules'
                ? 'bg-[#3DDC97] text-white shadow-md'
                : 'bg-surface text-gray-500 hover:bg-gray-50'
            }`}
          >
            Curriculum
          </button>
          <button
            onClick={() => setActiveTab('designers')}
            className={`px-6 py-2 rounded-full font-bold transition-all ${
              activeTab === 'designers'
                ? 'bg-[#2E9DF7] text-white shadow-md'
                : 'bg-surface text-gray-500 hover:bg-gray-50'
            }`}
          >
            Sound Designers
            {behind.length > 0 && <span className="ml-2 bg-[#F4511E] text-white text-[10px] font-black px-2 py-0.5 rounded-full">{behind.length}</span>}
          </button>
          <button
            onClick={() => setActiveTab('assessment')}
            className={`px-6 py-2 rounded-full font-bold transition-all ${
              activeTab === 'assessment'
                ? 'bg-[#1E40AF] text-white shadow-md'
                : 'bg-surface text-gray-500 hover:bg-gray-50'
            }`}
          >
            Assessment (1–5)
          </button>
        </div>

        {activeTab === 'assessment' && (
          <AssessmentAdmin onEditModule={(id) => {
            const mod = modules.find(m => m.id === id);
            if (!mod) return;
            setActiveTab('modules');
            handleEditClick(mod);
          }} />
        )}

        {activeTab === 'designers' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-lg font-black uppercase text-gray-800 tracking-wider flex items-center gap-2">
                📋 Probation progress
              </h3>
              <span className="text-xs font-bold text-gray-500">
                Pass = final score of {assessmentConfig.passThreshold}+ / 5 after week 4 → recommend a full-time offer
              </span>
            </div>
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {roster.map(({ designer, standing }, i) => (
                <DesignerCard key={designer.id} designer={designer} standing={standing} accent={CARD_THEMES[i % CARD_THEMES.length].accent}
                  lockedCategories={lockedCategories} />
              ))}
            </div>
          </div>
        )}

        {activeTab === 'modules' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-lg font-black uppercase text-gray-800 tracking-wider flex items-center gap-2">
                📚 Curriculum Management
              </h3>
              <div className="flex items-center gap-3">
                <span className="bg-sky text-navy text-xs font-black uppercase tracking-wider px-4 py-2 rounded-full whitespace-nowrap">
                  {modules.filter(m => getMissingContentFields(m).length === 0).length} / {modules.length} Complete
                </span>
                <span className="flex items-center gap-1.5 bg-[#3DDC97]/20 rounded-full px-3 py-1 text-xs font-black text-leaf">
                  <span className="w-2 h-2 rounded-full bg-[#3DDC97]"></span> LIVE
                </span>
                <button
                  onClick={handleAddModule}
                  className="bg-[#3DDC97] text-white font-bold text-sm px-5 py-2 rounded-full transition-all shadow-[0_4px_0_#2A8F62] active:shadow-none active:translate-y-[2px]"
                >
                  + Add Module
                </button>
              </div>
            </div>
            <details className="group">
              <summary className="cursor-pointer text-xs font-black uppercase tracking-widest text-gray-400 hover:text-[#2E9DF7] list-none flex items-center gap-1.5">
                <span className="transition-transform group-open:rotate-90">›</span> Manage categories ({categories.length})
              </summary>
              <div className="mt-3"><CategoryManager /></div>
            </details>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="search"
                value={moduleQuery}
                onChange={(e) => setModuleQuery(e.target.value)}
                placeholder="Search modules…"
                aria-label="Search modules"
                className="flex-1 min-w-[200px] bg-surface border border-gray-100 rounded-xl p-3 text-sm focus:ring-2 focus:ring-[#2E9DF7] font-medium"
              />
              <button
                onClick={() => setOnlyIncomplete(v => !v)}
                aria-pressed={onlyIncomplete}
                className={`text-xs font-black uppercase tracking-wide px-4 py-3 rounded-xl transition-colors ${
                  onlyIncomplete ? 'bg-[#F4511E] text-white' : 'bg-[#F4511E]/15 text-ember hover:bg-[#F4511E]/25'
                }`}
              >
                Needs work ({modules.filter(m => getMissingContentFields(m).length > 0).length})
              </button>
            </div>
            {moduleGroups.length === 0 && (
              <p className="text-sm text-gray-400 font-medium text-center py-8">No modules match.</p>
            )}
            {moduleGroups.map(group => {
              const open = filtering || !collapsedCats.includes(group.id) || group.mods.some(m => m.id === editingModule);
              const doneCount = group.all.filter(m => getMissingContentFields(m).length === 0).length;
              return (
            <section key={group.id} className="space-y-2">
              <button
                onClick={() => toggleCat(group.id)}
                aria-expanded={open}
                className="w-full flex items-center gap-2 text-left px-1 py-1 text-gray-700 hover:text-[#2E9DF7]"
              >
                <span className={`text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`}>›</span>
                <span className="text-sm font-black uppercase tracking-wider">{group.name}</span>
                {group.restricted && <span className="text-[10px]" title="Locked category">🔒</span>}
                <span className="text-[10px] font-bold uppercase text-gray-400">
                  {group.all.length} module{group.all.length === 1 ? '' : 's'} · {doneCount}/{group.all.length} complete
                </span>
              </button>
              {open && (
            <div className="grid gap-2">
              {group.mods.map((mod, i) => {
                const theme = CARD_THEMES[i % CARD_THEMES.length];
                const missingFields = getMissingContentFields(mod);
                return (
                <div key={mod.id} className={`bg-surface border border-gray-100 shadow-sm ${editingModule === mod.id ? 'rounded-[32px] p-6' : 'rounded-2xl px-4 py-3'}`}>
                  {editingModule === mod.id ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Category</label>
                          <select
                            value={editForm.category || sortCategories(categories)[0]?.id || ''}
                            onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                            className="w-full bg-gray-50 rounded-xl p-3 text-sm focus:ring-2 focus:ring-[#3DDC97] transition-all font-medium"
                          >
                            {sortCategories(categories).map(c => <option key={c.id} value={c.id}>{c.name}{c.restricted ? ' (locked)' : ''}</option>)}
                            {editForm.category && !categories.some(c => c.id === editForm.category) && (
                              <option value={editForm.category}>{editForm.category} (deleted)</option>
                            )}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Order</label>
                          <input
                            type="number"
                            value={editForm.order ?? ''}
                            onChange={(e) => setEditForm({ ...editForm, order: e.target.value })}
                            className="w-full bg-gray-50 rounded-xl p-3 text-sm focus:ring-2 focus:ring-[#3DDC97] transition-all font-medium"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Label (optional)</label>
                          <input
                            type="text"
                            value={editForm.label || ''}
                            onChange={(e) => setEditForm({ ...editForm, label: e.target.value })}
                            placeholder="e.g. A, 4"
                            className="w-full bg-gray-50 rounded-xl p-3 text-sm focus:ring-2 focus:ring-[#3DDC97] transition-all font-medium"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Title</label>
                        <input
                          type="text"
                          value={editForm.title || ''}
                          onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                          className="w-full bg-gray-50 rounded-xl p-3 text-sm focus:ring-2 focus:ring-[#3DDC97] transition-all font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description</label>
                        <p className="text-[10px] text-gray-400 mb-1">Shown on curriculum cards and as "About this Module" on the designer's page.</p>
                        <textarea
                          value={editForm.description || ''}
                          onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                          className="w-full bg-gray-50 rounded-xl p-3 text-sm focus:ring-2 focus:ring-[#3DDC97] transition-all font-medium h-24"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Outline (one step per line)</label>
                        <textarea
                          value={outlineText}
                          onChange={(e) => setOutlineText(e.target.value)}
                          placeholder={'1. Intro to EQ\n2. Subtractive vs Additive EQ'}
                          className="w-full bg-gray-50 rounded-xl p-3 text-sm focus:ring-2 focus:ring-[#3DDC97] transition-all font-medium h-20"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Learning Objectives (one per line)</label>
                        <textarea
                          value={objectivesText}
                          onChange={(e) => setObjectivesText(e.target.value)}
                          placeholder={'e.g. Understand subtractive EQ\nApply gain staging correctly'}
                          className="w-full bg-gray-50 rounded-xl p-3 text-base focus:ring-2 focus:ring-[#3DDC97] transition-all font-medium h-24"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Outcomes (one per line)</label>
                        <textarea
                          value={outcomesText}
                          onChange={(e) => setOutcomesText(e.target.value)}
                          placeholder={'e.g. A mix with balanced frequency content'}
                          className="w-full bg-gray-50 rounded-xl p-3 text-base focus:ring-2 focus:ring-[#3DDC97] transition-all font-medium h-24"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Content blocks (rich text, schedule, milestones, expectations, optional video)</label>
                        <ContentBlocksEditor
                          blocks={editForm.contentBlocks || []}
                          onChange={(contentBlocks) => setEditForm({ ...editForm, contentBlocks })}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Additional Materials</label>
                        <div className="space-y-2">
                          {materials.map((material, idx) => (
                            <div key={idx} className="grid grid-cols-[1fr_1.4fr_auto] gap-2">
                              <input
                                type="text"
                                value={material.title}
                                onChange={(e) => patchMaterial(idx, { title: e.target.value })}
                                placeholder="Title (e.g. The Sound Effects Bible)"
                                className="w-full bg-gray-50 rounded-xl p-3 text-sm focus:ring-2 focus:ring-[#3DDC97] transition-all font-medium"
                              />
                              <input
                                type="text"
                                value={material.url}
                                onChange={(e) => patchMaterial(idx, { url: e.target.value })}
                                placeholder="https://... (leave blank for a book)"
                                className="w-full bg-gray-50 rounded-xl p-3 text-sm focus:ring-2 focus:ring-[#3DDC97] transition-all font-medium"
                              />
                              <button
                                onClick={() => removeMaterial(idx)}
                                title="Remove material"
                                className="bg-rose text-ember hover:bg-[#F4511E] hover:text-white font-bold px-3 rounded-xl transition-colors"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={addMaterial}
                            className="bg-surface border-2 border-dashed border-gray-200 text-gray-500 hover:border-[#2E9DF7] hover:text-[#2E9DF7] font-bold py-2 px-4 rounded-xl transition-colors text-sm"
                          >
                            + Add Material
                          </button>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1">Sound designers only see the title - clicking it opens the link. Leave the link blank for books.</p>
                      </div>

                      <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 space-y-3">
                        <p className="text-xs font-black text-gray-500 uppercase">Module Video</p>
                        <div className="grid grid-cols-[auto_1fr] gap-3">
                          <select
                            value={videoType}
                            onChange={(e) => setVideoType(e.target.value as 'internal' | 'external')}
                            className="bg-gray-50 rounded-xl p-3 text-sm font-medium"
                          >
                            <option value="external">External (YouTube/link)</option>
                            <option value="internal">Internal (hosted file)</option>
                          </select>
                          <input
                            type="text"
                            value={videoUrl}
                            onChange={(e) => setVideoUrl(e.target.value)}
                            placeholder="https://youtube.com/watch?v=..."
                            className="w-full bg-gray-50 rounded-xl p-3 text-sm focus:ring-2 focus:ring-[#3DDC97] transition-all font-medium"
                          />
                        </div>
                        <input
                          type="text"
                          value={videoTitle}
                          onChange={(e) => setVideoTitle(e.target.value)}
                          placeholder="Video title"
                          className="w-full bg-gray-50 rounded-xl p-3 text-sm focus:ring-2 focus:ring-[#3DDC97] transition-all font-medium"
                        />
                        <ClipTimes key={editingModule} start={videoClip.start} end={videoClip.end} onChange={(start, end) => setVideoClip({ start, end })} />
                        <p className="text-[10px] text-gray-400">Leave the URL blank and save to remove the video from this module.</p>
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
                    <div className="flex justify-between items-center gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0"
                          style={{ background: theme.bg, color: theme.accent }}
                        >
                          {mod.label || mod.order.toString().padStart(2, '0')}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-black text-base leading-tight">{mod.title || <span className="text-ember">(no name)</span>}</h4>
                            {mod.program === 'episodeA' && (
                              <span className="bg-sky text-navy px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider flex-shrink-0" title="Old grading module - use Convert in Assessment (1–5) to remove it">
                                Old skill module
                              </span>
                            )}
                            {missingFields.length === 0 ? (
                              <span className="bg-[#3DDC97]/20 text-leaf px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider flex-shrink-0">
                                ✓ Complete
                              </span>
                            ) : (
                              <span
                                className="bg-[#F4511E]/20 text-ember px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider flex-shrink-0"
                                title={`Missing: ${missingFields.join(', ')}`}
                              >
                                Missing {missingFields.join(', ')}
                              </span>
                            )}
                          </div>
                          {mod.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{mod.description}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => requestEditChange(() => handleEditClick(mod))}
                          className="bg-surface border-2 border-sky text-[#2E9DF7] hover:bg-sky font-bold text-sm py-1.5 px-4 rounded-xl transition-colors"
                        >
                          Edit
                        </button>
                        {/* Deliberately quieter than Edit - a delete is
                            permanent and used to sit at equal visual weight
                            right next to it, one mis-click from curriculum
                            loss. Muted by default, still gated by the
                            confirm modal below. */}
                        <button
                          onClick={() => handleDeleteModule(mod)}
                          disabled={mod.program === 'episodeA'}
                          title={mod.program === 'episodeA' ? 'Removed by Convert in Assessment (1–5)' : undefined}
                          className="disabled:opacity-30 disabled:pointer-events-none flex-shrink-0 text-gray-400 font-bold text-sm px-3 py-2 rounded-xl hover:text-ember hover:bg-rose transition-colors ml-1"
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
              )}
            </section>
              );
            })}
          </div>
        )}

        <div className="bg-surface text-gray-400 text-[11px] font-bold uppercase tracking-wide px-6 py-3 rounded-full flex flex-wrap gap-x-8 gap-y-1 justify-center shadow-sm border border-gray-100">
          <span>{designers.length} designers tracked</span>
          <span>{engineers.length} engineers tracked</span>
          <button onClick={exportLegacy} disabled={exporting} className="uppercase tracking-wide hover:text-[#2E9DF7] disabled:opacity-50"
            title="The retired 1–4 homework system: submissions, grades and engineer video tasks (read-only archive)">
            {exporting ? 'Exporting…' : '⬇ Export legacy 1–4 data'}
          </button>
        </div>
      </div>

      <ConfirmModal
        open={pendingConfirm !== null}
        title={pendingConfirm ? `Delete "${pendingConfirm.mod.title}"?` : ''}
        message="This removes the lesson and its video for everyone. Take it out of the weekly outline too if it's placed there. Assignment submissions and scores aren't affected."
        confirmLabel="Delete"
        danger
        onConfirm={() => {
          if (pendingConfirm) saveWith(deleteModule(pendingConfirm.mod.id));
          setPendingConfirm(null);
        }}
        onCancel={() => setPendingConfirm(null)}
      />

      <ConfirmModal
        open={discardConfirmAction !== null}
        title="Discard Unsaved Changes?"
        message="You have unsaved edits to this module. Switching now will discard them."
        confirmLabel="Discard & Continue"
        onConfirm={() => {
          discardConfirmAction?.();
          setDiscardConfirmAction(null);
        }}
        onCancel={() => setDiscardConfirmAction(null)}
      />
    </main>
  );
};
