'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ThemeToggle } from '@/components/ThemeToggle';

type User = {
  id: string;
  name?: string;
  email?: string;
};

type Exercise = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  subcategory: string | null;
  image_path: string | null;
  video_path: string | null;
  camera_angle: string | null;
  status: boolean;
  created_at: string;
};

const API_BASE_URL = '/api';
const DEFAULT_EXERCISE_IMAGE = '/exercises/squats.svg';
const AUTH_USER_STORAGE_KEY = 'visionfit.auth.user';
const EXERCISE_LOAD_ERROR =
  'Could not load exercises. Please make sure the API server is running.';

const exerciseIcons: Record<string, string> = {
  squats: 'accessibility_new',
  'pile squats': 'accessibility',
  'split lunges': 'directions_run',
  'standing calf raise': 'arrow_upward',
};

const exerciseGradients: Record<string, string> = {
  squats: 'from-[#D1FAE5] to-[#A7F3D0]',
  'pile squats': 'from-[#FFEDD5] to-[#FED7AA]',
  'split lunges': 'from-[#CFFAFE] to-[#A5F3FC]',
  'standing calf raise': 'from-[#F3E8FF] to-[#E9D5FF]',
};

function getExerciseIcon(name: string) {
  return exerciseIcons[name.toLowerCase()] || 'fitness_center';
}

function getExerciseGradient(name: string) {
  return exerciseGradients[name.toLowerCase()] || 'from-primary-fixed to-primary-fixed-dim';
}

function getExerciseImage(name: string, path: string | null) {
  const normalized = name.toLowerCase();
  if (normalized === 'squats') return '/exercises/squats.png';
  if (normalized === 'pile squats') return '/exercises/pile-squats.png';
  if (normalized === 'split lunges') return '/exercises/split-lunges.png';
  if (normalized === 'standing calf raise') return '/exercises/standing-calf-raise.png';
  return path || DEFAULT_EXERCISE_IMAGE;
}

async function fetchExercises() {
  const response = await fetch(`${API_BASE_URL}/exercises`);

  if (!response.ok) {
    throw new Error('Exercise request failed');
  }

  const data = await response.json();

  if (!Array.isArray(data)) {
    throw new Error('Exercise response was not a list');
  }

  return data as Exercise[];
}

