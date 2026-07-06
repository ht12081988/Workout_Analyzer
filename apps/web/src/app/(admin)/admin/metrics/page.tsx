'use client';

import { useState, useEffect } from 'react';

export default function MasterMetricsPage() {
  const [masterMetrics, setMasterMetrics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function loadMetrics() {
      try {
        const res = await fetch('/api/metrics');
        const data = await res.json();
        setMasterMetrics(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadMetrics();
  }, []);

  const filteredMetrics = masterMetrics.filter(config => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (config.metric_name || '').toLowerCase().includes(term) || 
           (config.metric_key || '').toLowerCase().includes(term);
  });

  if (loading) return <div className="p-12 text-fg-mute text-sm flex justify-center py-20"><div className="w-8 h-8 border-4 border-flame border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="px-10 py-10 w-full flex flex-col gap-6">
      
      {/* Search */}
      <div className="flex items-center">
        <div className="relative w-80">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline-variant text-[20px]">
            search
          </span>
          <input 
            type="text" 
            placeholder="Search metrics by name or key..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface text-fg text-sm rounded-lg py-2.5 pl-11 pr-4 border border-border focus:outline-none focus:ring-2 focus:ring-flame/20 transition-shadow shadow-sm"
          />
        </div>
      </div>

      <div className="bg-surface-card rounded-xl shadow-card border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="border-b border-border bg-surface-elev">
                <th className="py-4 px-8 text-left kicker text-fg-mute">Metric Name</th>
                <th className="py-4 px-6 text-left kicker text-fg-mute">Description</th>
                <th className="py-4 px-6 text-center kicker text-fg-mute">Min</th>
                <th className="py-4 px-6 text-center kicker text-fg-mute">Max</th>
                <th className="py-4 px-6 text-left kicker text-fg-mute">Possible Exercises</th>
                <th className="py-4 px-8 text-center kicker text-fg-mute">Default Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredMetrics.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-fg-mute text-sm">
                    No metrics found matching "{search}"
                  </td>
                </tr>
              ) : (
                filteredMetrics.map((config) => (
                  <tr key={config.metric_key} className="hover:bg-surface-elev transition-colors group">
                    <td className="py-4 px-8">
                      <div className="font-bold text-sm text-fg group-hover:text-flame transition-colors leading-tight">{config.metric_name}</div>
                      <span className="font-mono text-[10px] text-flame bg-flame/10 px-2 py-0.5 rounded mt-1 inline-block">{config.metric_key}</span>
                    </td>
                    <td className="py-4 px-6 text-sm text-fg-mute max-w-xs">{config.description}</td>
                    <td className="py-4 px-6 text-center font-mono text-sm font-semibold text-fg">{config.min_val}</td>
                    <td className="py-4 px-6 text-center font-mono text-sm font-semibold text-fg">{config.max_val}</td>
                    <td className="py-4 px-6 text-sm text-fg-mute">
                      <span className="bg-surface-raised text-fg-mute border border-border px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">All Custom Exercises</span>
                    </td>
                    <td className="py-4 px-8 text-center font-mono text-sm text-fg-dim">-</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
