import React, { useEffect, useRef, useState } from 'react';
import { useAppContext } from '../store';
import { Role } from '../types';
import { useResolvedTheme } from '../theme';
import { ThemeToggle } from './ThemeToggle';

// StoryCo brand + account controls for admins, who have no sidebar: theme,
// My Profile, "Preview as" another role, and log out. `onBack` shows a
// "← Dashboard" link on pages other than the dashboard.
export const AdminHeader: React.FC<{ onPreview: (role: Role) => void; onBack?: () => void; children?: React.ReactNode }> = ({ onPreview, onBack, children }) => {
  const { currentUser, logout, updateUserTheme } = useAppContext();
  const isDark = useResolvedTheme(currentUser) === 'dark';
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  const item = 'w-full text-left px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-100 rounded-xl';

  return (
    <header className="bg-surface border-b px-4 md:px-10 py-3 flex-shrink-0 flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-3">
        <img src="/storyco-logo-light.png" alt="StoryCo" className="w-10 h-auto rounded-md shadow-md dark:hidden" />
        <img src="/storyco-logo-dark.png" alt="StoryCo" className="w-10 h-auto rounded-md shadow-md hidden dark:block" />
        <div className="leading-none">
          <img src="/storyco-logo-text-light.png" alt="StoryCo" className="h-4 w-auto dark:hidden" />
          <img src="/storyco-logo-text-dark.png" alt="" aria-hidden="true" className="h-4 w-auto hidden dark:block" />
          <span className="block text-[#2E9DF7] text-[9px] font-extrabold uppercase tracking-[0.08em] mt-1">Audio Training Program · Director</span>
        </div>
      </div>
      {onBack && <button onClick={onBack} className="text-sm font-bold text-[#2E9DF7] hover:underline">← Dashboard</button>}
      <div className="ml-auto flex items-center gap-3 flex-wrap">
        {children}
        <ThemeToggle isDark={isDark} onChange={dark => updateUserTheme(dark ? 'dark' : 'light')} />
        <div ref={menuRef} className="relative">
          <button onClick={() => setOpen(o => !o)} aria-expanded={open} aria-label="Account menu"
            className="flex items-center gap-2 rounded-full bg-gray-50 hover:bg-gray-100 pl-1 pr-3 py-1">
            {currentUser?.avatarBase64 ? (
              <img src={currentUser.avatarBase64} alt="" className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <span className="w-8 h-8 rounded-full bg-[#F4511E] text-white text-xs font-black flex items-center justify-center">{currentUser?.name.substring(0, 2).toUpperCase()}</span>
            )}
            <span className="text-sm font-bold text-gray-700 hidden sm:inline">{currentUser?.name}</span>
          </button>
          {open && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-surface rounded-2xl shadow-xl border border-gray-100 p-2 z-50">
              <button onClick={() => { setOpen(false); window.dispatchEvent(new CustomEvent('open-profile')); }} className={item}>My Profile</button>
              <p className="text-[10px] text-gray-400 font-black uppercase px-3 pt-2 pb-1 border-t mt-1">Preview as</p>
              {(['sound_designer', 'reviewer', 'audio_engineer'] as Role[]).map(role => (
                <button key={role} onClick={() => { setOpen(false); onPreview(role); }} className={item}>
                  {role === 'sound_designer' ? 'Sound Designer (trainee)' : role === 'reviewer' ? 'Reviewer' : 'Audio Engineer'}
                </button>
              ))}
              <button onClick={() => { setOpen(false); logout(); }} className={`${item} border-t mt-1`}>Log out</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
