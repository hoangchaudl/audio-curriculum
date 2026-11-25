import React, { createContext, useContext, useEffect, useState } from 'react';
import { translate } from './translations';

type Language = 'en' | 'vi';
const LanguageContext = createContext<{ language: Language; setLanguage: (value: Language) => void }>({ language: 'en', setLanguage: () => {} });

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(() => {
    try { return localStorage.getItem('opsLanguage') === 'vi' ? 'vi' : 'en'; } catch { return 'en'; }
  });
  useEffect(() => {
    document.documentElement.lang = language;
    try { localStorage.setItem('opsLanguage', language); } catch { /* Preference lasts for this visit if storage is blocked. */ }
  }, [language]);
  return <LanguageContext.Provider value={{ language, setLanguage }}>{children}</LanguageContext.Provider>;
};

export const useT = () => {
  const { language } = useContext(LanguageContext);
  return (source: string, values?: Record<string, string | number>) => translate(language, source, values);
};

export const useLanguage = () => useContext(LanguageContext);

export const LanguageSwitch = () => {
  const { language, setLanguage } = useContext(LanguageContext);
  return <label className="flex items-center gap-2 text-xs font-bold">
    <span>Language</span>
    <select aria-label="Language" value={language} onChange={e => setLanguage(e.target.value as Language)} className="rounded-lg border px-2 py-1 bg-surface text-ink">
      <option value="en">English</option><option value="vi">Tiếng Việt</option>
    </select>
  </label>;
};
