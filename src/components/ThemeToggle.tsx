import React from 'react';

// Sun/moon switch - both icons are always shown and a white knob slides
// behind the active one, so the current mode is obvious at a glance.
export const ThemeToggle: React.FC<{ isDark: boolean; onChange: (dark: boolean) => void }> = ({ isDark, onChange }) => (
  <button
    role="switch"
    aria-checked={isDark}
    aria-label="Dark mode"
    title={isDark ? 'Dark mode on - switch to light' : 'Light mode on - switch to dark'}
    onClick={() => onChange(!isDark)}
    className="relative flex items-center w-16 h-8 p-0.5 rounded-full bg-black/15 hover:bg-black/25 transition-colors flex-shrink-0"
  >
    <span
      aria-hidden="true"
      className={`absolute top-0.5 left-0.5 w-7 h-7 rounded-full bg-white shadow-md transition-transform duration-200 ${isDark ? 'translate-x-8' : ''}`}
    />
    <span aria-hidden="true" className={`relative z-10 w-7 h-7 flex items-center justify-center transition-colors ${isDark ? 'text-white/70' : 'text-[#F5A623]'}`}>
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
        <circle cx="12" cy="12" r="4" fill="currentColor" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    </span>
    <span aria-hidden="true" className={`relative z-10 w-7 h-7 ml-1 flex items-center justify-center transition-colors ${isDark ? 'text-[#1E40AF]' : 'text-white/70'}`}>
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
    </span>
  </button>
);
