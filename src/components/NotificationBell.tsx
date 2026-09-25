import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppContext } from '../store';
import { traineeNotifications } from '../assessment/notifications';

const TONE: Record<string, string> = {
  red: 'border-l-[#F4511E]', orange: 'border-l-[#FFA94D]', blue: 'border-l-[#2E9DF7]', green: 'border-l-[#3DDC97]',
};

// 🔔 for trainees: what's overdue, due soon, behind pace, planned today, or
// newly published. The red count is what they haven't opened or marked
// read; read state is saved on their account, so it follows them across
// devices. `align` says which way the panel opens.
export const NotificationBell: React.FC<{ align?: 'left' | 'right'; light?: boolean }> = ({ align = 'left', light }) => {
  const { currentUser, programOutline, assignments, modules, enrollments, videoProgress, assessmentSubmissions, publications, markNotificationsRead } = useAppContext();
  // The panel renders into <body> (the sidebar clips overflow), placed
  // under the bell from its on-screen position.
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const open = anchor !== null;
  const setOpen = (next: boolean | ((o: boolean) => boolean)) => {
    const value = typeof next === 'function' ? next(open) : next;
    setAnchor(value ? ref.current?.getBoundingClientRect() ?? null : null);
  };
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!ref.current?.contains(t) && !panelRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const enrollment = enrollments.find(e => e.id === currentUser?.id);
  if (!currentUser || currentUser.role !== 'sound_designer' || !enrollment) return null;
  const notices = traineeNotifications(programOutline, assignments, modules, enrollment, currentUser.id, videoProgress,
    assessmentSubmissions.filter(s => s.traineeId === currentUser.id), publications.find(p => p.id === currentUser.id));
  const read = new Set(currentUser.readNotifications ?? []);
  const unread = notices.filter(n => !read.has(n.id));
  // Only keep ids that still exist, so the saved list stays small.
  const markRead = (ids: string[]) => markNotificationsRead([...new Set([...notices.map(n => n.id).filter(id => read.has(id)), ...ids])]);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(o => !o)} aria-label={`Notifications${unread.length ? ` (${unread.length} unread)` : ''}`} aria-expanded={open}
        className={`relative w-9 h-9 rounded-full flex items-center justify-center text-lg transition-colors ${light ? 'bg-sky hover:bg-[#2E9DF7]/20' : 'bg-white/20 hover:bg-white/30'}`}>
        <span aria-hidden="true">🔔</span>
        {unread.length > 0 && (
          <span className="absolute -top-1 -right-1 bg-[#F4511E] text-white text-[10px] font-black min-w-5 h-5 px-1 rounded-full flex items-center justify-center border-2 border-surface">
            {unread.length}
          </span>
        )}
      </button>
      {anchor && createPortal(
        <div ref={panelRef} style={{ top: anchor.bottom + 8, ...(align === 'left' ? { left: anchor.left } : { right: window.innerWidth - anchor.right }) }}
          className="fixed w-80 max-w-[85vw] bg-surface rounded-2xl shadow-xl border border-gray-100 z-[60] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <p className="text-sm font-black text-gray-800">Notifications</p>
            {unread.length > 0 && <button onClick={() => markRead(notices.map(n => n.id))} className="text-xs font-bold text-[#2E9DF7] hover:underline">Mark all read</button>}
          </div>
          {notices.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-400 text-center">You're all caught up 🎉</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {notices.map(n => (
                <li key={n.id}>
                  <button onClick={() => { markRead([n.id]); setOpen(false); window.location.hash = n.hash; }}
                    className={`w-full text-left flex gap-3 px-4 py-3 border-l-4 hover:bg-gray-50 ${TONE[n.tone]} ${read.has(n.id) ? 'opacity-60' : ''}`}>
                    <span aria-hidden="true">{n.icon}</span>
                    <span className={`text-sm leading-snug ${read.has(n.id) ? 'text-gray-500' : 'text-gray-800 font-bold'}`}>{n.text}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
};
