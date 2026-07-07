"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Toaster } from "react-hot-toast";
import { useEffect, useState } from "react";

export default function TrainerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === "/trainer/login";

  const [trainer, setTrainer] = useState<any>(null);
  const [isClient, setIsClient] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [athleteName, setAthleteName] = useState<string | null>(null);
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    setIsClient(true);
    const trainerAuth = localStorage.getItem("visionfit.auth.trainer");
    if (trainerAuth) {
      setTrainer(JSON.parse(trainerAuth));
    }
  }, [pathname]);

  useEffect(() => {
    if (isLoginPage) {
      document.documentElement.removeAttribute("data-theme");
      return;
    }
    const savedTheme = localStorage.getItem("indianic-theme");
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute("data-theme", savedTheme);
    } else {
      document.documentElement.setAttribute("data-theme", "dark");
    }
  }, [isLoginPage]);

  useEffect(() => {
    if ((pathname?.startsWith("/trainer/athlete/") || pathname?.startsWith("/trainer/exercises/athlete/")) && trainer) {
      const isExercisesRoute = pathname.startsWith("/trainer/exercises/athlete/");
      const athleteId = pathname.split("/")[isExercisesRoute ? 4 : 3];
      fetch(`/api/trainer/${trainer.id}/athletes`)
        .then(res => res.json())
        .then(data => {
          const found = data.find((a: any) => a.id === athleteId);
          if (found) {
             setAthleteName(found.name || found.email.split('@')[0]);
          }
        })
        .catch(err => console.error(err));
    } else {
      setAthleteName(null);
    }
  }, [pathname, trainer]);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("indianic-theme", nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
  };

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (!isClient) return null;

  let pageTitle = "Athletes";
  let breadcrumbs: React.ReactNode[] = [];

  if (athleteName) {
    if (pathname?.startsWith('/trainer/exercises/athlete')) {
      pageTitle = "Session Detail";
      breadcrumbs = [
        <Link key="1" href="/trainer/exercises" className="text-flame hover:text-flame-2 transition-colors">Exercises</Link>,
        <span key="2" className="text-fg-mute">{athleteName}</span>,
        <span key="3" className="text-fg-mute">Session Detail</span>
      ];
    } else if (pathname?.includes('/exercises')) {
      pageTitle = "Exercise Configuration";
      breadcrumbs = [
        <Link key="1" href="/trainer" className="text-flame hover:text-flame-2 transition-colors">Athletes</Link>,
        <Link key="2" href={`/trainer/athlete/${pathname.split('/')[3]}/exercises`} className="text-flame hover:text-flame-2 transition-colors">{athleteName}</Link>,
        <span key="3" className="text-fg-mute">Exercise Configuration</span>
      ];
    } else if (pathname?.includes('/session/') && !pathname?.endsWith('/sessions')) {
      pageTitle = "Session Detail";
      breadcrumbs = [
        <Link key="1" href="/trainer" className="text-flame hover:text-flame-2 transition-colors">Athletes</Link>,
        <Link key="2" href={`/trainer/athlete/${pathname.split('/')[3]}/exercises`} className="text-flame hover:text-flame-2 transition-colors">{athleteName}</Link>,
        <Link key="3" href={`/trainer/athlete/${pathname.split('/')[3]}/sessions`} className="text-flame hover:text-flame-2 transition-colors">Session History</Link>,
        <span key="4" className="text-fg-mute">Session Detail</span>
      ];
    } else if (pathname?.includes('/sessions')) {
      pageTitle = "Session History";
      breadcrumbs = [
        <Link key="1" href="/trainer" className="text-flame hover:text-flame-2 transition-colors">Athletes</Link>,
        <Link key="2" href={`/trainer/athlete/${pathname.split('/')[3]}/exercises`} className="text-flame hover:text-flame-2 transition-colors">{athleteName}</Link>,
        <span key="3" className="text-fg-mute">Session History</span>
      ];
    } else {
      pageTitle = athleteName;
      breadcrumbs = [
        <Link key="1" href="/trainer" className="text-flame hover:text-flame-2 transition-colors">Athletes</Link>,
        <span key="2" className="text-fg-mute">{athleteName}</span>
      ];
    }
  } else {
    if (pathname === '/trainer/exercises') {
      pageTitle = "Exercises";
      breadcrumbs = [
        <span key="1" className="text-fg-mute">Exercises</span>
      ];
    } else {
      pageTitle = "Athletes";
      breadcrumbs = [
        <span key="1" className="text-fg-mute">Athletes</span>
      ];
    }
  }

  return (
    <div className="flex h-screen bg-bg font-body overflow-hidden">
      <Toaster position="top-right" />
      {/* Sidebar */}
      <aside className={`bg-surface flex flex-col justify-between pb-8 border-r border-border shrink-0 transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-20'}`}>
        <div>
          <div className={`h-16 flex items-center ${isSidebarOpen ? 'px-4 justify-between' : 'justify-center'} shrink-0 mb-8 border-b border-border`}>
            {isSidebarOpen && (
              <div className="pl-4 flex flex-col justify-center w-full">
                <h1 className="h3 text-fg truncate">VisionFit</h1>
              </div>
            )}
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="text-fg-mute hover:text-fg p-1 rounded-md transition-colors"
              title={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            >
              <span className="material-symbols-outlined text-[20px]">
                {isSidebarOpen ? 'menu_open' : 'menu'}
              </span>
            </button>
          </div>

          <nav className="space-y-1 mt-4 px-3">
            <Link 
              href="/trainer" 
              className={`flex items-center ${isSidebarOpen ? 'gap-4 px-6 py-4' : 'justify-center p-4'} text-sm font-bold transition-all border border-l-[3px] rounded-xl ${pathname === '/trainer' || pathname?.startsWith('/trainer/athlete') ? 'border-border border-l-flame bg-gradient-to-r from-flame/10 to-transparent text-flame shadow-sm' : 'border-transparent text-fg-mute hover:bg-surface-elev hover:text-fg'}`} 
              title="Athletes"
            >
              <span className="material-symbols-outlined text-[20px]">group</span>
              {isSidebarOpen && <span>Athletes</span>}
            </Link>
            <Link 
              href="/trainer/exercises" 
              className={`flex items-center ${isSidebarOpen ? 'gap-4 px-6 py-4' : 'justify-center p-4'} text-sm font-bold transition-all border border-l-[3px] rounded-xl ${pathname?.startsWith('/trainer/exercises') ? 'border-border border-l-flame bg-gradient-to-r from-flame/10 to-transparent text-flame shadow-sm' : 'border-transparent text-fg-mute hover:bg-surface-elev hover:text-fg'}`} 
              title="Exercises"
            >
              <span className="material-symbols-outlined text-[20px]">fitness_center</span>
              {isSidebarOpen && <span>Exercises</span>}
            </Link>
          </nav>
        </div>

        <div className={`px-4 space-y-4 ${!isSidebarOpen && 'flex flex-col items-center'}`}>
          <div className="space-y-1 w-full">
            <button 
              onClick={() => {
                localStorage.removeItem("visionfit.auth.trainer");
                router.push("/trainer/login");
              }}
              className={`flex items-center ${isSidebarOpen ? 'gap-4 px-4 py-3 text-left' : 'justify-center p-3'} text-sm font-medium text-fg-mute hover:text-err transition-colors w-full rounded-lg hover:bg-err/10`}
              title="Logout"
            >
              <span className="material-symbols-outlined text-[20px]">logout</span>
              {isSidebarOpen && <span>Logout</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-bg relative">
        {/* Header */}
        <header className="absolute top-0 left-0 w-full z-50 h-16 bg-surface-card/70 backdrop-blur-md border-b border-border flex items-center justify-between px-10 shrink-0">
          <div className="flex flex-col justify-center">
            <h2 className="h3 text-fg">{pageTitle}</h2>
            {breadcrumbs.length > 1 && (
              <div className="flex items-center kicker mt-[2px]">
                {breadcrumbs.map((crumb, idx) => (
                  <span key={idx} className="flex items-center">
                    {crumb}
                    {idx < breadcrumbs.length - 1 && <span className="text-fg-faint mx-[6px]">/</span>}
                  </span>
                ))}
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-6 ml-8">
            <button 
              onClick={toggleTheme}
              className="w-10 h-10 rounded-full flex items-center justify-center bg-surface border border-border text-fg-mute hover:text-flame hover:border-flame/50 transition-all shadow-sm"
              title="Toggle Theme"
            >
              <span className="material-symbols-outlined text-[20px]">
                {theme === 'dark' ? 'light_mode' : 'dark_mode'}
              </span>
            </button>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-bold text-fg">{trainer?.name || "Trainer"}</p>
                <p className="kicker text-fg-mute">{trainer?.email || "Loading..."}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-surface-elev text-fg flex items-center justify-center overflow-hidden border border-border">
                <img src={`https://ui-avatars.com/api/?name=${trainer?.name || trainer?.email || "Trainer"}&background=random`} alt="Profile" className="w-full h-full object-cover" />
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto pt-16">
          {children}
        </main>
      </div>
    </div>
  );
}
