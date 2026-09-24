import React, { useEffect, useRef, useState } from 'react';
import { useAppContext } from '../store';
import { Assignment, Module, Role } from '../types';

// `section`: the week section heading it sits under (null = not in a section).
type WeekRow = ({ key: string; kind: 'content'; mod: Module } | { key: string; kind: 'assignment'; asg: Assignment }) & { section?: string | null };
import { countUnseenGrades, isGradeSeen } from '../notifications';
import { canSeeModule, sortCategories } from '../access';
import { useResolvedTheme } from '../theme';
import { ThemeToggle } from './ThemeToggle';
import { useHasReviewAssignments, useReviewTodoCount } from './assessment/ReviewerQueue';
import { assignmentApplies, assignmentStatus, dueLabel, weekGroups, weekLabel } from '../assessment/outline';

const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin (Real)',
  sound_designer: 'Sound Designer',
  audio_engineer: 'Audio Engineer',
  reviewer: 'Reviewer',
};

export const Sidebar: React.FC<{
  selectedModuleId: string;
  // Current non-module page ('program', 'review', 'episode:B', ...).
  activePage?: string;
  setSelectedModuleId: (id: string) => void;
  isRealAdmin: boolean;
  effectiveRole: Role | undefined;
  previewRole: Role | null;
  onChangePreviewRole: (role: Role | null) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}> = ({ selectedModuleId, activePage, setSelectedModuleId, isRealAdmin, effectiveRole, previewRole, onChangePreviewRole, collapsed, onToggleCollapse, mobileOpen, onCloseMobile }) => {
  const { modules: allModules, categories, currentUser, submissions, logout, updateUserTheme, enrollments, exercises, assessmentSubmissions, programOutline, assignments, videoProgress } = useAppContext();
  // Weeks the trainee folded away in the sidebar - a per-browser
  // convenience, so localStorage is enough (falls back to all open).
  const [foldedWeeks, setFoldedWeeks] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('foldedWeeks') || '[]'); } catch { return []; }
  });
  const toggleWeek = (id: string) => setFoldedWeeks(f => {
    const next = f.includes(id) ? f.filter(x => x !== id) : [...f, id];
    try { localStorage.setItem('foldedWeeks', JSON.stringify(next)); } catch { /* storage blocked */ }
    return next;
  });
  // Trainees (and admins previewing as one) navigate the program week by
  // week once an outline exists.
  const weekMode = effectiveRole === 'sound_designer' && !!programOutline?.weeks.length;
  const ownEnrollment = enrollments.find(e => e.id === currentUser?.id);
  const hasReviews = useHasReviewAssignments();
  const reviewTodo = useReviewTodoCount();
  const programLinks = [
    ...(ownEnrollment ? [
      { page: 'program', hash: '#/program', label: 'My Program', icon: '📋' },
      // With a weekly outline, Episode B and Pod are assignments inside
      // the weeks instead of separate links.
      ...(weekMode ? [] : [
        { page: 'episode:B', hash: '#/episode/B', label: 'Episode B – Final Test', icon: '🎬' },
        { page: 'episode:P1', hash: '#/episode/P1', label: ownEnrollment.podEpisodesRequired === 2 ? 'Pod Trial – Episode 1' : 'Pod Trial', icon: '🎧' },
        ...(ownEnrollment.podEpisodesRequired === 2 ? [{ page: 'episode:P2', hash: '#/episode/P2', label: 'Pod Trial – Episode 2', icon: '🎧' }] : []),
      ]),
    ] : []),
    ...(hasReviews ? [{ page: 'review', hash: '#/review', label: `Review Queue${reviewTodo ? ` (${reviewTodo})` : ''}`, icon: '✅' }] : []),
  ];
  // Admins load every module; when previewing as a designer, hide what a
  // designer without unlocks couldn't see so the preview is realistic.
  const modules = allModules.filter(m => canSeeModule(m, categories, currentUser, effectiveRole));
  const byOrder = (a: { order: number }, b: { order: number }) => a.order - b.order;
  // In week mode, modules already placed in a week aren't repeated in the
  // category sections below.
  const placed = new Set(weekMode ? programOutline!.weeks.flatMap(w => w.items.flatMap(i => (i.kind === 'content' ? [i.moduleId] : []))) : []);
  const listed = (m: { id: string }) => !weekMode || !placed.has(m.id);
  const sections = [
    ...sortCategories(categories).map(c => ({ key: c.id, title: c.name, mods: modules.filter(m => m.category === c.id && listed(m)).sort(byOrder) })),
    // Modules whose category was removed still need to be reachable.
    { key: '__none', title: 'Other', mods: modules.filter(m => !categories.some(c => c.id === m.category) && listed(m)).sort(byOrder) },
  ].filter(sec => sec.mods.length > 0);
  const isDark = useResolvedTheme(currentUser) === 'dark';
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Only designers have grades of their own to be notified about - an
  // unseen grade is one whose module hasn't been opened since it was
  // graded (see notifications.ts / ModuleView's markGradeSeen).
  const unseenGradeCount = effectiveRole === 'sound_designer' && currentUser
    ? countUnseenGrades(
        currentUser.id,
        modules
          .filter(m => submissions.find(s => s.moduleId === m.id && s.userId === currentUser.id)?.status === 'graded')
          .map(m => m.id)
      )
    : 0;

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const isCollapsed = isRealAdmin && collapsed;

  return (
    <>
      {mobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          aria-hidden="true"
        />
      )}
      <aside className={`${isCollapsed ? 'lg:w-24' : 'lg:w-72'} w-72 fixed lg:static inset-y-0 left-0 z-40 lg:z-auto bg-rail flex flex-col p-4 shadow-xl overflow-hidden flex-shrink-0 transition-transform lg:transition-all duration-200 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
      {/* Decorative "Doraemon" Ring/Collar Detail at bottom */}
      <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-[#F4511E] rounded-full opacity-20 pointer-events-none"></div>

      <div className={`flex items-center gap-3 mb-8 z-10 ${isCollapsed ? 'flex-col' : ''}`}>
        <button
          onClick={() => {
            if (unseenGradeCount === 0 || !currentUser) return;
            const firstUnseen = [...modules].sort((a, b) => a.order - b.order).find(m =>
              submissions.find(s => s.moduleId === m.id && s.userId === currentUser.id)?.status === 'graded' &&
              !isGradeSeen(currentUser.id, m.id)
            );
            if (firstUnseen) setSelectedModuleId(firstUnseen.id);
          }}
          title={unseenGradeCount > 0 ? `${unseenGradeCount} new grade${unseenGradeCount === 1 ? '' : 's'} - click to open` : undefined}
          className="relative w-10 flex-shrink-0"
        >
          <img src="/storyco-logo-light.png" alt="StoryCo" className="w-10 h-auto rounded-md shadow-md dark:hidden" />
          <img src="/storyco-logo-dark.png" alt="StoryCo" className="w-10 h-auto rounded-md shadow-md hidden dark:block" />
          {unseenGradeCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-[#F4511E] text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-surface shadow-sm">
              {unseenGradeCount}
            </span>
          )}
        </button>
        {!isCollapsed && (
          <h1 className="flex flex-col leading-none">
            <img src="/storyco-logo-text-light.png" alt="StoryCo" className="h-4 w-auto self-start dark:hidden" />
            <img src="/storyco-logo-text-dark.png" alt="" aria-hidden="true" className="h-4 w-auto self-start hidden dark:block" />
            <span className="text-[#E0F2FE] text-[9px] font-extrabold uppercase tracking-[0.08em] whitespace-nowrap mt-0.5">Audio Training Program</span>
          </h1>
        )}
        {isRealAdmin && (
          <button
            onClick={onToggleCollapse}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`${isCollapsed ? '' : 'ml-auto'} hidden lg:flex w-7 h-7 flex-shrink-0 bg-white/20 rounded-full items-center justify-center text-white font-black text-xs hover:bg-white/30 transition-colors`}
          >
            <svg viewBox="0 0 24 24" className={`w-4 h-4 ${collapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
        )}
        <button
          onClick={onCloseMobile}
          title="Close menu"
          className="ml-auto lg:hidden w-7 h-7 flex-shrink-0 bg-white/20 rounded-full flex items-center justify-center text-white font-black text-xs hover:bg-white/30 transition-colors"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 z-10 scrollbar-hide pb-4">
        {programLinks.length > 0 && (
          <div className="mb-6">
            {!isCollapsed && <p className="text-[#E0F2FE] text-[10px] uppercase font-extrabold tracking-widest mb-3 pl-2">Assessment</p>}
            <div className="space-y-2">
              {programLinks.map(link => {
                const active = activePage === link.page;
                return (
                  <button
                    key={link.page}
                    onClick={() => { window.location.hash = link.hash; onCloseMobile(); }}
                    title={link.label}
                    aria-current={active ? 'page' : undefined}
                    className={`${isCollapsed ? 'w-14 h-14 mx-auto justify-center' : 'w-full p-3 gap-3'} flex items-center rounded-2xl transition-all ${
                      active ? 'theme-light bg-surface text-navy font-bold shadow-md' : 'text-white/80 font-semibold hover:bg-white/10'
                    }`}
                  >
                    <span aria-hidden="true" className="w-6 text-center flex-shrink-0">{link.icon}</span>
                    {!isCollapsed && <span className="leading-tight text-left">{link.label}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {weekMode && programOutline!.weeks.map(week => {
          const rows = weekGroups(week, assignments).flatMap(g => g.items.flatMap<WeekRow>(it => {
            const section = g.section?.title ?? null;
            if (it.kind === 'content') {
              const mod = modules.find(m => m.id === it.moduleId);
              return mod ? [{ key: it.id, kind: 'content' as const, mod, section }] : [];
            }
            if (it.kind === 'assignment') {
              const asg = assignments.find(a => a.id === it.assignmentId);
              return asg && assignmentApplies(asg, ownEnrollment) ? [{ key: it.id, kind: 'assignment' as const, asg, section }] : [];
            }
            return []; // milestones show on My Program, not in the sidebar
          }));
          const hasSections = rows.some(r => r.section);
          if (!rows.length) return null;
          const weekNo = programOutline!.weeks.indexOf(week) + 1;
          const isDone = (row: WeekRow) => row.kind === 'content'
            ? videoProgress.some(v => v.moduleId === row.mod.id && v.userId === currentUser?.id)
            : assignmentStatus(row.asg, currentUser?.id, assessmentSubmissions) === 'submitted';
          const doneCount = rows.filter(isDone).length;
          // The week holding the page you're on never folds away.
          const hasSelected = rows.some(r => r.kind === 'content' ? selectedModuleId === r.mod.id : activePage === `assignment:${r.asg.id}`);
          const weekOpen = isCollapsed || hasSelected || !foldedWeeks.includes(week.id);
          return (
            <div key={week.id} className="mb-6">
              {!isCollapsed && (
                <button onClick={() => toggleWeek(week.id)} aria-expanded={weekOpen}
                  className="w-full flex items-center gap-1.5 text-[#E0F2FE] text-[10px] uppercase font-extrabold tracking-widest mb-3 pl-2 hover:text-white">
                  <span aria-hidden="true" className={`transition-transform ${weekOpen ? 'rotate-90' : ''}`}>›</span>
                  <span className="text-left">{weekLabel(programOutline!.weeks.indexOf(week))}</span>
                  <span className="ml-auto pr-2 text-white/60">{doneCount}/{rows.length}</span>
                </button>
              )}
              {weekOpen && (
              <div className="space-y-2">
                {rows.map((row, i) => {
                  const n = i + 1;
                  const selected = row.kind === 'content' ? selectedModuleId === row.mod.id : activePage === `assignment:${row.asg.id}`;
                  const title = row.kind === 'content' ? row.mod.title : row.asg.title;
                  const status = row.kind === 'assignment' ? assignmentStatus(row.asg, currentUser?.id, assessmentSubmissions) : null;
                  const due = row.kind === 'assignment' ? dueLabel(ownEnrollment?.startDate, weekNo, row.asg.dueDay) : '';
                  const open = () => {
                    if (row.kind === 'content') setSelectedModuleId(row.mod.id);
                    else { window.location.hash = `#/assignment/${row.asg.id}`; onCloseMobile(); }
                  };
                  const cls = selected ? 'theme-light bg-surface text-navy font-bold shadow-md' : 'text-white/80 font-semibold hover:bg-white/10';
                  if (isCollapsed) {
                    return (
                      <button key={row.key} onClick={open} title={title} aria-current={selected ? 'page' : undefined}
                        className={`w-14 h-14 mx-auto flex items-center justify-center rounded-2xl font-black text-sm transition-all ${selected ? cls : `bg-white/10 ${cls}`}`}>
                        {n}
                      </button>
                    );
                  }
                  // Section heading above the first row of each section; loose
                  // items after the sections get "Also this week".
                  const heading = hasSections && (i === 0 || rows[i - 1].section !== row.section) ? (row.section ?? 'Also this week') : null;
                  return (
                    <React.Fragment key={row.key}>
                    {heading && <p className="text-white/70 text-[11px] font-black pl-3 pt-2">{heading}</p>}
                    <button onClick={open} aria-current={selected ? 'page' : undefined}
                      className={`w-full flex items-center justify-between gap-2 p-3 rounded-2xl text-left transition-all ${cls}`}>
                      <span className="flex items-center gap-3 min-w-0">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 ${
                          row.kind === 'content' && isDone(row) ? 'bg-[#3DDC97] text-[#0B3D2A]' : selected ? 'bg-sky' : ''}`}>
                          {row.kind === 'content' && isDone(row) ? '✓' : n}
                        </span>
                        <span className="leading-tight">
                          {row.kind === 'assignment' && <span aria-hidden="true">📝 </span>}{title}
                          {due && <span className={`block text-[10px] font-bold ${selected ? 'text-gray-500' : 'text-white/60'}`}>Due {due}</span>}
                        </span>
                      </span>
                      {status && (
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider flex-shrink-0 ${
                          status === 'submitted' ? 'bg-[#3DDC97] text-[#0B3D2A]'
                            : status === 'draft' ? 'bg-[#2E9DF7]/20 text-navy'
                            : selected ? 'bg-gray-100 text-gray-500' : 'bg-black/10 text-white/90'
                        }`}>
                          {status === 'submitted' ? '✓ Submitted' : status === 'draft' ? 'Draft' : 'To do'}
                        </span>
                      )}
                    </button>
                    </React.Fragment>
                  );
                })}
              </div>
              )}
            </div>
          );
        })}

        {sections.map(({ key, title, mods }) => (
          <div key={key} className="mb-6">
            {!isCollapsed && (
              <p className="text-[#E0F2FE] text-[10px] uppercase font-extrabold tracking-widest mb-3 pl-2">{title}</p>
            )}
            <div className="space-y-2">
              {mods.map((mod) => {
                  const isSelected = selectedModuleId === mod.id;
                  // Own submission only matters for a designer's own view -
                  // for engineers/admins this stays undefined so the
                  // "completed" dimming below never fires for someone
                  // else's data.
                  const sub = effectiveRole === 'sound_designer'
                    ? submissions.find(s => s.moduleId === mod.id && s.userId === currentUser?.id)
                    : undefined;
                  // Selected wins over completed, so the module you're on
                  // is never dimmed.
                  const isCompleted = !isSelected && sub?.status === 'graded';

                  // What the badge shows depends on who's looking: a designer
                  // sees their own status, an engineer sees how many
                  // submissions are waiting on them for this module (not
                  // their own nonexistent submission), and an admin sees a
                  // real count instead of a single-student status that used
                  // to be meaningless in this view.
                  const neutralBadge = isSelected ? 'bg-gray-100 text-gray-500' : 'bg-black/10 text-white/90';
                  let statusBadge: React.ReactNode;
                  if (effectiveRole === 'audio_engineer') {
                    const pendingCount = submissions.filter(s => s.moduleId === mod.id && s.status === 'submitted').length;
                    statusBadge = pendingCount > 0 ? (
                      <span className="bg-[#F4511E]/20 text-ember px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ml-2 flex-shrink-0">{pendingCount} Pending</span>
                    ) : (
                      <span className={`${neutralBadge} px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ml-2 flex-shrink-0`}>Clear</span>
                    );
                  } else if (effectiveRole === 'admin') {
                    const totalCount = submissions.filter(s => s.moduleId === mod.id).length;
                    statusBadge = (
                      <span className={`${isSelected ? 'bg-[#2E9DF7]/20 text-navy' : 'bg-white/20 text-white'} px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ml-2 flex-shrink-0`}>{totalCount} Submitted</span>
                    );
                  } else if (sub?.status === 'graded') {
                    const unseen = currentUser ? !isGradeSeen(currentUser.id, mod.id) : false;
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 bg-[#3DDC97] text-[#0B3D2A] px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ml-2 flex-shrink-0 shadow-sm">
                        {unseen && <span className="w-1.5 h-1.5 rounded-full bg-[#F4511E]" title="New feedback" />}
                        <span aria-hidden="true">✓</span> Graded
                      </span>
                    );
                  } else if (sub?.status === 'submitted') {
                    statusBadge = <span className="bg-[#2E9DF7]/20 text-navy px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ml-2 flex-shrink-0">Submitted</span>;
                  } else {
                    statusBadge = <span className={`${neutralBadge} px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ml-2 flex-shrink-0`}>Not Started</span>;
                  }

                  const label = mod.label || mod.order.toString().padStart(2, '0');
                  // Three states: selected = bright white card, completed =
                  // dimmed, default = standard sidebar item.
                  const stateClass = isSelected
                    ? 'theme-light bg-surface text-navy font-bold shadow-md'
                    : 'text-white/80 font-semibold hover:bg-white/10';
                  const dimClass = isCompleted ? 'opacity-50 group-hover:opacity-80 transition-opacity' : '';

                  if (isCollapsed) {
                    return (
                      <button
                        key={mod.id}
                        onClick={() => setSelectedModuleId(mod.id)}
                        title={mod.title}
                        className={`w-14 h-14 mx-auto flex items-center justify-center rounded-2xl font-black text-sm transition-all ${isSelected ? stateClass : `bg-white/10 ${stateClass} ${dimClass}`}`}
                      >
                        {label}
                      </button>
                    );
                  }

                  return (
                    <button
                      key={mod.id}
                      onClick={() => setSelectedModuleId(mod.id)}
                      aria-current={isSelected ? 'page' : undefined}
                      className={`group w-full flex items-center justify-between p-3 rounded-2xl transition-all ${stateClass}`}
                    >
                      <span className={`flex items-center gap-3 text-left ${dimClass}`}>
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 ${isSelected ? 'bg-sky' : ''}`}>
                          {label}
                        </span>
                        <span className="leading-tight">{mod.title}</span>
                      </span>
                      {statusBadge}
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-auto pt-4 z-10">
        <div className={`flex items-center mb-3 ${isCollapsed ? 'justify-center' : 'justify-between px-2'}`}>
          {!isCollapsed && (
            <span className="text-[#E0F2FE] text-[10px] uppercase font-extrabold tracking-widest">{isDark ? 'Dark mode' : 'Light mode'}</span>
          )}
          <ThemeToggle isDark={isDark} onChange={(dark) => updateUserTheme(dark ? 'dark' : 'light')} />
        </div>
        <div
          ref={menuRef}
          className={`bg-[#1E40AF]/20 border border-white/10 rounded-3xl flex items-center relative cursor-pointer hover:bg-[#1E40AF]/30 transition-colors ${isCollapsed ? 'p-2 justify-center' : 'p-4 justify-between'}`}
          onClick={() => setMenuOpen(o => !o)}
        >
          <div className={`flex items-center gap-3 truncate ${isCollapsed ? 'gap-0' : ''}`}>
            {currentUser?.avatarBase64 ? (
              <img src={currentUser.avatarBase64} alt="Avatar" className="w-10 h-10 rounded-full border-2 border-surface shadow-sm object-cover flex-shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[#F4511E] border-2 border-surface shadow-sm flex items-center justify-center text-white font-black flex-shrink-0">
                {currentUser?.name.substring(0, 2).toUpperCase()}
              </div>
            )}
            {!isCollapsed && (
              <div className="truncate">
                <p className="text-xs text-white/70 font-medium capitalize">
                  {(previewRole ?? currentUser?.role)?.replace('_', ' ')}
                  {previewRole && <span className="ml-1 opacity-70">(preview)</span>}
                </p>
                <p className="text-sm text-white font-bold truncate">{currentUser?.name}</p>
              </div>
            )}
          </div>

          {menuOpen && (
            <div onClick={(e) => e.stopPropagation()} className="flex absolute bottom-full left-0 w-56 mb-2 flex-col gap-1 bg-surface p-2 rounded-2xl shadow-xl z-50">
               <button onClick={() => { setMenuOpen(false); window.dispatchEvent(new CustomEvent('open-profile')); }} className="text-left px-2 py-1 text-xs font-black text-[#F4511E] hover:bg-gray-100 rounded-lg mb-1">My Profile</button>

               {/* Admin-only: preview other dashboards without changing your
                   real role or signing in as anyone else. Purely a client-side
                   view toggle - see App.tsx effectiveRole. */}
               {isRealAdmin && (
                 <>
                   <p className="text-[10px] text-gray-400 font-black uppercase px-2 pt-2 mb-1 border-t">Preview As</p>
                   {(['admin', 'sound_designer', 'audio_engineer'] as Role[]).map((role) => (
                     <button
                       key={role}
                       onClick={() => { setMenuOpen(false); onChangePreviewRole(role === 'admin' ? null : role); }}
                       className={`text-left px-2 py-1 text-xs font-bold rounded-lg ${
                         (previewRole ?? 'admin') === role ? 'bg-sky text-navy' : 'text-gray-700 hover:bg-gray-100'
                       }`}
                     >
                       {ROLE_LABELS[role]}
                     </button>
                   ))}
                 </>
               )}

               <button onClick={() => { setMenuOpen(false); logout(); }} className="text-left px-2 py-1 text-xs font-bold text-gray-700 hover:bg-gray-100 rounded-lg border-t pt-2 mt-1">Logout</button>
            </div>
          )}
        </div>
      </div>
    </aside>
    </>
  );
};
