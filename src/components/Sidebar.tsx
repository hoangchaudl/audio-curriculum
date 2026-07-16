import React from 'react';
import { useAppContext } from '../store';

export const Sidebar: React.FC<{
  selectedModuleId: string;
  setSelectedModuleId: (id: string) => void;
}> = ({ selectedModuleId, setSelectedModuleId }) => {
  const { modules, currentUser, submissions } = useAppContext();

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

      <div className="flex-1 space-y-2 overflow-y-auto pr-2 z-10 scrollbar-hide">
        <p className="text-[#E0F2FE] text-[10px] uppercase font-extrabold tracking-widest mb-4">12-Module Curriculum</p>
        
        {modules.sort((a, b) => a.order - b.order).map((mod) => {
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
                <span className="flex items-center gap-3">
                  <span className="bg-white w-6 h-6 rounded-full flex items-center justify-center text-[10px]">
                    {mod.order.toString().padStart(2, '0')}
                  </span>
                  {mod.title}
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
                <span className="flex items-center gap-3">
                  <span>{mod.order.toString().padStart(2, '0')}</span>
                  {mod.title}
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
              <span className="flex items-center gap-3">
                <span>{mod.order.toString().padStart(2, '0')}</span>
                {mod.title}
              </span>
              {statusBadge}
            </button>
          );
        })}
      </div>

      <div className="mt-auto pt-6 z-10">
        <div className="bg-[#1E40AF]/20 p-4 rounded-3xl flex items-center justify-between border border-white/10 group relative cursor-pointer">
          <div className="flex items-center gap-3 truncate">
            {currentUser?.avatarBase64 ? (
              <img src={currentUser.avatarBase64} alt="Avatar" className="w-10 h-10 rounded-full border-2 border-white object-cover flex-shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[#F4511E] border-2 border-white flex items-center justify-center text-white font-bold flex-shrink-0">
                {currentUser?.name.substring(0, 2).toUpperCase()}
              </div>
            )}
            <div className="truncate">
              <p className="text-xs text-white/70 font-medium capitalize">{currentUser?.role.replace('_', ' ')}</p>
              <p className="text-sm text-white font-bold truncate">{currentUser?.name}</p>
            </div>
          </div>

          <div className="hidden group-hover:flex absolute bottom-full left-0 w-full mb-2 flex-col gap-1 bg-white p-2 rounded-2xl shadow-xl z-50">
             <button onClick={() => window.dispatchEvent(new CustomEvent('open-profile'))} className="text-left px-2 py-1 text-xs font-bold text-[#F4511E] hover:bg-gray-100 rounded-lg mb-1">My Profile</button>
             <p className="text-[10px] text-gray-500 font-bold uppercase px-2 mb-1 border-t pt-1">Switch User</p>
             <button onClick={() => window.location.reload()} className="text-left px-2 py-1 text-xs font-bold text-[#2E9DF7] hover:bg-gray-100 rounded-lg">Reset (Refresh)</button>
             <button onClick={() => window.dispatchEvent(new CustomEvent('switch-user', { detail: 'julian@storyco.example' }))} className="text-left px-2 py-1 text-xs font-bold hover:bg-gray-100 rounded-lg">Designer (Julian)</button>
             <button onClick={() => window.dispatchEvent(new CustomEvent('switch-user', { detail: 'sarah@storyco.example' }))} className="text-left px-2 py-1 text-xs font-bold hover:bg-gray-100 rounded-lg">Engineer (Sarah)</button>
             <button onClick={() => window.dispatchEvent(new CustomEvent('switch-user', { detail: 'admin@storyco.example' }))} className="text-left px-2 py-1 text-xs font-bold hover:bg-gray-100 rounded-lg">Admin (Director)</button>
          </div>
        </div>
      </div>
    </aside>
  );
};
