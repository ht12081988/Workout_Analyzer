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

  useEffect(() => {
    setIsClient(true);
    const trainerAuth = localStorage.getItem("visionfit.auth.trainer");
    if (trainerAuth) {
      setTrainer(JSON.parse(trainerAuth));
    }
  }, [pathname]);

  useEffect(() => {
    if (pathname.startsWith("/trainer/athlete/") && trainer) {
      const athleteId = pathname.split("/")[3];
      fetch(`http://localhost:5002/trainer/${trainer.id}/athletes`)
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

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (!isClient) return null;

  let pageTitle = "Athletes";
  let breadcrumbs: React.ReactNode[] = [];

  if (athleteName) {
    if (pathname.includes('/exercises')) {
      pageTitle = "Exercise Configuration";
      breadcrumbs = [
        <Link key="1" href="/trainer" className="text-primary hover:text-primary/80 transition-colors">Athletes</Link>,
        <Link key="2" href={`/trainer/athlete/${pathname.split('/')[3]}/exercises`} className="text-primary hover:text-primary/80 transition-colors">{athleteName}</Link>,
        <span key="3" className="text-on-surface-variant">Exercise Configuration</span>
      ];
    } else if (pathname.includes('/session/') && !pathname.endsWith('/sessions')) {
      pageTitle = "Session Detail";
      breadcrumbs = [
        <Link key="1" href="/trainer" className="text-primary hover:text-primary/80 transition-colors">Athletes</Link>,
        <Link key="2" href={`/trainer/athlete/${pathname.split('/')[3]}/exercises`} className="text-primary hover:text-primary/80 transition-colors">{athleteName}</Link>,
        <Link key="3" href={`/trainer/athlete/${pathname.split('/')[3]}/sessions`} className="text-primary hover:text-primary/80 transition-colors">Session History</Link>,
        <span key="4" className="text-on-surface-variant">Session Detail</span>
      ];
    } else if (pathname.includes('/sessions')) {
      pageTitle = "Session History";
      breadcrumbs = [
        <Link key="1" href="/trainer" className="text-primary hover:text-primary/80 transition-colors">Athletes</Link>,
        <Link key="2" href={`/trainer/athlete/${pathname.split('/')[3]}/exercises`} className="text-primary hover:text-primary/80 transition-colors">{athleteName}</Link>,
        <span key="3" className="text-on-surface-variant">Session History</span>
      ];
    } else {
      pageTitle = athleteName;
      breadcrumbs = [
        <Link key="1" href="/trainer" className="text-primary hover:text-primary/80 transition-colors">Athletes</Link>,
        <span key="2" className="text-on-surface-variant">{athleteName}</span>
      ];
    }
  } else {
    pageTitle = "Athletes";
    breadcrumbs = [
      <span key="1" className="text-on-surface-variant">Athletes</span>
    ];
  }

  return (
    <div className="flex h-screen bg-[#fcfdff] font-body overflow-hidden">
      <Toaster position="top-right" />
      {/* Sidebar */}
      <aside className={`bg-surface-container-lowest flex flex-col justify-between pb-8 border-r border-outline/10 shrink-0 transition-all duration-300 ${isSidebarOpen ? 'w-52' : 'w-20'}`}>
        <div>
          <div className={`h-16 flex items-center ${isSidebarOpen ? 'px-4 justify-between' : 'justify-center'} shrink-0 mb-8 border-b border-outline/10`}>
            {isSidebarOpen && (
              <div className="pl-4 flex flex-col justify-center">
                <h1 className="font-headline text-xl font-black text-on-surface overflow-hidden leading-none">VisionFit</h1>
              </div>
            )}
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="text-on-surface-variant hover:text-on-surface p-1 rounded-md transition-colors"
              title={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            >
              <span className="material-symbols-outlined text-[20px]">
                {isSidebarOpen ? 'menu_open' : 'menu'}
              </span>
            </button>
          </div>

          <nav className="space-y-2 px-4">
            <Link 
              href="/trainer" 
              className={`flex items-center ${isSidebarOpen ? 'gap-4 px-6 py-3' : 'justify-center p-3'} rounded-full text-sm font-bold transition-all ${pathname === '/trainer' || pathname.startsWith('/trainer/athlete') ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'}`} 
              title="Athletes"
            >
              <span className="material-symbols-outlined text-[20px]">group</span>
              {isSidebarOpen && <span>Athletes</span>}
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
              className={`flex items-center ${isSidebarOpen ? 'gap-4 px-4 py-3 text-left' : 'justify-center p-3'} text-sm font-medium text-on-surface-variant hover:text-error transition-colors w-full rounded-xl hover:bg-error-container/20`}
              title="Logout"
            >
              <span className="material-symbols-outlined text-[20px]">logout</span>
              {isSidebarOpen && <span>Logout</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-surface-container-low relative">
        {/* Header */}
        <header className="absolute top-0 left-0 w-full z-50 h-16 bg-surface-container-lowest/70 backdrop-blur-md border-b border-outline/10 flex items-center justify-between px-10 shrink-0">
          <div className="flex flex-col justify-center">
            <h2 className="text-[22px] font-headline font-bold text-on-surface leading-tight capitalize tracking-tight">{pageTitle}</h2>
            {breadcrumbs.length > 1 && (
              <div className="flex items-center text-xs font-medium mt-[2px]">
                {breadcrumbs.map((crumb, idx) => (
                  <span key={idx} className="flex items-center">
                    {crumb}
                    {idx < breadcrumbs.length - 1 && <span className="text-outline/40 mx-[6px]">/</span>}
                  </span>
                ))}
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-6 ml-8">
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-bold text-on-surface">{trainer?.name || "Trainer"}</p>
                <p className="text-[10px] font-label uppercase text-outline font-bold tracking-wider">{trainer?.email || "Loading..."}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center overflow-hidden border border-outline/10">
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
