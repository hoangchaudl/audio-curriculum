import { useEffect, useState } from 'react';
import { User } from './types';

const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)');

// The account's saved choice wins; with none saved (or before sign-in),
// follow the OS setting.
export const useResolvedTheme = (user: User | null): 'light' | 'dark' => {
  const [osDark, setOsDark] = useState(() => darkQuery().matches);
  useEffect(() => {
    const q = darkQuery();
    const onChange = () => setOsDark(q.matches);
    q.addEventListener('change', onChange);
    return () => q.removeEventListener('change', onChange);
  }, []);
  return user?.theme ?? (osDark ? 'dark' : 'light');
};

// Toggles the `dark` class that index.css keys the dark palette off.
export const useApplyTheme = (theme: 'light' | 'dark') => {
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);
};
