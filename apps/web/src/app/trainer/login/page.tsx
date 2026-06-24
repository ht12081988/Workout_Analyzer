"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TrainerLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/trainer/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (data.status === "success") {
        localStorage.setItem("visionfit.auth.trainer", JSON.stringify(data.trainer));
        router.push("/trainer");
      } else {
        setError(data.message || "Login failed");
      }
    } catch (err) {
      setError("Server error. Ensure API is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-grow flex-col md:flex-row">
      <section className="relative hidden items-center justify-center overflow-hidden bg-primary p-16 md:flex md:w-[60%]">
        <div className="absolute inset-0 z-10 bg-gradient-to-br from-primary via-primary-container to-primary opacity-90" />
        <img
          alt="trainer coaching an athlete in a studio"
          className="absolute inset-0 z-0 h-full w-full object-cover grayscale mix-blend-overlay"
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuDnEJcwUJkb1T0QELGiKo4B-byOEgKr4qujuGomLe1QgncpnuqFJ7UZy3KxMO6IjOYaJNY5LNCBFio4nHVvfwf1mP5iT3UF1j8PxEvetwOmTfIKvDSKd79jic4V4gjVNWpAPi488-KsGubBBxbtky_PpxC_85ndoh88SCQii-gS9gCCIL7iZhFHZwHdCAjzlZ541vGlpHBVIcrr03K67Z8WQa8AFkRnbyY-snfG0C9tFauVSv5AW9ocznB_fKBgjEjg5BI2u3zG28o"
        />
        <div className="relative z-20 max-w-2xl">
          <div className="rounded-xl bg-surface-container-lowest/10 p-12 backdrop-blur-xl">
            <div className="mb-6 inline-flex items-center gap-3 rounded-full bg-secondary-container/20 px-4 py-2">
              <span className="material-symbols-outlined text-sm text-secondary-fixed">
                insights
              </span>
              <span className="font-label text-xs uppercase text-secondary-fixed">
                VisionFit Trainer Portal
              </span>
            </div>
            <h1 className="mb-8 font-headline text-5xl font-extrabold leading-tight text-on-primary lg:text-7xl">
              Elevate your <br />
              coaching.
            </h1>
            <p className="mb-12 max-w-lg font-body text-xl leading-relaxed text-primary-fixed-dim opacity-90">
              Manage your athletes, set custom pose rules, and review biomechanical session data to guide your clients to perfection.
            </p>
            <p className="font-label text-sm text-primary-fixed-dim">
              The ultimate tool for data-driven personal trainers.
            </p>
          </div>
        </div>
      </section>

      <section className="relative flex flex-grow flex-col items-center justify-center overflow-y-auto bg-surface p-8 md:w-[40%] md:p-16 lg:p-24">
        <div className="mb-12 text-center md:hidden">
          <span className="font-headline text-2xl font-black text-primary">
            VisionFiT Trainer
          </span>
        </div>
        <div className="w-full max-w-md">
          <div className="mb-12">
            <h2 className="mb-2 font-headline text-3xl font-bold text-on-surface">
              Welcome Back, Coach.
            </h2>
            <p className="font-body text-on-surface-variant">
              Access your dashboard to review athlete progress.
            </p>
          </div>
          <form className="space-y-8" onSubmit={handleLogin}>
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
                  placeholder="coach@performance.ai"
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
