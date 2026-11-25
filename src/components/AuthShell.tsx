import React from 'react';
import { ThemeToggle } from './ThemeToggle';

// The sign-in page frame shared by the Training Program and the Audio Hub, so the two
// look the same: backdrop, logo, a card for `children`, language + theme, then a back link.
export const AuthShell: React.FC<{
  subtitle: string;
  language: { label: string; value: 'en' | 'vi'; onChange: (v: 'en' | 'vi') => void };
  isDark: boolean;
  onTheme: (dark: boolean) => void;
  back?: React.ReactNode;
  children: React.ReactNode;
}> = ({ subtitle, language, isDark, onTheme, back, children }) => (
  <main className="flex-1 min-h-screen w-full flex flex-col items-center justify-center bg-page text-ink font-sans p-6 relative overflow-hidden">
    <div className="absolute top-[-100px] left-[-100px] w-96 h-96 bg-brand rounded-full opacity-10 pointer-events-none"></div>
    <div className="absolute bottom-[-150px] right-[-50px] w-[500px] h-[500px] bg-warm rounded-full opacity-10 pointer-events-none"></div>
    <div className="w-full max-w-md z-10">
      <div className="text-center mb-10">
        <div className="w-20 h-20 mx-auto bg-surface shadow-xl border-4 border-page rounded-full flex items-center justify-center mb-6 relative">
          <div className="w-12 h-12 bg-brand rounded-full"></div>
          <div className="absolute -bottom-2 w-8 h-8 bg-warm border-4 border-surface rounded-full flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-4 h-4 text-white" fill="currentColor" aria-hidden="true">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
          </div>
        </div>
        <h1 className="flex flex-col items-center leading-none">
          <img src="/storyco-logo-text-light.png" alt="StoryCo" className="h-9 w-auto dark:hidden" />
          <img src="/storyco-logo-text-dark.png" alt="" aria-hidden="true" className="h-9 w-auto hidden dark:block" />
          <span className="text-sm font-bold uppercase tracking-[0.3em] text-gray-500 mt-2">{subtitle}</span>
        </h1>
      </div>
      {children}
      <div className="flex items-center justify-center gap-4 mt-6">
        <label className="flex items-center gap-2 text-xs font-bold text-gray-500">
          <span>{language.label}</span>
          <select aria-label="Language" value={language.value} onChange={e => language.onChange(e.target.value as 'en' | 'vi')} className="rounded-lg border px-2 py-1 bg-surface text-ink">
            <option value="en">English</option><option value="vi">Tiếng Việt</option>
          </select>
        </label>
        <ThemeToggle isDark={isDark} onChange={onTheme} />
      </div>
      {back && <div className="text-center text-xs font-bold text-gray-500 hover:text-brand transition-colors mt-4">{back}</div>}
    </div>
  </main>
);
