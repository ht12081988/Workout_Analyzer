'use client';

import React, { useEffect, useState } from 'react';

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("visionfit.theme");
    if (savedTheme === 'light' || savedTheme === 'dark') {
      setTheme(savedTheme);
      document.documentElement.setAttribute("data-theme", savedTheme);
    } else {
      document.documentElement.setAttribute("data-theme", "dark");
      setTheme("dark");
    }
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    window.localStorage.setItem("visionfit.theme", nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
  };

  if (!mounted) return <div className="h-10 w-10 flex-shrink-0" />;

  return (
    <button
      onClick={toggleTheme}
      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-surface-elev border border-border text-fg hover:bg-surface-elev-hover transition-all shadow-sm"
      aria-label="Toggle Dark Mode"
      title="Toggle Dark Mode"
    >
      <span className="material-symbols-outlined text-xl">
        {theme === 'light' ? 'dark_mode' : 'light_mode'}
      </span>
    </button>
  );
}
