"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";

export default function TrainerExercisesPage() {
  const router = useRouter();
  const [trainerId, setTrainerId] = useState<string | null>(null);

  useEffect(() => {
    const trainerAuth = localStorage.getItem("visionfit.auth.trainer");
    if (!trainerAuth) {
      router.push("/trainer/login");
      return;
    }
    const trainer = JSON.parse(trainerAuth);
    setTrainerId(trainer.id);
  }, [router]);

  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState("All Types");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [search, category, startDate, endDate, typeFilter]);
  useEffect(() => {
    if (!trainerId) return;
    fetch(`/api/trainer/${trainerId}/sessions`)
      .then(res => res.json())
      .then(data => {
        setSessions(Array.isArray(data) ? data : (data?.data || []));
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch sessions", err);
        setLoading(false);
      });
  }, [trainerId]);

  const uniqueCategories = useMemo(() => {
    const cats = new Set<string>();
    sessions.forEach(s => {
      if (s.category) cats.add(s.category);
    });
    return ["All", ...Array.from(cats)].sort();
  }, [sessions]);

  const filteredSessions = sessions.filter(session => {
    // 1. Search Filter (Athlete Name/Email or Exercise Name)
    if (search) {
      const s = search.toLowerCase();
      const exerciseName = (session.exercise_name || session.exercise_id || "").toLowerCase();
      const athleteName = (session.athlete_name || "").toLowerCase();
      const athleteEmail = (session.athlete_email || "").toLowerCase();
      
      if (!exerciseName.includes(s) && !athleteName.includes(s) && !athleteEmail.includes(s)) {
        return false;
      }
    }

    // 2. Category Filter
    if (category !== "All" && session.category !== category) {
      return false;
    }

    // 3. Date Range Filter
    if (startDate || endDate) {
      const sessionDate = new Date(session.start_time).setHours(0, 0, 0, 0);
      
      if (startDate) {
        const start = new Date(startDate).setHours(0, 0, 0, 0);
        if (sessionDate < start) return false;
      }
      
      if (endDate) {
        const end = new Date(endDate).setHours(23, 59, 59, 999);
        if (sessionDate > end) return false;
      }
    }

    // 4. Type Filter
    if (typeFilter !== "All Types") {
      // If backend ever adds a session.type ('System' vs 'Custom'), filter it here.
      // For now, if the field exists, we filter by it.
      if (session.type && session.type !== typeFilter) {
        return false;
      }
    }

    return true;
  });

  const totalPages = Math.ceil(filteredSessions.length / itemsPerPage);
  const paginatedSessions = filteredSessions.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (loading) return <div className="p-8 text-fg-mute font-body animate-pulse">Loading sessions...</div>;

  return (
    <div className="w-full h-full flex flex-col p-10 bg-bg">
      <div className="space-y-6">
        


        {/* Search & Filter Bar */}
        <div className="flex items-center gap-3">
          <div className="relative w-80">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline-variant text-[20px]">
              search
            </span>
            <input 
              type="text" 
              placeholder="Search exercises..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-surface text-fg text-sm rounded-lg py-2.5 pl-11 pr-4 border border-border focus:outline-none focus:ring-2 focus:ring-flame/20 transition-shadow shadow-sm"
            />
          </div>
          
          <button 
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={`w-[42px] h-[42px] flex items-center justify-center rounded-lg border transition-all ${isFilterOpen ? 'bg-surface-elev border-border text-fg shadow-sm' : 'bg-[#e9e3d9] border-[#e0d9cc] text-bg-inv hover:bg-[#e0d9cc]'} dark:${isFilterOpen ? 'bg-surface-elev border-border text-fg' : 'bg-surface-elev border-border text-fg-mute hover:text-fg'}`}
            title="Toggle Filters"
          >
            <span className="material-symbols-outlined text-[20px]">tune</span>
          </button>
        </div>
        
        {/* Expandable Filter Panel */}
        {isFilterOpen && (
          <div className="bg-surface p-5 rounded-xl shadow-sm border border-border flex flex-wrap items-center gap-6">
            <div className="flex flex-col gap-2 min-w-[160px]">
              <label className="text-xs font-bold text-fg-mute uppercase tracking-wider">Type</label>
              <select 
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full bg-bg text-fg text-sm rounded-md py-2 px-3 border border-border focus:outline-none focus:ring-2 focus:ring-flame/20 transition-shadow appearance-none"
              >
                <option value="All Types">All Types</option>
                <option value="System">System</option>
                <option value="Custom">Custom</option>
              </select>
            </div>
            
            <div className="flex flex-col gap-2 min-w-[160px]">
              <label className="text-xs font-bold text-fg-mute uppercase tracking-wider">Category</label>
              <select 
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-bg text-fg text-sm rounded-md py-2 px-3 border border-border focus:outline-none focus:ring-2 focus:ring-flame/20 transition-shadow appearance-none"
              >
                {uniqueCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            
            <div className="flex flex-col gap-2 min-w-[160px]">
              <label className="text-xs font-bold text-fg-mute uppercase tracking-wider">Start Date</label>
              <div className="relative">
                <input 
                  type="date" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-bg text-fg text-sm rounded-md py-2 px-3 border border-border focus:outline-none focus:ring-2 focus:ring-flame/20 transition-shadow"
                />
              </div>
            </div>
            
            <div className="flex flex-col gap-2 min-w-[160px]">
              <label className="text-xs font-bold text-fg-mute uppercase tracking-wider">End Date</label>
              <div className="relative">
                <input 
                  type="date" 
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-bg text-fg text-sm rounded-md py-2 px-3 border border-border focus:outline-none focus:ring-2 focus:ring-flame/20 transition-shadow"
                />
              </div>
            </div>
          </div>
        )}
      
        {/* Table Card */}
        <div className="bg-surface-card rounded-2xl shadow-card border border-border overflow-hidden">
          {filteredSessions.length === 0 ? (
            <div className="p-12 text-center text-fg-mute font-body">
              No sessions match your filters.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-bg/50">
                  <th className="py-5 px-8 kicker text-fg-mute">Date</th>
                  <th className="py-5 px-6 kicker text-fg-mute">Athlete</th>
                  <th className="py-5 px-6 kicker text-fg-mute">Exercise</th>
                  <th className="py-5 px-6 kicker text-fg-mute">Category</th>
                  <th className="py-5 px-6 kicker text-fg-mute">Attempts</th>
                  <th className="py-5 px-6 kicker text-fg-mute">Reps</th>
                  <th className="py-5 px-6 kicker text-fg-mute">Duration</th>
                  <th className="py-5 px-8 kicker text-fg-mute text-right">Avg Accuracy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedSessions.map((session) => {
                  const accuracy = Number(session.average_accuracy);
                  const isGood = accuracy > 85;
                  const isFair = accuracy > 70 && accuracy <= 85;
                  
                  return (
                    <tr 
                      key={session.id} 
                      onClick={() => router.push(`/trainer/exercises/athlete/${session.customer_id}/session/${session.id}`)}
                      className="hover:bg-surface-elev transition-colors cursor-pointer"
                    >
                      <td className="py-5 px-8 text-sm text-fg font-medium">
                        {new Date(session.start_time).toLocaleDateString(undefined, {
                          weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
                        })}
                      </td>
                      <td className="py-5 px-6">
                        <div className="text-sm font-bold text-fg">{session.athlete_name || "Unknown"}</div>
                        <div className="text-xs text-fg-mute">{session.athlete_email}</div>
                      </td>
                      <td className="py-5 px-6 font-bold text-sm text-fg">
                        {session.exercise_name || session.exercise_id}
                      </td>
                      <td className="py-5 px-6 text-sm text-fg-mute capitalize">
                        {session.category || "-"}
                      </td>
                      <td className="py-5 px-6 text-sm text-fg-mute font-medium">
                        {session.total_attempts || 0}
                      </td>
                      <td className="py-5 px-6 text-sm text-fg-mute">
                        {session.total_reps}
                      </td>
                      <td className="py-5 px-6 text-sm text-fg-mute">
                        {Math.floor(session.total_duration_seconds / 60)}m {session.total_duration_seconds % 60}s
                      </td>
                      <td className="py-5 px-8 text-right">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md kicker border ${
                          isGood ? 'bg-ok/10 text-ok border-ok/20' :
                          isFair ? 'bg-warn/10 text-warn border-warn/20' :
                          'bg-err/10 text-err border-err/20'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            isGood ? 'bg-ok' :
                            isFair ? 'bg-warn' :
                            'bg-err'
                          }`}></span>
                          {accuracy}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <div className="flex items-center justify-between p-4 border-t border-border bg-bg/50">
            <span className="text-sm text-fg-mute">
              Showing {filteredSessions.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredSessions.length)} of {filteredSessions.length} entries
            </span>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-sm rounded-md border border-border bg-surface hover:bg-surface-elev disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-fg"
              >
                Previous
              </button>
              <span className="text-sm font-medium px-2 text-fg">
                Page {currentPage} of {Math.max(1, totalPages)}
              </span>
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="px-3 py-1.5 text-sm rounded-md border border-border bg-surface hover:bg-surface-elev disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-fg"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
