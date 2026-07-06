"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [theme, setTheme] = useState("dark");
  const [isClient, setIsClient] = useState(false);
  const [admin, setAdmin] = useState<any>(null);
  const [athleteName, setAthleteName] = useState("");

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      setAthleteName(params.get('name') || "");
    }
  }, [pathname]);

  useEffect(() => {
    setIsClient(true);
    const adminAuth = localStorage.getItem("visionfit.auth.admin");
    if (!adminAuth) {
      router.push("/admin/login");
    } else {
      setAdmin(JSON.parse(adminAuth));
    }
  }, [router]);

  useEffect(() => {
    const saved = localStorage.getItem("indianic-theme");
    if (saved) {
      setTheme(saved);
      document.documentElement.setAttribute("data-theme", saved);
    } else {
      document.documentElement.setAttribute("data-theme", "dark");
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("indianic-theme", nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
  };

  if (!isClient || !admin) return null;

  let pageTitle = "Dashboard";
  let breadcrumbs: React.ReactNode[] = [];

  if (pathname?.includes('/exercises/builder')) {
    pageTitle = "Create Exercise";
    breadcrumbs = [
      <Link key="1" href="/admin/exercises" className="text-flame hover:text-flame-2 transition-colors">Exercises</Link>,
      <span key="2" className="text-fg-mute">Create Exercise</span>
    ];
  } else if (pathname?.includes('/exercises/') && pathname !== '/admin/exercises') {
    pageTitle = "Edit Exercise";
    breadcrumbs = [
      <Link key="1" href="/admin/exercises" className="text-flame hover:text-flame-2 transition-colors">Exercises</Link>,
      <span key="2" className="text-fg-mute">Edit Exercise</span>
    ];
  } else if (pathname?.includes('/exercises')) {
    pageTitle = "Exercise Library";
    breadcrumbs = [
      <span key="1" className="text-fg-mute">Exercises</span>
    ];
  } else if (pathname?.includes('/configurations')) {
    pageTitle = "Configurations";
    breadcrumbs = [
      <span key="1" className="text-fg-mute">Configurations</span>
    ];
  } else if (pathname?.includes('/metrics')) {
    pageTitle = "Master Metrics";
    breadcrumbs = [
      <span key="1" className="text-fg-mute">Metrics</span>
    ];
  } else if (pathname?.includes('/trainers')) {
    pageTitle = "Trainers";
    breadcrumbs = [
      <span key="1" className="text-fg-mute">Trainers</span>
    ];
  } else if (pathname?.includes('/athletes/') && pathname !== '/admin/athletes') {
    pageTitle = "Athletes";
    breadcrumbs = [
      <Link key="1" href="/admin/athletes" className="text-flame hover:text-flame-2 transition-colors">Athletes</Link>,
      <span key="2" className="text-fg-mute">{athleteName || "Sessions"}</span>
    ];
  } else if (pathname?.includes('/athletes')) {
    pageTitle = "Athletes";
    breadcrumbs = [
      <span key="1" className="text-fg-mute">Athletes</span>
    ];
  } else {
    pageTitle = "Super Admin Dashboard";
    breadcrumbs = [
      <span key="1" className="text-fg-mute">Dashboard</span>
    ];
  }

  return (
    <div className="flex h-screen bg-bg font-body overflow-hidden transition-colors duration-300">
      {/* Sidebar */}
      <aside className={`bg-surface flex flex-col justify-between pb-8 border-r border-border shrink-0 transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-20'}`}>
        <div>
          <div className={`h-16 flex items-center ${isSidebarOpen ? 'px-6 justify-between' : 'justify-center'} shrink-0 mb-8 border-b border-border`}>
            {isSidebarOpen && (
              <div className="flex flex-col justify-center">
                <h1 className="h3 text-fg leading-none tracking-tight">VisionFit</h1>
                <span className="kicker-flame mt-1">Admin Panel</span>
              </div>
            )}
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="text-fg-mute hover:text-flame p-1 rounded-md transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">
                {isSidebarOpen ? 'menu_open' : 'menu'}
              </span>
            </button>
          </div>

          <nav className="space-y-1 mt-4 px-3">
            
            <Link 
              href="/admin/exercises" 
              className={`flex items-center ${isSidebarOpen ? 'gap-4 px-6 py-4' : 'justify-center p-4'} text-sm font-bold transition-all border border-l-[3px] rounded-xl ${pathname?.includes('/exercises') ? 'border-border border-l-flame bg-gradient-to-r from-flame/10 to-transparent text-flame shadow-sm' : 'border-transparent text-fg-mute hover:bg-surface-elev hover:text-fg'}`} 
            >
              <span className="material-symbols-outlined text-[20px]">fitness_center</span>
              {isSidebarOpen && <span>Exercises</span>}
            </Link>

            <Link 
              href="/admin/metrics" 
              className={`flex items-center ${isSidebarOpen ? 'gap-4 px-6 py-4' : 'justify-center p-4'} text-sm font-bold transition-all border border-l-[3px] rounded-xl ${pathname === '/admin/metrics' ? 'border-border border-l-flame bg-gradient-to-r from-flame/10 to-transparent text-flame shadow-sm' : 'border-transparent text-fg-mute hover:bg-surface-elev hover:text-fg'}`} 
            >
              <span className="material-symbols-outlined text-[20px]">analytics</span>
              {isSidebarOpen && <span>Metrics</span>}
            </Link>
            <Link 
              href="/admin/trainers" 
              className={`flex items-center ${isSidebarOpen ? 'gap-4 px-6 py-4' : 'justify-center p-4'} text-sm font-bold transition-all border border-l-[3px] rounded-xl ${pathname === '/admin/trainers' ? 'border-border border-l-flame bg-gradient-to-r from-flame/10 to-transparent text-flame shadow-sm' : 'border-transparent text-fg-mute hover:bg-surface-elev hover:text-fg'}`} 
            >
              <span className="material-symbols-outlined text-[20px]">sports</span>
              {isSidebarOpen && <span>Trainers</span>}
            </Link>

            <Link 
              href="/admin/athletes" 
              className={`flex items-center ${isSidebarOpen ? 'gap-4 px-6 py-4' : 'justify-center p-4'} text-sm font-bold transition-all border border-l-[3px] rounded-xl ${pathname === '/admin/athletes' ? 'border-border border-l-flame bg-gradient-to-r from-flame/10 to-transparent text-flame shadow-sm' : 'border-transparent text-fg-mute hover:bg-surface-elev hover:text-fg'}`} 
            >
              <span className="material-symbols-outlined text-[20px]">groups</span>
              {isSidebarOpen && <span>Athletes</span>}
            </Link>

            <Link 
              href="/admin/configurations" 
              className={`flex items-center ${isSidebarOpen ? 'gap-4 px-6 py-4' : 'justify-center p-4'} text-sm font-bold transition-all border border-l-[3px] rounded-xl ${pathname?.includes('/configurations') ? 'border-border border-l-flame bg-gradient-to-r from-flame/10 to-transparent text-flame shadow-sm' : 'border-transparent text-fg-mute hover:bg-surface-elev hover:text-fg'}`} 
            >
              <span className="material-symbols-outlined text-[20px]">settings</span>
              {isSidebarOpen && <span>Configurations</span>}
            </Link>
          </nav>
        </div>

        {/* Theme Toggle in Sidebar */}
        <div className="px-3">
          <button 
            onClick={toggleTheme}
            className={`w-full flex items-center ${isSidebarOpen ? 'gap-4 px-6 py-4' : 'justify-center p-4'} text-sm font-bold transition-all border border-transparent rounded-xl text-fg-mute hover:bg-surface-elev hover:text-fg`}
            title="Toggle Theme"
          >
            <span className="material-symbols-outlined text-[20px]">
              {theme === 'dark' ? 'light_mode' : 'dark_mode'}
            </span>
            {isSidebarOpen && <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-bg relative">
        <div className="noise pointer-events-none absolute inset-0 z-0 opacity-10 mix-blend-overlay"></div>
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
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-bold text-fg">Admin</p>
                <p className="kicker">SUPER USER</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-surface-elev text-fg flex items-center justify-center overflow-hidden border border-border">
                <img src={`https://ui-avatars.com/api/?name=Admin&background=random`} alt="Profile" className="w-full h-full object-cover" />
              </div>
            </div>
            <button 
              onClick={() => {
                localStorage.removeItem("visionfit.auth.admin");
                router.push("/admin/login");
              }}
              className="w-10 h-10 rounded-full flex items-center justify-center bg-surface border border-border text-fg-mute hover:text-err hover:border-err/50 hover:bg-err/10 transition-all shadow-sm"
              title="Logout"
            >
              <span className="material-symbols-outlined text-[20px]">logout</span>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto pt-16 relative z-10">
          {children}
        </main>
      </div>
    </div>
  );
}
