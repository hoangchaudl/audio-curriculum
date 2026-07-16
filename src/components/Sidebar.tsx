import React, { useEffect, useRef, useState } from 'react';
import { useAppContext } from '../store';
import { Role } from '../types';

const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin (Real)',
  sound_designer: 'Sound Designer',
  audio_engineer: 'Audio Engineer',
};

export const Sidebar: React.FC<{
  selectedModuleId: string;
  setSelectedModuleId: (id: string) => void;
  isRealAdmin: boolean;
  previewRole: Role | null;
  onChangePreviewRole: (role: Role | null) => void;
}> = ({ selectedModuleId, setSelectedModuleId, isRealAdmin, previewRole, onChangePreviewRole }) => {
  const { modules, currentUser, submissions, logout } = useAppContext();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  return (
    <aside className="w-72 bg-[#2E9DF7] flex flex-col p-6 shadow-xl relative overflow-hidden flex-shrink-0">
      {/* Decorative "Doraemon" Ring/Collar Detail at bottom */}
      <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-[#F4511E] rounded-full opacity-20"></div>

      <div className="flex items-center gap-3 mb-8 z-10">
        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
          <div className="w-6 h-6 bg-[#2E9DF7] rounded-full"></div>
        </div>
        <h1 className="text-white font-bold text-xl tracking-tight">StoryCo Audio</h1>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 z-10 scrollbar-hide pb-4">
        {['Onboarding', 'Intermediate', 'Advanced'].map(category => (
          <div key={category} className="mb-6">
            <p className="text-[#E0F2FE] text-[10px] uppercase font-extrabold tracking-widest mb-3 pl-2">{category}</p>
            <div className="space-y-2">
              {modules
                .filter(m => m.category === category)
                .sort((a, b) => a.order - b.order)
                .map((mod) => {
                  const isSelected = selectedModuleId === mod.id;
                  const sub = submissions.find(s => s.moduleId === mod.id && s.userId === currentUser?.id);
                  
                  let statusBadge = null;
                  if (sub?.status === 'graded') {
                    statusBadge = <span className="bg-[#3DDC97]/20 text-[#2A8F62] px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ml-2 flex-shrink-0">Graded</span>;
                  } else if (sub?.status === 'submitted') {
                    statusBadge = <span className="bg-[#2E9DF7]/20 text-[#1E40AF] px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ml-2 flex-shrink-0">Submitted</span>;
                  } else if (sub?.status === 'in_progress' || (isSelected && !sub)) {
                    statusBadge = <span className="bg-[#F4511E]/20 text-[#C53914] px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ml-2 flex-shrink-0">In Progress</span>;
                  } else {
                    statusBadge = <span className="bg-black/10 text-white/90 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ml-2 flex-shrink-0">Not Started</span>;
                  }

                  if (isSelected) {
                    return (
                      <button
                        key={mod.id}
                        onClick={() => setSelectedModuleId(mod.id)}
                        className="w-full flex items-center justify-between p-3 bg-[#E0F2FE] border-2 border-white rounded-2xl text-[#1E40AF] font-bold shadow-inner"
                      >
                        <span className="flex items-center gap-3 text-left">
                          <span className="bg-white w-6 h-6 rounded-full flex items-center justify-center text-[10px] flex-shrink-0">
                            {mod.label || mod.order.toString().padStart(2, '0')}
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
                        className="w-full flex items-center justify-between p-3 bg-white rounded-2xl text-[#2E9DF7] font-bold shadow-sm"
                      >
                        <span className="flex items-center gap-3 text-left">
                          <span className="w-6 text-center flex-shrink-0">{mod.label || mod.order.toString().padStart(2, '0')}</span>
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
                      className="w-full flex items-center justify-between p-3 text-white/70 font-semibold hover:bg-white/10 rounded-2xl transition-colors"
                    >
                      <span className="flex items-center gap-3 text-left">
                        <span className="w-6 text-center flex-shrink-0">{mod.label || mod.order.toString().padStart(2, '0')}</span>
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

      <div className="mt-auto pt-6 z-10">
        <div ref={menuRef} className="bg-[#1E40AF]/20 p-4 rounded-3xl flex items-center justify-between border border-white/10 relative cursor-pointer" onClick={() => setMenuOpen(o => !o)}>
          <div className="flex items-center gap-3 truncate">
            {currentUser?.avatarBase64 ? (
              <img src={currentUser.avatarBase64} alt="Avatar" className="w-10 h-10 rounded-full border-2 border-white object-cover flex-shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[#F4511E] border-2 border-white flex items-center justify-center text-white font-bold flex-shrink-0">
                {currentUser?.name.substring(0, 2).toUpperCase()}
              </div>
            )}
            <div className="truncate">
              <p className="text-xs text-white/70 font-medium capitalize">
                {(previewRole ?? currentUser?.role)?.replace('_', ' ')}
                {previewRole && <span className="ml-1 opacity-70">(preview)</span>}
              </p>
              <p className="text-sm text-white font-bold truncate">{currentUser?.name}</p>
            </div>
          </div>

          {menuOpen && (
            <div onClick={(e) => e.stopPropagation()} className="flex absolute bottom-full left-0 w-full mb-2 flex-col gap-1 bg-white p-2 rounded-2xl shadow-xl z-50">
               <button onClick={() => { setMenuOpen(false); window.dispatchEvent(new CustomEvent('open-profile')); }} className="text-left px-2 py-1 text-xs font-bold text-[#F4511E] hover:bg-gray-100 rounded-lg mb-1">My Profile</button>

               {/* Admin-only: preview other dashboards without changing your
                   real role or signing in as anyone else. Purely a client-side
                   view toggle - see App.tsx effectiveRole. */}
               {isRealAdmin && (
                 <>
                   <p className="text-[10px] text-gray-400 font-bold uppercase px-2 pt-2 mb-1 border-t">Preview As</p>
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
  );
};
