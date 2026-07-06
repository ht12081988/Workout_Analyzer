'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';

export default function AthleteSessionsPage() {
  const params = useParams();
  const router = useRouter();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const athleteId = params?.id as string;
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    if (athleteId) {
      loadSessions();
    }
  }, [athleteId]);

  const filteredSessions = useMemo(() => {
    return sessions.filter(s => {
      if (search && !s.exercise_name?.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [sessions, search]);

  const totalPages = Math.ceil(filteredSessions.length / itemsPerPage) || 1;
  const paginatedSessions = filteredSessions.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  async function loadSessions() {
    setLoading(true);
    try {
      const res = await fetch(`/api/sessions?customer_id=${athleteId}`);
      if (!res.ok) throw new Error("Failed to load sessions");
      const data = await res.json();
      setSessions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load athlete sessions');
    } finally {
      setLoading(false);
    }
  }

  const formatDuration = (seconds: number) => {
    if (!seconds) return '0m 0s';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 80) return 'bg-ok/10 text-ok border-ok/20';
    if (accuracy >= 60) return 'bg-warn/10 text-warn border-warn/20';
    return 'bg-err/10 text-err border-err/20';
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-flame border-t-transparent rounded-full animate-spin"></div></div>;
  }

  return (
    <div className="px-10 py-10 w-full space-y-6">
      <div className="flex items-center">
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-fg-mute text-[20px]">search</span>
          <input 
            type="text" 
            placeholder="Search exercise..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-[280px] pl-10 pr-4 py-2 bg-bg border border-border rounded-lg text-sm text-fg focus:ring-2 focus:ring-flame/50 outline-none"
          />
        </div>
      </div>

      <div className="bg-surface-card rounded-xl shadow-card border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="border-b border-border bg-surface-elev">
                <th className="py-5 px-6 text-left kicker text-fg-mute">DATE</th>
                <th className="py-5 px-6 text-left kicker text-fg-mute">EXERCISE</th>
                <th className="py-5 px-6 text-left kicker text-fg-mute">TOTAL ATTEMPTS</th>
                <th className="py-5 px-6 text-left kicker text-fg-mute">REPS</th>
                <th className="py-5 px-6 text-left kicker text-fg-mute">DURATION</th>
                <th className="py-5 px-6 text-right kicker text-fg-mute">AVG ACCURACY</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedSessions.map((session) => (
                <tr key={session.id} className="hover:bg-surface-elev transition-colors group">
                  <td className="py-6 px-6 font-medium text-sm text-fg">
                    {new Date(session.start_time).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td className="py-6 px-6 font-bold text-sm text-fg">
                    {session.exercise_name || 'Unknown'}
                  </td>
                  <td className="py-6 px-6 text-sm text-fg-mute">
                    {session.total_attempts || 0}
                  </td>
                  <td className="py-6 px-6 text-sm text-fg-mute">
                    {session.total_reps || 0}
                  </td>
                  <td className="py-6 px-6 text-sm text-fg-mute">
                    {formatDuration(session.total_duration_seconds)}
                  </td>
                  <td className="py-6 px-6 text-right">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold border ${getAccuracyColor(session.average_accuracy || 0)}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                      {Number(session.average_accuracy || 0).toFixed(2)}%
                    </span>
                  </td>
                </tr>
              ))}
              {paginatedSessions.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-fg-mute">No sessions found for this athlete.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="p-4 border-t border-border flex justify-between items-center bg-surface-elev">
            <span className="text-sm text-fg-mute">
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredSessions.length)} of {filteredSessions.length} sessions
            </span>
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1 rounded-lg hover:bg-surface transition-colors text-fg disabled:opacity-50 flex items-center justify-center"
              >
                <span className="material-symbols-outlined">chevron_left</span>
              </button>
              <span className="text-sm font-medium text-fg">
                {currentPage} out of {totalPages}
              </span>
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1 rounded-lg hover:bg-surface transition-colors text-fg disabled:opacity-50 flex items-center justify-center"
              >
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
