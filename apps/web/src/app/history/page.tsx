'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ThemeToggle } from '@/components/ThemeToggle';

type Session = {
  id: string;
  exercise_name: string;
  exercise_category: string;
  start_time: string;
  end_time: string | null;
  total_reps: number;
  average_accuracy: number;
  total_duration_seconds: number;
  status: string;
};

const API_BASE_URL = '/api';
const AUTH_USER_STORAGE_KEY = 'visionfit.auth.user';

export default function HistoryPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState<{ id: string; name: string; email: string } | null>(null);
  
  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [subcategoryFilter, setSubcategoryFilter] = useState('All');

  useEffect(() => {
    const storedUser = window.localStorage.getItem(AUTH_USER_STORAGE_KEY);
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        fetchSessions(parsedUser.id);
      } catch (e) {
        router.push('/');
      }
    } else {
      router.push('/');
    }
  }, [router]);

  const fetchSessions = async (userId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/sessions?customer_id=${userId}`);
      if (!response.ok) throw new Error('Failed to fetch sessions');
      const data = await response.json();
      setSessions(data);
    } catch (err) {
      setError('Could not load your workout history.');
    } finally {
      setLoading(false);
    }
  };

  const categories = useMemo(() => {
    const cats = new Set(sessions.map(s => s.exercise_category));
    return ['All', ...Array.from(cats)];
  }, [sessions]);

  const subcategories = useMemo(() => {
    const filteredByCat = categoryFilter === 'All' 
      ? sessions 
      : sessions.filter(s => s.exercise_category === categoryFilter);
    const subs = new Set(filteredByCat.map(s => (s as any).exercise_subcategory).filter(Boolean));
    return ['All', ...Array.from(subs)];
  }, [sessions, categoryFilter]);

  const filteredSessions = useMemo(() => {
    return sessions.filter(session => {
      const matchesSearch = session.exercise_name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === 'All' || session.exercise_category === categoryFilter;
      const matchesSubcategory = subcategoryFilter === 'All' || (session as any).exercise_subcategory === subcategoryFilter;
      return matchesSearch && matchesCategory && matchesSubcategory;
    });
  }, [sessions, searchQuery, categoryFilter, subcategoryFilter]);

  const handleSignOut = () => {
    window.localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    router.push('/');
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return '0s';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  return (
    <main className="min-h-screen bg-bg pb-28 text-fg">
      {/* Navigation - Replicating main layout for consistency */}
      <nav className="fixed left-0 top-0 z-50 grid h-16 w-full grid-cols-2 items-center bg-surface-card/60 px-4 shadow-sm backdrop-blur-xl md:grid-cols-3 md:px-8 border-b border-border">
        <div className="flex items-center">
          <span 
            className="h3 italic text-fg cursor-pointer"
            onClick={() => router.push('/')}
          >
            VisionFiT
          </span>
        </div>

        <div className="hidden items-center justify-center gap-8 font-bold md:flex text-sm">
          <a 
            className="text-fg-mute transition-colors hover:text-fg" 
            href="#"
            onClick={(e) => { e.preventDefault(); router.push('/'); }}
          >
            Practice
          </a>
          <a className="text-flame border-b-2 border-flame pb-1" href="#">
            History
          </a>
        </div>

        <div className="flex items-center justify-end gap-4">
          <ThemeToggle />
          <button
            className="flex items-center gap-2 rounded-full bg-surface-elev px-4 py-2 text-sm font-semibold text-fg transition-all hover:bg-surface-elev-hover active:scale-95 border border-border"
            onClick={handleSignOut}
            type="button"
          >
            <span className="material-symbols-outlined text-sm">logout</span>
            Sign Out
          </button>
        </div>
      </nav>

      <section className="mx-auto max-w-7xl px-4 pb-16 pt-20 md:px-16">
        <header className="mb-8">
          <p className="mb-3 kicker text-fg-mute">
            Athlete History
          </p>
          <h1 className="text-xl md:text-3xl font-bold text-fg font-display">
            Your Performance Journey.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-fg-mute">
            Review every attempt, refine your form, and track your biomechanical evolution over time.
          </p>
        </header>

        {/* Search & Filters - Unified Inline Bar */}
        <div className="mb-8 flex flex-col md:flex-row items-center gap-4">
          <div className="relative group flex-1 w-full">
            <span className="material-symbols-outlined absolute left-6 top-1/2 -translate-y-1/2 text-fg-mute group-focus-within:text-flame transition-colors">
              search
            </span>
            <input 
              type="text" 
              placeholder="Search exercise history..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-[2rem] bg-surface-card border border-border py-4 pl-16 pr-8 text-sm text-fg outline-none focus:border-flame focus:bg-surface-elev transition-all shadow-sm focus:shadow-xl"
            />
          </div>
          
          <div className="flex w-full md:w-auto items-center gap-3">
            <div className="flex flex-1 md:flex-initial items-center gap-2 rounded-full bg-surface-card px-4 py-2 border border-border">
              <span className="material-symbols-outlined text-sm text-fg-mute">category</span>
              <select 
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setSubcategoryFilter('All');
                }}
                className="flex-1 bg-transparent h3 !text-sm text-flame outline-none cursor-pointer"
              >
                {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>

            <div className="flex flex-1 md:flex-initial items-center gap-2 rounded-full bg-surface-card px-4 py-2 border border-border">
              <span className="material-symbols-outlined text-sm text-fg-mute">account_tree</span>
              <select 
                value={subcategoryFilter}
                onChange={(e) => setSubcategoryFilter(e.target.value)}
                className="flex-1 bg-transparent h3 !text-sm text-flame outline-none cursor-pointer"
              >
                {subcategories.map(sub => <option key={sub} value={sub}>{sub}</option>)}
              </select>
            </div>

            {(searchQuery || categoryFilter !== 'All' || subcategoryFilter !== 'All') && (
              <button 
                onClick={() => {
                  setSearchQuery('');
                  setCategoryFilter('All');
                  setSubcategoryFilter('All');
                }}
                className="flex items-center justify-center p-2 rounded-full bg-surface-card text-fg-mute hover:bg-surface-elev hover:text-flame border border-border transition-all"
                title="Clear Filters"
              >
                <span className="material-symbols-outlined text-xl">filter_alt_off</span>
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="rounded-[3rem] bg-surface-card border border-border p-12 text-center text-fg-mute">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-flame border-t-transparent mb-4"></div>
            <p>Retaining your performance data...</p>
          </div>
        ) : error ? (
          <div className="rounded-[3rem] bg-[#FFE4E4] border border-[#FFCDCD] p-12 text-[#D32F2F] dark:bg-[#4A1010] dark:text-[#FFB4B4] dark:border-[#5C1818]">
            <h2 className="h2 font-bold">Data Unavailable</h2>
            <p className="mt-3">{error}</p>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="rounded-[3rem] bg-surface-card border border-border p-12 text-center">
            <span className="material-symbols-outlined text-6xl text-fg-mute mb-4">history</span>
            <h2 className="h3 font-bold text-fg">No sessions found</h2>
            <p className="mt-2 text-fg-mute">Adjust your filters to see more history.</p>
          </div>
        ) : (
          <motion.div 
            initial="hidden"
            animate="show"
            variants={{
              hidden: { opacity: 0 },
              show: {
                opacity: 1,
                transition: {
                  staggerChildren: 0.1
                }
              }
            }}
            className="space-y-3"
          >
            {filteredSessions.map((session) => (
              <motion.article 
                key={session.id}
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  show: { opacity: 1, y: 0 }
                }}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="group relative flex flex-col gap-4 overflow-hidden rounded-2xl bg-surface-card border border-border p-5 md:px-6 transition-all hover:bg-surface-elev hover:shadow-lg md:flex-row md:items-center"
                onClick={() => router.push(`/history/${session.id}`)}
                role="button"
              >
                <div className="flex flex-1 items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-surface-elev border border-border text-flame group-hover:scale-105 transition-transform">
                    <span className="material-symbols-outlined text-2xl">
                      {session.exercise_name.toLowerCase().includes('squat') ? 'accessibility_new' : 
                       session.exercise_name.toLowerCase().includes('lunge') ? 'directions_run' : 
                       'fitness_center'}
                    </span>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-fg">
                      {session.exercise_name}
                    </h2>
                    <p className="text-sm text-fg-mute">
                      {formatDate(session.start_time)} • {session.exercise_category} {(session as any).exercise_subcategory && `• ${(session as any).exercise_subcategory}`}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 md:gap-8 min-w-[300px]">
                  <div className="text-center md:text-left">
                    <p className="kicker text-[10px] text-fg-mute">Successful Attempts</p>
                    <p className="text-xl font-bold text-flame">{session.total_reps || 0}</p>
                  </div>
                  <div className="text-center md:text-left">
                    <p className="kicker text-[10px] text-fg-mute">Total Attempts</p>
                    <p className="text-xl font-bold text-fg">
                      {(session as any).total_attempts || 0}
                    </p>
                  </div>
                  <div className="text-center md:text-left">
                    <p className="kicker text-[10px] text-fg-mute">Time</p>
                    <p className="text-xl font-bold text-flame">
                      {formatDuration(session.total_duration_seconds)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end md:ml-8">
                  <span className="material-symbols-outlined text-fg-mute transition-transform group-hover:translate-x-2 group-hover:text-flame">
                    arrow_forward_ios
                  </span>
                </div>
              </motion.article>
            ))}
          </motion.div>
        )}
      </section>

      {/* Mobile Nav */}
      <nav className="fixed bottom-0 left-0 z-50 flex h-20 w-full items-center justify-around bg-surface-card border-t border-border px-4 text-fg shadow-2xl md:hidden">
        <a 
          className="flex flex-col items-center justify-center px-3 py-1 text-fg-mute hover:text-fg transition-colors" 
          href="#"
          onClick={(e) => { e.preventDefault(); router.push('/'); }}
        >
          <span className="material-symbols-outlined">grid_view</span>
          <span className="mt-1 text-[10px] font-semibold uppercase">Practice</span>
        </a>
        <a className="flex flex-col items-center justify-center rounded-xl bg-flame/10 px-3 py-1 text-flame" href="#">
          <span className="material-symbols-outlined">insights</span>
          <span className="mt-1 text-[10px] font-semibold uppercase">History</span>
        </a>
      </nav>
    </main>
  );
}
