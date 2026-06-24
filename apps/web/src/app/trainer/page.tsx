"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "react-hot-toast";

interface Athlete {
  id: string;
  email: string;
  name: string | null;
  status: string;
  last_login: string | null;
  total_sessions?: number;
  last_session?: string | null;
}

export default function TrainerDashboardPage() {
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const [trainerId, setTrainerId] = useState<string | null>(null);

  const [newAthleteEmail, setNewAthleteEmail] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    const trainerAuth = localStorage.getItem("visionfit.auth.trainer");
    if (!trainerAuth) {
      router.push("/trainer/login");
      return;
    }
    const trainer = JSON.parse(trainerAuth);
    setTrainerId(trainer.id);
    fetchAthletes(trainer.id);
  }, [router]);

  const fetchAthletes = async (id: string) => {
    try {
      const res = await fetch(`http://localhost:5002/trainer/${id}/athletes`);
      const data = await res.json();
      setAthletes(data || []);
    } catch (err) {
      console.error("Failed to fetch athletes", err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (athleteId: string, currentStatus: string) => {
    if (!trainerId) return;
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    
    // Optimistic UI update
    setAthletes(prev => prev.map(a => a.id === athleteId ? { ...a, status: newStatus } : a));
    
    try {
      const res = await fetch(`http://localhost:5002/trainer/${trainerId}/athletes/${athleteId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        throw new Error('Failed to update status');
      }
    } catch (err) {
      console.error(err);
      // Revert on error
      setAthletes(prev => prev.map(a => a.id === athleteId ? { ...a, status: currentStatus } : a));
      toast.error("Failed to update athlete status.");
    }
  };

  const handleAddAthlete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trainerId) return;

    setIsAdding(true);
    try {
      const res = await fetch("http://localhost:5002/trainer/athletes/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trainer_id: trainerId, email: newAthleteEmail }),
      });

      const data = await res.json();
      if (data.status === "success" || data.message === "Athlete added successfully") {
        toast.success("Athlete added successfully!");
        setNewAthleteEmail("");
        fetchAthletes(trainerId); // Refresh list
      } else {
        toast.error(data.message || "Failed to add athlete");
      }
    } catch (err) {
      toast.error("Server error while adding athlete.");
    } finally {
      setIsAdding(false);
    }
  };

  if (loading) return <div className="p-12 text-on-surface-variant font-body">Loading Dashboard...</div>;

  return (
    <div className="px-10 py-10 w-full space-y-6">
      {/* Header Area */}
      <div className="flex justify-end items-center">
        <form onSubmit={handleAddAthlete} className="flex items-center gap-3">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline-variant text-[20px]">
              mail
            </span>
            <input 
              type="email" 
              placeholder="Athlete email address..." 
              required
              value={newAthleteEmail}
              onChange={(e) => setNewAthleteEmail(e.target.value)}
              className="w-64 bg-surface-container-lowest border border-outline/10 text-on-surface text-sm rounded-full py-3 pl-11 pr-4 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-shadow shadow-sm"
            />
          </div>
          <button 
            type="submit" 
            disabled={isAdding}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-full font-headline font-bold text-sm shadow-md hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-70 disabled:hover:scale-100"
          >
            {isAdding ? (
              <span className="material-symbols-outlined text-[20px] animate-spin">refresh</span>
            ) : (
              <span className="material-symbols-outlined text-[20px]">person_add</span>
            )}
            Add Athlete
          </button>
        </form>
      </div>

      {/* Athlete List */}
      <div className="bg-surface-container-lowest rounded-[2rem] shadow-[0_12px_40px_rgb(0,0,0,0.02)] border border-outline/5 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-outline/10">
              <th className="py-3 px-8 text-left text-[11px] font-label font-bold text-outline uppercase tracking-wider">Athlete</th>
              <th className="py-3 px-6 text-left text-[11px] font-label font-bold text-outline uppercase tracking-wider">Email</th>
              <th className="py-3 px-6 text-left text-[11px] font-label font-bold text-outline uppercase tracking-wider">Total Sessions</th>
              <th className="py-3 px-6 text-left text-[11px] font-label font-bold text-outline uppercase tracking-wider">Last Session</th>
              <th className="py-3 px-8 text-right text-[11px] font-label font-bold text-outline uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline/5">
            {athletes.map((athlete, index) => {
              // Mocking data for visual fidelity based on the design
              const isFirst = index === 0;
              const isSecond = index === 1;
              const isInjured = index === 3;
              
              const status = isInjured ? "INJURED" : isSecond ? "RESTING" : "ACTIVE";
              const score = isInjured ? "62.0" : isSecond ? "84.5" : isFirst ? "98.2" : "91.7";
              const trend = isInjured ? "-8.4%" : isSecond ? "0.0%" : isFirst ? "+4.2%" : "+1.5%";
              const trendColor = isInjured ? "text-error" : isSecond ? "text-outline" : "text-secondary-fixed-variant";
              const avatar = `https://ui-avatars.com/api/?name=${athlete.name || athlete.email.split('@')[0]}&background=random`;

              return (
                <tr 
                  key={athlete.id} 
                  onClick={() => router.push(`/trainer/athlete/${athlete.id}/sessions`)}
                  className="hover:bg-primary/5 transition-colors group cursor-pointer"
                >
                  <td className="py-3 px-8">
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-surface-container-high shrink-0 border border-outline/10">
                        <img src={avatar} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <span className="font-headline font-bold text-sm text-on-surface group-hover:text-primary transition-colors leading-tight">
                          {athlete.name || athlete.email.split('@')[0]}
                        </span>
                      </div>
                    </div>
                  </td>
                  
                  <td className="py-3 px-6 text-sm text-on-surface-variant font-medium">
                    {athlete.email}
                  </td>
                  
                  <td className="py-3 px-6 text-sm text-on-surface-variant font-medium">
                    {athlete.total_sessions || 0}
                  </td>
                  
                  <td className="py-3 px-6 text-sm text-on-surface-variant">
                    {athlete.last_session 
                      ? new Date(athlete.last_session).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) 
                      : 'Never'}
                  </td>

                  <td className="py-3 px-8 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-3">
                      <Link 
                        href={`/trainer/athlete/${athlete.id}/exercises`}
                        title="Exercise Configuration"
                        className="p-2 text-outline hover:text-on-surface transition-colors rounded-lg hover:bg-surface-container-high"
                      >
                        <span className="material-symbols-outlined text-[20px]">tune</span>
                      </Link>
                      <Link 
                        href={`/trainer/athlete/${athlete.id}/sessions`}
                        title="Session History"
                        className="p-2 text-outline hover:text-on-surface transition-colors rounded-lg hover:bg-surface-container-high"
                      >
                        <span className="material-symbols-outlined text-[20px]">history</span>
                      </Link>
                      <button 
                        onClick={() => handleToggleStatus(athlete.id, athlete.status)}
                        title={athlete.status === 'active' ? 'Deactivate Athlete' : 'Activate Athlete'}
                        className={`p-2 transition-colors rounded-lg hover:bg-surface-container-high ${athlete.status === 'active' ? 'text-green-600' : 'text-error'}`}
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          {athlete.status === 'active' ? 'toggle_on' : 'toggle_off'}
                        </span>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            
            {/* If no athletes, show a nice empty state */}
            {athletes.length === 0 && (
              <tr>
                <td colSpan={5} className="py-16 text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-surface-container-high text-outline mb-4">
                    <span className="material-symbols-outlined text-3xl">group_off</span>
                  </div>
                  <h3 className="text-lg font-headline font-bold text-on-surface">No athletes found</h3>
                  <p className="text-on-surface-variant mt-1 text-sm max-w-sm mx-auto">You haven't added any athletes to your roster yet. Click the Add Athlete button to get started.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