function PracticeDashboard({
  user,
  onSignOut,
}: {
  user: User;
  onSignOut: () => void;
}) {
  const router = useRouter();
  const [activeExercise, setActiveExercise] = useState<string | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [exercisesLoading, setExercisesLoading] = useState(true);
  const [exercisesError, setExercisesError] = useState('');
  const [athleteMode, setAthleteMode] = useState<'self' | 'trainer'>('self');
  const [trainers, setTrainers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [selectedTrainerId, setSelectedTrainerId] = useState<string>('');
  const [trainerError, setTrainerError] = useState('');
  const displayEmail = user.email || 'athlete@performance.ai';

  useEffect(() => {
    const savedMode = window.localStorage.getItem('visionfit.athlete.mode');
    if (savedMode === 'trainer') setAthleteMode('trainer');
  }, []);

  useEffect(() => {
    if (athleteMode === 'trainer' && user.id) {
      fetch(`${API_BASE_URL}/athletes/${user.id}/trainers`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setTrainers(data);
            if (data.length > 0) {
               const savedTrainer = window.localStorage.getItem('visionfit.athlete.trainer_id');
               if (savedTrainer && data.find(t => t.id === savedTrainer)) {
                 setSelectedTrainerId(savedTrainer);
               } else {
                 setSelectedTrainerId(data[0].id);
                 window.localStorage.setItem('visionfit.athlete.trainer_id', data[0].id);
               }
            } else {
               setAthleteMode('self');
               window.localStorage.setItem('visionfit.athlete.mode', 'self');
               setTrainerError("You don't have any linked trainers yet.");
            }
          }
        })
        .catch(err => console.error('Failed to fetch trainers', err));
    }
  }, [athleteMode, user.id]);

  const loadExercises = useCallback(async () => {
    setExercisesLoading(true);
    setExercisesError('');

    try {
      setExercises(await fetchExercises());
    } catch {
      setExercisesError(EXERCISE_LOAD_ERROR);
    } finally {
      setExercisesLoading(false);
    }
  }, []);

  useEffect(() => {
    let isCurrent = true;

    async function loadInitialExercises() {
      try {
        const data = await fetchExercises();

        if (isCurrent) {
          setExercises(data);
        }
      } catch {
        if (isCurrent) {
          setExercisesError(EXERCISE_LOAD_ERROR);
        }
      } finally {
        if (isCurrent) {
          setExercisesLoading(false);
        }
      }
    }

    void loadInitialExercises();

    return () => {
      isCurrent = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-bg pb-28 text-fg">
      <nav className="fixed left-0 top-0 z-50 grid h-16 w-full grid-cols-2 items-center bg-surface-card/60 px-4 shadow-sm backdrop-blur-xl md:grid-cols-3 md:px-8 border-b border-border">
        <div className="flex items-center">
          <span className="h3 italic text-fg">
            VisionFiT
          </span>
        </div>

        <div className="hidden items-center justify-center gap-8 font-bold md:flex text-sm">
          <a className="text-flame border-b-2 border-flame pb-1" href="#">
            Practice
          </a>
          <a
            className="text-fg-mute transition-colors hover:text-fg"
            href="/history"
          >
            History
          </a>
        </div>

        <div className="flex items-center justify-end gap-4">
          <ThemeToggle />
          <div className="hidden flex-col items-end lg:flex">
            <span className="text-xs text-fg-mute">
              {displayEmail}
            </span>
          </div>
          <button
            className="flex items-center gap-2 rounded-full bg-surface-elev px-4 py-2 text-sm font-semibold text-fg transition-all hover:bg-surface-elev-hover active:scale-95 border border-border"
            onClick={onSignOut}
            type="button"
          >
            <span className="material-symbols-outlined text-sm">logout</span>
            Sign Out
          </button>
        </div>
      </nav>

      <section className="mx-auto max-w-7xl px-4 pb-16 pt-24 md:px-16">
        <header className="mb-12 flex flex-col gap-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <h1 className="font-display font-normal tracking-tight text-xl md:text-2xl text-fg">
              Refine Your Form.
            </h1>
            
            <div className="flex flex-col items-end gap-4">
              <div className="flex items-center gap-4">
                {athleteMode === 'trainer' && trainers.length > 0 && (
                  <select
                    value={selectedTrainerId}
                    onChange={(e) => {
                      setSelectedTrainerId(e.target.value);
                      window.localStorage.setItem('visionfit.athlete.trainer_id', e.target.value);
                    }}
                    className="bg-surface-elev border border-border rounded-full px-4 py-1.5 text-sm font-bold text-fg focus:outline-none focus:ring-1 focus:ring-flame"
                  >
                    {trainers.map(t => (
                      <option key={t.id} value={t.id}>{t.name || t.email}</option>
                    ))}
                  </select>
                )}

                {/* Mode Switcher */}
                <div className="flex items-center bg-surface-card rounded-full p-1 border border-border shadow-inner">
                  <button
                    onClick={() => {
                      setAthleteMode('trainer');
                      window.localStorage.setItem('visionfit.athlete.mode', 'trainer');
                    }}
                    className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all ${athleteMode === 'trainer' ? 'bg-flame text-white shadow-sm' : 'text-fg-mute hover:text-fg'}`}
                  >
                    Trainer
                  </button>
                  <button
                    onClick={() => {
                      setAthleteMode('self');
                      window.localStorage.setItem('visionfit.athlete.mode', 'self');
                    }}
                    className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all ${athleteMode === 'self' ? 'bg-flame text-white shadow-sm' : 'text-fg-mute hover:text-fg'}`}
                  >
                    Self
                  </button>
                </div>
              </div>
              
              {activeExercise && (
                <div className="rounded-[2rem] bg-surface-elev border border-border px-5 py-4 shadow-sm w-full max-w-[200px] text-right">
                  <p className="kicker uppercase">
                    Selected Movement
                  </p>
                  <p className="mt-1 h3 font-bold text-flame">
                    {activeExercise}
                  </p>
                </div>
              )}
            </div>
          </div>
          
          <div>
            <p className="text-base text-fg-mute">
              Select an exercise to begin AI-guided posture tracking. Improve control, reduce injury risk, and evaluate every rep.
            </p>
          </div>
        </header>

        {trainerError && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-[420px] rounded-[2rem] bg-surface-card border border-border p-8 shadow-2xl mx-4 transform transition-all">
              <h2 className="mb-3 h2">Trainer Access</h2>
              <p className="mb-8 text-base text-fg-mute leading-relaxed">
                {trainerError} Please contact your facility to get linked.
              </p>
              
              <button
                onClick={() => setTrainerError('')}
                className="w-full rounded-full bg-flame px-6 py-3.5 font-bold text-white transition-colors hover:bg-[#E56017]"
              >
                OK
              </button>
            </div>
          </div>
        )}

        {exercisesLoading && (
          <div className="rounded-2xl bg-surface-card p-8 text-fg-mute border border-border">
            Loading exercises...
          </div>
        )}

        {!exercisesLoading && exercisesError && (
          <div className="rounded-2xl bg-[#FFE4E4] p-8 text-[#D32F2F] border border-[#FFCDCD] dark:bg-[#4A1010] dark:text-[#FFB4B4] dark:border-[#5C1818]">
            <h2 className="h2 font-bold">
              Exercises unavailable
            </h2>
            <p className="mt-3 text-sm leading-6">
              {exercisesError}
            </p>
            <button
              className="mt-6 rounded-full bg-flame px-6 py-3 font-bold text-white transition-all hover:scale-[1.02] active:scale-95"
              onClick={() => void loadExercises()}
              type="button"
            >
              Retry
            </button>
          </div>
        )}

        {!exercisesLoading && !exercisesError && exercises.length === 0 && (
          <div className="rounded-2xl bg-surface-card border border-border p-8 text-fg-mute">
            No active exercises are available yet.
          </div>
        )}

        {!exercisesLoading && !exercisesError && exercises.length > 0 && (
          <section
            aria-label="Exercise list"
            className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4"
          >
            {exercises.map((exercise) => (
              <article
                className="group flex min-h-[520px] flex-col overflow-hidden rounded-3xl bg-surface-card border border-border transition-all hover:-translate-y-1 hover:shadow-lg"
                key={exercise.id}
              >
                <div className={`relative h-64 overflow-hidden bg-gradient-to-br ${getExerciseGradient(exercise.name)}`}>
                  {/* Decorative blobs */}
                  <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-white/20 blur-2xl transition-transform group-hover:scale-150" />
                  <div className="absolute -right-5 bottom-0 h-32 w-32 rounded-full bg-white/30 blur-3xl transition-transform group-hover:scale-125" />

                  <img
                    alt={`${exercise.name} posture`}
                    className="absolute inset-0 h-full w-full object-contain p-4 drop-shadow-2xl transition-transform duration-500 group-hover:scale-110"
                    src={getExerciseImage(exercise.name, exercise.image_path)}
                  />

                  <div className="absolute left-6 top-6 flex h-14 w-14 items-center justify-center rounded-full bg-white text-[#111827] shadow-lg">
                    <span className="material-symbols-outlined text-3xl">
                      {getExerciseIcon(exercise.name)}
                    </span>
                    {exercise.name.toLowerCase() === 'squats' && (
                      <div className="absolute -right-1 bottom-0 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] text-white">
                        <span className="material-symbols-outlined text-[12px]">check</span>
                      </div>
                    )}
                  </div>

                  <div className="absolute right-6 top-6 z-10">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/configure/${exercise.id}`);
                      }}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-white/70 backdrop-blur-md text-[#111827] shadow-lg hover:bg-white transition-colors"
                      title="Configure exercise"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[20px]">settings</span>
                    </button>
                  </div>

                  {exercise.camera_angle && (
                    <div className="absolute right-0 bottom-0 flex items-center gap-1.5 rounded-tl-2xl bg-black/70 backdrop-blur-md px-3 py-1 text-[9px] font-black uppercase tracking-widest text-white/90 shadow-md">
                      <span className="material-symbols-outlined text-[12px] font-bold">photo_camera</span>
                      <span>{exercise.camera_angle}</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-1 flex-col justify-between p-8">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="h3 font-bold text-fg">
                        {exercise.name}
                      </h2>
                    </div>
                    <p className="text-sm leading-relaxed text-fg-mute">
                      {exercise.description}
                    </p>
                  </div>

                  <button
                    className="mt-10 flex w-full items-center justify-between rounded-full bg-surface-elev border border-border px-8 py-4 font-bold text-fg transition-all group-hover:bg-flame group-hover:text-white active:scale-95 group-hover:border-flame"
                    onClick={() => {
                      setActiveExercise(exercise.name);
                      if (athleteMode === 'trainer' && selectedTrainerId) {
                        router.push(`/track/${exercise.id}?mode=trainer&trainer_id=${selectedTrainerId}`);
                      } else {
                        router.push(`/track/${exercise.id}?mode=self`);
                      }
                    }}
                    type="button"
                  >
                    <span>Start Tracking</span>
                    <span className="material-symbols-outlined">
                      arrow_forward
                    </span>
                  </button>
                </div>
              </article>
            ))}
          </section>
        )}
      </section>

      <nav className="fixed bottom-0 left-0 z-50 flex h-20 w-full items-center justify-around bg-surface-card border-t border-border px-4 text-fg shadow-2xl md:hidden">
        <a
          className="flex flex-col items-center justify-center rounded-xl bg-flame/10 px-3 py-1 text-flame"
          href="#"
        >
          <span className="material-symbols-outlined">grid_view</span>
          <span className="mt-1 text-[10px] font-semibold uppercase">
            Practice
          </span>
        </a>
        <a
          className="flex flex-col items-center justify-center px-3 py-1 text-fg-mute hover:text-fg transition-colors"
          href="/history"
        >
          <span className="material-symbols-outlined">insights</span>
          <span className="mt-1 text-[10px] font-semibold uppercase">
            History
          </span>
        </a>
      </nav>
    </main>
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    let isCurrent = true;

    async function loadStoredUser() {
      const storedUser = window.localStorage.getItem(AUTH_USER_STORAGE_KEY);
      await Promise.resolve();

      if (!isCurrent) {
        return;
      }

      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser) as User);
        } catch {
          window.localStorage.removeItem(AUTH_USER_STORAGE_KEY);
        }
      }

      setAuthLoaded(true);
    }

    void loadStoredUser();

    return () => {
      isCurrent = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (data.status === 'success') {
        const loggedInUser = {
          id: data.user?.id,
          name: data.user?.name,
          email: data.user?.email || email,
        };

        window.localStorage.setItem(
          AUTH_USER_STORAGE_KEY,
          JSON.stringify(loggedInUser),
        );
        setUser(loggedInUser);
        setPassword('');
      } else {
        setError(data.message || 'Login failed');
      }
    } catch {
      setError('Could not connect to the server');
    } finally {
      setLoading(false);
    }
  };

  if (!authLoaded) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg text-fg">
        <div className="rounded-2xl bg-surface-card border border-border p-8 text-fg-mute">
          Loading your practice dashboard...
        </div>
      </main>
    );
  }

  if (user) {
    return (
      <PracticeDashboard
        user={user}
        onSignOut={() => {
          window.localStorage.removeItem(AUTH_USER_STORAGE_KEY);
          setUser(null);
          setError('');
        }}
      />
    );
  }

  return (
    <main className="flex h-screen w-screen overflow-hidden flex-col md:flex-row">
      <section className="relative hidden items-center justify-center overflow-hidden bg-black p-16 md:flex md:w-[60%]">
        <img
          alt="athlete training under dramatic studio lighting"
          className="absolute inset-0 z-0 h-full w-full object-cover grayscale mix-blend-overlay opacity-30"
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuDnEJcwUJkb1T0QELGiKo4B-byOEgKr4qujuGomLe1QgncpnuqFJ7UZy3KxMO6IjOYaJNY5LNCBFio4nHVvfwf1mP5iT3UF1j8PxEvetwOmTfIKvDSKd79jic4V4gjVNWpAPi488-KsGubBBxbtky_PpxC_85ndoh88SCQii-gS9gCCIL7iZhFHZwHdCAjzlZ541vGlpHBVIcrr03K67Z8WQa8AFkRnbyY-snfG0C9tFauVSv5AW9ocznB_fKBgjEjg5BI2u3zG28o"
        />
        <div className="relative z-20 max-w-2xl">
          <div className="relative overflow-hidden rounded-3xl border border-flame/30 bg-[#0a0a0a]/80 p-12 backdrop-blur-2xl shadow-[0_8px_40px_-12px_rgba(255,107,26,0.2)]">
            <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-flame opacity-20 blur-[100px]" />
            <div className="relative z-10">
              <div className="eyebrow mb-6 !text-white/80">
                <span className="bar bg-flame"></span>
                <span>VISIONFIT · ATHLETE PORTAL</span>
              </div>
              <h1 className="h1 !text-white mb-8">
                Master your form.<br />
                <em className="h-serif-italic text-flame font-normal">Unlock</em> your peak.
              </h1>
              <h2 className="hidden">Workout Form AI Analyzer</h2>
              <p className="lede mb-12 max-w-lg !text-white/70">
                Refine your technique with real-time biomechanical analysis.
                Track every rep, detect every deviation, and unlock your peak
                physical performance.
              </p>
              <p className="kicker !text-white/50">
                Used by athletes and coaches for focused movement practice.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="relative flex flex-grow flex-col items-center justify-center overflow-y-auto bg-bg p-8 md:w-[40%] md:p-16 lg:p-24">
        <div className="mb-12 text-center md:hidden">
          <span className="h2 text-fg italic">
            VisionFiT
          </span>
        </div>
        <div className="w-full max-w-md">
          <div className="mb-12">
            <span className="kicker">— LOG IN TO TRAIN</span>
            <h2 className="mt-4 h2 text-fg">
              Welcome back.<br />
              <em className="h-serif-italic text-flame font-normal">Ready</em> to perform?
            </h2>
          </div>
          <form className="space-y-8" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded-xl bg-[#FFE4E4] p-4 text-sm text-[#D32F2F] border border-[#FFCDCD] dark:bg-[#4A1010] dark:text-[#FFB4B4] dark:border-[#5C1818]">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <label
                className="ml-1 kicker text-fg-mute"
                htmlFor="email"
              >
                Email Address
              </label>
              <div className="relative">
                <input
                  className="h-16 w-full rounded-2xl border border-border bg-surface-card px-6 text-fg outline-none transition-all duration-300 placeholder:text-fg-mute focus:bg-surface-elev focus:border-flame"
                  id="email"
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="athlete@performance.ai"
                  required
                  type="email"
                  value={email}
                />
                <span className="material-symbols-outlined absolute right-5 top-1/2 -translate-y-1/2 text-fg-mute">
                  mail
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <label
                className="ml-1 kicker text-fg-mute"
                htmlFor="password"
              >
                Password
              </label>
              <div className="relative">
                <input
                  className="h-16 w-full rounded-2xl border border-border bg-surface-card pl-6 pr-24 text-fg outline-none transition-all duration-300 placeholder:text-fg-mute focus:bg-surface-elev focus:border-flame"
                  id="password"
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  required
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                />
                <span className="material-symbols-outlined absolute right-14 top-1/2 -translate-y-1/2 text-fg-mute pointer-events-none">
                  lock
                </span>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="material-symbols-outlined absolute right-5 top-1/2 -translate-y-1/2 text-fg-mute hover:text-flame transition-colors focus:outline-none"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? 'visibility_off' : 'visibility'}
                </button>
              </div>
            </div>
            <div className="pt-4">
              <button
                className="group flex h-16 w-full items-center justify-center gap-2 rounded-full bg-flame text-lg font-bold text-white transition-all duration-300 hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={loading}
                type="submit"
              >
                {loading ? 'Signing In...' : 'Sign In'}
                {!loading && (
                  <span className="material-symbols-outlined transition-transform group-hover:translate-x-1">
                    arrow_forward
                  </span>
                )}
              </button>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
