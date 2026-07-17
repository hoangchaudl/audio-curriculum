import React, { useEffect, useRef, useState } from 'react';
import { useAppContext } from '../store';
import { Role } from '../types';
import { countUnseenGrades, isGradeSeen } from '../notifications';

const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin (Real)',
  sound_designer: 'Sound Designer',
  audio_engineer: 'Audio Engineer',
};

export const Sidebar: React.FC<{
  selectedModuleId: string;
  setSelectedModuleId: (id: string) => void;
  isRealAdmin: boolean;
  effectiveRole: Role | undefined;
  previewRole: Role | null;
  onChangePreviewRole: (role: Role | null) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}> = ({ selectedModuleId, setSelectedModuleId, isRealAdmin, effectiveRole, previewRole, onChangePreviewRole, collapsed, onToggleCollapse, mobileOpen, onCloseMobile }) => {
  const { modules, currentUser, submissions, logout } = useAppContext();
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
      <aside className={`${isCollapsed ? 'lg:w-24' : 'lg:w-72'} w-72 fixed lg:static inset-y-0 left-0 z-40 lg:z-auto bg-[#2E9DF7] border-r-[3px] border-black flex flex-col p-4 overflow-hidden flex-shrink-0 transition-transform lg:transition-all duration-200 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
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
          className="relative w-10 h-10 bg-white border-[3px] border-black rounded-full flex items-center justify-center flex-shrink-0"
        >
          <div className="w-5 h-5 bg-[#2E9DF7] rounded-full"></div>
          {unseenGradeCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-[#F4511E] text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-black">
              {unseenGradeCount}
            </span>
          )}
        </button>
        {!isCollapsed && (
          <h1 className="flex flex-col leading-none">
            <span className="flex items-center text-white font-black text-base tracking-tight uppercase">
              STORY
              <svg viewBox="0 0 24 24" className="w-4 h-4 -mx-0.5 flex-shrink-0 text-[#3DDC97]" fill="currentColor" aria-hidden="true">
                <path d="M7 2v11h3v9l7-12h-4l4-8z" />
              </svg>
              CO
            </span>
            <span className="text-white/70 text-[9px] font-black uppercase tracking-[0.2em] mt-0.5">Audio Academy</span>
          </h1>
        )}
        {isRealAdmin && (
          <button
            onClick={onToggleCollapse}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`${isCollapsed ? '' : 'ml-auto'} hidden lg:flex w-7 h-7 flex-shrink-0 bg-white border-2 border-black rounded-full items-center justify-center text-black font-black text-xs hover:bg-gray-100 transition-colors`}
          >
            {collapsed ? '»' : '«'}
          </button>
        )}
        <button
          onClick={onCloseMobile}
          title="Close menu"
          className="ml-auto lg:hidden w-7 h-7 flex-shrink-0 bg-white border-2 border-black rounded-full flex items-center justify-center text-black font-black text-xs hover:bg-gray-100 transition-colors"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 z-10 scrollbar-hide pb-4">
        {['Onboarding', 'Intermediate', 'Advanced'].map(category => (
          <div key={category} className="mb-6">
            {!isCollapsed && (
              <p className="text-white/80 text-[10px] uppercase font-black tracking-widest mb-3 pl-2">{category}</p>
            )}
            <div className="space-y-2">
              {modules
                .filter(m => m.category === category)
                .sort((a, b) => a.order - b.order)
                .map((mod) => {
                  const isSelected = selectedModuleId === mod.id;
                  // Own submission only matters for a designer's own view -
                  // for engineers/admins this stays undefined so the "graded
                  // card" highlight below never fires for someone else's data.
                  const sub = effectiveRole === 'sound_designer'
                    ? submissions.find(s => s.moduleId === mod.id && s.userId === currentUser?.id)
                    : undefined;

                  // What the badge shows depends on who's looking: a designer
                  // sees their own status, an engineer sees how many
                  // submissions are waiting on them for this module (not
                  // their own nonexistent submission), and an admin sees a
                  // real count instead of a single-student status that used
                  // to be meaningless in this view.
                  let statusBadge: React.ReactNode;
                  if (effectiveRole === 'audio_engineer') {
                    const pendingCount = submissions.filter(s => s.moduleId === mod.id && s.status === 'submitted').length;
                    statusBadge = pendingCount > 0 ? (
                      <span className="bg-[#F4511E] text-white border-2 border-black px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ml-2 flex-shrink-0">{pendingCount} Pending</span>
                    ) : (
                      <span className="bg-black/20 text-white/90 border-2 border-black/40 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ml-2 flex-shrink-0">Clear</span>
                    );
                  } else if (effectiveRole === 'admin') {
                    const totalCount = submissions.filter(s => s.moduleId === mod.id).length;
                    statusBadge = (
                      <span className="bg-white/20 text-white border-2 border-white/40 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ml-2 flex-shrink-0">{totalCount} Submitted</span>
                    );
                  } else if (sub?.status === 'graded') {
                    const unseen = currentUser ? !isGradeSeen(currentUser.id, mod.id) : false;
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 bg-[#3DDC97]/30 text-[#0f3d28] border-2 border-black px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ml-2 flex-shrink-0">
                        {unseen && <span className="w-1.5 h-1.5 rounded-full bg-[#F4511E]" title="New feedback" />}
                        Graded
                      </span>
                    );
                  } else if (sub?.status === 'submitted') {
                    statusBadge = <span className="bg-white text-[#1E40AF] border-2 border-black px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ml-2 flex-shrink-0">Submitted</span>;
                  } else {
                    statusBadge = <span className="bg-black/20 text-white/90 border-2 border-black/40 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ml-2 flex-shrink-0">Not Started</span>;
                  }

                  const label = mod.label || mod.order.toString().padStart(2, '0');

                  if (isCollapsed) {
                    return (
                      <button
                        key={mod.id}
                        onClick={() => setSelectedModuleId(mod.id)}
                        title={mod.title}
                        className={`w-14 h-14 mx-auto flex items-center justify-center rounded-2xl border-[3px] font-black text-sm transition-colors ${
                          isSelected
                            ? 'bg-white border-black text-black'
                            : 'bg-white/10 border-white/30 text-white hover:bg-white/20'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  }

                  if (isSelected) {
                    return (
                      <button
                        key={mod.id}
                        onClick={() => setSelectedModuleId(mod.id)}
                        className="w-full flex items-center justify-between p-3 bg-white border-[3px] border-black rounded-2xl text-black font-black"
                      >
                        <span className="flex items-center gap-3 text-left">
                          <span className="bg-[#2E9DF7] text-white border-2 border-black w-6 h-6 rounded-full flex items-center justify-center text-[10px] flex-shrink-0">
                            {label}
                          </span>
                          <span className="leading-tight">{mod.title}</span>
                        </span>
                        {statusBadge}
                      </button>
                    );
                  }

                  if (sub?.status === 'graded') {
                    return (
                      <button
                        key={mod.id}
                        onClick={() => setSelectedModuleId(mod.id)}
                        className="w-full flex items-center justify-between p-3 bg-white/95 border-2 border-black/50 rounded-2xl text-[#1E40AF] font-bold hover:border-black transition-colors"
                      >
                        <span className="flex items-center gap-3 text-left">
                          <span className="w-6 text-center flex-shrink-0">{label}</span>
                          <span className="leading-tight">{mod.title}</span>
                        </span>
                        {statusBadge}
                      </button>
                    );
                  }

                  return (
                    <button
                      key={mod.id}
                      onClick={() => setSelectedModuleId(mod.id)}
                      className="w-full flex items-center justify-between p-3 text-white/80 font-bold hover:bg-white/10 rounded-2xl transition-colors"
                    >
                      <span className="flex items-center gap-3 text-left">
                        <span className="w-6 text-center flex-shrink-0">{label}</span>
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
        <div
          ref={menuRef}
          className={`bg-white border-2 border-black rounded-2xl flex items-center relative cursor-pointer ${isCollapsed ? 'p-2 justify-center' : 'p-3 justify-between'}`}
          onClick={() => setMenuOpen(o => !o)}
        >
          <div className={`flex items-center gap-3 truncate ${isCollapsed ? 'gap-0' : ''}`}>
            {currentUser?.avatarBase64 ? (
              <img src={currentUser.avatarBase64} alt="Avatar" className="w-10 h-10 rounded-full border-2 border-black object-cover flex-shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[#F4511E] border-2 border-black flex items-center justify-center text-white font-black flex-shrink-0">
                {currentUser?.name.substring(0, 2).toUpperCase()}
              </div>
            )}
            {!isCollapsed && (
              <div className="truncate">
                <p className="text-xs text-gray-500 font-bold capitalize">
                  {(previewRole ?? currentUser?.role)?.replace('_', ' ')}
                  {previewRole && <span className="ml-1 opacity-70">(preview)</span>}
                </p>
                <p className="text-sm text-black font-black truncate">{currentUser?.name}</p>
              </div>
            )}
          </div>

          {menuOpen && (
            <div onClick={(e) => e.stopPropagation()} className="flex absolute bottom-full left-0 w-56 mb-2 flex-col gap-1 bg-white p-2 rounded-2xl border-[3px] border-black shadow-xl z-50">
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
                         (previewRole ?? 'admin') === role ? 'bg-[#E0F2FE] text-[#1E40AF]' : 'text-gray-700 hover:bg-gray-100'
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
