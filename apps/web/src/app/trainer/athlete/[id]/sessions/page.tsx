"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function SessionsPage() {
  const params = useParams();
  const athleteId = params.id as string;
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
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!trainerId) return;
    fetch(`http://localhost:5002/trainer/${trainerId}/athletes/${athleteId}/sessions`)
      .then(res => res.json())
      .then(data => {
        setSessions(Array.isArray(data) ? data : (data?.data || []));
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch sessions", err);
        setLoading(false);
      });
  }, [athleteId, trainerId]);

  const filteredSessions = sessions.filter(session => {
    // Explicitly enforce that only sessions recorded in 'trainer' mode with this specific trainer are shown
    if (session.recorded_mode !== 'trainer' || String(session.trainer_id) !== String(trainerId)) {
      return false;
    }

    if (!search) return true;
    const s = search.toLowerCase();
    const dateStr = new Date(session.start_time).toLocaleDateString().toLowerCase();
    const exerciseName = (session.exercise_name || session.exercise_id || "").toLowerCase();
    return dateStr.includes(s) || exerciseName.includes(s);
  });

  if (loading) return <div className="p-8 text-on-surface-variant font-body animate-pulse">Loading session history...</div>;

  return (
    <div className="w-full h-full flex flex-col p-10 bg-surface-container-low/50">
      <div className="space-y-6">
      <div className="flex justify-between items-center bg-surface-container-lowest p-6 rounded-3xl shadow-sm border border-outline/5">
        <div>
          <h2 className="text-xl font-bold font-headline text-on-surface">Trainer Mode History</h2>
          <p className="text-sm text-on-surface-variant mt-1 font-body">
            Displaying workouts completed under your supervision.
          </p>
        </div>
        <div className="relative">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline-variant text-[20px]">
            search
          </span>
          <input 
            type="text" 
            placeholder="Search by date or exercise..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-72 bg-surface-container text-on-surface text-sm rounded-full py-3 pl-11 pr-4 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-shadow"
          />
        </div>
      </div>
      
      <div className="bg-surface-container-lowest rounded-3xl shadow-sm border border-outline/5 overflow-hidden">
        {filteredSessions.length === 0 ? (
          <div className="p-12 text-center text-on-surface-variant font-body">
            {search ? "No sessions match your search." : "This athlete hasn't recorded any workouts under your Trainer Mode yet."}
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-outline/10">
                <th className="py-5 px-8 text-[11px] font-label font-bold text-outline uppercase tracking-wider">Date</th>
                <th className="py-5 px-6 text-[11px] font-label font-bold text-outline uppercase tracking-wider">Exercise</th>
                <th className="py-5 px-6 text-[11px] font-label font-bold text-outline uppercase tracking-wider">Total Attempts</th>
                <th className="py-5 px-6 text-[11px] font-label font-bold text-outline uppercase tracking-wider">Reps</th>
                <th className="py-5 px-6 text-[11px] font-label font-bold text-outline uppercase tracking-wider">Duration</th>
                <th className="py-5 px-8 text-[11px] font-label font-bold text-outline uppercase tracking-wider text-right">Avg Accuracy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline/5">
              {filteredSessions.map((session) => {
                const accuracy = Number(session.average_accuracy);
                const isGood = accuracy > 85;
                const isFair = accuracy > 70 && accuracy <= 85;
                
                return (
                  <tr 
                    key={session.id} 
                    onClick={() => router.push(`/trainer/athlete/${athleteId}/session/${session.id}`)}
                    className="hover:bg-surface-container transition-colors cursor-pointer"
                  >
                    <td className="py-5 px-8 text-sm text-on-surface font-medium">
                      {new Date(session.start_time).toLocaleDateString(undefined, {
                        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
                      })}
                    </td>
                    <td className="py-5 px-6 text-sm text-on-surface font-headline font-bold">
                      {session.exercise_name || session.exercise_id}
                    </td>
                    <td className="py-5 px-6 text-sm text-on-surface-variant font-medium">
                      {session.total_attempts || 0}
                    </td>
                    <td className="py-5 px-6 text-sm text-on-surface-variant">
                      {session.total_reps}
                    </td>
                    <td className="py-5 px-6 text-sm text-on-surface-variant">
                      {Math.floor(session.total_duration_seconds / 60)}m {session.total_duration_seconds % 60}s
                    </td>
                    <td className="py-5 px-8 text-right">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-label font-bold tracking-wider uppercase border ${
                        isGood ? 'bg-secondary-container/30 text-secondary-fixed-variant border-secondary-fixed-dim/30' :
                        isFair ? 'bg-surface-container-high text-on-surface-variant border-outline/10' :
                        'bg-error-container/50 text-error border-error/20'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          isGood ? 'bg-secondary-fixed-variant' :
                          isFair ? 'bg-outline' :
                          'bg-error'
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
      </div>
    </div>
    </div>
  );
}
