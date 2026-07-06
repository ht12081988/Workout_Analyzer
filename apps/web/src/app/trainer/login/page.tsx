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
    <main className="flex h-screen w-screen overflow-hidden flex-col md:flex-row">
      <section className="relative hidden items-center justify-center overflow-hidden bg-black p-16 md:flex md:w-[60%]">
        <img
          alt="trainer coaching an athlete in a studio"
          className="absolute inset-0 z-0 h-full w-full object-cover grayscale mix-blend-overlay opacity-30"
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuDnEJcwUJkb1T0QELGiKo4B-byOEgKr4qujuGomLe1QgncpnuqFJ7UZy3KxMO6IjOYaJNY5LNCBFio4nHVvfwf1mP5iT3UF1j8PxEvetwOmTfIKvDSKd79jic4V4gjVNWpAPi488-KsGubBBxbtky_PpxC_85ndoh88SCQii-gS9gCCIL7iZhFHZwHdCAjzlZ541vGlpHBVIcrr03K67Z8WQa8AFkRnbyY-snfG0C9tFauVSv5AW9ocznB_fKBgjEjg5BI2u3zG28o"
        />
        <div className="relative z-20 max-w-2xl">
          <div className="relative overflow-hidden rounded-3xl border border-flame/30 bg-[#0a0a0a]/80 p-12 backdrop-blur-2xl shadow-[0_8px_40px_-12px_rgba(255,107,26,0.2)]">
            <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-flame opacity-20 blur-[100px]" />
            <div className="relative z-10">
              <div className="eyebrow mb-6 !text-white/80">
                <span className="bar bg-flame"></span>
                <span>VISIONFIT · TRAINER PORTAL</span>
              </div>
              <h1 className="h1 !text-white mb-8">
                Elevate your<br />
                <em className="h-serif-italic text-flame font-normal">coaching.</em>
              </h1>
              <p className="lede mb-12 max-w-lg !text-white/70">
                Manage your athletes, set custom pose rules, and review biomechanical session data to guide your clients to perfection.
              </p>
              <p className="kicker !text-white/50">
                The ultimate tool for data-driven personal trainers.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="relative flex flex-grow flex-col items-center justify-center overflow-y-auto bg-bg p-8 md:w-[40%] md:p-16 lg:p-24">
        <div className="mb-12 text-center md:hidden">
          <span className="h2 text-fg italic">
            VisionFiT Trainer
          </span>
        </div>
        <div className="w-full max-w-md">
          <div className="mb-12">
            <span className="kicker">— LOG IN TO DASHBOARD</span>
            <h2 className="mt-4 h2 text-fg">
              Welcome back.<br />
              <em className="h-serif-italic text-flame font-normal">Coach.</em>
            </h2>
          </div>
          <form className="space-y-8" onSubmit={handleLogin}>
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
                  placeholder="coach@performance.ai"
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
