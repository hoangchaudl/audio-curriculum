import { useEffect, useState } from 'react';
import { User } from './types';

const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)');

// Choice made on a sign-in page (shared with the Audio Hub, same key), kept on this device.
const readStored = (): 'light' | 'dark' | null => { try { const v = localStorage.getItem('opsTheme'); return v === 'light' || v === 'dark' ? v : null; } catch { return null; } };
export const setStoredTheme = (theme: 'light' | 'dark') => {
  try { localStorage.setItem('opsTheme', theme); } catch { /* lasts until reload if storage is blocked */ }
  window.dispatchEvent(new Event('ops-theme'));
};

// The account's saved choice wins; then the device choice from a sign-in page;
// with neither, follow the OS setting.
export const useResolvedTheme = (user: User | null): 'light' | 'dark' => {
  const [osDark, setOsDark] = useState(() => darkQuery().matches);
  const [stored, setStored] = useState(readStored);
  useEffect(() => {
    const q = darkQuery();
    const onChange = () => setOsDark(q.matches);
    const onStored = () => setStored(readStored());
    q.addEventListener('change', onChange);
    window.addEventListener('ops-theme', onStored);
    return () => { q.removeEventListener('change', onChange); window.removeEventListener('ops-theme', onStored); };
  }, []);
  return user?.theme ?? stored ?? (osDark ? 'dark' : 'light');
};

// Toggles the `dark` class that index.css keys the dark palette off.
export const useApplyTheme = (theme: 'light' | 'dark') => {
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);
};
