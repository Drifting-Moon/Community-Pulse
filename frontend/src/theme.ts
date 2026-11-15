import { useState, useEffect } from 'react';

export type Theme = 'light' | 'dark';

export function getInitialTheme(): Theme {
  try {
    const saved = localStorage.getItem('app-theme');
    if (saved === 'dark' || saved === 'light') return saved;
  } catch (e) {
    // ignore
  }
  return 'light'; // Default to white
}

export function applyTheme(theme: Theme) {
  try {
    localStorage.setItem('app-theme', theme);
  } catch (e) {
    // ignore
  }
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  if (theme === 'dark') {
    root.classList.add('dark');
    root.classList.remove('light');
  } else {
    root.classList.add('light');
    root.classList.remove('dark');
  }
}

// Immediately apply theme on script load
applyTheme(getInitialTheme());

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'app-theme' && (e.newValue === 'light' || e.newValue === 'dark')) {
        setThemeState(e.newValue);
        applyTheme(e.newValue);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [theme]);

  const toggleTheme = () => {
    const nextTheme: Theme = theme === 'light' ? 'dark' : 'light';
    setThemeState(nextTheme);
    applyTheme(nextTheme);
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    applyTheme(newTheme);
  };

  return { theme, toggleTheme, setTheme };
}
