'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

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
    <main className="min-h-screen bg-surface pb-28 text-on-surface">
      {/* Navigation - Replicating main layout for consistency */}
      <nav className="fixed left-0 top-0 z-50 grid h-16 w-full grid-cols-2 items-center bg-surface-container-lowest/30 px-4 shadow-sm backdrop-blur-xl md:grid-cols-3 md:px-8 border-b border-outline-variant/5">
        <div className="flex items-center">
          <span 
            className="font-headline text-xl font-black italic text-primary cursor-pointer"
            onClick={() => router.push('/')}
          >
            VisionFiT
          </span>
        </div>

        <div className="hidden items-center justify-center gap-8 font-headline text-sm font-bold md:flex">
          <a 
            className="text-on-surface-variant transition-colors hover:text-secondary" 
            href="#"
            onClick={(e) => { e.preventDefault(); router.push('/'); }}
          >
            Practice
          </a>
          <a className="text-primary" href="#">
            History
          </a>
        </div>

        <div className="flex items-center justify-end gap-4">
          <button
            className="flex items-center gap-2 rounded-full bg-primary/5 px-4 py-2 text-sm font-semibold text-primary transition-all hover:bg-primary/10 active:scale-95"
            onClick={handleSignOut}
            type="button"
          >
            <span className="material-symbols-outlined text-sm">logout</span>
            Sign Out
          </button>
        </div>
      </nav>

      <section className="mx-auto max-w-7xl px-4 pb-16 pt-24 md:px-16">
        <header className="mb-12">
          <p className="mb-3 font-body text-xs font-bold uppercase text-secondary tracking-widest">
            Athlete History
          </p>
          <h1 className="font-headline text-4xl font-extrabold leading-tight text-primary md:text-6xl">
            Your Performance Journey.
          </h1>
          <p className="mt-4 max-w-2xl font-body text-base leading-7 text-on-surface-variant">
            Review every attempt, refine your form, and track your biomechanical evolution over time.
          </p>
        </header>

        {/* Search & Filters - Unified Inline Bar */}
        <div className="mb-12 flex flex-col md:flex-row items-center gap-4">
          <div className="relative group flex-1 w-full">
            <span className="material-symbols-outlined absolute left-6 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors">
              search
            </span>
            <input 
              type="text" 
              placeholder="Search exercise history..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-[2rem] bg-surface-container-low py-4 pl-16 pr-8 font-body text-sm text-on-surface outline-none border border-transparent focus:border-primary/20 focus:bg-surface-container-lowest transition-all shadow-sm focus:shadow-xl"
            />
          </div>
          
          <div className="flex w-full md:w-auto items-center gap-3">
            <div className="flex flex-1 md:flex-initial items-center gap-2 rounded-full bg-surface-container-low px-4 py-2 border border-outline-variant/10">
              <span className="material-symbols-outlined text-sm text-outline">category</span>
              <select 
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setSubcategoryFilter('All');
                }}
                className="flex-1 bg-transparent font-headline text-xs font-bold text-primary outline-none cursor-pointer"
              >
                {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>

            <div className="flex flex-1 md:flex-initial items-center gap-2 rounded-full bg-surface-container-low px-4 py-2 border border-outline-variant/10">
              <span className="material-symbols-outlined text-sm text-outline">account_tree</span>
              <select 
                value={subcategoryFilter}
                onChange={(e) => setSubcategoryFilter(e.target.value)}
                className="flex-1 bg-transparent font-headline text-xs font-bold text-primary outline-none cursor-pointer"
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
                className="flex items-center justify-center p-2 rounded-full bg-secondary/10 text-secondary hover:bg-primary/10 hover:text-primary transition-all"
                title="Clear Filters"
              >
                <span className="material-symbols-outlined text-xl">filter_alt_off</span>
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="rounded-[3rem] bg-surface-container-low p-12 text-center font-body text-on-surface-variant">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mb-4"></div>
            <p>Retaining your performance data...</p>
          </div>
        ) : error ? (
          <div className="rounded-[3rem] bg-error-container p-12 text-on-error-container">
            <h2 className="font-headline text-2xl font-bold">Data Unavailable</h2>
            <p className="mt-3 font-body">{error}</p>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="rounded-[3rem] bg-surface-container-low p-12 text-center">
            <span className="material-symbols-outlined text-6xl text-outline-variant mb-4">history</span>
            <h2 className="font-headline text-2xl font-bold text-primary">No sessions found</h2>
            <p className="mt-2 font-body text-on-surface-variant">Adjust your filters to see more history.</p>
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
            className="space-y-6"
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
                className="group relative flex flex-col gap-6 overflow-hidden rounded-[3rem] bg-surface-container-low p-8 transition-all hover:bg-surface-container-lowest hover:shadow-2xl md:flex-row md:items-center"
                onClick={() => router.push(`/history/${session.id}`)}
                role="button"
              >
                <div className="flex flex-1 items-center gap-6">
                  <div className="flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-primary-fixed text-primary group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-3xl">
                      {session.exercise_name.toLowerCase().includes('squat') ? 'accessibility_new' : 
                       session.exercise_name.toLowerCase().includes('lunge') ? 'directions_run' : 
                       'fitness_center'}
                    </span>
                  </div>
                  <div>
                    <h2 className="font-headline text-2xl font-bold text-primary">
                      {session.exercise_name}
                    </h2>
                    <p className="font-body text-sm text-on-surface-variant">
                      {formatDate(session.start_time)} • {session.exercise_category} {(session as any).exercise_subcategory && `• ${(session as any).exercise_subcategory}`}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-8 md:gap-16">
                  <div className="text-center md:text-left">
                    <p className="font-label text-[10px] uppercase tracking-widest text-outline">Successful Attempts</p>
                    <p className="font-headline text-2xl font-black text-primary">{session.total_reps || 0}</p>
                  </div>
                  <div className="text-center md:text-left">
                    <p className="font-label text-[10px] uppercase tracking-widest text-outline">Total Attempts</p>
                    <p className="font-headline text-2xl font-black text-secondary">
                      {(session as any).total_attempts || 0}
                    </p>
                  </div>
                  <div className="text-center md:text-left">
                    <p className="font-label text-[10px] uppercase tracking-widest text-outline">Time</p>
                    <p className="font-headline text-2xl font-black text-primary">
                      {formatDuration(session.total_duration_seconds)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end md:ml-8">
                  <span className="material-symbols-outlined text-outline transition-transform group-hover:translate-x-2 group-hover:text-primary">
                    arrow_forward_ios
                  </span>
                </div>
              </motion.article>
            ))}
          </motion.div>
        )}
      </section>

      {/* Mobile Nav */}
      <nav className="fixed bottom-0 left-0 z-50 flex h-20 w-full items-center justify-around bg-inverse-surface/95 px-4 text-inverse-on-surface shadow-2xl backdrop-blur-2xl md:hidden">
        <a 
          className="flex flex-col items-center justify-center px-3 py-1 text-inverse-on-surface/60" 
          href="#"
          onClick={(e) => { e.preventDefault(); router.push('/'); }}
        >
          <span className="material-symbols-outlined">grid_view</span>
          <span className="mt-1 font-body text-[10px] font-semibold uppercase">Practice</span>
        </a>
        <a className="flex flex-col items-center justify-center rounded-[1rem] bg-primary-fixed px-3 py-1 text-primary" href="#">
          <span className="material-symbols-outlined">insights</span>
          <span className="mt-1 font-body text-[10px] font-semibold uppercase">History</span>
        </a>
      </nav>
    </main>
  );
}
