'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

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
    <main className="min-h-screen bg-surface pb-28 text-on-surface">
      <nav className="fixed left-0 top-0 z-50 grid h-16 w-full grid-cols-2 items-center bg-surface-container-lowest/30 px-4 shadow-sm backdrop-blur-xl md:grid-cols-3 md:px-8 border-b border-outline-variant/5">
        <div className="flex items-center">
          <span className="font-headline text-xl font-black italic text-primary">
            VisionFiT
          </span>
        </div>

        <div className="hidden items-center justify-center gap-8 font-headline text-sm font-bold md:flex">
          <a className="text-primary" href="#">
            Practice
          </a>
          <a
            className="text-on-surface-variant transition-colors hover:text-secondary"
            href="/history"
          >
            History
          </a>
        </div>

        <div className="flex items-center justify-end gap-4">
          <div className="hidden flex-col items-end lg:flex">
            <span className="font-body text-xs text-on-surface-variant">
              {displayEmail}
            </span>
          </div>
          <button
            className="flex items-center gap-2 rounded-full bg-primary/5 px-4 py-2 text-sm font-semibold text-primary transition-all hover:bg-primary/10 active:scale-95"
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
            <h1 className="font-headline text-4xl font-extrabold leading-tight text-primary md:text-6xl">
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
                    className="bg-surface-container-low border border-outline/10 rounded-full px-4 py-1.5 text-sm font-bold text-on-surface-variant focus:outline-none focus:ring-1 focus:ring-primary shadow-inner"
                  >
                    {trainers.map(t => (
                      <option key={t.id} value={t.id}>{t.name || t.email}</option>
                    ))}
                  </select>
                )}

                {/* Mode Switcher */}
                <div className="flex items-center bg-surface-container-low rounded-full p-1 border border-outline/10 shadow-inner">
                  <button
                    onClick={() => {
                      setAthleteMode('trainer');
                      window.localStorage.setItem('visionfit.athlete.mode', 'trainer');
                    }}
                    className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all ${athleteMode === 'trainer' ? 'bg-secondary text-on-secondary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
                  >
                    Trainer
                  </button>
                  <button
                    onClick={() => {
                      setAthleteMode('self');
                      window.localStorage.setItem('visionfit.athlete.mode', 'self');
                    }}
                    className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all ${athleteMode === 'self' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
                  >
                    Self
                  </button>
                </div>
              </div>
              
              {activeExercise && (
                <div className="rounded-[2rem] bg-secondary-container px-5 py-4 text-on-secondary-container shadow-sm w-full max-w-[200px] text-right">
                  <p className="font-body text-xs font-bold uppercase">
                    Selected Movement
                  </p>
                  <p className="mt-1 font-headline text-xl font-bold">
                    {activeExercise}
                  </p>
                </div>
              )}
            </div>
          </div>
          
          <div>
            <p className="font-body text-base text-on-surface-variant">
              Select an exercise to begin AI-guided posture tracking. Improve control, reduce injury risk, and evaluate every rep.
            </p>
          </div>
        </header>

        {trainerError && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-[420px] rounded-[2rem] bg-surface p-8 shadow-2xl mx-4 transform transition-all">
              <h2 className="mb-3 font-headline text-2xl font-bold text-on-surface">Trainer Access</h2>
              <p className="mb-8 font-body text-base text-on-surface-variant leading-relaxed">
                {trainerError} Please contact your facility to get linked.
              </p>
              
              <button
                onClick={() => setTrainerError('')}
                className="w-full rounded-full bg-primary px-6 py-3.5 font-headline text-sm font-bold text-on-primary transition-colors hover:bg-primary/90"
              >
                OK
              </button>
            </div>
          </div>
        )}

        {exercisesLoading && (
          <div className="rounded-[2rem] bg-surface-container-low p-8 font-body text-on-surface-variant">
            Loading exercises...
          </div>
        )}

        {!exercisesLoading && exercisesError && (
          <div className="rounded-[2rem] bg-error-container p-8 text-on-error-container">
            <h2 className="font-headline text-2xl font-bold">
              Exercises unavailable
            </h2>
            <p className="mt-3 font-body text-sm leading-6">
              {exercisesError}
            </p>
            <button
              className="mt-6 rounded-full bg-primary px-6 py-3 font-headline font-bold text-on-primary transition-all hover:scale-[1.02] active:scale-95"
              onClick={() => void loadExercises()}
              type="button"
            >
              Retry
            </button>
          </div>
        )}

        {!exercisesLoading && !exercisesError && exercises.length === 0 && (
          <div className="rounded-[2rem] bg-surface-container-low p-8 font-body text-on-surface-variant">
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
                className="group flex min-h-[520px] flex-col overflow-hidden rounded-[2.5rem] bg-surface-container-low transition-all hover:-translate-y-1 hover:shadow-2xl"
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

                  <div className="absolute left-6 top-6 flex h-14 w-14 items-center justify-center rounded-full bg-white text-primary shadow-lg">
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
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-white/70 backdrop-blur-md text-primary shadow-lg hover:bg-white transition-colors"
                      title="Configure exercise"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[20px]">settings</span>
                    </button>
                  </div>

                  {exercise.camera_angle && (
                    <div className="absolute right-0 bottom-0 flex items-center gap-1.5 rounded-tl-2xl bg-black/70 backdrop-blur-md px-3 py-1 font-label text-[9px] font-black uppercase tracking-widest text-white/90 shadow-md">
                      <span className="material-symbols-outlined text-[12px] font-bold">photo_camera</span>
                      <span>{exercise.camera_angle}</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-1 flex-col justify-between p-8">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="font-headline text-3xl font-bold text-on-surface">
                        {exercise.name}
                      </h2>
                    </div>
                    <p className="font-body text-sm leading-relaxed text-on-surface-variant">
                      {exercise.description}
                    </p>
                  </div>

                  <button
                    className="mt-10 flex w-full items-center justify-between rounded-full bg-surface-container-highest px-8 py-5 font-headline font-bold text-on-surface transition-all group-hover:bg-primary group-hover:text-on-primary active:scale-95"
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

      <nav className="fixed bottom-0 left-0 z-50 flex h-20 w-full items-center justify-around bg-inverse-surface/95 px-4 text-inverse-on-surface shadow-2xl backdrop-blur-2xl md:hidden">
        <a
          className="flex flex-col items-center justify-center rounded-[1rem] bg-primary-fixed px-3 py-1 text-primary"
          href="#"
        >
          <span className="material-symbols-outlined">grid_view</span>
          <span className="mt-1 font-body text-[10px] font-semibold uppercase">
            Practice
          </span>
        </a>
        <a
          className="flex flex-col items-center justify-center px-3 py-1 text-inverse-on-surface/60 hover:text-inverse-on-surface transition-colors"
          href="/history"
        >
          <span className="material-symbols-outlined">insights</span>
          <span className="mt-1 font-body text-[10px] font-semibold uppercase">
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
      <main className="flex min-h-screen items-center justify-center bg-surface text-on-surface">
        <div className="rounded-[2rem] bg-surface-container-low p-8 font-body text-on-surface-variant">
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
    <main className="flex min-h-screen flex-grow flex-col md:flex-row">
      <section className="relative hidden items-center justify-center overflow-hidden bg-primary p-16 md:flex md:w-[60%]">
        <div className="absolute inset-0 z-10 bg-gradient-to-br from-primary via-primary-container to-primary opacity-90" />
        <img
          alt="athlete training under dramatic studio lighting"
          className="absolute inset-0 z-0 h-full w-full object-cover grayscale mix-blend-overlay"
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuDnEJcwUJkb1T0QELGiKo4B-byOEgKr4qujuGomLe1QgncpnuqFJ7UZy3KxMO6IjOYaJNY5LNCBFio4nHVvfwf1mP5iT3UF1j8PxEvetwOmTfIKvDSKd79jic4V4gjVNWpAPi488-KsGubBBxbtky_PpxC_85ndoh88SCQii-gS9gCCIL7iZhFHZwHdCAjzlZ541vGlpHBVIcrr03K67Z8WQa8AFkRnbyY-snfG0C9tFauVSv5AW9ocznB_fKBgjEjg5BI2u3zG28o"
        />
        <div className="relative z-20 max-w-2xl">
          <div className="rounded-xl bg-surface-container-lowest/10 p-12 backdrop-blur-xl">
            <div className="mb-6 inline-flex items-center gap-3 rounded-full bg-secondary-container/20 px-4 py-2">
              <span className="material-symbols-outlined text-sm text-secondary-fixed">
                auto_awesome
              </span>
              <span className="font-label text-xs uppercase text-secondary-fixed">
                VisionFit
              </span>
            </div>
            <h1 className="mb-8 font-headline text-5xl font-extrabold leading-tight text-on-primary lg:text-7xl">
              Master your <br />
              form.
            </h1>
            <h2 className="hidden">Workout Form AI Analyzer</h2>
            <p className="mb-12 max-w-lg font-body text-xl leading-relaxed text-primary-fixed-dim opacity-90">
              Refine your technique with real-time biomechanical analysis.
              Track every rep, detect every deviation, and unlock your peak
              physical performance.
            </p>
            <p className="font-label text-sm text-primary-fixed-dim">
              Used by athletes and coaches for focused movement practice.
            </p>
          </div>
        </div>
      </section>

      <section className="relative flex flex-grow flex-col items-center justify-center overflow-y-auto bg-surface p-8 md:w-[40%] md:p-16 lg:p-24">
        <div className="mb-12 text-center md:hidden">
          <span className="font-headline text-2xl font-black text-primary">
            VisionFiT
          </span>
        </div>
        <div className="w-full max-w-md">
          <div className="mb-12">
            <h2 className="mb-2 font-headline text-3xl font-bold text-on-surface">
              Welcome Back, Athlete.
            </h2>
            <p className="font-body text-on-surface-variant">
              Your performance data is ready for analysis.
            </p>
          </div>
          <form className="space-y-8" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded-xl bg-error-container p-4 font-body text-sm text-on-error-container">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <label
                className="ml-1 font-label text-xs font-bold uppercase text-on-surface-variant"
                htmlFor="email"
              >
                Email Address
              </label>
              <div className="relative">
                <input
                  className="h-16 w-full rounded-xl border-none bg-surface-container-highest px-6 font-body text-on-surface outline-none transition-all duration-300 placeholder:text-outline-variant focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary"
                  id="email"
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="athlete@performance.ai"
                  required
                  type="email"
                  value={email}
                />
                <span className="material-symbols-outlined absolute right-5 top-1/2 -translate-y-1/2 text-outline-variant">
                  mail
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <label
                className="ml-1 font-label text-xs font-bold uppercase text-on-surface-variant"
                htmlFor="password"
              >
                Password
              </label>
              <div className="relative">
                <input
                  className="h-16 w-full rounded-xl border-none bg-surface-container-highest pl-6 pr-24 font-body text-on-surface outline-none transition-all duration-300 placeholder:text-outline-variant focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary"
                  id="password"
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  required
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                />
                <span className="material-symbols-outlined absolute right-14 top-1/2 -translate-y-1/2 text-outline-variant pointer-events-none">
                  lock
                </span>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="material-symbols-outlined absolute right-5 top-1/2 -translate-y-1/2 text-outline-variant hover:text-primary transition-colors focus:outline-none"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? 'visibility_off' : 'visibility'}
                </button>
              </div>
            </div>
            <div className="pt-4">
              <button
                className="ambient-shadow group flex h-16 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary to-primary-container font-headline text-lg font-bold text-on-primary transition-all duration-300 hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
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
